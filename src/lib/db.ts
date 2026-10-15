import mysql, { type Pool, type PoolConnection } from "mysql2/promise";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { genererPdfDemo } from "./pdf-demo";

// Stockage : MariaDB (connexion ci-dessous) pour les données, un dossier local pour les PDF déposés.
export const DOSSIER_DONNEES = path.join(process.cwd(), "data");
export const DOSSIER_FICHIERS = path.join(DOSSIER_DONNEES, "fichiers");

export type Role = "etudiant" | "enseignant" | "admin";

export type Utilisateur = {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  role: Role;
  annee_but: number | null;
  groupe: string | null;
  parcours: string | null;
  referent_id: string | null;
  // 0 = compte désactivé (sortie de formation, départ) : données conservées, plus d'accès.
  actif: number;
  // Notifications par courriel : « immediat », « quotidien » (enseignants) ou « aucun ».
  pref_courriel: PreferenceCourriel;
  // Identifiant stable transmis par le fournisseur OpenID Connect de l'université (rempli au premier
  // vrai login SSO, en liant le compte existant repéré par email) ; absent en mode démonstration.
  identifiant_oidc: string | null;
};

export type PreferenceCourriel = "immediat" | "quotidien" | "aucun";

export type Argumentaire = {
  etudiant_id: string;
  annee: number;
  competence: string;
  texte: string;
  maj_le: string;
};

export type Trace = {
  id: string;
  etudiant_id: string;
  annee: number;
  competence: string;
  titre: string;
  description: string;
  fichier_nom: string;
  taille: number;
  depose_le: string;
  maj_le: string;
};

// Le brouillon (niveau, commentaire) reste privé ; l'étudiant ne voit que la version publiée.
export type Evaluation = {
  etudiant_id: string;
  annee: number;
  competence: string;
  niveau: string;
  commentaire: string;
  enseignant_id: string;
  maj_le: string;
  niveau_publie: string | null;
  commentaire_publie: string | null;
  publiee_le: string | null;
  publiee_par: string | null;
  // Note sur 20, obligatoire avec tout niveau évalué : brouillon et version publiée, comme le niveau.
  note: number | null;
  note_publiee: number | null;
};

export function brouillonNonPublie(e: Evaluation | undefined): boolean {
  return !!e && (e.niveau_publie !== e.niveau || (e.commentaire_publie ?? "") !== e.commentaire || e.note_publiee !== e.note);
}

export type EntreeJournal = {
  id: number;
  etudiant_id: string;
  acteur_id: string;
  annee: number | null;
  competence: string | null;
  type: string;
  detail: string;
  cree_le: string;
};

// ---------- Connexion MariaDB ----------
// Réglages dans .env.local (voir .env.example) : DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME.

const globalPourDb = globalThis as unknown as { __dbPoolPortfolio?: Promise<Pool> };

