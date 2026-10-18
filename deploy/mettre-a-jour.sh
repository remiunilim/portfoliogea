#!/bin/bash
# Met à jour Folio GEA vers la dernière version poussée sur GitHub, SANS toucher aux
# données (base MariaDB, PDF déposés dans data/) : le code de l'application et les
# données sont séparés, une mise à jour ne fait que remplacer les fichiers du programme.
#
# À lancer sur le serveur, avec les droits sudo :
#   sudo deploy/mettre-a-jour.sh
#
# Si la mise à jour ajoute une nouvelle « case » dans la base (ex. une nouvelle table),
# l'application la crée elle-même au redémarrage, sans effacer ce qui existe déjà.

set -euo pipefail
cd "$(dirname "$0")/.."

echo "→ Récupération de la dernière version (branche $(git rev-parse --abbrev-ref HEAD))…"
sudo -u folio-gea git pull

echo "→ Installation des dépendances…"
sudo -u folio-gea npm ci

echo "→ Compilation de l'application…"
sudo -u folio-gea npm run build

echo "→ Redémarrage du service…"
systemctl restart folio-gea
systemctl status folio-gea --no-pager
