"use client";

import { useActionConservee } from "./useActionConservee";
import { useEffect, useState } from "react";
import {
  deposerTrace,
  enregistrerRendezVousAction,
  evaluer,
  lireNotifications,
  marquerPortfolioConsulte,
  modifierTraceAction,
  publierAnnee,
  sauverArgumentaire,
  sauverPresentation,
  supprimerTraceAction,
  type EtatFormulaire,
} from "@/app/actions";
import { NIVEAUX_EVALUATION, NOTE_MAX } from "@/lib/referentiel";

function Retour({ etat }: { etat: EtatFormulaire }) {
  if (!etat) return null;
  return (
    <span role="status" className={`text-sm ${etat.ok ? "text-emerald-700" : "text-red-700"}`}>
      {etat.message}
    </span>
  );
}

const bouton =
  "rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-wait disabled:opacity-60";
const boutonSecondaire = "rounded-md border border-line bg-surface px-3 py-1.5 text-sm hover:bg-background";
const champ =
  "w-full rounded-md border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

function Compteur({ texte }: { texte: string }) {
  const mots = texte.trim() ? texte.trim().split(/\s+/).length : 0;
  return <span className="text-xs text-muted">{mots} mots</span>;
}

// ---------- Présentation ----------

export function FormPresentation(props: { etudiantId: string; texte: string; projetPro: string }) {
  const [etat, action, enCours] = useActionConservee(sauverPresentation, null);
  const [texte, setTexte] = useState(props.texte);
  return (
    <form onSubmit={action} className="space-y-4">
      <input type="hidden" name="etudiant" value={props.etudiantId} />
      <label className="block">
        <span className="mb-1 flex justify-between text-sm font-medium">
          Qui suis-je ? <Compteur texte={texte} />
        </span>
        <textarea
          name="texte"
          rows={7}
          className={champ}
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          placeholder="Votre parcours, vos expériences (stages, alternance, engagements), vos centres d'intérêt…"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Mon projet professionnel</span>
        <textarea
          name="projet_pro"
          rows={4}
          className={champ}
          defaultValue={props.projetPro}
          placeholder="Le métier ou le secteur visé, la poursuite d'études envisagée…"
        />
      </label>
      <div className="flex items-center gap-3">
        <button className={bouton} disabled={enCours}>
          {enCours ? "Enregistrement…" : "Enregistrer"}
        </button>
        <Retour etat={etat} />
      </div>
    </form>
  );
}

// ---------- Argumentaire ----------

type Cellule = { etudiantId: string; annee: number; competence: string };

function ChampsCellule({ etudiantId, annee, competence }: Cellule) {
  return (
    <>
      <input type="hidden" name="etudiant" value={etudiantId} />
      <input type="hidden" name="annee" value={annee} />
      <input type="hidden" name="competence" value={competence} />
    </>
  );
}

export function FormArgumentaire(props: Cellule & { texte: string }) {
  const [etat, action, enCours] = useActionConservee(sauverArgumentaire, null);
  const [texte, setTexte] = useState(props.texte);
  const modifie = texte !== props.texte;
  return (
    <form onSubmit={action} className="space-y-3">
      <ChampsCellule {...props} />
      <textarea
        name="texte"
        rows={12}
        className={`${champ} leading-relaxed`}
        value={texte}
        onChange={(e) => setTexte(e.target.value)}
        placeholder="Décrivez la situation, ce que vous avez fait, ce que vous en avez appris, et en quoi vos traces en témoignent…"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button className={bouton} disabled={enCours || !modifie}>
          {enCours ? "Enregistrement…" : "Enregistrer l'argumentaire"}
        </button>
        <Compteur texte={texte} />
        {modifie && !enCours && <span className="text-xs text-amber-700">Modifications non enregistrées</span>}
        <Retour etat={etat} />
      </div>
    </form>
  );
}

// ---------- Traces ----------

