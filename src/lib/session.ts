import { cookies } from "next/headers";
import { getUtilisateur, type Utilisateur } from "./db";

// Connexion simulée pour la V1 : un cookie contient l'identifiant de l'utilisateur choisi.
// Sera remplacée par le CAS de l'université (identifiants ENT) à l'étape « connexion ».
export const COOKIE_SESSION = "folio_utilisateur";

export async function utilisateurCourant(): Promise<Utilisateur | null> {
  const id = (await cookies()).get(COOKIE_SESSION)?.value;
  const u = id ? getUtilisateur(id) : undefined;
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
export function suitEtudiant(u: Utilisateur | null, etudiantId: string): boolean {
  if (estAdmin(u)) return true;
  if (u?.role !== "enseignant") return false;
  return getUtilisateur(etudiantId)?.referent_id === u.id;
}

export function peutConsulter(u: Utilisateur | null, etudiantId: string): boolean {
  return !!u && (u.id === etudiantId || suitEtudiant(u, etudiantId));
}

// Un étudiant ne modifie que son propre portfolio, pour son année en cours et les années passées.
export function peutModifier(u: Utilisateur | null, etudiantId: string, annee?: number): boolean {
  if (!u || u.role !== "etudiant" || u.id !== etudiantId) return false;
  return annee === undefined || annee <= (u.annee_but ?? 0);
}
