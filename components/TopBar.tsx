"use client";

import { usePathname } from "next/navigation";
import NotificationBell from "./NotificationBell";
import ThemeToggle from "./ThemeToggle";
import AccountMenu from "./AccountMenu";

// Libellé de page par route (aligné sur la nav de la sidebar).
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

// Barre supérieure partagée : nom de la page à gauche (unique source du titre —
// les pages ne le répètent plus dans leur contenu), cloche + thème + compte à
// droite. Rendue par AppShell en haut de la colonne de contenu.
export default function TopBar() {
  const pathname = usePathname();
  const label =
    LABELS[pathname] ??
    Object.entries(LABELS).find(([p]) => pathname.startsWith(p))?.[1] ??
    "MyFlip";

  return (
    <div className="sticky top-0 z-40 flex h-[58px] flex-shrink-0 items-center justify-between gap-4 border-b border-line bg-surface pl-4 pr-3 md:pl-[34px] md:pr-5">
      <div className="min-w-0 truncate font-grotesk text-[18px] font-bold tracking-[-0.01em] text-ink md:text-[20px]">
        {label}
      </div>
      <div className="flex items-center gap-1.5">
        <NotificationBell />
        <ThemeToggle />
        <span className="mx-1 h-6 w-px bg-line" aria-hidden="true" />
        <AccountMenu />
      </div>
    </div>
  );
}
