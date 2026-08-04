"use client";

import { useEffect, useRef } from "react";

/**
 * Ferme un panneau flottant au clic extérieur et à la touche Échap.
 *
 * Renvoie le ref à poser sur le conteneur du panneau (déclencheur compris :
 * un clic sur le bouton d'ouverture ne doit pas être vu comme « extérieur »,
 * sinon il refermerait aussitôt ce qu'il vient d'ouvrir).
 *
 * `onClose` est lu via un ref : les appelants passent presque toujours une
 * lambda recréée à chaque rendu, qui autrement réabonnerait les écouteurs à
 * chaque rendu. Seul `open` pilote l'abonnement.
 */
export function useDismissOnOutside<T extends HTMLElement>(
  open: boolean,
  onClose: () => void,
) {
  const ref = useRef<T>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        closeRef.current();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return ref;
}
