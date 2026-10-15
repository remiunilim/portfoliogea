import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { genererPdfDemo } from "./pdf-demo";

// Stockage local de la V1 : une base SQLite et un dossier de PDF.
// À remplacer par le serveur de la DSI (PostgreSQL + stockage objet) lors du déploiement.
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

const globalPourDb = globalThis as unknown as { __dbPortfolio?: DatabaseSync; __dbSchema?: number };

// À incrémenter à chaque évolution du schéma. En développement, la connexion survit aux
// rechargements du code : ce numéro force la (re)création des tables et les migrations.
const VERSION_SCHEMA = 7;

export function db(): DatabaseSync {
  if (globalPourDb.__dbPortfolio && globalPourDb.__dbSchema !== VERSION_SCHEMA) {
    creerSchema(globalPourDb.__dbPortfolio);
    migrer(globalPourDb.__dbPortfolio);
    globalPourDb.__dbSchema = VERSION_SCHEMA;
  }
  if (!globalPourDb.__dbPortfolio) {
    fs.mkdirSync(DOSSIER_FICHIERS, { recursive: true });
    const base = new DatabaseSync(path.join(DOSSIER_DONNEES, "portfolio.db"));
    base.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
    creerSchema(base);
    migrer(base);
    const { n } = base.prepare("SELECT COUNT(*) AS n FROM utilisateurs").get() as { n: number };
    if (n === 0) peuplerDemo(base);
    completerDemo(base);
    completerDemoRendezVous(base);
    completerDemoParcours(base);
    // Étudiants créés avant l'ajout du parcours : seul le référentiel GEMA est configuré.
    base.exec("UPDATE utilisateurs SET parcours = 'GEMA' WHERE role = 'etudiant' AND parcours IS NULL");
    globalPourDb.__dbPortfolio = base;
    globalPourDb.__dbSchema = VERSION_SCHEMA;
  }
  return globalPourDb.__dbPortfolio;
}

function creerSchema(base: DatabaseSync) {
  base.exec(`
    CREATE TABLE IF NOT EXISTS utilisateurs (
      id TEXT PRIMARY KEY,
      nom TEXT NOT NULL,
      prenom TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL CHECK (role IN ('etudiant','enseignant','admin')),
      annee_but INTEGER,
      groupe TEXT
    );
    CREATE TABLE IF NOT EXISTS presentations (
      etudiant_id TEXT PRIMARY KEY REFERENCES utilisateurs(id),
      texte TEXT NOT NULL DEFAULT '',
      projet_pro TEXT NOT NULL DEFAULT '',
      maj_le TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS argumentaires (
      etudiant_id TEXT NOT NULL REFERENCES utilisateurs(id),
      annee INTEGER NOT NULL,
      competence TEXT NOT NULL,
      texte TEXT NOT NULL DEFAULT '',
      maj_le TEXT NOT NULL,
      PRIMARY KEY (etudiant_id, annee, competence)
    );
    CREATE TABLE IF NOT EXISTS traces (
      id TEXT PRIMARY KEY,
      etudiant_id TEXT NOT NULL REFERENCES utilisateurs(id),
      annee INTEGER NOT NULL,
      competence TEXT NOT NULL,
      titre TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      fichier_nom TEXT NOT NULL,
      taille INTEGER NOT NULL,
      depose_le TEXT NOT NULL,
      maj_le TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS evaluations (
      etudiant_id TEXT NOT NULL REFERENCES utilisateurs(id),
      annee INTEGER NOT NULL,
      competence TEXT NOT NULL,
      niveau TEXT NOT NULL,
      commentaire TEXT NOT NULL DEFAULT '',
      enseignant_id TEXT NOT NULL REFERENCES utilisateurs(id),
      maj_le TEXT NOT NULL,
      PRIMARY KEY (etudiant_id, annee, competence)
    );
    CREATE TABLE IF NOT EXISTS journal (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      etudiant_id TEXT NOT NULL REFERENCES utilisateurs(id),
      acteur_id TEXT NOT NULL REFERENCES utilisateurs(id),
      annee INTEGER,
      competence TEXT,
      type TEXT NOT NULL,
      detail TEXT NOT NULL DEFAULT '',
      cree_le TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS journal_etudiant ON journal(etudiant_id, cree_le);
    CREATE TABLE IF NOT EXISTS consultations (
      enseignant_id TEXT NOT NULL REFERENCES utilisateurs(id),
      etudiant_id TEXT NOT NULL REFERENCES utilisateurs(id),
      vu_le TEXT NOT NULL,
      PRIMARY KEY (enseignant_id, etudiant_id)
    );
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      destinataire_id TEXT NOT NULL REFERENCES utilisateurs(id),
      titre TEXT NOT NULL,
      detail TEXT NOT NULL DEFAULT '',
      lien TEXT NOT NULL DEFAULT '',
      lue INTEGER NOT NULL DEFAULT 0,
      cree_le TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS notifications_destinataire ON notifications(destinataire_id, lue);
    -- Deux rendez-vous de suivi par étudiant et par année (note sur 20 + compte rendu),
    -- avec un brouillon et une version publiée, comme les évaluations.
    CREATE TABLE IF NOT EXISTS rendez_vous (
      etudiant_id TEXT NOT NULL REFERENCES utilisateurs(id),
      annee INTEGER NOT NULL,
      numero INTEGER NOT NULL CHECK (numero IN (1, 2)),
      date_rdv TEXT,
      note REAL,
      commentaire TEXT NOT NULL DEFAULT '',
      enseignant_id TEXT NOT NULL REFERENCES utilisateurs(id),
      maj_le TEXT NOT NULL,
      note_publiee REAL,
      commentaire_publie TEXT,
      publie_le TEXT,
      PRIMARY KEY (etudiant_id, annee, numero)
    );
    -- File d'attente des courriels : alimentée selon la préférence de chacun,
    -- elle sera vidée par l'envoi SMTP de l'université une fois branché.
    CREATE TABLE IF NOT EXISTS courriels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      destinataire_id TEXT NOT NULL REFERENCES utilisateurs(id),
      adresse TEXT NOT NULL,
      sujet TEXT NOT NULL,
      corps TEXT NOT NULL,
      mode TEXT NOT NULL CHECK (mode IN ('immediat','quotidien')),
      statut TEXT NOT NULL DEFAULT 'en_attente',
      cree_le TEXT NOT NULL
    );
  `);
}

