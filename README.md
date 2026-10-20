# Folio GEA : portfolio de compétences du BUT GEA (PAÉ)

Plateforme de dépôt, de suivi et d'évaluation des portfolios des étudiants du BUT GEA. Les référentiels des 4 parcours **GEMA, GPRH, GC2F et CG2P** sont configurés (tronc commun C1 à C3, C4-C5 propres à chaque parcours), d'après le PPN BUT GEA 2022. **CG2P reste masqué des listes de choix tant que l'administrateur ne l'a pas activé** (page *Étudiants et affectations*) : aucun établissement ne l'ouvre encore à l'IUT du Limousin. L'interface propose un **thème clair et un thème sombre** (bouton lune / soleil dans l'en-tête). Elle s'inspire d'UniFolio (IUT de Troyes) et de la démarche portfolio présentée lors des cafés pédagogiques.

**Deux versions existent** : celle-ci (branche `main`), pensée pour un hébergement chez la DSI de l'université (SSO OpenID Connect) ; et la branche [`ovh`](https://github.com/remiunilim/portfoliogea/tree/ovh), une variante autonome pour un hébergement indépendant (ex. OVH), où la connexion se fait par lien envoyé par mail et où un·e étudiant·e peut créer son propre profil. Le reste (référentiels, évaluation, export PDF/Excel, administration) est identique dans les deux.

## Lancer en local

Il faut **Node.js 22.5** ou une version plus récente, et une **base MariaDB** accessible (locale ou distante).

