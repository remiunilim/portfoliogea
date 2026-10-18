import { randomBytes, createHash } from "node:crypto";
import { creerJetonConnexion, demandeRecente, getUtilisateurParEmail, verifierEtConsommerJeton, type Utilisateur } from "./db";
import { envoyerCourriel } from "./mail";

// Connexion par lien envoyé par mail, sans mot de passe ni SSO (adaptation pour un hébergement
// hors DSI, ex. OVH) : la personne saisit son adresse mail universitaire, reçoit un lien valable
// 20 minutes et à usage unique qui ouvre directement sa session. Les comptes sont créés par
// l'administrateur (import Excel ou ajout manuel, comme avant) : une adresse inconnue de Folio GEA
// ne crée pas de compte à la volée, elle est seulement reconnue si elle existe déjà.
// L'envoi est volontairement en dehors du coupe-circuit « Envoi des courriels » (page Étudiants et
// affectations) : ce réglage ne concerne que les notifications, pas la connexion elle-même.

const hacher = (jeton: string) => createHash("sha256").update(jeton).digest("hex");

function urlBase(): string {
  const url = process.env.APP_BASE_URL;
  if (!url) throw new Error("APP_BASE_URL n'est pas renseignée (voir .env.example).");
  return url.replace(/\/$/, "");
}

// Toujours silencieux si l'adresse est inconnue ou le compte désactivé : l'appelant affiche le même
// message de confirmation dans tous les cas, pour ne pas révéler quelles adresses sont enregistrées.
export async function envoyerLienConnexion(email: string): Promise<void> {
  const u = await getUtilisateurParEmail(email.trim());
  if (!u || !u.actif) return;
  if (await demandeRecente(u.id)) return;

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
  );
}

export async function connecterAvecJeton(jeton: string): Promise<Utilisateur | undefined> {
  if (!jeton) return undefined;
  return verifierEtConsommerJeton(hacher(jeton));
}
