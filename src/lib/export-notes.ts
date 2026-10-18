import ExcelJS from "exceljs";
import { getEvaluations, getRendezVous, type Utilisateur } from "./db";
import { ANNEES, competencesDeLAnnee, infosParcours, libelleEvaluation, noteFinale, PARCOURS_CONFIGURES, RENDEZ_VOUS } from "./referentiel";

// Export Excel des notes (brouillons et publiées) d'une liste d'étudiants, une feuille par année
// de BUT. Utilisé par un enseignant référent (ses étudiants) et par l'administrateur (tous les
// étudiants, ou un filtre par référent/parcours) — voir /enseignant/export.
const CODES_COMPETENCES = ["C1", "C2", "C3", "C4", "C5"];

export async function genererNotesExcel(etudiants: Utilisateur[], nomReferent: (id: string | null) => string): Promise<Buffer> {
  const classeur = new ExcelJS.Workbook();

  for (const annee of ANNEES) {
    const promo = etudiants.filter((e) => e.annee_but === annee);
    const feuille = classeur.addWorksheet(`BUT${annee}`);
    // Les compétences travaillées (et leurs libellés) dépendent du parcours de chaque étudiant ;
    // on réserve ici les colonnes C1 à C5 pertinentes pour l'année, vides si non applicables.
    const codes = CODES_COMPETENCES.filter((code) =>
      Object.keys(PARCOURS_CONFIGURES).some((p) => competencesDeLAnnee(annee, p).some((c) => c.code === code)),
    );

    const colonnes = [
      { header: "Nom", width: 16 },
      { header: "Prénom", width: 16 },
      { header: "Parcours", width: 10 },
      { header: "Groupe", width: 10 },
      { header: "Référent", width: 20 },
    ];
    for (const code of codes) {
      colonnes.push({ header: `${code} Niveau`, width: 24 });
      colonnes.push({ header: `${code} Note`, width: 9 });
      colonnes.push({ header: `${code} Publiée`, width: 9 });
    }
    for (const def of RENDEZ_VOUS) {
      colonnes.push({ header: `RDV ${def.numero} Note`, width: 9 });
      colonnes.push({ header: `RDV ${def.numero} Publiée`, width: 9 });
    }
    for (const code of codes) colonnes.push({ header: `${code} Note finale`, width: 12 });
    feuille.columns = colonnes;
    feuille.getRow(1).font = { bold: true };

    for (const etu of promo) {
      const evaluations = await getEvaluations(etu.id);
      const rdv = await getRendezVous(etu.id);
      const competences = competencesDeLAnnee(annee, etu.parcours);
      const rdv1 = rdv.find((r) => r.annee === annee && r.numero === 1);
      const rdv2 = rdv.find((r) => r.annee === annee && r.numero === 2);

      const ligne: (string | number)[] = [etu.nom, etu.prenom, infosParcours(etu.parcours).code, etu.groupe ?? "", nomReferent(etu.referent_id)];
      for (const code of codes) {
        const c = competences.find((cc) => cc.code === code);
        const ev = c ? evaluations.find((e) => e.annee === annee && e.competence === code) : undefined;
        ligne.push(c ? (ev?.niveau ? libelleEvaluation(ev.niveau) : "") : "");
        ligne.push(c && ev?.note !== null && ev?.note !== undefined ? ev.note : "");
        ligne.push(c ? (ev?.publiee_le ? "Oui" : "Non") : "");
      }
      ligne.push(rdv1?.note ?? "");
      ligne.push(rdv1 ? (rdv1.publie_le ? "Oui" : "Non") : "");
      ligne.push(rdv2?.note ?? "");
      ligne.push(rdv2 ? (rdv2.publie_le ? "Oui" : "Non") : "");
      for (const code of codes) {
        const c = competences.find((cc) => cc.code === code);
        const ev = c ? evaluations.find((e) => e.annee === annee && e.competence === code) : undefined;
        const finale = c ? noteFinale(ev?.note ?? null, rdv1?.note ?? null, rdv2?.note ?? null) : null;
        ligne.push(finale ?? "");
      }
      feuille.addRow(ligne);
    }
    if (promo.length === 0) feuille.addRow(["Aucun étudiant."]);
  }

  return Buffer.from(await classeur.xlsx.writeBuffer());
}
