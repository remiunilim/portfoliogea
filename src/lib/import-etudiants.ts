import ExcelJS from "exceljs";
import { PARCOURS_PAR_DEFAUT, parcoursEstConfigure } from "./referentiel";
import {
  cg2pEstActif,
  creerUtilisateur,
  emailExiste,
  listerEnseignants,
  listerEtudiants,
  mettreAJourEtudiant,
  modifierEmail,
  changerActivation,
  type Utilisateur,
} from "./db";

// Import d'une liste d'étudiants (Excel ou CSV) avec les colonnes :
// Nom, Prénom, Email étudiant, Année, Parcours, Enseignant référent, Email enseignant — et, facultativement, Groupe.
// Les adresses servent à la connexion (lien envoyé par mail) et aux notifications ; celle de l'enseignant identifie aussi le référent.
// L'import se fait en deux temps : un aperçu ligne par ligne, puis l'application.

export const PARCOURS_GEA = ["GEMA", "GC2F", "GPRH", "CG2P"] as const;
export const COLONNES_MODELE = [
  "Nom",
  "Prénom",
  "Email étudiant",
  "Année",
  "Parcours",
  "Enseignant référent",
  "Email enseignant",
  "Groupe",
];

export const EMAIL_VALIDE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const estEmailProvisoire = (email: string) => email.endsWith(".a-renseigner");

const normaliser = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9@.]+/g, " ")
    .trim();
const cleNom = (prenom: string, nom: string) => normaliser(`${prenom} ${nom}`);

type Champ = "nom" | "prenom" | "annee" | "parcours" | "referent" | "email" | "emailReferent" | "groupe";
const ENTETES: Record<string, Champ> = {
  nom: "nom",
  "nom de famille": "nom",
  prenom: "prenom",
  annee: "annee",
  "annee but": "annee",
  niveau: "annee",
  parcours: "parcours",
  "enseignant referent": "referent",
  "enseignant e referent e": "referent",
  referent: "referent",
  "referent e": "referent",
  enseignant: "referent",
  tuteur: "referent",
  email: "email",
  "e mail": "email",
  mail: "email",
  courriel: "email",
  "email etudiant": "email",
  "e mail etudiant": "email",
  "mail etudiant": "email",
  "courriel etudiant": "email",
  "email etudiant e": "email",
  "email enseignant": "emailReferent",
  "e mail enseignant": "emailReferent",
  "mail enseignant": "emailReferent",
  "courriel enseignant": "emailReferent",
  "email enseignant referent": "emailReferent",
  "email referent": "emailReferent",
  "email enseignant e": "emailReferent",
  groupe: "groupe",
};

export type LigneBrute = Partial<Record<Champ, string>> & { numero: number };

