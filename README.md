# Folio GEA : portfolio de compétences du BUT GEA (PAÉ) — version OVH

Plateforme de dépôt, de suivi et d'évaluation des portfolios des étudiants du BUT GEA. Les référentiels des 4 parcours **GEMA, GPRH, GC2F et CG2P** sont configurés (tronc commun C1 à C3, C4-C5 propres à chaque parcours), d'après le PPN BUT GEA 2022. **CG2P reste masqué des listes de choix tant que l'administrateur ne l'a pas activé** (page *Étudiants et affectations*) : aucun établissement ne l'ouvre encore à l'IUT du Limousin. L'interface propose un **thème clair et un thème sombre** (bouton lune / soleil dans l'en-tête). Elle s'inspire d'UniFolio (IUT de Troyes) et de la démarche portfolio présentée lors des cafés pédagogiques.

**Cette branche (`ovh`) est une variante autonome**, pensée pour un hébergement indépendant de la DSI (ex. OVH), à déployer sans attendre le SSO de l'université. Seule différence avec la branche principale : la connexion se fait par un **lien envoyé par mail** (comme un « magic link »), pas par mot de passe ni SSO — voir [Connexion et déploiement](#connexion-et-déploiement) plus bas. Tout le reste (référentiels, évaluation, export PDF/Excel, administration) est identique.

## Lancer en local

Il faut **Node.js 22.5** ou une version plus récente, et une **base MariaDB** accessible (locale ou distante).

1. Copier `.env.example` en `.env.local` et renseigner les identifiants de connexion à MariaDB (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`). La base elle-même est créée automatiquement au premier démarrage si elle n'existe pas encore — il suffit que l'utilisateur indiqué ait le droit de la créer (ou qu'elle existe déjà et que l'utilisateur y ait tous les droits). Renseigner aussi `APP_BASE_URL` et les réglages `SMTP_*` : **indispensables ici**, la connexion elle-même passe par un lien envoyé par mail (voir plus bas).
2. Installer les dépendances et lancer le serveur :

```bash
npm install
npm run dev
```

Ouvrir ensuite http://localhost:3000.

Au premier démarrage, l'application crée les tables puis les remplit avec un jeu de démonstration de 3 enseignants (dont une administratrice) et 12 étudiants répartis en BUT1, BUT2 et BUT3, dont 2 en GPRH (Sarah Benali, Maxime Laurent) et 2 en GC2F (Julie Perrin, Antoine Masson). Les PDF déposés restent stockés localement dans le dossier `data/fichiers/`. Pour repartir de zéro, vider la base (`DROP DATABASE` puis relancer) et supprimer le dossier `data/`.

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
- **Notifications** : l'étudiant est prévenu dans l'outil (cloche dans l'en-tête) dès qu'une évaluation est publiée ; le référent, dès qu'un de ses étudiants dépose ou modifie un argumentaire, une trace ou sa présentation (une seule notification par dépôt tant qu'elle n'est pas lue). Chacun choisit sur sa page *Mon compte* (clic sur son nom) de recevoir aussi un courriel : à chaque fois, en récapitulatif quotidien (enseignants) ou jamais. Les courriels de notification sont placés dans une file d'attente et expédiés par SMTP (voir `.env.example`) — **mais l'envoi réel reste coupé pour tout le monde tant que l'administrateur ne l'a pas activé** (page *Étudiants et affectations*, section « Envoi des courriels ») : par défaut, personne n'en reçoit, et la préférence de chacun est verrouillée sur *Mon compte* en attendant. Ce réglage ne concerne pas les courriels de connexion, toujours envoyés immédiatement (voir plus bas).
- **Export PDF** : l'onglet *Portfolio complet* produit un seul PDF qui contient, dans l'ordre :
  - une couverture et un sommaire paginé ;
  - la présentation de l'étudiant ;
  - pour chaque année et chaque compétence, une page avec l'évaluation publiée (niveau, note, note finale), les apprentissages critiques numérotés (ex. AC24.03, AC34.01 — année de BUT puis numéro de compétence, conforme au PPN) et l'argumentaire, suivie des traces PDF intégrées ;
  - pour chaque année, une page « Rendez-vous de suivi et notes finales ».

  Chaque page de trace porte en pied de page une étiquette qui situe la trace dans le portfolio.
- **Export Excel des notes** : sur la page *Mes étudiants* / *Suivi des portfolios*, chaque enseignant·e exporte les notes (brouillons et publiées) de ses étudiants, une feuille par année de BUT ; l'administrateur exporte tous les étudiants, ou un sous-ensemble filtré par référent ou parcours.
- **Journal** : chaque dépôt, modification, évaluation ou publication est tracé (qui, quoi, quand). Pour les fichiers, seule la dernière version est conservée.

## Organisation du code

| Fichier | Rôle |
| --- | --- |
| `src/lib/referentiel.ts` | Compétences, niveaux et apprentissages critiques des 4 parcours (GEMA, GPRH, GC2F, CG2P), pondération des notes (source unique, à mettre à jour avec le nouveau programme national) |
| `src/lib/db.ts` | Schéma MariaDB, requêtes (toutes asynchrones) et jeu de démonstration |
| `src/lib/session.ts` | Session (cookie) et règles d'accès (étudiant, référent, administrateur) |
| `src/lib/lien-connexion.ts`, `src/app/connexion/lien`, `src/components/connexion.tsx` | Connexion par lien envoyé par mail (jeton à usage unique, 20 min) |
| `src/lib/export-pdf.ts` | Assemblage du portfolio en un seul PDF (pdf-lib) |
| `src/lib/export-notes.ts`, `src/app/enseignant/export` | Export Excel des notes (ExcelJS) |
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

## Connexion et déploiement

Cette version se déploie **sans dépendre de la DSI** (pas de SSO universitaire à attendre) : elle garde exactement la même infrastructure que la branche principale (Next.js/Node.js derrière Apache, MariaDB, systemd), mais remplace la connexion par un **lien envoyé par mail**, sur le principe d'un « magic link » :

- La personne saisit son adresse mail universitaire sur `/connexion`.
- Si un compte existe pour cette adresse (créé au préalable par l'administrateur : import Excel ou ajout manuel, exactement comme avant), elle reçoit un mail avec un lien de connexion **valable 20 minutes et à usage unique**.
- En cliquant, elle est connectée directement — aucun mot de passe à retenir, aucun compte à créer soi-même.
- Le message affiché après la demande est **volontairement identique que l'adresse soit connue ou non** (pour ne pas révéler quelles adresses sont enregistrées), et un deuxième envoi est bloqué pendant une minute si la personne redemande un lien trop vite (anti-spam basique).

**Conséquence importante** : sans adresse mail enregistrée, une personne ne peut pas se connecter (contrairement à la branche principale, où c'était seulement nécessaire pour les notifications ou le SSO). L'import et l'ajout manuel le rappellent désormais clairement. L'administrateur peut toujours renseigner ou corriger une adresse a posteriori sur la fiche du compte.

### À préparer avant de déployer

- **Un nom de domaine et un certificat HTTPS** (ex. Let's Encrypt / Certbot) : `deploy/apache-folio-gea.conf` est à adapter avec le nom de domaine réel.
- **`APP_BASE_URL`** (`.env.local`) : l'adresse publique exacte de l'application (ex. `https://folio-gea.exemple.fr`), utilisée pour construire le lien envoyé par mail. Sans certificat ni domaine, la connexion fonctionne quand même mais le lien renverra vers une adresse non chiffrée — à éviter en usage réel.
- **Un service d'envoi de mail fiable** (`SMTP_*` dans `.env.local`) : **indispensable dès le premier jour**, puisque c'est le seul moyen de se connecter. Un service d'envoi transactionnel (plutôt que le SMTP d'une messagerie classique) est recommandé : plus fiable, et moins susceptible d'être classé comme spam par les messageries des étudiants et enseignants. Les VPS de certains hébergeurs (OVH compris) bloquent par défaut le port SMTP sortant 25 pour lutter contre le spam : vérifier auprès de l'hébergeur, ou passer par un service tiers qui utilise un autre port (587/465).
- **MariaDB** : identique à la branche principale (`DB_*` dans `.env.local`).

