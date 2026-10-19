# Passation à Claude : projet PAÉ (Folio GEA) — branche `ovh`

> **À l'attention de Claude.** Ce fichier résume le contexte du projet et son historique. Lis-le en entier avant toute action, puis lis `README.md`, qui reste la documentation de référence pour les fonctionnalités et le déploiement. Pour garder ce contexte d'une session à l'autre, tu peux en reprendre l'essentiel dans ta mémoire.

## 1. Qui est l'utilisateur

- Rémi Mougin (remi.mougin@unilim.fr), enseignant-chercheur en sciences de gestion / systèmes d'information, IUT du Limousin (université de Limoges), département **BUT GEA**.
- Il écrit en français et attend des réponses en français, dans un ton clair et sans jargon inutile.
- Il n'est pas développeur de métier : explique les choix techniques simplement et propose une recommandation plutôt qu'une liste d'options.
- **Ne jamais piloter sa souris ni son clavier** pour tester (pas de SetCursorPos, mouse_event, SendKeys, xdotool…) : il travaille sur sa machine pendant les tests. Vérifie par des moyens passifs (aperçu navigateur isolé, journaux, tests automatisés) ou demande-lui avant.

## 2. Le projet en une phrase

**Folio GEA** est l'application web de la **PAÉ** (démarche portfolio de compétences) du BUT GEA : les étudiants y déposent leur portfolio (argumentaires et traces PDF par compétence), leur enseignant référent l'évalue et suit deux rendez-vous par an, et l'administrateur gère les étudiants, les référents et le passage d'année. Elle s'inspire d'UniFolio (IUT de Troyes).

## 3. Cette branche par rapport à `main`

Le dépôt GitHub (`remiunilim/portfoliogea`) a deux branches, qui ne diffèrent **que par la connexion** :

| Branche | Hébergement visé | Connexion |
| --- | --- | --- |
| `main` | Serveur de la DSI de l'université | SSO OpenID Connect (ou mot de passe transitoire en attendant) |
| **`ovh` (celle-ci)** | Hébergement indépendant (ex. OVH), sans attendre la DSI | Lien envoyé par mail (« magic link »), avec auto-inscription étudiante |

Tout le reste (référentiels, dépôts, évaluation, export PDF/Excel, administration) est **identique**. Cette branche vit dans un dossier séparé (`Folio-GEA-OVH`, créé avec `git worktree add` depuis le dossier principal) : en reprenant le projet ici, vérifie avec `git worktree list` (depuis le dossier principal) que ce worktree existe toujours avant d'en recréer un. Toute modification pertinente ici doit être évaluée pour `main` aussi (et inversement).

## 4. Pile technique

