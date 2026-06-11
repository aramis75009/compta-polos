"use client";

import { useLayoutEffect, useRef, useState } from "react";

// Réduit automatiquement la taille de la valeur pour qu'elle tienne dans la
// carte (plafonnée à 52px). Évite tout débordement / troncature, même pour les
// gros montants (ex. « 10 986,07 € ») ou les cartes étroites en grid-cols-2.
function FitValue({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  const boxRef = useRef<HTMLParagraphElement>(null);
  const spanRef = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState(52);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const span = spanRef.current;
    if (!box || !span) return;

    const fit = () => {
      const MAX = 52;
      const MIN = 22;
      let s = MAX;
      span.style.fontSize = `${s}px`;
      // On rétrécit tant que le texte dépasse la largeur disponible.
      while (span.scrollWidth > box.clientWidth && s > MIN) {
        s -= 1;
        span.style.fontSize = `${s}px`;
      }
      setSize(s);
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  }, [value]);

  return (
    <p ref={boxRef} className={`mt-3 w-full overflow-hidden ${className ?? ""}`}>
      <span
        ref={spanRef}
        className="inline-block whitespace-nowrap font-bold leading-tight tabular-nums"
        style={{ fontSize: `${size}px` }}
      >
        {value}
      </span>
    </p>
  );
}

export default function KpiCard({
  label,
  value,
  badge,
  variant = "default",
}: {
  label: string;
  value: string;
  badge?: string;
  variant?: "default" | "primary";
}) {
  const primary = variant === "primary";

  return (
    <div
      className={`relative flex min-h-[140px] flex-col rounded-card border p-7 shadow-card transition-shadow hover:shadow-card-hover ${
        primary
          ? "border-primary bg-primary text-on-primary"
          : "border-line bg-surface text-ink"
      }`}
    >
      <p
        className={`text-label-sm uppercase tracking-wide ${
          primary ? "text-mint-soft" : "text-ink-faint"
        }`}
      >
        {label}
      </p>
      <FitValue value={value} className={primary ? "text-on-primary" : "text-ink"} />
      {badge && (
        <span
          className={`mt-3 inline-flex w-fit items-center rounded-full px-3 py-1 text-label-sm ${
            primary
              ? "bg-white/15 text-on-primary"
              : "bg-surface-container text-ink-muted"
          }`}
        >
          {badge}
        </span>
      )}
    </div>
  );
}
