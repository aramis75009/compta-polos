"use client";

import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import NotificationBell from "./NotificationBell";
import ThemeToggle from "./ThemeToggle";

// Libellé de fil d'ariane par route (aligné sur la nav de la sidebar).
const LABELS: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/stock": "Stock",
  "/mise-en-vente": "Mise en vente",
  "/a-comptabiliser": "À comptabiliser",
  "/calendrier": "Calendrier",
  "/commandes": "Commandes",
  "/statistiques": "Statistiques",
  "/parametres": "Prompts",
  "/compte": "Mon compte",
};

// Barre supérieure partagée : fil d'ariane à gauche, cloche + thème à droite.
// Rendue par AppShell en haut de la colonne de contenu (après la sidebar).
export default function TopBar() {
  const pathname = usePathname();
  const label =
    LABELS[pathname] ??
    Object.entries(LABELS).find(([p]) => pathname.startsWith(p))?.[1] ??
    "";

  return (
    <div className="sticky top-0 z-40 flex h-[58px] flex-shrink-0 items-center justify-between gap-4 border-b border-line bg-surface pl-4 pr-3 md:pl-[34px] md:pr-5">
      <div className="flex min-w-0 items-center gap-2 text-[13px] font-semibold">
        <span className="text-faint">Pilotage</span>
        {label && (
          <>
            <ChevronRight
              className="h-[15px] w-[15px] flex-shrink-0 text-[var(--border-strong)]"
              strokeWidth={2}
            />
            <span className="truncate text-ink">{label}</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <NotificationBell />
        <ThemeToggle />
      </div>
    </div>
  );
}
