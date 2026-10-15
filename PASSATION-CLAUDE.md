# Passation à Claude : projet PAÉ (Folio GEA)

> **À l'attention de Claude, sur le nouveau poste.** Ce fichier résume tout le contexte du projet et l'historique du développement, fait sur un autre PC (Windows). Lis-le en entier avant toute action, puis lis `README.md`, qui reste la documentation de référence. Pour garder ce contexte d'une session à l'autre, tu peux en reprendre l'essentiel dans ta mémoire ou dans `CLAUDE.md`.

## 1. Qui est l'utilisateur

- Rémi Mougin, enseignant-chercheur en sciences de gestion / systèmes d'information, IUT du Limousin (université de Limoges), département **BUT GEA**.
- Il écrit en français et attend des réponses en français, dans un ton clair et sans jargon inutile.
- Il n'est pas développeur de métier : explique les choix techniques simplement et propose une recommandation plutôt qu'une liste d'options.
- **Ne jamais piloter sa souris ni son clavier** pour tester (pas de SetCursorPos, mouse_event, SendKeys, xdotool…). Il travaille sur sa machine pendant les tests. Vérifie par des moyens passifs (aperçu navigateur, journaux, tests automatisés, captures sans interaction) ou demande-lui avant.

## 2. Le projet en une phrase

**Folio GEA** est l'application web de la **PAÉ** (démarche portfolio de compétences) du BUT GEA : les étudiants y déposent leur portfolio (argumentaires et traces PDF par compétence), leur enseignant référent l'évalue et suit deux rendez-vous par an, et l'administrateur gère les étudiants, les référents et le passage d'année. Elle s'inspire d'UniFolio (IUT de Troyes).

## 3. Pile technique