| Élément | Choix actuel |
| --- | --- |
| Framework | **Next.js 16.3.8** (App Router, Server Actions), React 19.2, TypeScript, Tailwind CSS 4 |
| Base de données | **MariaDB** (pilote `mysql2`), réglages dans `.env.local` (voir `.env.example`) — **base distincte** de celle de `main` si testé sur la même machine |
| Fichiers | PDF déposés dans `data/fichiers/` |
| PDF | `pdf-lib` (export du portfolio complet) |
| Excel | `exceljs` (import des listes d'étudiants, export des notes) |
| Mail | `nodemailer` (SMTP) — **indispensable ici** : c'est le seul moyen de se connecter |
| Node.js | **22.5 minimum** |
| Connexion | Lien à usage unique envoyé par mail (`src/lib/lien-connexion.ts`), 20 min, jamais de mot de passe ni de SSO |

⚠️ `AGENTS.md` prévient : **cette version de Next.js a des changements incompatibles avec ce que tu connais**. Avant d'écrire du code Next.js, lis le guide concerné dans `node_modules/next/dist/docs/` et respecte les avis de dépréciation. Ce bloc est réécrit automatiquement par `next dev`.

`next.config.ts` : `serverExternalPackages: ["exceljs", "pdf-lib"]` et `serverActions.bodySizeLimit: "11mb"` (traces PDF de 10 Mo).

## 5. Fonctionnalités réalisées

Voir `README.md` (« Fonctionnalités » et « Connexion et déploiement ») pour le détail à jour. Résumé de ce qui est spécifique à `ovh` :

- **Connexion par lien mail** (`/connexion`) : adresse connue → lien de connexion ; adresse inconnue → lien de **création de profil** (`/connexion/creer-profil`), qui ne fait que prouver la possession de l'adresse — le compte n'existe qu'après soumission du formulaire. Message de confirmation toujours identique (ne révèle jamais si une adresse existe déjà).
- **Auto-inscription étudiante** : Nom, Prénom, Année, Parcours (à partir de BUT2) et enseignant·e référent·e, tous obligatoires ; réservée aux étudiant·e·s (un·e enseignant·e reste ajouté·e par l'administrateur) ; restreinte par domaine via `EMAIL_ETUDIANTS_DOMAINES` (réglé sur `unilim.fr` par défaut dans `.env.example`) ; le référent choisi reçoit une notification.
- Reste identique à `main` : référentiels des 4 parcours, évaluation en deux temps, rendez-vous de suivi, administration (import, ajout, fiches, passage d'année, archivage/suppression groupés), notifications, export PDF, **export Excel des notes**, journal, thème clair/sombre.

## 6. Organisation du code

Voir `README.md` (« Organisation du code ») pour le tableau à jour. Fichiers propres à cette branche (absents de `main`, qui a `src/lib/oidc.ts` et `src/lib/mdp.ts` à la place) :

- `src/lib/lien-connexion.ts` — envoi des liens (connexion et inscription), vérification/consommation des jetons
- `src/app/connexion/lien/route.ts` — clic sur le lien de connexion (ouvre la session)
- `src/app/connexion/creer-profil/page.tsx` — formulaire de création de profil étudiant
- `src/components/connexion.tsx` — `FormConnexionEmail` et `FormCreerProfil`

Table MariaDB propre à cette branche : `jetons_connexion` (jeton haché, 20 min, usage unique ; porte soit `utilisateur_id` pour une connexion, soit `email` pour une inscription).

### Maquette autonome (pour la démonstration)

- `maquette/folio-gea-maquette.html` : un seul fichier HTML, données stockées dans le navigateur, à partager tel quel.
- `maquette/source/folio-gea.html` : source ; `test-maquette.cjs` : tests (`node maquette/source/test-maquette.cjs`) ; `autonome.cjs` produit la version autonome.
- Publiées aussi en artefacts claude.ai (privés, compte de l'utilisateur).

## 7. Historique (résumé)

Voir `PASSATION-CLAUDE.md` de la branche `main` pour l'historique complet avant la création de cette branche (SQLite → MariaDB, SSO, CG2P, envoi réel des courriels, Apache/systemd vérifiés, GitHub). Cette branche a été créée le **18/10/2026**, à partir de `main` :

| Date | Étape |
| --- | --- |
| 18/10/2026 | Création de la branche `ovh` (worktree séparé) : connexion par lien mail, SSO et mot de passe transitoire retirés ; message « contactez votre référent » ajouté si rien n'arrive ; auto-inscription étudiante ajoutée (vérification d'email avant création du compte), restreinte à `unilim.fr` |
| 19/10/2026 | Correction « le lien du mail renvoie vers localhost » : tous les liens absolus (lien de connexion, redirection après clic, liens des courriels de notification) partent de `APP_BASE_URL` (`src/lib/url-publique.ts`), avec un message d'erreur dans le journal du service si elle vaut encore `localhost` en production |

## 8. Reste à faire

1. Choisir et mettre en place le serveur OVH (VPS ou Public Cloud), nom de domaine, certificat HTTPS.
2. Choisir un service d'envoi de mail transactionnel fiable (voir `README.md`, section « À préparer avant de déployer ») : **bloquant pour un vrai déploiement**, la connexion en dépend entièrement.
3. Renseigner `APP_BASE_URL` et les `SMTP_*` réels dans `.env.local` sur le serveur, puis sauvegardes MariaDB.
4. Nouvelle version du référentiel le jour où le nouveau programme national BUT GEA sera publié.
5. Activer CG2P quand l'IUT ouvrira ce parcours.

## 9. Installer sur un nouveau poste

```bash
git clone https://github.com/remiunilim/portfoliogea.git
cd portfoliogea
git checkout ovh
# ou, pour garder main et ovh en parallèle sur la même machine :
# git worktree add ../Folio-GEA-OVH ovh
sudo apt install nodejs npm apache2 mariadb-server   # ou Node.js 22 via NodeSource si la version d'Ubuntu est trop ancienne
node -v                                              # 22.5 minimum
npm install
cp .env.example .env.local                           # renseigner DB_*, APP_BASE_URL, SMTP_*, EMAIL_ETUDIANTS_DOMAINES
npm run dev                                          # http://localhost:3000
```

Vérifications rapides après installation : ouvrir `/connexion`, demander un lien pour une adresse inconnue (vérifier qu'un mail de création de profil part), créer un profil étudiant, se connecter en administrateur, ouvrir *Étudiants et affectations*.

## 10. Méthode de travail attendue

- Lire le code existant avant de modifier, garder le style (noms et commentaires **en français**, Server Actions, composants dans `src/components/`).
- Mettre à jour `README.md` à chaque nouvelle fonctionnalité (il sert de documentation) — et ce fichier pour les changements de contexte ou d'historique notables.
- Toute modification pertinente ici doit être évaluée pour `main` aussi (et inversement) : les deux branches partagent presque tout le code, seule l'authentification diffère.
- Après une modification visible, vérifier dans le navigateur (aperçu du serveur de dev) plutôt que de demander à l'utilisateur de tester.
- Si la maquette doit suivre une évolution : modifier `maquette/source/folio-gea.html`, relancer ses tests, régénérer la version autonome.
