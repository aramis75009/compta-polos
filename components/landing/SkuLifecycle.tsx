"use client";

// Signature de la landing : la vie d'une pièce, du lot d'achat à la vente.
//
// Pourquoi ça plutôt qu'une carte « IA en train de générer » avec sa barre de
// progression : le SKU est l'artefact réel du métier. Une ligne suffit à dire
// ce que fait MyFlip — tu as payé 6,49 €, tu as vendu 24,90 €, ton coefficient
// est 3,84. Une barre de progression ne dit rien de ce produit-là.
//
// Le vocabulaire vient du Stock : mêmes statuts, mêmes couleurs (statutColors),
// mêmes formateurs (calc). La landing et l'app doivent se reconnaître.

import { useEffect, useState } from "react";
import { coefLabel, euros } from "@/lib/calc";
import { statutColor } from "@/lib/statutColors";

const SKU = "PRL-001";
const PRIX_ACHAT = 6.49;
const PRIX_VENTE = 24.9;

type Etape = {
  statut: string;
  vente: number | null;
  /** Ce que l'étape apprend au lecteur. Une ligne, pas une phrase de vente. */
  note: string;
};

const ETAPES: Etape[] = [
  {
    statut: "En stock",
    vente: null,
    note: "Le lot est réparti : chaque pièce porte son prix d'achat réel.",
  },
  {
    statut: "Photos prêtes",
    vente: null,
    note: "Photographiée, prête pour la rédaction de l'annonce.",
  },
  {
    statut: "En vente",
    vente: PRIX_VENTE,
    note: "Annonce en ligne, prix positionné.",
  },
  {
    statut: "Vendu",
    vente: PRIX_VENTE,
    note: "Marge et coefficient calculés à la vente, sans ressaisie.",
  },
];

const DUREE_MS = 2400;

export default function SkuLifecycle() {
  const [i, setI] = useState(0);
  const [anime, setAnime] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    // Mouvement réduit : on montre l'état final, celui qui porte l'information,
    // au lieu de retirer l'animation et de laisser une carte vide de sens.
    if (mq.matches) {
      setAnime(false);
      setI(ETAPES.length - 1);
      return;
    }
    const id = setInterval(() => setI((v) => (v + 1) % ETAPES.length), DUREE_MS);
    return () => clearInterval(id);
  }, []);

  const etape = ETAPES[i];
  const c = statutColor(etape.statut);
  const vendu = etape.statut === "Vendu";

  return (
    <div className="rounded-card border border-line bg-surface p-6 shadow-card sm:p-7">
      <div className="flex items-center justify-between gap-4">
        <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[var(--faint)]">
          Suivi pièce
        </span>
        <span className="font-mono text-[12.5px] font-medium tracking-[0.08em] text-[var(--ink2)]">
          {SKU}
        </span>
      </div>

      {/* Le statut est doublé par sa position dans la frise ci-dessous : la
          couleur seule ne porte jamais l'information (cf. statutColors). */}
      <div className="mt-5 flex items-center gap-2.5">
        <span
          aria-hidden
          className="h-2 w-2 flex-none rounded-full"
          style={{ backgroundColor: c.color }}
        />
        <span
          key={etape.statut}
          className="rounded-full px-3 py-1 text-[13px] font-semibold [animation:popIn_.2s_ease_both]"
          style={{ backgroundColor: c.bg, color: c.ink }}
        >
          {etape.statut}
        </span>
      </div>

      <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-line pt-5">
        <Metric label="Prix d'achat" value={euros(PRIX_ACHAT)} />
        <Metric
          label="Prix de vente"
          value={etape.vente == null ? "—" : euros(etape.vente)}
          estompe={etape.vente == null}
        />
        <Metric
          label="Coefficient"
          value={vendu ? coefLabel(PRIX_VENTE / PRIX_ACHAT) : "—"}
          estompe={!vendu}
          accent={vendu}
        />
      </dl>

      {/* Frise des étapes : c'est elle qui rend l'ordre lisible sans couleur. */}
      <ol className="mt-6 flex gap-1.5" aria-label="Étapes du cycle de vie">
        {ETAPES.map((e, idx) => (
          <li
            key={e.statut}
            aria-current={idx === i ? "step" : undefined}
            className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--raise)]"
          >
            <span
              className="block h-full rounded-full transition-[width] duration-500 ease-out"
              style={{
                width: idx <= i ? "100%" : "0%",
                backgroundColor: statutColor(e.statut).color,
              }}
            />
          </li>
        ))}
      </ol>

      <p
        key={etape.note}
        className="mt-4 min-h-[2.6em] text-[13.5px] leading-relaxed text-[var(--ink2)] [animation:fadeUp_.3s_ease_both]"
      >
        {etape.note}
      </p>

      {!anime && (
        <p className="mt-2 font-mono text-[10.5px] uppercase tracking-[0.14em] text-[var(--faint)]">
          Animation désactivée
        </p>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  estompe = false,
  accent = false,
}: {
  label: string;
  value: string;
  estompe?: boolean;
  accent?: boolean;
}) {
  return (
    <div>
      <dt className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-[var(--faint)]">
        {label}
      </dt>
      <dd
        className={`mt-1.5 font-mono text-[17px] font-bold tabular-nums transition-colors sm:text-[19px] ${
          estompe
            ? "text-[var(--faint)]"
            : accent
              ? "text-[var(--acc)]"
              : "text-[var(--ink)]"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
