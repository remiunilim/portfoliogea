import Link from "next/link";
import { redirect } from "next/navigation";
import { EnTete } from "@/components/EnTete";
import { MarqueurNotificationsLues } from "@/components/formulaires";
import { getNotifications } from "@/lib/db";
import { utilisateurCourant } from "@/lib/session";
import { dateRelative } from "@/lib/affichage";

export default async function Notifications() {
  const u = await utilisateurCourant();
  if (!u) redirect("/connexion");
  const notifications = getNotifications(u.id);
  const nonLues = notifications.filter((n) => !n.lue).length;

  return (
    <>
      <EnTete utilisateur={u} />
      {nonLues > 0 && <MarqueurNotificationsLues />}
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <p className="mb-5 text-sm text-muted">
          {nonLues ? `${nonLues} nouvelle${nonLues > 1 ? "s" : ""}` : "Aucune nouvelle notification"} ·{" "}
          <Link href="/compte" className="text-primary hover:underline">
            choisir de recevoir aussi un courriel
          </Link>
        </p>
        {notifications.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line bg-surface p-8 text-center text-sm text-muted">
            Vous serez prévenu·e ici dès qu&apos;une évaluation de votre portfolio sera publiée.
          </p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {notifications.map((n) => (
              <li key={n.id}>
                <Link href={n.lien || "#"} className={`flex gap-3 px-4 py-3 hover:bg-primary-soft ${n.lue ? "" : "bg-primary-soft/50"}`}>
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.lue ? "bg-transparent" : "bg-rose-600"}`} aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">
                      {n.titre}
                      {!n.lue && <span className="sr-only"> (non lue)</span>}
                    </span>
                    {n.detail && <span className="block text-sm text-muted">{n.detail}</span>}
                  </span>
                  <span className="shrink-0 text-xs text-muted">{dateRelative(n.cree_le)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
