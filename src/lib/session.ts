import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { enregistrerSession, getUtilisateur, supprimerSession, utilisateurDeSession, type Utilisateur } from "./db";
import { urlPublique } from "./url-publique";

// Le cookie ne contient qu'un jeton aléatoire (impossible à deviner ou à fabriquer), jamais
// l'identifiant du compte : la base retrouve le compte à partir de l'empreinte de ce jeton.
// Se déconnecter supprime la session côté serveur : le jeton ne sert alors plus à rien, même copié.
// Le nom du cookie a changé avec ce fonctionnement : les anciens cookies sont simplement ignorés.
export const COOKIE_SESSION = "folio_session";
const DUREE_SESSION_MS = 7 * 24 * 60 * 60 * 1000;

const hacher = (jeton: string) => createHash("sha256").update(jeton).digest("hex");

// Options du cookie de session. `secure` (envoi en HTTPS uniquement) dès que l'adresse publique
// est en https:// ; pas en local (http://localhost), où le navigateur refuserait alors le cookie.
export function optionsCookieSession() {
  return { httpOnly: true, sameSite: "lax" as const, path: "/", secure: !!urlPublique()?.startsWith("https://") };
}

// Crée la session en base et renvoie le jeton à placer dans le cookie. Pour une route (réponse
// construite à la main), poser soi-même le cookie ; pour une Server Action, utiliser ouvrirSession.
export async function creerSession(utilisateurId: string): Promise<string> {
  const jeton = randomBytes(32).toString("hex");
  await enregistrerSession(hacher(jeton), utilisateurId, new Date(Date.now() + DUREE_SESSION_MS).toISOString());
  return jeton;
}

export async function ouvrirSession(utilisateurId: string) {
  const jeton = await creerSession(utilisateurId);
  (await cookies()).set(COOKIE_SESSION, jeton, optionsCookieSession());
}

export async function fermerSession() {
  const cookieStore = await cookies();
  const jeton = cookieStore.get(COOKIE_SESSION)?.value;
  if (jeton) await supprimerSession(hacher(jeton));
  cookieStore.delete(COOKIE_SESSION);
}

export async function utilisateurCourant(): Promise<Utilisateur | null> {
  const jeton = (await cookies()).get(COOKIE_SESSION)?.value;
  const u = jeton ? await utilisateurDeSession(hacher(jeton)) : undefined;
  // Un compte désactivé n'a plus accès à l'outil (ses données restent conservées).
  return u && u.actif ? u : null;
}

export function estEnseignant(u: Utilisateur | null): boolean {
  return u?.role === "enseignant" || u?.role === "admin";
}

export function estAdmin(u: Utilisateur | null): boolean {
  return u?.role === "admin";
}

// L'administrateur suit tous les étudiants ; un enseignant ne suit que ceux dont il est le référent.
export async function suitEtudiant(u: Utilisateur | null, etudiantId: string): Promise<boolean> {
  if (estAdmin(u)) return true;
  if (u?.role !== "enseignant") return false;
  return (await getUtilisateur(etudiantId))?.referent_id === u.id;
}

export async function peutConsulter(u: Utilisateur | null, etudiantId: string): Promise<boolean> {
  return !!u && (u.id === etudiantId || (await suitEtudiant(u, etudiantId)));
}

// Un étudiant ne modifie que son propre portfolio, pour son année en cours et les années passées.
export function peutModifier(u: Utilisateur | null, etudiantId: string, annee?: number): boolean {
  if (!u || u.role !== "etudiant" || u.id !== etudiantId) return false;
  return annee === undefined || annee <= (u.annee_but ?? 0);
}
