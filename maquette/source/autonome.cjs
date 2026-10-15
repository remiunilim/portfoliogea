// Transforme la maquette publiée sur Claude en page HTML autonome (ouvrable par double-clic).
const fs = require("fs");
const [source, cible] = process.argv.slice(2);
let h = fs.readFileSync(source, "utf8");
const debut = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body { margin: 0; } [hidden] { display: none !important; }</style>
`;
h = debut + h.replace('<div id="app"></div>', '</head>\n<body>\n<div id="app"></div>') + "\n</body>\n</html>\n";
fs.writeFileSync(cible, h);
console.log("ok", h.length);