async function creerPool(): Promise<Pool> {
  const hote = process.env.DB_HOST || "localhost";
  const port = Number(process.env.DB_PORT || 3306);
  const utilisateur = process.env.DB_USER || "folio_gea";
  const motDePasse = process.env.DB_PASSWORD || "";
  const base = process.env.DB_NAME || "folio_gea";

  // La base peut ne pas exister encore (premier démarrage) : on la crée si besoin, via une
  // connexion à part, avant d'ouvrir le pool applicatif sur cette base.
  const amorce = await mysql.createConnection({ host: hote, port, user: utilisateur, password: motDePasse });
  await amorce.query(`CREATE DATABASE IF NOT EXISTS \`${base}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await amorce.end();

  const pool = mysql.createPool({
    host: hote,
    port,
    user: utilisateur,
    password: motDePasse,
    database: base,
    charset: "utf8mb4_unicode_ci",
    decimalNumbers: true, // les notes (DECIMAL) reviennent en nombre JS, pas en chaîne
    waitForConnections: true,
    connectionLimit: 10,
    dateStrings: true,
  });

  await creerSchema(pool);
  const [[{ n }]] = (await pool.query("SELECT COUNT(*) AS n FROM utilisateurs")) as [{ n: number }[], unknown];
  if (n === 0) await peuplerDemo(pool);
  await completerDemo(pool);
  await completerDemoRendezVous(pool);
  await completerDemoParcours(pool);
  // Étudiants créés avant l'ajout du parcours : seul le référentiel GEMA est configuré.
  await pool.query("UPDATE utilisateurs SET parcours = 'GEMA' WHERE role = 'etudiant' AND parcours IS NULL");

  return pool;
}

function obtenirPool(): Promise<Pool> {
  if (!globalPourDb.__dbPoolPortfolio) globalPourDb.__dbPoolPortfolio = creerPool();
  return globalPourDb.__dbPoolPortfolio;
}

async function creerSchema(pool: Pool) {
  const tables = [
    `CREATE TABLE IF NOT EXISTS utilisateurs (
      id VARCHAR(64) PRIMARY KEY,
      nom VARCHAR(255) NOT NULL,
      prenom VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      role VARCHAR(20) NOT NULL CHECK (role IN ('etudiant','enseignant','admin')),
      annee_but TINYINT,
      groupe VARCHAR(50),
      referent_id VARCHAR(64) REFERENCES utilisateurs(id),
      actif TINYINT NOT NULL DEFAULT 1,
      pref_courriel VARCHAR(20) NOT NULL DEFAULT 'immediat',
      parcours VARCHAR(20),
      identifiant_oidc VARCHAR(255) UNIQUE
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS presentations (
      etudiant_id VARCHAR(64) PRIMARY KEY REFERENCES utilisateurs(id),
      texte TEXT NOT NULL,
      projet_pro TEXT NOT NULL,
      maj_le VARCHAR(32) NOT NULL
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS argumentaires (
      etudiant_id VARCHAR(64) NOT NULL REFERENCES utilisateurs(id),
      annee TINYINT NOT NULL,
      competence VARCHAR(10) NOT NULL,
      texte TEXT NOT NULL,
      maj_le VARCHAR(32) NOT NULL,
      PRIMARY KEY (etudiant_id, annee, competence)
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS traces (
      id VARCHAR(64) PRIMARY KEY,
      etudiant_id VARCHAR(64) NOT NULL REFERENCES utilisateurs(id),
      annee TINYINT NOT NULL,
      competence VARCHAR(10) NOT NULL,
      titre VARCHAR(255) NOT NULL,
      description TEXT NOT NULL,
      fichier_nom VARCHAR(255) NOT NULL,
      taille INT NOT NULL,
      depose_le VARCHAR(32) NOT NULL,
      maj_le VARCHAR(32) NOT NULL
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS evaluations (
      etudiant_id VARCHAR(64) NOT NULL REFERENCES utilisateurs(id),
      annee TINYINT NOT NULL,
      competence VARCHAR(10) NOT NULL,
      niveau VARCHAR(20) NOT NULL,
      commentaire TEXT NOT NULL,
      enseignant_id VARCHAR(64) NOT NULL REFERENCES utilisateurs(id),
      maj_le VARCHAR(32) NOT NULL,
      niveau_publie VARCHAR(20),
      commentaire_publie TEXT,
      publiee_le VARCHAR(32),
      publiee_par VARCHAR(64),
      note DECIMAL(4,2),
      note_publiee DECIMAL(4,2),
      PRIMARY KEY (etudiant_id, annee, competence)
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS journal (
      id INT PRIMARY KEY AUTO_INCREMENT,
      etudiant_id VARCHAR(64) NOT NULL REFERENCES utilisateurs(id),
      acteur_id VARCHAR(64) NOT NULL REFERENCES utilisateurs(id),
      annee TINYINT,
      competence VARCHAR(10),
      type VARCHAR(40) NOT NULL,
      detail TEXT NOT NULL,
      cree_le VARCHAR(32) NOT NULL,
      INDEX journal_etudiant (etudiant_id, cree_le)
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS consultations (
      enseignant_id VARCHAR(64) NOT NULL REFERENCES utilisateurs(id),
      etudiant_id VARCHAR(64) NOT NULL REFERENCES utilisateurs(id),
      vu_le VARCHAR(32) NOT NULL,
      PRIMARY KEY (enseignant_id, etudiant_id)
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS notifications (
      id INT PRIMARY KEY AUTO_INCREMENT,
      destinataire_id VARCHAR(64) NOT NULL REFERENCES utilisateurs(id),
      titre VARCHAR(255) NOT NULL,
      detail TEXT NOT NULL,
      lien VARCHAR(255) NOT NULL,
      lue TINYINT NOT NULL DEFAULT 0,
      cree_le VARCHAR(32) NOT NULL,
      INDEX notifications_destinataire (destinataire_id, lue)
    ) ENGINE=InnoDB`,
    // Deux rendez-vous de suivi par étudiant et par année (note sur 20 + compte rendu),
    // avec un brouillon et une version publiée, comme les évaluations.
    `CREATE TABLE IF NOT EXISTS rendez_vous (
      etudiant_id VARCHAR(64) NOT NULL REFERENCES utilisateurs(id),
      annee TINYINT NOT NULL,
      numero TINYINT NOT NULL CHECK (numero IN (1, 2)),
      date_rdv VARCHAR(10),
      note DECIMAL(4,2),
      commentaire TEXT NOT NULL,
      enseignant_id VARCHAR(64) NOT NULL REFERENCES utilisateurs(id),
      maj_le VARCHAR(32) NOT NULL,
      note_publiee DECIMAL(4,2),
      commentaire_publie TEXT,
      publie_le VARCHAR(32),
      PRIMARY KEY (etudiant_id, annee, numero)
    ) ENGINE=InnoDB`,
    // File d'attente des courriels : alimentée selon la préférence de chacun,
    // elle sera vidée par l'envoi SMTP de l'université une fois branché.
    `CREATE TABLE IF NOT EXISTS courriels (
      id INT PRIMARY KEY AUTO_INCREMENT,
      destinataire_id VARCHAR(64) NOT NULL REFERENCES utilisateurs(id),
      adresse VARCHAR(255) NOT NULL,
      sujet VARCHAR(255) NOT NULL,
      corps TEXT NOT NULL,
      mode VARCHAR(20) NOT NULL CHECK (mode IN ('immediat','quotidien')),
      statut VARCHAR(20) NOT NULL DEFAULT 'en_attente',
      cree_le VARCHAR(32) NOT NULL
    ) ENGINE=InnoDB`,
    // Réglages globaux simples (ex. activation du parcours CG2P), modifiables par l'administrateur.
    `CREATE TABLE IF NOT EXISTS parametres (
      cle VARCHAR(50) PRIMARY KEY,
      valeur VARCHAR(255) NOT NULL
    ) ENGINE=InnoDB`,
  ];
  for (const sql of tables) await pool.query(sql);
  // Colonnes ajoutées après la création initiale de la table (sans effet si déjà présentes :
  // MariaDB ignore silencieusement un ADD COLUMN IF NOT EXISTS déjà satisfait).
  await pool.query("ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS identifiant_oidc VARCHAR(255) UNIQUE");
  await pool.query("ALTER TABLE courriels ADD COLUMN IF NOT EXISTS envoye_le VARCHAR(32)");
}

const maintenant = () => new Date().toISOString();

export function cheminFichier(traceId: string) {
  return path.join(DOSSIER_FICHIERS, `${traceId}.pdf`);
}

// ---------- Lecture ----------

export async function getUtilisateur(id: string): Promise<Utilisateur | undefined> {
  const pool = await obtenirPool();
  const [lignes] = await pool.query("SELECT * FROM utilisateurs WHERE id = ?", [id]);
  return (lignes as Utilisateur[])[0];
}

// Connexion OpenID Connect : retrouve le compte déjà lié (connexions suivantes), sinon le compte
// existant (créé par l'administrateur, import ou ajout manuel) reconnu par son adresse mail.
export async function getUtilisateurParOidc(identifiantOidc: string): Promise<Utilisateur | undefined> {
  const pool = await obtenirPool();
  const [lignes] = await pool.query("SELECT * FROM utilisateurs WHERE identifiant_oidc = ?", [identifiantOidc]);
  return (lignes as Utilisateur[])[0];
}

export async function getUtilisateurParEmail(email: string): Promise<Utilisateur | undefined> {
  const pool = await obtenirPool();
  const [lignes] = await pool.query("SELECT * FROM utilisateurs WHERE LOWER(email) = LOWER(?)", [email]);
  return (lignes as Utilisateur[])[0];
}

export async function lierIdentifiantOidc(id: string, identifiantOidc: string) {
  const pool = await obtenirPool();
  await pool.query("UPDATE utilisateurs SET identifiant_oidc = ? WHERE id = ?", [identifiantOidc, id]);
}

export async function listerUtilisateurs(): Promise<Utilisateur[]> {
  const pool = await obtenirPool();
  const [lignes] = await pool.query("SELECT * FROM utilisateurs WHERE actif = 1 ORDER BY role DESC, annee_but, nom");
  return lignes as Utilisateur[];
}

export async function listerComptesDesactives(): Promise<Utilisateur[]> {
  const pool = await obtenirPool();
  const [lignes] = await pool.query("SELECT * FROM utilisateurs WHERE actif = 0 ORDER BY role DESC, nom, prenom");
  return lignes as Utilisateur[];
}

export async function listerEtudiants(
  filtre: { anneeBut?: number; referentId?: string; inclureDesactives?: boolean } = {},
): Promise<Utilisateur[]> {
  const conditions = ["role = 'etudiant'"];
  if (!filtre.inclureDesactives) conditions.push("actif = 1");
  const params: string[] = [];
  if (filtre.anneeBut) {
    conditions.push("annee_but = ?");
    params.push(String(filtre.anneeBut));
  }
  if (filtre.referentId) {
    conditions.push("referent_id = ?");
    params.push(filtre.referentId);
  }
  const pool = await obtenirPool();
  const [lignes] = await pool.query(
    `SELECT * FROM utilisateurs WHERE ${conditions.join(" AND ")} ORDER BY annee_but, nom, prenom`,
    params,
  );
  return lignes as Utilisateur[];
}

export async function listerEnseignants(): Promise<Utilisateur[]> {
  const pool = await obtenirPool();
  const [lignes] = await pool.query(
    "SELECT * FROM utilisateurs WHERE role IN ('enseignant','admin') AND actif = 1 ORDER BY nom, prenom",
  );
  return lignes as Utilisateur[];
}

export async function definirReferent(etudiantId: string, referentId: string | null) {
  const pool = await obtenirPool();
  await pool.query("UPDATE utilisateurs SET referent_id = ? WHERE id = ? AND role = 'etudiant'", [referentId, etudiantId]);
}

export async function getPresentation(etudiantId: string) {
  const pool = await obtenirPool();
  const [lignes] = await pool.query("SELECT * FROM presentations WHERE etudiant_id = ?", [etudiantId]);
  return (lignes as { etudiant_id: string; texte: string; projet_pro: string; maj_le: string }[])[0];
}

export async function getArgumentaires(etudiantId: string): Promise<Argumentaire[]> {
  const pool = await obtenirPool();
  const [lignes] = await pool.query("SELECT * FROM argumentaires WHERE etudiant_id = ?", [etudiantId]);
  return lignes as Argumentaire[];
}

export async function getTraces(etudiantId: string): Promise<Trace[]> {
  const pool = await obtenirPool();
  const [lignes] = await pool.query("SELECT * FROM traces WHERE etudiant_id = ? ORDER BY depose_le", [etudiantId]);
  return lignes as Trace[];
}

export async function getTrace(id: string): Promise<Trace | undefined> {
  const pool = await obtenirPool();
  const [lignes] = await pool.query("SELECT * FROM traces WHERE id = ?", [id]);
  return (lignes as Trace[])[0];
}

export async function getEvaluations(etudiantId: string): Promise<Evaluation[]> {
  const pool = await obtenirPool();
  const [lignes] = await pool.query("SELECT * FROM evaluations WHERE etudiant_id = ?", [etudiantId]);
  return lignes as Evaluation[];
}

export async function getJournal(
  opts: { etudiantId?: string; anneeBut?: number; referentId?: string; limite?: number } = {},
) {
  const conditions: string[] = [];
  const params: (string | number)[] = [];
  if (opts.referentId) {
    conditions.push("e.referent_id = ?");
    params.push(opts.referentId);
  }
  if (opts.etudiantId) {
    conditions.push("j.etudiant_id = ?");
    params.push(opts.etudiantId);
  }
  if (opts.anneeBut) {
    conditions.push("e.annee_but = ?");
    params.push(opts.anneeBut);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  params.push(opts.limite ?? 50);
  const pool = await obtenirPool();
  const [lignes] = await pool.query(
    `SELECT j.*, CONCAT(e.prenom, ' ', e.nom) AS etudiant_nom, CONCAT(a.prenom, ' ', a.nom) AS acteur_nom, a.role AS acteur_role
     FROM journal j
     JOIN utilisateurs e ON e.id = j.etudiant_id
     JOIN utilisateurs a ON a.id = j.acteur_id
     ${where}
     ORDER BY j.cree_le DESC, j.id DESC LIMIT ?`,
    params,
  );
  return lignes as (EntreeJournal & { etudiant_nom: string; acteur_nom: string; acteur_role: Role })[];
}

export async function getDerniereConsultation(enseignantId: string, etudiantId: string): Promise<string | null> {
  const pool = await obtenirPool();
  const [lignes] = await pool.query("SELECT vu_le FROM consultations WHERE enseignant_id = ? AND etudiant_id = ?", [
    enseignantId,
    etudiantId,
  ]);
  return (lignes as { vu_le: string }[])[0]?.vu_le ?? null;
}

// Dernière modification faite par l'étudiant, par cellule (année × compétence).
export async function getDernieresModifsEtudiant(etudiantId: string): Promise<Map<string, string>> {
  const pool = await obtenirPool();
  const [lignes] = await pool.query(
    `SELECT annee, competence, MAX(cree_le) AS derniere FROM journal
     WHERE etudiant_id = ? AND acteur_id = ? AND competence IS NOT NULL
     GROUP BY annee, competence`,
    [etudiantId, etudiantId],
  );
  return new Map((lignes as { annee: number; competence: string; derniere: string }[]).map((l) => [`${l.annee}-${l.competence}`, l.derniere]));
}

// ---------- Écriture ----------

export async function journaliser(e: Omit<EntreeJournal, "id" | "cree_le">) {
  const pool = await obtenirPool();
  await pool.query(
    "INSERT INTO journal (etudiant_id, acteur_id, annee, competence, type, detail, cree_le) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [e.etudiant_id, e.acteur_id, e.annee, e.competence, e.type, e.detail, maintenant()],
  );
}

export async function enregistrerPresentation(etudiantId: string, texte: string, projetPro: string) {
  const pool = await obtenirPool();
  await pool.query(
    `INSERT INTO presentations (etudiant_id, texte, projet_pro, maj_le) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE texte = VALUES(texte), projet_pro = VALUES(projet_pro), maj_le = VALUES(maj_le)`,
    [etudiantId, texte, projetPro, maintenant()],
  );
}

export async function enregistrerArgumentaire(etudiantId: string, annee: number, competence: string, texte: string) {
  const pool = await obtenirPool();
  await pool.query(
    `INSERT INTO argumentaires (etudiant_id, annee, competence, texte, maj_le) VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE texte = VALUES(texte), maj_le = VALUES(maj_le)`,
    [etudiantId, annee, competence, texte, maintenant()],
  );
}

export async function ajouterTrace(t: Omit<Trace, "id" | "depose_le" | "maj_le">, contenu: Buffer): Promise<string> {
  const id = randomUUID();
  fs.writeFileSync(cheminFichier(id), contenu);
  const date = maintenant();
  const pool = await obtenirPool();
  await pool.query(
    `INSERT INTO traces (id, etudiant_id, annee, competence, titre, description, fichier_nom, taille, depose_le, maj_le)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, t.etudiant_id, t.annee, t.competence, t.titre, t.description, t.fichier_nom, t.taille, date, date],
  );
  return id;
}

export async function modifierTrace(
  id: string,
  champs: { titre: string; description: string },
  fichier?: { nom: string; contenu: Buffer },
) {
  const pool = await obtenirPool();
  if (fichier) {
    fs.writeFileSync(cheminFichier(id), fichier.contenu);
    await pool.query("UPDATE traces SET fichier_nom = ?, taille = ? WHERE id = ?", [fichier.nom, fichier.contenu.length, id]);
  }
  await pool.query("UPDATE traces SET titre = ?, description = ?, maj_le = ? WHERE id = ?", [
    champs.titre,
    champs.description,
    maintenant(),
    id,
  ]);
}

export async function supprimerTrace(id: string) {
  const pool = await obtenirPool();
  await pool.query("DELETE FROM traces WHERE id = ?", [id]);
  fs.rmSync(cheminFichier(id), { force: true });
}

export async function enregistrerEvaluation(
  e: Pick<Evaluation, "etudiant_id" | "annee" | "competence" | "niveau" | "note" | "commentaire" | "enseignant_id">,
) {
  const pool = await obtenirPool();
  await pool.query(
    `INSERT INTO evaluations (etudiant_id, annee, competence, niveau, note, commentaire, enseignant_id, maj_le)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       niveau = VALUES(niveau), note = VALUES(note), commentaire = VALUES(commentaire),
       enseignant_id = VALUES(enseignant_id), maj_le = VALUES(maj_le)`,
    [e.etudiant_id, e.annee, e.competence, e.niveau, e.note, e.commentaire, e.enseignant_id, maintenant()],
  );
}

// Évaluations en brouillon qui ne peuvent pas être publiées faute de note.
export async function evaluationsSansNote(etudiantId: string, annee: number): Promise<string[]> {
  const pool = await obtenirPool();
  const [lignes] = await pool.query(
    "SELECT competence FROM evaluations WHERE etudiant_id = ? AND annee = ? AND niveau <> 'non_evalue' AND note IS NULL",
    [etudiantId, annee],
  );
  return (lignes as { competence: string }[]).map((r) => r.competence);
}

// Publie le brouillon (niveau, note, commentaire) : l'étudiant le voit désormais.
// Une évaluation sans note n'est pas publiable. Renvoie les évaluations publiées (vide si rien à publier).
export async function publierEvaluations(
  cible: { etudiantId: string; annee: number; competence?: string },
  publieePar: string,
): Promise<{ competence: string; niveau: string; note: number }[]> {
  const conditions = ["etudiant_id = ?", "annee = ?"];
  const params: (string | number)[] = [cible.etudiantId, cible.annee];
  if (cible.competence) {
    conditions.push("competence = ?");
    params.push(cible.competence);
  }
  const where = conditions.join(" AND ");
  const critereChangement =
    "niveau <> 'non_evalue' AND note IS NOT NULL AND (NOT (niveau_publie <=> niveau) OR NOT (note_publiee <=> note) OR NOT (commentaire_publie <=> commentaire))";
  const pool = await obtenirPool();
  const [avant] = await pool.query(
    `SELECT competence, niveau, note FROM evaluations WHERE ${where} AND ${critereChangement}`,
    params,
  );
  const lignes = avant as { competence: string; niveau: string; note: number }[];
  if (lignes.length) {
    await pool.query(
      `UPDATE evaluations SET niveau_publie = niveau, note_publiee = note, commentaire_publie = commentaire, publiee_le = ?, publiee_par = ?
       WHERE ${where} AND ${critereChangement}`,
      [maintenant(), publieePar, ...params],
    );
  }
  return lignes;
}

// ---------- Rendez-vous de suivi ----------

export type RendezVous = {
  etudiant_id: string;
  annee: number;
  numero: 1 | 2;
  date_rdv: string | null;
  note: number | null;
  commentaire: string;
  enseignant_id: string;
  maj_le: string;
  note_publiee: number | null;
  commentaire_publie: string | null;
  publie_le: string | null;
};

export function rendezVousNonPublie(r: RendezVous | undefined): boolean {
  return !!r && r.note !== null && (r.note_publiee !== r.note || (r.commentaire_publie ?? "") !== r.commentaire);
}

export async function getRendezVous(etudiantId: string): Promise<RendezVous[]> {
  const pool = await obtenirPool();
  const [lignes] = await pool.query("SELECT * FROM rendez_vous WHERE etudiant_id = ? ORDER BY annee, numero", [etudiantId]);
  return lignes as RendezVous[];
}

export async function enregistrerRendezVous(
  r: Pick<RendezVous, "etudiant_id" | "annee" | "numero" | "date_rdv" | "note" | "commentaire" | "enseignant_id">,
) {
  const pool = await obtenirPool();
  await pool.query(
    `INSERT INTO rendez_vous (etudiant_id, annee, numero, date_rdv, note, commentaire, enseignant_id, maj_le)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       date_rdv = VALUES(date_rdv), note = VALUES(note), commentaire = VALUES(commentaire),
       enseignant_id = VALUES(enseignant_id), maj_le = VALUES(maj_le)`,
    [r.etudiant_id, r.annee, r.numero, r.date_rdv, r.note, r.commentaire, r.enseignant_id, maintenant()],
  );
}

// Publie la note et le compte rendu du (ou des) rendez-vous ; renvoie ceux publiés.
export async function publierRendezVous(cible: {
  etudiantId: string;
  annee: number;
  numero?: number;
}): Promise<{ numero: number; note: number }[]> {
  const conditions = ["etudiant_id = ?", "annee = ?"];
  const params: (string | number)[] = [cible.etudiantId, cible.annee];
  if (cible.numero) {
    conditions.push("numero = ?");
    params.push(cible.numero);
  }
  const where = conditions.join(" AND ");
  const critereChangement = "note IS NOT NULL AND (NOT (note_publiee <=> note) OR NOT (commentaire_publie <=> commentaire))";
  const pool = await obtenirPool();
  const [avant] = await pool.query(`SELECT numero, note FROM rendez_vous WHERE ${where} AND ${critereChangement}`, params);
  const lignes = avant as { numero: number; note: number }[];
  if (lignes.length) {
    await pool.query(
      `UPDATE rendez_vous SET note_publiee = note, commentaire_publie = commentaire, publie_le = ?
       WHERE ${where} AND ${critereChangement}`,
      [maintenant(), ...params],
    );
  }
  return lignes;
}

// ---------- Notifications ----------

export type Notification = {
  id: number;
  destinataire_id: string;
  titre: string;
  detail: string;
  lien: string;
  lue: number;
  cree_le: string;
};

// Notification dans l'outil, doublée d'un courriel en file d'attente si le destinataire l'a choisi.
export async function notifier(n: Pick<Notification, "destinataire_id" | "titre" | "detail" | "lien">) {
  const pool = await obtenirPool();
  await pool.query("INSERT INTO notifications (destinataire_id, titre, detail, lien, cree_le) VALUES (?, ?, ?, ?, ?)", [
    n.destinataire_id,
    n.titre,
    n.detail,
    n.lien,
    maintenant(),
  ]);
  await mettreEnFileCourriel(n);
}

async function mettreEnFileCourriel(n: Pick<Notification, "destinataire_id" | "titre" | "detail" | "lien">) {
  const d = await getUtilisateur(n.destinataire_id);
  if (!d || !d.actif || d.pref_courriel === "aucun" || d.email.endsWith(".a-renseigner")) return;
  const pool = await obtenirPool();
  await pool.query(
    "INSERT INTO courriels (destinataire_id, adresse, sujet, corps, mode, cree_le) VALUES (?, ?, ?, ?, ?, ?)",
    [d.id, d.email, `[Folio GEA] ${n.titre}`, `${n.detail}\n\nVoir dans Folio GEA : ${n.lien}`, d.pref_courriel, maintenant()],
  );
}

// Notification du référent après un dépôt de l'étudiant. Tant que la précédente n'est pas lue,
// on la met à jour au lieu d'en créer une nouvelle : pas d'avalanche pendant que l'étudiant travaille.
export async function notifierReferent(etudiant: Utilisateur, titre: string, detail: string, lien: string) {
  if (!etudiant.referent_id) return;
  const pool = await obtenirPool();
  const [lignes] = await pool.query("SELECT id, detail FROM notifications WHERE destinataire_id = ? AND lien = ? AND lue = 0", [
    etudiant.referent_id,
    lien,
  ]);
  const enCours = (lignes as { id: number; detail: string }[])[0];
  if (enCours) {
    const nb = Number(enCours.detail.match(/^(\d+) modifications/)?.[1] ?? 1) + 1;
    await pool.query("UPDATE notifications SET titre = ?, detail = ?, cree_le = ? WHERE id = ?", [
      titre,
      `${nb} modifications depuis votre dernière lecture · dernière : ${detail}`,
      maintenant(),
      enCours.id,
    ]);
    return;
  }
  await notifier({ destinataire_id: etudiant.referent_id, titre, detail, lien });
}

export async function compterCourrielsEnAttente(): Promise<{ immediat: number; quotidien: number }> {
  const pool = await obtenirPool();
  const [lignes] = await pool.query("SELECT mode, COUNT(*) AS n FROM courriels WHERE statut = 'en_attente' GROUP BY mode");
  const l = lignes as { mode: "immediat" | "quotidien"; n: number }[];
  return { immediat: l.find((x) => x.mode === "immediat")?.n ?? 0, quotidien: l.find((x) => x.mode === "quotidien")?.n ?? 0 };
}

export type Courriel = {
  id: number;
  destinataire_id: string;
  adresse: string;
  sujet: string;
  corps: string;
  mode: "immediat" | "quotidien";
  statut: "en_attente" | "envoye" | "echec";
  cree_le: string;
  envoye_le: string | null;
};

export async function getCourrielsEnAttente(mode: "immediat" | "quotidien"): Promise<Courriel[]> {
  const pool = await obtenirPool();
  const [lignes] = await pool.query("SELECT * FROM courriels WHERE statut = 'en_attente' AND mode = ? ORDER BY cree_le", [mode]);
  return lignes as Courriel[];
}

export async function marquerCourrielEnvoye(id: number) {
  const pool = await obtenirPool();
  await pool.query("UPDATE courriels SET statut = 'envoye', envoye_le = ? WHERE id = ?", [maintenant(), id]);
}

export async function marquerCourrielEchec(id: number) {
  const pool = await obtenirPool();
  await pool.query("UPDATE courriels SET statut = 'echec' WHERE id = ?", [id]);
}

export async function definirPreferenceCourriel(id: string, pref: PreferenceCourriel) {
  const pool = await obtenirPool();
  await pool.query("UPDATE utilisateurs SET pref_courriel = ? WHERE id = ?", [pref, id]);
}

export async function getNotifications(destinataireId: string, limite = 50): Promise<Notification[]> {
  const pool = await obtenirPool();
  const [lignes] = await pool.query("SELECT * FROM notifications WHERE destinataire_id = ? ORDER BY cree_le DESC, id DESC LIMIT ?", [
    destinataireId,
    limite,
  ]);
  return lignes as Notification[];
}

export async function compterNotificationsNonLues(destinataireId: string): Promise<number> {
  const pool = await obtenirPool();
  const [lignes] = await pool.query("SELECT COUNT(*) AS n FROM notifications WHERE destinataire_id = ? AND lue = 0", [destinataireId]);
  return (lignes as { n: number }[])[0].n;
}

export async function marquerNotificationsLues(destinataireId: string) {
  const pool = await obtenirPool();
  await pool.query("UPDATE notifications SET lue = 1 WHERE destinataire_id = ? AND lue = 0", [destinataireId]);
}

// ---------- Comptes (ajout manuel et import) ----------

export type NouvelUtilisateur = {
  nom: string;
  prenom: string;
  email?: string;
  role: Role;
  annee_but?: number | null;
  groupe?: string | null;
  parcours?: string | null;
  referent_id?: string | null;
};

// Sans adresse fournie, on en génère une provisoire : la vraie viendra de l'annuaire (CAS).
async function emailProvisoire(prenom: string, nom: string, role: Role) {
  const base = `${prenom}.${nom}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9.]+/g, "-");
  const domaine = role === "etudiant" ? "etu.a-renseigner" : "a-renseigner";
  const pool = await obtenirPool();
  let email = `${base}@${domaine}`;
  for (let i = 2; ; i++) {
    const [lignes] = await pool.query("SELECT 1 FROM utilisateurs WHERE email = ?", [email]);
    if ((lignes as unknown[]).length === 0) break;
    email = `${base}${i}@${domaine}`;
  }
  return email;
}

export async function emailExiste(email: string): Promise<boolean> {
  const pool = await obtenirPool();
  const [lignes] = await pool.query("SELECT 1 FROM utilisateurs WHERE LOWER(email) = LOWER(?)", [email]);
  return (lignes as unknown[]).length > 0;
}

export async function creerUtilisateur(u: NouvelUtilisateur): Promise<string> {
  const id = `${u.role === "etudiant" ? "etu" : "ens"}-${randomUUID().slice(0, 8)}`;
  const pool = await obtenirPool();
  await pool.query(
    `INSERT INTO utilisateurs (id, nom, prenom, email, role, annee_but, groupe, parcours, referent_id, pref_courriel)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      u.nom,
      u.prenom,
      u.email?.trim().toLowerCase() || (await emailProvisoire(u.prenom, u.nom, u.role)),
      u.role,
      u.role === "etudiant" ? (u.annee_but ?? 1) : null,
      u.groupe || null,
      u.role === "etudiant" ? (u.parcours ?? "GEMA") : null,
      u.role === "etudiant" ? (u.referent_id ?? null) : null,
      u.role === "etudiant" ? "immediat" : "aucun",
    ],
  );
  return id;
}

export async function modifierEmail(id: string, email: string) {
  const pool = await obtenirPool();
  await pool.query("UPDATE utilisateurs SET email = ? WHERE id = ?", [email.trim().toLowerCase(), id]);
}

export async function mettreAJourEtudiant(
  id: string,
  champs: { annee_but: number; parcours: string; referent_id?: string | null },
) {
  const pool = await obtenirPool();
  await pool.query("UPDATE utilisateurs SET annee_but = ?, parcours = ? WHERE id = ? AND role = 'etudiant'", [
    champs.annee_but,
    champs.parcours,
    id,
  ]);
  if (champs.referent_id !== undefined) await definirReferent(id, champs.referent_id);
}

// ---------- Gestion des comptes (administrateur) ----------

export async function modifierCompte(
  id: string,
  champs: {
    nom: string;
    prenom: string;
    email: string;
    role: Role;
    annee_but: number | null;
    groupe: string | null;
    parcours: string | null;
    referent_id: string | null;
  },
) {
  const etudiant = champs.role === "etudiant";
  const pool = await obtenirPool();
  await pool.query(
    `UPDATE utilisateurs SET nom = ?, prenom = ?, email = ?, role = ?, annee_but = ?, groupe = ?, parcours = ?, referent_id = ? WHERE id = ?`,
    [
      champs.nom,
      champs.prenom,
      champs.email.trim().toLowerCase(),
      champs.role,
      etudiant ? champs.annee_but : null,
      champs.groupe || null,
      etudiant ? champs.parcours : null,
      etudiant ? champs.referent_id : null,
      id,
    ],
  );
}

// Désactiver un enseignant libère ses étudiants (sans référent) : renvoie leur nombre.
export async function changerActivation(id: string, actif: boolean): Promise<number> {
  const pool = await obtenirPool();
  await pool.query("UPDATE utilisateurs SET actif = ? WHERE id = ?", [actif ? 1 : 0, id]);
  if (actif) return 0;
  const [resultat] = await pool.query("UPDATE utilisateurs SET referent_id = NULL WHERE referent_id = ?", [id]);
  return (resultat as { affectedRows: number }).affectedRows;
}

export async function historiqueCompte(id: string) {
  const pool = await obtenirPool();
  const compte = async (sql: string, params: string[]) => {
    const [lignes] = await pool.query(sql, params);
    return (lignes as { n: number }[])[0].n;
  };
  return {
    argumentaires: await compte("SELECT COUNT(*) AS n FROM argumentaires WHERE etudiant_id = ?", [id]),
    traces: await compte("SELECT COUNT(*) AS n FROM traces WHERE etudiant_id = ?", [id]),
    evaluationsRecues: await compte("SELECT COUNT(*) AS n FROM evaluations WHERE etudiant_id = ?", [id]),
    evaluationsDonnees:
      (await compte("SELECT COUNT(*) AS n FROM evaluations WHERE enseignant_id = ? OR publiee_par = ?", [id, id])) +
      (await compte("SELECT COUNT(*) AS n FROM rendez_vous WHERE enseignant_id = ?", [id])),
    actionsJournal: await compte("SELECT COUNT(*) AS n FROM journal WHERE acteur_id = ?", [id]),
    etudiantsSuivis: await compte("SELECT COUNT(*) AS n FROM utilisateurs WHERE referent_id = ?", [id]),
  };
}

// Suppression définitive d'un étudiant et de tout son portfolio (fichiers compris).
export async function supprimerEtudiant(id: string) {
  const pool = await obtenirPool();
  const [lignesTraces] = await pool.query("SELECT id FROM traces WHERE etudiant_id = ?", [id]);
  const traces = lignesTraces as { id: string }[];
  const conn: PoolConnection = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const table of ["traces", "argumentaires", "evaluations", "rendez_vous", "presentations", "journal", "consultations"]) {
      await conn.query(`DELETE FROM ${table} WHERE etudiant_id = ?`, [id]);
    }
    await conn.query("DELETE FROM notifications WHERE destinataire_id = ?", [id]);
    // Notifications de son référent qui pointaient vers ce portfolio.
    await conn.query("DELETE FROM notifications WHERE lien LIKE CONCAT('/portfolio/', ?, '%')", [id]);
    await conn.query("DELETE FROM courriels WHERE destinataire_id = ?", [id]);
    await conn.query("DELETE FROM utilisateurs WHERE id = ? AND role = 'etudiant'", [id]);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  for (const t of traces) fs.rmSync(cheminFichier(t.id), { force: true });
}

// Un enseignant n'est supprimable que s'il n'a laissé aucune trace (évaluation, action) :
// sinon on le désactive, pour garder l'historique des évaluations.
export async function supprimerEnseignant(id: string): Promise<boolean> {
  const h = await historiqueCompte(id);
  if (h.evaluationsDonnees || h.actionsJournal) return false;
  const pool = await obtenirPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("UPDATE utilisateurs SET referent_id = NULL WHERE referent_id = ?", [id]);
    await conn.query("DELETE FROM consultations WHERE enseignant_id = ?", [id]);
    await conn.query("DELETE FROM notifications WHERE destinataire_id = ?", [id]);
    await conn.query("DELETE FROM courriels WHERE destinataire_id = ?", [id]);
    await conn.query("DELETE FROM utilisateurs WHERE id = ? AND role <> 'etudiant'", [id]);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  return true;
}

// Passage d'année / réaffectation groupés. Un champ absent reste inchangé.
export type ChangementsGroupes = {
  annee?: "suivante" | 1 | 2 | 3;
  parcours?: string;
  referent?: string | null;
  groupe?: string | null;
};

export async function appliquerChangementsGroupes(ids: string[], c: ChangementsGroupes) {
  const resultat = { modifies: 0, ignores: [] as string[], details: [] as { id: string; avant: number | null; apres: number | null }[] };
  const pool = await obtenirPool();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const id of ids) {
      const [lignes] = await conn.query("SELECT * FROM utilisateurs WHERE id = ?", [id]);
      const e = (lignes as Utilisateur[])[0];
      if (!e || e.role !== "etudiant") continue;
      let annee = e.annee_but;
      if (c.annee === "suivante") {
        if ((e.annee_but ?? 0) >= 3) {
          resultat.ignores.push(`${e.prenom} ${e.nom} (déjà en BUT3)`);
          continue;
        }
        annee = (e.annee_but ?? 0) + 1;
      } else if (c.annee) annee = c.annee;
      await conn.query("UPDATE utilisateurs SET annee_but = ?, parcours = ?, referent_id = ?, groupe = ? WHERE id = ?", [
        annee,
        c.parcours ?? e.parcours,
        c.referent !== undefined ? c.referent : e.referent_id,
        c.groupe !== undefined ? c.groupe : e.groupe,
        id,
      ]);
      resultat.modifies++;
      resultat.details.push({ id, avant: e.annee_but, apres: annee });
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
  return resultat;
}

export async function marquerConsulte(enseignantId: string, etudiantId: string) {
  const pool = await obtenirPool();
  await pool.query(
    `INSERT INTO consultations (enseignant_id, etudiant_id, vu_le) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE vu_le = VALUES(vu_le)`,
    [enseignantId, etudiantId, maintenant()],
  );
}

// ---------- Réglages ----------

const CLE_CG2P_ACTIF = "cg2p_actif";

// Le référentiel CG2P est configuré dans le code, mais masqué des listes de choix (import,
// ajout, modification de compte) tant que l'administrateur ne l'a pas activé ici.
export async function cg2pEstActif(): Promise<boolean> {
  const pool = await obtenirPool();
  const [lignes] = await pool.query("SELECT valeur FROM parametres WHERE cle = ?", [CLE_CG2P_ACTIF]);
  return (lignes as { valeur: string }[])[0]?.valeur === "1";
}

export async function definirCG2PActif(actif: boolean) {
  const pool = await obtenirPool();
  await pool.query(
    `INSERT INTO parametres (cle, valeur) VALUES (?, ?) ON DUPLICATE KEY UPDATE valeur = VALUES(valeur)`,
    [CLE_CG2P_ACTIF, actif ? "1" : "0"],
  );
}

const CLE_ENVOI_MAILS_ACTIF = "envoi_mails_actif";

// Coupe-circuit global : tant qu'il n'est pas activé par l'administrateur, aucun courriel n'est
// expédié (ils restent en file d'attente) et la préférence de chacun est verrouillée sur « Mon
// compte ». Désactivé par défaut : personne ne reçoit de courriel tant que l'envoi réel n'a pas
// été validé (SMTP de l'université branché, voir .env.example).
export async function envoiMailsActif(): Promise<boolean> {
  const pool = await obtenirPool();
  const [lignes] = await pool.query("SELECT valeur FROM parametres WHERE cle = ?", [CLE_ENVOI_MAILS_ACTIF]);
  return (lignes as { valeur: string }[])[0]?.valeur === "1";
}

export async function definirEnvoiMailsActif(actif: boolean) {
  const pool = await obtenirPool();
  await pool.query(
    `INSERT INTO parametres (cle, valeur) VALUES (?, ?) ON DUPLICATE KEY UPDATE valeur = VALUES(valeur)`,
    [CLE_ENVOI_MAILS_ACTIF, actif ? "1" : "0"],
  );
}

// ---------- Jeu de démonstration ----------

// Rendez-vous de suivi de démonstration (ajoutés une seule fois, base neuve ou existante).
// Étudiants de test des parcours GPRH et GC2F (ajoutés une seule fois, base neuve ou existante).
async function completerDemoParcours(pool: Pool) {
  const existe = async (sql: string) => {
    const [lignes] = await pool.query(sql);
    return (lignes as unknown[]).length > 0;
  };
  if (!(await existe("SELECT 1 FROM utilisateurs WHERE id = 'ens-bernard'"))) return;
  if (!(await existe("SELECT 1 FROM utilisateurs WHERE id = 'ens-lambert'"))) return;
  if (await existe("SELECT 1 FROM utilisateurs WHERE id = 'etu-benali'")) return;
  const ilYa = (j: number) => new Date(Date.now() - j * 86400000).toISOString();
  const insUtil = (id: string, nom: string, prenom: string, email: string, annee: number, groupe: string, parcours: string, referent: string) =>
    pool.query(
      `INSERT INTO utilisateurs (id, nom, prenom, email, role, annee_but, groupe, parcours, referent_id, pref_courriel)
       VALUES (?, ?, ?, ?, 'etudiant', ?, ?, ?, ?, 'immediat')`,
      [id, nom, prenom, email, annee, groupe, parcours, referent],
    );
  const arg = async (etu: string, annee: number, comp: string, texte: string, j: number) => {
    await pool.query("INSERT INTO argumentaires (etudiant_id, annee, competence, texte, maj_le) VALUES (?, ?, ?, ?, ?)", [
      etu,
      annee,
      comp,
      texte,
      ilYa(j),
    ]);
    await pool.query(
      "INSERT INTO journal (etudiant_id, acteur_id, annee, competence, type, detail, cree_le) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [etu, etu, annee, comp, "argumentaire_cree", `${texte.split(/\s+/).length} mots`, ilYa(j)],
    );
  };
  const trace = async (etu: string, annee: number, comp: string, titre: string, description: string, j: number) => {
    const id = randomUUID();
    const contenu = genererPdfDemo(titre, [`Trace déposée pour la compétence ${comp} (BUT${annee})`, description, "Document de démonstration généré automatiquement."]);
    fs.writeFileSync(cheminFichier(id), contenu);
    const nom = titre.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + ".pdf";
    await pool.query(
      `INSERT INTO traces (id, etudiant_id, annee, competence, titre, description, fichier_nom, taille, depose_le, maj_le)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, etu, annee, comp, titre, description, nom, contenu.length, ilYa(j), ilYa(j)],
    );
    await pool.query(
      "INSERT INTO journal (etudiant_id, acteur_id, annee, competence, type, detail, cree_le) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [etu, etu, annee, comp, "trace_ajoutee", titre, ilYa(j)],
    );
  };
  const insEval = (
    etu: string,
    annee: number,
    comp: string,
    niveau: string,
    note: number,
    commentaire: string,
    enseignant: string,
    maj: string,
    niveauPublie: string | null,
    notePubliee: number | null,
    commentairePublie: string | null,
    publieeLe: string | null,
    publieePar: string | null,
  ) =>
    pool.query(
      `INSERT INTO evaluations (etudiant_id, annee, competence, niveau, note, commentaire, enseignant_id, maj_le, niveau_publie, note_publiee, commentaire_publie, publiee_le, publiee_par)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [etu, annee, comp, niveau, note, commentaire, enseignant, maj, niveauPublie, notePubliee, commentairePublie, publieeLe, publieePar],
    );
  const insRdv = (
    etu: string,
    annee: number,
    numero: number,
    date: string,
    note: number,
    commentaire: string,
    enseignant: string,
    maj: string,
    notePubliee: number,
    commentairePublie: string,
    publieLe: string,
  ) =>
    pool.query(
      `INSERT INTO rendez_vous (etudiant_id, annee, numero, date_rdv, note, commentaire, enseignant_id, maj_le, note_publiee, commentaire_publie, publie_le)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [etu, annee, numero, date, note, commentaire, enseignant, maj, notePubliee, commentairePublie, publieLe],
    );

  // Parcours GPRH
  await insUtil("etu-benali", "Benali", "Sarah", "sarah.benali@etu.exemple.fr", 2, "TD3", "GPRH", "ens-bernard");
  await arg("etu-benali", 2, "C4", "Pendant mon stage au service RH d'une clinique, j'ai préparé les éléments variables de paie (heures supplémentaires, primes de nuit) et vérifié les bulletins avant validation. J'ai compris l'importance du contrôle croisé avec les plannings.", 6);
  await trace("etu-benali", 2, "C4", "Contrôle des éléments variables de paie", "Grille de contrôle et exemple de bulletin anonymisé (stage).", 6);
  await insEval("etu-benali", 2, "C4", "en_cours", 12, "Bonne rigueur ; expliciter davantage le cadre juridique mobilisé.", "ens-bernard", ilYa(3), "en_cours", 12, "Bonne rigueur ; expliciter davantage le cadre juridique mobilisé.", ilYa(3), "ens-bernard");
  await insRdv("etu-benali", 2, 1, ilYa(20).slice(0, 10), 13, "Bon démarrage ; penser à déposer des traces en C5.", "ens-bernard", ilYa(20), 13, "Bon démarrage ; penser à déposer des traces en C5.", ilYa(20));
  await insUtil("etu-laurent", "Laurent", "Maxime", "maxime.laurent@etu.exemple.fr", 3, "TD2", "GPRH", "ens-lambert");
  await arg("etu-laurent", 3, "C5", "En alternance, j'ai refondu le processus d'intégration des nouveaux arrivants : livret d'accueil, parcours de formation et questionnaire de satisfaction à trois mois.", 4);
  await trace("etu-laurent", 3, "C5", "Livret d'accueil des nouveaux arrivants", "Version finale diffusée par l'entreprise d'accueil.", 4);

  // Parcours GC2F
  await insUtil("etu-perrin", "Perrin", "Julie", "julie.perrin@etu.exemple.fr", 2, "TD3", "GC2F", "ens-bernard");
  await arg("etu-perrin", 2, "C4", "Lors de la SAÉ « Révision des comptes », j'ai contrôlé le cycle achats-fournisseurs d'une PME : rapprochement des factures, lettrage et justification des soldes. J'ai identifié deux anomalies de cut-off.", 5);
  await trace("etu-perrin", 2, "C4", "Dossier de révision du cycle fournisseurs", "Feuilles de travail et note de synthèse (SAÉ).", 5);
  await insUtil("etu-masson", "Masson", "Antoine", "antoine.masson@etu.exemple.fr", 3, "TD2", "GC2F", "ens-lambert");
  await arg("etu-masson", 3, "C5", "J'ai construit le budget de trésorerie sur douze mois de mon entreprise d'accueil et proposé un plan de financement pour l'achat d'un nouveau véhicule utilitaire.", 2);
  await trace("etu-masson", 3, "C5", "Budget de trésorerie et plan de financement", "Tableur commenté présenté au gérant.", 2);
  await insEval("etu-masson", 3, "C5", "acquis", 15, "Prévisions cohérentes et bien argumentées.", "ens-lambert", ilYa(1), null, null, null, null, null);
}

async function completerDemoRendezVous(pool: Pool) {
  const [lignesCompte] = await pool.query("SELECT COUNT(*) AS n FROM rendez_vous");
  if ((lignesCompte as { n: number }[])[0].n > 0) return;
  const [lignesFournier] = await pool.query("SELECT 1 FROM utilisateurs WHERE id = 'etu-fournier'");
  if ((lignesFournier as unknown[]).length === 0) return;
  const ilYa = (j: number) => new Date(Date.now() - j * 86400000).toISOString();
  const jour = (j: number) => ilYa(j).slice(0, 10);
  const ins = (etu: string, annee: number, numero: number, date: string, note: number, commentaire: string, enseignant: string, maj: string, notePubliee: number | null, commentairePublie: string | null, publieLe: string | null) =>
    pool.query(
      `INSERT INTO rendez_vous (etudiant_id, annee, numero, date_rdv, note, commentaire, enseignant_id, maj_le, note_publiee, commentaire_publie, publie_le)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [etu, annee, numero, date, note, commentaire, enseignant, maj, notePubliee, commentairePublie, publieLe],
    );
  // Manon (BUT3) : 1er rendez-vous publié, 2e en brouillon.
  await ins("etu-fournier", 3, 1, jour(30), 15, "Projet entrepreneurial bien engagé ; consolider les traces de C2.", "ens-lambert", ilYa(30), 15, "Projet entrepreneurial bien engagé ; consolider les traces de C2.", ilYa(30));
  await ins("etu-fournier", 3, 2, jour(2), 14, "Bonne progression, argumentaire C4 à finaliser.", "ens-lambert", ilYa(2), null, null, null);
  // Nathan (BUT2) : 1er rendez-vous publié.
  await ins("etu-garcia", 2, 1, jour(25), 12, "Démarche réflexive à approfondir dans les argumentaires.", "ens-bernard", ilYa(25), 12, "Démarche réflexive à approfondir dans les argumentaires.", ilYa(25));
}

// Référents, troisième enseignante et évaluations publiées : ajoutés aussi aux bases créées par la première version.
async function completerDemo(pool: Pool) {
  const [lignesBernard] = await pool.query("SELECT 1 FROM utilisateurs WHERE id = 'ens-bernard'");
  if ((lignesBernard as unknown[]).length === 0) return;
  const [lignesLambert] = await pool.query("SELECT 1 FROM utilisateurs WHERE id = 'ens-lambert'");
  if ((lignesLambert as unknown[]).length > 0) return;
  await pool.query("INSERT INTO utilisateurs (id, nom, prenom, email, role, pref_courriel) VALUES (?, ?, ?, ?, 'enseignant', 'aucun')", [
    "ens-lambert",
    "Lambert",
    "Sophie",
    "sophie.lambert@exemple.fr",
  ]);
  const referents: Record<string, string> = {
    "etu-dubois": "ens-bernard",
    "etu-moreau": "ens-bernard",
    "etu-garcia": "ens-bernard",
    "etu-roux": "ens-bernard",
    "etu-petit": "ens-bernard",
    "etu-lefevre": "ens-lambert",
    "etu-fournier": "ens-lambert",
    "etu-girard": "ens-lambert",
  };
  for (const [etu, ref] of Object.entries(referents)) {
    await pool.query("UPDATE utilisateurs SET referent_id = ? WHERE id = ? AND referent_id IS NULL", [ref, etu]);
  }
  // Les évaluations du jeu de démonstration sont déjà publiées.
  await pool.query(`UPDATE evaluations SET niveau_publie = niveau, note_publiee = note, commentaire_publie = commentaire,
             publiee_le = maj_le, publiee_par = enseignant_id
             WHERE publiee_le IS NULL AND (
               (etudiant_id = 'etu-fournier' AND annee = 1 AND competence = 'C1') OR
               (etudiant_id = 'etu-garcia' AND annee = 2 AND competence = 'C2'))`);
}

async function peuplerDemo(pool: Pool) {
  const utilisateurs: Omit<Utilisateur, "referent_id" | "parcours" | "actif" | "pref_courriel" | "identifiant_oidc">[] = [
    { id: "ens-martin", prenom: "Claire", nom: "Martin", email: "claire.martin@exemple.fr", role: "admin", annee_but: null, groupe: null },
    { id: "ens-bernard", prenom: "Thomas", nom: "Bernard", email: "thomas.bernard@exemple.fr", role: "enseignant", annee_but: null, groupe: null },
    { id: "etu-dubois", prenom: "Léa", nom: "Dubois", email: "lea.dubois@etu.exemple.fr", role: "etudiant", annee_but: 1, groupe: "TD1" },
    { id: "etu-moreau", prenom: "Hugo", nom: "Moreau", email: "hugo.moreau@etu.exemple.fr", role: "etudiant", annee_but: 1, groupe: "TD1" },
    { id: "etu-lefevre", prenom: "Inès", nom: "Lefèvre", email: "ines.lefevre@etu.exemple.fr", role: "etudiant", annee_but: 1, groupe: "TD2" },
    { id: "etu-garcia", prenom: "Nathan", nom: "Garcia", email: "nathan.garcia@etu.exemple.fr", role: "etudiant", annee_but: 2, groupe: "TD1" },
    { id: "etu-roux", prenom: "Chloé", nom: "Roux", email: "chloe.roux@etu.exemple.fr", role: "etudiant", annee_but: 2, groupe: "TD1" },
    { id: "etu-petit", prenom: "Yanis", nom: "Petit", email: "yanis.petit@etu.exemple.fr", role: "etudiant", annee_but: 2, groupe: "TD2" },
    { id: "etu-fournier", prenom: "Manon", nom: "Fournier", email: "manon.fournier@etu.exemple.fr", role: "etudiant", annee_but: 3, groupe: "TD1" },
    { id: "etu-girard", prenom: "Lucas", nom: "Girard", email: "lucas.girard@etu.exemple.fr", role: "etudiant", annee_but: 3, groupe: "TD1" },
  ];
  for (const u of utilisateurs) {
    await pool.query("INSERT INTO utilisateurs (id, nom, prenom, email, role, annee_but, groupe, pref_courriel) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
      u.id,
      u.nom,
      u.prenom,
      u.email,
      u.role,
      u.annee_but,
      u.groupe,
      u.role === "etudiant" ? "immediat" : "aucun",
    ]);
  }

  const ilYa = (jours: number, heures = 0) => new Date(Date.now() - jours * 86400000 - heures * 3600000).toISOString();

  const trace = async (etu: string, annee: number, comp: string, titre: string, description: string, jours: number) => {
    const id = randomUUID();
    const contenu = genererPdfDemo(titre, [
      `Trace déposée pour la compétence ${comp} (BUT${annee})`,
      description,
      "Document de démonstration généré automatiquement.",
    ]);
    fs.writeFileSync(cheminFichier(id), contenu);
    const nomFichier = titre.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + ".pdf";
    await pool.query(
      `INSERT INTO traces (id, etudiant_id, annee, competence, titre, description, fichier_nom, taille, depose_le, maj_le)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, etu, annee, comp, titre, description, nomFichier, contenu.length, ilYa(jours), ilYa(jours)],
    );
    await pool.query(
      "INSERT INTO journal (etudiant_id, acteur_id, annee, competence, type, detail, cree_le) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [etu, etu, annee, comp, "trace_ajoutee", titre, ilYa(jours)],
    );
  };

  const arg = async (etu: string, annee: number, comp: string, texte: string, jours: number) => {
    await pool.query("INSERT INTO argumentaires (etudiant_id, annee, competence, texte, maj_le) VALUES (?, ?, ?, ?, ?)", [
      etu,
      annee,
      comp,
      texte,
      ilYa(jours),
    ]);
    await pool.query(
      "INSERT INTO journal (etudiant_id, acteur_id, annee, competence, type, detail, cree_le) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [etu, etu, annee, comp, "argumentaire_cree", `${texte.split(/\s+/).length} mots`, ilYa(jours)],
    );
  };

  // Manon (BUT3) : a commencé son portfolio en BUT1 et l'a complété chaque année.
  await pool.query("INSERT INTO presentations (etudiant_id, texte, projet_pro, maj_le) VALUES (?, ?, ?, ?)", [
    "etu-fournier",
    "Étudiante en BUT GEA parcours GEMA, j'ai effectué mon alternance dans une PME de distribution de matériel agricole. Je m'intéresse particulièrement à la création d'entreprise et au pilotage de projets.",
    "Reprendre ou créer une entreprise dans le secteur agroalimentaire après une licence professionnelle ou un master entrepreneuriat.",
    ilYa(40),
  ]);
  await arg("etu-fournier", 1, "C1", "Lors de la SAÉ « Diagnostic d'une organisation », j'ai analysé une boulangerie artisanale de mon quartier. J'ai identifié ses enjeux économiques (concurrence des grandes surfaces) et juridiques (statut d'EURL). J'ai d'abord eu du mal à distinguer les parties prenantes internes et externes ; la cartographie réalisée en groupe m'a permis de clarifier les relations entre les acteurs du processus d'approvisionnement.", 400);
  await trace("etu-fournier", 1, "C1", "Diagnostic de la boulangerie Martin", "Rapport de SAÉ : cartographie des parties prenantes et analyse PESTEL.", 400);
  await pool.query(
    `INSERT INTO evaluations (etudiant_id, annee, competence, niveau, note, commentaire, enseignant_id, maj_le)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ["etu-fournier", 1, "C1", "acquis", 14, "Analyse claire et bien documentée. La cartographie des acteurs est pertinente.", "ens-martin", ilYa(380)],
  );
  await arg("etu-fournier", 3, "C4", "Dans le cadre de mon alternance, j'ai participé à l'étude de faisabilité d'une nouvelle gamme de services de maintenance. J'ai testé la viabilité financière du business model en construisant un plan de trésorerie sur trois ans et en simulant deux scénarios de prix. La présentation au directeur financier m'a obligée à argumenter mes hypothèses.", 3);
  await trace("etu-fournier", 3, "C4", "Business plan – offre de maintenance", "Plan de financement et prévisionnel de trésorerie présentés à la direction.", 3);
  await trace("etu-fournier", 3, "C4", "Support de présentation à la direction", "Diaporama de soutenance du projet (10 diapositives).", 2);
  await arg("etu-fournier", 3, "C1", "J'ai proposé une réorganisation du processus de gestion des commandes après avoir mesuré les délais de traitement sur deux mois.", 1);

  // Lucas (BUT3) : arrive en BUT3, portfolio à compléter.
  await arg("etu-girard", 3, "C2", "J'ai construit un tableau de bord sous Excel pour suivre les stocks de l'entreprise d'accueil.", 6);

  // Nathan (BUT2)
  await pool.query("INSERT INTO presentations (etudiant_id, texte, projet_pro, maj_le) VALUES (?, ?, ?, ?)", [
    "etu-garcia",
    "Étudiant en BUT2 GEA, passionné de sport et trésorier du BDE.",
    "Contrôle de gestion dans le secteur du sport.",
    ilYa(20),
  ]);
  await pool.query("INSERT INTO journal (etudiant_id, acteur_id, annee, competence, type, detail, cree_le) VALUES (?, ?, ?, ?, ?, ?, ?)", [
    "etu-garcia",
    "etu-garcia",
    null,
    null,
    "presentation_maj",
    "",
    ilYa(20),
  ]);
  await arg("etu-garcia", 2, "C2", "Au cours de la SAÉ ERP, j'ai paramétré un cycle achats-ventes sur Odoo. J'ai traité les données de ventes pour identifier les produits les moins rentables et j'ai présenté mes conclusions sous forme de graphiques.", 10);
  await trace("etu-garcia", 2, "C2", "Rapport SAÉ ERP Odoo", "Captures du paramétrage et analyse des ventes.", 10);
  await pool.query(
    `INSERT INTO evaluations (etudiant_id, annee, competence, niveau, note, commentaire, enseignant_id, maj_le)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ["etu-garcia", 2, "C2", "en_cours", 10.5, "Bonne maîtrise de l'outil. L'argumentaire doit davantage expliciter les risques évalués.", "ens-bernard", ilYa(8)],
  );
  await pool.query("INSERT INTO journal (etudiant_id, acteur_id, annee, competence, type, detail, cree_le) VALUES (?, ?, ?, ?, ?, ?, ?)", [
    "etu-garcia",
    "ens-bernard",
    2,
    "C2",
    "evaluation",
    "En cours d'acquisition",
    ilYa(8),
  ]);
  await arg("etu-garcia", 2, "C3", "En tant que trésorier du BDE, j'ai coordonné l'organisation du gala avec quatre associations.", 1);
  await trace("etu-garcia", 2, "C3", "Rétroplanning du gala", "Diagramme de Gantt partagé avec les associations.", 0.2);

  // Chloé (BUT2) : complète aussi son historique de BUT1.
  await arg("etu-roux", 1, "C3", "En BUT1, j'ai animé l'équipe projet du Projet Personnel et Professionnel : répartition des tâches, comptes rendus de réunion.", 5);
  await trace("etu-roux", 1, "C3", "Comptes rendus de réunion PPP", "Trois comptes rendus rédigés et diffusés à l'équipe.", 5);
  await arg("etu-roux", 2, "C4", "J'ai modélisé le business model d'une start-up locale avec le Business Model Canvas.", 2);

  // Léa (BUT1)
  await arg("etu-dubois", 1, "C1", "J'ai étudié le fonctionnement d'une mairie pour comprendre la différence entre une organisation publique et une entreprise privée.", 4);
  await trace("etu-dubois", 1, "C1", "Fiche d'identité de la mairie", "Organigramme et missions des services.", 4);

  // Le jeu de démonstration considère que Thomas Bernard a consulté Nathan il y a 3 jours.
  await pool.query("INSERT INTO consultations (enseignant_id, etudiant_id, vu_le) VALUES (?, ?, ?)", ["ens-bernard", "etu-garcia", ilYa(3)]);
}
