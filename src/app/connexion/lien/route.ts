import { NextResponse } from "next/server";
import { connecterAvecJeton } from "@/lib/lien-connexion";
import { COOKIE_SESSION } from "@/lib/session";

// Clic sur le lien reçu par mail : valide le jeton (existe, non expiré, non déjà utilisé) et ouvre
// la session si tout est bon. Le jeton est à usage unique : un deuxième clic (ou un lien partagé
// par erreur) échoue proprement.
export async function GET(requete: Request) {
  const url = new URL(requete.url);
  const jeton = url.searchParams.get("jeton") ?? "";
  const compte = await connecterAvecJeton(jeton);

  if (!compte || !compte.actif) {
    return NextResponse.redirect(new URL("/connexion?erreur=lien_invalide", url));
  }

  const destination = compte.role === "etudiant" ? `/portfolio/${compte.id}` : "/enseignant";
  const reponse = NextResponse.redirect(new URL(destination, url));
  reponse.cookies.set(COOKIE_SESSION, compte.id, { httpOnly: true, sameSite: "lax", path: "/" });
  return reponse;
}