| Élément | Choix actuel |
| --- | --- |
| Framework | **Next.js 16.3.8** (App Router, Server Actions), React 19.2, TypeScript, Tailwind CSS 4 |
| Base de données | **SQLite intégré à Node** (`node:sqlite`), fichier `data/portfolio.db` |
| Fichiers | PDF déposés dans `data/fichiers/` |
| PDF | `pdf-lib` (export du portfolio complet) |
| Excel | `exceljs` (import des listes d'étudiants, modèle téléchargeable) |
| Node.js | **22.5 minimum** (testé avec Node 24.19 sous Windows) |
| Connexion | **simulée** par un cookie `folio_utilisateur` (choix du compte sur `/connexion`) |

⚠️ `AGENTS.md` prévient : **cette version de Next.js a des changements incompatibles avec ce que tu connais**. Avant d'écrire du code Next.js, lis le guide concerné dans `node_modules/next/dist/docs/` et respecte les avis de dépréciation. Ce bloc est réécrit automatiquement par `next dev`.

`next.config.ts` : `serverExternalPackages: ["exceljs", "pdf-lib"]` et `serverActions.bodySizeLimit: "11mb"` (traces PDF de 10 Mo).

## 4. Fonctionnalités réalisées (V1 complète en local)

- **Référentiels** des parcours **GEMA, GPRH, GC2F** : tronc commun C1 à C3, C4-C5 propres au parcours. CG2P n'est pas encore configuré (affiche GEMA provisoirement). Apprentissages critiques numérotés AC + compétence + niveau + rang (ex. AC11.01).
- **Étudiant** : onglet Présentation puis un onglet par compétence ; argumentaire saisi dans l'outil + 1 à 3 traces PDF (10 Mo max), renommables, remplaçables, supprimables à tout moment. Années précédentes accessibles et modifiables.
- **Référent** : ne voit que ses étudiants ; tableau de promotion (état des dépôts, évaluations, brouillons à publier, nouveautés depuis la dernière visite, fil d'activité).
- **Évaluation en deux temps** : brouillon puis publication (par compétence ou par année). Niveau qualitatif (Non acquis / En cours d'acquisition / Acquis / Dépassé) + **note sur 20 obligatoire** + commentaire. L'étudiant ne voit que la version publiée.
- **Rendez-vous de suivi** (onglet *Suivi et notes*) : 2 par an, avec date, note /20 et compte rendu, brouillon puis publication. **Note finale = 10 % RDV 1 + 20 % RDV 2 + 70 % note de la compétence** (réglable dans `src/lib/referentiel.ts`, constante `RENDEZ_VOUS`).
- **Administration** : import Excel/CSV (colonnes Nom, Prénom, Email étudiant, Année, Parcours, Enseignant référent, Email enseignant, Groupe facultatif) avec aperçu ligne par ligne ; ajout manuel ; affectation des référents ; fiche de compte (modifier, désactiver, supprimer avec confirmation par saisie du nom) ; **passage d'année et réaffectations groupés**.
- **Notifications** dans l'outil (cloche) + préférence de courriel par utilisateur (à chaque fois / récapitulatif quotidien / jamais). Les courriels sont mis **en file d'attente** (table `courriels`) mais **pas encore envoyés**.
- **Export PDF** du portfolio complet : couverture, sommaire paginé, présentation, une page par compétence et par année avec évaluation + traces intégrées (étiquetées en pied de page), page « Rendez-vous et notes finales » par année.
- **Journal** de toutes les actions (qui, quoi, quand).
- **Thème clair / sombre** (bouton lune / soleil).
- **Jeu de démonstration** créé au premier lancement : 3 enseignants (dont une administratrice), 12 étudiants en BUT1-2-3, dont 2 GPRH (Sarah Benali, Maxime Laurent) et 2 GC2F (Julie Perrin, Antoine Masson). Supprimer `data/` pour repartir de zéro ; les anciennes bases sont migrées automatiquement au démarrage.

## 5. Organisation du code

| Fichier | Rôle |
| --- | --- |
| `src/lib/referentiel.ts` | Compétences, niveaux, AC des parcours, pondération des notes (source unique) |
| `src/lib/db.ts` | Schéma SQLite (tables `utilisateurs`, `presentations`, `argumentaires`, `traces`, `evaluations`, `journal`, `consultations`, `notifications`, `rendez_vous`, `courriels`), migrations, requêtes, jeu de démo |
| `src/lib/session.ts` | Connexion simulée et règles d'accès (`estEnseignant`, `estAdmin`, `suitEtudiant`, `peutConsulter`, `peutModifier`) |
| `src/lib/export-pdf.ts` | Assemblage du PDF complet |
| `src/lib/import-etudiants.ts` | Lecture, contrôle et application de l'import, modèle Excel |
| `src/lib/pdf-demo.ts`, `affichage.ts`, `theme.ts` | PDF de démo, aides d'affichage, thème |
| `src/app/actions.ts` | Server Actions (dépôts, évaluations, publication, affectations, journal) |
| `src/app/portfolio/[etudiantId]` | Portfolio à onglets |
| `src/app/enseignant` | Tableau de suivi |
| `src/app/admin/affectations`, `admin/comptes/[id]`, `admin/passage`, `admin/modele-import` | Administration |
| `src/app/compte`, `notifications`, `connexion` | Mon compte, notifications, connexion simulée |
| `src/app/fichiers/[id]`, `src/app/export/[etudiantId]` | Accès contrôlé aux traces et à l'export PDF |
| `src/components/` | `portfolio.tsx`, `admin.tsx`, `formulaires.tsx`, `EnTete.tsx`, `BoutonTheme.tsx`, `useActionConservee.ts` |

Environ 5 700 lignes dans `src/`.

### Maquette autonome (pour la démonstration)

- `maquette/folio-gea-maquette.html` : un seul fichier HTML, données stockées dans le navigateur, à partager tel quel.
- `maquette/source/folio-gea.html` : source ; `test-maquette.cjs` : tests (`node maquette/source/test-maquette.cjs`) ; `autonome.cjs` produit la version autonome :
  `node maquette/source/autonome.cjs maquette/source/folio-gea.html maquette/folio-gea-maquette.html`
- Publiées aussi en artefacts claude.ai (privés, compte de l'utilisateur) :
  - Maquette Folio GEA : https://claude.ai/artifact/2BPbda4wvccXMufmotaafe
  - Guide utilisateur Folio GEA : https://claude.ai/artifact/PjighjiPnwyMTdrdh4B26v

## 6. Historique

| Date | Étape |
| --- | --- |
| 13/09/2026 | Création du projet Next.js (`erp-pedagogique`) |
| fin sept. 2026 | Référentiels, dépôts, évaluation, export PDF, journal |
| 01/10/2026 | Import Excel, administration des comptes, passage d'année, notifications, thème sombre ; guide utilisateur publié ; maquette autonome et ses tests |
| 02/10/2026 | Dernière mise à jour de la maquette publiée |
| 06/10/2026 | Rendez-vous avec la **DSI** ; README complété par la note de reprise sous Linux |
| 15/10/2026 | Ce fichier de passation ; reprise prévue sur un autre PC (Linux) |

## 7. Recommandations de la DSI (06/10/2026) et décision ouverte

La DSI demande : **développer sous Linux** (pour dupliquer le projet sur leur serveur), **SSO OpenID Connect** (identifiants de l'université), pile **Apache + MariaDB** (ils ont cité MAMP, donc pensent PHP).

**Décision encore ouverte** : l'appli est en Node.js, pas en PHP.

- **Voie A (recommandée)** : garder Node.js. Passer SQLite → MariaDB (`src/lib/db.ts`), remplacer la connexion simulée par OpenID Connect (`src/lib/session.ts`, `src/app/connexion`), Apache en **reverse proxy** devant Node.js lancé par un **service systemd**.
- **Voie B** : réécriture en PHP (Symfony) sur la pile standard de la DSI.

**Première chose à faire à la reprise : demander à l'utilisateur la réponse de la DSI** à la question « Pouvez-vous héberger une application Node.js 22 derrière Apache (en relais), avec MariaDB ? ».

Pour OpenID Connect, il faudra obtenir de la DSI : l'adresse du fournisseur (issuer), un client ID et un secret, l'URL de retour à déclarer, et les attributs transmis (identifiant, email, nom, prénom, statut étudiant / personnel).

Note : le commentaire de `src/lib/session.ts` parle encore du « CAS de l'université » ; la cible est désormais **OpenID Connect**.

## 8. Reste à faire

1. Obtenir la réponse de la DSI (voie A ou B).
2. Connexion SSO OpenID Connect (remplace `session.ts` et `/connexion`).
3. Base MariaDB à la place de SQLite ; configuration Apache, service systemd, sauvegardes.
4. Envoi réel des courriels en file d'attente (SMTP de l'université), dont le récapitulatif quotidien.
5. Référentiel CG2P et mise à jour vers le nouveau programme national.
6. Mettre le projet sous Git (idéalement le GitLab de l'université) : **le dossier n'est pas encore un dépôt Git**.

## 9. Installer sur le nouveau poste (Ubuntu)

Copier le dossier **sans** `node_modules/`, `.next/` ni `data/` (recréés automatiquement). Les dossiers `desktop-widget/`, `service-widget/` et `rive/` sont **d'autres projets** (outils de bureau Electron personnels), sans lien avec Folio GEA : inutile de les copier pour la PAÉ.

```bash
sudo apt install nodejs npm apache2 mariadb-server   # ou Node.js 22 via NodeSource si la version d'Ubuntu est trop ancienne
node -v                                              # 22.5 minimum
npm install
npm run dev                                          # http://localhost:3000
```

Vérifications rapides après installation : la page `/connexion` liste les comptes de démo ; se connecter en administratrice, ouvrir *Étudiants et affectations*, puis un portfolio, et lancer l'export PDF.

## 10. Méthode de travail attendue

- Lire le code existant avant de modifier, garder le style (noms et commentaires **en français**, Server Actions, composants dans `src/components/`).
- Mettre à jour `README.md` à chaque nouvelle fonctionnalité (il sert de documentation).
- Après une modification visible, vérifier dans le navigateur (aperçu du serveur de dev) plutôt que de demander à l'utilisateur de tester.
- Si la maquette doit suivre une évolution : modifier `maquette/source/folio-gea.html`, relancer ses tests, régénérer la version autonome.
