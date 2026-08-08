import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import Landing from "@/components/landing/Landing";

// La racine servait un simple aiguillage vers /login. Elle porte désormais la
// vitrine publique — c'est la première page qu'un visiteur non connecté voit.
// Un utilisateur déjà connecté n'a rien à y faire : on l'envoie au dashboard.

export const metadata: Metadata = {
  title: "MyFlip — Pilotez vos marges de l’achat à la pièce",
  description:
    "L’outil de gestion des revendeurs de vêtements de marque d’occasion qui achètent en lots : suivi par lot d’achat, stock au SKU, annonces générées par IA et marge réelle.",
  openGraph: {
    title: "MyFlip — Pilotez vos marges de l’achat à la pièce",
    description:
      "Suivi par lot d’achat, stock au SKU, annonces générées par IA et marge réelle, pour les revendeurs Vinted et Vestiaire Collective.",
    locale: "fr_FR",
    type: "website",
  },
};

export default async function Home() {
  const session = await auth();
  if (session) redirect("/dashboard");

  return <Landing />;
}
