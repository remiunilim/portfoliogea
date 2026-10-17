import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { EnTete } from "@/components/EnTete";
import { FormActivation, FormDefinirMotDePasse, FormModifierCompte, FormSuppression } from "@/components/admin";
import { cg2pEstActif, connexionParMotDePasseActive, getUtilisateur, historiqueCompte, listerEnseignants } from "@/lib/db";
import { estAdmin, utilisateurCourant } from "@/lib/session";
import { PARCOURS_GEA } from "@/lib/import-etudiants";

// Fiche d'un compte : modification, désactivation, suppression (administrateur).
export default async function FicheCompte(props: PageProps<"/admin/comptes/[id]">) {
  const u = await utilisateurCourant();
  if (!u) redirect("/connexion");
  if (!estAdmin(u)) redirect("/");
  const { id } = await props.params;
  const compte = await getUtilisateur(id);
  if (!compte) notFound();
  // CG2P reste proposé pour un compte déjà affecté à ce parcours, même désactivé entre-temps.
  const parcoursDisponibles =
    (await cg2pEstActif()) || compte.parcours === "CG2P" ? PARCOURS_GEA : PARCOURS_GEA.filter((p) => p !== "CG2P");
  const etudiant = compte.role === "etudiant";
  const h = await historiqueCompte(compte.id);
  const resume = etudiant
    ? `${h.argumentaires} argumentaire(s), ${h.traces} trace(s), ${h.evaluationsRecues} évaluation(s)`
    : `${h.evaluationsDonnees} évaluation(s), ${h.actionsJournal} action(s), ${h.etudiantsSuivis} étudiant(s) suivi(s)`;
  const lui = compte.id === u.id;
  const mdpActif = await connexionParMotDePasseActive();

  return (
    <>
      <EnTete utilisateur={u} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">
        <Link href="/admin/affectations" className="mb-3 inline-block text-sm text-primary hover:underline">
          ← Étudiants et affectations
        </Link>
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">
              {compte.prenom} {compte.nom}
            </h1>
            <p className="text-sm text-muted">
              {etudiant ? `Étudiant·e · BUT${compte.annee_but}` : compte.role === "admin" ? "Enseignant·e administrateur" : "Enseignant·e"} · {resume}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!compte.actif && <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-700">Compte désactivé</span>}
            {etudiant && (
              <Link href={`/portfolio/${compte.id}?onglet=complet`} className="rounded-md border border-line px-3 py-1.5 text-sm hover:bg-primary-soft">
                Voir le portfolio
              </Link>
            )}
          </div>
        </div>

        <section className="mb-6 rounded-xl border border-line bg-surface p-5">
          <h2 className="mb-3 text-base font-semibold">Informations</h2>
          <FormModifierCompte
            compte={{ ...compte }}
            enseignants={(await listerEnseignants()).map((e) => ({ id: e.id, nom: `${e.prenom} ${e.nom}` }))}
            parcours={parcoursDisponibles}
          />
        </section>

        {mdpActif && (
          <section className="mb-6 rounded-xl border border-line bg-surface p-5">
            <h2 className="mb-2 text-base font-semibold">Mot de passe</h2>
            <FormDefinirMotDePasse id={compte.id} nom={`${compte.prenom} ${compte.nom}`} />
          </section>
        )}

        {!lui && (
          <>
            <section className="mb-6 rounded-xl border border-line bg-surface p-5">
              <h2 className="mb-2 text-base font-semibold">{compte.actif ? "Désactiver" : "Réactiver"}</h2>
              <FormActivation id={compte.id} actif={!!compte.actif} role={compte.role} />
            </section>
            <section className="rounded-xl border border-red-200 bg-red-50/40 p-5">
              <h2 className="mb-2 text-base font-semibold text-red-800">Supprimer</h2>
              <FormSuppression id={compte.id} nom={compte.nom} role={compte.role} resume={resume} />
            </section>
          </>
        )}
      </main>
    </>
  );
}
