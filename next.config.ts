import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Bibliothèques Node lourdes : chargées telles quelles côté serveur plutôt que regroupées.
  serverExternalPackages: ["exceljs", "pdf-lib"],
  experimental: {
    serverActions: {
      // Dépôt de traces PDF jusqu'à 10 Mo (+ marge pour les champs du formulaire).
      bodySizeLimit: "11mb",
    },
  },
};

export default nextConfig;
