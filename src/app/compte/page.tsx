import { redirect } from "next/navigation";
import { EnTete } from "@/components/EnTete";
import { FormPreferences } from "@/components/admin";
import { envoiMailsActif, getUtilisateur, listerEtudiants } from "@/lib/db";
import { estEnseignant, utilisateurCourant } from "@/lib/session";

export default async function MonCompte() {
  const u = await utilisateurCourant();
  if (!u) redirect("/connexion");
  const enseignant = estEnseignant(u);
  const referent = u.referent_id ? await getUtilisateur(u.referent_id) : undefined;
  const nbSuivis = enseignant ? (await listerEtudiants({ referentId: u.id })).length : 0;
  const emailProvisoire = u.email.endsWith(".a-renseigner");
  const mailsActifs = await envoiMailsActif();

  return (
    <>
      <EnTete utilisateur={u} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-semibold">Mon compte</h1>
        <p className="mb-6 text-sm text-muted">
          {u.prenom} {u.nom} · {emailProvisoire ? "adresse mail à renseigner par l'administrateur" : u.email}
          {u.role === "etudiant" && ` · BUT${u.annee_but} · parcours ${u.parcours ?? "GEMA"}${referent ? ` · référent·e : ${referent.prenom} ${referent.nom}` : ""}`}
          {enseignant && ` · référent·e de ${nbSuivis} étudiant${nbSuivis > 1 ? "s" : ""}`}
        </p>

        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="mb-1 text-base font-semibold">Notifications par courriel</h2>
          <p className="mb-4 text-sm text-muted">
            {enseignant
              ? "Vous êtes prévenu·e dans l'outil (cloche) quand un de vos étudiants dépose ou modifie un argumentaire, une trace ou sa présentation. Choisissez si vous voulez aussi un courriel."
              : "Vous êtes prévenu·e dans l'outil (cloche) quand une évaluation est publiée. Choisissez si vous voulez aussi un courriel."}
          </p>
          {emailProvisoire && (
            <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Aucune adresse mail n&apos;est encore enregistrée pour vous : aucun courriel ne pourra être envoyé, et vous ne
              pourrez pas vous reconnecter une fois votre session actuelle terminée (la connexion se fait par lien envoyé
              par mail). Demandez à l&apos;administrateur de la renseigner sur votre fiche de compte.
            </p>
          )}
          {mailsActifs ? (
            <FormPreferences preference={u.pref_courriel} enseignant={enseignant} />
          ) : (
            <p className="rounded-md bg-slate-100 px-3 py-2 text-sm text-slate-700">
              L&apos;envoi des courriels est temporairement désactivé par l&apos;administrateur : personne n&apos;en reçoit pour
              l&apos;instant, ce réglage est donc pour le moment indisponible.
            </p>
          )}
        </section>

      </main>
    </>
  );
}
