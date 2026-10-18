import Link from "next/link";
import { redirect } from "next/navigation";
import { EnTete } from "@/components/EnTete";
import { BadgeEvaluation, Journal } from "@/components/portfolio";
import {
  brouillonNonPublie,
  getArgumentaires,
  getDerniereConsultation,
  getDernieresModifsEtudiant,
  getEvaluations,
  getJournal,
  getRendezVous,
  getTraces,
  rendezVousNonPublie,
  listerEnseignants,
  listerEtudiants,
  type Utilisateur,
} from "@/lib/db";
import { estAdmin, estEnseignant, utilisateurCourant } from "@/lib/session";
import {
  ANNEES,
  competencesDeLAnnee,
  estAnneeBUT,
  formatNote,
  infosParcours,
  nomsCourtsParCode,
  PARCOURS_CONFIGURES,
  PARCOURS_PAR_DEFAUT,
  pourcentage,
  RENDEZ_VOUS,
  type AnneeBUT,
} from "@/lib/referentiel";
import { COULEURS_COMPETENCE, dateRelative } from "@/lib/affichage";

type EtatCellule = {
  depot: "vide" | "partiel" | "complet";
  nbTraces: number;
  aArgumentaire: boolean;
  evaluation?: string;
  note: number | null;
  publiee: boolean;
  nonPublie: boolean;
  nouveau: boolean;
  aRevoir: boolean;
  derniereModif?: string;
};

