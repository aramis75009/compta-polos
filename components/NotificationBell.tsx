"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Bell, Check, ChevronRight, Clock } from "lucide-react";
import { useNotifications } from "@/lib/hooks";

// Accent + fond de pastille par sévérité (couleurs d'accent, littérales : elles
// tiennent sur les deux thèmes).
const SEV = {
  action: { accent: "#C2603F", tint: "#FBEEE7", Icon: AlertTriangle },
  info: { accent: "#B5872E", tint: "#FBF3E2", Icon: Clock },
} as const;

// Cloche + panneau de notifications, intégrée dans la barre supérieure.
// Données live via /api/notifications ; chaque rappel pointe vers sa vue filtrée.
export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data } = useNotifications();
  const ref = useRef<HTMLDivElement>(null);

  const items = data?.items ?? [];
  const count = items.length;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative flex items-center">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications${count > 0 ? ` (${count})` : ""}`}
        aria-expanded={open}
        className={`relative flex h-10 w-10 items-center justify-center rounded-[11px] transition-colors ${
          open ? "bg-tint text-[#1B4332]" : "text-nav hover:bg-tint hover:text-[#1B4332]"
        }`}
      >
        <Bell className="h-5 w-5" strokeWidth={2} />
        {count > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-[9px] border-2 border-[var(--surface)] bg-[#C2603F] px-1 font-grotesk text-[10.5px] font-bold text-white">
            {count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+10px)] w-[min(384px,92vw)] overflow-hidden rounded-[18px] border border-line bg-surface shadow-[0_26px_60px_-24px_rgba(20,53,40,.5)] [animation:popIn_.16s_ease_both] [transform-origin:top_right]">
          <div className="flex items-center justify-between gap-2.5 border-b border-bg px-[18px] py-[15px]">
            <div className="flex items-baseline gap-2.5">
              <span className="font-grotesk text-[15.5px] font-bold text-ink">
                Notifications
              </span>
              {count > 0 && (
                <span className="text-[12px] font-semibold text-faint">
                  {count} à traiter
                </span>
              )}
            </div>
          </div>

          {count === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 pb-10 pt-[38px] text-center">
              <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[#E4F3EA] text-[#1B4332]">
                <Check className="h-[26px] w-[26px]" strokeWidth={2.6} />
              </span>
              <span className="text-[14px] font-semibold text-ink-muted">
                Tout est à jour — rien à faire
              </span>
            </div>
          ) : (
            <div className="max-h-[min(60vh,420px)] overflow-y-auto p-1.5">
              {items.map((n) => {
                const sev = SEV[n.severity as keyof typeof SEV] ?? SEV.info;
                const Icon = sev.Icon;
                return (
                  <Link
                    key={n.key}
                    href={n.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-[13px] px-3 py-3 transition-colors hover:bg-tint"
                  >
                    <span
                      className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-[10px]"
                      style={{ background: sev.tint }}
                    >
                      <Icon
                        className="h-[17px] w-[17px]"
                        strokeWidth={2.1}
                        style={{ color: sev.accent }}
                      />
                    </span>
                    <span className="min-w-0 flex-1 leading-[1.35]">
                      <span className="block text-[13.5px] font-bold text-ink">
                        {n.title}
                      </span>
                      <span className="mt-px block text-[12.5px] font-medium text-muted">
                        {n.message}
                      </span>
                    </span>
                    <span
                      className="flex-shrink-0 rounded-[11px] px-[9px] py-1 text-center font-grotesk text-[12.5px] font-bold"
                      style={{ color: sev.accent, background: sev.tint }}
                    >
                      {n.count}
                    </span>
                    <ChevronRight
                      className="h-[17px] w-[17px] flex-shrink-0 text-[var(--faint-2)]"
                      strokeWidth={2.2}
                    />
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
