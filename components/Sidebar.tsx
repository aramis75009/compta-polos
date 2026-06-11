"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useArticles } from "@/lib/hooks";
import { STATUT_A_COMPTABILISER } from "@/lib/calc";

type NavItem = {
  href: string;
  label: string;
  short: string;
  icon: React.ReactNode;
  badge?: boolean;
};

const I = (path: React.ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor">
    {path}
  </svg>
);

const IconDashboard = I(
  <path
    d="M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z"
    strokeWidth="1.6"
    strokeLinejoin="round"
  />,
);
const IconStock = I(
  <>
    <path
      d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <path d="m3.3 7 8.7 5 8.7-5M12 22V12" strokeWidth="1.6" />
  </>,
);
const IconComptabiliser = I(
  <>
    <path
      d="M9 2h6a2 2 0 0 1 2 2v16l-2.5-1.5L12 20l-2.5-1.5L7 20V4a2 2 0 0 1 2-2Z"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <path d="M9 7h6M9 11h6" strokeWidth="1.6" strokeLinecap="round" />
  </>,
);
const IconCalendar = I(
  <>
    <rect x="3" y="4" width="18" height="18" rx="2" strokeWidth="1.6" />
    <path d="M16 2v4M8 2v4M3 10h18" strokeWidth="1.6" strokeLinecap="round" />
  </>,
);
const IconCommandes = I(
  <>
    <path
      d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <path d="M3 6h18M16 10a4 4 0 0 1-8 0" strokeWidth="1.6" strokeLinecap="round" />
  </>,
);
const IconStats = I(
  <>
    <path d="M3 3v18h18" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M7 15l3-4 3 2 4-6" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </>,
);
const IconLogout = I(
  <path
    d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  />,
);

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", short: "Accueil", icon: IconDashboard },
  { href: "/stock", label: "Stock", short: "Stock", icon: IconStock },
  {
    href: "/a-comptabiliser",
    label: "À comptabiliser",
    short: "Compta",
    icon: IconComptabiliser,
    badge: true,
  },
  { href: "/calendrier", label: "Calendrier", short: "Agenda", icon: IconCalendar },
  { href: "/commandes", label: "Commandes", short: "Cmd", icon: IconCommandes },
  { href: "/statistiques", label: "Statistiques", short: "Stats", icon: IconStats },
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

  const RedBadge = () =>
    count > 0 ? (
      <span className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-error px-1.5 text-[11px] font-semibold text-white">
        {count}
      </span>
    ) : null;

  return (
    <>
      {/* Sidebar verticale fixe (desktop) */}
      <aside className="fixed left-0 top-0 z-40 hidden h-screen w-sidebar flex-col border-r border-line bg-surface-soft px-4 py-6 md:flex">
        <div className="mb-8 flex items-center gap-2 px-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-on-primary">
            <span className="text-base font-bold">M</span>
          </span>
          <span className="text-title-sm font-semibold text-ink">
            MyFlip
          </span>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-body-md font-medium transition-colors ${
                  active
                    ? "bg-primary text-on-primary shadow-card"
                    : "text-ink-muted hover:bg-surface-container hover:text-ink"
                }`}
              >
                {item.icon}
                <span className="truncate">{item.label}</span>
                {item.badge && <RedBadge />}
              </Link>
            );
          })}
        </nav>

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-3 rounded-md px-3 py-2.5 text-body-md font-medium text-ink-muted transition-colors hover:bg-surface-container hover:text-ink"
        >
          {IconLogout}
          Déconnexion
        </button>
      </aside>

      {/* Bottom navigation (mobile) — défilable horizontalement */}
      <nav className="fixed bottom-0 left-0 z-40 flex w-full items-stretch overflow-x-auto border-t border-line bg-surface-soft md:hidden">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex min-w-[64px] flex-1 flex-col items-center gap-1 py-2.5 text-label-sm font-medium transition-colors ${
                active ? "text-primary" : "text-ink-faint"
              }`}
            >
              {item.icon}
              {item.short}
              {item.badge && count > 0 && (
                <span className="absolute right-2 top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-error px-1 text-[10px] font-semibold text-white">
                  {count}
                </span>
              )}
            </Link>
          );
        })}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex min-w-[64px] flex-1 flex-col items-center gap-1 py-2.5 text-label-sm font-medium text-ink-faint"
        >
          {IconLogout}
          Sortir
        </button>
      </nav>
    </>
  );
}
