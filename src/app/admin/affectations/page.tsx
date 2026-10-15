import { redirect } from "next/navigation";
import { EnTete } from "@/components/EnTete";
import { FormAjoutEnseignant, FormAjoutEtudiant, FormImport } from "@/components/admin";
import { affecterReferent } from "@/app/actions";
import Link from "next/link";
import { compterCourrielsEnAttente, listerComptesDesactives, listerEnseignants, listerEtudiants } from "@/lib/db";
import { estAdmin, utilisateurCourant } from "@/lib/session";
import { ANNEES } from "@/lib/referentiel";
import { PARCOURS_GEA } from "@/lib/import-etudiants";

// Gestion des étudiants (import, ajout) et des affectations aux référents (réservé à l'administrateur).
export default async function Affectations() {
  const u = await utilisateurCourant();
  if (!u) redirect("/connexion");
  if (!estAdmin(u)) redirect("/");
  const enseignants = listerEnseignants();
  const etudiants = listerEtudiants();
  const nbSuivis = (id: string) => etudiants.filter((e) => e.referent_id === id).length;
  const sansReferent = etudiants.filter((e) => !e.referent_id).length;
  const desactives = listerComptesDesactives();
  const courriels = compterCourrielsEnAttente();

  return (
    <>
      <EnTete utilisateur={u} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold">Étudiants et affectations</h1>
          <Link href="/admin/passage" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90">
            Passage d&apos;année et réaffectations groupées
          </Link>
        </div>
        <p className="mb-2 text-sm text-muted">
          Importez les listes d&apos;étudiants, ajoutez des comptes et affectez chaque étudiant·e à son enseignant·e référent·e, seul·e
          (avec l&apos;administrateur) à voir et évaluer son portfolio.
        </p>
        <p className="mb-6 text-xs text-muted">
          Courriels en attente d&apos;envoi : {courriels.immediat} immédiat(s), {courriels.quotidien} pour le récapitulatif quotidien · envoi
          activé une fois la messagerie de l&apos;université branchée.
        </p>

        <section className="mb-6 rounded-xl border border-line bg-surface p-5">
          <h2 className="mb-1 text-base font-semibold">Importer une liste d&apos;étudiants</h2>
          <p className="mb-4 text-sm text-muted">
            Colonnes attendues : <strong>Nom, Prénom, Email étudiant, Année, Parcours, Enseignant référent, Email enseignant</strong>{" "}
            (Groupe facultatif). Les adresses servent aux notifications. Les étudiants déjà présents sont mis à jour, les autres sont
            créés ; un aperçu s&apos;affiche avant toute modification.
          </p>
          <FormImport />
        </section>

        <div className="mb-6 grid gap-6 lg:grid-cols-2">
          <section className="rounded-xl border border-line bg-surface p-5">
            <h2 className="mb-3 text-base font-semibold">Ajouter un·e étudiant·e</h2>
            <FormAjoutEtudiant enseignants={enseignants.map((e) => ({ id: e.id, nom: `${e.prenom} ${e.nom}` }))} parcours={PARCOURS_GEA} />
          </section>
          <section className="rounded-xl border border-line bg-surface p-5">
            <h2 className="mb-3 text-base font-semibold">Ajouter un·e enseignant·e</h2>
            <FormAjoutEnseignant />
          </section>
        </div>

        <h2 className="mb-1 text-lg font-semibold">Affectations</h2>
        <p className="mb-3 text-xs text-muted">Cliquez sur un nom (enseignant ou étudiant) pour modifier, désactiver ou supprimer le compte.</p>
        <div className="mb-4 flex flex-wrap gap-2 text-sm">
          {enseignants.map((e) => (
            <Link key={e.id} href={`/admin/comptes/${e.id}`} className="rounded-full border border-line bg-surface px-3 py-1 hover:border-primary hover:bg-primary-soft">
              {e.prenom} {e.nom}
              {e.role === "admin" && " (admin)"} · <strong>{nbSuivis(e.id)}</strong> étudiant{nbSuivis(e.id) > 1 ? "s" : ""}
            </Link>
          ))}
          <span className={`rounded-full border px-3 py-1 ${sansReferent ? "border-amber-200 bg-amber-50 text-amber-900" : "border-line bg-surface"}`}>
            Sans référent · <strong>{sansReferent}</strong>
          </span>
        </div>

        <div className="space-y-6">
          {ANNEES.map((a) => {
            const promo = etudiants.filter((e) => e.annee_but === a);
            return (
              <section key={a} className="overflow-x-auto rounded-xl border border-line bg-surface">
                <h2 className="border-b border-line px-4 py-3 font-semibold">
                  BUT{a} <span className="text-sm font-normal text-muted">({promo.length})</span>
                </h2>
                <table className="w-full min-w-[560px] text-sm">
                  <tbody>
                    {promo.length === 0 && (
                      <tr>
                        <td className="px-4 py-4 text-muted">Aucun étudiant.</td>
                      </tr>
                    )}
                    {promo.map((e) => (
                      <tr key={e.id} className="border-b border-line last:border-0">
                        <td className="px-4 py-2.5">
                          <Link href={`/admin/comptes/${e.id}`} className="font-medium hover:text-primary hover:underline" title="Modifier, désactiver ou supprimer">
                            {e.nom} {e.prenom}
                          </Link>
                          <div className="text-xs text-muted">
                            {[e.parcours, e.groupe, e.email.endsWith(".a-renseigner") ? "email à renseigner" : e.email].filter(Boolean).join(" · ")}
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <form action={affecterReferent} className="flex items-center justify-end gap-2">
                            <input type="hidden" name="etudiant" value={e.id} />
                            <select
                              name="referent"
                              defaultValue={e.referent_id ?? ""}
                              aria-label={`Référent de ${e.prenom} ${e.nom}`}
                              className="rounded-md border border-line bg-surface px-2 py-1.5"
                            >
                              <option value="">Sans référent</option>
                              {enseignants.map((ens) => (
                                <option key={ens.id} value={ens.id}>
                                  {ens.prenom} {ens.nom}
                                </option>
                              ))}
                            </select>
                            <button className="rounded-md border border-line px-3 py-1.5 hover:bg-primary-soft">Enregistrer</button>
                          </form>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            );
          })}
        </div>

        {desactives.length > 0 && (
          <section className="mt-8">
            <h2 className="mb-1 text-lg font-semibold">Comptes désactivés ({desactives.length})</h2>
            <p className="mb-3 text-xs text-muted">Plus d&apos;accès à l&apos;outil ; les portfolios et l&apos;historique sont conservés.</p>
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface text-sm">
              {desactives.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                  <span>
                    <Link href={`/admin/comptes/${d.id}`} className="font-medium hover:text-primary hover:underline">
                      {d.nom} {d.prenom}
                    </Link>
                    <span className="text-muted"> · {d.role === "etudiant" ? `étudiant·e, BUT${d.annee_but}` : "enseignant·e"}</span>
                  </span>
                  <Link href={`/admin/comptes/${d.id}`} className="text-xs text-primary hover:underline">
                    Réactiver ou supprimer
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </>
  );
}
