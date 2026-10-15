import fs from "node:fs";
import { cheminFichier, getTrace } from "@/lib/db";
import { peutConsulter, utilisateurCourant } from "@/lib/session";

// Sert le PDF d'une trace, uniquement à l'étudiant concerné et aux enseignants.
export async function GET(requete: Request, ctx: RouteContext<"/fichiers/[id]">) {
  const { id } = await ctx.params;
  const trace = getTrace(id);
  if (!trace) return new Response("Introuvable", { status: 404 });
  if (!peutConsulter(await utilisateurCourant(), trace.etudiant_id)) {
    return new Response("Accès refusé", { status: 403 });
  }
  const contenu = fs.readFileSync(cheminFichier(id));
  const telecharger = new URL(requete.url).searchParams.has("telecharger");
  return new Response(contenu, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${telecharger ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(trace.fichier_nom)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