// Ajoute les colonnes apparues après la première version, sans perdre les données existantes.
function migrer(base: DatabaseSync) {
  const colonnes = (table: string) =>
    new Set((base.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name));
  const utilisateurs = colonnes("utilisateurs");
  if (!utilisateurs.has("referent_id")) {
    base.exec("ALTER TABLE utilisateurs ADD COLUMN referent_id TEXT REFERENCES utilisateurs(id)");
  }
  if (!utilisateurs.has("actif")) {
    base.exec("ALTER TABLE utilisateurs ADD COLUMN actif INTEGER NOT NULL DEFAULT 1");
  }
  if (!utilisateurs.has("pref_courriel")) {
    // Étudiants : courriel à chaque évaluation publiée ; enseignants : à activer eux-mêmes.
    base.exec("ALTER TABLE utilisateurs ADD COLUMN pref_courriel TEXT NOT NULL DEFAULT 'immediat'");
    base.exec("UPDATE utilisateurs SET pref_courriel = 'aucun' WHERE role IN ('enseignant','admin')");
  }
  if (!utilisateurs.has("parcours")) {
    base.exec("ALTER TABLE utilisateurs ADD COLUMN parcours TEXT");
  }
  const evaluations = colonnes("evaluations");
  for (const col of ["niveau_publie", "commentaire_publie", "publiee_le", "publiee_par"]) {
    if (!evaluations.has(col)) base.exec(`ALTER TABLE evaluations ADD COLUMN ${col} TEXT`);
  }
  if (!evaluations.has("note")) {
    base.exec("ALTER TABLE evaluations ADD COLUMN note REAL");
    base.exec("ALTER TABLE evaluations ADD COLUMN note_publiee REAL");
    // Jeu de démonstration : notes des évaluations déjà publiées.
    base.exec(`UPDATE evaluations SET note = 14, note_publiee = CASE WHEN publiee_le IS NOT NULL THEN 14 END
               WHERE etudiant_id = 'etu-fournier' AND annee = 1 AND competence = 'C1'`);
    base.exec(`UPDATE evaluations SET note = 10.5, note_publiee = CASE WHEN publiee_le IS NOT NULL THEN 10.5 END
               WHERE etudiant_id = 'etu-garcia' AND annee = 2 AND competence = 'C2'`);
  }
}

const maintenant = () => new Date().toISOString();

export function cheminFichier(traceId: string) {
  return path.join(DOSSIER_FICHIERS, `${traceId}.pdf`);
}

// ---------- Lecture ----------

export function getUtilisateur(id: string): Utilisateur | undefined {
  return db().prepare("SELECT * FROM utilisateurs WHERE id = ?").get(id) as Utilisateur | undefined;
}

export function listerUtilisateurs(): Utilisateur[] {
  return db()
    .prepare("SELECT * FROM utilisateurs WHERE actif = 1 ORDER BY role DESC, annee_but, nom")
    .all() as Utilisateur[];
}

export function listerComptesDesactives(): Utilisateur[] {
  return db().prepare("SELECT * FROM utilisateurs WHERE actif = 0 ORDER BY role DESC, nom, prenom").all() as Utilisateur[];
}

export function listerEtudiants(
  filtre: { anneeBut?: number; referentId?: string; inclureDesactives?: boolean } = {},
): Utilisateur[] {
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
  return db()
    .prepare(`SELECT * FROM utilisateurs WHERE ${conditions.join(" AND ")} ORDER BY annee_but, nom, prenom`)
    .all(...params) as Utilisateur[];
}

export function listerEnseignants(): Utilisateur[] {
  return db()
    .prepare("SELECT * FROM utilisateurs WHERE role IN ('enseignant','admin') AND actif = 1 ORDER BY nom, prenom")
    .all() as Utilisateur[];
}

export function definirReferent(etudiantId: string, referentId: string | null) {
  db()
    .prepare("UPDATE utilisateurs SET referent_id = ? WHERE id = ? AND role = 'etudiant'")
    .run(referentId, etudiantId);
}

export function getPresentation(etudiantId: string) {
  return db().prepare("SELECT * FROM presentations WHERE etudiant_id = ?").get(etudiantId) as
    | { etudiant_id: string; texte: string; projet_pro: string; maj_le: string }
    | undefined;
}

export function getArgumentaires(etudiantId: string): Argumentaire[] {
  return db().prepare("SELECT * FROM argumentaires WHERE etudiant_id = ?").all(etudiantId) as Argumentaire[];
}

export function getTraces(etudiantId: string): Trace[] {
  return db()
    .prepare("SELECT * FROM traces WHERE etudiant_id = ? ORDER BY depose_le")
    .all(etudiantId) as Trace[];
}

export function getTrace(id: string): Trace | undefined {
  return db().prepare("SELECT * FROM traces WHERE id = ?").get(id) as Trace | undefined;
}

export function getEvaluations(etudiantId: string): Evaluation[] {
  return db().prepare("SELECT * FROM evaluations WHERE etudiant_id = ?").all(etudiantId) as Evaluation[];
}

export function getJournal(
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
  return db()
    .prepare(
      `SELECT j.*, e.prenom || ' ' || e.nom AS etudiant_nom, a.prenom || ' ' || a.nom AS acteur_nom, a.role AS acteur_role
       FROM journal j
       JOIN utilisateurs e ON e.id = j.etudiant_id
       JOIN utilisateurs a ON a.id = j.acteur_id
       ${where}
       ORDER BY j.cree_le DESC, j.id DESC LIMIT ?`,
    )
    .all(...params) as (EntreeJournal & { etudiant_nom: string; acteur_nom: string; acteur_role: Role })[];
}

