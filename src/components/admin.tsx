"use client";

import { useActionConservee } from "./useActionConservee";
import { startTransition, useActionState, useMemo, useState } from "react";
import {
  ajouterEnseignant,
  ajouterEtudiant,
  changerActivationAction,
  enregistrerPreferences,
  importerEtudiants,
  modifierCompteAction,
  passageGroupe,
  supprimerCompteAction,
  type EtatFormulaire,
} from "@/app/actions";
import type { PreferenceCourriel } from "@/lib/db";
import type { LigneApercu } from "@/lib/import-etudiants";

const champ =
  "w-full rounded-md border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";
const bouton = "rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60";
const boutonSecondaire = "rounded-md border border-line bg-surface px-4 py-2 text-sm hover:bg-background disabled:opacity-60";

function Retour({ etat }: { etat: EtatFormulaire }) {
  if (!etat) return null;
  return (
    <p role="status" className={`text-sm ${etat.ok ? "text-emerald-700" : "text-red-700"}`}>
      {etat.message}
    </p>
  );
}

type Option = { id: string; nom: string };

// ---------- Import d'une liste ----------

const LIBELLE_ACTION: Record<LigneApercu["action"], [string, string]> = {
  creer: ["Nouveau", "bg-emerald-50 text-emerald-800"],
  maj: ["Mis à jour", "bg-sky-50 text-sky-800"],
  inchange: ["Inchangé", "bg-slate-100 text-slate-600"],
  erreur: ["Erreur", "bg-red-50 text-red-700"],
};

