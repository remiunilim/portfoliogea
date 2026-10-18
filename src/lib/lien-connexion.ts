import { randomBytes, createHash } from "node:crypto";
import {
  consommerJetonInscription as dbConsommerJetonInscription,
  creerJetonConnexion,
  creerJetonInscription,
  demandeInscriptionRecente,
  demandeRecente,
  emailDuJetonInscription as dbEmailDuJetonInscription,
  emailExiste,
  getUtilisateurParEmail,
  verifierEtConsommerJeton,
  type Utilisateur,
} from "./db";
import { EMAIL_VALIDE } from "./import-etudiants";
import { echapperHtml, envoyerCourriel, gabaritCourrielHtml } from "./mail";

const boutonHtml = (lien: string, libelle: string) => `
  <p style="margin:0 0 24px;text-align:center;">
    <a href="${lien}" style="display:inline-block;background:#1f5f8b;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 28px;border-radius:8px;">${libelle}</a>
  </p>
  <p style="margin:0;font-size:13px;color:#5d6878;">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br><a href="${lien}" style="color:#1f5f8b;word-break:break-all;">${lien}</a></p>`;

// Connexion par lien envoyé par mail, sans mot de passe ni SSO (adaptation pour un hébergement
// hors DSI, ex. OVH) : la personne saisit son adresse mail universitaire, reçoit un lien valable
// 20 minutes et à usage unique qui ouvre directement sa session.
//
// Si l'adresse est déjà enregistrée (compte créé par l'administrateur, import ou ajout manuel,
// comme avant, OU par auto-inscription — voir ci-dessous) : lien de connexion classique.
// Si elle est inconnue : lien de CRÉATION de profil étudiant (/connexion/creer-profil), qui ne
// fait que prouver que la personne possède bien cette adresse avant d'afficher le formulaire —
// aucun compte n'est créé tant que ce lien n'a pas été suivi et le formulaire rempli. Les
// enseignants ne sont jamais auto-provisionnés : seul l'administrateur les ajoute.
//
// L'envoi est volontairement en dehors du coupe-circuit « Envoi des courriels » (page Étudiants et
// affectations) : ce réglage ne concerne que les notifications, pas la connexion/l'inscription.

const hacher = (jeton: string) => createHash("sha256").update(jeton).digest("hex");

function urlBase(): string {
  const url = process.env.APP_BASE_URL;
  if (!url) throw new Error("APP_BASE_URL n'est pas renseignée (voir .env.example).");
  return url.replace(/\/$/, "");
}

// Domaines autorisés à s'auto-inscrire (ex. "unilim.fr,etu.unilim.fr"), si renseigné dans
// .env.local. Vide = aucune restriction (pratique en local/démo, à renseigner en production pour
// éviter que n'importe quelle adresse puisse créer un profil étudiant).
function domaineAutorise(email: string): boolean {
  const liste = (process.env.EMAIL_ETUDIANTS_DOMAINES ?? "").trim();
  if (!liste) return true;
  const domaine = email.split("@")[1]?.toLowerCase();
  return liste.split(",").map((d) => d.trim().toLowerCase()).filter(Boolean).includes(domaine ?? "");
}

// Toujours silencieux (aucun mail envoyé) dans les cas où rien ne doit se passer : l'appelant
// affiche le même message de confirmation dans tous les cas, pour ne pas révéler quelles adresses
// sont déjà enregistrées.
export async function envoyerLienConnexion(email: string): Promise<void> {
  const courriel = email.trim().toLowerCase();
  if (!EMAIL_VALIDE.test(courriel)) return;

  const u = await getUtilisateurParEmail(courriel);
  if (u) {
    if (!u.actif || (await demandeRecente(u.id))) return;
    const jeton = randomBytes(32).toString("hex");
    await creerJetonConnexion(u.id, hacher(jeton));
    const lien = `${urlBase()}/connexion/lien?jeton=${jeton}`;
    await envoyerCourriel(
      u.email,
      "Votre lien de connexion à Folio GEA",
      [
        `Bonjour ${u.prenom},`,
        "",
        "Voici votre lien de connexion à Folio GEA, valable 20 minutes et à usage unique :",
        lien,
        "",
        "Si vous n'avez pas demandé cette connexion, ignorez simplement ce message.",
      ].join("\n"),
      gabaritCourrielHtml(`
        <p style="margin:0 0 16px;">Bonjour ${echapperHtml(u.prenom)},</p>
        <p style="margin:0 0 20px;">Voici votre lien de connexion, valable <strong>20 minutes</strong> et à usage unique :</p>
        ${boutonHtml(lien, "Se connecter à Folio GEA")}
        <p style="margin:20px 0 0;font-size:13px;color:#5d6878;">Si vous n'avez pas demandé cette connexion, ignorez simplement ce message.</p>
      `),
    );
    return;
  }

  // Adresse inconnue : invitation à créer un profil étudiant, si le domaine est autorisé.
  if (!domaineAutorise(courriel) || (await demandeInscriptionRecente(courriel))) return;
  const jeton = randomBytes(32).toString("hex");
  await creerJetonInscription(courriel, hacher(jeton));
  const lien = `${urlBase()}/connexion/creer-profil?jeton=${jeton}`;
  await envoyerCourriel(
    courriel,
    "Créez votre profil Folio GEA",
    [
      "Bonjour,",
      "",
      "Cette adresse n'est pas encore enregistrée dans Folio GEA. Si vous êtes étudiant·e en BUT GEA,",
      "le lien ci-dessous vous permet de créer votre profil (valable 20 minutes) :",
      lien,
      "",
      "Si vous êtes enseignant·e, contactez l'administrateur pour qu'il crée votre compte.",
      "Si vous n'avez pas demandé cette connexion, ignorez simplement ce message.",
    ].join("\n"),
    gabaritCourrielHtml(`
      <p style="margin:0 0 16px;">Bonjour,</p>
      <p style="margin:0 0 20px;">Cette adresse n'est pas encore enregistrée dans Folio GEA. Si vous êtes <strong>étudiant·e</strong> en BUT GEA, le lien ci-dessous vous permet de créer votre profil (valable 20 minutes) :</p>
      ${boutonHtml(lien, "Créer mon profil")}
      <p style="margin:20px 0 0;font-size:13px;color:#5d6878;">Si vous êtes enseignant·e, contactez l'administrateur pour qu'il crée votre compte.<br>Si vous n'avez pas demandé cette connexion, ignorez simplement ce message.</p>
    `),
  );
}

export async function connecterAvecJeton(jeton: string): Promise<Utilisateur | undefined> {
  if (!jeton) return undefined;
  return verifierEtConsommerJeton(hacher(jeton));
}

// Ne consomme pas le jeton : voir emailDuJetonInscription dans db.ts.
export async function emailDuJetonInscription(jeton: string): Promise<string | undefined> {
  if (!jeton) return undefined;
  const email = await dbEmailDuJetonInscription(hacher(jeton));
  // Filet de sécurité en cas de création concurrente du compte entre l'envoi du lien et son clic.
  if (email && (await emailExiste(email))) return undefined;
  return email;
}

export async function consommerJetonInscription(jeton: string): Promise<void> {
  if (!jeton) return;
  await dbConsommerJetonInscription(hacher(jeton));
}
