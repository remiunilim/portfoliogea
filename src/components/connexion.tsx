"use client";

import { useActionState } from "react";
import { seConnecterAvecMotDePasse, type EtatFormulaire } from "@/app/actions";

const champ =
  "w-full rounded-md border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

// Connexion par mot de passe (transitoire, en attendant le SSO de l'université) : à utiliser
// seulement avec de vrais comptes, chacun ayant reçu son mot de passe par l'administrateur.
export function FormConnexionMotDePasse() {
  const [etat, action, enCours] = useActionState<EtatFormulaire, FormData>(seConnecterAvecMotDePasse, null);
  return (
    <form action={action} className="space-y-4">
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Adresse mail</span>
        <input name="email" type="email" required autoComplete="username" className={champ} />
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Mot de passe</span>
        <input name="mot_de_passe" type="password" required autoComplete="current-password" className={champ} />
      </label>
      {etat && !etat.ok && (
        <p role="status" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {etat.message}
        </p>
      )}
      <button
        className="w-full rounded-lg bg-primary px-4 py-3 text-center font-medium text-white hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
        disabled={enCours}
      >
        {enCours ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