export function FormNouvelleTrace(props: Cellule) {
  const [ouvert, setOuvert] = useState(false);
  const [etat, action, enCours] = useActionConservee(async (precedent: EtatFormulaire, donnees: FormData) => {
    const resultat = await deposerTrace(precedent, donnees);
    if (resultat?.ok) setOuvert(false);
    return resultat;
  }, null);

  if (!ouvert) {
    return (
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => setOuvert(true)} className={boutonSecondaire}>
          + Déposer une trace (PDF)
        </button>
        <Retour etat={etat} />
      </div>
    );
  }
  return (
    <form onSubmit={action} className="space-y-3 rounded-lg border border-dashed border-primary/40 bg-primary-soft/40 p-4">
      <ChampsCellule {...props} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Titre de la trace *</span>
          <input name="titre" required className={champ} placeholder="Ex. : Rapport de SAÉ diagnostic" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Fichier PDF * (10 Mo max.)</span>
          <input name="fichier" type="file" accept="application/pdf,.pdf" required className="block w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-white" />
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Contexte (facultatif)</span>
        <input name="description" className={champ} placeholder="SAÉ, stage, projet associatif… et date de réalisation" />
      </label>
      <div className="flex items-center gap-3">
        <button className={bouton} disabled={enCours}>
          {enCours ? "Envoi…" : "Déposer"}
        </button>
        <button type="button" onClick={() => setOuvert(false)} className={boutonSecondaire}>
          Annuler
        </button>
        <Retour etat={etat} />
      </div>
    </form>
  );
}

export function EditionTrace(props: { traceId: string; titre: string; description: string }) {
  const [ouvert, setOuvert] = useState(false);
  const [etat, action, enCours] = useActionConservee(async (precedent: EtatFormulaire, donnees: FormData) => {
    const resultat = await modifierTraceAction(precedent, donnees);
    if (resultat?.ok) setOuvert(false);
    return resultat;
  }, null);

  return (
    <div className="no-print">
      {!ouvert ? (
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setOuvert(true)} className="text-xs text-primary hover:underline">
            Modifier / remplacer
          </button>
          <form
            action={supprimerTraceAction}
            onSubmit={(e) => {
              if (!confirm(`Supprimer la trace « ${props.titre} » ?`)) e.preventDefault();
            }}
          >
            <input type="hidden" name="trace" value={props.traceId} />
            <button className="text-xs text-red-700 hover:underline">Supprimer</button>
          </form>
          <Retour etat={etat} />
        </div>
      ) : (
        <form onSubmit={action} className="mt-2 space-y-2 rounded-md border border-line bg-background p-3">
          <input type="hidden" name="trace" value={props.traceId} />
          <input name="titre" defaultValue={props.titre} className={champ} required />
          <input name="description" defaultValue={props.description} className={champ} placeholder="Contexte" />
          <label className="block text-xs text-muted">
            Remplacer le fichier (facultatif)
            <input name="fichier" type="file" accept="application/pdf,.pdf" className="mt-1 block w-full text-sm" />
          </label>
          <div className="flex items-center gap-2">
            <button className={bouton} disabled={enCours}>
              {enCours ? "Enregistrement…" : "Enregistrer"}
            </button>
            <button type="button" onClick={() => setOuvert(false)} className={boutonSecondaire}>
              Annuler
            </button>
            <Retour etat={etat} />
          </div>
        </form>
      )}
    </div>
  );
}

// ---------- Évaluation (enseignant) ----------

