"use client";

import { useActionState, useState } from "react";
import { creerProfilEtudiantAction, demarrerConnexionEmailAction, type EtatFormulaire } from "@/app/actions";

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

// Création d'un profil étudiant (adresse déjà vérifiée par le jeton) : nom, prénom, année,
// parcours (seulement à partir de BUT2, où il se distingue du tronc commun) et référent, obligatoire.
export function FormCreerProfil({
  jeton,
  enseignants,
  parcours,
}: {
  jeton: string;
  enseignants: { id: string; nom: string }[];
  parcours: readonly string[];
}) {
  const [etat, action, enCours] = useActionState<EtatFormulaire, FormData>(creerProfilEtudiantAction, null);
  const [annee, setAnnee] = useState("");
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="jeton" value={jeton} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Nom *</span>
          <input name="nom" required className={champ} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Prénom *</span>
          <input name="prenom" required className={champ} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Année *</span>
          <select name="annee" required value={annee} onChange={(e) => setAnnee(e.target.value)} className={champ}>
            <option value="" disabled>
              Choisir
            </option>
            {[1, 2, 3].map((a) => (
              <option key={a} value={a}>
                BUT{a}
              </option>
            ))}
          </select>
        </label>
        {(annee === "2" || annee === "3") && (
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Parcours *</span>
            <select name="parcours" required defaultValue="" className={champ}>
              <option value="" disabled>
                Choisir
              </option>
              {parcours.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
        )}
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium">Enseignant·e référent·e *</span>
          <select name="referent" required defaultValue="" className={champ}>
            <option value="" disabled>
              Choisir
            </option>
            {enseignants.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nom}
              </option>
            ))}
          </select>
        </label>
      </div>
      {etat && !etat.ok && (
        <p role="status" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {etat.message}
        </p>
      )}
      <button
        className="w-full rounded-lg bg-primary px-4 py-3 text-center font-medium text-white hover:opacity-90 disabled:cursor-wait disabled:opacity-60"
        disabled={enCours}
      >
        {enCours ? "Création…" : "Créer mon profil"}
      </button>
    </form>
  );
}
