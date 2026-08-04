"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { coef, euros } from "@/lib/calc";
import { burstConfetti } from "@/lib/celebrate";
import { metaFromId } from "@/lib/orbite/compteMeta";
import type {
  OrbiteCompte,
  OrbiteData,
  OrbiteMarque,
  OrbiteSelection,
  OrbiteVente,
} from "@/lib/orbite/types";

// Panneau de détail du corps sélectionné. Il lit tout dans la data déjà
// chargée par la query ["orbite"] : aucun appel réseau supplémentaire.

type Contenu =
  | { kind: "compte"; compte: OrbiteCompte }
  | { kind: "marque"; marque: OrbiteMarque }
  | { kind: "vente"; vente: OrbiteVente };

function resoudre(
  data: OrbiteData,
  selection: OrbiteSelection | null,
): Contenu | null {
  if (!selection) return null;
  if (selection.kind === "compte") {
    const compte = data.comptes.find((c) => c.id === selection.id);
    return compte ? { kind: "compte", compte } : null;
  }
  if (selection.kind === "marque") {
    const marque = data.marques.find((m) => m.nom === selection.id);
    return marque ? { kind: "marque", marque } : null;
  }
  const vente = data.ventesRecentes.find((v) => v.id === selection.id);
  return vente ? { kind: "vente", vente } : null;
}

// ── Briques d'affichage ──────────────────────────────────────────────────

function Ligne({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-[7px]">
      <dt className="text-[13px] text-white/45">{label}</dt>
      <dd className="text-[14px] font-semibold text-white/90">{valeur}</dd>
    </div>
  );
}

function GrosChiffre({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="mb-4">
      <div className="text-[12px] font-medium uppercase tracking-[0.08em] text-white/40">
        {label}
      </div>
      <div
        className="font-grotesk text-[34px] font-bold leading-tight text-[#C084FC]"
        style={{ textShadow: "0 0 28px rgba(168,85,247,.45)" }}
      >
        {valeur}
      </div>
    </div>
  );
}

function BarrePart({ part }: { part: number }) {
  const pct = Math.max(0, Math.min(1, part));
  return (
    <div className="mt-4">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[12px] text-white/45">Part du CA total</span>
        <span className="text-[12px] font-bold text-[#C084FC]">
          {Math.round(pct * 100)}%
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{
            width: `${pct * 100}%`,
            background: "linear-gradient(90deg,#7C3AED,#C084FC)",
            boxShadow: "0 0 12px rgba(168,85,247,.7)",
          }}
        />
      </div>
    </div>
  );
}

function Badge({ rentable }: { rentable: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold"
      style={{
        background: rentable ? "rgba(71,201,142,.16)" : "rgba(240,192,64,.16)",
        border: `1px solid ${rentable ? "rgba(71,201,142,.45)" : "rgba(240,192,64,.45)"}`,
        color: rentable ? "#47C98E" : "#F0C040",
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: rentable ? "#47C98E" : "#F0C040" }}
      />
      {rentable ? "Rentable" : "À surveiller"}
    </span>
  );
}

// ── Panneau ──────────────────────────────────────────────────────────────

