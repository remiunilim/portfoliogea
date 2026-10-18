"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import {
  ajouterTrace,
  appliquerChangementsGroupes,
  changerActivation,
  creerUtilisateur,
  definirCG2PActif,
  definirEnvoiMailsActif,
  definirPreferenceCourriel,
  definirReferent,
  emailExiste,
  evaluationsSansNote,
  enregistrerRendezVous,
  publierRendezVous,
  historiqueCompte,
  modifierCompte,
  notifierReferent,
  supprimerEnseignant,
  supprimerEtudiant,
  type ChangementsGroupes,
  type PreferenceCourriel,
  type Utilisateur,
  enregistrerArgumentaire,
  enregistrerEvaluation,
  enregistrerPresentation,
  getArgumentaires,
  getDepots,
  getPresentation,
  getTrace,
  getTraces,
  getUtilisateur,
  journaliser,
  marquerConsulte,
  marquerNotificationsLues,
  modifierTrace,
  notifier,
  publierDepot,
  publierEvaluations,
  publierPresentation,
  supprimerTrace,
} from "@/lib/db";
import { analyserImport, appliquerImport, lireFichier, PARCOURS_GEA, type LigneApercu } from "@/lib/import-etudiants";
import { consommerJetonInscription, emailDuJetonInscription, envoyerLienConnexion } from "@/lib/lien-connexion";
import { appliquerImportZip } from "@/lib/transfert";
import { COOKIE_SESSION, estAdmin, estEnseignant, peutModifier, suitEtudiant, utilisateurCourant } from "@/lib/session";
import {
  competenceParCode,
  estAnneeBUT,
  formatNote,
  libelleEvaluation,
  lireNote,
  NOTE_MAX,
  RENDEZ_VOUS,
  MAX_TRACES_PAR_COMPETENCE,
  NIVEAUX_EVALUATION,
  TAILLE_MAX_PDF,
} from "@/lib/referentiel";

export type EtatFormulaire = { ok: boolean; message: string } | null;

const texte = (f: FormData, cle: string) => String(f.get(cle) ?? "").trim();
const nbMots = (t: string) => (t ? t.split(/\s+/).length : 0);

// ---------- Connexion par lien envoyé par mail ----------

export async function seDeconnecter() {
  (await cookies()).delete(COOKIE_SESSION);
  redirect("/connexion");
}

// Démarre une connexion : envoie un lien de connexion (compte existant) ou, pour une adresse
// inconnue, un lien de création de profil étudiant (voir creerProfilEtudiantAction). Message de
// confirmation volontairement identique dans tous les cas, pour ne pas révéler quelles adresses
// sont déjà enregistrées (voir src/lib/lien-connexion.ts).
export async function demarrerConnexionEmailAction(_: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const email = texte(formData, "email");
  if (!email) return { ok: false, message: "Adresse mail obligatoire." };
  await envoyerLienConnexion(email);
  return {
    ok: true,
    message:
      "Un courriel vient de vous être envoyé : un lien de connexion si vous avez déjà un profil, sinon un lien pour en créer un (étudiant·e uniquement). Pensez à vérifier aussi les courriels indésirables. " +
      "Si rien n'arrive d'ici quelques minutes : vérifiez l'adresse saisie, ou contactez votre enseignant·e référent·e ou l'administrateur.",
  };
}

// Crée un profil étudiant après vérification de l'adresse mail (jeton reçu par le lien d'inscription,
// voir src/lib/lien-connexion.ts) : le compte n'existe qu'à partir de cette étape, jamais avant.
export async function creerProfilEtudiantAction(_: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const jeton = texte(formData, "jeton");
  const email = await emailDuJetonInscription(jeton);
  if (!email) {
    return {
      ok: false,
      message: "Ce lien n'est plus valable (déjà utilisé, ou expiré après 20 minutes). Redemandez un lien depuis la page de connexion.",
    };
  }

  const nom = texte(formData, "nom");
  const prenom = texte(formData, "prenom");
  const annee = Number(texte(formData, "annee"));
  const parcours = texte(formData, "parcours");
  const referentId = texte(formData, "referent");

  if (!nom || !prenom) return { ok: false, message: "Nom et prénom obligatoires." };
  if (!estAnneeBUT(annee)) return { ok: false, message: "Année invalide." };
  if ((annee === 2 || annee === 3) && !parcours) return { ok: false, message: "Choisissez votre parcours." };
  if (!referentId) return { ok: false, message: "Choisissez votre enseignant·e référent·e." };
  const referent = await getUtilisateur(referentId);
  if (!referent || !estEnseignant(referent) || !referent.actif) {
    return { ok: false, message: "Enseignant·e référent·e introuvable." };
  }

  const id = await creerUtilisateur({
    nom,
    prenom,
    email,
    role: "etudiant",
    annee_but: annee,
    parcours: annee === 1 ? undefined : parcours,
    referent_id: referentId,
  });
  await consommerJetonInscription(jeton);
  await notifier({
    destinataire_id: referentId,
    titre: "Nouvel·le étudiant·e",
    detail: `${prenom} ${nom} (BUT${annee}) a créé son profil et vous a choisi·e comme référent·e.`,
    lien: `/portfolio/${id}`,
  });
  (await cookies()).set(COOKIE_SESSION, id, { httpOnly: true, sameSite: "lax", path: "/" });
  redirect(`/portfolio/${id}`);
}

