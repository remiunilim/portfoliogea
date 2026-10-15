// Référentiel de compétences du BUT GEA : tronc commun (C1 à C3) et compétences propres à chaque
// parcours (C4 et C5). Source : référentiels nationaux 2022 (parcours GEMA, GPRH et GC2F).
// Ce fichier est la seule source de vérité pour les onglets du portfolio :
// le mettre à jour suffit lorsque le nouveau programme national sera publié.

export type AnneeBUT = 1 | 2 | 3;
export const ANNEES: AnneeBUT[] = [1, 2, 3];

export type NiveauCompetence = {
  niveau: number;
  libelle: string;
  apprentissagesCritiques: string[];
};

export type Competence = {
  code: string;
  nomCourt: string;
  intitule: string;
  troncCommun: boolean;
  composantes: string[];
  situations: string[];
  // Niveau de développement attendu pour chaque année de BUT (absent = non travaillée).
  niveaux: Partial<Record<AnneeBUT, NiveauCompetence>>;
};

// Tronc commun (C1-C3) suivi des compétences du parcours GEMA (C4-C5).
const COMPETENCES_TRONC_ET_GEMA: Competence[] = [
  {
    code: "C1",
    nomCourt: "Analyser",
    intitule: "Analyser les processus de l'organisation dans son environnement",
    troncCommun: true,
    composantes: [
      "En déterminant correctement ses enjeux sociaux, économiques et juridiques",
      "En identifiant rigoureusement les différentes dimensions de l'identité et des caractéristiques internes et externes des organisations selon des critères pertinents",
      "En présentant de manière détaillée les attentes de chacun des acteurs et partenaires de l'organisation",
    ],
    situations: [
      "Réalisation d'une analyse environnementale appliquée au secteur de l'organisation",
      "Diagnostic en interne et en externe des forces et des faiblesses de l'organisation",
      "Identification des partenaires de l'organisation",
      "Réalisation de la veille sociale et juridique",
    ],
    niveaux: {
      1: {
        niveau: 1,
        libelle: "Identifier les processus de l'organisation",
        apprentissagesCritiques: [
          "Identifier les différents types d'enjeux",
          "Qualifier les différents types d'organisations",
          "Identifier les relations des acteurs au sein d'un processus",
        ],
      },
      2: {
        niveau: 2,
        libelle: "Évaluer les processus de l'organisation",
        apprentissagesCritiques: [
          "Analyser les différents types d'enjeux",
          "Analyser les dimensions identitaires (juridiques, managériales…) de l'organisation",
          "Évaluer le niveau de performance des processus",
        ],
      },
      3: {
        niveau: 3,
        libelle: "Conseiller pour l'amélioration des processus de l'organisation",
        apprentissagesCritiques: [
          "Intégrer l'impact des enjeux sur l'organisation",
          "Conseiller un type d'organisation",
          "Proposer des améliorations des processus",
        ],
      },
    },
  },
  {
    code: "C2",
    nomCourt: "Décider",
    intitule: "Aider à la prise de décision",
    troncCommun: true,
    composantes: [
      "En utilisant efficacement un système d'information de gestion adapté",
      "En utilisant des outils, notamment numériques, pertinents",
      "En interprétant pertinemment les données qualitatives et quantitatives",
      "En respectant rigoureusement les contraintes et les procédures de l'organisation",
    ],
    situations: [
      "Mise en œuvre d'une organisation comptable et fiscale adaptée",
      "Collecte, traitement, analyse et diffusion des données chiffrées",
      "Exploitation des outils numériques pour participer à la digitalisation de l'organisation",
      "Prévision de l'activité de l'organisation",
    ],
    niveaux: {
      1: {
        niveau: 1,
        libelle: "Identifier les éléments d'aide à la prise de décision",
        apprentissagesCritiques: [
          "Identifier les composantes du système d'information de gestion",
          "Rechercher, collecter et traiter les données brutes afin de produire et de diffuser une information structurée",
          "Identifier les contraintes qui s'imposent à l'organisation",
          "Identifier les risques",
        ],
      },
      2: {
        niveau: 2,
        libelle: "Évaluer les éléments d'aide à la prise de décision",
        apprentissagesCritiques: [
          "Analyser les enjeux du système d'information et leur impact sur le fonctionnement de l'organisation",
          "Exploiter un ERP/PGI et ses fonctionnalités de base",
          "Traiter les données pertinentes pour répondre à une problématique",
          "Analyser les contraintes et leur impact sur le fonctionnement et sur la performance de l'organisation",
          "Évaluer les risques",
        ],
      },
      3: {
        niveau: 3,
        libelle: "Concourir à la prise de décision",
        apprentissagesCritiques: [
          "Collaborer au processus d'amélioration continue du système d'information",
          "Exploiter les données pour accompagner la prise de décision",
          "Participer à la prise de décision en fonction des contraintes identifiées",
          "Élaborer des mesures préventives de minimisation des risques",
        ],
      },
    },
  },
  {
    code: "C3",
    nomCourt: "Piloter",
    intitule: "Piloter les relations avec les parties prenantes de l'organisation",
    troncCommun: true,
    composantes: [
      "En mettant en œuvre une démarche favorisant la cohésion de groupe",
      "En participant efficacement à des travaux collectifs ou des projets collaboratifs",
      "En mobilisant des outils et techniques de communication adaptés aux enjeux de l'organisation",
      "En contribuant efficacement à la gestion individuelle et collective des parties prenantes de l'organisation",
      "En appréciant la cohérence de la stratégie de l'organisation à l'aide d'outils de diagnostic interne et externe pertinents",
    ],
    situations: [
      "Analyse des relations avec les parties prenantes et collaboration à la stratégie organisationnelle",
      "Production de supports de communication écrite et orale, y compris en langues étrangères",
      "Collaboration en mode projet",
      "Collaboration à la gestion opérationnelle des RH de l'organisation",
    ],
    niveaux: {
      1: {
        niveau: 1,
        libelle: "Identifier les relations entre les parties prenantes",
        apprentissagesCritiques: [
          "Identifier ses qualités individuelles",
          "Identifier les relations inter-personnelles et collectives",
          "Travailler en équipe avec méthodes",
          "Utiliser de façon pertinente les techniques de communication",
        ],
      },
      2: {
        niveau: 2,
        libelle: "Coordonner les relations entre les parties prenantes",
        apprentissagesCritiques: [
          "Mobiliser ses qualités individuelles au service de l'intelligence collective",
          "Analyser les relations inter-personnelles et collectives dans la stratégie de l'organisation",
          "Utiliser les outils d'organisation et méthodes dédiés au travail collaboratif",
          "Combiner les méthodes de communication en lien avec la stratégie",
        ],
      },
      3: {
        niveau: 3,
        libelle: "Améliorer les relations entre les parties prenantes",
        apprentissagesCritiques: [
          "Animer une équipe",
          "Mener un projet collaboratif",
          "Participer à l'amélioration de la politique de communication en lien avec la stratégie",
        ],
      },
    },
  },
  {
    code: "C4",
    nomCourt: "Entreprendre",
    intitule: "Concevoir la stratégie de création de valeur",
    troncCommun: false,
    composantes: [
      "En étudiant les marchés actuels et futurs dans un environnement sectoriel spécifique",
      "En élaborant un business model adapté",
      "En réalisant un business plan réaliste dans sa dimension financière",
      "En choisissant une structure juridique pertinente",
    ],
    situations: [
      "Choix d'une structure juridique, financière et fiscale adaptée",
      "Élaboration du business model et du business plan",
      "Définition et mise en œuvre d'un projet entrepreneurial",
    ],
    niveaux: {
      2: {
        niveau: 1,
        libelle: "Modéliser la proposition de valeur",
        apprentissagesCritiques: [
          "S'adapter aux évolutions induites par le contexte d'incertitude",
          "Évaluer le potentiel d'un marché à partir d'une collecte d'informations pertinentes",
          "Modéliser les composantes d'un business model d'une entité existante",
          "Apprécier la cohérence d'un business model et de son business plan",
        ],
      },
      3: {
        niveau: 2,
        libelle: "Sécuriser la proposition de valeur",
        apprentissagesCritiques: [
          "Tester la viabilité financière d'un business model",
          "Apprécier les risques financiers, fiscaux et juridiques de l'entité ou de l'entrepreneur",
          "Préconiser les mesures de protection contre les risques",
          "Persuader une partie prenante de la viabilité du business plan",
          "Confronter son projet à son expérience de terrain",
        ],
      },
    },
  },
  {
    code: "C5",
    nomCourt: "Développer",
    intitule: "Assurer la gestion et le développement de la chaîne de valeur",
    troncCommun: false,
    composantes: [
      "En gérant avec les outils adaptés les activités de production",
      "En gérant les activités de développement marketing en mobilisant les techniques pertinentes",
      "En gérant opérationnellement les ressources humaines",
      "En gérant la supply chain avec les techniques adéquates",
      "En maîtrisant le risque financier à l'aide des outils adaptés",
    ],
    situations: [
      "Pilotage de projets",
      "Mise en œuvre de qualités de leadership",
      "Utilisation des fonctions support dans l'organisation",
      "Identification et gestion des risques",
      "Utilisation des outils du marketing, notamment numériques, pour promouvoir la création de valeur",
    ],
    niveaux: {
      2: {
        niveau: 1,
        libelle: "Développer la chaîne de valeur",
        apprentissagesCritiques: [
          "Promouvoir un projet, un événement ou une organisation par des actions de communication adaptées",
          "Identifier la variété et la complexité des processus de production et de supply chain",
          "Utiliser les techniques de négociation avec les partenaires commerciaux",
          "Évaluer les axes d'une démarche de marketing opérationnel, y compris digitale",
          "Évaluer le risque de trésorerie",
          "Contribuer à la gestion opérationnelle des ressources humaines",
        ],
      },
      3: {
        niveau: 2,
        libelle: "Optimiser la chaîne de valeur",
        apprentissagesCritiques: [
          "Concevoir une stratégie de communication en utilisant les outils adaptés, y compris digitaux",
          "Mettre en œuvre des processus de production et de supply chain adaptés à la situation de l'entité",
          "Concevoir une démarche de marketing opérationnel adaptée à l'entité",
          "Prévenir les risques de défaillance avec les outils adaptés",
          "Déterminer les axes principaux d'une politique de ressources humaines dans l'entité",
        ],
      },
    },
  },
];

