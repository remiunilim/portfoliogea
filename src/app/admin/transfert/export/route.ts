import { genererExportZip } from "@/lib/transfert";
import { estAdmin, utilisateurCourant } from "@/lib/session";

// Télécharge toutes les données de cette instance (comptes, portfolios, évaluations) en un seul
// fichier .zip, pour les transférer vers une autre instance de Folio GEA (page /admin/transfert).
export async function GET() {
  if (!estAdmin(await utilisateurCourant())) return new Response("Accès refusé", { status: 403 });
  const zip = await genererExportZip();
  const date = new Date().toISOString().slice(0, 10);
  return new Response(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="folio-gea-export-${date}.zip"`,
      "Cache-Control": "private, no-store",
    },
  });
}