// ---------- Contrôles communs ----------

async function contexteDepot(formData: FormData) {
  const u = await utilisateurCourant();
  const etudiantId = texte(formData, "etudiant");
  const annee = Number(formData.get("annee"));
  const competence = texte(formData, "competence");
  if (!estAnneeBUT(annee) || !competenceParCode(competence, (await getUtilisateur(etudiantId))?.parcours)?.niveaux[annee]) {
    return { erreur: "Compétence ou année inconnue." } as const;
  }
  if (!peutModifier(u, etudiantId, annee)) {
    return { erreur: "Vous ne pouvez pas modifier ce portfolio." } as const;
  }
  return { u: u!, etudiantId, annee, competence } as const;
}

// Les traces ne publient pas elles-mêmes un dépôt (seul l'argumentaire porte le bouton « publier ») :
// tant que la compétence n'a pas été publiée, leur ajout/modification reste un brouillon privé, non
// notifié au référent.
async function depotPublie(etudiantId: string, annee: number, competence: string): Promise<boolean> {
  return (await getDepots(etudiantId)).some((d) => d.annee === annee && d.competence === competence);
}

async function lirePdf(fichier: FormDataEntryValue | null): Promise<{ nom: string; contenu: Buffer } | string> {
  if (!(fichier instanceof File) || fichier.size === 0) return "Choisissez un fichier PDF.";
  if (fichier.size > TAILLE_MAX_PDF) return "Le fichier dépasse 10 Mo.";
  const contenu = Buffer.from(await fichier.arrayBuffer());
  if (contenu.subarray(0, 5).toString("latin1") !== "%PDF-") return "Le fichier doit être un PDF.";
  return { nom: fichier.name, contenu };
}

// Prévient le référent d'un dépôt ou d'une modification (notifications regroupées tant qu'elles ne sont pas lues).
async function prevenirReferent(etudiant: Utilisateur, annee: number | null, competence: string | null, quoi: string) {
  const c = competence ? competenceParCode(competence, etudiant.parcours) : undefined;
  const nom = `${etudiant.prenom} ${etudiant.nom}`;
  await notifierReferent(
    etudiant,
    c ? `${nom} · ${c.code} ${c.nomCourt} (BUT${annee}) mis à jour` : `${nom} a mis à jour sa présentation`,
    quoi,
    c ? `/portfolio/${etudiant.id}?annee=${annee}&onglet=${c.code}` : `/portfolio/${etudiant.id}?onglet=presentation`,
  );
}

// ---------- Étudiant ----------

export async function sauverPresentation(_: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const u = await utilisateurCourant();
  const etudiantId = texte(formData, "etudiant");
  if (!peutModifier(u, etudiantId)) return { ok: false, message: "Vous ne pouvez pas modifier ce portfolio." };
  const presentation = texte(formData, "texte");
  const projetPro = texte(formData, "projet_pro");
  const avant = await getPresentation(etudiantId);
  const dejaPublie = !!avant?.publie_le;
  const modifie = !avant || avant.texte !== presentation || avant.projet_pro !== projetPro;
  const publier = formData.get("publier") === "1" && !dejaPublie;
  if (!modifie && !publier) return { ok: true, message: "Aucune modification." };
  if (modifie) {
    await enregistrerPresentation(etudiantId, presentation, projetPro);
    await journaliser({ etudiant_id: etudiantId, acteur_id: u!.id, annee: null, competence: null, type: "presentation_maj", detail: "" });
  }
  if (publier) {
    await publierPresentation(etudiantId);
    await journaliser({ etudiant_id: etudiantId, acteur_id: u!.id, annee: null, competence: null, type: "presentation_publiee", detail: "" });
  }
  if (publier || (dejaPublie && modifie)) {
    await prevenirReferent(u!, null, null, "présentation et projet professionnel");
  }
  refresh();
  return {
    ok: true,
    message: publier
      ? "Présentation publiée : votre référent peut la consulter."
      : dejaPublie
        ? "Présentation enregistrée."
        : "Brouillon enregistré, non visible par votre référent.",
  };
}

