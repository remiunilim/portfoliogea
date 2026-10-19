import * as client from "openid-client";

// Connexion SSO OpenID Connect (identifiants de l'université), à la place du CAS historique.
// Réglages dans .env.local (voir .env.example) : OIDC_ISSUER, OIDC_CLIENT_ID, OIDC_CLIENT_SECRET,
// OIDC_REDIRECT_URI (doit correspondre exactement à l'URL déclarée auprès de la DSI).
// Sans ces variables, l'application reste en mode démonstration (choix d'un compte fictif).

export const COOKIE_OIDC_ETAT = "folio_oidc_etat";

export function oidcConfigure(): boolean {
  return !!(process.env.OIDC_ISSUER && process.env.OIDC_CLIENT_ID && process.env.OIDC_CLIENT_SECRET && process.env.OIDC_REDIRECT_URI);
}

type EtatOidc = { codeVerifier: string; state: string; nonce: string };

const globalPourOidc = globalThis as unknown as { __oidcConfig?: Promise<client.Configuration> };

function configuration(): Promise<client.Configuration> {
  if (!globalPourOidc.__oidcConfig) {
    const issuer = new URL(process.env.OIDC_ISSUER!);
    // En développement, le fournisseur de test tourne en http:// (sans certificat) sur localhost.
    const options = issuer.protocol === "http:" ? { execute: [client.allowInsecureRequests] } : undefined;
    globalPourOidc.__oidcConfig = client.discovery(
      issuer,
      process.env.OIDC_CLIENT_ID!,
      process.env.OIDC_CLIENT_SECRET!,
      undefined,
      options,
    );
  }
  return globalPourOidc.__oidcConfig;
}

// Prépare l'aller vers le fournisseur d'identité : URL à suivre, et l'état (PKCE, state, nonce)
// à conserver le temps de l'aller-retour (dans un cookie signé par le navigateur, voir la route).
export async function demarrerConnexionOidc(): Promise<{ url: string; etat: EtatOidc }> {
  const config = await configuration();
  const codeVerifier = client.randomPKCECodeVerifier();
  const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
  const state = client.randomState();
  const nonce = client.randomNonce();

  const url = client.buildAuthorizationUrl(config, {
    redirect_uri: process.env.OIDC_REDIRECT_URI!,
    scope: process.env.OIDC_SCOPE || "openid email profile",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
    nonce,
  });

  return { url: url.href, etat: { codeVerifier, state, nonce } };
}

export type IdentiteOidc = { identifiant: string; email: string | undefined };

// Échange le code reçu contre les informations de l'utilisateur. Lève une erreur si l'échange
// échoue (code expiré, state ou nonce invalide, etc.) : à l'appelant de rediriger proprement.
export async function terminerConnexionOidc(urlCourante: URL, etat: EtatOidc): Promise<IdentiteOidc> {
  const config = await configuration();
  // openid-client renvoie au fournisseur l'adresse de retour déduite de l'URL courante : derrière
  // Apache, Next.js peut la voir en http://localhost:3000, ce que le fournisseur refuserait. On
  // repart donc de l'adresse déclarée (OIDC_REDIRECT_URI), avec les paramètres reçus.
  const urlRetour = new URL(process.env.OIDC_REDIRECT_URI!);
  urlRetour.search = urlCourante.search;
  const tokens = await client.authorizationCodeGrant(config, urlRetour, {
    pkceCodeVerifier: etat.codeVerifier,
    expectedState: etat.state,
    expectedNonce: etat.nonce,
  });
  const claims = tokens.claims();
  if (!claims) throw new Error("Le fournisseur n'a renvoyé aucune information sur l'utilisateur.");
  return {
    identifiant: String(claims.sub),
    email: typeof claims.email === "string" ? claims.email : undefined,
  };
}