const TRONC_COMMUN = COMPETENCES_TRONC_ET_GEMA.filter((c) => c.troncCommun);

// Compétences propres au parcours GPRH (référentiel national 2022).
const COMPETENCES_GPRH: Competence[] = [
  {
    code: "C4",
    nomCourt: "Administrer",
    intitule: "Gérer l'administration du personnel",
    troncCommun: false,
    composantes: [
      "En appliquant rigoureusement le cadre juridique en matière de RH",
      "En établissant la paie conformément à la réglementation en vigueur et à la politique de rémunération",
      "En produisant des documents administratifs et juridiques adaptés",
    ],
    situations: [
      "Gestion individuelle et collective des salariés",
      "Mise en œuvre de la politique de rémunération des salariés",
      "Mise en œuvre de la représentation des salariés et du dialogue social",
    ],
    niveaux: {
      2: {
        niveau: 1,
        libelle: "Conduire les activités administratives des RH",
        apprentissagesCritiques: [
          "Établir un bulletin de paie en intégrant les éléments fixes et variables de la rémunération",
          "Appliquer rigoureusement les procédures, du recrutement à la fin du contrat de travail",
          "Administrer les dossiers personnels des salariés, y compris dans le domaine de la santé et de la sécurité au travail",
          "Produire des déclarations sociales fiables",
          "Restituer les résultats des tableaux de bord sociaux",
          "Organiser les élections, le renouvellement et le fonctionnement des instances représentatives du personnel",
        ],
      },
      3: {
        niveau: 2,
        libelle: "Optimiser les processus administratifs RH",
        apprentissagesCritiques: [
          "Rendre compte des évolutions des obligations sociales et juridiques qui impactent l'organisation",
          "Optimiser la procédure de gestion de la paie et la politique de rémunération",
          "Proposer, après analyse, des indicateurs pertinents du dialogue social",
          "Réaliser un reporting RH adapté pour les parties prenantes internes",
          "Proposer des solutions d'optimisation de la performance sociale en fonction des choix stratégiques",
        ],
      },
    },
  },
  {
    code: "C5",
    nomCourt: "Développer",
    intitule: "Gérer le développement des ressources humaines",
    troncCommun: false,
    composantes: [
      "En mobilisant les dispositifs adaptés de formation, d'évaluation et de développement des compétences et de mobilité",
      "En contribuant efficacement au processus de recrutement externe",
      "En assurant une communication RH interne et externe pertinente",
      "En contribuant à l'élaboration et la diffusion des dispositifs de lutte contre les discriminations dans le respect de la loi et des politiques de RSE",
      "En contribuant efficacement à la mise en place et au suivi des dispositifs de protection de la santé, de la sécurité et de la qualité de vie au travail",
    ],
    situations: [
      "Collaboration à la politique de formation",
      "Participation à la politique de recrutement",
      "Participation à la politique QHSE",
      "Contribution à la politique RSE",
    ],
    niveaux: {
      2: {
        niveau: 1,
        libelle: "Mettre en œuvre les politiques RH",
        apprentissagesCritiques: [
          "Mettre en œuvre les outils et les dispositifs de développement des emplois, des compétences et des carrières selon la stratégie de l'organisation",
          "Mettre en œuvre des outils et des techniques adaptés du processus de recrutement",
          "Mettre en œuvre la communication RH",
          "Identifier les enjeux et les outils d'une démarche de qualité de vie au travail",
          "Définir les enjeux et les dispositifs adaptés de RSE",
        ],
      },
      3: {
        niveau: 2,
        libelle: "Optimiser les politiques RH",
        apprentissagesCritiques: [
          "Optimiser les dispositifs de développement RH",
          "Optimiser les outils et techniques du processus de recrutement",
          "Optimiser la communication RH en interne et en externe",
          "Analyser la pertinence des outils de la digitalisation de la gestion RH",
          "Optimiser les dispositifs de gestion de la diversité et de la qualité de vie au travail",
          "Optimiser les différentes politiques RH grâce à l'analyse des résultats des indicateurs de performance RH",
        ],
      },
    },
  },
];