export async function lireFichier(nom: string, contenu: Buffer): Promise<{ lignes: LigneBrute[] } | { erreur: string }> {
  let tableau: string[][];
  if (/\.csv$/i.test(nom)) {
    const texte = contenu.toString("utf8").replace(/^﻿/, "");
    const separateur = (texte.split("\n")[0].match(/;/g)?.length ?? 0) >= (texte.split("\n")[0].match(/,/g)?.length ?? 0) ? ";" : ",";
    tableau = texte
      .split(/\r?\n/)
      .map((l) => l.split(separateur).map((c) => c.trim().replace(/^"(.*)"$/, "$1")));
  } else if (/\.xlsx$/i.test(nom)) {
    const classeur = new ExcelJS.Workbook();
    try {
      await classeur.xlsx.load(contenu as unknown as ArrayBuffer);
    } catch {
      return { erreur: "Le fichier Excel est illisible. Enregistrez-le au format .xlsx puis réessayez." };
    }
    const feuille = classeur.worksheets[0];
    if (!feuille) return { erreur: "Le classeur ne contient aucune feuille." };
    tableau = [];
    feuille.eachRow({ includeEmpty: true }, (ligne, n) => {
      const valeurs: string[] = [];
      ligne.eachCell({ includeEmpty: true }, (cellule, col) => {
        valeurs[col - 1] = (cellule.text ?? "").toString().trim();
      });
      tableau[n - 1] = Array.from(valeurs, (v) => v ?? "");
    });
  } else {
    return { erreur: "Format non pris en charge : utilisez un fichier .xlsx (Excel) ou .csv." };
  }

  const indexEntete = tableau.findIndex((l) => l?.some((c) => ENTETES[normaliser(c ?? "")]));
  if (indexEntete < 0) return { erreur: "Ligne d'en-tête introuvable : la première ligne doit contenir Nom, Prénom, Année, Parcours, Enseignant référent." };
  const colonnes = tableau[indexEntete].map((c) => ENTETES[normaliser(c ?? "")]);
  const manquantes = (["nom", "prenom", "annee"] as Champ[]).filter((c) => !colonnes.includes(c));
  if (manquantes.length) return { erreur: `Colonne(s) obligatoire(s) manquante(s) : ${manquantes.join(", ")}.` };

  const lignes: LigneBrute[] = [];
  for (let i = indexEntete + 1; i < tableau.length; i++) {
    const cellules = tableau[i] ?? [];
    if (cellules.every((c) => !c)) continue;
    const ligne: LigneBrute = { numero: i + 1 };
    colonnes.forEach((champ, j) => {
      if (champ && cellules[j]) ligne[champ] = cellules[j].trim();
    });
    lignes.push(ligne);
  }
  if (lignes.length === 0) return { erreur: "Le fichier ne contient aucun étudiant sous la ligne d'en-tête." };
  if (lignes.length > 2000) return { erreur: "Le fichier dépasse 2 000 lignes : découpez-le par promotion." };
  return { lignes };
}

export type LigneApercu = {
  numero: number;
  nom: string;
  prenom: string;
  annee: number | null;
  parcours: string;
  email: string;
  groupe: string;
  referentTexte: string;
  emailReferent: string;
  referentId: string | null;
  referentNom: string;
  referentACreer: { prenom: string; nom: string; email: string } | null;
  // Adresse à enregistrer sur un enseignant existant qui n'en avait pas encore.
  emailReferentACompleter: string | null;
  etudiantId: string | null;
  // Adresse de l'étudiant à enregistrer (création ou mise à jour), sinon null.
  nouvelEmail: string | null;
  action: "creer" | "maj" | "inchange" | "erreur";
  changements: string[];
  erreurs: string[];
  avertissements: string[];
};

// « MARTIN Claire », « Claire Martin », « Martin, Claire » → prénom / nom.
function decouperNomEnseignant(texte: string): { prenom: string; nom: string } {
  if (texte.includes(",")) {
    const [nom, prenom] = texte.split(",").map((s) => s.trim());
    return { prenom: prenom || "-", nom };
  }
  const mots = texte.split(/\s+/);
  const majuscules = mots.filter((m) => m.length > 1 && m === m.toUpperCase() && /[A-Z]/.test(m));
  if (majuscules.length && majuscules.length < mots.length) {
    return { nom: majuscules.join(" "), prenom: mots.filter((m) => !majuscules.includes(m)).join(" ") };
  }
  return { prenom: mots[0], nom: mots.slice(1).join(" ") || mots[0] };
}

function trouverEnseignant(texte: string, email: string, enseignants: Utilisateur[]): Utilisateur | null | "ambigu" {
  // L'adresse identifie l'enseignant sans ambiguïté : elle est prioritaire sur le nom.
  if (email) {
    const parEmail = enseignants.find((e) => normaliser(e.email) === normaliser(email));
    if (parEmail) return parEmail;
  }
  if (!texte) return null;
  const t = normaliser(texte);
  const exact = enseignants.filter(
    (e) => t === cleNom(e.prenom, e.nom) || t === cleNom(e.nom, e.prenom) || t === normaliser(e.email),
  );
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return "ambigu";
  const parNom = enseignants.filter((e) => normaliser(e.nom) === t);
  if (parNom.length === 1) return parNom[0];
  return parNom.length > 1 ? "ambigu" : null;
}

