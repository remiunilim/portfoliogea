import Link from "next/link";
import { BoutonTheme } from "@/components/BoutonTheme";
import { FormCreerProfil } from "@/components/connexion";
import { COOKIE_THEME, lireTheme } from "@/lib/theme";
import { cg2pEstActif, listerEnseignants } from "@/lib/db";
import { emailDuJetonInscription } from "@/lib/lien-connexion";
import { PARCOURS_GEA } from "@/lib/import-etudiants";
import { cookies } from "next/headers";

// Formulaire de création d'un profil étudiant, atteint depuis le lien d'inscription envoyé par
// mail (voir /connexion et src/lib/lien-connexion.ts). Le jeton prouve que la personne possède
// bien cette adresse ; le compte n'est créé qu'à la soumission du formulaire (creerProfilEtudiantAction).
export default async function CreerProfil(props: PageProps<"/connexion/creer-profil">) {
  const { jeton } = await props.searchParams;
  const theme = lireTheme((await cookies()).get(COOKIE_THEME)?.value);
  const jetonTexte = typeof jeton === "string" ? jeton : "";
  const email = jetonTexte ? await emailDuJetonInscription(jetonTexte) : undefined;

  return (
    <main className="mx-auto w-full max-w-md px-4 py-16 sm:px-6">
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

      {!email ? (
        <>
          <p className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            Ce lien n&apos;est plus valable (déjà utilisé, ou expiré après 20 minutes).
          </p>
          <Link href="/connexion" className="text-sm text-primary hover:underline">
            ← Retour à la connexion
          </Link>
        </>
      ) : (
        <>
          <h2 className="mb-1 text-lg font-semibold">Créer mon profil étudiant</h2>
          <p className="mb-6 text-sm text-muted">
            Adresse vérifiée : <strong>{email}</strong>. Cette page est réservée aux étudiant·e·s : un·e enseignant·e a
            besoin d&apos;un compte créé par l&apos;administrateur.
          </p>
          <FormCreerProfil
            jeton={jetonTexte}
            enseignants={(await listerEnseignants()).map((e) => ({ id: e.id, nom: `${e.prenom} ${e.nom}` }))}
            parcours={(await cg2pEstActif()) ? PARCOURS_GEA : PARCOURS_GEA.filter((p) => p !== "CG2P")}
          />
        </>
      )}
    </main>
  );
}
