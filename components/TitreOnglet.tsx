"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useCompteAComptabiliser } from "@/lib/hooks";

/**
 * Préfixe le titre de l'onglet par le nombre d'articles à comptabiliser :
 * « (3) Stock — MyFlip ». Le badge de la sidebar ne sert à rien quand MyFlip
 * n'est pas l'onglet regardé ; le titre, si.
 *
 * Ne rend rien. Monté par `AppShell` **à l'intérieur** du châssis uniquement :
 * `useCompteAComptabiliser` déclenche une requête authentifiée, et `jsonFetch`
 * redirige vers /login sur un 401. Le monter sur les pages publiques créerait
 * une boucle de redirection.
 *
 * Le titre de base est reposé par Next à chaque navigation ; on retire donc un
 * éventuel préfixe existant avant d'en poser un, et on réagit aussi au
 * changement de route.
 */
export default function TitreOnglet() {
  const count = useCompteAComptabiliser();
  const pathname = usePathname();

  useEffect(() => {
    const base = document.title.replace(/^\(\d+\)\s+/, "");
    document.title = count > 0 ? `(${count}) ${base}` : base;
  }, [count, pathname]);

  return null;
}
