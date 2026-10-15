# Folio GEA : portfolio de compétences du BUT GEA (PAÉ)

Plateforme de dépôt, de suivi et d'évaluation des portfolios des étudiants du BUT GEA. Les référentiels des parcours **GEMA, GPRH et GC2F** sont configurés : tronc commun C1 à C3, et C4-C5 propres à chaque parcours (un parcours non encore configuré, comme CG2P, affiche provisoirement GEMA). L'interface propose un **thème clair et un thème sombre** (bouton lune / soleil dans l'en-tête). Elle s'inspire d'UniFolio (IUT de Troyes) et de la démarche portfolio présentée lors des cafés pédagogiques.

## Lancer en local

```bash
npm install
npm run dev
```

Ouvrir ensuite http://localhost:3000. Il faut Node.js 22.5 ou une version plus récente, car l'application utilise le module SQLite intégré à Node.

Au premier lancement, l'application crée le dossier `data/`, qui contient la base `portfolio.db` et les PDF déposés dans `fichiers/`. Elle le remplit avec un jeu de démonstration de 3 enseignants (dont une administratrice) et 12 étudiants répartis en BUT1, BUT2 et BUT3, dont 2 en GPRH (Sarah Benali, Maxime Laurent) et 2 en GC2F (Julie Perrin, Antoine Masson). Pour repartir de zéro, il suffit de supprimer le dossier `data/`. Une base créée par une version précédente est mise à jour automatiquement au démarrage.

## Fonctionnalités

- **Étudiant** : un onglet *Présentation*, puis un onglet par compétence de l'année. Chaque onglet contient un argumentaire saisi dans l'outil et de 1 à 3 traces PDF de 10 Mo maximum. Les traces peuvent être renommées, remplacées ou supprimées à tout moment, car il n'y a pas de période de dépôt. Les années précédentes (BUT1, BUT2) restent accessibles et peuvent être complétées.
- **Enseignant·e référent·e** : chaque étudiant a un enseignant référent, qui ne voit et n'évalue que ses propres étudiants. Le tableau de promotion indique l'état des dépôts, les évaluations, les brouillons à publier, les modifications faites depuis la dernière visite et le fil d'activité.
- **Évaluation en deux temps** : l'enseignant évalue chaque compétence en brouillon, puis la publie, compétence par compétence ou toute une année d'un coup. L'évaluation comprend un niveau qualitatif (Non acquis, En cours d'acquisition, Acquis, Dépassé), une **note sur 20 obligatoire** et un commentaire. L'étudiant ne voit que la version publiée. Si un brouillon modifie une évaluation déjà publiée, l'étudiant continue de voir l'ancienne version jusqu'à la nouvelle publication.
- **Rendez-vous de suivi et notes finales** (onglet *Suivi et notes*) : deux rendez-vous de suivi par année, chacun avec une date, une note sur 20 obligatoire et un compte rendu, en brouillon puis publiés. La note finale de chaque compétence vaut **10 % × RDV 1 + 20 % × RDV 2 + 70 % × note de la compétence** ; elle s'affiche quand les trois notes sont publiées (le référent voit un calcul provisoire sur ses brouillons). La pondération se règle dans `src/lib/referentiel.ts` (`RENDEZ_VOUS`).
- **Apprentissages critiques numérotés** selon la convention des BUT : AC + n° de compétence + n° de niveau + rang (ex. AC11.01, AC42.03).
- **Administrateur** : il voit tous les étudiants, filtre le tableau par référent et gère la page *Étudiants et affectations* :
  - import d'une liste Excel (.xlsx) ou CSV avec les colonnes **Nom, Prénom, Email étudiant, Année, Parcours, Enseignant référent, Email enseignant** (Groupe facultatif). Un modèle est téléchargeable depuis la page. Un aperçu ligne par ligne (créations, mises à jour, erreurs) précède l'import ; les étudiants existants sont reconnus par leur email ou leur nom, les référents par leur email ou leur nom, et les enseignants inconnus peuvent être créés automatiquement ;
  - ajout manuel d'un étudiant ou d'un enseignant (avec ou sans droits d'administrateur) ;
  - affectation des référents, étudiant par étudiant ;
  - fiche de chaque compte : modification (identité, email, année, parcours, groupe, référent, droits), désactivation (sortie de formation, départ : accès fermé, données conservées), suppression définitive (un étudiant avec tout son portfolio ; un enseignant seulement s'il n'a laissé aucune évaluation ni action), avec saisie du nom pour confirmer ;
  - **passage d'année et réaffectations groupés** (page dédiée) : filtre par année, par référent ou par nom, sélection multiple, puis changement d'année (« année suivante » ou année précise), de parcours, de référent ou de groupe ; désactivation groupée en fin de formation. Chaque changement est inscrit dans le journal de l'étudiant.
- **Notifications** : l'étudiant est prévenu dans l'outil (cloche dans l'en-tête) dès qu'une évaluation est publiée ; le référent, dès qu'un de ses étudiants dépose ou modifie un argumentaire, une trace ou sa présentation (une seule notification par dépôt tant qu'elle n'est pas lue). Chacun choisit sur sa page *Mon compte* (clic sur son nom) de recevoir aussi un courriel : à chaque fois, en récapitulatif quotidien (enseignants) ou jamais. Les courriels sont placés dans une file d'attente, qui sera envoyée par la messagerie de l'université une fois branchée.
- **Export PDF** : l'onglet *Portfolio complet* produit un seul PDF qui contient, dans l'ordre :
  - une couverture et un sommaire paginé ;
  - la présentation de l'étudiant ;
  - pour chaque année et chaque compétence, une page avec l'évaluation publiée (niveau, note, note finale), les apprentissages critiques numérotés et l'argumentaire, suivie des traces PDF intégrées ;
  - pour chaque année, une page « Rendez-vous de suivi et notes finales ».

  Chaque page de trace porte en pied de page une étiquette qui situe la trace dans le portfolio.
- **Journal** : chaque dépôt, modification, évaluation ou publication est tracé (qui, quoi, quand). Pour les fichiers, seule la dernière version est conservée.

## Organisation du code

| Fichier | Rôle |
| --- | --- |
| `src/lib/referentiel.ts` | Compétences, niveaux et apprentissages critiques des parcours GEMA, GPRH et GC2F, pondération des notes (source unique, à mettre à jour avec le nouveau programme national) |
| `src/lib/db.ts` | Schéma SQLite, migrations, requêtes et jeu de démonstration |
| `src/lib/session.ts` | Connexion simulée (cookie) et règles d'accès (étudiant, référent, administrateur) |
| `src/lib/export-pdf.ts` | Assemblage du portfolio en un seul PDF (pdf-lib) |
| `src/lib/import-etudiants.ts` | Lecture, contrôle et application de l'import des listes d'étudiants (ExcelJS), modèle Excel |
| `src/app/notifications` | Notifications de l'utilisateur |
| `src/app/actions.ts` | Server Actions : dépôts, évaluations, publication, affectations, journal |
| `src/app/portfolio/[etudiantId]` | Portfolio à onglets (étudiant et enseignant) |
| `src/app/enseignant` | Tableau de suivi (filtré par référent) |
| `src/app/admin/affectations` | Import, ajout de comptes, affectation des référents |
| `src/app/admin/comptes/[id]` | Fiche d'un compte : modification, désactivation, suppression |
| `src/app/admin/passage` | Passage d'année et réaffectations groupés |
| `src/app/compte` | Mon compte : préférence de notification par courriel |
| `src/app/fichiers/[id]`, `src/app/export/[etudiantId]` | Accès contrôlé aux traces et à l'export PDF |

| `maquette/folio-gea-maquette.html` | Maquette autonome à partager (un seul fichier, données dans le navigateur) |
| `maquette/source/` | Source de la maquette publiée sur Claude, ses tests (`node maquette/source/test-maquette.cjs`) et le script qui produit la version autonome (`node maquette/source/autonome.cjs maquette/source/folio-gea.html maquette/folio-gea-maquette.html`) |

## Reprise sur un poste Linux (octobre 2026)

**Recommandations de la DSI** : développer sous Linux pour dupliquer le projet tel quel sur leur serveur ; connexion par **SSO OpenID Connect** (identifiants de l'université) ; pile **Apache + MariaDB**.

**Décision encore ouverte** : l'application est en Next.js (Node.js), pas en PHP. Deux voies :

- **A. Garder Node.js** (recommandé si la DSI accepte Node.js 22 sur le serveur) : passer la base de SQLite à MariaDB (`src/lib/db.ts`), remplacer la connexion simulée par OpenID Connect (`src/lib/session.ts`, `src/app/connexion`), Apache en relais (reverse proxy) devant Node.js géré par un service systemd.
- **B. Réécrire en PHP** (Symfony) pour la pile Apache + MariaDB + PHP standard de la DSI.

Question à poser à la DSI : « Pouvez-vous héberger une application Node.js 22 derrière Apache (en relais), avec MariaDB ? » À obtenir pour OpenID : l'adresse du fournisseur (issuer), un identifiant et une clé secrète d'application, l'adresse de retour à déclarer, les informations transmises (identifiant, email, nom, prénom, statut étudiant ou personnel).

**Transférer le projet** : copier le dossier sans `node_modules/`, `.next/` ni `data/` (base et PDF de démonstration, recréés au premier lancement). Les dossiers `desktop-widget/`, `service-widget/` et `rive/` sont d'autres projets, sans lien avec Folio GEA. Idéalement, versionner le projet dans un dépôt Git (par exemple le GitLab de l'université).

**Sur le poste Linux (Ubuntu)** :

```bash
sudo apt install nodejs npm apache2 mariadb-server   # ou Node.js 22 via NodeSource si la version d'Ubuntu est plus ancienne
node -v                                              # 22.5 minimum
npm install
npm run dev                                          # http://localhost:3000
```

## Reporté aux étapes suivantes

- Connexion par SSO OpenID Connect de l'université (elle remplacera `src/lib/session.ts`)
- Base MariaDB à la place de SQLite, configuration Apache, service systemd, sauvegardes
- Envoi effectif des courriels de la file d'attente (SMTP de l'université), y compris le récapitulatif quotidien
- Nouvelles versions du référentiel (nouveau programme national) et référentiel CG2P
