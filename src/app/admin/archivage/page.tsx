import Link from "next/link";
import { redirect } from "next/navigation";
import { EnTete } from "@/components/EnTete";
import { FormArchivage } from "@/components/admin";
import { listerEnseignants, listerEtudiants } from "@/lib/db";
import { estAdmin, utilisateurCourant } from "@/lib/session";

// Archivage (désactivation) ou suppression définitive, pour un·e étudiant·e ou une cohorte
// entière (filtrée par année de BUT, référent ou nom) — réservé à l'administrateur.
export default async function Archivage() {
  const u = await utilisateurCourant();
  if (!u) redirect("/connexion");
  if (!estAdmin(u)) redirect("/");
  const enseignants = await listerEnseignants();
  const nomEns = new Map(enseignants.map((e) => [e.id, `${e.prenom} ${e.nom}`]));
  const etudiants = (await listerEtudiants()).map((e) => ({
    id: e.id,
    nom: `${e.nom} ${e.prenom}`,
    annee: e.annee_but ?? 1,
    parcours: e.parcours ?? "GEMA",
    groupe: e.groupe ?? "",
    referent: e.referent_id ? (nomEns.get(e.referent_id) ?? "") : "",
    referentId: e.referent_id ?? "",
  }));

  return (
    <>
      <EnTete utilisateur={u} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        <Link href="/admin/affectations" className="mb-3 inline-block text-sm text-primary hover:underline">
          ← Étudiants et affectations
        </Link>
        <h1 className="text-2xl font-semibold">Archivage et suppression</h1>
        <p className="mb-6 max-w-3xl text-sm text-muted">
          Filtrez par année de BUT pour viser une cohorte entière, ou recherchez un·e étudiant·e en particulier, puis
          choisissez d&apos;archiver (sortie de formation, données conservées) ou de supprimer définitivement (irréversible).
          Les comptes désactivés ici restent gérables individuellement sur la fiche de chaque compte.
        </p>
        <FormArchivage etudiants={etudiants} enseignants={enseignants.map((e) => ({ id: e.id, nom: `${e.prenom} ${e.nom}` }))} />
      </main>
    </>
  );
}