### Sur le serveur Linux (Ubuntu), identique à la branche principale

```bash
sudo apt install nodejs npm apache2 mariadb-server   # ou Node.js 22 via NodeSource si la version d'Ubuntu est plus ancienne
node -v                                              # 22.5 minimum
npm install
npm run build && npm run start                       # ou via le service systemd (deploy/folio-gea.service)
```

Modèles prêts à adapter dans `deploy/` (**vérifiés en conditions réelles** sur un Linux de test — build de production, service `folio-gea` démarré par systemd, relais Apache fonctionnel de bout en bout) :
- `deploy/apache-folio-gea.conf` : site Apache (reverse proxy + HTTPS)
- `deploy/folio-gea.service` : service systemd (lance `next start`) — bien suivre l'ordre des commandes dans ses commentaires : le dossier `data/` doit exister (avec les bons droits) **avant** le premier démarrage, sinon le service échoue (erreur systemd 226/NAMESPACE)
- `deploy/folio-gea-courriels.service`/`.timer` et `deploy/folio-gea-courriels-quotidien.service`/`.timer` : vidage périodique de la file des courriels de *notification* (sans effet sur la connexion, envoyée immédiatement)

## Reporté aux étapes suivantes

- Choix et mise en place du serveur OVH (VPS ou Public Cloud), nom de domaine, certificat HTTPS, sauvegardes de la base MariaDB
- Choix d'un service d'envoi de mail transactionnel fiable
- Nouvelles versions du référentiel, le jour où le nouveau programme national sera publié
- Activer CG2P (page *Étudiants et affectations* → section « Parcours CG2P ») quand l'IUT ouvrira ce parcours