export async function sauverArgumentaire(_: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const ctx = await contexteDepot(formData);
  if ("erreur" in ctx) return { ok: false, message: ctx.erreur! };
  const nouveau = texte(formData, "texte");
  const avant = (await getArgumentaires(ctx.etudiantId)).find(
    (a) => a.annee === ctx.annee && a.competence === ctx.competence,
  );
  const dejaPublie = await depotPublie(ctx.etudiantId, ctx.annee, ctx.competence);
  const modifie = (avant?.texte ?? "") !== nouveau;
  const publier = formData.get("publier") === "1" && !dejaPublie;
  if (!modifie && !publier) return { ok: true, message: "Aucune modification." };
  if (modifie) {
    await enregistrerArgumentaire(ctx.etudiantId, ctx.annee, ctx.competence, nouveau);
    const ecart = nbMots(nouveau) - nbMots(avant?.texte ?? "");
    await journaliser({
      etudiant_id: ctx.etudiantId,
      acteur_id: ctx.u.id,
      annee: ctx.annee,
      competence: ctx.competence,
      type: avant ? "argumentaire_maj" : "argumentaire_cree",
      detail: `${nbMots(nouveau)} mots${avant ? ` (${ecart >= 0 ? "+" : ""}${ecart})` : ""}`,
    });
  }
  if (publier) {
    await publierDepot(ctx.etudiantId, ctx.annee, ctx.competence);
    await journaliser({ etudiant_id: ctx.etudiantId, acteur_id: ctx.u.id, annee: ctx.annee, competence: ctx.competence, type: "depot_publie", detail: "" });
  }
  if (publier || (dejaPublie && modifie)) {
    await prevenirReferent(ctx.u, ctx.annee, ctx.competence, `argumentaire ${avant ? "modifié" : "rédigé"} (${nbMots(nouveau)} mots)`);
  }
  refresh();
  return {
    ok: true,
    message: publier
      ? "Dépôt publié : votre référent peut le consulter."
      : dejaPublie
        ? "Argumentaire enregistré."
        : "Brouillon enregistré, non visible par votre référent.",
  };
}

export async function deposerTrace(_: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const ctx = await contexteDepot(formData);
  if ("erreur" in ctx) return { ok: false, message: ctx.erreur! };
  const titre = texte(formData, "titre");
  if (!titre) return { ok: false, message: "Donnez un titre à la trace." };
  const existantes = (await getTraces(ctx.etudiantId)).filter(
    (t) => t.annee === ctx.annee && t.competence === ctx.competence,
  );
  if (existantes.length >= MAX_TRACES_PAR_COMPETENCE) {
    return { ok: false, message: `${MAX_TRACES_PAR_COMPETENCE} traces maximum par compétence.` };
  }
  const pdf = await lirePdf(formData.get("fichier"));
  if (typeof pdf === "string") return { ok: false, message: pdf };
  await ajouterTrace(
    {
      etudiant_id: ctx.etudiantId,
      annee: ctx.annee,
      competence: ctx.competence,
      titre,
      description: texte(formData, "description"),
      fichier_nom: pdf.nom,
      taille: pdf.contenu.length,
    },
    pdf.contenu,
  );
  await journaliser({ etudiant_id: ctx.etudiantId, acteur_id: ctx.u.id, annee: ctx.annee, competence: ctx.competence, type: "trace_ajoutee", detail: titre });
  if (await depotPublie(ctx.etudiantId, ctx.annee, ctx.competence)) {
    await prevenirReferent(ctx.u, ctx.annee, ctx.competence, `trace déposée : ${titre}`);
  }
  refresh();
  return { ok: true, message: "Trace déposée." };
}

export async function modifierTraceAction(_: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const trace = await getTrace(texte(formData, "trace"));
  if (!trace) return { ok: false, message: "Trace introuvable." };
  const u = await utilisateurCourant();
  if (!peutModifier(u, trace.etudiant_id, trace.annee)) return { ok: false, message: "Modification non autorisée." };
  const titre = texte(formData, "titre") || trace.titre;
  const fichier = formData.get("fichier");
  let pdf: { nom: string; contenu: Buffer } | undefined;
  if (fichier instanceof File && fichier.size > 0) {
    const lu = await lirePdf(fichier);
    if (typeof lu === "string") return { ok: false, message: lu };
    pdf = lu;
  }
  await modifierTrace(trace.id, { titre, description: texte(formData, "description") }, pdf);
  await journaliser({
    etudiant_id: trace.etudiant_id,
    acteur_id: u!.id,
    annee: trace.annee,
    competence: trace.competence,
    type: pdf ? "trace_remplacee" : "trace_modifiee",
    detail: pdf ? `${titre} — nouveau fichier : ${pdf.nom}` : titre,
  });
  if (await depotPublie(trace.etudiant_id, trace.annee, trace.competence)) {
    await prevenirReferent(u!, trace.annee, trace.competence, pdf ? `fichier de trace remplacé : ${titre}` : `trace modifiée : ${titre}`);
  }
  refresh();
  return { ok: true, message: pdf ? "Fichier remplacé." : "Trace modifiée." };
}

