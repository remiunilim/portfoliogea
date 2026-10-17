import { randomBytes, timingSafeEqual } from "node:crypto";
import { scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";

// Connexion par mot de passe, en attendant le SSO OpenID Connect de l'université (voir
// src/lib/oidc.ts) : solution transitoire pour un déploiement avec de vrais comptes avant que
// le SSO ne soit branché. Mots de passe hachés (scrypt, module natif de Node, sel aléatoire par
// compte) ; jamais stockés ni journalisés en clair.

const scrypt = promisify(scryptCallback);
const TAILLE_CLE = 64;

export async function hacherMotDePasse(motDePasse: string): Promise<string> {
  const sel = randomBytes(16).toString("hex");
  const cle = (await scrypt(motDePasse, sel, TAILLE_CLE)) as Buffer;
  return `${sel}:${cle.toString("hex")}`;
}

export async function verifierMotDePasse(motDePasse: string, hachage: string | null): Promise<boolean> {
  if (!hachage) return false;
  const [sel, cleAttendue] = hachage.split(":");
  if (!sel || !cleAttendue) return false;
  const cle = (await scrypt(motDePasse, sel, TAILLE_CLE)) as Buffer;
  const attendue = Buffer.from(cleAttendue, "hex");
  if (cle.length !== attendue.length) return false;
  return timingSafeEqual(cle, attendue);
}
