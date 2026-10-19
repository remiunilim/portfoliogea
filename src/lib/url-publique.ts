// Adresse publique de l'application (APP_BASE_URL dans .env.local), pour tout lien absolu : lien
// envoyé par mail, redirection après un clic sur ce lien, lien des notifications par courriel.
//
// On ne se fie pas à l'adresse de la requête reçue : derrière Apache, Next.js peut la voir comme
// http://127.0.0.1:3000 ou http://localhost:3000 selon le relais, ce qui renverrait la personne vers
// sa propre machine ; et un en-tête Host forgé pourrait détourner un lien de connexion.

const HOTES_LOCAUX = ["localhost", "127.0.0.1", "[::1]"];
let avertissementDonne = false;

export function urlPublique(): string | undefined {
  const brute = process.env.APP_BASE_URL?.trim();
  if (!brute) return undefined;
  const url = brute.replace(/\/+$/, "");
  // Erreur classique : .env.local recopié de .env.example sans changer APP_BASE_URL. Les liens des
  // mails pointent alors vers l'ordinateur de la personne qui clique, pas vers le serveur.
  if (process.env.NODE_ENV === "production" && !avertissementDonne) {
    try {
      if (HOTES_LOCAUX.includes(new URL(url).hostname)) {
        avertissementDonne = true;
        console.error(
          `APP_BASE_URL vaut ${url} : les liens envoyés par mail mèneront vers localhost. ` +
            "Renseigner l'adresse publique réelle dans .env.local (ex. https://folio-gea.exemple.fr), puis redémarrer le service.",
        );
      }
    } catch {
      console.error(`APP_BASE_URL n'est pas une adresse valide : ${url}`);
    }
  }
  return url;
}

// Chemin relatif de l'outil (ex. /portfolio/abc) -> adresse complète, cliquable depuis un mail.
// Sans APP_BASE_URL, le chemin est laissé tel quel (comportement précédent).
export function lienAbsolu(chemin: string): string {
  const base = urlPublique();
  return base && chemin.startsWith("/") ? `${base}${chemin}` : chemin;
}