export async function supprimerTraceAction(formData: FormData) {
  const trace = await getTrace(texte(formData, "trace"));
  if (!trace) return;
  const u = await utilisateurCourant();
  if (!peutModifier(u, trace.etudiant_id, trace.annee)) return;
  await supprimerTrace(trace.id);
  await journaliser({ etudiant_id: trace.etudiant_id, acteur_id: u!.id, annee: trace.annee, competence: trace.competence, type: "trace_supprimee", detail: trace.titre });
  if (await depotPublie(trace.etudiant_id, trace.annee, trace.competence)) {
    await prevenirReferent(u!, trace.annee, trace.competence, `trace supprimée : ${trace.titre}`);
  }
  refresh();
}

// ---------- Enseignant ----------

export async function marquerPortfolioConsulte(etudiantId: string) {
  const u = await utilisateurCourant();
  if (!(await suitEtudiant(u, etudiantId))) return;
  await marquerConsulte(u!.id, etudiantId);
}

// Enregistre le brouillon ; avec le bouton « Enregistrer et publier », le rend aussi visible par l'étudiant.
export async function evaluer(_: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const u = await utilisateurCourant();
  const etudiantId = texte(formData, "etudiant");
  if (!(await suitEtudiant(u, etudiantId))) return { ok: false, message: "Vous n'êtes pas le référent de cet étudiant." };
  const annee = Number(formData.get("annee"));
  const competence = texte(formData, "competence");
  const niveau = texte(formData, "niveau");
  const parcours = (await getUtilisateur(etudiantId))?.parcours;
  if (!estAnneeBUT(annee) || !competenceParCode(competence, parcours)?.niveaux[annee]) {
    return { ok: false, message: "Évaluation invalide." };
  }
  if (!NIVEAUX_EVALUATION.some((n) => n.code === niveau)) return { ok: false, message: "Niveau inconnu." };
  const publier = formData.get("publier") === "1";
  if (publier && niveau === "non_evalue") return { ok: false, message: "Choisissez un niveau avant de publier." };
  // La note sur 20 accompagne obligatoirement le niveau qualitatif.
  const note = lireNote(texte(formData, "note"));
  if (note === undefined) return { ok: false, message: `La note doit être comprise entre 0 et ${NOTE_MAX}.` };
  if (niveau !== "non_evalue" && note === null) return { ok: false, message: `Saisissez la note sur ${NOTE_MAX} : elle accompagne obligatoirement le niveau.` };
  const noteRetenue = niveau === "non_evalue" ? null : note;
  const resume = `${libelleEvaluation(niveau)}${noteRetenue !== null ? ` · ${formatNote(noteRetenue)}` : ""}`;
  await enregistrerEvaluation({ etudiant_id: etudiantId, annee, competence, niveau, note: noteRetenue, commentaire: texte(formData, "commentaire"), enseignant_id: u!.id });
  await journaliser({ etudiant_id: etudiantId, acteur_id: u!.id, annee, competence, type: "evaluation", detail: `${resume} (brouillon)` });
  if (publier && (await publierEvaluations({ etudiantId, annee, competence }, u!.id)).length) {
    await journaliser({ etudiant_id: etudiantId, acteur_id: u!.id, annee, competence, type: "evaluation_publiee", detail: resume });
    const c = competenceParCode(competence, parcours)!;
    await notifier({
      destinataire_id: etudiantId,
      titre: `Évaluation publiée : ${c.code} ${c.nomCourt} (BUT${annee})`,
      detail: `${resume} · par ${u!.prenom} ${u!.nom}`,
      lien: `/portfolio/${etudiantId}?annee=${annee}&onglet=${competence}`,
    });
  }
  refresh();
  return {
    ok: true,
    message: publier ? "Évaluation publiée : l'étudiant·e peut la consulter." : "Brouillon enregistré, non visible par l'étudiant·e.",
  };
}

// Rendez-vous de suivi : note sur 20 obligatoire, date et compte rendu ; brouillon ou publication.
export async function enregistrerRendezVousAction(_: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const u = await utilisateurCourant();
  const etudiantId = texte(formData, "etudiant");
  if (!(await suitEtudiant(u, etudiantId))) return { ok: false, message: "Vous n'êtes pas le référent de cet étudiant." };
  const annee = Number(formData.get("annee"));
  const numero = Number(formData.get("numero"));
  const rdv = RENDEZ_VOUS.find((r) => r.numero === numero);
  if (!estAnneeBUT(annee) || !rdv) return { ok: false, message: "Rendez-vous invalide." };
  const note = lireNote(texte(formData, "note"));
  if (note === undefined) return { ok: false, message: `La note doit être comprise entre 0 et ${NOTE_MAX}.` };
  if (note === null) return { ok: false, message: `Saisissez la note du rendez-vous sur ${NOTE_MAX}.` };
  const date = texte(formData, "date");
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, message: "Date invalide." };
  await enregistrerRendezVous({ etudiant_id: etudiantId, annee, numero: numero as 1 | 2, date_rdv: date || null, note, commentaire: texte(formData, "commentaire"), enseignant_id: u!.id });
  await journaliser({ etudiant_id: etudiantId, acteur_id: u!.id, annee, competence: null, type: "rendez_vous", detail: `${rdv.libelle} · ${formatNote(note)} (brouillon)` });
  const publier = formData.get("publier") === "1";
  if (publier && (await publierRendezVous({ etudiantId, annee, numero })).length) {
    await journaliser({ etudiant_id: etudiantId, acteur_id: u!.id, annee, competence: null, type: "rendez_vous_publie", detail: `${rdv.libelle} · ${formatNote(note)}` });
    await notifier({
      destinataire_id: etudiantId,
      titre: `${rdv.libelle} : note publiée (BUT${annee})`,
      detail: `${formatNote(note)} · par ${u!.prenom} ${u!.nom}`,
      lien: `/portfolio/${etudiantId}?annee=${annee}&onglet=suivi`,
    });
  }
  refresh();
  return { ok: true, message: publier ? "Rendez-vous publié : l'étudiant·e voit la note." : "Brouillon enregistré, non visible par l'étudiant·e." };
}