export function FormImport() {
  const [etat, action, enCours] = useActionState(importerEtudiants, null);
  const [fichierChoisi, setFichierChoisi] = useState(false);
  const apercu = etat?.apercu;
  const compte = (a: LigneApercu["action"]) => apercu?.filter((l) => l.action === a).length ?? 0;

  // Envoi manuel (sans réinitialisation automatique du formulaire par React) :
  // le fichier choisi reste dans le champ entre l'aperçu et la confirmation.
  const envoyer = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter;
    const donnees = new FormData(e.currentTarget, submitter);
    startTransition(() => action(donnees));
  };

  return (
    <div className="space-y-4">
      <form onSubmit={envoyer} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="block">
            <span className="mb-1 block text-sm font-medium">Fichier Excel (.xlsx) ou CSV</span>
            <input
              name="fichier"
              type="file"
              accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
              required
              onChange={(e) => {
                setFichierChoisi(!!e.target.files?.length);
              }}
              className="block w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-white"
            />
          </label>
          <a href="/admin/modele-import" className="text-sm text-primary hover:underline">
            Télécharger le modèle Excel
          </a>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="creer_enseignants" value="1" className="accent-[var(--primary)]" />
          Créer automatiquement les enseignants référents absents de la plateforme
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button name="etape" value="apercu" className={apercu ? boutonSecondaire : bouton} disabled={enCours || !fichierChoisi}>
            {enCours ? "Lecture…" : apercu ? "Relancer l'aperçu" : "Prévisualiser l'import"}
          </button>
          {apercu && (
            <button
              name="etape"
              value="importer"
              className={bouton}
              disabled={enCours || !fichierChoisi || compte("creer") + compte("maj") === 0}
            >
              Importer {compte("creer") + compte("maj")} ligne{compte("creer") + compte("maj") > 1 ? "s" : ""}
            </button>
          )}
        </div>
      </form>

      {etat && !etat.ok && <Retour etat={etat} />}

      {etat?.bilan && (
        <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <strong>Import terminé.</strong> {etat.bilan.crees} étudiant·e(s) créé·e(s), {etat.bilan.misAJour} mis·e(s) à jour,{" "}
          {etat.bilan.inchanges} inchangé·e(s)
          {etat.bilan.enseignantsCrees > 0 && `, ${etat.bilan.enseignantsCrees} enseignant·e(s) créé·e(s)`}
          {etat.bilan.emailsEnseignantsCompletes > 0 && `, ${etat.bilan.emailsEnseignantsCompletes} email(s) d'enseignant complété(s)`}
          {etat.bilan.ignores > 0 && `, ${etat.bilan.ignores} ligne(s) en erreur ignorée(s)`}.
        </div>
      )}

      {apercu && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2 text-xs">
            {(["creer", "maj", "inchange", "erreur"] as const).map((a) => (
              <span key={a} className={`rounded-full px-2.5 py-1 font-medium ${LIBELLE_ACTION[a][1]}`}>
                {LIBELLE_ACTION[a][0]} : {compte(a)}
              </span>
            ))}
            {compte("erreur") > 0 && <span className="py-1 text-muted">Les lignes en erreur seront ignorées : corrigez le fichier puis relancez l&apos;aperçu.</span>}
          </div>
          <div className="max-h-[420px] overflow-auto rounded-lg border border-line">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="sticky top-0 bg-background text-left text-xs text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Ligne</th>
                  <th className="px-3 py-2 font-medium">Étudiant·e</th>
                  <th className="px-3 py-2 font-medium">Année</th>
                  <th className="px-3 py-2 font-medium">Parcours</th>
                  <th className="px-3 py-2 font-medium">Référent</th>
                  <th className="px-3 py-2 font-medium">Résultat</th>
                </tr>
              </thead>
              <tbody>
                {apercu.map((l) => (
                  <tr key={l.numero} className="border-t border-line align-top">
                    <td className="px-3 py-2 text-muted">{l.numero}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium">
                        {l.nom} {l.prenom}
                      </div>
                      <div className="text-xs text-muted">{l.email || "sans email"}</div>
                    </td>
                    <td className="px-3 py-2">{l.annee ? `BUT${l.annee}` : "?"}</td>
                    <td className="px-3 py-2">{l.parcours}</td>
                    <td className="px-3 py-2">
                      <div>{l.referentNom || l.referentTexte || <span className="text-muted">—</span>}</div>
                      {l.emailReferent && <div className="text-xs text-muted">{l.emailReferent}</div>}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${LIBELLE_ACTION[l.action][1]}`}>{LIBELLE_ACTION[l.action][0]}</span>
                      {l.action !== "erreur" && l.changements.length > 0 && <div className="mt-1 text-xs text-muted">{l.changements.join(" · ")}</div>}
                      {l.erreurs.map((e) => (
                        <div key={e} className="mt-1 text-xs text-red-700">
                          {e}
                        </div>
                      ))}
                      {l.avertissements.map((a) => (
                        <div key={a} className="mt-1 text-xs text-amber-800">
                          {a}
                        </div>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Ajout manuel ----------

export function FormAjoutEtudiant({ enseignants, parcours }: { enseignants: Option[]; parcours: readonly string[] }) {
  const [etat, action, enCours] = useActionConservee(ajouterEtudiant, null, { viderSiSucces: true });
  return (
    <form onSubmit={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="nom" required placeholder="Nom *" aria-label="Nom" className={champ} />
        <input name="prenom" required placeholder="Prénom *" aria-label="Prénom" className={champ} />
        <select name="annee" required defaultValue="" aria-label="Année" className={champ}>
          <option value="" disabled>
            Année *
          </option>
          {[1, 2, 3].map((a) => (
            <option key={a} value={a}>
              BUT{a}
            </option>
          ))}
        </select>
        <select name="parcours" defaultValue="GEMA" aria-label="Parcours" className={champ}>
          {parcours.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <select name="referent" defaultValue="" aria-label="Enseignant référent" className={champ}>
          <option value="">Sans référent</option>
          {enseignants.map((e) => (
            <option key={e.id} value={e.id}>
              Référent : {e.nom}
            </option>
          ))}
        </select>
        <input name="groupe" placeholder="Groupe (facultatif)" aria-label="Groupe" className={champ} />
        <input name="email" type="email" placeholder="Email étudiant (pour les notifications)" aria-label="Email étudiant" className={`${champ} sm:col-span-2`} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button className={bouton} disabled={enCours}>
          {enCours ? "Ajout…" : "Ajouter l'étudiant·e"}
        </button>
        <Retour etat={etat} />
      </div>
    </form>
  );
}

export function FormAjoutEnseignant() {
  const [etat, action, enCours] = useActionConservee(ajouterEnseignant, null, { viderSiSucces: true });
  return (
    <form onSubmit={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="nom" required placeholder="Nom *" aria-label="Nom" className={champ} />
        <input name="prenom" required placeholder="Prénom *" aria-label="Prénom" className={champ} />
        <input name="email" type="email" placeholder="Email enseignant (pour les notifications)" aria-label="Email enseignant" className={`${champ} sm:col-span-2`} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="admin" value="1" className="accent-[var(--primary)]" />
        Droits d&apos;administrateur (voit tous les étudiants, gère les affectations)
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button className={bouton} disabled={enCours}>
          {enCours ? "Ajout…" : "Ajouter l'enseignant·e"}
        </button>
        <Retour etat={etat} />
      </div>
    </form>
  );
}

// ---------- Préférences de notification (chaque utilisateur) ----------

const CHOIX_COURRIEL: { valeur: PreferenceCourriel; libelle: string; aide: string; enseignantSeulement?: boolean }[] = [
  { valeur: "immediat", libelle: "Un courriel à chaque fois", aide: "Au plus un courriel par dépôt tant que vous n'avez pas lu la notification précédente." },
  {
    valeur: "quotidien",
    libelle: "Un récapitulatif par jour",
    aide: "Un seul courriel en fin de journée, avec l'activité de tous vos étudiants.",
    enseignantSeulement: true,
  },
  { valeur: "aucun", libelle: "Aucun courriel", aide: "Seulement la cloche dans l'outil." },
];

export function FormPreferences({ preference, enseignant }: { preference: PreferenceCourriel; enseignant: boolean }) {
  const [etat, action, enCours] = useActionConservee(enregistrerPreferences, null);
  return (
    <form onSubmit={action} className="space-y-3">
      <fieldset className="space-y-2">
        <legend className="sr-only">Notifications par courriel</legend>
        {CHOIX_COURRIEL.filter((c) => enseignant || !c.enseignantSeulement).map((c) => (
          <label key={c.valeur} className="flex cursor-pointer gap-3 rounded-lg border border-line p-3 hover:bg-primary-soft has-[:checked]:border-primary has-[:checked]:bg-primary-soft">
            <input type="radio" name="pref_courriel" value={c.valeur} defaultChecked={preference === c.valeur} className="mt-1 accent-[var(--primary)]" />
            <span>
              <span className="block text-sm font-medium">{c.libelle}</span>
              <span className="block text-xs text-muted">{c.aide}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <button className={bouton} disabled={enCours}>
          {enCours ? "Enregistrement…" : "Enregistrer"}
        </button>
        <Retour etat={etat} />
      </div>
    </form>
  );
}

// ---------- Fiche d'un compte (administrateur) ----------

type CompteEdite = {
  id: string;
  nom: string;
  prenom: string;
  email: string;
  role: "etudiant" | "enseignant" | "admin";
  annee_but: number | null;
  groupe: string | null;
  parcours: string | null;
  referent_id: string | null;
  actif: number;
};

export function FormModifierCompte({ compte, enseignants, parcours }: { compte: CompteEdite; enseignants: Option[]; parcours: readonly string[] }) {
  const [etat, action, enCours] = useActionConservee(modifierCompteAction, null);
  const etudiant = compte.role === "etudiant";
  return (
    <form onSubmit={action} className="space-y-3">
      <input type="hidden" name="id" value={compte.id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Nom</span>
          <input name="nom" required defaultValue={compte.nom} className={champ} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Prénom</span>
          <input name="prenom" required defaultValue={compte.prenom} className={champ} />
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1 block font-medium">Adresse mail (notifications)</span>
          <input
            name="email"
            type="email"
            required
            defaultValue={compte.email.endsWith(".a-renseigner") ? "" : compte.email}
            placeholder="adresse universitaire"
            className={champ}
          />
        </label>
        {etudiant ? (
          <>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Année</span>
              <select name="annee" defaultValue={compte.annee_but ?? 1} className={champ}>
                {[1, 2, 3].map((a) => (
                  <option key={a} value={a}>
                    BUT{a}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Parcours</span>
              <select name="parcours" defaultValue={compte.parcours ?? "GEMA"} className={champ}>
                {parcours.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Enseignant·e référent·e</span>
              <select name="referent" defaultValue={compte.referent_id ?? ""} className={champ}>
                <option value="">Sans référent</option>
                {enseignants.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nom}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Groupe</span>
              <input name="groupe" defaultValue={compte.groupe ?? ""} className={champ} />
            </label>
          </>
        ) : (
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" name="admin" value="1" defaultChecked={compte.role === "admin"} className="accent-[var(--primary)]" />
            Droits d&apos;administrateur
          </label>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button className={bouton} disabled={enCours}>
          {enCours ? "Enregistrement…" : "Enregistrer les modifications"}
        </button>
        <Retour etat={etat} />
      </div>
    </form>
  );
}

export function FormActivation({ id, actif, role }: { id: string; actif: boolean; role: string }) {
  const [etat, action, enCours] = useActionConservee(changerActivationAction, null);
  return (
    <form onSubmit={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="activer" value={actif ? "0" : "1"} />
      <p className="text-sm text-muted">
        {actif
          ? role === "etudiant"
            ? "À utiliser pour une sortie de formation (abandon, réorientation, diplôme) : l'étudiant·e n'a plus accès, son portfolio est conservé et reste exportable."
            : "À utiliser pour un départ : l'enseignant·e n'a plus accès, ses évaluations restent dans l'historique et ses étudiants passent sans référent."
          : "Ce compte est désactivé : la réactivation rend l'accès à l'outil."}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button className={boutonSecondaire} disabled={enCours}>
          {actif ? "Désactiver le compte" : "Réactiver le compte"}
        </button>
        <Retour etat={etat} />
      </div>
    </form>
  );
}

export function FormSuppression({ id, nom, role, resume }: { id: string; nom: string; role: string; resume: string }) {
  const [etat, action, enCours] = useActionConservee(supprimerCompteAction, null);
  const [saisie, setSaisie] = useState("");
  return (
    <form onSubmit={action} className="space-y-3">
      <input type="hidden" name="id" value={id} />
      <p className="text-sm text-red-800">
        {role === "etudiant"
          ? `Suppression définitive du compte et de tout le portfolio (${resume}). Cette action est irréversible : exportez le PDF avant si nécessaire.`
          : `Suppression définitive, possible seulement si ce compte n'a laissé aucune évaluation ni action (${resume}).`}
      </p>
      <label className="block text-sm">
        <span className="mb-1 block">
          Pour confirmer, saisissez le nom <strong>{nom}</strong>
        </span>
        <input name="confirmation" value={saisie} onChange={(e) => setSaisie(e.target.value)} autoComplete="off" className={champ} />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button
          className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={enCours || saisie.trim().toLowerCase() !== nom.toLowerCase()}
        >
          Supprimer définitivement
        </button>
        <Retour etat={etat} />
      </div>
    </form>
  );
}

// ---------- Passage d'année et réaffectations groupés ----------

type EtudiantPassage = { id: string; nom: string; annee: number; parcours: string; groupe: string; referent: string; referentId: string };

export function FormPassage({ etudiants, enseignants, parcours }: { etudiants: EtudiantPassage[]; enseignants: Option[]; parcours: readonly string[] }) {
  const [etat, action, enCours] = useActionState(passageGroupe, null);
  const [filtreAnnee, setFiltreAnnee] = useState<number | 0>(1);
  const [filtreReferent, setFiltreReferent] = useState("");
  const [recherche, setRecherche] = useState("");
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [changerGroupe, setChangerGroupe] = useState(false);

  const visibles = useMemo(
    () =>
      etudiants.filter(
        (e) =>
          (!filtreAnnee || e.annee === filtreAnnee) &&
          (!filtreReferent || (filtreReferent === "__aucun" ? !e.referentId : e.referentId === filtreReferent)) &&
          (!recherche || e.nom.toLowerCase().includes(recherche.toLowerCase())),
      ),
    [etudiants, filtreAnnee, filtreReferent, recherche],
  );
  const tousCoches = visibles.length > 0 && visibles.every((e) => selection.has(e.id));
  const basculer = (id: string) =>
    setSelection((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const basculerTous = () =>
    setSelection((s) => {
      const n = new Set(s);
      for (const e of visibles) {
        if (tousCoches) n.delete(e.id);
        else n.add(e.id);
      }
      return n;
    });
  const envoyer = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const donnees = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
    for (const id of selection) donnees.append("etudiants", id);
    startTransition(() => action(donnees));
    setSelection(new Set());
  };
  const nbSel = selection.size;

  return (
    <form onSubmit={envoyer} className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <section className="min-w-0 rounded-xl border border-line bg-surface">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3 text-sm">
          <div className="flex gap-1 rounded-lg border border-line p-1">
            {[0, 1, 2, 3].map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setFiltreAnnee(a)}
                aria-pressed={filtreAnnee === a}
                className={`rounded-md px-3 py-1 ${filtreAnnee === a ? "bg-primary text-white" : "hover:bg-primary-soft"}`}
              >
                {a ? `BUT${a}` : "Tous"}
              </button>
            ))}
          </div>
          <select value={filtreReferent} onChange={(e) => setFiltreReferent(e.target.value)} aria-label="Filtrer par référent" className="rounded-md border border-line bg-surface px-2 py-1.5">
            <option value="">Tous les référents</option>
            <option value="__aucun">Sans référent</option>
            {enseignants.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nom}
              </option>
            ))}
          </select>
          <input value={recherche} onChange={(e) => setRecherche(e.target.value)} placeholder="Rechercher un nom" aria-label="Rechercher" className="min-w-0 flex-1 rounded-md border border-line bg-surface px-2 py-1.5" />
        </div>
        <div className="max-h-[560px] overflow-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="sticky top-0 bg-surface text-left text-xs text-muted">
              <tr className="border-b border-line">
                <th className="w-10 px-3 py-2">
                  <input type="checkbox" checked={tousCoches} onChange={basculerTous} aria-label="Tout sélectionner" className="accent-[var(--primary)]" />
                </th>
                <th className="px-3 py-2 font-medium">Étudiant·e</th>
                <th className="px-3 py-2 font-medium">Année</th>
                <th className="px-3 py-2 font-medium">Parcours</th>
                <th className="px-3 py-2 font-medium">Groupe</th>
                <th className="px-3 py-2 font-medium">Référent</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((e) => (
                <tr key={e.id} className={`border-b border-line last:border-0 ${selection.has(e.id) ? "bg-primary-soft/60" : ""}`}>
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={selection.has(e.id)} onChange={() => basculer(e.id)} aria-label={`Sélectionner ${e.nom}`} className="accent-[var(--primary)]" />
                  </td>
                  <td className="px-3 py-2 font-medium">{e.nom}</td>
                  <td className="px-3 py-2">BUT{e.annee}</td>
                  <td className="px-3 py-2">{e.parcours}</td>
                  <td className="px-3 py-2">{e.groupe || "—"}</td>
                  <td className="px-3 py-2">{e.referent || <span className="text-amber-700">aucun</span>}</td>
                </tr>
              ))}
              {visibles.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted">
                    Aucun étudiant pour ce filtre.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <aside className="h-fit space-y-4 rounded-xl border border-line bg-surface p-5 lg:sticky lg:top-4">
        <div>
          <h2 className="text-base font-semibold">
            {nbSel} étudiant{nbSel > 1 ? "s" : ""} sélectionné{nbSel > 1 ? "s" : ""}
          </h2>
          {nbSel > 0 && (
            <button type="button" onClick={() => setSelection(new Set())} className="text-xs text-primary hover:underline">
              Vider la sélection
            </button>
          )}
        </div>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Année</span>
          <select name="annee" defaultValue="suivante" className={champ}>
            <option value="">Inchangée</option>
            <option value="suivante">Année suivante (BUT1 → BUT2, BUT2 → BUT3)</option>
            <option value="1">BUT1</option>
            <option value="2">BUT2</option>
            <option value="3">BUT3</option>
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Parcours</span>
          <select name="parcours" defaultValue="" className={champ}>
            <option value="">Inchangé</option>
            {parcours.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Enseignant·e référent·e</span>
          <select name="referent" defaultValue="" className={champ}>
            <option value="">Inchangé</option>
            <option value="__aucun">Retirer le référent</option>
            {enseignants.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nom}
              </option>
            ))}
          </select>
        </label>
        <div className="text-sm">
          <label className="flex items-center gap-2 font-medium">
            <input type="checkbox" name="changer_groupe" value="1" checked={changerGroupe} onChange={(e) => setChangerGroupe(e.target.checked)} className="accent-[var(--primary)]" />
            Changer le groupe
          </label>
          {changerGroupe && <input name="groupe" placeholder="Nouveau groupe (vide = aucun)" aria-label="Nouveau groupe" className={`${champ} mt-2`} />}
        </div>
        <button name="operation" value="appliquer" className={`${bouton} w-full`} disabled={enCours || nbSel === 0}>
          {enCours ? "Application…" : `Appliquer à ${nbSel} étudiant${nbSel > 1 ? "s" : ""}`}
        </button>
        <div className="border-t border-line pt-4">
          <p className="mb-2 text-xs text-muted">Fin de BUT3, abandon, réorientation : l&apos;accès est fermé, le portfolio est conservé.</p>
          <button name="operation" value="desactiver" className={`${boutonSecondaire} w-full`} disabled={enCours || nbSel === 0}>
            Désactiver la sélection (sortie de formation)
          </button>
        </div>
        {etat && (
          <div role="status" className={`rounded-md p-3 text-sm ${etat.ok ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-800"}`}>
            {etat.message}
            {etat.ignores && etat.ignores.length > 0 && <div className="mt-1 text-xs">Ignorés : {etat.ignores.join(", ")}</div>}
          </div>
        )}
      </aside>
    </form>
  );
}
