import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { EnTete } from "@/components/EnTete";
import { MarqueurConsultation } from "@/components/formulaires";
import { VueCompetence, VueComplete, VuePresentation, VueSuivi, type DonneesPortfolio } from "@/components/portfolio";
import {
  getArgumentaires,
  getDepots,
  getRendezVous,
  getDerniereConsultation,
  getDernieresModifsEtudiant,
  getEvaluations,
  getJournal,
  getPresentation,
  getTraces,
  getUtilisateur,
} from "@/lib/db";
import { estEnseignant, peutConsulter, peutModifier, utilisateurCourant } from "@/lib/session";
import { ANNEES, competencesDeLAnnee, estAnneeBUT, infosParcours, parcoursEstConfigure, type AnneeBUT } from "@/lib/referentiel";
import { cleDepot, COULEURS_COMPETENCE, depotsPublieSet, journalVisible } from "@/lib/affichage";

export default async function PagePortfolio(props: PageProps<"/portfolio/[etudiantId]">) {
  const { etudiantId } = await props.params;
  const recherche = await props.searchParams;
  const u = await utilisateurCourant();
  if (!u) redirect("/connexion");
  const etudiant = await getUtilisateur(etudiantId);
  if (!etudiant || etudiant.role !== "etudiant") notFound();
  if (!(await peutConsulter(u, etudiantId))) redirect("/");

  const referent = etudiant.referent_id ? await getUtilisateur(etudiant.referent_id) : undefined;
  const anneeMax = (etudiant.annee_but ?? 1) as AnneeBUT;
  const anneeDemandee = Number(recherche.annee);
  const annee: AnneeBUT = estAnneeBUT(anneeDemandee) && anneeDemandee <= anneeMax ? anneeDemandee : anneeMax;
  const onglet = typeof recherche.onglet === "string" ? recherche.onglet : "presentation";
  const competences = competencesDeLAnnee(annee, etudiant.parcours);
  const parcours = infosParcours(etudiant.parcours);
  const competenceActive = competences.find((c) => c.code === onglet);

  const enseignant = estEnseignant(u);
  const derniereVisite = enseignant ? await getDerniereConsultation(u.id, etudiantId) : null;
  const presentation = await getPresentation(etudiantId);
  const depots = await getDepots(etudiantId);
  const depotsPublies = depotsPublieSet(depots);
  const donnees: DonneesPortfolio = {
    etudiant,
    presentation,
    argumentaires: await getArgumentaires(etudiantId),
    traces: await getTraces(etudiantId),
    evaluations: await getEvaluations(etudiantId),
    rendezVous: await getRendezVous(etudiantId),
    depots,
    journal: enseignant
      ? journalVisible(await getJournal({ etudiantId, limite: 200 }), depotsPublies, !!presentation?.publie_le)
      : [],
    modifsEtudiant: await getDernieresModifsEtudiant(etudiantId),
    derniereVisite,
  };

  // Tant que le dépôt n'est pas publié par l'étudiant·e, le référent ne doit rien en voir : les
  // indicateurs (pastille d'onglet, badge « Nouveau ») reflètent l'état publié, pas le brouillon réel.
  const etatCellule = (a: number, code: string) => {
    if (enseignant && !depotsPublies.has(cleDepot(a, code))) return "vide";
    const arg = donnees.argumentaires.find((x) => x.annee === a && x.competence === code)?.texte.trim();
    const nb = donnees.traces.filter((t) => t.annee === a && t.competence === code).length;
    return arg && nb ? "complet" : arg || nb ? "partiel" : "vide";
  };
  const estNouveau = (a: number, code: string) => {
    if (!enseignant || !depotsPublies.has(cleDepot(a, code))) return false;
    const modif = donnees.modifsEtudiant.get(`${a}-${code}`);
    return !!modif && (!derniereVisite || modif > derniereVisite);
  };
  const lien = (params: { annee?: number; onglet?: string }) =>
    `/portfolio/${etudiantId}?annee=${params.annee ?? annee}&onglet=${params.onglet ?? onglet}`;

  return (
    <>
      <EnTete utilisateur={u} />
      {enseignant && <MarqueurConsultation etudiantId={etudiantId} />}
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        {enseignant && (
          <Link href={`/enseignant?promo=${anneeMax}`} className="no-print mb-3 inline-block text-sm text-primary hover:underline">
            ← Tableau de la promotion BUT{anneeMax}
          </Link>
        )}

        <div className="no-print mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">
              {u.id === etudiantId ? "Mon portfolio" : `Portfolio de ${etudiant.prenom} ${etudiant.nom}`}
            </h1>
            <p className="text-sm text-muted">
              {[
                `BUT${anneeMax} GEA`,
                parcoursEstConfigure(etudiant.parcours)
                  ? `parcours ${parcours.code} (${parcours.intitule})`
                  : `parcours ${etudiant.parcours} (référentiel non configuré : ${parcours.code} affiché)`,
                etudiant.groupe,
                `référent·e : ${referent ? `${referent.prenom} ${referent.nom}` : "non affecté"}`,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-line bg-surface p-1" aria-label="Année de BUT">
            {ANNEES.map((a) => {
              const accessible = a <= anneeMax;
              const actif = a === annee;
              return accessible ? (
                <Link
                  key={a}
                  href={lien({ annee: a, onglet: ["presentation", "complet", "suivi"].includes(onglet) ? onglet : "presentation" })}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${actif ? "bg-primary text-white" : "hover:bg-primary-soft"}`}
                >
                  BUT{a}
                  {a < anneeMax && <span className={`ml-1 text-xs ${actif ? "text-white/80" : "text-muted"}`}>(historique)</span>}
                </Link>
              ) : (
                <span key={a} className="cursor-not-allowed rounded-md px-3 py-1.5 text-sm text-slate-400" title="Année pas encore commencée">
                  BUT{a}
                </span>
              );
            })}
          </div>
        </div>

        {peutModifier(u, etudiantId) && annee < anneeMax && competenceActive && (
          <div className="no-print mb-4 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-sm text-sky-900">
            Vous complétez l&apos;historique de votre BUT{annee}. Ces dépôts restent rattachés au niveau de compétence de BUT{annee}.
          </div>
        )}

        {/* Les onglets passent à la ligne plutôt que de défiler : pas de barre de défilement. */}
        <nav className="no-print mb-6 flex flex-wrap gap-x-1 border-b border-line" aria-label="Onglets du portfolio">
          <Onglet href={lien({ onglet: "presentation" })} actif={onglet === "presentation"}>
            Présentation
          </Onglet>
          {competences.map((c) => {
            const etat = etatCellule(annee, c.code);
            return (
              <Onglet key={c.code} href={lien({ onglet: c.code })} actif={onglet === c.code}>
                <span className={`h-2 w-2 rounded-full ${COULEURS_COMPETENCE[c.code].pastille}`} />
                {c.code} · {c.nomCourt}
                <span
                  title={etat === "complet" ? "Argumentaire et trace déposés" : etat === "partiel" ? "Dépôt incomplet" : "Rien déposé"}
                  className={`text-xs ${etat === "complet" ? "text-emerald-600" : etat === "partiel" ? "text-amber-600" : "text-slate-300"}`}
                >
                  {etat === "complet" ? "●" : etat === "partiel" ? "◐" : "○"}
                </span>
                {estNouveau(annee, c.code) && (
                  <span className="rounded bg-rose-600 px-1.5 text-[10px] font-semibold uppercase text-white">Nouveau</span>
                )}
              </Onglet>
            );
          })}
          <Onglet href={lien({ onglet: "suivi" })} actif={onglet === "suivi"}>
            Suivi et notes
          </Onglet>
          <Onglet href={lien({ onglet: "complet" })} actif={onglet === "complet"}>
            Portfolio complet
          </Onglet>
        </nav>

        {competenceActive ? (
          <VueCompetence
            key={`${annee}-${competenceActive.code}`}
            donnees={donnees}
            utilisateur={u}
            annee={annee}
            competence={competenceActive}
          />
        ) : onglet === "complet" ? (
          <VueComplete donnees={donnees} utilisateur={u} anneeMax={anneeMax} />
        ) : onglet === "suivi" ? (
          <VueSuivi donnees={donnees} utilisateur={u} annee={annee} />
        ) : (
          <VuePresentation donnees={donnees} utilisateur={u} />
        )}
      </main>
    </>
  );
}

function Onglet({ href, actif, children }: { href: string; actif: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={actif ? "page" : undefined}
      className={`-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-2.5 py-2.5 text-[13px] font-medium ${
        actif ? "border-primary text-primary" : "border-transparent text-muted hover:text-foreground"
      }`}
    >
      {children}
    </Link>
  );
}