// Publie d'un coup tous les brouillons d'une année pour un étudiant.
export async function publierAnnee(_: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const u = await utilisateurCourant();
  const etudiantId = texte(formData, "etudiant");
  const annee = Number(formData.get("annee"));
  if (!(await suitEtudiant(u, etudiantId)) || !estAnneeBUT(annee)) return { ok: false, message: "Publication non autorisée." };
  const sansNote = await evaluationsSansNote(etudiantId, annee);
  const publiees = await publierEvaluations({ etudiantId, annee }, u!.id);
  const rdvPublies = await publierRendezVous({ etudiantId, annee });
  const n = publiees.length + rdvPublies.length;
  const alerte = sansNote.length ? ` Non publiée(s) faute de note : ${sansNote.join(", ")}.` : "";
  if (n === 0) return { ok: !sansNote.length, message: `Aucun brouillon publié.${alerte}` };
  const elements = [
    ...publiees.map((p) => `${p.competence} : ${libelleEvaluation(p.niveau)} (${formatNote(p.note)})`),
    ...rdvPublies.map((r) => `RDV ${r.numero} : ${formatNote(r.note)}`),
  ];
  await journaliser({ etudiant_id: etudiantId, acteur_id: u!.id, annee, competence: null, type: "evaluation_publiee", detail: `${elements.join(" · ")} (BUT${annee})` });
  const parcoursEtudiant = publiees.length ? (await getUtilisateur(etudiantId))?.parcours : undefined;
  await notifier({
    destinataire_id: etudiantId,
    titre:
      n > 1
        ? `${n} notes publiées (BUT${annee})`
        : publiees.length
          ? `Évaluation publiée : ${publiees[0].competence} ${competenceParCode(publiees[0].competence, parcoursEtudiant)?.nomCourt ?? ""} (BUT${annee})`
          : `Rendez-vous de suivi ${rdvPublies[0].numero} : note publiée (BUT${annee})`,
    detail: `${elements.join(" · ")} · par ${u!.prenom} ${u!.nom}`,
    lien: n > 1 || !publiees.length ? `/portfolio/${etudiantId}?annee=${annee}&onglet=suivi` : `/portfolio/${etudiantId}?annee=${annee}&onglet=${publiees[0].competence}`,
  });
  refresh();
  return { ok: true, message: `${n} note${n > 1 ? "s publiées" : " publiée"}.${alerte}` };
}

// ---------- Notifications ----------

export async function lireNotifications() {
  const u = await utilisateurCourant();
  if (u) await marquerNotificationsLues(u.id);
}

// ---------- Administrateur ----------

export async function affecterReferent(formData: FormData) {
  const u = await utilisateurCourant();
  if (!estAdmin(u)) return;
  const etudiant = await getUtilisateur(texte(formData, "etudiant"));
  const referentId = texte(formData, "referent");
  if (!etudiant || etudiant.role !== "etudiant") return;
  if (referentId && !estEnseignant((await getUtilisateur(referentId)) ?? null)) return;
  await definirReferent(etudiant.id, referentId || null);
  refresh();
}

export async function definirCG2PActifAction(formData: FormData) {
  const u = await utilisateurCourant();
  if (!estAdmin(u)) return;
  await definirCG2PActif(formData.get("actif") === "1");
  refresh();
}

export async function definirEnvoiMailsActifAction(formData: FormData) {
  const u = await utilisateurCourant();
  if (!estAdmin(u)) return;
  await definirEnvoiMailsActif(formData.get("actif") === "1");
  refresh();
}

// ---------- Transfert de données vers/depuis une autre instance (voir /admin/transfert) ----------