export function getDerniereConsultation(enseignantId: string, etudiantId: string): string | null {
  const ligne = db()
    .prepare("SELECT vu_le FROM consultations WHERE enseignant_id = ? AND etudiant_id = ?")
    .get(enseignantId, etudiantId) as { vu_le: string } | undefined;
  return ligne?.vu_le ?? null;
}

// Dernière modification faite par l'étudiant, par cellule (année × compétence).
export function getDernieresModifsEtudiant(etudiantId: string): Map<string, string> {
  const lignes = db()
    .prepare(
      `SELECT annee, competence, MAX(cree_le) AS derniere FROM journal
       WHERE etudiant_id = ? AND acteur_id = ? AND competence IS NOT NULL
       GROUP BY annee, competence`,
    )
    .all(etudiantId, etudiantId) as { annee: number; competence: string; derniere: string }[];
  return new Map(lignes.map((l) => [`${l.annee}-${l.competence}`, l.derniere]));
}

// ---------- Écriture ----------

export function journaliser(e: Omit<EntreeJournal, "id" | "cree_le">) {
  db()
    .prepare(
      "INSERT INTO journal (etudiant_id, acteur_id, annee, competence, type, detail, cree_le) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .run(e.etudiant_id, e.acteur_id, e.annee, e.competence, e.type, e.detail, maintenant());
}

export function enregistrerPresentation(etudiantId: string, texte: string, projetPro: string) {
  db()
    .prepare(
      `INSERT INTO presentations (etudiant_id, texte, projet_pro, maj_le) VALUES (?, ?, ?, ?)
       ON CONFLICT(etudiant_id) DO UPDATE SET texte = excluded.texte, projet_pro = excluded.projet_pro, maj_le = excluded.maj_le`,
    )
    .run(etudiantId, texte, projetPro, maintenant());
}

export function enregistrerArgumentaire(etudiantId: string, annee: number, competence: string, texte: string) {
  db()
    .prepare(
      `INSERT INTO argumentaires (etudiant_id, annee, competence, texte, maj_le) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(etudiant_id, annee, competence) DO UPDATE SET texte = excluded.texte, maj_le = excluded.maj_le`,
    )
    .run(etudiantId, annee, competence, texte, maintenant());
}

export function ajouterTrace(t: Omit<Trace, "id" | "depose_le" | "maj_le">, contenu: Buffer): string {
  const id = randomUUID();
  fs.writeFileSync(cheminFichier(id), contenu);
  const date = maintenant();
  db()
    .prepare(
      `INSERT INTO traces (id, etudiant_id, annee, competence, titre, description, fichier_nom, taille, depose_le, maj_le)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, t.etudiant_id, t.annee, t.competence, t.titre, t.description, t.fichier_nom, t.taille, date, date);
  return id;
}

export function modifierTrace(
  id: string,
  champs: { titre: string; description: string },
  fichier?: { nom: string; contenu: Buffer },
) {
  if (fichier) {
    fs.writeFileSync(cheminFichier(id), fichier.contenu);
    db()
      .prepare("UPDATE traces SET fichier_nom = ?, taille = ? WHERE id = ?")
      .run(fichier.nom, fichier.contenu.length, id);
  }
  db()
    .prepare("UPDATE traces SET titre = ?, description = ?, maj_le = ? WHERE id = ?")
    .run(champs.titre, champs.description, maintenant(), id);
}

export function supprimerTrace(id: string) {
  db().prepare("DELETE FROM traces WHERE id = ?").run(id);
  fs.rmSync(cheminFichier(id), { force: true });
}

export function enregistrerEvaluation(
  e: Pick<Evaluation, "etudiant_id" | "annee" | "competence" | "niveau" | "note" | "commentaire" | "enseignant_id">,
) {
  db()
    .prepare(
      `INSERT INTO evaluations (etudiant_id, annee, competence, niveau, note, commentaire, enseignant_id, maj_le)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(etudiant_id, annee, competence) DO UPDATE SET
         niveau = excluded.niveau, note = excluded.note, commentaire = excluded.commentaire,
         enseignant_id = excluded.enseignant_id, maj_le = excluded.maj_le`,
    )
    .run(e.etudiant_id, e.annee, e.competence, e.niveau, e.note, e.commentaire, e.enseignant_id, maintenant());
}

// Évaluations en brouillon qui ne peuvent pas être publiées faute de note.
export function evaluationsSansNote(etudiantId: string, annee: number): string[] {
  return (
    db()
      .prepare("SELECT competence FROM evaluations WHERE etudiant_id = ? AND annee = ? AND niveau <> 'non_evalue' AND note IS NULL")
      .all(etudiantId, annee) as { competence: string }[]
  ).map((r) => r.competence);
}

// Publie le brouillon (niveau, note, commentaire) : l'étudiant le voit désormais.
// Une évaluation sans note n'est pas publiable. Renvoie les évaluations publiées (vide si rien à publier).
export function publierEvaluations(
  cible: { etudiantId: string; annee: number; competence?: string },
  publieePar: string,
): { competence: string; niveau: string; note: number }[] {
  const conditions = ["etudiant_id = ?", "annee = ?"];
  const params: (string | number)[] = [cible.etudiantId, cible.annee];
  if (cible.competence) {
    conditions.push("competence = ?");
    params.push(cible.competence);
  }
  return db()
    .prepare(
      `UPDATE evaluations SET niveau_publie = niveau, note_publiee = note, commentaire_publie = commentaire, publiee_le = ?, publiee_par = ?
       WHERE ${conditions.join(" AND ")}
         AND niveau <> 'non_evalue' AND note IS NOT NULL
         AND (niveau_publie IS NOT niveau OR note_publiee IS NOT note OR commentaire_publie IS NOT commentaire)
       RETURNING competence, niveau, note`,
    )
    .all(maintenant(), publieePar, ...params) as { competence: string; niveau: string; note: number }[];
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

export function getRendezVous(etudiantId: string): RendezVous[] {
  return db().prepare("SELECT * FROM rendez_vous WHERE etudiant_id = ? ORDER BY annee, numero").all(etudiantId) as RendezVous[];
}

export function enregistrerRendezVous(r: Pick<RendezVous, "etudiant_id" | "annee" | "numero" | "date_rdv" | "note" | "commentaire" | "enseignant_id">) {
  db()
    .prepare(
      `INSERT INTO rendez_vous (etudiant_id, annee, numero, date_rdv, note, commentaire, enseignant_id, maj_le)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(etudiant_id, annee, numero) DO UPDATE SET
         date_rdv = excluded.date_rdv, note = excluded.note, commentaire = excluded.commentaire,
         enseignant_id = excluded.enseignant_id, maj_le = excluded.maj_le`,
    )
    .run(r.etudiant_id, r.annee, r.numero, r.date_rdv, r.note, r.commentaire, r.enseignant_id, maintenant());
}

// Publie la note et le compte rendu du (ou des) rendez-vous ; renvoie ceux publiés.
export function publierRendezVous(cible: { etudiantId: string; annee: number; numero?: number }): { numero: number; note: number }[] {
  const conditions = ["etudiant_id = ?", "annee = ?"];
  const params: (string | number)[] = [cible.etudiantId, cible.annee];
  if (cible.numero) {
    conditions.push("numero = ?");
    params.push(cible.numero);
  }
  return db()
    .prepare(
      `UPDATE rendez_vous SET note_publiee = note, commentaire_publie = commentaire, publie_le = ?
       WHERE ${conditions.join(" AND ")} AND note IS NOT NULL
         AND (note_publiee IS NOT note OR commentaire_publie IS NOT commentaire)
       RETURNING numero, note`,
    )
    .all(maintenant(), ...params) as { numero: number; note: number }[];
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
export function notifier(n: Pick<Notification, "destinataire_id" | "titre" | "detail" | "lien">) {
  db()
    .prepare("INSERT INTO notifications (destinataire_id, titre, detail, lien, cree_le) VALUES (?, ?, ?, ?, ?)")
    .run(n.destinataire_id, n.titre, n.detail, n.lien, maintenant());
  mettreEnFileCourriel(n);
}

function mettreEnFileCourriel(n: Pick<Notification, "destinataire_id" | "titre" | "detail" | "lien">) {
  const d = getUtilisateur(n.destinataire_id);
  if (!d || !d.actif || d.pref_courriel === "aucun" || d.email.endsWith(".a-renseigner")) return;
  db()
    .prepare("INSERT INTO courriels (destinataire_id, adresse, sujet, corps, mode, cree_le) VALUES (?, ?, ?, ?, ?, ?)")
    .run(d.id, d.email, `[Folio GEA] ${n.titre}`, `${n.detail}\n\nVoir dans Folio GEA : ${n.lien}`, d.pref_courriel, maintenant());
}

// Notification du référent après un dépôt de l'étudiant. Tant que la précédente n'est pas lue,
// on la met à jour au lieu d'en créer une nouvelle : pas d'avalanche pendant que l'étudiant travaille.
export function notifierReferent(etudiant: Utilisateur, titre: string, detail: string, lien: string) {
  if (!etudiant.referent_id) return;
  const enCours = db()
    .prepare("SELECT id, detail FROM notifications WHERE destinataire_id = ? AND lien = ? AND lue = 0")
    .get(etudiant.referent_id, lien) as { id: number; detail: string } | undefined;
  if (enCours) {
    const nb = Number(enCours.detail.match(/^(\d+) modifications/)?.[1] ?? 1) + 1;
    db()
      .prepare("UPDATE notifications SET titre = ?, detail = ?, cree_le = ? WHERE id = ?")
      .run(titre, `${nb} modifications depuis votre dernière lecture · dernière : ${detail}`, maintenant(), enCours.id);
    return;
  }
  notifier({ destinataire_id: etudiant.referent_id, titre, detail, lien });
}

export function compterCourrielsEnAttente(): { immediat: number; quotidien: number } {
  const lignes = db()
    .prepare("SELECT mode, COUNT(*) AS n FROM courriels WHERE statut = 'en_attente' GROUP BY mode")
    .all() as { mode: "immediat" | "quotidien"; n: number }[];
  return { immediat: lignes.find((l) => l.mode === "immediat")?.n ?? 0, quotidien: lignes.find((l) => l.mode === "quotidien")?.n ?? 0 };
}

export function definirPreferenceCourriel(id: string, pref: PreferenceCourriel) {
  db().prepare("UPDATE utilisateurs SET pref_courriel = ? WHERE id = ?").run(pref, id);
}

export function getNotifications(destinataireId: string, limite = 50): Notification[] {
  return db()
    .prepare("SELECT * FROM notifications WHERE destinataire_id = ? ORDER BY cree_le DESC, id DESC LIMIT ?")
    .all(destinataireId, limite) as Notification[];
}

export function compterNotificationsNonLues(destinataireId: string): number {
  const { n } = db()
    .prepare("SELECT COUNT(*) AS n FROM notifications WHERE destinataire_id = ? AND lue = 0")
    .get(destinataireId) as { n: number };
  return n;
}

export function marquerNotificationsLues(destinataireId: string) {
  db().prepare("UPDATE notifications SET lue = 1 WHERE destinataire_id = ? AND lue = 0").run(destinataireId);
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
function emailProvisoire(prenom: string, nom: string, role: Role) {
  const base = `${prenom}.${nom}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9.]+/g, "-");
  const domaine = role === "etudiant" ? "etu.a-renseigner" : "a-renseigner";
  let email = `${base}@${domaine}`;
  for (let i = 2; db().prepare("SELECT 1 FROM utilisateurs WHERE email = ?").get(email); i++) email = `${base}${i}@${domaine}`;
  return email;
}

