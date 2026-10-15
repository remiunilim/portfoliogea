import {
  brouillonNonPublie,
  rendezVousNonPublie,
  type Argumentaire,
  type EntreeJournal,
  type Evaluation,
  type RendezVous,
  type Trace,
  type Utilisateur,
} from "@/lib/db";
import { estEnseignant, peutModifier, suitEtudiant } from "@/lib/session";
import {
  codeAC,
  competencesDeLAnnee,
  formatNote,
  GUIDE_ARGUMENTAIRE,
  infosParcours,
  libelleEvaluation,
  MAX_TRACES_PAR_COMPETENCE,
  noteFinale,
  POIDS_COMPETENCE,
  pourcentage,
  RENDEZ_VOUS,
  type AnneeBUT,
  type Competence,
} from "@/lib/referentiel";
import {
  COULEURS_COMPETENCE,
  COULEURS_EVALUATION,
  dateCourte,
  dateRelative,
  LIBELLES_JOURNAL,
  nbMots,
  taille,
} from "@/lib/affichage";
import {
  EditionTrace,
  FormArgumentaire,
  FormEvaluation,
  FormNouvelleTrace,
  FormPresentation,
  FormPublierAnnee,
  FormRendezVous,
} from "./formulaires";

export type DonneesPortfolio = {
  etudiant: Utilisateur;
  presentation?: { texte: string; projet_pro: string; maj_le: string };
  argumentaires: Argumentaire[];
  traces: Trace[];
  evaluations: Evaluation[];
  rendezVous: RendezVous[];
  journal: (EntreeJournal & { acteur_nom: string; acteur_role: string })[];
  modifsEtudiant: Map<string, string>;
  derniereVisite: string | null;
};

function Carte({ titre, children, className = "" }: { titre?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-line bg-surface p-5 ${className}`}>
      {titre && <h2 className="mb-3 text-base font-semibold">{titre}</h2>}
      {children}
    </section>
  );
}

// Niveau qualitatif, suivi de la note sur 20 quand elle existe.
// « compact » : le libellé peut passer à la ligne (cellules étroites du tableau de suivi).
export function BadgeEvaluation({ niveau, note, compact = false }: { niveau: string; note?: number | null; compact?: boolean }) {
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        compact ? "max-w-full whitespace-normal text-center leading-tight" : "whitespace-nowrap"
      } ${COULEURS_EVALUATION[niveau] ?? COULEURS_EVALUATION.non_evalue}`}
    >
      {libelleEvaluation(niveau)}
      {niveau !== "non_evalue" && note !== null && note !== undefined && <span className="ml-1 font-semibold">· {formatNote(note)}</span>}
    </span>
  );
}

function StatutPublication({ evaluation }: { evaluation?: Evaluation }) {
  if (!evaluation || evaluation.niveau === "non_evalue") {
    return <p className="mb-3 text-xs text-muted">Non évalué. L&apos;étudiant·e ne voit l&apos;évaluation qu&apos;une fois publiée.</p>;
  }
  if (evaluation.note === null) {
    return (
      <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs text-red-800">
        Note manquante : saisissez la note sur 20 pour pouvoir publier cette évaluation.
      </p>
    );
  }
  if (!evaluation.publiee_le) {
    return <p className="mb-3 rounded-md bg-slate-100 px-3 py-2 text-xs text-slate-700">Brouillon non publié : invisible pour l&apos;étudiant·e.</p>;
  }
  if (brouillonNonPublie(evaluation)) {
    return (
      <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
        Modifications non publiées. L&apos;étudiant·e voit encore : {libelleEvaluation(evaluation.niveau_publie ?? "")}
        {evaluation.note_publiee !== null && ` · ${formatNote(evaluation.note_publiee)}`} (publiée le {dateCourte(evaluation.publiee_le)}).
      </p>
    );
  }
  return (
    <p className="mb-3 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
      Publiée le {dateCourte(evaluation.publiee_le)} : visible par l&apos;étudiant·e.
    </p>
  );
}

// ---------- Présentation ----------

