import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { COOKIE_THEME, lireTheme } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Folio GEA — Portfolio de compétences",
  description: "Dépôt et suivi des portfolios du BUT GEA (PAÉ)",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Le thème est lu côté serveur : la page arrive directement dans le bon thème, sans clignotement.
  const theme = lireTheme((await cookies()).get(COOKIE_THEME)?.value);
  return (
    <html
      lang="fr"
      data-theme={theme}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
