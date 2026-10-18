"use client";

import { useActionState } from "react";
import { importerDonneesAction, type EtatFormulaire } from "@/app/actions";

const champ =
  "w-full rounded-md border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

// Import d'un export .zip d'une autre instance de Folio GEA (voir /admin/transfert et
// src/lib/transfert.ts). Les comptes déjà présents (même email) ne sont jamais écrasés.
export function FormImportDonnees() {
  const [etat, action, enCours] = useActionState<EtatFormulaire, FormData>(importerDonneesAction, null);
  return (
    <form action={action} className="space-y-3">
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Fichier .zip</span>
        <input name="fichier" type="file" accept=".zip,application/zip" required className={champ} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Pour confirmer, saisissez IMPORTER</span>
        <input name="confirmation" required autoComplete="off" className={champ} />
      </label>
      {etat && (
        <p role="status" className={`text-sm ${etat.ok ? "text-emerald-700" : "text-red-700"}`}>
          {etat.message}
        </p>
      )}
      <button
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
        disabled={enCours}
      >
        {enCours ? "Import en cours…" : "Importer"}
      </button>
    </form>
  );
}
