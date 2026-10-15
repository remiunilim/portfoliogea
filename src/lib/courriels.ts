import { envoiMailsActif, getCourrielsEnAttente, marquerCourrielEchec, marquerCourrielEnvoye, type Courriel } from "./db";
import { envoyerCourriel, smtpConfigure } from "./mail";

export type BilanEnvoi = {
  envoyes: number;
  echecs: number;
  desactive: boolean;
  nonConfigure: boolean;
};

async function envoyerEtMarquer(adresse: string, sujet: string, corps: string, ids: number[], bilan: BilanEnvoi) {
  try {
    await envoyerCourriel(adresse, sujet, corps);
    for (const id of ids) await marquerCourrielEnvoye(id);
    bilan.envoyes += ids.length;
  } catch (e) {
    console.error("Échec d'envoi de courriel :", e);
    for (const id of ids) await marquerCourrielEchec(id);
    bilan.echecs += ids.length;
  }
}

// Vide la file d'attente par envoi SMTP réel. « immediat » : un courriel par dépôt, dès que
// possible. « quotidien » : un seul courriel récapitulatif par destinataire, regroupant tout ce
// qui est en attente au moment de l'appel (à déclencher une fois par jour, voir deploy/).
// Ne fait rien tant que le coupe-circuit administrateur (envoi_mails_actif) n'est pas activé.
export async function traiterFileCourriels(mode: "immediat" | "quotidien" | "tous" = "tous"): Promise<BilanEnvoi> {
  const bilan: BilanEnvoi = { envoyes: 0, echecs: 0, desactive: false, nonConfigure: false };
  if (!(await envoiMailsActif())) {
    bilan.desactive = true;
    return bilan;
  }
  if (!smtpConfigure()) {
    bilan.nonConfigure = true;
    return bilan;
  }

  if (mode === "immediat" || mode === "tous") {
    const lignes = await getCourrielsEnAttente("immediat");
    for (const c of lignes) await envoyerEtMarquer(c.adresse, c.sujet, c.corps, [c.id], bilan);
  }

  if (mode === "quotidien" || mode === "tous") {
    const lignes = await getCourrielsEnAttente("quotidien");
    const parDestinataire = new Map<string, Courriel[]>();
    for (const c of lignes) {
      const groupe = parDestinataire.get(c.destinataire_id) ?? [];
      groupe.push(c);
      parDestinataire.set(c.destinataire_id, groupe);
    }
    for (const items of parDestinataire.values()) {
      const sujet = `[Folio GEA] Récapitulatif quotidien (${items.length} nouveauté${items.length > 1 ? "s" : ""})`;
      const corps = items.map((i) => `- ${i.sujet}\n  ${i.corps}`).join("\n\n");
      await envoyerEtMarquer(items[0].adresse, sujet, corps, items.map((i) => i.id), bilan);
    }
  }

  return bilan;
}