export async function importerDonneesAction(_: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  if (!estAdmin(await utilisateurCourant())) return { ok: false, message: "Réservé à l'administrateur." };
  if (texte(formData, "confirmation").toUpperCase() !== "IMPORTER") {
    return { ok: false, message: "Pour confirmer, saisissez IMPORTER." };
  }
  const fichier = formData.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { ok: false, message: "Choisissez un fichier .zip exporté depuis une autre instance de Folio GEA." };
  }
  try {
    const rapport = await appliquerImportZip(Buffer.from(await fichier.arrayBuffer()));
    refresh();
    const avertissement = rapport.tracesManquantes.length
      ? ` ${rapport.tracesManquantes.length} trace(s) sans fichier PDF retrouvé dans l'archive.`
      : "";
    return {
      ok: true,
      message: `Import terminé : ${rapport.comptesCrees} compte(s) créé(s), ${rapport.comptesReconnus} déjà présent(s) (reconnu par email, non modifié), ${rapport.tracesCopiees} trace(s) copiée(s).${avertissement}`,
    };
  } catch (e) {
    return { ok: false, message: `Échec de l'import : ${e instanceof Error ? e.message : "erreur inconnue"}.` };
  }
}

export async function ajouterEtudiant(_: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  if (!estAdmin(await utilisateurCourant())) return { ok: false, message: "Réservé à l'administrateur." };
  const nom = texte(formData, "nom");
  const prenom = texte(formData, "prenom");
  const email = texte(formData, "email");
  const annee = Number(formData.get("annee"));
  const parcours = texte(formData, "parcours") || "GEMA";
  const referentId = texte(formData, "referent");
  if (!nom || !prenom) return { ok: false, message: "Le nom et le prénom sont obligatoires." };
  if (!estAnneeBUT(annee)) return { ok: false, message: "Choisissez l'année de BUT." };
  if (!(PARCOURS_GEA as readonly string[]).includes(parcours)) return { ok: false, message: "Parcours inconnu." };
  if (email && (await emailExiste(email))) return { ok: false, message: `L'adresse ${email} est déjà utilisée.` };
  if (referentId && !estEnseignant((await getUtilisateur(referentId)) ?? null)) return { ok: false, message: "Référent inconnu." };
  await creerUtilisateur({ nom, prenom, email, role: "etudiant", annee_but: annee, groupe: texte(formData, "groupe"), parcours, referent_id: referentId || null });
  refresh();
  return { ok: true, message: `${prenom} ${nom} ajouté·e en BUT${annee}.` };
}

export async function ajouterEnseignant(_: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  if (!estAdmin(await utilisateurCourant())) return { ok: false, message: "Réservé à l'administrateur." };
  const nom = texte(formData, "nom");
  const prenom = texte(formData, "prenom");
  const email = texte(formData, "email");
  const role = formData.get("admin") === "1" ? "admin" : "enseignant";
  if (!nom || !prenom) return { ok: false, message: "Le nom et le prénom sont obligatoires." };
  if (email && (await emailExiste(email))) return { ok: false, message: `L'adresse ${email} est déjà utilisée.` };
  await creerUtilisateur({ nom, prenom, email, role });
  refresh();
  return { ok: true, message: `${prenom} ${nom} ajouté·e${role === "admin" ? " comme administrateur" : ""}.` };
}

export type EtatImport = {
  ok: boolean;
  message: string;
  apercu?: LigneApercu[];
  bilan?: Awaited<ReturnType<typeof appliquerImport>>;
} | null;

// Premier envoi : aperçu sans rien modifier. Second envoi (« importer ») : application des lignes valides.
export async function importerEtudiants(_: EtatImport, formData: FormData): Promise<EtatImport> {
  if (!estAdmin(await utilisateurCourant())) return { ok: false, message: "Réservé à l'administrateur." };
  const fichier = formData.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) return { ok: false, message: "Choisissez un fichier Excel (.xlsx) ou CSV." };
  if (fichier.size > 5 * 1024 * 1024) return { ok: false, message: "Le fichier dépasse 5 Mo." };
  const lu = await lireFichier(fichier.name, Buffer.from(await fichier.arrayBuffer()));
  if ("erreur" in lu) return { ok: false, message: lu.erreur };
  const apercu = await analyserImport(lu.lignes, formData.get("creer_enseignants") === "1");
  if (formData.get("etape") !== "importer") {
    return { ok: true, message: "Vérifiez l'aperçu, puis confirmez l'import.", apercu };
  }
  const bilan = await appliquerImport(apercu);
  refresh();
  return { ok: true, message: "Import terminé.", bilan };
}

// ---------- Préférences de l'utilisateur ----------

export async function enregistrerPreferences(_: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const u = await utilisateurCourant();
  if (!u) return { ok: false, message: "Session expirée." };
  const pref = texte(formData, "pref_courriel") as PreferenceCourriel;
  // Le récapitulatif quotidien n'a de sens que pour les enseignants (activité de plusieurs étudiants).
  const permises: PreferenceCourriel[] = estEnseignant(u) ? ["immediat", "quotidien", "aucun"] : ["immediat", "aucun"];
  if (!permises.includes(pref)) return { ok: false, message: "Choix invalide." };
  await definirPreferenceCourriel(u.id, pref);
  refresh();
  return {
    ok: true,
    message: pref === "aucun" ? "Vous ne recevrez plus de courriel (les notifications restent visibles dans l'outil)." : "Préférence enregistrée.",
  };
}