export default function DetailPanel({
  data,
  selected,
  onClose,
}: {
  data: OrbiteData;
  selected: OrbiteSelection | null;
  onClose: () => void;
}) {
  // On garde le dernier contenu pendant l'animation de sortie, sinon le
  // panneau se viderait avant d'avoir fini de glisser.
  const [contenu, setContenu] = useState<Contenu | null>(null);
  const [ouvert, setOuvert] = useState(false);
  const derniereVente = useRef<string | null>(null);

  useEffect(() => {
    const resolu = resoudre(data, selected);
    if (resolu) {
      setContenu(resolu);
      setOuvert(true);
      // Effet « or » à l'ouverture d'une vente : on réutilise les confettis
      // déjà utilisés à la validation comptable.
      if (resolu.kind === "vente" && derniereVente.current !== resolu.vente.id) {
        derniereVente.current = resolu.vente.id;
        burstConfetti();
      }
    } else {
      setOuvert(false);
      if (!selected) derniereVente.current = null;
    }
  }, [data, selected]);

  // Échap ferme le panneau.
  useEffect(() => {
    if (!ouvert) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ouvert, onClose]);

  const caTotal = data.center.caTotal || 1;

  return (
    <aside
      aria-hidden={!ouvert}
      className="pointer-events-none absolute right-6 top-1/2 z-20 w-[330px] -translate-y-1/2"
      style={{
        transform: `translateY(-50%) translateX(${ouvert ? "0" : "calc(100% + 32px)"})`,
        opacity: ouvert ? 1 : 0,
        transition:
          "transform 300ms cubic-bezier(.22,1,.36,1), opacity 300ms ease-out",
      }}
    >
      {contenu && (
        <div
          className="pointer-events-auto relative rounded-2xl p-5"
          style={{
            background: "rgba(50,20,95,0.42)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(168,85,247,0.42)",
            boxShadow:
              "0 12px 48px rgba(10,4,25,.55), 0 0 34px rgba(124,58,237,.28) inset",
          }}
        >
          <button
            onClick={onClose}
            title="Fermer"
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg text-white/45 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" strokeWidth={2.5} />
          </button>

          {contenu.kind === "compte" && (
            <>
              <div className="mb-3 pr-8 text-[15px] font-bold text-white">
                {contenu.compte.label}
              </div>
              <GrosChiffre label="Chiffre d'affaires" valeur={euros(contenu.compte.ca)} />
              <dl className="divide-y divide-white/[0.07]">
                <Ligne label="Ventes" valeur={String(contenu.compte.ventes)} />
                <Ligne
                  label="Panier moyen"
                  valeur={euros(contenu.compte.panierMoyen)}
                />
                <Ligne
                  label="Avis"
                  valeur={
                    contenu.compte.avis > 0
                      ? String(contenu.compte.avis)
                      : "Non renseigné"
                  }
                />
              </dl>
              <BarrePart part={contenu.compte.ca / caTotal} />
            </>
          )}

          {contenu.kind === "marque" && (
            <>
              <div className="mb-3 flex items-center gap-2 pr-8">
                <span className="text-[15px] font-bold text-white">
                  {contenu.marque.nom}
                </span>
                <Badge rentable={contenu.marque.rentable} />
              </div>
              <GrosChiffre label="Chiffre d'affaires" valeur={euros(contenu.marque.ca)} />
              <dl className="divide-y divide-white/[0.07]">
                <Ligne label="Ventes" valeur={String(contenu.marque.ventes)} />
                <Ligne label="Coef. moyen" valeur={coef(contenu.marque.coefMoyen)} />
                <Ligne
                  label="Marge nette moy."
                  valeur={euros(contenu.marque.margeNetteMoyenne)}
                />
              </dl>

              {contenu.marque.topArticles.length > 0 && (
                <div className="mt-4">
                  <div className="mb-2 text-[12px] font-medium uppercase tracking-[0.08em] text-white/40">
                    Top ventes
                  </div>
                  <ul className="space-y-1.5">
                    {contenu.marque.topArticles.map((a) => (
                      <li
                        key={a.sku}
                        className="flex items-center justify-between rounded-lg px-2.5 py-2"
                        style={{ background: "rgba(255,255,255,.05)" }}
                      >
                        <span className="font-grotesk text-[13px] font-bold text-white/85">
                          {a.sku}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="text-[11px] text-white/35">
                            {a.statut}
                          </span>
                          <span className="text-[13px] font-semibold text-[#C084FC]">
                            {euros(a.prixVente)}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <BarrePart part={contenu.marque.ca / caTotal} />
            </>
          )}

          {contenu.kind === "vente" && (
            <>
              <div className="mb-3 pr-8">
                <span
                  className="font-grotesk text-[22px] font-bold text-white"
                  style={{ textShadow: "0 0 24px rgba(240,192,64,.5)" }}
                >
                  {contenu.vente.sku}
                </span>
              </div>
              <GrosChiffre label="Prix de vente" valeur={euros(contenu.vente.prixVente)} />
              <dl className="divide-y divide-white/[0.07]">
                <Ligne
                  label="Marge nette"
                  valeur={euros(contenu.vente.margeNette)}
                />
                <Ligne label="Coefficient" valeur={coef(contenu.vente.coefficient)} />
                <Ligne label="Canal" valeur={contenu.vente.canal ?? "—"} />
                <Ligne
                  label="Compte"
                  valeur={
                    contenu.vente.compteVente
                      ? metaFromId(contenu.vente.compteVente.toLowerCase()).label
                      : "Non attribué"
                  }
                />
                <Ligne
                  label="Date de vente"
                  valeur={
                    contenu.vente.dateVente
                      ? format(new Date(contenu.vente.dateVente), "d MMMM yyyy", {
                          locale: fr,
                        })
                      : "—"
                  }
                />
              </dl>
            </>
          )}
        </div>
      )}
    </aside>
  );
}