// Compétences propres au parcours GC2F (référentiel national 2022).
const COMPETENCES_GC2F: Competence[] = [
  {
    code: "C4",
    nomCourt: "Produire",
    intitule: "Produire l'information comptable, fiscale et sociale de l'organisation",
    troncCommun: false,
    composantes: [
      "En repérant précisément le fonctionnement juridique et comptable des différents types d'organisation",
      "En respectant les règles comptables et de révision comptable applicables",
      "En respectant les règles de droit fiscal et de droit social applicables",
      "En s'adaptant efficacement à l'environnement numérique et à la digitalisation des activités comptables, sociales et fiscales",
    ],
    situations: [
      "Contrôle et révision des comptes annuels",
      "Présentation des indicateurs de gestion",
      "Accompagnement et conseil des dirigeants dans la gestion et le suivi de leur activité",
      "Adaptation de la comptabilité d'une organisation dans le respect des normes internationales",
    ],
    niveaux: {
      2: {
        niveau: 1,
        libelle: "Contrôler l'information comptable, fiscale et sociale produite",
        apprentissagesCritiques: [
          "Traiter et contrôler l'ensemble des opérations de comptabilité générale et de comptabilité approfondie en conformité avec les règles comptables, fiscales et sociales et dans le respect des normes professionnelles",
          "Distinguer les différents acteurs de la comptabilité et leur environnement réglementaire",
          "Prendre en charge la révision comptable en contrôlant les différents cycles de l'organisation",
          "Établir les comptes annuels à l'aide des outils de digitalisation",
        ],
      },
      3: {
        niveau: 2,
        libelle: "Optimiser l'information comptable, fiscale et sociale produite",
        apprentissagesCritiques: [
          "Résoudre les problèmes comptables spécifiques à l'évaluation des actifs et passifs et à la détermination des charges et produits dans une organisation",
          "Appliquer les règles comptables, fiscales et sociales adaptées à l'organisation",
          "Réaliser un diagnostic et/ou un audit pour apporter des conseils",
          "Sécuriser l'information comptable, fiscale et sociale produite",
        ],
      },
    },
  },
  {
    code: "C5",
    nomCourt: "Évaluer",
    intitule: "Évaluer l'activité de l'organisation",
    troncCommun: false,
    composantes: [
      "En identifiant rigoureusement l'activité et la structure financière en fonction des différents types d'organisation",
      "En proposant des solutions d'amélioration à partir de l'identification des éventuels problèmes",
      "En développant la politique financière d'une organisation de façon pertinente et adaptée",
      "En mobilisant des outils pertinents de contrôle de gestion propres à l'organisation",
      "En développant un système d'information numérique d'analyse et de prévision de l'activité adapté au type d'organisation",
    ],
    situations: [
      "Construction d'un tableau de bord et analyse des indicateurs financiers",
      "Mise en œuvre d'outils d'évaluation de la performance économique et financière de l'organisation",
      "Appréciation de la pertinence d'un investissement",
      "Exploitation des opportunités des différents modes de financement",
    ],
    niveaux: {
      2: {
        niveau: 1,
        libelle: "Élaborer des outils d'analyse et de prévision de l'activité",
        apprentissagesCritiques: [
          "Identifier les points forts et les points faibles de l'organisation, aussi bien en termes d'activité que de structure financière",
          "Mesurer la rentabilité d'un investissement",
          "Réaliser des prévisions au niveau de l'activité, de la trésorerie et du patrimoine dans une optique de financement de l'organisation",
          "Mettre en place une comptabilité analytique et une gestion budgétaire",
        ],
      },
      3: {
        niveau: 2,
        libelle: "Optimiser les outils d'analyse et de prévision de l'activité",
        apprentissagesCritiques: [
          "Mettre en place une politique d'investissement cohérente",
          "Mettre en place les sources de financement nécessaires",
          "Établir un plan de financement équilibré",
          "Réaliser la gestion de trésorerie sur le court terme",
          "Réaliser à moyen et long terme des budgets d'exploitation et de trésorerie, des comptes de résultat et des bilans prévisionnels",
          "Évaluer les résultats et les performances de l'organisation par le contrôle budgétaire",
        ],
      },
    },
  },
];