// ---------- Administration des comptes ----------

async function exigerAdmin() {
  const u = await utilisateurCourant();
  return estAdmin(u) ? u! : null;
}

export async function modifierCompteAction(_: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const admin = await exigerAdmin();
  if (!admin) return { ok: false, message: "Réservé à l'administrateur." };
  const compte = await getUtilisateur(texte(formData, "id"));
  if (!compte) return { ok: false, message: "Compte introuvable." };
  const nom = texte(formData, "nom");
  const prenom = texte(formData, "prenom");
  const email = texte(formData, "email").toLowerCase();
  if (!nom || !prenom) return { ok: false, message: "Le nom et le prénom sont obligatoires." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: "Adresse mail invalide." };
  if (email !== compte.email && (await emailExiste(email))) return { ok: false, message: `L'adresse ${email} est déjà utilisée.` };

  if (compte.role === "etudiant") {
    const annee = Number(formData.get("annee"));
    const parcours = texte(formData, "parcours");
    const referentId = texte(formData, "referent") || null;
    if (!estAnneeBUT(annee)) return { ok: false, message: "Année invalide." };
    if (!(PARCOURS_GEA as readonly string[]).includes(parcours)) return { ok: false, message: "Parcours inconnu." };
    const referent = referentId ? await getUtilisateur(referentId) : null;
    if (referentId && !estEnseignant(referent ?? null)) return { ok: false, message: "Référent inconnu." };
    await modifierCompte(compte.id, { nom, prenom, email, role: "etudiant", annee_but: annee, groupe: texte(formData, "groupe") || null, parcours, referent_id: referentId });
    const changements = [
      compte.annee_but !== annee && `BUT${compte.annee_but} → BUT${annee}`,
      compte.parcours !== parcours && `parcours → ${parcours}`,
      compte.referent_id !== referentId && `référent → ${referentId ? `${referent!.prenom} ${referent!.nom}` : "aucun"}`,
    ].filter(Boolean);
    if (changements.length) {
      await journaliser({ etudiant_id: compte.id, acteur_id: admin.id, annee: null, competence: null, type: "compte_modifie", detail: changements.join(" · ") });
    }
  } else {
    const role = formData.get("admin") === "1" ? "admin" : "enseignant";
    // Garde-fou : on ne se retire pas soi-même les droits d'administrateur.
    if (compte.id === admin.id && role !== "admin") return { ok: false, message: "Vous ne pouvez pas retirer vos propres droits d'administrateur." };
    await modifierCompte(compte.id, { nom, prenom, email, role, annee_but: null, groupe: null, parcours: null, referent_id: null });
  }
  refresh();
  return { ok: true, message: "Compte enregistré." };
}

export async function changerActivationAction(_: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const admin = await exigerAdmin();
  if (!admin) return { ok: false, message: "Réservé à l'administrateur." };
  const compte = await getUtilisateur(texte(formData, "id"));
  if (!compte) return { ok: false, message: "Compte introuvable." };
  const activer = formData.get("activer") === "1";
  if (!activer && compte.id === admin.id) return { ok: false, message: "Vous ne pouvez pas désactiver votre propre compte." };
  const liberes = await changerActivation(compte.id, activer);
  if (compte.role === "etudiant") {
    await journaliser({ etudiant_id: compte.id, acteur_id: admin.id, annee: null, competence: null, type: "compte_modifie", detail: activer ? "compte réactivé" : "compte désactivé" });
  }
  refresh();
  return {
    ok: true,
    message: activer
      ? "Compte réactivé."
      : `Compte désactivé : il n'a plus accès à l'outil, ses données sont conservées.${liberes ? ` ${liberes} étudiant(s) se retrouvent sans référent.` : ""}`,
  };
}

export async function supprimerCompteAction(_: EtatFormulaire, formData: FormData): Promise<EtatFormulaire> {
  const admin = await exigerAdmin();
  if (!admin) return { ok: false, message: "Réservé à l'administrateur." };
  const compte = await getUtilisateur(texte(formData, "id"));
  if (!compte) return { ok: false, message: "Compte introuvable." };
  if (compte.id === admin.id) return { ok: false, message: "Vous ne pouvez pas supprimer votre propre compte." };
  // Confirmation explicite : la suppression d'un étudiant efface tout son portfolio.
  if (texte(formData, "confirmation").toLowerCase() !== compte.nom.toLowerCase()) {
    return { ok: false, message: `Pour confirmer, saisissez le nom « ${compte.nom} ».` };
  }
  if (compte.role === "etudiant") {
    await supprimerEtudiant(compte.id);
  } else if (!(await supprimerEnseignant(compte.id))) {
    const h = await historiqueCompte(compte.id);
    return {
      ok: false,
      message: `Suppression impossible : ce compte a ${h.evaluationsDonnees} évaluation(s) et ${h.actionsJournal} action(s) dans l'historique. Désactivez-le plutôt pour conserver la traçabilité.`,
    };
  }
  redirect("/admin/affectations");
}

