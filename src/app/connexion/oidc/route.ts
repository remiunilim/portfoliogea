import { NextResponse } from "next/server";
import { COOKIE_OIDC_ETAT, demarrerConnexionOidc, oidcConfigure } from "@/lib/oidc";

// Démarre la connexion SSO : redirige vers le fournisseur d'identité de l'université.
export async function GET(requete: Request) {
  if (!oidcConfigure()) return new Response("SSO non configuré.", { status: 404 });
  const { url, etat } = await demarrerConnexionOidc();
  const reponse = NextResponse.redirect(url);
  reponse.cookies.set(COOKIE_OIDC_ETAT, JSON.stringify(etat), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 300,
    secure: new URL(requete.url).protocol === "https:",
  });
  return reponse;
}