export function VuePresentation({ donnees, utilisateur }: { donnees: DonneesPortfolio; utilisateur: Utilisateur }) {
  const { etudiant, presentation } = donnees;
  const modifiable = peutModifier(utilisateur, etudiant.id);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <Carte titre="Présentation de l'étudiant·e">
        {modifiable ? (
          <FormPresentation etudiantId={etudiant.id} texte={presentation?.texte ?? ""} projetPro={presentation?.projet_pro ?? ""} />
        ) : presentation ? (
          <div className="space-y-4 text-sm leading-relaxed">
            <p className="whitespace-pre-wrap">{presentation.texte || <em className="text-muted">Non renseigné</em>}</p>
            <div>
              <h3 className="mb-1 font-medium">Projet professionnel</h3>
              <p className="whitespace-pre-wrap">{presentation.projet_pro || <em className="text-muted">Non renseigné</em>}</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">L&apos;étudiant·e n&apos;a pas encore rédigé sa présentation.</p>
        )}
        {presentation && <p className="mt-4 text-xs text-muted">Dernière mise à jour : {dateCourte(presentation.maj_le)}</p>}
      </Carte>
      <Carte titre="Le portfolio en bref" className="h-fit text-sm">
        <ul className="space-y-2 text-muted">
          <li>Un onglet par compétence : un <strong className="text-foreground">argumentaire</strong> réflexif et 1 à {MAX_TRACES_PAR_COMPETENCE} <strong className="text-foreground">traces PDF</strong> qui l&apos;appuient.</li>
          <li>Les compétences et niveaux attendus changent selon l&apos;année (BUT1, BUT2, BUT3).</li>
          <li>Les années précédentes restent consultables et peuvent être complétées.</li>
          <li>L&apos;onglet « Portfolio complet » rassemble l&apos;ensemble pour la lecture et l&apos;évaluation.</li>
        </ul>
      </Carte>
    </div>
  );
}

// ---------- Onglet compétence ----------

