import JSZip from "jszip";
import fs from "node:fs";
import { cheminFichier, exporterToutesLesDonnees, importerToutesLesDonnees, type DonneesTransfert, type RapportImport } from "./db";

// Export/import de toutes les données de l'application entre deux instances de Folio GEA (ex. de
// la version OVH vers la version DSI une fois déployée, ou inversement) : un seul fichier .zip
// contenant les données (donnees.json) et les PDF déposés (fichiers/<id>.pdf). Voir la logique de
// reconnaissance des comptes et de remappage des identifiants dans src/lib/db.ts.

export async function genererExportZip(): Promise<Buffer> {
  const donnees = await exporterToutesLesDonnees();
  const zip = new JSZip();
  zip.file("donnees.json", JSON.stringify(donnees, null, 2));
  const dossier = zip.folder("fichiers")!;
  for (const t of donnees.traces) {
    try {
      dossier.file(`${t.id}.pdf`, fs.readFileSync(cheminFichier(t.id)));
    } catch {
      // Fichier introuvable sur le disque (ne devrait pas arriver) : la trace sera signalée comme
      // manquante au moment de l'import, plutôt que de faire échouer tout l'export.
    }
  }
  return zip.generateAsync({ type: "nodebuffer" });
}

export async function appliquerImportZip(contenuZip: Buffer): Promise<RapportImport> {
  const zip = await JSZip.loadAsync(contenuZip);
  const fichierDonnees = zip.file("donnees.json");
  if (!fichierDonnees) throw new Error("Fichier invalide : ce n'est pas un export de Folio GEA (donnees.json introuvable).");
  const donnees = JSON.parse(await fichierDonnees.async("string")) as DonneesTransfert;
  if (donnees.version !== 1) throw new Error("Version de l'export non reconnue.");

  const fichiersTraces = new Map<string, Buffer>();
  for (const t of donnees.traces) {
    const f = zip.file(`fichiers/${t.id}.pdf`);
    if (f) fichiersTraces.set(t.id, await f.async("nodebuffer"));
  }

  return importerToutesLesDonnees(donnees, fichiersTraces);
}