// Parcours dont le référentiel est configuré. Un parcours inconnu (ex. CG2P) retombe sur GEMA.
export const PARCOURS_CONFIGURES: Record<string, { code: string; intitule: string; competences: Competence[] }> = {
  GEMA: {
    code: "GEMA",
    intitule: "Gestion, entrepreneuriat et management d'activités",
    competences: COMPETENCES_TRONC_ET_GEMA.filter((c) => !c.troncCommun),
  },
  GPRH: { code: "GPRH", intitule: "Gestion et pilotage des ressources humaines", competences: COMPETENCES_GPRH },
  GC2F: { code: "GC2F", intitule: "Gestion comptable, fiscale et financière", competences: COMPETENCES_GC2F },
};
export const PARCOURS_PAR_DEFAUT = "GEMA";

export function infosParcours(parcours: string | null | undefined) {
  return PARCOURS_CONFIGURES[parcours ?? ""] ?? PARCOURS_CONFIGURES[PARCOURS_PAR_DEFAUT];
}

export function parcoursEstConfigure(parcours: string | null | undefined): boolean {
  return !!PARCOURS_CONFIGURES[parcours ?? ""];
}

export function competencesDuParcours(parcours: string | null | undefined): Competence[] {
  return [...TRONC_COMMUN, ...infosParcours(parcours).competences];
}

