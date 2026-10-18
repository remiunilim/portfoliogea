// Libellés et formats partagés par les vues.

export const LIBELLES_JOURNAL: Record<string, string> = {
  presentation_maj: "a mis à jour sa présentation",
  presentation_publiee: "a publié sa présentation",
  argumentaire_cree: "a rédigé l'argumentaire",
  argumentaire_maj: "a modifié l'argumentaire",
  depot_publie: "a publié son dépôt",
  trace_ajoutee: "a déposé une trace",
  trace_modifiee: "a modifié une trace",
  trace_remplacee: "a remplacé le fichier d'une trace",
  trace_supprimee: "a supprimé une trace",
  evaluation: "a évalué",
  evaluation_publiee: "a publié l'évaluation",
  rendez_vous: "a noté un rendez-vous de suivi",
  rendez_vous_publie: "a publié la note d'un rendez-vous de suivi",
  passage_annee: "a fait passer l'étudiant·e d'année",
  compte_modifie: "a modifié le compte",
};

export const COULEURS_COMPETENCE: Record<string, { pastille: string; texte: string; fond: string; bord: string }> = {
  C1: { pastille: "bg-sky-600", texte: "text-sky-800", fond: "bg-sky-50", bord: "border-sky-200" },
  C2: { pastille: "bg-amber-500", texte: "text-amber-800", fond: "bg-amber-50", bord: "border-amber-200" },
  C3: { pastille: "bg-emerald-600", texte: "text-emerald-800", fond: "bg-emerald-50", bord: "border-emerald-200" },
  C4: { pastille: "bg-violet-600", texte: "text-violet-800", fond: "bg-violet-50", bord: "border-violet-200" },
  C5: { pastille: "bg-rose-600", texte: "text-rose-800", fond: "bg-rose-50", bord: "border-rose-200" },
};

export const COULEURS_EVALUATION: Record<string, string> = {
  non_evalue: "bg-slate-100 text-slate-600 border-slate-200",
  insuffisant: "bg-red-50 text-red-700 border-red-200",
  en_cours: "bg-amber-50 text-amber-800 border-amber-200",
  acquis: "bg-emerald-50 text-emerald-800 border-emerald-200",
  depasse: "bg-sky-50 text-sky-800 border-sky-200",
};

const formatDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });
const formatDateHeure = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function dateCourte(iso: string) {
  return formatDate.format(new Date(iso));
}

export function dateRelative(iso: string) {
  const secondes = (Date.now() - new Date(iso).getTime()) / 1000;
  if (secondes < 60) return "à l'instant";
  if (secondes < 3600) return `il y a ${Math.floor(secondes / 60)} min`;
  if (secondes < 86400) return `il y a ${Math.floor(secondes / 3600)} h`;
  if (secondes < 7 * 86400) return `il y a ${Math.floor(secondes / 86400)} j`;
  return formatDateHeure.format(new Date(iso));
}

export function taille(octets: number) {
  return octets < 1024 * 1024 ? `${Math.max(1, Math.round(octets / 1024))} Ko` : `${(octets / 1024 / 1024).toFixed(1)} Mo`;
}

export function nbMots(t: string) {
  return t.trim() ? t.trim().split(/\s+/).length : 0;
}

// ---------- Visibilité des dépôts (brouillon/publié) ----------
// Tant qu'un·e étudiant·e n'a pas publié une compétence (ou sa présentation), son référent ne doit
// rien en voir : ni le contenu (argumentaire, traces), ni même la trace de son activité dans le
// journal. Une fois publié, le dépôt reste visible, y compris les modifications ultérieures
// (pas besoin de republier).

export function cleDepot(annee: number, competence: string) {
  return `${annee}-${competence}`;
}

export function depotsPublieSet(depots: { annee: number; competence: string }[]): Set<string> {
  return new Set(depots.map((d) => cleDepot(d.annee, d.competence)));
}

const TYPES_JOURNAL_BROUILLON_COMPETENCE = new Set([
  "argumentaire_cree",
  "argumentaire_maj",
  "trace_ajoutee",
  "trace_modifiee",
  "trace_remplacee",
  "trace_supprimee",
]);

export function entreeJournalVisible(
  j: { annee: number | null; competence: string | null; type: string },
  depotsPublies: Set<string>,
  presentationPubliee: boolean,
): boolean {
  if (j.competence !== null) {
    return !TYPES_JOURNAL_BROUILLON_COMPETENCE.has(j.type) || depotsPublies.has(cleDepot(j.annee!, j.competence));
  }
  if (j.type === "presentation_maj") return presentationPubliee;
  return true;
}

export function journalVisible<T extends { annee: number | null; competence: string | null; type: string }>(
  entrees: T[],
  depotsPublies: Set<string>,
  presentationPubliee: boolean,
): T[] {
  return entrees.filter((j) => entreeJournalVisible(j, depotsPublies, presentationPubliee));
}
