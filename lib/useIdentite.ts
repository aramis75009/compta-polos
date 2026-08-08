"use client";

// Identité affichée de l'utilisateur connecté.
//
// Remplace NEXT_PUBLIC_USER_NAME, qui était inlinée au build par Next et donc
// nécessairement identique pour tous les comptes d'un même déploiement. Le
// prénom vit désormais sur `User.prenom` et transite par le JWT (cf. les
// callbacks d'auth.config.ts).
//
// La règle de repli est ici et nulle part ailleurs, pour que le Dashboard, la
// page Paramètres et l'avatar de la barre supérieure ne puissent pas diverger.

import { useSession } from "next-auth/react";

export type Identite = {
  /** Prénom saisi à l'inscription. Chaîne vide si l'utilisateur n'en a pas. */
  prenom: string;
  email: string;
  /** Prénom, à défaut la partie locale de l'e-mail. Ce qu'on affiche. */
  nom: string;
  /** Initiale de l'avatar. « · » quand on n'a rien à afficher. */
  initiale: string;
};

export function useIdentite(): Identite {
  const { data } = useSession();

  const prenom = data?.user?.prenom?.trim() ?? "";
  const email = data?.user?.email ?? "";
  const nom = prenom || email.split("@")[0] || "";

  return {
    prenom,
    email,
    nom,
    initiale: (nom.charAt(0) || "·").toUpperCase(),
  };
}
