import Link from "next/link";
import { redirect } from "next/navigation";
import { EnTete } from "@/components/EnTete";
import { FormImportDonnees } from "@/components/transfert";
import { estAdmin, utilisateurCourant } from "@/lib/session";

// Transfert de toutes les données (comptes, portfolios, évaluations) vers ou depuis une autre
// instance de Folio GEA — ex. de cette version vers celle de la DSI une fois déployée.
export default async function Transfert() {
  const u = await utilisateurCourant();
  if (!u) redirect("/connexion");
  if (!estAdmin(u)) redirect("/");

  return (
    <>
      <EnTete utilisateur={u} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6 sm:px-6">
        <Link href="/admin/affectations" className="mb-3 inline-block text-sm text-primary hover:underline">
          ← Étudiants et affectations
        </Link>
        <h1 className="mb-1 text-2xl font-semibold">Transfert entre instances</h1>
        <p className="mb-6 text-sm text-muted">
          Pour copier tous les comptes et portfolios (étudiants, enseignants, présentations, argumentaires, traces,
          évaluations, rendez-vous, journal) vers une autre installation de Folio GEA — par exemple de cette version
          vers celle de la DSI une fois déployée, ou inversement.
        </p>

        <section className="mb-6 rounded-xl border border-line bg-surface p-5">
          <h2 className="mb-2 text-base font-semibold">Exporter</h2>
          <p className="mb-4 text-sm text-muted">
            Télécharge un fichier .zip contenant toutes les données de cette instance (comptes actifs et désactivés,
            PDF déposés compris).
          </p>
          <a
            href="/admin/transfert/export"
            className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Télécharger l&apos;export (.zip)
          </a>
        </section>

        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="mb-2 text-base font-semibold">Importer</h2>
          <p className="mb-4 text-sm text-muted">
            Choisissez un fichier .zip exporté depuis une autre instance de Folio GEA. Les comptes déjà présents ici
            (même adresse mail) sont reconnus et <strong>jamais écrasés</strong> ; seuls les comptes, portfolios et
            évaluations absents sont ajoutés, sans rien dupliquer.
          </p>
          <FormImportDonnees />
        </section>
      </main>
    </>
  );
}