export async function analyserImport(lignes: LigneBrute[], creerEnseignants: boolean): Promise<LigneApercu[]> {
  const enseignants = await listerEnseignants();
  // Les comptes désactivés sont reconnus aussi : un étudiant qui revient est réactivé, pas recréé.
  const etudiants = await listerEtudiants({ inclureDesactives: true });
  const cg2pActif = await cg2pEstActif();
  const vus = new Map<string, number>();
  const emailsVus = new Map<string, number>();
  const aCreer = new Map<string, { prenom: string; nom: string; email: string }>();

  const resultats: LigneApercu[] = [];
  for (const l of lignes) {
    const nom = l.nom ?? "";
    const prenom = l.prenom ?? "";
    const email = (l.email ?? "").toLowerCase();
    const emailReferent = (l.emailReferent ?? "").toLowerCase();
    const erreurs: string[] = [];
    const avertissements: string[] = [];
    if (!nom || !prenom) erreurs.push("Nom ou prénom manquant.");

    const anneeTexte = (l.annee ?? "").match(/[123]/)?.[0];
    const annee = anneeTexte ? Number(anneeTexte) : null;
    if (!annee) erreurs.push(`Année « ${l.annee ?? ""} » non reconnue (attendu : 1, 2, 3 ou BUT1, BUT2, BUT3).`);

    const parcours = (l.parcours ?? "").toUpperCase().replace(/\s+/g, "") || "GEMA";
    if (!l.parcours) avertissements.push("Parcours absent : GEMA retenu.");
    else if (!(PARCOURS_GEA as readonly string[]).includes(parcours)) erreurs.push(`Parcours « ${l.parcours} » inconnu (${PARCOURS_GEA.join(", ")}).`);
    else if (parcours === "CG2P" && !cg2pActif) {
      avertissements.push("Parcours CG2P pas encore activé par l'administrateur (page Étudiants et affectations) : importé quand même.");
    } else if (!parcoursEstConfigure(parcours)) {
      avertissements.push(`Référentiel ${parcours} pas encore configuré : les onglets ${PARCOURS_PAR_DEFAUT} seront affichés en attendant.`);
    }

    const cle = cleNom(prenom, nom);
    if (vus.has(cle)) erreurs.push(`Doublon de la ligne ${vus.get(cle)}.`);
    else vus.set(cle, l.numero);

    // Adresses
    if (!email) avertissements.push("Email étudiant absent : la connexion se fait par lien envoyé par mail, cet·te étudiant·e ne pourra pas se connecter tant qu'une adresse n'est pas renseignée.");
    else if (!EMAIL_VALIDE.test(email)) erreurs.push(`Email étudiant « ${l.email} » invalide.`);
    else if (emailsVus.has(email)) erreurs.push(`Email étudiant déjà utilisé ligne ${emailsVus.get(email)}.`);
    else emailsVus.set(email, l.numero);
    if (emailReferent && !EMAIL_VALIDE.test(emailReferent)) erreurs.push(`Email enseignant « ${l.emailReferent} » invalide.`);

    // Référent
    let referentId: string | null = null;
    let referentNom = "";
    let referentACreer: LigneApercu["referentACreer"] = null;
    let emailReferentACompleter: string | null = null;
    const referentTexte = l.referent ?? "";
    const referentIndique = !!(referentTexte || emailReferent);
    if (referentIndique) {
      const trouve = trouverEnseignant(referentTexte, EMAIL_VALIDE.test(emailReferent) ? emailReferent : "", enseignants);
      if (trouve === "ambigu") erreurs.push(`Référent « ${referentTexte} » ambigu : indiquez son email.`);
      else if (trouve) {
        referentId = trouve.id;
        referentNom = `${trouve.prenom} ${trouve.nom}`;
        if (emailReferent && normaliser(trouve.email) !== normaliser(emailReferent)) {
          if (estEmailProvisoire(trouve.email)) emailReferentACompleter = emailReferent;
          else avertissements.push(`Email enseignant différent de celui enregistré (${trouve.email}) : l'adresse enregistrée est conservée.`);
        }
      } else if (!referentTexte) {
        erreurs.push(`Aucun enseignant avec l'email ${emailReferent} : indiquez aussi son nom pour le créer.`);
      } else if (creerEnseignants) {
        const cleRef = emailReferent || normaliser(referentTexte);
        referentACreer = aCreer.get(cleRef) ?? { ...decouperNomEnseignant(referentTexte), email: emailReferent };
        aCreer.set(cleRef, referentACreer);
        referentNom = `${referentACreer.prenom} ${referentACreer.nom}`;
        // emailExiste couvre aussi les comptes désactivés (l'adresse reste unique en base).
        if (emailReferent && (await emailExiste(emailReferent))) {
          erreurs.push(`L'adresse ${emailReferent} appartient déjà à un autre compte (éventuellement désactivé).`);
        }
        avertissements.push(
          `Enseignant « ${referentNom} » inconnu : il sera créé${emailReferent ? "" : " sans email, et ne pourra donc pas se connecter tant qu'une adresse n'est pas renseignée sur sa fiche"}.`,
        );
      } else {
        erreurs.push(`Référent « ${referentTexte} » inconnu. Ajoutez-le ou cochez « créer les enseignants inconnus ».`);
      }
    }

    // Étudiant existant : reconnu par son email, sinon par son nom.
    const emailValide = !!email && EMAIL_VALIDE.test(email);
    let parEmail = emailValide ? etudiants.find((e) => normaliser(e.email) === email) : undefined;
    // Une adresse qui désigne un autre étudiant est une erreur de saisie, pas une mise à jour.
    if (parEmail && cleNom(parEmail.prenom, parEmail.nom) !== cle) {
      erreurs.push(`L'adresse ${email} appartient à ${parEmail.prenom} ${parEmail.nom}.`);
      parEmail = undefined;
    }
    const homonymes = etudiants.filter((e) => cleNom(e.prenom, e.nom) === cle);
    const existant = parEmail ?? (homonymes.length === 1 ? homonymes[0] : undefined);
    if (!parEmail && homonymes.length > 1) erreurs.push("Plusieurs étudiants portent ce nom : renseignez l'email étudiant pour les distinguer.");
    if (emailValide && !erreurs.some((e) => e.startsWith(`L'adresse ${email}`)) && (await emailExiste(email)) && normaliser(existant?.email ?? "") !== email) {
      erreurs.push(`L'adresse ${email} appartient déjà à un autre compte.`);
    }

    const changements: string[] = [];
    let nouvelEmail: string | null = null;
    let action: LigneApercu["action"] = "creer";
    if (existant) {
      if (annee && existant.annee_but !== annee) changements.push(`BUT${existant.annee_but} → BUT${annee}`);
      if (existant.parcours !== parcours) changements.push(`parcours ${existant.parcours ?? "-"} → ${parcours}`);
      if (referentIndique && (referentACreer || existant.referent_id !== referentId)) changements.push(`référent → ${referentNom}`);
      if (emailValide && normaliser(existant.email) !== email) {
        nouvelEmail = email;
        changements.push(estEmailProvisoire(existant.email) ? "email ajouté" : `email ${existant.email} → ${email}`);
      }
      if (emailReferentACompleter) changements.push(`email du référent ajouté`);
      if (!existant.actif) changements.push("compte désactivé réactivé");
      action = changements.length ? "maj" : "inchange";
    } else {
      nouvelEmail = emailValide ? email : null;
      if (!referentIndique) avertissements.push("Aucun référent : l'étudiant ne sera visible que par l'administrateur.");
    }
    if (erreurs.length) action = "erreur";

    resultats.push({
      numero: l.numero,
      nom,
      prenom,
      annee,
      parcours,
      email,
      groupe: l.groupe ?? "",
      referentTexte,
      emailReferent,
      referentId,
      referentNom,
      referentACreer,
      emailReferentACompleter,
      etudiantId: existant?.id ?? null,
      nouvelEmail,
      action,
      changements,
      erreurs,
      avertissements,
    });
  }
  return resultats;
}

