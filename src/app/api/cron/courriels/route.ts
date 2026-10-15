import { traiterFileCourriels } from "@/lib/courriels";

// Vide la file de courriels, déclenchée périodiquement (voir deploy/, timers systemd).
// Protégée par un secret partagé : ?secret=... doit correspondre à CRON_SECRET (.env.local).
export async function GET(requete: Request) {
  const url = new URL(requete.url);
  if (!process.env.CRON_SECRET || url.searchParams.get("secret") !== process.env.CRON_SECRET) {
    return new Response("Accès refusé", { status: 403 });
  }
  const mode = url.searchParams.get("mode");
  const bilan = await traiterFileCourriels(mode === "immediat" || mode === "quotidien" ? mode : "tous");
  return Response.json(bilan);
}
