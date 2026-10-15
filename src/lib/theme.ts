// Thème d'affichage choisi par l'utilisateur (clair par défaut), mémorisé dans un cookie d'un an.
export const COOKIE_THEME = "folio_theme";
export type Theme = "light" | "dark";

export function lireTheme(valeurCookie: string | undefined): Theme {
  return valeurCookie === "dark" ? "dark" : "light";
}