export async function appliquerImport(apercu: LigneApercu[]) {
  const enseignantsCrees = new Map<string, string>();
  const bilan = { crees: 0, misAJour: 0, inchanges: 0, ignores: 0, enseignantsCrees: 0, emailsEnseignantsCompletes: 0 };
  for (const l of apercu) {
    if (l.action === "erreur") {
      bilan.ignores++;
      continue;
    }
    if (l.action === "inchange") {
      bilan.inchanges++;
      continue;
    }
    let referentId = l.referentId;
    if (l.referentACreer) {
      const cle = l.referentACreer.email || normaliser(`${l.referentACreer.prenom} ${l.referentACreer.nom}`);
      referentId = enseignantsCrees.get(cle) ?? null;
      if (!referentId) {
        referentId = await creerUtilisateur({ ...l.referentACreer, role: "enseignant" });
        enseignantsCrees.set(cle, referentId);
        bilan.enseignantsCrees++;
      }
    }
    if (referentId && l.emailReferentACompleter && !(await emailExiste(l.emailReferentACompleter))) {
      await modifierEmail(referentId, l.emailReferentACompleter);
      bilan.emailsEnseignantsCompletes++;
    }
    if (l.action === "creer") {
      await creerUtilisateur({
        nom: l.nom,
        prenom: l.prenom,
        email: l.nouvelEmail ?? undefined,
        role: "etudiant",
        annee_but: l.annee,
        groupe: l.groupe,
        parcours: l.parcours,
        referent_id: referentId,
      });
      bilan.crees++;
    } else {
      await mettreAJourEtudiant(l.etudiantId!, {
        annee_but: l.annee!,
        parcours: l.parcours,
        // Colonnes référent vides : on conserve l'affectation actuelle.
        referent_id: l.referentTexte || l.emailReferent ? referentId : undefined,
      });
      if (l.nouvelEmail) await modifierEmail(l.etudiantId!, l.nouvelEmail);
      await changerActivation(l.etudiantId!, true);
      bilan.misAJour++;
    }
  }
  return bilan;
}