export function FormEvaluation(props: Cellule & { niveau: string; note: number | null; commentaire: string }) {
  const [etat, action, enCours] = useActionConservee(evaluer, null);
  const [niveau, setNiveau] = useState(props.niveau);
  const evalue = niveau !== "non_evalue";
  return (
    <form onSubmit={action} className="space-y-3">
      <ChampsCellule {...props} />
      <fieldset className="space-y-1.5">
        <legend className="mb-1 text-sm font-medium">Niveau atteint</legend>
        {NIVEAUX_EVALUATION.map((n) => (
          <label key={n.code} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="niveau"
              value={n.code}
              defaultChecked={props.niveau === n.code}
              onChange={() => setNiveau(n.code)}
              className="accent-[var(--primary)]"
            />
            {n.libelle}
          </label>
        ))}
      </fieldset>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">
          Note sur {NOTE_MAX} {evalue && <span className="text-red-700">*</span>}
        </span>
        <span className="flex items-center gap-2">
          <input
            name="note"
            inputMode="decimal"
            // Accepte la virgule (12,5) comme le point.
            pattern="\d{1,2}([.,]\d{1,2})?"
            required={evalue}
            disabled={!evalue}
            defaultValue={props.note !== null ? String(props.note).replace(".", ",") : ""}
            placeholder={evalue ? "ex. 13,5" : "—"}
            title={`Nombre entre 0 et ${NOTE_MAX}, virgule acceptée`}
            className={`${champ} w-24`}
          />
          <span className="whitespace-nowrap text-sm text-muted">/ {NOTE_MAX}</span>
        </span>
        {evalue && <span className="mt-1 block text-xs text-muted">Obligatoire : la note accompagne le niveau qualitatif.</span>}
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Commentaire</span>
        <textarea name="commentaire" rows={5} defaultValue={props.commentaire} className={champ} placeholder="Points forts, axes de progrès, éléments attendus…" />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button className={boutonSecondaire} disabled={enCours}>
          Enregistrer le brouillon
        </button>
        <button name="publier" value="1" className={bouton} disabled={enCours}>
          {enCours ? "Enregistrement…" : "Enregistrer et publier"}
        </button>
      </div>
      <Retour etat={etat} />
    </form>
  );
}

export function FormRendezVous(props: {
  etudiantId: string;
  annee: number;
  numero: number;
  date: string | null;
  note: number | null;
  commentaire: string;
}) {
  const [etat, action, enCours] = useActionConservee(enregistrerRendezVousAction, null);
  return (
    <form onSubmit={action} className="space-y-3">
      <input type="hidden" name="etudiant" value={props.etudiantId} />
      <input type="hidden" name="annee" value={props.annee} />
      <input type="hidden" name="numero" value={props.numero} />
      <div className="flex flex-wrap gap-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Date</span>
          <input type="date" name="date" defaultValue={props.date ?? ""} className={`${champ} w-auto`} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">
            Note sur {NOTE_MAX} <span className="text-red-700">*</span>
          </span>
          <span className="flex items-center gap-2">
            <input
              name="note"
              inputMode="decimal"
              pattern="\d{1,2}([.,]\d{1,2})?"
              required
              defaultValue={props.note !== null ? String(props.note).replace(".", ",") : ""}
              placeholder="ex. 14"
              title={`Nombre entre 0 et ${NOTE_MAX}, virgule acceptée`}
              className={`${champ} w-24`}
            />
            <span className="whitespace-nowrap text-sm text-muted">/ {NOTE_MAX}</span>
          </span>
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Compte rendu</span>
        <textarea name="commentaire" rows={4} defaultValue={props.commentaire} className={champ} placeholder="Points abordés, progrès, objectifs pour la suite…" />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button className={boutonSecondaire} disabled={enCours}>
          Enregistrer le brouillon
        </button>
        <button name="publier" value="1" className={bouton} disabled={enCours}>
          {enCours ? "Enregistrement…" : "Enregistrer et publier"}
        </button>
      </div>
      <Retour etat={etat} />
    </form>
  );
}

export function FormPublierAnnee({ etudiantId, annee, enAttente }: { etudiantId: string; annee: number; enAttente: number }) {
  const [etat, action, enCours] = useActionConservee(publierAnnee, null);
  return (
    <form onSubmit={action} className="no-print flex flex-wrap items-center gap-3">
      <input type="hidden" name="etudiant" value={etudiantId} />
      <input type="hidden" name="annee" value={annee} />
      <button className={enAttente ? bouton : boutonSecondaire} disabled={enCours || enAttente === 0}>
        {enAttente > 1 ? `Publier les ${enAttente} notes en brouillon` : enAttente === 1 ? "Publier la note en brouillon" : "Tout est publié"}
      </button>
      <Retour etat={etat} />
    </form>
  );
}

// Marque les notifications comme lues après affichage : les pastilles restent visibles pendant la lecture.
export function MarqueurNotificationsLues(): null {
  useEffect(() => {
    lireNotifications();
  }, []);
  return null;
}

// Enregistre la visite de l'enseignant après affichage, pour que les badges « nouveau » restent visibles pendant la consultation.
export function MarqueurConsultation({ etudiantId }: { etudiantId: string }) {
  useEffect(() => {
    marquerPortfolioConsulte(etudiantId);
  }, [etudiantId]);
  return null;
}
