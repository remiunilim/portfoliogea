import { connection } from "next/server";
import { cookies } from "next/headers";
import { BoutonTheme } from "@/components/BoutonTheme";
import { FormConnexionEmail } from "@/components/connexion";
import { COOKIE_THEME, lireTheme } from "@/lib/theme";

const MESSAGES_ERREUR: Record<string, string> = {
  lien_invalide: "Ce lien de connexion n'est plus valable (déjà utilisé, ou expiré après 20 minutes). Demandez-en un nouveau ci-dessous.",
};

// Connexion par lien envoyé par mail (sans mot de passe ni SSO universitaire) : on saisit son
// adresse mail, on reçoit un lien à usage unique valable 20 minutes (voir src/lib/lien-connexion.ts
// et /connexion/lien).
export default async function Connexion(props: PageProps<"/connexion">) {
  await connection();
  const { erreur } = await props.searchParams;
  const theme = lireTheme((await cookies()).get(COOKIE_THEME)?.value);

  return (
    <main className="mx-auto w-full max-w-md px-4 py-24 sm:px-6">
      <div className="mb-8 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-lg bg-primary text-lg font-bold text-white">F</span>
        <div>
          <h1 className="text-2xl font-semibold">Folio GEA</h1>
          <p className="text-sm text-muted">Portfolio de compétences du BUT GEA</p>
        </div>
        <div className="ml-auto">
          <BoutonTheme initial={theme} />
        </div>
      </div>
      {typeof erreur === "string" && MESSAGES_ERREUR[erreur] && (
        <p className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">{MESSAGES_ERREUR[erreur]}</p>
      )}
      <p className="mb-6 text-sm text-muted">
        Saisissez votre adresse mail universitaire : si votre compte existe dans Folio GEA, vous recevrez un lien de
        connexion valable 20 minutes.
      </p>
      <FormConnexionEmail />
    </main>
  );
}
