import { getUtilisateur } from "@/lib/db";
import { genererPortfolioPdf } from "@/lib/export-pdf";
import { estEnseignant, peutConsulter, utilisateurCourant } from "@/lib/session";

// Télécharge le portfolio complet en un seul PDF (étudiant concerné, son référent ou l'administrateur).
// ?apercu ouvre le PDF dans le navigateur au lieu de le télécharger.
export async function GET(requete: Request, ctx: RouteContext<"/export/[etudiantId]">) {
  const { etudiantId } = await ctx.params;
  const etudiant = await getUtilisateur(etudiantId);
  if (!etudiant || etudiant.role !== "etudiant") return new Response("Introuvable", { status: 404 });
  const u = await utilisateurCourant();
  if (!(await peutConsulter(u, etudiantId))) return new Response("Accès refusé", { status: 403 });

  const pdf = await genererPortfolioPdf(etudiant, estEnseignant(u));
  const nomFichier = `portfolio-${etudiant.nom}-${etudiant.prenom}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-$/, "");
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${new URL(requete.url).searchParams.has("apercu") ? "inline" : "attachment"}; filename="${nomFichier}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
