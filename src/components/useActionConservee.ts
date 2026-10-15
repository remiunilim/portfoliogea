"use client";

import { startTransition, useActionState, useEffect, useRef, type FormEvent } from "react";

// Comme useActionState, mais le formulaire n'est pas vidé après l'envoi.
// Par défaut, React 19 réinitialise un <form action={…}> après chaque action :
// en cas d'erreur (note manquante, email déjà utilisé…), la saisie serait perdue.
// Option viderSiSucces : vide le formulaire seulement quand l'action a réussi (formulaires d'ajout).
export function useActionConservee<Etat extends { ok: boolean } | null>(
  action: (etat: Etat, donnees: FormData) => Promise<Etat>,
  initial: Etat,
  options: { viderSiSucces?: boolean } = {},
) {
  const [etat, executer, enCours] = useActionState(
    action as (etat: Awaited<Etat>, donnees: FormData) => Promise<Etat>,
    initial as Awaited<Etat>,
  );
  const formulaire = useRef<HTMLFormElement | null>(null);
  const envoyer = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    formulaire.current = e.currentTarget;
    // Le bouton cliqué (ex. « Enregistrer et publier ») transmet son name/value.
    const donnees = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
    startTransition(() => executer(donnees));
  };
  useEffect(() => {
    if (options.viderSiSucces && etat?.ok) formulaire.current?.reset();
  }, [etat, options.viderSiSucces]);
  return [etat, envoyer, enCours] as const;
}