// Compétences travaillées une année donnée : 3 en BUT1 (tronc commun), 5 en BUT2 et BUT3.
export function competencesDeLAnnee(annee: AnneeBUT, parcours: string | null | undefined): Competence[] {
  return competencesDuParcours(parcours).filter((c) => c.niveaux[annee]);
}

export function competenceParCode(code: string, parcours: string | null | undefined): Competence | undefined {
  return competencesDuParcours(parcours).find((c) => c.code === code);
}

// Toutes les compétences d'un code donné, tous parcours confondus (en-têtes du tableau de suivi).
export function nomsCourtsParCode(code: string): string[] {
  const noms = [...TRONC_COMMUN, ...Object.values(PARCOURS_CONFIGURES).flatMap((p) => p.competences)]
    .filter((c) => c.code === code)
    .map((c) => c.nomCourt);
  return [...new Set(noms)];
}

export function estAnneeBUT(n: number): n is AnneeBUT {
  return n === 1 || n === 2 || n === 3;
}

// Numéro d'un apprentissage critique, selon la convention des BUT :
// AC + n° de compétence + n° de niveau + « . » + rang sur deux chiffres (ex. AC11.01, AC42.03).
export function codeAC(competence: Competence, niveau: NiveauCompetence, rang: number): string {
  return `AC${competence.code.replace(/\D/g, "")}${niveau.niveau}.${String(rang + 1).padStart(2, "0")}`;
}

