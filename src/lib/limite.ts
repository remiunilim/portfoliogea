import { headers } from "next/headers";

// Limitation du nombre de tentatives (connexion par mot de passe, demandes de lien de connexion),
// pour freiner un robot sans gêner les vrais utilisateurs. Compteurs en mémoire du serveur : un
// seul processus Node (service systemd), remis à zéro à chaque redémarrage, ce qui suffit ici.
//
// Seuils volontairement larges : à l'université, toute une salle de TD sort souvent sur internet
// par la même adresse IP.

type Compteur = { fin: number; nombre: number };
const globalPourLimites = globalThis as unknown as { __limitesFolio?: Map<string, Compteur> };

function compteurs(): Map<string, Compteur> {
  if (!globalPourLimites.__limitesFolio) globalPourLimites.__limitesFolio = new Map();
  return globalPourLimites.__limitesFolio;
}

function compteurActif(cle: string): Compteur | undefined {
  const c = compteurs().get(cle);
  if (c && c.fin <= Date.now()) {
    compteurs().delete(cle);
    return undefined;
  }
  return c;
}

// Vrai si `maximum` tentatives ont déjà été comptées pour cette clé dans la fenêtre en cours.
export function tentativesEpuisees(cle: string, maximum: number): boolean {
  return (compteurActif(cle)?.nombre ?? 0) >= maximum;
}

// Compte une tentative ; la fenêtre démarre à la première tentative de la série.
export function compterTentative(cle: string, fenetreMs: number) {
  const map = compteurs();
  // Ménage de temps en temps, pour ne pas garder indéfiniment des compteurs expirés.
  if (map.size > 5000) for (const [k, c] of map) if (c.fin <= Date.now()) map.delete(k);
  const c = compteurActif(cle);
  if (c) c.nombre++;
  else map.set(cle, { fin: Date.now() + fenetreMs, nombre: 1 });
}

export function oublierTentatives(cle: string) {
  compteurs().delete(cle);
}

// Adresse IP de la personne. Derrière Apache, c'est la DERNIÈRE adresse de X-Forwarded-For, celle
// qu'Apache a lui-même ajoutée : les précédentes peuvent être inventées par le navigateur.
export async function adresseClient(): Promise<string> {
  const liste = (await headers())
    .get("x-forwarded-for")
    ?.split(",")
    .map((a) => a.trim())
    .filter(Boolean);
  return liste?.at(-1) || "locale";
}
