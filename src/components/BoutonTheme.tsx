"use client";

import { useState } from "react";
import { COOKIE_THEME, type Theme } from "@/lib/theme";

// Bascule entre thème clair et thème sombre, sans rechargement de la page.
// « initial » vient du cookie lu côté serveur : même icône au rendu serveur et dans le navigateur.
export function BoutonTheme({ initial }: { initial: Theme }) {
  const [theme, setTheme] = useState<Theme>(initial);
  const basculer = () => {
    const suivant: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = suivant;
    document.cookie = `${COOKIE_THEME}=${suivant}; path=/; max-age=31536000; samesite=lax`;
    setTheme(suivant);
  };
  const sombre = theme === "dark";
  return (
    <button
      type="button"
      onClick={basculer}
      aria-label={sombre ? "Passer au thème clair" : "Passer au thème sombre"}
      title={sombre ? "Thème clair" : "Thème sombre"}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line hover:bg-primary-soft"
    >
      {sombre ? (
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" strokeLinecap="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}
