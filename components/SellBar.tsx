"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { CANAUX } from "@/lib/canalColors";

// Barre flottante de validation d'une vente — même langage visuel que la barre
// de sélection en masse du Stock (pilule sombre #16261D, entrée fadeUp).
// Remplace le modal centré : on garde le contexte de la ligne à l'écran.

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

const FIELD =
  "flex min-h-[44px] items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 transition-colors focus-within:border-white/30 md:min-h-0 md:py-1.5";
const FIELD_LABEL = "text-[12px] font-medium text-[#9FB2A7]";
const FIELD_INPUT =
  "w-full min-w-0 bg-transparent text-[13.5px] font-semibold text-white outline-none [color-scheme:dark]";

export default function SellBar({
  open,
  sku,
  defaultPrix,
  defaultDate,
  defaultCanal,
  pending,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean;
  sku?: string;
  defaultPrix?: number | null;
  defaultDate?: string | null;
  defaultCanal?: string | null;
  pending?: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: (prixVente: number, dateVenteISO: string, canal: string) => void;
}) {
  const [prix, setPrix] = useState("");
  const [date, setDate] = useState(todayISO());
  const [canal, setCanal] = useState<string>("Vinted");
  const prixRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setPrix(defaultPrix != null ? String(defaultPrix) : "");
    setDate(defaultDate ? defaultDate.slice(0, 10) : todayISO());
    setCanal(defaultCanal || "Vinted");
    // Autofocus desktop uniquement : sur iPhone le clavier virtuel recouvrirait
    // la barre, qui est ancrée en bas de l'écran.
    if (window.matchMedia("(min-width: 768px)").matches) prixRef.current?.focus();
  }, [open, sku, defaultPrix, defaultDate, defaultCanal]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, pending, onClose]);

  if (!open) return null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const p = Number(prix);
    if (!Number.isFinite(p) || p <= 0) return;
    onConfirm(p, new Date(date).toISOString(), canal);
  };

  return (
    <div className="fixed inset-x-0 bottom-16 z-40 flex justify-center px-4 md:bottom-6 md:left-[var(--sidebar-w)]">
      <form
        onSubmit={submit}
        className="flex w-full max-w-[560px] flex-col gap-3 rounded-[22px] bg-[#16261D] p-4 text-white shadow-[0_18px_40px_-16px_rgba(0,0,0,.6)] [animation:fadeUp_.25s_cubic-bezier(.22,1,.36,1)_both] md:w-auto md:max-w-none md:flex-row md:flex-wrap md:items-center md:gap-2.5 md:rounded-full md:py-2 md:pl-5 md:pr-2"
      >
        <div className="flex items-center gap-2.5 md:contents">
          <span className="font-grotesk text-[13.5px] font-bold">
            Vendre {sku ?? "l’article"}
          </span>
          <span className="hidden h-4 w-px bg-white/20 md:block" />
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            aria-label="Annuler"
            className="ml-auto flex h-9 w-9 items-center justify-center rounded-full text-[#9FB2A7] transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50 md:hidden"
          >
            <X className="h-[17px] w-[17px]" strokeWidth={2.2} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 md:contents">
          <label className={FIELD}>
            <span className={FIELD_LABEL}>Prix</span>
            <input
              ref={prixRef}
              type="number"
              step="any"
              min="0"
              required
              inputMode="decimal"
              value={prix}
              onChange={(e) => setPrix(e.target.value)}
              className={`${FIELD_INPUT} [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none md:w-[70px]`}
            />
            <span className="text-[12px] font-medium text-[#9FB2A7]">€</span>
          </label>

          <label className={FIELD}>
            <span className={`${FIELD_LABEL} hidden md:inline`}>Date</span>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`${FIELD_INPUT} md:w-[122px]`}
            />
          </label>

          <label className={`${FIELD} col-span-2`}>
            <span className={FIELD_LABEL}>Canal</span>
            <select
              value={canal}
              onChange={(e) => setCanal(e.target.value)}
              className={`${FIELD_INPUT} cursor-pointer md:w-auto`}
            >
              {CANAUX.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="min-h-[44px] rounded-full bg-[#2D6A4F] px-4 text-[13.5px] font-bold text-white transition-colors hover:bg-[#35815F] disabled:opacity-60 md:min-h-0 md:py-1.5"
        >
          {pending ? "…" : "Confirmer la vente"}
        </button>

        <button
          type="button"
          onClick={onClose}
          disabled={pending}
          aria-label="Annuler"
          className="hidden h-8 w-8 items-center justify-center rounded-full text-[#9FB2A7] transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50 md:flex"
        >
          <X className="h-[17px] w-[17px]" strokeWidth={2.2} />
        </button>

        {error && (
          <p className="text-[12.5px] font-medium text-[#F5B7A0] md:w-full md:px-1">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