export default async function TableauEnseignant(props: PageProps<"/enseignant">) {
  const u = await utilisateurCourant();
  if (!u) redirect("/connexion");
  if (!estEnseignant(u)) redirect(`/portfolio/${u.id}`);

  const { promo: promoParam, referent: referentParam, parcours: parcoursParam } = await props.searchParams;
  const promoDemandee = Number(promoParam);
  const promo: AnneeBUT = estAnneeBUT(promoDemandee) ? promoDemandee : 1;
  const filtreParcours = typeof parcoursParam === "string" && PARCOURS_CONFIGURES[parcoursParam] ? parcoursParam : "";
  // Les codes C1 à C5 sont communs à tous les parcours ; seuls les intitulés de C4 et C5 changent.
  const competences = competencesDeLAnnee(promo, filtreParcours || PARCOURS_PAR_DEFAUT);
  const enTete = (code: string, nomParDefaut: string, troncCommun: boolean) =>
    troncCommun || filtreParcours ? nomParDefaut : "selon parcours";

  // Un enseignant ne voit que ses étudiants ; l'administrateur voit tout le monde et peut filtrer par référent.
  const admin = estAdmin(u);
  const enseignants = await listerEnseignants();
  const filtreReferent = admin ? (typeof referentParam === "string" ? referentParam : "") : u.id;
  const visible = (e: Utilisateur) =>
    (!filtreReferent || (filtreReferent === "aucun" ? !e.referent_id : e.referent_id === filtreReferent)) &&
    (!filtreParcours || infosParcours(e.parcours).code === filtreParcours);
  const etudiants = (await listerEtudiants({ anneeBut: promo })).filter(visible);
  const effectifs = Object.fromEntries(
    await Promise.all(ANNEES.map(async (a) => [a, (await listerEtudiants({ anneeBut: a })).filter(visible).length])),
  );
  const lienFiltre = (p: { promo?: number; referent?: string; parcours?: string }) => {
    const ref = p.referent ?? filtreReferent;
    const parc = p.parcours ?? filtreParcours;
    return `/enseignant?promo=${p.promo ?? promo}${admin && ref ? `&referent=${ref}` : ""}${parc ? `&parcours=${parc}` : ""}`;
  };
  const nomReferent = (id: string | null) => {
    const r = enseignants.find((e) => e.id === id);
    return r ? `${r.prenom} ${r.nom}` : "Sans référent";
  };
  const lienExport = (() => {
    const p = new URLSearchParams();
    if (admin && filtreReferent) p.set("referent", filtreReferent);
    if (filtreParcours) p.set("parcours", filtreParcours);
    const q = p.toString();
    return `/enseignant/export${q ? `?${q}` : ""}`;
  })();

  const lignes = await Promise.all(
    etudiants.map(async (etu) => {
      const args = await getArgumentaires(etu.id);
      const traces = await getTraces(etu.id);
      const evals = await getEvaluations(etu.id);
      const modifs = await getDernieresModifsEtudiant(etu.id);
      const vu = await getDerniereConsultation(u.id, etu.id);
      const cellules: Record<string, EtatCellule> = {};
      for (const c of competences) {
        const aArgumentaire = !!args.find((a) => a.annee === promo && a.competence === c.code)?.texte.trim();
        const nbTraces = traces.filter((t) => t.annee === promo && t.competence === c.code).length;
        const ev = evals.find((e) => e.annee === promo && e.competence === c.code);
        const derniereModif = modifs.get(`${promo}-${c.code}`);
        cellules[c.code] = {
          depot: aArgumentaire && nbTraces ? "complet" : aArgumentaire || nbTraces ? "partiel" : "vide",
          nbTraces,
          aArgumentaire,
          evaluation: ev?.niveau,
          note: ev?.note ?? null,
          publiee: !!ev?.publiee_le,
          nonPublie: !!ev && ev.niveau !== "non_evalue" && brouillonNonPublie(ev),
          nouveau: !!derniereModif && (!vu || derniereModif > vu),
          aRevoir: !!ev && !!derniereModif && derniereModif > ev.maj_le,
          derniereModif,
        };
      }
      // Années antérieures complétées après coup (historique BUT1/BUT2).
      const historique = [...modifs.entries()].filter(([cle]) => Number(cle.split("-")[0]) < promo).length;
      const rdv = (await getRendezVous(etu.id)).filter((r) => r.annee === promo);
      return { etu, cellules, historique, rdv };
    }),
  );

  const toutes = lignes.flatMap((l) => Object.values(l.cellules));
  const stats = {
    complets: toutes.filter((c) => c.depot === "complet").length,
    publiees: toutes.filter((c) => c.publiee).length,
    aPublier: toutes.filter((c) => c.nonPublie).length + lignes.flatMap((l) => l.rdv).filter(rendezVousNonPublie).length,
    nouveaux: toutes.filter((c) => c.nouveau).length,
    total: toutes.length,
  };
  const journal = (
    await getJournal({
      anneeBut: promo,
      referentId: filtreReferent && filtreReferent !== "aucun" ? filtreReferent : undefined,
      limite: 40,
    })
  )
    .filter((j) => etudiants.some((e) => e.id === j.etudiant_id))
    .slice(0, 25);

  return (
    <>
      <EnTete utilisateur={u} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{admin ? "Suivi des portfolios" : "Mes étudiants"}</h1>
            <p className="text-sm text-muted">
              {admin ? "Vue administrateur : tous les étudiants" : "Étudiants dont vous êtes l'enseignant·e référent·e"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 rounded-lg border border-line bg-surface p-1">
              {ANNEES.map((a) => (
                <Link
                  key={a}
                  href={lienFiltre({ promo: a })}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium ${a === promo ? "bg-primary text-white" : "hover:bg-primary-soft"}`}
                >
                  BUT{a} <span className={`text-xs ${a === promo ? "text-white/80" : "text-muted"}`}>({effectifs[a]})</span>
                </Link>
              ))}
            </div>
            <Link
              href={lienExport}
              className="rounded-md border border-line bg-surface px-3 py-2 text-sm font-medium hover:bg-primary-soft"
              title="Toutes les années, au format Excel"
            >
              Exporter les notes (Excel)
            </Link>
          </div>
        </div>

        {admin && (
          <div className="mb-5 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">Référent :</span>
            {[{ id: "", nom: "Tous" }, ...enseignants.map((e) => ({ id: e.id, nom: `${e.prenom} ${e.nom}` })), { id: "aucun", nom: "Sans référent" }].map(
              (r) => (
                <Link
                  key={r.id || "tous"}
                  href={lienFiltre({ referent: r.id })}
                  className={`rounded-full border px-3 py-1 ${filtreReferent === r.id ? "border-primary bg-primary-soft text-primary" : "border-line bg-surface hover:bg-primary-soft"}`}
                >
                  {r.nom}
                </Link>
              ),
            )}
            <Link href="/admin/affectations" className="ml-auto text-primary hover:underline">
              Gérer les affectations →
            </Link>
          </div>
        )}

        <div className="mb-5 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">Parcours :</span>
          {[{ code: "", libelle: "Tous" }, ...Object.values(PARCOURS_CONFIGURES).map((p) => ({ code: p.code, libelle: p.code }))].map((p) => (
            <Link
              key={p.code || "tous"}
              href={lienFiltre({ parcours: p.code })}
              title={p.code ? PARCOURS_CONFIGURES[p.code].intitule : "Tous les parcours"}
              className={`rounded-full border px-3 py-1 ${filtreParcours === p.code ? "border-primary bg-primary-soft text-primary" : "border-line bg-surface hover:bg-primary-soft"}`}
            >
              {p.libelle}
            </Link>
          ))}
          {!filtreParcours && competences.some((c) => !c.troncCommun) && (
            <span className="text-xs text-muted">C4 et C5 dépendent du parcours de chaque étudiant·e.</span>
          )}
        </div>

        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Indicateur valeur={etudiants.length} libelle="étudiants" />
          <Indicateur valeur={`${stats.complets}/${stats.total}`} libelle="dépôts complets" />
          <Indicateur valeur={`${stats.publiees}/${stats.total}`} libelle="évaluations publiées" />
          <Indicateur valeur={stats.aPublier} libelle="brouillons à publier" ton={stats.aPublier > 0 ? "ambre" : undefined} />
          <Indicateur valeur={stats.nouveaux} libelle="modifiés depuis votre dernière visite" ton={stats.nouveaux > 0 ? "rose" : undefined} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
          <section className="overflow-x-auto rounded-xl border border-line bg-surface">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="px-4 py-3 font-medium">Étudiant·e</th>
                  {competences.map((c) => (
                    <th
                      key={c.code}
                      className="px-2 py-3 text-center font-medium"
                      title={c.troncCommun || filtreParcours ? c.intitule : `Selon le parcours : ${nomsCourtsParCode(c.code).join(", ")}`}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <span className={`h-2 w-2 rounded-full ${COULEURS_COMPETENCE[c.code].pastille}`} />
                        {c.code} {enTete(c.code, c.nomCourt, c.troncCommun)}
                      </span>
                    </th>
                  ))}
                  {RENDEZ_VOUS.map((r) => (
                    <th key={r.numero} className="px-2 py-3 text-center font-medium" title={`${r.libelle} (${pourcentage(r.poids)} de chaque note finale)`}>
                      RDV {r.numero}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lignes.map(({ etu, cellules, historique, rdv }) => (
                  <tr key={etu.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/portfolio/${etu.id}?annee=${promo}&onglet=complet`} className="font-medium hover:text-primary hover:underline">
                        {etu.nom} {etu.prenom}
                      </Link>
                      <div className="text-xs text-muted">
                        {infosParcours(etu.parcours).code}
                        {etu.groupe && ` · ${etu.groupe}`}
                        {admin && ` · ${nomReferent(etu.referent_id)}`}
                        {historique > 0 && ` · historique complété (${historique})`}
                      </div>
                    </td>
                    {competences.map((c) => (
                      <td key={c.code} className="px-2 py-2 text-center">
                        <CelluleSuivi href={`/portfolio/${etu.id}?annee=${promo}&onglet=${c.code}`} etat={cellules[c.code]} />
                      </td>
                    ))}
                    {RENDEZ_VOUS.map((def) => {
                      const r = rdv.find((x) => x.numero === def.numero);
                      return (
                        <td key={def.numero} className="px-2 py-2 text-center">
                          <Link
                            href={`/portfolio/${etu.id}?annee=${promo}&onglet=suivi`}
                            className="inline-flex min-w-[56px] flex-col items-center rounded-lg border border-line px-2 py-1.5 hover:ring-2 hover:ring-primary/30"
                          >
                            <span className="text-sm font-semibold tabular-nums">{r?.note !== null && r?.note !== undefined ? formatNote(r.note) : "—"}</span>
                            {r && rendezVousNonPublie(r) && <span className="text-[10px] text-slate-500">non publiée</span>}
                          </Link>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {lignes.length === 0 && (
                  <tr>
                    <td colSpan={competences.length + 1 + RENDEZ_VOUS.length} className="px-4 py-8 text-center text-muted">
                      {admin ? "Aucun étudiant pour ce filtre." : "Aucun étudiant ne vous est affecté dans cette promotion."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            <Legende />
          </section>

          <section className="h-fit rounded-xl border border-line bg-surface p-5 text-sm">
            <h2 className="mb-3 text-base font-semibold">Activité récente · BUT{promo}</h2>
            <Journal entrees={journal} avecEtudiant />
          </section>
        </div>
      </main>
    </>
  );
}

function Indicateur({ valeur, libelle, ton }: { valeur: React.ReactNode; libelle: string; ton?: "rose" | "ambre" }) {
  const styles = {
    rose: ["border-rose-200 bg-rose-50", "text-rose-700"],
    ambre: ["border-amber-200 bg-amber-50", "text-amber-800"],
  };
  const [cadre, chiffre] = ton ? styles[ton] : ["border-line bg-surface", ""];
  return (
    <div className={`rounded-xl border p-4 ${cadre}`}>
      <div className={`text-2xl font-semibold ${chiffre}`}>{valeur}</div>
      <div className="text-xs text-muted">{libelle}</div>
    </div>
  );
}

function CelluleSuivi({ href, etat }: { href: string; etat: EtatCellule }) {
  const fond =
    etat.depot === "complet" ? "border-emerald-200 bg-emerald-50/60" : etat.depot === "partiel" ? "border-amber-200 bg-amber-50/60" : "border-dashed border-slate-200";
  const detail = [
    etat.aArgumentaire ? "argumentaire" : "pas d'argumentaire",
    `${etat.nbTraces} trace${etat.nbTraces > 1 ? "s" : ""}`,
    etat.derniereModif ? `modifié ${dateRelative(etat.derniereModif)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <Link href={href} title={detail} className={`relative mx-auto flex min-h-[58px] max-w-[150px] flex-col items-center justify-center gap-1 rounded-lg border px-2 py-1.5 hover:ring-2 hover:ring-primary/30 ${fond}`}>
      {etat.nouveau && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-600" title="Modifié depuis votre dernière visite" />}
      <span className="text-xs text-muted">
        {etat.depot === "vide" ? "—" : `${etat.aArgumentaire ? "Arg." : "∅ arg."} · ${etat.nbTraces} PDF`}
      </span>
      {etat.evaluation && etat.evaluation !== "non_evalue" ? (
        <BadgeEvaluation niveau={etat.evaluation} note={etat.note} compact />
      ) : (
        etat.depot !== "vide" && <span className="text-[11px] text-slate-500">À évaluer</span>
      )}
      {etat.nonPublie && <span className="text-[10px] font-medium text-slate-500">non publiée</span>}
      {etat.aRevoir && <span className="text-[10px] font-medium text-amber-700">modifié après éval.</span>}
    </Link>
  );
}

function Legende() {
  return (
    <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-line px-4 py-3 text-xs text-muted">
      <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-emerald-200 bg-emerald-50" /> Argumentaire + trace</span>
      <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-amber-200 bg-amber-50" /> Dépôt incomplet</span>
      <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-dashed border-slate-300" /> Rien déposé</span>
      <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-600" /> Modifié depuis votre dernière visite</span>
      <span>« non publiée » : évaluation en brouillon, invisible pour l&apos;étudiant·e</span>
    </div>
  );
}
