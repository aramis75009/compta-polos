"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Package,
  Tag,
  FileText,
  Calendar,
  ShoppingBag,
  BarChart3,
  Settings,
  UserCircle,
  LogOut,
  PanelLeft,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useArticles } from "@/lib/hooks";
import { STATUT_A_COMPTABILISER } from "@/lib/calc";

type NavItem = {
  href: string;
  label: string;
  short: string;
  icon: LucideIcon;
  badge?: boolean;
};

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", short: "Accueil", icon: LayoutDashboard },
  { href: "/stock", label: "Stock", short: "Stock", icon: Package },
  { href: "/mise-en-vente", label: "Mise en vente", short: "Vendre", icon: Tag },
  {
    href: "/a-comptabiliser",
    label: "À comptabiliser",
    short: "Compta",
    icon: FileText,
    badge: true,
  },
  { href: "/calendrier", label: "Calendrier", short: "Agenda", icon: Calendar },
  { href: "/commandes", label: "Commandes", short: "Cmd", icon: ShoppingBag },
  { href: "/statistiques", label: "Statistiques", short: "Stats", icon: BarChart3 },
  { href: "/parametres", label: "Prompts", short: "Prompts", icon: Settings },
  { href: "/compte", label: "Mon compte", short: "Compte", icon: UserCircle },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

// Replie / déplie la sidebar en rail d'icônes. L'état est porté par
// data-sidebar sur <html> (posé sans flash par le script inline de layout.tsx),
// et l'apparence est pilotée par CSS (globals.css) → pas de flash à l'hydratation.
function toggleSidebar() {
  const root = document.documentElement;
  const collapsed = root.dataset.sidebar === "collapsed";
  if (collapsed) delete root.dataset.sidebar;
  else root.dataset.sidebar = "collapsed";
  try {
    localStorage.setItem("myflip-sidebar", collapsed ? "expanded" : "collapsed");
  } catch {
    /* stockage indisponible : on ignore */
  }
}

export default function Sidebar() {
  const pathname = usePathname();
  const { data: aComptabiliser } = useArticles({
    statut: STATUT_A_COMPTABILISER,
  });
  const count = aComptabiliser?.length ?? 0;

  return (
    <>
      {/* Sidebar verticale fixe (desktop), repliable en rail d'icônes */}
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-[var(--sidebar-w)] flex-col border-r border-[var(--border)] bg-surface px-[18px] pb-[22px] pt-[26px] transition-[width] duration-200 ease-out md:flex">
        {/* Bouton de repli, posé sur la bordure droite */}
        <button
          onClick={toggleSidebar}
          aria-label="Réduire ou agrandir le menu"
          title="Réduire / agrandir le menu"
          className="absolute -right-3.5 top-1/2 z-50 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-[var(--border)] bg-surface text-[var(--nav)] shadow-[0_2px_10px_rgba(20,53,40,.14)] transition-colors hover:border-[var(--border-strong)] hover:text-[#1B4332]"
        >
          <PanelLeft className="h-[15px] w-[15px]" strokeWidth={2} />
        </button>

        <div className="sb-item mb-[26px] flex items-center px-2">
          <img
            src="/logo-atlas/myflip-sidebar.svg"
            alt="MyFlip"
            className="sb-hide-collapsed h-11 w-auto"
          />
          <img
            src="/logo-atlas/myflip-icon.svg"
            alt="MyFlip"
            className="sb-only-collapsed h-10 w-10 rounded-xl"
          />
        </div>

        <nav className="flex flex-col gap-2">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={`sb-item relative flex items-center gap-[13px] rounded-xl px-[13px] py-[12px] text-[15.5px] transition-colors ${
                  active
                    ? "bg-[#1B4332] font-semibold text-white"
                    : "font-medium text-[#52635A] hover:bg-[var(--tint)] hover:text-[#1B4332]"
                }`}
              >
                <Icon className="h-[20px] w-[20px] flex-shrink-0" strokeWidth={2} />
                <span className="sb-hide-collapsed truncate">{item.label}</span>
                {item.badge && count > 0 && (
                  <>
                    <span className="sb-hide-collapsed ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#C2603F] px-1.5 text-[11px] font-bold text-white">
                      {count}
                    </span>
                    <span className="sb-only-collapsed absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-[#C2603F] ring-2 ring-[var(--surface)]" />
                  </>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bas de sidebar : teaser « nouveautés » + déconnexion + liens légaux */}
        <div className="mt-auto flex flex-col gap-3.5 pt-5">
          {/* Carte « bientôt disponible » (dépliée) */}
          <div className="sb-hide-collapsed rounded-2xl border border-[var(--border)] bg-[var(--tint)] p-3.5">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-[#1B4332] text-[#CFE6D8]">
                <Sparkles className="h-[15px] w-[15px]" strokeWidth={2} />
              </span>
              <span className="font-grotesk text-[13.5px] font-bold text-[var(--ink)]">
                Nouveautés
              </span>
            </div>
            <p className="mt-2 text-[12px] font-medium leading-[1.45] text-[var(--muted)]">
              De nouvelles fonctionnalités arrivent bientôt.
            </p>
          </div>
          {/* Version repliée : simple pastille */}
          <div className="sb-only-collapsed sb-item justify-center">
            <span
              title="Nouveautés à venir"
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--tint)] text-[#1B4332]"
            >
              <Sparkles className="h-[18px] w-[18px]" strokeWidth={2} />
            </span>
          </div>

          <div className="border-t border-[var(--border)] pt-3.5">
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              title="Déconnexion"
              className="sb-item flex w-full items-center gap-[13px] rounded-xl px-[13px] py-[11px] text-[15px] font-medium text-[#52635A] transition-colors hover:bg-[var(--tint)] hover:text-[#1B4332]"
            >
              <LogOut className="h-[19px] w-[19px] flex-shrink-0" strokeWidth={2} />
              <span className="sb-hide-collapsed">Déconnexion</span>
            </button>
            <div className="sb-hide-collapsed mt-2 border-t border-[var(--border)] px-4 pb-2 pt-3">
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                <a
                  href="/legal/mentions-legales"
                  className="text-[11px] text-[var(--faint-2)] hover:text-[var(--muted)]"
                >
                  Mentions légales
                </a>
                <a
                  href="/legal/cgu"
                  className="text-[11px] text-[var(--faint-2)] hover:text-[var(--muted)]"
                >
                  CGU
                </a>
                <a
                  href="/legal/confidentialite"
                  className="text-[11px] text-[var(--faint-2)] hover:text-[var(--muted)]"
                >
                  Confidentialité
                </a>
              </div>
              <p className="mt-1.5 text-[10px] text-[#B8C4BE]">© 2026 MyFlip</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Bottom navigation (mobile) — défilable horizontalement */}
      <nav
        className="fixed bottom-0 left-0 z-40 flex w-full items-stretch overflow-x-auto border-t border-[var(--border)] bg-surface md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex min-w-[64px] flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                active ? "text-[#1B4332]" : "text-[var(--faint-2)]"
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={2} />
              {item.short}
              {item.badge && count > 0 && (
                <span className="absolute right-2 top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#C2603F] px-1 text-[10px] font-bold text-white">
                  {count}
                </span>
              )}
            </Link>
          );
        })}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex min-w-[64px] flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-[var(--faint-2)]"
        >
          <LogOut className="h-5 w-5" strokeWidth={2} />
          Sortir
        </button>
      </nav>
    </>
  );
}
