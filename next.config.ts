import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Bibliothèques Node lourdes : chargées telles quelles côté serveur plutôt que regroupées.
  serverExternalPackages: ["exceljs", "pdf-lib"],
  experimental: {
    serverActions: {
      // Dépôt de traces PDF (10 Mo max chacune) et import d'un export complet d'une autre
      // instance (toutes les traces en un seul fichier .zip, voir /admin/transfert).
      bodySizeLimit: "60mb",
    },
  },
};

export default nextConfig;
