# Passation à Claude : projet PAÉ (Folio GEA)

> **À l'attention de Claude.** Ce fichier résume le contexte du projet et son historique. Lis-le en entier avant toute action, puis lis `README.md`, qui reste la documentation de référence pour les fonctionnalités et le déploiement. Pour garder ce contexte d'une session à l'autre, tu peux en reprendre l'essentiel dans ta mémoire.

## 1. Qui est l'utilisateur

- Rémi Mougin (remi.mougin@unilim.fr), enseignant-chercheur en sciences de gestion / systèmes d'information, IUT du Limousin (université de Limoges), département **BUT GEA**.
- Il écrit en français et attend des réponses en français, dans un ton clair et sans jargon inutile.
- Il n'est pas développeur de métier : explique les choix techniques simplement et propose une recommandation plutôt qu'une liste d'options.
- **Ne jamais piloter sa souris ni son clavier** pour tester (pas de SetCursorPos, mouse_event, SendKeys, xdotool…) : il travaille sur sa machine pendant les tests. Vérifie par des moyens passifs (aperçu navigateur isolé, journaux, tests automatisés) ou demande-lui avant.

## 2. Le projet en une phrase

**Folio GEA** est l'application web de la **PAÉ** (démarche portfolio de compétences) du BUT GEA : les étudiants y déposent leur portfolio (argumentaires et traces PDF par compétence), leur enseignant référent l'évalue et suit deux rendez-vous par an, et l'administrateur gère les étudiants, les référents et le passage d'année. Elle s'inspire d'UniFolio (IUT de Troyes).

## 3. Deux branches, un seul code de fonctionnalités

Le dépôt GitHub (`remiunilim/portfoliogea`) a **deux branches**, qui ne diffèrent que par la connexion :

| Branche | Hébergement visé | Connexion |
| --- | --- | --- |
| `main` | Serveur de la DSI de l'université | SSO OpenID Connect (ou mot de passe transitoire en attendant) |
| `ovh` | Hébergement indépendant (ex. OVH), sans attendre la DSI | Lien envoyé par mail (« magic link »), avec auto-inscription étudiante |

Tout le reste (référentiels, dépôts, évaluation, export PDF/Excel, administration) est **identique** dans les deux. La branche `ovh` a été créée à partir de `main` via `git worktree` (dossier séparé `Folio-GEA-OVH` à côté du dossier principal) : en reprenant le projet, vérifie si ce worktree existe encore (`git worktree list`) avant d'en recréer un.

## 4. Pile technique

