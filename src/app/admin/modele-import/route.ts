import { genererModele } from "@/lib/import-etudiants";
import { estAdmin, utilisateurCourant } from "@/lib/session";

// Modèle Excel à remplir pour l'import des listes d'étudiants.
export async function GET() {
  if (!estAdmin(await utilisateurCourant())) return new Response("Accès refusé", { status: 403 });
  return new Response(new Uint8Array(await genererModele()), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modele-import-etudiants.xlsx"',
    },
  });
}