export async function genererModele(): Promise<Buffer> {
  const classeur = new ExcelJS.Workbook();
  const feuille = classeur.addWorksheet("Étudiants");
  feuille.columns = COLONNES_MODELE.map((c) => ({ header: c, width: c.startsWith("Email") ? 32 : c === "Enseignant référent" ? 24 : 14 }));
  feuille.getRow(1).font = { bold: true };
  // Exemples fictifs, à remplacer par la liste réelle.
  feuille.addRow(["Dupont", "Camille", "camille.dupont@etu.exemple.fr", "BUT1", "GEMA", "Thomas Bernard", "thomas.bernard@exemple.fr", "TD1"]);
  feuille.addRow(["Nguyen", "Sami", "sami.nguyen@etu.exemple.fr", "2", "GEMA", "LAMBERT Sophie", "sophie.lambert@exemple.fr", "TD2"]);
  const aide = classeur.addWorksheet("Aide");
  aide.addRows([
    ["Colonne", "Contenu attendu"],
    ["Nom, Prénom", "Obligatoires. Un étudiant déjà présent (même email, ou même prénom et nom) est mis à jour."],
    ["Email étudiant", "Adresse universitaire de l'étudiant : sert à la connexion (lien envoyé par mail) et aux notifications."],
    ["Année", "1, 2, 3 ou BUT1, BUT2, BUT3 (obligatoire)."],
    ["Parcours", `${PARCOURS_GEA.join(", ")}. Vide = GEMA.`],
    ["Enseignant référent", "« Prénom Nom » ou « NOM Prénom ». Vide (avec Email enseignant vide) = affectation inchangée."],
    ["Email enseignant", "Adresse du référent : l'identifie sans ambiguïté, sert à sa connexion et à ses notifications. Complète l'adresse d'un enseignant qui n'en avait pas."],
    ["Groupe", "Facultatif (TD1, TP2…)."],
  ]);
  aide.getColumn(1).width = 22;
  aide.getColumn(2).width = 110;
  aide.getRow(1).font = { bold: true };
  return Buffer.from(await classeur.xlsx.writeBuffer());
}
