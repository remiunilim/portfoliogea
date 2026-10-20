import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ne pas annoncer la technologie du serveur (en-tête X-Powered-By).
  poweredByHeader: false,
  // Protections du navigateur, sur toutes les pages et tous les fichiers.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Interdit d'afficher le site dans un cadre d'un AUTRE site (piège à clics). Le site
          // lui-même reste autorisé : l'aperçu des traces PDF s'affiche dans un cadre.
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          // Le navigateur respecte le type annoncé (un PDF reste un PDF).
          { key: "X-Content-Type-Options", value: "nosniff" },
          // L'adresse complète (qui peut contenir un jeton de connexion) n'est jamais transmise
          // à un autre site.
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
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
