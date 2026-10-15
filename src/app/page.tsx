import { redirect } from "next/navigation";
import { utilisateurCourant } from "@/lib/session";

export default async function Accueil() {
  const u = await utilisateurCourant();
  if (!u) redirect("/connexion");
  redirect(u.role === "etudiant" ? `/portfolio/${u.id}` : "/enseignant");
}