export function VueCompetence({
  donnees,
  utilisateur,
  annee,
  competence,
}: {
  donnees: DonneesPortfolio;
  utilisateur: Utilisateur;
  annee: AnneeBUT;
  competence: Competence;
}) {
  const { etudiant } = donnees;
  const niveau = competence.niveaux[annee]!;
  const couleur = COULEURS_COMPETENCE[competence.code];
  const modifiable = peutModifier(utilisateur, etudiant.id, annee);
  const enseignant = estEnseignant(utilisateur);
  const cellule = { etudiantId: etudiant.id, annee, competence: competence.code };
  const argumentaire = donnees.argumentaires.find((a) => a.annee === annee && a.competence === competence.code);
  const traces = donnees.traces.filter((t) => t.annee === annee && t.competence === competence.code);
  const evaluation = donnees.evaluations.find((e) => e.annee === annee && e.competence === competence.code);
  const derniereModif = donnees.modifsEtudiant.get(`${annee}-${competence.code}`);
  const modifieApresEval = evaluation && derniereModif && derniereModif > evaluation.maj_le;
  const journal = donnees.journal.filter((j) => j.annee === annee && j.competence === competence.code);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <div className={`rounded-xl border ${couleur.bord} ${couleur.fond} p-5`}>
          <div className={`text-xs font-semibold uppercase tracking-wide ${couleur.texte}`}>
            {competence.code} · {competence.troncCommun ? "Tronc commun" : `Parcours ${infosParcours(etudiant.parcours).code}`} · BUT{annee}
          </div>
          <h2 className="mt-1 text-xl font-semibold">{competence.intitule}</h2>
          <p className="mt-1 text-sm">
            Niveau {niveau.niveau} — <strong>{niveau.libelle}</strong>
          </p>
        </div>

        <Carte
          titre={
            <span className="flex items-center justify-between">
              Argumentaire
              {argumentaire && <span className="text-xs font-normal text-muted">Modifié {dateRelative(argumentaire.maj_le)}</span>}
            </span>
          }
        >
          {modifiable ? (
            <FormArgumentaire {...cellule} texte={argumentaire?.texte ?? ""} />
          ) : argumentaire?.texte ? (
            <>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{argumentaire.texte}</p>
              <p className="mt-3 text-xs text-muted">{nbMots(argumentaire.texte)} mots</p>
            </>
          ) : (
            <p className="text-sm text-muted">Aucun argumentaire déposé.</p>
          )}
        </Carte>

        <Carte
          titre={
            <span className="flex items-center justify-between">
              Traces
              <span className="text-xs font-normal text-muted">
                {traces.length} / {MAX_TRACES_PAR_COMPETENCE}
              </span>
            </span>
          }
        >
          {traces.length === 0 && <p className="mb-3 text-sm text-muted">Aucune trace déposée.</p>}
          <ul className="space-y-3">
            {traces.map((t) => (
              <CarteTrace key={t.id} trace={t} modifiable={modifiable} />
            ))}
          </ul>
          {modifiable && traces.length < MAX_TRACES_PAR_COMPETENCE && (
            <div className="mt-4">
              <FormNouvelleTrace {...cellule} />
            </div>
          )}
        </Carte>
      </div>

      <aside className="space-y-6">
        {enseignant ? (
          <Carte titre="Évaluation">
            <StatutPublication evaluation={evaluation} />
            {evaluation && modifieApresEval && (
              <p className="mb-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
                L&apos;étudiant·e a modifié ce dépôt après la dernière évaluation ({dateRelative(evaluation.maj_le)}).
              </p>
            )}
            <FormEvaluation
              {...cellule}
              niveau={evaluation?.niveau ?? "non_evalue"}
              note={evaluation?.note ?? null}
              commentaire={evaluation?.commentaire ?? ""}
            />
          </Carte>
        ) : (
          evaluation?.publiee_le &&
          evaluation.niveau_publie && (
            <Carte titre="Retour de l'enseignant·e">
              <BadgeEvaluation niveau={evaluation.niveau_publie} note={evaluation.note_publiee} />
              {evaluation.commentaire_publie && <p className="mt-3 whitespace-pre-wrap text-sm">{evaluation.commentaire_publie}</p>}
              <p className="mt-3 text-xs text-muted">Publiée le {dateCourte(evaluation.publiee_le)}</p>
            </Carte>
          )
        )}

        <Carte titre="Apprentissages critiques visés" className="text-sm">
          <ul className="space-y-1.5">
            {niveau.apprentissagesCritiques.map((ac, i) => (
              <li key={ac} className="flex gap-2">
                <span className="shrink-0 font-mono text-xs font-semibold leading-5 text-primary">{codeAC(competence, annee, i)}</span>
                <span>{ac}</span>
              </li>
            ))}
          </ul>
          <details className="mt-4">
            <summary className="cursor-pointer text-xs font-medium text-primary">Composantes essentielles et situations professionnelles</summary>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted">
              {competence.composantes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted">
              {competence.situations.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </details>
        </Carte>

        {!enseignant && (
          <Carte titre="Structurer son argumentaire" className="text-sm">
            <ol className="space-y-2">
              {GUIDE_ARGUMENTAIRE.map((g, i) => (
                <li key={g.etape}>
                  <span className="font-medium">
                    {i + 1}. {g.etape}
                  </span>
                  <span className="block text-muted">{g.question}</span>
                </li>
              ))}
            </ol>
          </Carte>
        )}

        {enseignant && (
          <Carte titre="Historique de ce dépôt" className="text-sm">
            <Journal entrees={journal} sansCompetence />
          </Carte>
        )}
      </aside>
    </div>
  );
}

function CarteTrace({ trace, modifiable }: { trace: Trace; modifiable: boolean }) {
  return (
    <li className="rounded-lg border border-line p-3">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-9 shrink-0 place-items-center rounded bg-red-50 text-[10px] font-bold text-red-700">PDF</span>
        <div className="min-w-0 flex-1">
          <div className="font-medium">{trace.titre}</div>
          {trace.description && <div className="text-sm text-muted">{trace.description}</div>}
          <div className="mt-1 text-xs text-muted">
            {trace.fichier_nom} · {taille(trace.taille)} · déposée le {dateCourte(trace.depose_le)}
            {trace.maj_le !== trace.depose_le && ` · modifiée ${dateRelative(trace.maj_le)}`}
          </div>
        </div>
        <a href={`/fichiers/${trace.id}`} target="_blank" className="shrink-0 rounded-md border border-line px-3 py-1.5 text-sm hover:bg-background">
          Ouvrir
        </a>
      </div>
      <details className="no-print mt-2">
        <summary className="cursor-pointer text-xs text-primary">Aperçu</summary>
        <iframe src={`/fichiers/${trace.id}`} title={trace.titre} className="mt-2 h-[480px] w-full rounded border border-line" />
      </details>
      {modifiable && (
        <div className="mt-2">
          <EditionTrace traceId={trace.id} titre={trace.titre} description={trace.description} />
        </div>
      )}
    </li>
  );
}

// ---------- Rendez-vous de suivi et notes finales ----------

// Synthèse des notes d'une année. « publie » : uniquement ce que l'étudiant voit ;
// sinon les brouillons du référent (calcul provisoire).
export function SyntheseNotes({ donnees, annee, publie }: { donnees: DonneesPortfolio; annee: AnneeBUT; publie: boolean }) {
  const rdv = (numero: number) => {
    const r = donnees.rendezVous.find((x) => x.annee === annee && x.numero === numero);
    return publie ? (r?.note_publiee ?? null) : (r?.note ?? null);
  };
  const [rdv1, rdv2] = [rdv(1), rdv(2)];
  const cellule = (n: number | null) => (n === null ? <span className="text-slate-400">—</span> : formatNote(n));
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="text-left text-xs text-muted">
          <tr className="border-b border-line">
            <th className="px-4 py-2.5 font-medium">Compétence</th>
            <th className="px-3 py-2.5 font-medium">Niveau</th>
            <th className="px-3 py-2.5 text-center font-medium">Compétence ({pourcentage(POIDS_COMPETENCE)})</th>
            <th className="px-3 py-2.5 text-center font-medium">RDV 1 ({pourcentage(RENDEZ_VOUS[0].poids)})</th>
            <th className="px-3 py-2.5 text-center font-medium">RDV 2 ({pourcentage(RENDEZ_VOUS[1].poids)})</th>
            <th className="px-4 py-2.5 text-center font-semibold text-foreground">Note finale</th>
          </tr>
        </thead>
        <tbody>
          {competencesDeLAnnee(annee, donnees.etudiant.parcours).map((c) => {
            const ev = donnees.evaluations.find((e) => e.annee === annee && e.competence === c.code);
            const niveau = (publie ? ev?.niveau_publie : ev?.niveau) ?? "non_evalue";
            const note = publie ? (ev?.note_publiee ?? null) : (ev?.note ?? null);
            const finale = noteFinale(note, rdv1, rdv2);
            return (
              <tr key={c.code} className="border-b border-line last:border-0">
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-2">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${COULEURS_COMPETENCE[c.code].pastille}`} />
                    <span>
                      <strong>{c.code}</strong> {c.nomCourt}
                    </span>
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <BadgeEvaluation niveau={niveau} />
                </td>
                <td className="px-3 py-2.5 text-center tabular-nums">{cellule(note)}</td>
                <td className="px-3 py-2.5 text-center tabular-nums">{cellule(rdv1)}</td>
                <td className="px-3 py-2.5 text-center tabular-nums">{cellule(rdv2)}</td>
                <td className="px-4 py-2.5 text-center text-base font-semibold tabular-nums">
                  {finale === null ? <span className="text-xs font-normal text-slate-400">en attente</span> : formatNote(finale)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="border-t border-line px-4 py-2.5 text-xs text-muted">
        Note finale = {pourcentage(RENDEZ_VOUS[0].poids)} × RDV 1 + {pourcentage(RENDEZ_VOUS[1].poids)} × RDV 2 + {pourcentage(POIDS_COMPETENCE)} × note de la
        compétence. Elle s&apos;affiche quand les trois notes sont {publie ? "publiées" : "saisies"}.
        {!publie && " Calcul provisoire sur les brouillons : l'étudiant·e ne voit que les notes publiées."}
      </p>
    </div>
  );
}

export async function VueSuivi({ donnees, utilisateur, annee }: { donnees: DonneesPortfolio; utilisateur: Utilisateur; annee: AnneeBUT }) {
  const { etudiant } = donnees;
  const enseignant = await suitEtudiant(utilisateur, etudiant.id);
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        {RENDEZ_VOUS.map((def) => {
          const r = donnees.rendezVous.find((x) => x.annee === annee && x.numero === def.numero);
          return (
            <Carte
              key={def.numero}
              titre={
                <span className="flex items-center justify-between gap-2">
                  {def.libelle}
                  <span className="text-xs font-normal text-muted">{pourcentage(def.poids)} de chaque note finale</span>
                </span>
              }
            >
              {enseignant ? (
                <>
                  {r && (
                    <p
                      className={`mb-3 rounded-md px-3 py-2 text-xs ${
                        !r.publie_le ? "bg-slate-100 text-slate-700" : rendezVousNonPublie(r) ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-800"
                      }`}
                    >
                      {!r.publie_le
                        ? "Brouillon non publié : invisible pour l'étudiant·e."
                        : rendezVousNonPublie(r)
                          ? `Modifications non publiées. L'étudiant·e voit encore ${formatNote(r.note_publiee)}.`
                          : `Publié le ${dateCourte(r.publie_le)} : visible par l'étudiant·e.`}
                    </p>
                  )}
                  <FormRendezVous
                    etudiantId={etudiant.id}
                    annee={annee}
                    numero={def.numero}
                    date={r?.date_rdv ?? null}
                    note={r?.note ?? null}
                    commentaire={r?.commentaire ?? ""}
                  />
                </>
              ) : r?.publie_le && r.note_publiee !== null ? (
                <div className="space-y-2 text-sm">
                  <p className="text-2xl font-semibold tabular-nums">{formatNote(r.note_publiee)}</p>
                  {r.date_rdv && <p className="text-xs text-muted">Rendez-vous du {dateCourte(r.date_rdv)}</p>}
                  {r.commentaire_publie && <p className="whitespace-pre-wrap">{r.commentaire_publie}</p>}
                </div>
              ) : (
                <p className="text-sm text-muted">Pas encore de note publiée pour ce rendez-vous.</p>
              )}
            </Carte>
          );
        })}
      </div>

      <section className="space-y-2">
        <h2 className="text-base font-semibold">Notes finales par compétence · BUT{annee}</h2>
        <SyntheseNotes donnees={donnees} annee={annee} publie={!enseignant} />
        {enseignant && (
          <div className="pt-2">
            <FormPublierAnnee etudiantId={etudiant.id} annee={annee} enAttente={notesEnAttente(donnees, annee)} />
          </div>
        )}
      </section>
    </div>
  );
}

// Brouillons publiables d'une année : évaluations notées et rendez-vous modifiés.
function notesEnAttente(donnees: DonneesPortfolio, annee: number) {
  return (
    donnees.evaluations.filter((e) => e.annee === annee && e.niveau !== "non_evalue" && e.note !== null && brouillonNonPublie(e)).length +
    donnees.rendezVous.filter((r) => r.annee === annee && rendezVousNonPublie(r)).length
  );
}

// ---------- Portfolio complet ----------

export async function VueComplete({
  donnees,
  utilisateur,
  anneeMax,
}: {
  donnees: DonneesPortfolio;
  utilisateur: Utilisateur;
  anneeMax: AnneeBUT;
}) {
  const { etudiant, presentation } = donnees;
  const annees = ([1, 2, 3] as AnneeBUT[]).filter((a) => a <= anneeMax);
  const enseignant = await suitEtudiant(utilisateur, etudiant.id);
  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4">
        <p className="text-sm text-muted">
          Le PDF réunit la présentation, les argumentaires, les évaluations publiées et toutes les traces, dans l&apos;ordre des compétences.
        </p>
        <div className="flex gap-2">
          <a href={`/export/${etudiant.id}?apercu`} target="_blank" className="rounded-md border border-line px-4 py-2 text-sm hover:bg-background">
            Ouvrir
          </a>
          <a href={`/export/${etudiant.id}`} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90">
            Télécharger le portfolio (PDF)
          </a>
        </div>
      </div>

      <Carte>
        <h2 className="text-xl font-semibold">
          {etudiant.prenom} {etudiant.nom}
        </h2>
        <p className="text-sm text-muted">
          BUT{anneeMax} GEA · parcours {infosParcours(etudiant.parcours).code} · {etudiant.email}
        </p>
        {presentation ? (
          <div className="mt-4 grid gap-4 text-sm leading-relaxed sm:grid-cols-2">
            <p className="whitespace-pre-wrap">{presentation.texte}</p>
            <div>
              <h3 className="mb-1 font-medium">Projet professionnel</h3>
              <p className="whitespace-pre-wrap">{presentation.projet_pro}</p>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted">Présentation non renseignée.</p>
        )}
      </Carte>

      {annees.map((annee) => (
        <section key={annee} className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-2">
            <h2 className="text-lg font-semibold">BUT{annee}</h2>
            {enseignant && (
              <FormPublierAnnee
                etudiantId={etudiant.id}
                annee={annee}
                enAttente={notesEnAttente(donnees, annee)}
              />
            )}
          </div>
          {competencesDeLAnnee(annee, donnees.etudiant.parcours).map((c) => {
            const arg = donnees.argumentaires.find((a) => a.annee === annee && a.competence === c.code);
            const traces = donnees.traces.filter((t) => t.annee === annee && t.competence === c.code);
            const ev = donnees.evaluations.find((e) => e.annee === annee && e.competence === c.code);
            const couleur = COULEURS_COMPETENCE[c.code];
            return (
              <article key={c.code} className="break-inside-avoid rounded-xl border border-line bg-surface p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className={`text-xs font-semibold uppercase ${couleur.texte}`}>
                      {c.code} · Niveau {c.niveaux[annee]!.niveau} — {c.niveaux[annee]!.libelle}
                    </div>
                    <h3 className="font-semibold">{c.intitule}</h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {enseignant && ev && ev.niveau !== "non_evalue" && brouillonNonPublie(ev) && (
                      <span className="rounded-full border border-dashed border-slate-300 px-2.5 py-0.5 text-xs text-muted">
                        Brouillon : {libelleEvaluation(ev.niveau)}
                        {ev.note !== null && ` · ${formatNote(ev.note)}`}
                      </span>
                    )}
                    <BadgeEvaluation niveau={ev?.niveau_publie ?? "non_evalue"} note={ev?.note_publiee} />
                  </div>
                </div>
                <div className="mt-3 text-sm leading-relaxed">
                  {arg?.texte ? <p className="whitespace-pre-wrap">{arg.texte}</p> : <p className="text-muted">Aucun argumentaire.</p>}
                </div>
                <div className="mt-3">
                  <div className="mb-1 text-xs font-medium uppercase text-muted">Traces</div>
                  {traces.length ? (
                    <ul className="space-y-1 text-sm">
                      {traces.map((t) => (
                        <li key={t.id}>
                          <a href={`/fichiers/${t.id}`} target="_blank" className="text-primary hover:underline">
                            {t.titre}
                          </a>
                          {t.description && <span className="text-muted"> — {t.description}</span>}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted">Aucune trace.</p>
                  )}
                </div>
                {ev?.publiee_le && ev.commentaire_publie && (
                  <div className="mt-3 rounded-md bg-background p-3 text-sm">
                    <span className="font-medium">Commentaire de l&apos;enseignant·e : </span>
                    {ev.commentaire_publie}
                  </div>
                )}
              </article>
            );
          })}
          <div className="space-y-2 break-inside-avoid">
            <h3 className="text-sm font-semibold">Rendez-vous de suivi et notes finales · BUT{annee}</h3>
            <SyntheseNotes donnees={donnees} annee={annee} publie />
          </div>
        </section>
      ))}

      {enseignant && (
        <Carte titre="Journal complet des dépôts et modifications" className="no-print text-sm">
          <Journal entrees={donnees.journal} />
        </Carte>
      )}
    </div>
  );
}

// ---------- Journal ----------

export function Journal({
  entrees,
  sansCompetence = false,
  avecEtudiant = false,
}: {
  entrees: (EntreeJournal & { acteur_nom: string; acteur_role: string; etudiant_nom?: string })[];
  sansCompetence?: boolean;
  avecEtudiant?: boolean;
}) {
  if (entrees.length === 0) return <p className="text-muted">Aucune activité.</p>;
  return (
    <ol className="space-y-2.5">
      {entrees.map((e) => {
        const parEnseignant = e.acteur_role !== "etudiant";
        return (
          <li key={e.id} className="flex gap-2.5">
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${parEnseignant ? "bg-primary" : e.competence ? COULEURS_COMPETENCE[e.competence]?.pastille : "bg-slate-400"}`} />
            <div className="min-w-0">
              <div>
                <span className="font-medium">{avecEtudiant && !parEnseignant ? e.etudiant_nom : e.acteur_nom}</span>{" "}
                {LIBELLES_JOURNAL[e.type] ?? e.type}
                {!sansCompetence && e.competence && (
                  <span className="text-muted">
                    {" "}
                    · {e.competence} BUT{e.annee}
                  </span>
                )}
                {avecEtudiant && parEnseignant && <span className="text-muted"> · {e.etudiant_nom}</span>}
              </div>
              <div className="text-xs text-muted">
                {e.detail && <span>{e.detail} · </span>}
                {dateRelative(e.cree_le)}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
