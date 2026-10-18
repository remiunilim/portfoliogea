"use client";

import { useActionState } from "react";
import { demarrerConnexionEmailAction, type EtatFormulaire } from "@/app/actions";

const champ =
  "w-full rounded-md border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

// Connexion par lien envoyé par mail : aucun mot de passe à retenir, aucun SSO universitaire
// nécessaire. On saisit son adresse mail, on reçoit un lien à usage unique dans les minutes qui
// suivent (voir src/lib/lien-connexion.ts).
export function FormConnexionEmail() {
  const [etat, action, enCours] = useActionState<EtatFormulaire, FormData>(demarrerConnexionEmailAction, null);
  if (etat?.ok) {
    return <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{etat.message}</p>;
  }
  return (
    <form action={action} className="space-y-4">
      <label className="block text-sm">
        <span className="mb-1 block font-medium">Adresse mail</span>
        <input name="email" type="email" required autoComplete="username" placeholder="prenom.nom@unilim.fr" className={champ} />
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
        {enCours ? "Envoi…" : "Recevoir mon lien de connexion"}
      </button>
    </form>
  );
}
