const fs = require("fs");
const h = fs.readFileSync(__dirname + "/folio-gea.html", "utf8");
const script = h.split("<script>")[1].split("</script>")[0];
const app = { innerHTML: "" };
const store = {};
global.document = { querySelector: (s) => (s === "#app" ? app : null), addEventListener: () => {}, documentElement: { dataset: {} } };
global.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => (store[k] = v), removeItem: (k) => delete store[k] };
global.sessionStorage = global.localStorage;
global.window = { scrollTo: () => {} };
const test = `
const verifier = (nomTest, cond) => console.log((cond ? "OK   " : "ÉCHEC") + " " + nomTest);
// Enseignant non référent
ui = { ...ui, user: "ens-bernard", etu: null, promo: 3, vue: null, flash: {}, ouvert: {} }; render();
verifier("Bernard : BUT3 vide", document.querySelector("#app").innerHTML.includes("Aucun étudiant ne vous est affecté"));
ui.promo = 2; render();
verifier("Bernard : voit Garcia, 1 brouillon à publier", /Garcia/.test(document.querySelector("#app").innerHTML) && /<b>1<\\/b><span>brouillons à publier/.test(document.querySelector("#app").innerHTML));
ui.etu = "etu-fournier"; render();
verifier("Bernard : portfolio de Manon refusé", document.querySelector("#app").innerHTML.includes("Mes étudiants") && ui.etu === null);
// Étudiant : brouillon invisible
ui = { ...ui, user: "etu-garcia", etu: "etu-garcia", annee: 2, onglet: "C3", flash: {}, ouvert: {} }; render();
verifier("Nathan : brouillon C3 invisible", !document.querySelector("#app").innerHTML.includes("Bonne coordination"));
ui.onglet = "C2"; render();
verifier("Nathan : évaluation C2 publiée visible", document.querySelector("#app").innerHTML.includes("Bonne maîtrise de"));
// Publication groupée
ui = { ...ui, user: "ens-bernard", etu: "etu-garcia", onglet: "complet", flash: {}, ouvert: {} }; render();
verifier("Bernard : bouton publier 1 brouillon", document.querySelector("#app").innerHTML.includes("Publier la note en brouillon"));
publier("etu-garcia", 2); ui = { ...ui, user: "etu-garcia", onglet: "C3" }; render();
verifier("Nathan : C3 visible après publication", document.querySelector("#app").innerHTML.includes("Bonne coordination"));
// Admin
ui = { ...ui, user: "ens-martin", etu: null, vue: null, promo: 3, refFiltre: "" }; render();
verifier("Admin : voit Fournier et Girard", /Fournier/.test(document.querySelector("#app").innerHTML) && /Girard/.test(document.querySelector("#app").innerHTML));
ui.refFiltre = "ens-bernard"; render();
verifier("Admin filtre Bernard : BUT3 vide", document.querySelector("#app").innerHTML.includes("Aucun étudiant pour ce filtre"));
ui.vue = "affectations"; render();
verifier("Admin : page affectations", document.querySelector("#app").innerHTML.includes("Étudiants et affectations"));
ui = { ...ui, vue: null, etu: "etu-fournier", onglet: "complet", annee: 3 }; render();
verifier("Plan PDF affiché", document.querySelector("#app").innerHTML.includes("Voir le plan du PDF"));
// Notifications
const nAvant = S.notifs.filter((n) => n.dest === "etu-garcia" && !n.lue).length;
verifier("Notif de démo non lue pour Nathan (C3 publiée plus haut + C2 récente)", nAvant >= 1);
ui = { ...ui, user: "etu-garcia", etu: "etu-garcia", vue: null }; render();
verifier("Cloche avec compteur", /bell-count">\\d/.test(document.querySelector("#app").innerHTML));
ui.vue = "notifications"; render();
verifier("Page notifications listée", document.querySelector("#app").innerHTML.includes("Évaluation publiée"));
verifier("Notifications marquées lues", S.notifs.filter((n) => n.dest === "etu-garcia" && !n.lue).length === 0);
// Import
const r = lireTableau(EXEMPLE_IMPORT);
const ap = analyserImport(r.lignes, true);
const res = Object.fromEntries(ap.map((l) => [l.nom, l.action]));
console.log("     aperçu :", JSON.stringify(res));
verifier("Import : Alice nouveau", res.Martin === "creer");
verifier("Import : Nathan mis à jour (référent par email)", res.Garcia === "maj" && ap[1].referentNom === "Sophie Lambert");
verifier("Import : Emma nouveau + enseignant à créer", res.Leroy === "creer" && ap[2].aCreerRef?.email === "paul.durand@exemple.fr");
verifier("Import : Chloé email changé", res.Roux === "maj");
verifier("Import : Yanis email invalide", res.Petit === "erreur");
verifier("Import : Hugo avec l'email de Léa refusé", res.Moreau === "erreur");
const nbAvant = USERS.length;
const bilan = appliquerImport(ap);
console.log("     bilan :", JSON.stringify(bilan));
verifier("Import appliqué : +3 comptes", USERS.length === nbAvant + 3);
verifier("Nathan en BUT3 chez Lambert", user("etu-garcia").annee === 3 && referentDe("etu-garcia") === "ens-lambert");
ui = { ...ui, user: "ens-martin", vue: "affectations", flash: {} }; render();
verifier("Page affectations avec import et ajouts", ["Importer une liste", "Ajouter un·e étudiant·e", "Ajouter un·e enseignant·e", "Leroy Emma"].every((t) => document.querySelector("#app").innerHTML.includes(t)));
ui.import = { lignes: r.lignes, nomFichier: "x", apercu: ap }; render();
verifier("Aperçu d'import rendu", document.querySelector("#app").innerHTML.includes("Importer"));
// Préférences et notification du référent (regroupée tant que non lue)
user("ens-lambert").pref = "quotidien";
const avantNotifs = S.notifs.filter((n) => n.dest === "ens-lambert").length;
prevenirReferent("etu-fournier", 3, "C4", "argumentaire modifié (50 mots)");
prevenirReferent("etu-fournier", 3, "C4", "argumentaire modifié (60 mots)");
const notifsLambert = S.notifs.filter((n) => n.dest === "ens-lambert");
verifier("Référent : une seule notification pour deux modifications", notifsLambert.length === avantNotifs + 1 && notifsLambert.at(-1).detail.startsWith("2 modifications"));
verifier("Référent : un seul courriel, en récapitulatif quotidien", S.courriels.filter((c) => c.dest === "ens-lambert").length === 1 && S.courriels.at(-1).mode === "quotidien");
prevenirReferent("etu-girard", 3, "C2", "trace déposée : X");
verifier("Bernard (aucun courriel par défaut) : pas de courriel", (() => { const av = S.courriels.length; prevenirReferent("etu-roux", 2, "C4", "x"); return S.courriels.length === av; })());
ui = { ...ui, user: "ens-lambert", vue: "compte", flash: {} }; render();
verifier("Mon compte enseignant : 3 choix dont quotidien coché", /pref-quotidien" name="pref" value="quotidien" checked/.test(document.querySelector("#app").innerHTML));
ui = { ...ui, user: "etu-roux", vue: "compte" }; render();
verifier("Mon compte étudiant : pas de récapitulatif quotidien", !document.querySelector("#app").innerHTML.includes("pref-quotidien"));
// Admin : fiche, passage, désactivation, suppression
ui = { ...ui, user: "ens-martin", vue: "passage", passage: null, flash: {} }; render();
verifier("Vue passage rendue", document.querySelector("#app").innerHTML.includes("Passage d'année et réaffectations"));
ui = { ...ui, vue: "fiche", ficheId: "etu-dubois" }; render();
verifier("Fiche étudiant rendue", ["Informations", "Désactiver", "Supprimer définitivement"].every((t) => document.querySelector("#app").innerHTML.includes(t)));
ui.ficheId = "ens-martin"; render();
verifier("Fiche de soi-même : ni désactivation ni suppression", !document.querySelector("#app").innerHTML.includes("Supprimer définitivement"));
verifier("Historique Bernard : évaluations comptées", historique("ens-bernard").evalsDonnees > 0);
// Note obligatoire, AC, rendez-vous et notes finales
verifier("Libellé « Non acquis »", libEval("insuffisant") === "Non acquis");
verifier("Code AC : C4 en BUT3 = AC42.01", codeAC(COMPETENCES[3], 3, 0) === "AC42.01" && codeAC(COMPETENCES[0], 1, 2) === "AC11.03");
verifier("Note finale 16/15/14 = 15,5", noteFinale(16, 15, 14) === 15.5 && noteFinale(16, null, 14) === null);
verifier("Lecture des notes", lireNote("12,5") === 12.5 && lireNote("") === null && lireNote("25") === undefined);
ui = { ...ui, user: "ens-lambert", etu: "etu-fournier", annee: 3, onglet: "C4", vue: null, flash: {} }; render();
verifier("Onglet compétence : AC42.01 affiché + champ note", document.querySelector("#app").innerHTML.includes("AC42.01") && document.querySelector("#app").innerHTML.includes('name="note"'));
S.evals["etu-fournier|3|C4"] = { niveau: "acquis", note: 16, com: "ok", ens: "ens-lambert", maj: new Date().toISOString(), pub: null };
ui.onglet = "suivi"; render();
verifier("Suivi enseignant : calcul provisoire 15,5/20", document.querySelector("#app").innerHTML.includes("15,5/20"));
ui = { ...ui, user: "etu-fournier", vue: null }; render();
verifier("Suivi étudiant : rien d'affiché tant que non publié", !document.querySelector("#app").innerHTML.includes("15,5/20"));
ui.user = "ens-lambert"; publier("etu-fournier", 3);
ui = { ...ui, user: "etu-fournier" }; render();
verifier("Après publication de l'année : 15,5/20 visible par l'étudiante", document.querySelector("#app").innerHTML.includes("15,5/20"));
// Parcours GPRH et GC2F
verifier("GPRH : C4 Administrer, GC2F : C5 Évaluer", compParCode("C4", "GPRH").court === "Administrer" && compParCode("C5", "GC2F").court === "Évaluer");
verifier("Parcours inconnu (CG2P) : GEMA par défaut", compParCode("C4", "CG2P").court === "Entreprendre");
ui = { ...ui, user: "ens-bernard", etu: "etu-benali", annee: 2, onglet: "C4", vue: null, flash: {} }; render();
const htmlBenali = document.querySelector("#app").innerHTML;
verifier("Sarah Benali (GPRH) : onglet C4 Administrer, AC41.01, parcours GPRH", htmlBenali.includes("Gérer l&#39;administration du personnel") && htmlBenali.includes("AC41.01") && htmlBenali.includes("Parcours GPRH"));
ui = { ...ui, etu: null, promo: 2 }; render();
const htmlTab = document.querySelector("#app").innerHTML;
verifier("Tableau BUT2 de Bernard : Benali et Perrin, en-tête « selon parcours »", htmlTab.includes("Benali") && htmlTab.includes("Perrin") && htmlTab.includes("selon parcours"));
verifier("Thème clair par défaut", document.documentElement.dataset.theme === "light");
appliquerTheme("dark"); render();
verifier("Bouton de thème : propose le thème clair en mode sombre", document.querySelector("#app").innerHTML.includes("Passer au thème clair"));
appliquerTheme("light");
verifier("Notification groupée avec les notes", S.notifs.some((n) => n.dest === "etu-fournier" && n.detail.includes("C4 : Acquis (16/20)") && n.detail.includes("RDV 2 : 14/20")));
`;
new Function(script + "\n" + test)();
