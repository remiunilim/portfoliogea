import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_OIDC_ETAT, terminerConnexionOidc } from "@/lib/oidc";
import { COOKIE_SESSION } from "@/lib/session";
import { getUtilisateurParEmail, getUtilisateurParOidc, lierIdentifiantOidc } from "@/lib/db";

// Retour du fournisseur d'identité : valide l'échange, retrouve le compte (lié ou reconnu par
// email) et ouvre la session. Les comptes sont créés par l'administrateur (import ou ajout
// manuel) : un identifiant OpenID Connect sans compte correspondant n'est pas auto-provisionné.
export async function GET(requete: Request) {
  const url = new URL(requete.url);
  const cookieStore = await cookies();
  const brut = cookieStore.get(COOKIE_OIDC_ETAT)?.value;
  if (!brut) return NextResponse.redirect(new URL("/connexion?erreur=expire", url));

  let identite;
  try {
    const etat = JSON.parse(brut);
    identite = await terminerConnexionOidc(url, etat);
  } catch {
    const reponse = NextResponse.redirect(new URL("/connexion?erreur=echec", url));
    reponse.cookies.delete(COOKIE_OIDC_ETAT);
    return reponse;
  }

  let compte = await getUtilisateurParOidc(identite.identifiant);
  if (!compte && identite.email) {
    compte = await getUtilisateurParEmail(identite.email);
    if (compte) await lierIdentifiantOidc(compte.id, identite.identifiant);
  }

  if (!compte || !compte.actif) {
    const reponse = NextResponse.redirect(new URL("/connexion?erreur=inconnu", url));
    reponse.cookies.delete(COOKIE_OIDC_ETAT);
    return reponse;
  }

  const destination = compte.role === "etudiant" ? `/portfolio/${compte.id}` : "/enseignant";
  const reponse = NextResponse.redirect(new URL(destination, url));
  reponse.cookies.set(COOKIE_SESSION, compte.id, { httpOnly: true, sameSite: "lax", path: "/" });
  reponse.cookies.delete(COOKIE_OIDC_ETAT);
  return reponse;
}
