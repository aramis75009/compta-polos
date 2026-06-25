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
  LogOut,
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
  { href: "/parametres/prompts", label: "Paramètres", short: "Config", icon: Settings },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function Sidebar() {
  const pathname = usePathname();
  const { data: aComptabiliser } = useArticles({
    statut: STATUT_A_COMPTABILISER,
  });
  const count = aComptabiliser?.length ?? 0;

  return (
    <>
      {/* Sidebar verticale fixe (desktop) */}
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-sidebar flex-col border-r border-[#E4E9E2] bg-white px-[18px] pb-[22px] pt-[26px] md:flex">
        <div className="mb-[22px] flex items-center gap-[11px] px-2">
          <span className="flex h-[38px] w-[38px] items-center justify-center rounded-[11px] bg-[#1B4332] font-grotesk text-[19px] font-bold text-white">
            M
          </span>
          <span className="font-grotesk text-[20px] font-bold tracking-[-0.02em] text-[#16261D]">
            MyFlip
          </span>
        </div>

        <div className="px-3 pb-2 pt-1 text-[11px] font-bold uppercase tracking-[0.09em] text-[#9BA89F]">
          Pilotage
        </div>

        <nav className="flex flex-1 flex-col gap-1.5">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-[13px] rounded-xl px-[13px] py-[11px] text-[14.5px] transition-colors ${
                  active
                    ? "bg-[#1B4332] font-semibold text-white"
                    : "font-medium text-[#52635A] hover:bg-[#F1F4EF] hover:text-[#1B4332]"
                }`}
              >
                <Icon className="h-[19px] w-[19px] flex-shrink-0" strokeWidth={2} />
                <span className="truncate">{item.label}</span>
                {item.badge && count > 0 && (
                  <span className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#C2603F] px-1.5 text-[11px] font-bold text-white">
                    {count}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-[#EDF0EA] pt-3.5">
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center gap-[13px] rounded-xl px-[13px] py-[11px] text-[14.5px] font-medium text-[#52635A] transition-colors hover:bg-[#F1F4EF] hover:text-[#1B4332]"
          >
            <LogOut className="h-[19px] w-[19px] flex-shrink-0" strokeWidth={2} />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Bottom navigation (mobile) — défilable horizontalement */}
      <nav
        className="fixed bottom-0 left-0 z-40 flex w-full items-stretch overflow-x-auto border-t border-[#E4E9E2] bg-white md:hidden"
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
                active ? "text-[#1B4332]" : "text-[#94A29A]"
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
          className="flex min-w-[64px] flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-[#94A29A]"
        >
          <LogOut className="h-5 w-5" strokeWidth={2} />
          Sortir
        </button>
      </nav>
    </>
  );
}
