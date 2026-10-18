import { listerEnseignants, listerEtudiants } from "@/lib/db";
import { genererNotesExcel } from "@/lib/export-notes";
import { infosParcours } from "@/lib/referentiel";
import { estAdmin, estEnseignant, utilisateurCourant } from "@/lib/session";

// Télécharge en Excel les notes (brouillons et publiées) des étudiants, une feuille par année de
// BUT : un enseignant obtient ses étudiants, l'administrateur tous les étudiants (ou un filtre par
// référent/parcours, repris des mêmes paramètres que la page /enseignant).
export async function GET(requete: Request) {
  const u = await utilisateurCourant();
  if (!estEnseignant(u)) return new Response("Accès refusé", { status: 403 });
  const admin = estAdmin(u);

  const params = new URL(requete.url).searchParams;
  const referentParam = params.get("referent") ?? "";
  const parcoursParam = params.get("parcours") ?? "";
  const filtreReferent = admin ? referentParam : u!.id;

  const enseignants = await listerEnseignants();
  const nomReferent = (id: string | null) => {
    const r = enseignants.find((e) => e.id === id);
    return r ? `${r.prenom} ${r.nom}` : "Sans référent";
  };

  const etudiants = (await listerEtudiants()).filter(
    (e) =>
      (!filtreReferent || (filtreReferent === "aucun" ? !e.referent_id : e.referent_id === filtreReferent)) &&
      (!parcoursParam || infosParcours(e.parcours).code === parcoursParam),
  );

  const excel = await genererNotesExcel(etudiants, nomReferent);
  const base = admin
    ? filtreReferent === "aucun"
      ? "notes-sans-referent"
      : filtreReferent
        ? `notes-${nomReferent(filtreReferent)}`
        : "notes-tous-les-etudiants"
    : `notes-${u!.prenom}-${u!.nom}`;
  const nomFichier = base
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return new Response(excel, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${nomFichier}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