// Échelle d'évaluation du PAÉ (niveau + note facultative + commentaire, par compétence et par année).
export const NIVEAUX_EVALUATION = [
  { code: "non_evalue", libelle: "Non évalué" },
  { code: "insuffisant", libelle: "Non acquis" },
  { code: "en_cours", libelle: "En cours d'acquisition" },
  { code: "acquis", libelle: "Acquis" },
  { code: "depasse", libelle: "Dépassé" },
] as const;

export type CodeEvaluation = (typeof NIVEAUX_EVALUATION)[number]["code"];

export function libelleEvaluation(code: string): string {
  return NIVEAUX_EVALUATION.find((n) => n.code === code)?.libelle ?? "Non évalué";
}

// Note sur 20, facultative (décimales acceptées, enregistrée au centième).
export const NOTE_MAX = 20;

export function formatNote(note: number | null | undefined): string {
  if (note === null || note === undefined) return "";
  return `${String(note).replace(".", ",")}/${NOTE_MAX}`;
}

// Deux rendez-vous de suivi par année, chacun noté sur 20. La note finale de chaque compétence
// combine les deux rendez-vous et la note de la compétence :
//   note finale = 10 % × RDV 1 + 20 % × RDV 2 + 70 % × note de la compétence
export const RENDEZ_VOUS = [
  { numero: 1, libelle: "1er rendez-vous de suivi", poids: 0.1 },
  { numero: 2, libelle: "2e rendez-vous de suivi", poids: 0.2 },
] as const;
export const POIDS_COMPETENCE = 1 - RENDEZ_VOUS.reduce((s, r) => s + r.poids, 0);

export function pourcentage(poids: number) {
  return `${Math.round(poids * 100)} %`;
}

// Renvoie null tant qu'une des trois notes manque.
export function noteFinale(noteCompetence: number | null | undefined, rdv1: number | null | undefined, rdv2: number | null | undefined): number | null {
  if ([noteCompetence, rdv1, rdv2].some((n) => n === null || n === undefined)) return null;
  const total = RENDEZ_VOUS[0].poids * rdv1! + RENDEZ_VOUS[1].poids * rdv2! + POIDS_COMPETENCE * noteCompetence!;
  return Math.round(total * 100) / 100;
}

// « 12,5 », « 12.5 », « 12,5/20 » → 12.5 ; vide → null ; hors bornes → undefined (erreur).
export function lireNote(saisie: string): number | null | undefined {
  const t = saisie.trim().replace(/\/\s*20$/, "").replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0 || n > NOTE_MAX) return undefined;
  return Math.round(n * 100) / 100;
}

// Repères pour structurer l'argumentaire réflexif (cycle de Kolb, cf. cafés pédagogiques).
export const GUIDE_ARGUMENTAIRE = [
  { etape: "Expérience", question: "Qu'ai-je fait ? Dans quelle situation, avec quels enjeux ?" },
  { etape: "Observation réflexive", question: "Qu'ai-je observé ? Qu'est-ce qui m'a surpris, questionné ou posé difficulté ?" },
  { etape: "Conceptualisation", question: "Qu'ai-je appris ? Quels liens avec les apprentissages critiques visés ?" },
  { etape: "Transfert", question: "Comment réutiliser cet apprentissage ailleurs ? Que devrais-je adapter ?" },
];

export const MAX_TRACES_PAR_COMPETENCE = 3;
export const TAILLE_MAX_PDF = 10 * 1024 * 1024;
