import Link from "next/link";
import { cookies } from "next/headers";
import { BoutonTheme } from "./BoutonTheme";
import { COOKIE_THEME, lireTheme } from "@/lib/theme";
import { seDeconnecter } from "@/app/actions";
import { compterNotificationsNonLues, type Utilisateur } from "@/lib/db";

const LIBELLE_ROLE = { etudiant: "Étudiant·e", enseignant: "Enseignant·e", admin: "Enseignant·e administrateur" };

export async function EnTete({ utilisateur }: { utilisateur: Utilisateur }) {
  const nonLues = await compterNotificationsNonLues(utilisateur.id);
  const theme = lireTheme((await cookies()).get(COOKIE_THEME)?.value);
  const accueil = utilisateur.role === "etudiant" ? `/portfolio/${utilisateur.id}` : "/enseignant";
  return (
    <header className="no-print border-b border-line bg-surface">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link href={accueil} className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-sm font-bold text-white">F</span>
          <span className="leading-tight">
            <span className="block font-semibold">Folio GEA</span>
            <span className="block text-xs text-muted">Portfolio de compétences · PAÉ</span>
          </span>
        </Link>
        {utilisateur.role !== "etudiant" && (
          <nav className="ml-4 hidden gap-1 text-sm sm:flex">
            <Link href="/enseignant" className="rounded px-3 py-1.5 hover:bg-primary-soft">
              {utilisateur.role === "admin" ? "Suivi des promotions" : "Mes étudiants"}
            </Link>
            {utilisateur.role === "admin" && (
              <Link href="/admin/affectations" className="rounded px-3 py-1.5 hover:bg-primary-soft">
                Étudiants et affectations
              </Link>
            )}
          </nav>
        )}
        <div className="ml-auto flex items-center gap-3 text-sm">
          <BoutonTheme initial={theme} />
          <Link
            href="/notifications"
            className="relative grid h-9 w-9 place-items-center rounded-full border border-line hover:bg-primary-soft"
            aria-label={nonLues ? `Notifications : ${nonLues} non lue${nonLues > 1 ? "s" : ""}` : "Notifications"}
            title="Notifications"
          >
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" strokeLinejoin="round" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" strokeLinecap="round" />
            </svg>
            {nonLues > 0 && (
              <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
                {nonLues > 9 ? "9+" : nonLues}
              </span>
            )}
          </Link>
          <Link href="/compte" className="rounded px-2 py-1 text-right leading-tight hover:bg-primary-soft" title="Mon compte et préférences de notification">
            <div className="font-medium">
              {utilisateur.prenom} {utilisateur.nom}
            </div>
            <div className="text-xs text-muted">
              {LIBELLE_ROLE[utilisateur.role]}
              {utilisateur.annee_but ? ` · BUT${utilisateur.annee_but}` : ""}
            </div>
          </Link>
          <form action={seDeconnecter}>
            <button className="rounded border border-line px-3 py-1.5 text-xs hover:bg-background" title="Mode démonstration : choisir un autre compte">
              Changer de compte
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