export function emailExiste(email: string): boolean {
  return !!db().prepare("SELECT 1 FROM utilisateurs WHERE lower(email) = lower(?)").get(email);
}

export function creerUtilisateur(u: NouvelUtilisateur): string {
  const id = `${u.role === "etudiant" ? "etu" : "ens"}-${randomUUID().slice(0, 8)}`;
  db()
    .prepare(
      `INSERT INTO utilisateurs (id, nom, prenom, email, role, annee_but, groupe, parcours, referent_id, pref_courriel)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      u.nom,
      u.prenom,
      u.email?.trim().toLowerCase() || emailProvisoire(u.prenom, u.nom, u.role),
      u.role,
      u.role === "etudiant" ? (u.annee_but ?? 1) : null,
      u.groupe || null,
      u.role === "etudiant" ? (u.parcours ?? "GEMA") : null,
      u.role === "etudiant" ? (u.referent_id ?? null) : null,
      u.role === "etudiant" ? "immediat" : "aucun",
    );
  return id;
}

export function modifierEmail(id: string, email: string) {
  db().prepare("UPDATE utilisateurs SET email = ? WHERE id = ?").run(email.trim().toLowerCase(), id);
}

export function mettreAJourEtudiant(id: string, champs: { annee_but: number; parcours: string; referent_id?: string | null }) {
  db().prepare("UPDATE utilisateurs SET annee_but = ?, parcours = ? WHERE id = ? AND role = 'etudiant'").run(champs.annee_but, champs.parcours, id);
  if (champs.referent_id !== undefined) definirReferent(id, champs.referent_id);
}

// ---------- Gestion des comptes (administrateur) ----------

export function modifierCompte(
  id: string,
  champs: { nom: string; prenom: string; email: string; role: Role; annee_but: number | null; groupe: string | null; parcours: string | null; referent_id: string | null },
) {
  const etudiant = champs.role === "etudiant";
  db()
    .prepare(
      `UPDATE utilisateurs SET nom = ?, prenom = ?, email = ?, role = ?, annee_but = ?, groupe = ?, parcours = ?, referent_id = ? WHERE id = ?`,
    )
    .run(
      champs.nom,
      champs.prenom,
      champs.email.trim().toLowerCase(),
      champs.role,
      etudiant ? champs.annee_but : null,
      champs.groupe || null,
      etudiant ? champs.parcours : null,
      etudiant ? champs.referent_id : null,
      id,
    );
}

// Désactiver un enseignant libère ses étudiants (sans référent) : renvoie leur nombre.
export function changerActivation(id: string, actif: boolean): number {
  db().prepare("UPDATE utilisateurs SET actif = ? WHERE id = ?").run(actif ? 1 : 0, id);
  if (actif) return 0;
  return Number(db().prepare("UPDATE utilisateurs SET referent_id = NULL WHERE referent_id = ?").run(id).changes);
}

export function historiqueCompte(id: string) {
  // Autant de fois l'identifiant que de « ? » dans la requête.
  const compte = (sql: string) => (db().prepare(sql).get(...Array(sql.split("?").length - 1).fill(id)) as { n: number }).n;
  return {
    argumentaires: compte("SELECT COUNT(*) AS n FROM argumentaires WHERE etudiant_id = ?"),
    traces: compte("SELECT COUNT(*) AS n FROM traces WHERE etudiant_id = ?"),
    evaluationsRecues: compte("SELECT COUNT(*) AS n FROM evaluations WHERE etudiant_id = ?"),
    evaluationsDonnees:
      compte("SELECT COUNT(*) AS n FROM evaluations WHERE enseignant_id = ? OR publiee_par = ?") +
      compte("SELECT COUNT(*) AS n FROM rendez_vous WHERE enseignant_id = ?"),
    actionsJournal: compte("SELECT COUNT(*) AS n FROM journal WHERE acteur_id = ?"),
    etudiantsSuivis: compte("SELECT COUNT(*) AS n FROM utilisateurs WHERE referent_id = ?"),
  };
}

// Suppression définitive d'un étudiant et de tout son portfolio (fichiers compris).
export function supprimerEtudiant(id: string) {
  const traces = db().prepare("SELECT id FROM traces WHERE etudiant_id = ?").all(id) as { id: string }[];
  const base = db();
  base.exec("BEGIN");
  try {
    for (const table of ["traces", "argumentaires", "evaluations", "rendez_vous", "presentations", "journal", "consultations"]) {
      base.prepare(`DELETE FROM ${table} WHERE etudiant_id = ?`).run(id);
    }
    base.prepare("DELETE FROM notifications WHERE destinataire_id = ?").run(id);
    // Notifications de son référent qui pointaient vers ce portfolio.
    base.prepare("DELETE FROM notifications WHERE lien LIKE '/portfolio/' || ? || '%'").run(id);
    base.prepare("DELETE FROM courriels WHERE destinataire_id = ?").run(id);
    base.prepare("DELETE FROM utilisateurs WHERE id = ? AND role = 'etudiant'").run(id);
    base.exec("COMMIT");
  } catch (e) {
    base.exec("ROLLBACK");
    throw e;
  }
  for (const t of traces) fs.rmSync(cheminFichier(t.id), { force: true });
}

// Un enseignant n'est supprimable que s'il n'a laissé aucune trace (évaluation, action) :
// sinon on le désactive, pour garder l'historique des évaluations.
export function supprimerEnseignant(id: string): boolean {
  const h = historiqueCompte(id);
  if (h.evaluationsDonnees || h.actionsJournal) return false;
  const base = db();
  base.exec("BEGIN");
  try {
    base.prepare("UPDATE utilisateurs SET referent_id = NULL WHERE referent_id = ?").run(id);
    base.prepare("DELETE FROM consultations WHERE enseignant_id = ?").run(id);
    base.prepare("DELETE FROM notifications WHERE destinataire_id = ?").run(id);
    base.prepare("DELETE FROM courriels WHERE destinataire_id = ?").run(id);
    base.prepare("DELETE FROM utilisateurs WHERE id = ? AND role <> 'etudiant'").run(id);
    base.exec("COMMIT");
  } catch (e) {
    base.exec("ROLLBACK");
    throw e;
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

export function appliquerChangementsGroupes(ids: string[], c: ChangementsGroupes) {
  const resultat = { modifies: 0, ignores: [] as string[], details: [] as { id: string; avant: number | null; apres: number | null }[] };
  const base = db();
  base.exec("BEGIN");
  try {
    for (const id of ids) {
      const e = getUtilisateur(id);
      if (!e || e.role !== "etudiant") continue;
      let annee = e.annee_but;
      if (c.annee === "suivante") {
        if ((e.annee_but ?? 0) >= 3) {
          resultat.ignores.push(`${e.prenom} ${e.nom} (déjà en BUT3)`);
          continue;
        }
        annee = (e.annee_but ?? 0) + 1;
      } else if (c.annee) annee = c.annee;
      base
        .prepare("UPDATE utilisateurs SET annee_but = ?, parcours = ?, referent_id = ?, groupe = ? WHERE id = ?")
        .run(
          annee,
          c.parcours ?? e.parcours,
          c.referent !== undefined ? c.referent : e.referent_id,
          c.groupe !== undefined ? c.groupe : e.groupe,
          id,
        );
      resultat.modifies++;
      resultat.details.push({ id, avant: e.annee_but, apres: annee });
    }
    base.exec("COMMIT");
  } catch (e) {
    base.exec("ROLLBACK");
    throw e;
  }
  return resultat;
}

export function marquerConsulte(enseignantId: string, etudiantId: string) {
  db()
    .prepare(
      `INSERT INTO consultations (enseignant_id, etudiant_id, vu_le) VALUES (?, ?, ?)
       ON CONFLICT(enseignant_id, etudiant_id) DO UPDATE SET vu_le = excluded.vu_le`,
    )
    .run(enseignantId, etudiantId, maintenant());
}

// ---------- Jeu de démonstration ----------

// Rendez-vous de suivi de démonstration (ajoutés une seule fois, base neuve ou existante).
// Étudiants de test des parcours GPRH et GC2F (ajoutés une seule fois, base neuve ou existante).
function completerDemoParcours(base: DatabaseSync) {
  if (!base.prepare("SELECT 1 FROM utilisateurs WHERE id = 'ens-bernard'").get()) return;
  if (!base.prepare("SELECT 1 FROM utilisateurs WHERE id = 'ens-lambert'").get()) return;
  if (base.prepare("SELECT 1 FROM utilisateurs WHERE id = 'etu-benali'").get()) return;
  const ilYa = (j: number) => new Date(Date.now() - j * 86400000).toISOString();
  const insUtil = base.prepare(
    `INSERT INTO utilisateurs (id, nom, prenom, email, role, annee_but, groupe, parcours, referent_id, pref_courriel)
     VALUES (?, ?, ?, ?, 'etudiant', ?, ?, ?, ?, 'immediat')`,
  );
  const insArg = base.prepare("INSERT INTO argumentaires (etudiant_id, annee, competence, texte, maj_le) VALUES (?, ?, ?, ?, ?)");
  const insTrace = base.prepare(
    `INSERT INTO traces (id, etudiant_id, annee, competence, titre, description, fichier_nom, taille, depose_le, maj_le)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insEval = base.prepare(
    `INSERT INTO evaluations (etudiant_id, annee, competence, niveau, note, commentaire, enseignant_id, maj_le, niveau_publie, note_publiee, commentaire_publie, publiee_le, publiee_par)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insRdv = base.prepare(
    `INSERT INTO rendez_vous (etudiant_id, annee, numero, date_rdv, note, commentaire, enseignant_id, maj_le, note_publiee, commentaire_publie, publie_le)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insJournal = base.prepare(
    "INSERT INTO journal (etudiant_id, acteur_id, annee, competence, type, detail, cree_le) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  const arg = (etu: string, annee: number, comp: string, texte: string, j: number) => {
    insArg.run(etu, annee, comp, texte, ilYa(j));
    insJournal.run(etu, etu, annee, comp, "argumentaire_cree", `${texte.split(/\s+/).length} mots`, ilYa(j));
  };
  const trace = (etu: string, annee: number, comp: string, titre: string, description: string, j: number) => {
    const id = randomUUID();
    const contenu = genererPdfDemo(titre, [`Trace déposée pour la compétence ${comp} (BUT${annee})`, description, "Document de démonstration généré automatiquement."]);
    fs.writeFileSync(cheminFichier(id), contenu);
    const nom = titre.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + ".pdf";
    insTrace.run(id, etu, annee, comp, titre, description, nom, contenu.length, ilYa(j), ilYa(j));
    insJournal.run(etu, etu, annee, comp, "trace_ajoutee", titre, ilYa(j));
  };

  // Parcours GPRH
  insUtil.run("etu-benali", "Benali", "Sarah", "sarah.benali@etu.exemple.fr", 2, "TD3", "GPRH", "ens-bernard");
  arg("etu-benali", 2, "C4", "Pendant mon stage au service RH d'une clinique, j'ai préparé les éléments variables de paie (heures supplémentaires, primes de nuit) et vérifié les bulletins avant validation. J'ai compris l'importance du contrôle croisé avec les plannings.", 6);
  trace("etu-benali", 2, "C4", "Contrôle des éléments variables de paie", "Grille de contrôle et exemple de bulletin anonymisé (stage).", 6);
  insEval.run("etu-benali", 2, "C4", "en_cours", 12, "Bonne rigueur ; expliciter davantage le cadre juridique mobilisé.", "ens-bernard", ilYa(3), "en_cours", 12, "Bonne rigueur ; expliciter davantage le cadre juridique mobilisé.", ilYa(3), "ens-bernard");
  insRdv.run("etu-benali", 2, 1, ilYa(20).slice(0, 10), 13, "Bon démarrage ; penser à déposer des traces en C5.", "ens-bernard", ilYa(20), 13, "Bon démarrage ; penser à déposer des traces en C5.", ilYa(20));
  insUtil.run("etu-laurent", "Laurent", "Maxime", "maxime.laurent@etu.exemple.fr", 3, "TD2", "GPRH", "ens-lambert");
  arg("etu-laurent", 3, "C5", "En alternance, j'ai refondu le processus d'intégration des nouveaux arrivants : livret d'accueil, parcours de formation et questionnaire de satisfaction à trois mois.", 4);
  trace("etu-laurent", 3, "C5", "Livret d'accueil des nouveaux arrivants", "Version finale diffusée par l'entreprise d'accueil.", 4);

  // Parcours GC2F
  insUtil.run("etu-perrin", "Perrin", "Julie", "julie.perrin@etu.exemple.fr", 2, "TD3", "GC2F", "ens-bernard");
  arg("etu-perrin", 2, "C4", "Lors de la SAÉ « Révision des comptes », j'ai contrôlé le cycle achats-fournisseurs d'une PME : rapprochement des factures, lettrage et justification des soldes. J'ai identifié deux anomalies de cut-off.", 5);
  trace("etu-perrin", 2, "C4", "Dossier de révision du cycle fournisseurs", "Feuilles de travail et note de synthèse (SAÉ).", 5);
  insUtil.run("etu-masson", "Masson", "Antoine", "antoine.masson@etu.exemple.fr", 3, "TD2", "GC2F", "ens-lambert");
  arg("etu-masson", 3, "C5", "J'ai construit le budget de trésorerie sur douze mois de mon entreprise d'accueil et proposé un plan de financement pour l'achat d'un nouveau véhicule utilitaire.", 2);
  trace("etu-masson", 3, "C5", "Budget de trésorerie et plan de financement", "Tableur commenté présenté au gérant.", 2);
  insEval.run("etu-masson", 3, "C5", "acquis", 15, "Prévisions cohérentes et bien argumentées.", "ens-lambert", ilYa(1), null, null, null, null, null);
}

function completerDemoRendezVous(base: DatabaseSync) {
  if ((base.prepare("SELECT COUNT(*) AS n FROM rendez_vous").get() as { n: number }).n > 0) return;
  if (!base.prepare("SELECT 1 FROM utilisateurs WHERE id = 'etu-fournier'").get()) return;
  const ins = base.prepare(
    `INSERT INTO rendez_vous (etudiant_id, annee, numero, date_rdv, note, commentaire, enseignant_id, maj_le, note_publiee, commentaire_publie, publie_le)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const ilYa = (j: number) => new Date(Date.now() - j * 86400000).toISOString();
  const jour = (j: number) => ilYa(j).slice(0, 10);
  // Manon (BUT3) : 1er rendez-vous publié, 2e en brouillon.
  ins.run("etu-fournier", 3, 1, jour(30), 15, "Projet entrepreneurial bien engagé ; consolider les traces de C2.", "ens-lambert", ilYa(30), 15, "Projet entrepreneurial bien engagé ; consolider les traces de C2.", ilYa(30));
  ins.run("etu-fournier", 3, 2, jour(2), 14, "Bonne progression, argumentaire C4 à finaliser.", "ens-lambert", ilYa(2), null, null, null);
  // Nathan (BUT2) : 1er rendez-vous publié.
  ins.run("etu-garcia", 2, 1, jour(25), 12, "Démarche réflexive à approfondir dans les argumentaires.", "ens-bernard", ilYa(25), 12, "Démarche réflexive à approfondir dans les argumentaires.", ilYa(25));
}

// Référents, troisième enseignante et évaluations publiées : ajoutés aussi aux bases créées par la première version.
function completerDemo(base: DatabaseSync) {
  if (!base.prepare("SELECT 1 FROM utilisateurs WHERE id = 'ens-bernard'").get()) return;
  if (base.prepare("SELECT 1 FROM utilisateurs WHERE id = 'ens-lambert'").get()) return;
  base
    .prepare("INSERT INTO utilisateurs (id, nom, prenom, email, role, pref_courriel) VALUES (?, ?, ?, ?, 'enseignant', 'aucun')")
    .run("ens-lambert", "Lambert", "Sophie", "sophie.lambert@exemple.fr");
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
  const maj = base.prepare("UPDATE utilisateurs SET referent_id = ? WHERE id = ? AND referent_id IS NULL");
  for (const [etu, ref] of Object.entries(referents)) maj.run(ref, etu);
  // Les évaluations du jeu de démonstration sont déjà publiées.
  base.exec(`UPDATE evaluations SET niveau_publie = niveau, note_publiee = note, commentaire_publie = commentaire,
             publiee_le = maj_le, publiee_par = enseignant_id
             WHERE publiee_le IS NULL AND (
               (etudiant_id = 'etu-fournier' AND annee = 1 AND competence = 'C1') OR
               (etudiant_id = 'etu-garcia' AND annee = 2 AND competence = 'C2'))`);
}

function peuplerDemo(base: DatabaseSync) {
  const utilisateurs: Omit<Utilisateur, "referent_id" | "parcours" | "actif" | "pref_courriel">[] = [
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
  const insUtil = base.prepare(
    "INSERT INTO utilisateurs (id, nom, prenom, email, role, annee_but, groupe, pref_courriel) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
  );
  for (const u of utilisateurs) {
    insUtil.run(u.id, u.nom, u.prenom, u.email, u.role, u.annee_but, u.groupe, u.role === "etudiant" ? "immediat" : "aucun");
  }

  const ilYa = (jours: number, heures = 0) =>
    new Date(Date.now() - jours * 86400000 - heures * 3600000).toISOString();

  const insPres = base.prepare("INSERT INTO presentations (etudiant_id, texte, projet_pro, maj_le) VALUES (?, ?, ?, ?)");
  const insArg = base.prepare(
    "INSERT INTO argumentaires (etudiant_id, annee, competence, texte, maj_le) VALUES (?, ?, ?, ?, ?)",
  );
  const insTrace = base.prepare(
    `INSERT INTO traces (id, etudiant_id, annee, competence, titre, description, fichier_nom, taille, depose_le, maj_le)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insEval = base.prepare(
    `INSERT INTO evaluations (etudiant_id, annee, competence, niveau, note, commentaire, enseignant_id, maj_le)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insJournal = base.prepare(
    "INSERT INTO journal (etudiant_id, acteur_id, annee, competence, type, detail, cree_le) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );

  const trace = (etu: string, annee: number, comp: string, titre: string, description: string, jours: number) => {
    const id = randomUUID();
    const contenu = genererPdfDemo(titre, [
      `Trace déposée pour la compétence ${comp} (BUT${annee})`,
      description,
      "Document de démonstration généré automatiquement.",
    ]);
    fs.writeFileSync(cheminFichier(id), contenu);
    const nomFichier = titre.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + ".pdf";
    insTrace.run(id, etu, annee, comp, titre, description, nomFichier, contenu.length, ilYa(jours), ilYa(jours));
    insJournal.run(etu, etu, annee, comp, "trace_ajoutee", titre, ilYa(jours));
  };

  const arg = (etu: string, annee: number, comp: string, texte: string, jours: number) => {
    insArg.run(etu, annee, comp, texte, ilYa(jours));
    insJournal.run(etu, etu, annee, comp, "argumentaire_cree", `${texte.split(/\s+/).length} mots`, ilYa(jours));
  };

  // Manon (BUT3) : a commencé son portfolio en BUT1 et l'a complété chaque année.
  insPres.run(
    "etu-fournier",
    "Étudiante en BUT GEA parcours GEMA, j'ai effectué mon alternance dans une PME de distribution de matériel agricole. Je m'intéresse particulièrement à la création d'entreprise et au pilotage de projets.",
    "Reprendre ou créer une entreprise dans le secteur agroalimentaire après une licence professionnelle ou un master entrepreneuriat.",
    ilYa(40),
  );
  arg("etu-fournier", 1, "C1", "Lors de la SAÉ « Diagnostic d'une organisation », j'ai analysé une boulangerie artisanale de mon quartier. J'ai identifié ses enjeux économiques (concurrence des grandes surfaces) et juridiques (statut d'EURL). J'ai d'abord eu du mal à distinguer les parties prenantes internes et externes ; la cartographie réalisée en groupe m'a permis de clarifier les relations entre les acteurs du processus d'approvisionnement.", 400);
  trace("etu-fournier", 1, "C1", "Diagnostic de la boulangerie Martin", "Rapport de SAÉ : cartographie des parties prenantes et analyse PESTEL.", 400);
  insEval.run("etu-fournier", 1, "C1", "acquis", 14, "Analyse claire et bien documentée. La cartographie des acteurs est pertinente.", "ens-martin", ilYa(380));
  arg("etu-fournier", 3, "C4", "Dans le cadre de mon alternance, j'ai participé à l'étude de faisabilité d'une nouvelle gamme de services de maintenance. J'ai testé la viabilité financière du business model en construisant un plan de trésorerie sur trois ans et en simulant deux scénarios de prix. La présentation au directeur financier m'a obligée à argumenter mes hypothèses.", 3);
  trace("etu-fournier", 3, "C4", "Business plan – offre de maintenance", "Plan de financement et prévisionnel de trésorerie présentés à la direction.", 3);
  trace("etu-fournier", 3, "C4", "Support de présentation à la direction", "Diaporama de soutenance du projet (10 diapositives).", 2);
  arg("etu-fournier", 3, "C1", "J'ai proposé une réorganisation du processus de gestion des commandes après avoir mesuré les délais de traitement sur deux mois.", 1);

  // Lucas (BUT3) : arrive en BUT3, portfolio à compléter.
  arg("etu-girard", 3, "C2", "J'ai construit un tableau de bord sous Excel pour suivre les stocks de l'entreprise d'accueil.", 6);

  // Nathan (BUT2)
  insPres.run("etu-garcia", "Étudiant en BUT2 GEA, passionné de sport et trésorier du BDE.", "Contrôle de gestion dans le secteur du sport.", ilYa(20));
  insJournal.run("etu-garcia", "etu-garcia", null, null, "presentation_maj", "", ilYa(20));
  arg("etu-garcia", 2, "C2", "Au cours de la SAÉ ERP, j'ai paramétré un cycle achats-ventes sur Odoo. J'ai traité les données de ventes pour identifier les produits les moins rentables et j'ai présenté mes conclusions sous forme de graphiques.", 10);
  trace("etu-garcia", 2, "C2", "Rapport SAÉ ERP Odoo", "Captures du paramétrage et analyse des ventes.", 10);
  insEval.run("etu-garcia", 2, "C2", "en_cours", 10.5, "Bonne maîtrise de l'outil. L'argumentaire doit davantage expliciter les risques évalués.", "ens-bernard", ilYa(8));
  insJournal.run("etu-garcia", "ens-bernard", 2, "C2", "evaluation", "En cours d'acquisition", ilYa(8));
  arg("etu-garcia", 2, "C3", "En tant que trésorier du BDE, j'ai coordonné l'organisation du gala avec quatre associations.", 1);
  trace("etu-garcia", 2, "C3", "Rétroplanning du gala", "Diagramme de Gantt partagé avec les associations.", 0.2);

  // Chloé (BUT2) : complète aussi son historique de BUT1.
  arg("etu-roux", 1, "C3", "En BUT1, j'ai animé l'équipe projet du Projet Personnel et Professionnel : répartition des tâches, comptes rendus de réunion.", 5);
  trace("etu-roux", 1, "C3", "Comptes rendus de réunion PPP", "Trois comptes rendus rédigés et diffusés à l'équipe.", 5);
  arg("etu-roux", 2, "C4", "J'ai modélisé le business model d'une start-up locale avec le Business Model Canvas.", 2);

  // Léa (BUT1)
  arg("etu-dubois", 1, "C1", "J'ai étudié le fonctionnement d'une mairie pour comprendre la différence entre une organisation publique et une entreprise privée.", 4);
  trace("etu-dubois", 1, "C1", "Fiche d'identité de la mairie", "Organigramme et missions des services.", 4);

  // Le jeu de démonstration considère que Thomas Bernard a consulté Nathan il y a 3 jours.
  base
    .prepare("INSERT INTO consultations (enseignant_id, etudiant_id, vu_le) VALUES (?, ?, ?)")
    .run("ens-bernard", "etu-garcia", ilYa(3));
}