1. Copier `.env.example` en `.env.local` et renseigner les identifiants de connexion à MariaDB (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`). La base elle-même est créée automatiquement au premier démarrage si elle n'existe pas encore — il suffit que l'utilisateur indiqué ait le droit de la créer (ou qu'elle existe déjà et que l'utilisateur y ait tous les droits).
2. Installer les dépendances et lancer le serveur :

```bash
npm install
npm run dev
```

Ouvrir ensuite http://localhost:3000.

Au premier démarrage **en local** (`npm run dev`, mode démonstration), l'application crée les tables puis les remplit avec un jeu de démonstration de 3 enseignants (dont une administratrice) et 12 étudiants répartis en BUT1, BUT2 et BUT3, dont 2 en GPRH (Sarah Benali, Maxime Laurent) et 2 en GC2F (Julie Perrin, Antoine Masson). Les PDF déposés restent stockés localement dans le dossier `data/fichiers/`. Pour repartir de zéro, vider la base (`DROP DATABASE` puis relancer) et supprimer le dossier `data/`.

**Sécurité des connexions** : une fois connecté·e, le navigateur ne garde qu'un jeton de session aléatoire (cookie `folio_session`), jamais l'identifiant du compte ; la base n'en conserve que l'empreinte (table `sessions`, valable 7 jours). Se déconnecter, supprimer ou désactiver le compte le rend aussitôt inutilisable. Le cookie est réservé au HTTPS dès que `APP_BASE_URL` commence par `https://`.

**Mode démonstration** (comptes fictifs, connexion en choisissant un compte sans mot de passe) : actif d'office en local, **jamais en production** sauf `MODE_DEMO=1` dans `.env.local`. Sur un serveur, une base neuve reste donc vide : renseigner `ADMIN_EMAIL` (votre adresse) pour que le premier compte administrateur soit créé au démarrage, puis importer les étudiants et enseignants.

**Autres protections** :
- Limite des tentatives : connexion par mot de passe (10 échecs par compte ou 50 par adresse IP, blocage de 15 minutes) et demandes de lien de connexion (30 par adresse IP en 10 minutes, 200 par heure pour tout le site) ; seuils larges, car une salle de TD entière partage souvent la même adresse IP (`src/lib/limite.ts`).
- En-têtes de sécurité (`next.config.ts`) : le site ne peut pas être affiché dans un cadre d'un autre site, les adresses complètes (qui peuvent contenir un jeton) ne sont jamais transmises à un autre site, et le type des fichiers est imposé.
- Sur le serveur, Next.js n'écoute que `127.0.0.1` (`-H 127.0.0.1` dans `deploy/folio-gea.service`) : on ne peut le joindre qu'à travers Apache et HTTPS. Les minuteurs d'envoi des courriels appellent directement `http://127.0.0.1:3000`, pour que leur secret n'apparaisse pas dans les journaux d'Apache. Apache impose le HTTPS au navigateur (`Strict-Transport-Security`). **Ces fichiers sont copiés dans `/etc` à l'installation : `deploy/mettre-a-jour.sh` ne les met pas à jour, il faut reporter les changements à la main.**

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
  - **archivage et suppression groupés** (page dédiée *Archivage et suppression*) : même filtre par année/référent/nom pour viser une cohorte entière (ou un·e seul·e étudiant·e), puis archivage (accès fermé, portfolio conservé) ou suppression définitive de tous les portfolios sélectionnés — cette dernière demande de taper « SUPPRIMER » pour confirmer, après avoir affiché la liste exacte des personnes concernées.
- **Notifications** : l'étudiant est prévenu dans l'outil (cloche dans l'en-tête) dès qu'une évaluation est publiée ; le référent, dès qu'un de ses étudiants dépose ou modifie un argumentaire, une trace ou sa présentation (une seule notification par dépôt tant qu'elle n'est pas lue). Chacun choisit sur sa page *Mon compte* (clic sur son nom) de recevoir aussi un courriel : à chaque fois, en récapitulatif quotidien (enseignants) ou jamais. Les courriels sont placés dans une file d'attente et expédiés par SMTP (voir `.env.example`) — **mais l'envoi réel reste coupé pour tout le monde tant que l'administrateur ne l'a pas activé** (page *Étudiants et affectations*, section « Envoi des courriels ») : par défaut, personne n'en reçoit, et la préférence de chacun est verrouillée sur *Mon compte* en attendant.
- **Export PDF** : l'onglet *Portfolio complet* produit un seul PDF qui contient, dans l'ordre :
  - une couverture et un sommaire paginé ;
  - la présentation de l'étudiant ;
  - pour chaque année et chaque compétence, une page avec l'évaluation publiée (niveau, note, note finale), les apprentissages critiques numérotés (ex. AC24.03, AC34.01 — année de BUT puis numéro de compétence, conforme au PPN) et l'argumentaire, suivie des traces PDF intégrées ;
  - pour chaque année, une page « Rendez-vous de suivi et notes finales ».

  Chaque page de trace porte en pied de page une étiquette qui situe la trace dans le portfolio.
- **Export Excel des notes** : sur la page *Mes étudiants* / *Suivi des portfolios*, chaque enseignant·e exporte les notes (brouillons et publiées) de ses étudiants, une feuille par année de BUT ; l'administrateur exporte tous les étudiants, ou un sous-ensemble filtré par référent ou parcours.
- **Transfert entre instances** (page *Transfert entre instances*, lien depuis *Étudiants et affectations*) : exporte en un seul fichier .zip tous les comptes et portfolios de cette instance (y compris les PDF déposés), pour les importer sur une autre installation de Folio GEA — utile par exemple pour faire basculer les données de la version OVH vers celle-ci une fois déployée chez la DSI. Les comptes déjà présents sur la destination (même adresse mail) sont reconnus et jamais écrasés ; seuls les comptes, portfolios et évaluations absents sont ajoutés. ⚠️ Réimporter deux fois le même export duplique les traces (fichiers PDF) : à n'utiliser qu'une seule fois par export, ou en acceptant ce doublon.
- **Journal** : chaque dépôt, modification, évaluation ou publication est tracé (qui, quoi, quand). Pour les fichiers, seule la dernière version est conservée.

## Organisation du code

| Fichier | Rôle |
| --- | --- |
| `src/lib/referentiel.ts` | Compétences, niveaux et apprentissages critiques des 4 parcours (GEMA, GPRH, GC2F, CG2P), pondération des notes (source unique, à mettre à jour avec le nouveau programme national) |
| `src/lib/db.ts` | Schéma MariaDB, requêtes (toutes asynchrones) et jeu de démonstration |
| `src/lib/session.ts` | Session (cookie) et règles d'accès (étudiant, référent, administrateur) |
| `src/lib/oidc.ts`, `src/app/connexion/oidc` | Connexion SSO OpenID Connect (démarrage et retour) |
| `src/lib/mdp.ts`, `src/components/connexion.tsx` | Connexion par mot de passe (hachage scrypt, formulaire) — transitoire, avant le SSO |
| `src/lib/export-pdf.ts` | Assemblage du portfolio en un seul PDF (pdf-lib) |
| `src/lib/export-notes.ts`, `src/app/enseignant/export` | Export Excel des notes (ExcelJS) |
| `src/lib/transfert.ts`, `src/app/admin/transfert` | Transfert de toutes les données vers/depuis une autre instance (export/import .zip, JSZip) |
| `src/lib/mail.ts`, `src/lib/courriels.ts` | Envoi SMTP et vidage de la file de courriels (`src/app/api/cron/courriels`, déclenché périodiquement, voir `deploy/`) |
| `src/lib/import-etudiants.ts` | Lecture, contrôle et application de l'import des listes d'étudiants (ExcelJS), modèle Excel |
| `src/app/notifications` | Notifications de l'utilisateur |
| `src/app/actions.ts` | Server Actions : dépôts, évaluations, publication, affectations, journal |
| `src/app/portfolio/[etudiantId]` | Portfolio à onglets (étudiant et enseignant) |
| `src/app/enseignant` | Tableau de suivi (filtré par référent) |
| `src/app/admin/affectations` | Import, ajout de comptes, affectation des référents |
| `src/app/admin/comptes/[id]` | Fiche d'un compte : modification, désactivation, suppression |
| `src/app/admin/passage` | Passage d'année et réaffectations groupés |
| `src/app/admin/archivage` | Archivage ou suppression définitive, par étudiant·e ou par cohorte (filtre par année) |
| `src/app/compte` | Mon compte : préférence de notification par courriel |
| `src/app/fichiers/[id]`, `src/app/export/[etudiantId]` | Accès contrôlé aux traces et à l'export PDF |

| `maquette/folio-gea-maquette.html` | Maquette autonome à partager (un seul fichier, données dans le navigateur) |
| `maquette/source/` | Source de la maquette publiée sur Claude, ses tests (`node maquette/source/test-maquette.cjs`) et le script qui produit la version autonome (`node maquette/source/autonome.cjs maquette/source/folio-gea.html maquette/folio-gea-maquette.html`) |

## Déploiement chez la DSI

**Réponse de la DSI (15/10/2026)** : Node.js 22 peut être hébergé derrière Apache (en relais) avec MariaDB. La **voie A est confirmée** : l'application reste en Next.js (Node.js), pas de réécriture en PHP.

- **Base de données** : MariaDB à la place de SQLite — fait (`src/lib/db.ts`, pilote `mysql2`). Réglages de connexion dans `.env.local` (voir `.env.example`).
- **Hébergement** : Apache en relais (reverse proxy) devant Node.js géré par un service systemd. Modèles prêts à adapter dans `deploy/`, **vérifiés en conditions réelles** (Ubuntu, Apache, MariaDB et systemd dans un environnement Linux de test — build de production, service `folio-gea` démarré par systemd, relais Apache fonctionnel de bout en bout) :
  - `deploy/apache-folio-gea.conf` : site Apache (reverse proxy + HTTPS)
  - `deploy/folio-gea.service` : service systemd (lance `next start`) — bien suivre l'ordre des commandes dans ses commentaires : le dossier `data/` doit exister (avec les bons droits) **avant** le premier démarrage, sinon le service échoue (erreur systemd 226/NAMESPACE)
  - `deploy/folio-gea-courriels.service`/`.timer` et `deploy/folio-gea-courriels-quotidien.service`/`.timer` : vidage périodique de la file de courriels
  - `deploy/mettre-a-jour.sh` : met à jour vers la dernière version poussée sur GitHub (`sudo deploy/mettre-a-jour.sh`, depuis le serveur) — voir « Mettre à jour une installation existante » plus bas
- **Connexion SSO OpenID Connect** : faite (`src/lib/oidc.ts`, routes `src/app/connexion/oidc`), mais **pas encore testée avec le vrai fournisseur de la DSI** — en attente de ses réglages. Tant que `OIDC_ISSUER` (et les autres variables `OIDC_*` de `.env.example`) ne sont pas renseignées, `/connexion` affiche la connexion par mot de passe si elle est activée, la liste des comptes fictifs en mode démonstration (local), et sinon un simple message « connexion pas encore ouverte » ; dès qu'elles le sont, elle affiche un seul bouton « Se connecter avec le compte de l'université ». Au premier vrai login, le compte est reconnu par son **email** (lu dans le jeton d'identité, ou à défaut dans le profil *userinfo* du fournisseur) (celui déjà enregistré via l'import Excel ou l'ajout manuel) puis l'identifiant OpenID Connect y est lié pour les connexions suivantes. **Aucun compte n'est créé automatiquement** : un compte universitaire inconnu de Folio GEA affiche un message invitant à contacter l'administrateur (l'étudiant·e ou l'enseignant·e doit déjà avoir été importé·e ou ajouté·e). À demander à la DSI : l'adresse du fournisseur (issuer), un identifiant et une clé secrète d'application, et l'URL de retour à déclarer chez eux (`OIDC_REDIRECT_URI`, doit correspondre exactement à ce qui est configuré côté DSI).
- **Connexion par mot de passe (transitoire)** : pour un déploiement avec de vrais comptes
  **avant** que le SSO ne soit branché, sans attendre la DSI. Tant que `/connexion` affichait la
  liste des comptes à choisir (mode démonstration), n'importe qui pouvait se connecter à la
  place de n'importe qui, sans mot de passe — ⚠️ **à n'utiliser qu'avec des comptes fictifs**.
  Activer « Connexion par mot de passe » (page *Étudiants et affectations*) remplace cette liste
  par un vrai formulaire email + mot de passe. Chaque personne a besoin d'un mot de passe défini
  par l'administrateur sur sa fiche de compte (aucun courriel n'est envoyé automatiquement : à
  communiquer directement) ; elle peut ensuite le changer elle-même sur *Mon compte*. Ce réglage
  se désactive automatiquement (masqué) une fois le SSO configuré (`OIDC_*` renseignées), et la
  connexion par mot de passe est alors refusée côté serveur. Pour l'activer sur une installation
  neuve, il faut d'abord pouvoir entrer comme administrateur : démarrer le temps de ce réglage avec
  `MODE_DEMO=1` (et `ADMIN_EMAIL`), activer le mot de passe et définir le sien, puis retirer
  `MODE_DEMO` et redémarrer.
- **`APP_BASE_URL`** (`.env.local`) : l'adresse publique exacte de l'application (ex. `https://folio-gea.universite.fr`). Elle sert aux liens des courriels de notification et aux redirections après connexion SSO. **Si un lien reçu par mail ouvre `localhost`**, c'est qu'elle a été laissée à sa valeur d'exemple : la corriger, puis `sudo systemctl restart folio-gea`.

**Sur le serveur Linux (Ubuntu)** :

```bash
sudo apt install nodejs npm apache2 mariadb-server   # ou Node.js 22 via NodeSource si la version d'Ubuntu est plus ancienne
node -v                                              # 22.5 minimum
npm install
npm run build && npm run start                       # ou via le service systemd (deploy/folio-gea.service)
```

## Mettre à jour une installation existante

Une mise à jour (nouvelle fonctionnalité, correction) ne touche jamais aux étudiants ni à leurs portfolios : seul le code de l'application change, jamais la base MariaDB ni les PDF déposés (`data/`). Pour l'appliquer sur le serveur :

```bash
sudo deploy/mettre-a-jour.sh
```

Ce script récupère la dernière version sur GitHub (`git pull`), réinstalle les dépendances si besoin, recompile et redémarre le service. Par prudence avant une mise à jour importante, une sauvegarde rapide de la base reste une bonne habitude : `mysqldump -u folio_gea -p folio_gea > sauvegarde-$(date +%Y%m%d).sql`.

## Reporté aux étapes suivantes

- Essai de la connexion SSO OpenID Connect avec le vrai fournisseur de la DSI, une fois ses réglages reçus
- Déploiement sur le vrai serveur de la DSI (modèles `deploy/` vérifiés en conditions réelles sur un Linux de test, mais pas encore sur ce serveur) : nom de domaine, certificat HTTPS, sauvegardes de la base MariaDB
- Renseigner les réglages SMTP de l'université (`.env.example`) puis activer l'envoi des courriels (page *Étudiants et affectations*) quand le moment sera venu
- Nouvelles versions du référentiel, le jour où le nouveau programme national sera publié
- Activer CG2P (page *Étudiants et affectations* → section « Parcours CG2P ») quand l'IUT ouvrira ce parcours