| Élément | Choix actuel |
| --- | --- |
| Framework | **Next.js 16.3.8** (App Router, Server Actions), React 19.2, TypeScript, Tailwind CSS 4 |
| Base de données | **MariaDB** (pilote `mysql2`), réglages dans `.env.local` (voir `.env.example`) |
| Fichiers | PDF déposés dans `data/fichiers/` |
| PDF | `pdf-lib` (export du portfolio complet) |
| Excel | `exceljs` (import des listes d'étudiants, export des notes) |
| Mail | `nodemailer` (SMTP) |
| Node.js | **22.5 minimum** |
| Connexion (`main`) | SSO OpenID Connect (`openid-client`) ou mot de passe transitoire (scrypt natif), selon réglages |
| Connexion (`ovh`) | Lien à usage unique envoyé par mail, pas de mot de passe ni de SSO |

⚠️ `AGENTS.md` prévient : **cette version de Next.js a des changements incompatibles avec ce que tu connais**. Avant d'écrire du code Next.js, lis le guide concerné dans `node_modules/next/dist/docs/` et respecte les avis de dépréciation. Ce bloc est réécrit automatiquement par `next dev`.

`next.config.ts` : `serverExternalPackages: ["exceljs", "pdf-lib"]` et `serverActions.bodySizeLimit: "11mb"` (traces PDF de 10 Mo).

## 5. Fonctionnalités réalisées

Voir `README.md` (« Fonctionnalités ») pour le détail à jour : référentiels des 4 parcours (GEMA, GPRH, GC2F, CG2P, ce dernier masqué tant que l'administrateur ne l'active pas), dépôt et évaluation en deux temps (brouillon/publication, niveau + note/20 + commentaire), rendez-vous de suivi et notes finales pondérées, administration complète (import Excel, ajout manuel, fiches de compte, passage d'année groupé, archivage/suppression groupés), notifications (outil + courriel, coupe-circuit désactivé par défaut), export PDF du portfolio complet, **export Excel des notes** (par enseignant ou par l'administrateur), journal de toutes les actions, thème clair/sombre.

Spécifique à `ovh` : auto-inscription étudiante après vérification de l'adresse mail (`/connexion/creer-profil`), restreinte par défaut à `unilim.fr` (`EMAIL_ETUDIANTS_DOMAINES`).

## 6. Organisation du code

Voir `README.md` (« Organisation du code ») pour le tableau à jour, qui diffère légèrement entre `main` (`src/lib/oidc.ts`, `src/lib/mdp.ts`) et `ovh` (`src/lib/lien-connexion.ts`, `src/app/connexion/creer-profil`).

### Maquette autonome (pour la démonstration)

- `maquette/folio-gea-maquette.html` : un seul fichier HTML, données stockées dans le navigateur, à partager tel quel.
- `maquette/source/folio-gea.html` : source ; `test-maquette.cjs` : tests (`node maquette/source/test-maquette.cjs`) ; `autonome.cjs` produit la version autonome :
  `node maquette/source/autonome.cjs maquette/source/folio-gea.html maquette/folio-gea-maquette.html`
- Publiées aussi en artefacts claude.ai (privés, compte de l'utilisateur) :
  - Maquette Folio GEA : https://claude.ai/artifact/2BPbda4wvccXMufmotaafe
  - Guide utilisateur Folio GEA : https://claude.ai/artifact/PjighjiPnwyMTdrdh4B26v

## 7. Historique (résumé)

| Date | Étape |
| --- | --- |
| 13/09/2026 | Création du projet Next.js (`erp-pedagogique`), SQLite, connexion simulée |
| sept.–oct. 2026 | Référentiels, dépôts, évaluation, export PDF, journal, import Excel, administration, passage d'année, notifications, thème sombre, maquette autonome |
| 06/10/2026 | Rendez-vous avec la DSI : Node.js derrière Apache, MariaDB possible (pas de réécriture PHP) |
| 15/10/2026 | Passage SQLite → MariaDB ; modèles Apache/systemd ; SSO OpenID Connect câblé (en attente des réglages réels de la DSI) |
| 16–17/10/2026 | CG2P configuré (masqué par défaut) ; envoi réel des courriels (coupe-circuit désactivé par défaut) ; Apache/systemd vérifiés en conditions réelles (WSL) ; connexion par mot de passe transitoire ; page d'archivage/suppression groupés ; projet mis sous Git et sauvegardé sur GitHub (`remiunilim/portfoliogea`) |
| 18/10/2026 | Export Excel des notes (enseignant et administrateur) ; vérification DSI (rien n'a dérivé) ; **création de la branche `ovh`** (connexion par lien mail, puis auto-inscription étudiante sécurisée par vérification d'email, restreinte à `unilim.fr`) ; nettoyage de la base `main` pour ne garder que le compte administrateur de l'utilisateur (`remi.mougin@unilim.fr`) |
| 19/10/2026 | Correction « le lien du mail renvoie vers localhost » (signalée sur `ovh`, appliquée aux deux branches) : liens absolus et redirections construits à partir de `APP_BASE_URL` (`src/lib/url-publique.ts`) ; sur `main`, retour SSO reconstruit depuis `OIDC_REDIRECT_URI` |
| 20/10/2026 | Vérification des demandes de la DSI (SSO OpenID Connect, plus de lien mail, SMTP universitaire : conformes). Sécurisation des connexions, dans les deux branches : cookie de session aléatoire adossé à une table `sessions` (au lieu de l'identifiant du compte, que l'on pouvait falsifier), mode démonstration coupé en production (`MODE_DEMO`), premier administrateur via `ADMIN_EMAIL`, connexion par compte fictif ou par mot de passe refusée côté serveur quand ce n'est pas le mode actif ; adresse mail lue dans *userinfo* si le jeton SSO ne la contient pas |
| 20/10/2026 | Audit de sécurité des deux branches, corrections sur les **nouvelles branches `main-v2` et `ovh-v2`** (`main` et `ovh` gardées telles quelles en sauvegarde) : limite des tentatives (`src/lib/limite.ts`), en-têtes de sécurité (`next.config.ts`), nodemailer 10 (faille corrigée), Next.js limité à 127.0.0.1 et minuteurs de courriels en interne (`deploy/`), HSTS dans le modèle Apache. Aucun changement de base de données : retour à `main`/`ovh` possible à tout moment |

## 8. Reste à faire

1. Obtenir de la DSI les réglages réels du SSO (issuer, client ID, secret, URL de retour) et tester `main` avec le vrai fournisseur.
2. Déploiement sur le vrai serveur de la DSI (`main`) et/ou sur un serveur OVH (`ovh`) : nom de domaine, certificat HTTPS, sauvegardes MariaDB.
3. Renseigner un vrai SMTP (université pour `main`, service transactionnel recommandé pour `ovh`) puis activer l'envoi des courriels.
4. Nouvelle version du référentiel le jour où le nouveau programme national BUT GEA sera publié.
5. Activer CG2P quand l'IUT ouvrira ce parcours.

## 9. Installer sur un nouveau poste

Le projet est sur GitHub : `git clone` (ou `git worktree add` pour une seconde branche) plutôt que copier le dossier.

```bash
git clone https://github.com/remiunilim/portfoliogea.git
cd portfoliogea
sudo apt install nodejs npm apache2 mariadb-server   # ou Node.js 22 via NodeSource si la version d'Ubuntu est trop ancienne
node -v                                              # 22.5 minimum
cp .env.example .env.local                           # puis renseigner les identifiants MariaDB (et APP_BASE_URL/SMTP_* sur ovh)
npm install
npm run dev                                          # http://localhost:3000
```

Vérifications rapides après installation : se connecter, ouvrir *Étudiants et affectations*, ajouter un·e étudiant·e, ouvrir son portfolio, déposer une trace, évaluer et publier, lancer l'export PDF puis l'export Excel.

## 10. Méthode de travail attendue

- Lire le code existant avant de modifier, garder le style (noms et commentaires **en français**, Server Actions, composants dans `src/components/`).
- Mettre à jour `README.md` à chaque nouvelle fonctionnalité (il sert de documentation) — et ce fichier pour les changements de contexte ou d'historique notables.
- Toute modification pertinente pour `main` doit être évaluée pour `ovh` aussi (et inversement) : les deux branches partagent presque tout le code, seule l'authentification diffère.
- Après une modification visible, vérifier dans le navigateur (aperçu du serveur de dev) plutôt que de demander à l'utilisateur de tester.
- Si la maquette doit suivre une évolution : modifier `maquette/source/folio-gea.html`, relancer ses tests, régénérer la version autonome.