// Passage d'année et réaffectations groupés, sur une sélection d'étudiants.
export type EtatPassage = { ok: boolean; message: string; ignores?: string[] } | null;

export async function passageGroupe(_: EtatPassage, formData: FormData): Promise<EtatPassage> {
  const admin = await exigerAdmin();
  if (!admin) return { ok: false, message: "Réservé à l'administrateur." };
  const ids = formData.getAll("etudiants").map(String);
  if (ids.length === 0) return { ok: false, message: "Sélectionnez au moins un étudiant." };

  if (formData.get("operation") === "desactiver") {
    for (const id of ids) {
      await changerActivation(id, false);
      await journaliser({ etudiant_id: id, acteur_id: admin.id, annee: null, competence: null, type: "compte_modifie", detail: "sortie de formation : compte désactivé" });
    }
    refresh();
    return { ok: true, message: `${ids.length} compte(s) désactivé(s) : données conservées, accès fermé.` };
  }

  const c: ChangementsGroupes = {};
  const annee = texte(formData, "annee");
  if (annee === "suivante") c.annee = "suivante";
  else if (["1", "2", "3"].includes(annee)) c.annee = Number(annee) as 1 | 2 | 3;
  const parcours = texte(formData, "parcours");
  if (parcours) {
    if (!(PARCOURS_GEA as readonly string[]).includes(parcours)) return { ok: false, message: "Parcours inconnu." };
    c.parcours = parcours;
  }
  const referent = texte(formData, "referent");
  if (referent === "__aucun") c.referent = null;
  else if (referent) {
    if (!estEnseignant((await getUtilisateur(referent)) ?? null)) return { ok: false, message: "Référent inconnu." };
    c.referent = referent;
  }
  if (formData.get("changer_groupe") === "1") c.groupe = texte(formData, "groupe") || null;
  if (Object.keys(c).length === 0) return { ok: false, message: "Choisissez au moins une modification à appliquer." };

  const r = await appliquerChangementsGroupes(ids, c);
  const nomReferentChoisi = c.referent ? await getUtilisateur(c.referent) : null;
  for (const d of r.details) {
    const morceaux = [
      d.avant !== d.apres && `BUT${d.avant} → BUT${d.apres}`,
      c.parcours && `parcours ${c.parcours}`,
      c.referent !== undefined && `référent ${c.referent ? `${nomReferentChoisi!.prenom} ${nomReferentChoisi!.nom}` : "retiré"}`,
      c.groupe !== undefined && `groupe ${c.groupe ?? "retiré"}`,
    ].filter(Boolean);
    if (morceaux.length) {
      await journaliser({ etudiant_id: d.id, acteur_id: admin.id, annee: null, competence: null, type: d.avant !== d.apres ? "passage_annee" : "compte_modifie", detail: morceaux.join(" · ") });
    }
  }
  refresh();
  return {
    ok: true,
    message: `${r.modifies} étudiant(s) mis à jour.${r.ignores.length ? ` ${r.ignores.length} ignoré(s).` : ""}`,
    ignores: r.ignores,
  };
}

// ---------- Archivage et suppression groupés ----------

export type EtatArchivage = { ok: boolean; message: string } | null;

const PHRASE_CONFIRMATION_SUPPRESSION = "SUPPRIMER";

export async function archivageGroupe(_: EtatArchivage, formData: FormData): Promise<EtatArchivage> {
  const admin = await exigerAdmin();
  if (!admin) return { ok: false, message: "Réservé à l'administrateur." };
  const ids = formData.getAll("etudiants").map(String);
  if (ids.length === 0) return { ok: false, message: "Sélectionnez au moins un·e étudiant·e." };
  const operation = formData.get("operation");

  if (operation === "archiver") {
    for (const id of ids) {
      await changerActivation(id, false);
      await journaliser({ etudiant_id: id, acteur_id: admin.id, annee: null, competence: null, type: "compte_modifie", detail: "archivé (sortie de formation ou de cohorte)" });
    }
    refresh();
    return { ok: true, message: `${ids.length} étudiant(s) archivé(s) : accès fermé, portfolios conservés.` };
  }

  if (operation === "supprimer") {
    if (texte(formData, "confirmation").toUpperCase() !== PHRASE_CONFIRMATION_SUPPRESSION) {
      return { ok: false, message: `Pour confirmer, tapez « ${PHRASE_CONFIRMATION_SUPPRESSION} » exactement.` };
    }
    let supprimes = 0;
    for (const id of ids) {
      const e = await getUtilisateur(id);
      if (!e || e.role !== "etudiant" || e.id === admin.id) continue;
      await supprimerEtudiant(id);
      supprimes++;
    }
    refresh();
    return { ok: true, message: `${supprimes} étudiant(s) supprimé(s) définitivement, portfolios compris.` };
  }

  return { ok: false, message: "Opération inconnue." };
}

