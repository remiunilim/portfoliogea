import fs from "node:fs";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage, type RGB } from "pdf-lib";
import {
  cheminFichier,
  getArgumentaires,
  getEvaluations,
  getRendezVous,
  getPresentation,
  getTraces,
  getUtilisateur,
  type Utilisateur,
} from "./db";
import {
  codeAC,
  competencesDeLAnnee,
  formatNote,
  libelleEvaluation,
  noteFinale,
  infosParcours,
  POIDS_COMPETENCE,
  pourcentage,
  RENDEZ_VOUS,
  type AnneeBUT,
} from "./referentiel";

// Assemble le portfolio complet en un seul PDF : couverture, sommaire, présentation,
// puis pour chaque année et chaque compétence l'argumentaire suivi des traces PDF déposées.
// Seules les évaluations publiées y figurent.

const A4 = { largeur: 595.28, hauteur: 841.89 };
const MARGE = 56;
const LARGEUR_TEXTE = A4.largeur - 2 * MARGE;

const hex = (h: string): RGB => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
const COULEURS = {
  texte: hex("#1c2430"),
  discret: hex("#5d6878"),
  ligne: hex("#e2e6ec"),
  primaire: hex("#1f5f8b"),
  fondPrimaire: hex("#e6f0f7"),
  C1: hex("#0284c7"),
  C2: hex("#d97706"),
  C3: hex("#059669"),
  C4: hex("#7c3aed"),
  C5: hex("#e11d48"),
} as const;

type Polices = { normale: PDFFont; grasse: PDFFont; italique: PDFFont };

// Les polices standard du PDF ne couvrent que le jeu WinAnsi : on remplace le reste.
const REMPLACEMENTS: Record<string, string> = {
  "‘": "'", "’": "'", "“": '"', "”": '"', "–": "-", "—": "-",
  "…": "...", " ": " ", " ": " ", " ": " ", "→": "->", "≤": "<=", "≥": ">=",
};
function nettoyer(texte: string, police: PDFFont): string {
  let sortie = "";
  for (const car of texte.replace(/\r/g, "")) {
    const c = REMPLACEMENTS[car] ?? car;
    try {
      police.widthOfTextAtSize(c, 10);
      sortie += c;
    } catch {
      sortie += "?";
    }
  }
  return sortie;
}

function couperLignes(texte: string, police: PDFFont, taille: number, largeur: number): string[] {
  const lignes: string[] = [];
  for (const paragraphe of nettoyer(texte, police).split("\n")) {
    let courante = "";
    for (const mot of paragraphe.split(/ +/)) {
      const essai = courante ? `${courante} ${mot}` : mot;
      if (police.widthOfTextAtSize(essai, taille) <= largeur || !courante) {
        courante = essai;
      } else {
        lignes.push(courante);
        courante = mot;
      }
    }
    lignes.push(courante);
  }
  return lignes;
}

// Mise en page séquentielle : gère le curseur vertical et les sauts de page.
class Redaction {
  page!: PDFPage;
  y = 0;
  constructor(
    private doc: PDFDocument,
    private polices: Polices,
    private pagesGenerees: Set<PDFPage>,
  ) {}

  nouvellePage() {
    this.page = this.doc.addPage([A4.largeur, A4.hauteur]);
    this.pagesGenerees.add(this.page);
    this.y = A4.hauteur - MARGE;
    return this.page;
  }

  assurer(hauteur: number) {
    if (this.y - hauteur < MARGE + 20) this.nouvellePage();
  }

  espace(h: number) {
    this.y -= h;
  }

  texte(
    contenu: string,
    o: { taille?: number; police?: keyof Polices; couleur?: RGB; interligne?: number; retrait?: number; puce?: boolean } = {},
  ) {
    const taille = o.taille ?? 10.5;
    const police = this.polices[o.police ?? "normale"];
    const interligne = o.interligne ?? taille * 1.45;
    const retrait = o.retrait ?? 0;
    const couleur = o.couleur ?? COULEURS.texte;
    couperLignes(contenu, police, taille, LARGEUR_TEXTE - retrait).forEach((ligne, i) => {
      this.assurer(interligne);
      this.y -= interligne;
      const base = this.y + interligne - taille;
      if (o.puce && i === 0) this.page.drawText("•", { x: MARGE + 2, y: base, size: taille, font: police, color: COULEURS.discret });
      this.page.drawText(ligne, { x: MARGE + retrait, y: base, size: taille, font: police, color: couleur });
    });
  }

