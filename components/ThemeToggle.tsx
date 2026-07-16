"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

// Bascule clair / sombre. Le thème est appliqué avant le premier paint par le
// script inline de layout.tsx (même clé localStorage) ; ce composant ne fait
// que le lire au montage puis le piloter au clic.
export default function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.dataset.theme === "dark");
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    const root = document.documentElement;
    if (next) root.dataset.theme = "dark";
    else delete root.dataset.theme;
    try {
      localStorage.setItem("myflip-theme", next ? "dark" : "light");
    } catch {
      /* stockage indisponible : on ignore */
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Passer en thème clair" : "Passer en thème sombre"}
      title={dark ? "Thème clair" : "Thème sombre"}
      className="flex h-10 w-10 items-center justify-center rounded-[11px] text-nav transition-colors hover:bg-tint hover:text-[#1B4332]"
    >
      {dark ? (
        <Sun className="h-[17px] w-[17px]" strokeWidth={2} />
      ) : (
        <Moon className="h-[17px] w-[17px]" strokeWidth={2} />
      )}
    </button>
  );
}
