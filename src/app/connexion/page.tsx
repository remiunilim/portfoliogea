import { seConnecter } from "@/app/actions";
import { connection } from "next/server";
import { cookies } from "next/headers";
import { BoutonTheme } from "@/components/BoutonTheme";
import { FormConnexionMotDePasse } from "@/components/connexion";
import { COOKIE_THEME, lireTheme } from "@/lib/theme";
import { connexionParMotDePasseActive, listerUtilisateurs } from "@/lib/db";
import { oidcConfigure } from "@/lib/oidc";

const MESSAGES_ERREUR: Record<string, string> = {
  expire: "La connexion a expiré, merci de réessayer.",
  echec: "La connexion a échoué. Merci de réessayer.",
  inconnu:
    "Ce compte universitaire n'est pas encore configuré dans Folio GEA. Contactez l'administrateur pour qu'il vous ajoute (ou importe votre promotion).",
};

export default async function Connexion(props: PageProps<"/connexion">) {
  await connection();
  const { erreur } = await props.searchParams;
  const theme = lireTheme((await cookies()).get(COOKIE_THEME)?.value);

  if (oidcConfigure()) {
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
        <a
          href="/connexion/oidc"
          className="block w-full rounded-lg bg-primary px-4 py-3 text-center font-medium text-white hover:opacity-90"
        >
          Se connecter avec le compte de l&apos;université
        </a>
      </main>
    );
  }

  if (await connexionParMotDePasseActive()) {
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
        <p className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          Connexion transitoire par mot de passe, en attendant le SSO de l&apos;université. Mot de passe oublié ou jamais
          reçu : contactez l&apos;administrateur.
        </p>
        <FormConnexionMotDePasse />
      </main>
    );
  }

  const utilisateurs = await listerUtilisateurs();
  const enseignants = utilisateurs.filter((u) => u.role !== "etudiant");
  const etudiants = utilisateurs.filter((u) => u.role === "etudiant");

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
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

      <div className="mb-8 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <strong>Mode démonstration.</strong> La connexion avec les identifiants de l&apos;université (OpenID Connect) sera
        branchée une fois les réglages reçus de la DSI (voir <code>OIDC_ISSUER</code> dans <code>.env.example</code>).
        Choisissez un compte fictif pour tester l&apos;outil.
      </div>

      <form action={seConnecter} className="space-y-8">
        <Groupe titre="Enseignants" comptes={enseignants.map((u) => ({ id: u.id, nom: `${u.prenom} ${u.nom}`, detail: u.role === "admin" ? "Administrateur" : "Enseignant" }))} />
        <Groupe titre="Étudiants" comptes={etudiants.map((u) => ({ id: u.id, nom: `${u.prenom} ${u.nom}`, detail: `BUT${u.annee_but} · ${u.groupe}` }))} />
      </form>
    </main>
  );
}

function Groupe({ titre, comptes }: { titre: string; comptes: { id: string; nom: string; detail: string }[] }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{titre}</h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {comptes.map((c) => (
          <button
            key={c.id}
            name="utilisateur"
            value={c.id}
            className="flex items-center justify-between rounded-lg border border-line bg-surface px-4 py-3 text-left hover:border-primary hover:bg-primary-soft"
          >
            <span className="font-medium">{c.nom}</span>
            <span className="text-xs text-muted">{c.detail}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
