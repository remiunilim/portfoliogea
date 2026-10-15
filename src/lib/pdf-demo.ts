// Génère un PDF d'une page (texte simple) pour le jeu de démonstration.
// Encodage WinAnsi : couvre les accents du français.

function echapper(texte: string) {
  return texte.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/[’]/g, "'");
}

function couper(texte: string, largeur = 80): string[] {
  const lignes: string[] = [];
  let courante = "";
  for (const mot of texte.split(/\s+/)) {
    if ((courante + " " + mot).trim().length > largeur) {
      lignes.push(courante);
      courante = mot;
    } else {
      courante = (courante + " " + mot).trim();
    }
  }
  if (courante) lignes.push(courante);
  return lignes;
}

export function genererPdfDemo(titre: string, paragraphes: string[]): Buffer {
  const lignes = paragraphes.flatMap((p) => [...couper(p), ""]);
  const flux = [
    "BT /F1 20 Tf 60 770 Td",
    `(${echapper(titre)}) Tj`,
    "/F1 11 Tf 0 -36 Td 15 TL",
    ...lignes.map((l) => `(${echapper(l)}) '`),
    "ET",
  ].join("\n");

  const objets = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(flux, "latin1")} >>\nstream\n${flux}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
  ];

  let sortie = "%PDF-1.4\n";
  const positions: number[] = [];
  objets.forEach((obj, i) => {
    positions.push(Buffer.byteLength(sortie, "latin1"));
    sortie += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xref = Buffer.byteLength(sortie, "latin1");
  sortie += `xref\n0 ${objets.length + 1}\n0000000000 65535 f \n`;
  sortie += positions.map((p) => `${String(p).padStart(10, "0")} 00000 n \n`).join("");
  sortie += `trailer\n<< /Size ${objets.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(sortie, "latin1");
}
