"use client";

import { useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { UserCircle, LogOut } from "lucide-react";
import { useDismissOnOutside } from "@/lib/useDismiss";

// Avatar utilisateur + menu compte, dans la barre supérieure (à droite du thème).
// L'initiale est dérivée de NEXT_PUBLIC_USER_NAME (fallback « A »).
const NAME = process.env.NEXT_PUBLIC_USER_NAME?.trim() || "";
const INITIAL = (NAME.charAt(0) || "A").toUpperCase();

export default function AccountMenu() {
  const [open, setOpen] = useState(false);
  const ref = useDismissOnOutside<HTMLDivElement>(open, () => setOpen(false));

  return (
    <div ref={ref} className="relative flex items-center">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Mon compte"
        aria-expanded={open}
        className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-[var(--acc)] font-grotesk text-[15px] font-bold text-[var(--acc-dim)] transition-transform hover:scale-105"
      >
        {INITIAL}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+10px)] w-[214px] overflow-hidden rounded-[16px] border border-line bg-surface py-1.5 shadow-[0_26px_60px_-24px_rgba(20,53,40,.5)] [animation:popIn_.16s_ease_both] [transform-origin:top_right]">
          <div className="flex items-center gap-3 border-b border-bg px-3.5 py-3">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[var(--acc)] font-grotesk text-[13.5px] font-bold text-[var(--acc-dim)]">
              {INITIAL}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13.5px] font-bold text-ink">
                {NAME || "Mon compte"}
              </span>
              <span className="block text-[11.5px] font-medium text-faint">
                Connecté
              </span>
            </span>
          </div>
          <Link
            href="/compte"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3.5 py-2.5 text-[13.5px] font-semibold text-ink-muted transition-colors hover:bg-tint"
          >
            <UserCircle className="h-[18px] w-[18px]" strokeWidth={2} />
            Mon compte
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-[13.5px] font-semibold text-[#C2603F] transition-colors hover:bg-[#FBEEE7]"
          >
            <LogOut className="h-[18px] w-[18px]" strokeWidth={2} />
            Déconnexion
          </button>
        </div>
      )}
    </div>
  );
}