  puces(elements: string[], taille = 10) {
    for (const el of elements) this.texte(el, { taille, retrait: 12, puce: true });
  }

  titreSection(titre: string, couleur: RGB = COULEURS.primaire) {
    this.assurer(40);
    this.espace(14);
    this.texte(titre.toUpperCase(), { taille: 9, police: "grasse", couleur });
    this.espace(4);
    this.page.drawLine({ start: { x: MARGE, y: this.y }, end: { x: A4.largeur - MARGE, y: this.y }, thickness: 0.6, color: COULEURS.ligne });
    this.espace(4);
  }
}

export async function genererPortfolioPdf(etudiant: Utilisateur): Promise<Uint8Array> {
  const parcoursEtudiant = infosParcours(etudiant.parcours);
  const doc = await PDFDocument.create();
  const nomComplet = `${etudiant.prenom} ${etudiant.nom}`;
  doc.setTitle(`Portfolio de compétences - ${nomComplet}`);
  doc.setAuthor(nomComplet);
  doc.setSubject(`BUT GEA parcours ${parcoursEtudiant.code}`);
  doc.setProducer("Folio GEA");
  const polices: Polices = {
    normale: await doc.embedFont(StandardFonts.Helvetica),
    grasse: await doc.embedFont(StandardFonts.HelveticaBold),
    italique: await doc.embedFont(StandardFonts.HelveticaOblique),
  };
  const pagesGenerees = new Set<PDFPage>();
  const r = new Redaction(doc, polices, pagesGenerees);
  const sommaire: { titre: string; niveau: 0 | 1; page: PDFPage }[] = [];

  const anneeMax = (etudiant.annee_but ?? 1) as AnneeBUT;
  const referent = etudiant.referent_id ? await getUtilisateur(etudiant.referent_id) : undefined;
  const presentation = await getPresentation(etudiant.id);
  const argumentaires = await getArgumentaires(etudiant.id);
  const traces = await getTraces(etudiant.id);
  const evaluations = await getEvaluations(etudiant.id);
  const rendezVous = await getRendezVous(etudiant.id);
  const rdvPublie = (annee: number, numero: number) => {
    const rv = rendezVous.find((x) => x.annee === annee && x.numero === numero);
    return rv?.publie_le ? rv.note_publiee : null;
  };
  const dateExport = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date());
  const dateCourte = (iso: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(iso));

  // ---- Couverture ----
  const couverture = r.nouvellePage();
  couverture.drawRectangle({ x: 0, y: A4.hauteur - 300, width: A4.largeur, height: 300, color: COULEURS.primaire });
  couverture.drawText("PORTFOLIO DE COMPÉTENCES", { x: MARGE, y: A4.hauteur - 120, size: 12, font: polices.grasse, color: rgb(1, 1, 1) });
  couverture.drawText(nettoyer(nomComplet, polices.grasse), { x: MARGE, y: A4.hauteur - 170, size: 32, font: polices.grasse, color: rgb(1, 1, 1) });
  couverture.drawText(nettoyer(`BUT Gestion des entreprises et des administrations - BUT${anneeMax}`, polices.normale), {
    x: MARGE, y: A4.hauteur - 205, size: 13, font: polices.normale, color: rgb(1, 1, 1),
  });
  couverture.drawText(nettoyer(`Parcours ${parcoursEtudiant.code} : ${parcoursEtudiant.intitule}`, polices.normale), {
    x: MARGE, y: A4.hauteur - 225, size: 11, font: polices.normale, color: rgb(1, 1, 1),
  });
  r.y = A4.hauteur - 360;
  const ligneInfo = (libelle: string, valeur: string) => {
    r.texte(libelle, { taille: 9, police: "grasse", couleur: COULEURS.discret });
    r.texte(valeur, { taille: 12 });
    r.espace(10);
  };
  ligneInfo("GROUPE", etudiant.groupe ?? "-");
  ligneInfo("ENSEIGNANT·E RÉFÉRENT·E", referent ? `${referent.prenom} ${referent.nom}` : "Non affecté");
  ligneInfo("ANNÉES COUVERTES", Array.from({ length: anneeMax }, (_, i) => `BUT${i + 1}`).join(", "));
  ligneInfo("DOCUMENT GÉNÉRÉ LE", dateExport);

  // ---- Présentation ----
  r.nouvellePage();
  sommaire.push({ titre: "Présentation", niveau: 0, page: r.page });
  r.texte("Présentation", { taille: 22, police: "grasse" });
  r.espace(8);
  r.titreSection("Qui suis-je ?");
  r.texte(presentation?.texte || "Non renseigné.", { police: presentation?.texte ? "normale" : "italique" });
  r.titreSection("Projet professionnel");
  r.texte(presentation?.projet_pro || "Non renseigné.", { police: presentation?.projet_pro ? "normale" : "italique" });

  // ---- Compétences, année par année ----
  for (let annee = 1 as AnneeBUT; annee <= anneeMax; annee = (annee + 1) as AnneeBUT) {
    let premiereDeLAnnee = true;
    for (const c of competencesDeLAnnee(annee, etudiant.parcours)) {
      const niveau = c.niveaux[annee]!;
      const couleur = COULEURS[c.code as keyof typeof COULEURS] ?? COULEURS.primaire;
      const arg = argumentaires.find((a) => a.annee === annee && a.competence === c.code);
      const ev = evaluations.find((e) => e.annee === annee && e.competence === c.code);
      const tracesComp = traces.filter((t) => t.annee === annee && t.competence === c.code);

      const page = r.nouvellePage();
      if (premiereDeLAnnee) {
        sommaire.push({ titre: `BUT${annee}`, niveau: 0, page });
        premiereDeLAnnee = false;
      }
      sommaire.push({ titre: `${c.code} · ${c.intitule}`, niveau: 1, page });

      // Bandeau de la compétence
      page.drawRectangle({ x: 0, y: A4.hauteur - 128, width: A4.largeur, height: 128, color: couleur });
      page.drawText(nettoyer(`BUT${annee} · ${c.code} · ${c.troncCommun ? "Tronc commun" : `Parcours ${parcoursEtudiant.code}`}`, polices.grasse), {
        x: MARGE, y: A4.hauteur - 46, size: 9.5, font: polices.grasse, color: rgb(1, 1, 1),
      });
      let yBandeau = A4.hauteur - 72;
      for (const ligne of couperLignes(c.intitule, polices.grasse, 18, LARGEUR_TEXTE)) {
        page.drawText(ligne, { x: MARGE, y: yBandeau, size: 18, font: polices.grasse, color: rgb(1, 1, 1) });
        yBandeau -= 22;
      }
      page.drawText(nettoyer(`Niveau ${niveau.niveau} - ${niveau.libelle}`, polices.normale), {
        x: MARGE, y: A4.hauteur - 116, size: 10.5, font: polices.normale, color: rgb(1, 1, 1),
      });
      r.y = A4.hauteur - 150;

      r.titreSection("Évaluation", couleur);
      if (ev?.publiee_le && ev.niveau_publie) {
        const noteComp = ev.note_publiee;
        r.texte(`${libelleEvaluation(ev.niveau_publie)}${noteComp !== null ? ` · ${formatNote(noteComp)}` : ""}`, { taille: 12, police: "grasse" });
        const finale = noteFinale(noteComp, rdvPublie(annee, 1), rdvPublie(annee, 2));
        if (finale !== null) {
          r.texte(`Note finale de la compétence : ${formatNote(finale)} (avec les rendez-vous de suivi)`, { taille: 10, police: "grasse", couleur });
        }
        if (ev.commentaire_publie) r.texte(ev.commentaire_publie);
        r.texte(`Publiée le ${dateCourte(ev.publiee_le)}`, { taille: 8.5, couleur: COULEURS.discret });
      } else {
        r.texte("Pas encore d'évaluation publiée.", { police: "italique", couleur: COULEURS.discret });
      }

      r.titreSection("Apprentissages critiques visés", couleur);
      r.puces(niveau.apprentissagesCritiques.map((ac, i) => `${codeAC(c, annee, i)}  ${ac}`), 9.5);

      r.titreSection("Argumentaire", couleur);
      r.texte(arg?.texte || "Aucun argumentaire déposé.", { police: arg?.texte ? "normale" : "italique" });

      r.titreSection(`Traces jointes (${tracesComp.length})`, couleur);
      if (tracesComp.length === 0) r.texte("Aucune trace déposée.", { police: "italique", couleur: COULEURS.discret });
      tracesComp.forEach((t, i) => {
        r.texte(`Trace ${i + 1} : ${t.titre}`, { police: "grasse" });
        if (t.description) r.texte(t.description, { taille: 9.5, couleur: COULEURS.discret, retrait: 12 });
      });

      // Pages des traces, à la suite de la compétence
      for (const [i, t] of tracesComp.entries()) {
        const etiquette = nettoyer(`${c.code} BUT${annee} · Trace ${i + 1} : ${t.titre}`, polices.normale);
        try {
          const source = await PDFDocument.load(fs.readFileSync(cheminFichier(t.id)), { ignoreEncryption: true });
          const pages = await doc.copyPages(source, source.getPageIndices());
          for (const p of pages) {
            doc.addPage(p);
            // Petite étiquette en pied de page pour situer la trace dans le portfolio.
            const { width } = p.getSize();
            const largeur = Math.min(polices.normale.widthOfTextAtSize(etiquette, 7) + 10, width - 20);
            p.drawRectangle({ x: 10, y: 6, width: largeur, height: 12, color: rgb(1, 1, 1), opacity: 0.85 });
            p.drawText(etiquette, { x: 15, y: 9.5, size: 7, font: polices.normale, color: COULEURS.discret, maxWidth: largeur - 10 });
          }
        } catch {
          r.nouvellePage();
          r.texte(etiquette, { police: "grasse" });
          r.espace(8);
          r.texte(`Le fichier « ${t.fichier_nom} » n'a pas pu être intégré (PDF protégé ou endommagé). Il reste consultable dans Folio GEA.`, {
            police: "italique",
            couleur: COULEURS.discret,
          });
        }
      }
    }

    // ---- Rendez-vous de suivi et notes finales de l'année (notes publiées uniquement) ----
    const pageNotes = r.nouvellePage();
    sommaire.push({ titre: `Rendez-vous de suivi et notes finales · BUT${annee}`, niveau: 1, page: pageNotes });
    r.texte(`Rendez-vous de suivi et notes finales · BUT${annee}`, { taille: 18, police: "grasse" });
    r.espace(6);
    for (const def of RENDEZ_VOUS) {
      const rv = rendezVous.find((x) => x.annee === annee && x.numero === def.numero);
      r.titreSection(`${def.libelle} (${pourcentage(def.poids)} de chaque note finale)`);
      if (rv?.publie_le && rv.note_publiee !== null) {
        r.texte(`${formatNote(rv.note_publiee)}${rv.date_rdv ? ` · rendez-vous du ${dateCourte(rv.date_rdv)}` : ""}`, { taille: 12, police: "grasse" });
        if (rv.commentaire_publie) r.texte(rv.commentaire_publie);
      } else {
        r.texte("Pas encore de note publiée.", { police: "italique", couleur: COULEURS.discret });
      }
    }
    r.titreSection("Notes finales par compétence");
    const colonnes = [MARGE, MARGE + 190, MARGE + 300, MARGE + 380, MARGE + 450];
    const ligneTableau = (cellules: string[], police: keyof Polices, couleur: RGB = COULEURS.texte) => {
      r.assurer(18);
      r.y -= 16;
      cellules.forEach((t, i) =>
        r.page.drawText(nettoyer(t, polices[police]), { x: colonnes[i], y: r.y + 4, size: 9.5, font: polices[police], color: couleur }),
      );
      r.page.drawLine({ start: { x: MARGE, y: r.y }, end: { x: A4.largeur - MARGE, y: r.y }, thickness: 0.4, color: COULEURS.ligne });
    };
    ligneTableau(
      ["Compétence", `Compétence (${pourcentage(POIDS_COMPETENCE)})`, `RDV 1 (${pourcentage(RENDEZ_VOUS[0].poids)})`, `RDV 2 (${pourcentage(RENDEZ_VOUS[1].poids)})`, "Note finale"],
      "grasse",
      COULEURS.discret,
    );
    const r1 = rdvPublie(annee, 1);
    const r2 = rdvPublie(annee, 2);
    for (const c of competencesDeLAnnee(annee, etudiant.parcours)) {
      const ev = evaluations.find((e) => e.annee === annee && e.competence === c.code);
      const noteComp = ev?.publiee_le ? ev.note_publiee : null;
      const finale = noteFinale(noteComp, r1, r2);
      const v = (n: number | null) => (n === null ? "-" : formatNote(n));
      ligneTableau([`${c.code} ${c.nomCourt}`, v(noteComp), v(r1), v(r2), finale === null ? "en attente" : formatNote(finale)], "normale");
    }
    r.espace(10);
    r.texte(
      `Note finale = ${pourcentage(RENDEZ_VOUS[0].poids)} x RDV 1 + ${pourcentage(RENDEZ_VOUS[1].poids)} x RDV 2 + ${pourcentage(POIDS_COMPETENCE)} x note de la compétence, calculée sur les notes publiées.`,
      { taille: 8.5, couleur: COULEURS.discret },
    );
  }

  // ---- Sommaire, inséré après la couverture une fois les numéros de page connus ----
  const pageSommaire = doc.insertPage(1, [A4.largeur, A4.hauteur]);
  pagesGenerees.add(pageSommaire);
  const toutes = doc.getPages();
  const numero = (p: PDFPage) => toutes.indexOf(p) + 1;
  pageSommaire.drawText("Sommaire", { x: MARGE, y: A4.hauteur - MARGE - 22, size: 22, font: polices.grasse, color: COULEURS.texte });
  let y = A4.hauteur - MARGE - 60;
  for (const entree of sommaire) {
    const police = entree.niveau === 0 ? polices.grasse : polices.normale;
    const taille = entree.niveau === 0 ? 11.5 : 10;
    if (entree.niveau === 0) y -= 8;
    const retrait = entree.niveau === 0 ? 0 : 14;
    const num = String(numero(entree.page));
    const largeurNum = police.widthOfTextAtSize(num, taille);
    const titre = couperLignes(entree.titre, police, taille, LARGEUR_TEXTE - retrait - 40)[0];
    pageSommaire.drawText(titre, { x: MARGE + retrait, y, size: taille, font: police, color: COULEURS.texte });
    pageSommaire.drawText(num, { x: A4.largeur - MARGE - largeurNum, y, size: taille, font: police, color: COULEURS.discret });
    y -= taille * 1.8;
  }

  // ---- Pieds de page des pages générées ----
  const total = toutes.length;
  const pied = nettoyer(`${nomComplet} · Portfolio BUT GEA`, polices.normale);
  for (const p of toutes) {
    if (!pagesGenerees.has(p) || p === toutes[0]) continue;
    p.drawText(pied, { x: MARGE, y: 28, size: 8, font: polices.normale, color: COULEURS.discret });
    const texteNum = `${numero(p)} / ${total}`;
    p.drawText(texteNum, { x: A4.largeur - MARGE - polices.normale.widthOfTextAtSize(texteNum, 8), y: 28, size: 8, font: polices.normale, color: COULEURS.discret });
  }

  return doc.save();
}
