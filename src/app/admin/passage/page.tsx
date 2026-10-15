import Link from "next/link";
import { redirect } from "next/navigation";
import { EnTete } from "@/components/EnTete";
import { FormPassage } from "@/components/admin";
import { listerEnseignants, listerEtudiants } from "@/lib/db";
import { estAdmin, utilisateurCourant } from "@/lib/session";
import { PARCOURS_GEA } from "@/lib/import-etudiants";

// Passage d'année et réaffectations sur une sélection d'étudiants (ex. BUT1 → BUT2 avec choix du parcours).
export default async function Passage() {
  const u = await utilisateurCourant();
  if (!u) redirect("/connexion");
  if (!estAdmin(u)) redirect("/");
  const enseignants = listerEnseignants();
  const nomEns = new Map(enseignants.map((e) => [e.id, `${e.prenom} ${e.nom}`]));
  const etudiants = listerEtudiants().map((e) => ({
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
        <h1 className="text-2xl font-semibold">Passage d&apos;année et réaffectations</h1>
        <p className="mb-6 max-w-3xl text-sm text-muted">
          Filtrez, cochez les étudiants concernés, puis choisissez ce qui change : année, parcours (par exemple à l&apos;entrée en BUT2),
          référent ou groupe. Ce qui reste sur « Inchangé » n&apos;est pas modifié. Les portfolios des années précédentes sont conservés
          et restent consultables.
        </p>
        <FormPassage
          etudiants={etudiants}
          enseignants={enseignants.map((e) => ({ id: e.id, nom: `${e.prenom} ${e.nom}` }))}
          parcours={PARCOURS_GEA}
        />
      </main>
    </>
  );
}
