import { cookies } from "next/headers";
import { getUtilisateur, type Utilisateur } from "./db";

// Le cookie contient l'identifiant de l'utilisateur, qu'il vienne du choix d'un compte fictif
// (mode démonstration, `/connexion`) ou d'une vraie connexion SSO (`/connexion/oidc/callback`).
export const COOKIE_SESSION = "folio_utilisateur";

export async function utilisateurCourant(): Promise<Utilisateur | null> {
  const id = (await cookies()).get(COOKIE_SESSION)?.value;
  const u = id ? await getUtilisateur(id) : undefined;
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
