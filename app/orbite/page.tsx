"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import OrbiteLoader from "@/components/orbite/OrbiteLoader";
import DetailPanel from "@/components/orbite/DetailPanel";
import { useOrbite } from "@/lib/hooks";
import { euros } from "@/lib/calc";
import type { OrbiteSelection } from "@/lib/orbite/types";

// La scène 3D (three + @react-three/fiber + drei) n'est chargée QUE sur cette
// page : import dynamique, ssr:false. Le bundle des autres pages n'embarque
// donc jamais three — vérifiable dans la sortie de `next build`.
const OrbiteScene = dynamic(() => import("@/components/orbite/OrbiteScene"), {
  ssr: false,
  loading: () => <OrbiteLoader />,
});

/** Encart violet translucide, utilisé pour le résumé et les états vides. */
function Encart({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl px-5 py-4"
      style={{
        background: "rgba(50,20,95,0.38)",
        backdropFilter: "blur(18px)",
        WebkitBackdropFilter: "blur(18px)",
        border: "1px solid rgba(168,85,247,0.32)",
        boxShadow: "0 8px 34px rgba(10,4,25,.45)",
      }}
    >
      {children}
    </div>
  );
}

export default function OrbitePage() {
  const { data, isLoading, isError, error } = useOrbite();
  const [selected, setSelected] = useState<OrbiteSelection | null>(null);

  const handleSelect = useCallback((s: OrbiteSelection | null) => {
    setSelected(s);
  }, []);

  const univers = data ?? null;
  const vide =
    univers !== null &&
    univers.comptes.length === 0 &&
    univers.marques.length === 0 &&
    univers.ventesRecentes.length === 0;
  const comptePrincipal = univers?.comptes[0] ?? null;

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{
        height: "calc(100vh - 58px)",
        background: "linear-gradient(180deg, #0B0716 0%, #140A26 100%)",
      }}
    >
      {isLoading ? (
        <OrbiteLoader />
      ) : (
        <>
          {/* Scène 3D */}
          {univers && (
            <div className="absolute inset-0">
              <OrbiteScene
                data={univers}
                selected={selected}
                onSelect={handleSelect}
              />
            </div>
          )}

          {/* Overlay DOM — transparent aux clics, sauf ses propres boutons */}
          <div className="pointer-events-none absolute inset-0 z-10">
            <header className="flex flex-col items-center pt-8">
              <h1
                className="font-grotesk text-[46px] font-bold leading-none tracking-[-0.03em] text-white"
                style={{
                  textShadow:
                    "0 0 40px rgba(168,85,247,.4), 0 0 80px rgba(124,58,237,.2)",
                }}
              >
                Orbite
              </h1>
              <p className="mt-2 text-[15px] font-medium text-[#C084FC]/70">
                Ton univers de revente
              </p>
            </header>

            {/* Résumé de l'univers, effacé quand le panneau de détail s'ouvre */}
            {univers && !vide && (
              <div
                className="pointer-events-auto absolute right-6 top-8 w-[210px]"
                style={{
                  opacity: selected ? 0 : 1,
                  transform: selected ? "translateY(-8px)" : "none",
                  transition: "opacity 220ms ease-out, transform 220ms ease-out",
                  pointerEvents: selected ? "none" : "auto",
                }}
              >
                <Encart>
                  <div className="mb-3 flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{
                        background: "linear-gradient(135deg,#7C3AED,#A855F7)",
                        boxShadow: "0 0 8px rgba(168,85,247,.6)",
                      }}
                    />
                    <span className="text-[13px] font-bold text-white/90">
                      {comptePrincipal?.label ?? "Univers"}
                    </span>
                  </div>
                  <dl className="space-y-2 text-[13px]">
                    <div className="flex justify-between">
                      <dt className="text-white/40">CA total</dt>
                      <dd className="font-grotesk font-bold text-[#C084FC]">
                        {euros(univers.center.caTotal)}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-white/40">Ventes</dt>
                      <dd className="font-semibold text-white/80">
                        {univers.center.ventesTotal}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-white/40">Marques</dt>
                      <dd className="font-semibold text-white/80">
                        {univers.marques.length}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-white/40">Comptes</dt>
                      <dd className="font-semibold text-white/80">
                        {univers.comptes.length}
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-3 border-t border-white/10 pt-2.5 text-[11px] leading-snug text-white/30">
                    Clique une lune, un anneau ou un point pour le détail.
                  </p>
                </Encart>
              </div>
            )}

            {/* Univers encore vide */}
            {vide && (
              <div className="absolute left-1/2 top-1/2 w-[340px] -translate-x-1/2 -translate-y-1/2 text-center">
                <Encart>
                  <p className="text-[15px] font-bold text-white">
                    Ton univers se remplit au fil des ventes…
                  </p>
                  <p className="mt-2 text-[13px] leading-relaxed text-[#C084FC]/70">
                    Chaque vente comptabilisée fait apparaître une nouvelle
                    lumière autour de la planète.
                  </p>
                </Encart>
              </div>
            )}

            {/* Erreur de chargement */}
            {isError && (
              <div className="pointer-events-auto absolute left-1/2 top-1/2 w-[340px] -translate-x-1/2 -translate-y-1/2 text-center">
                <Encart>
                  <p className="text-[15px] font-bold text-white">
                    Orbite n&apos;a pas pu se charger
                  </p>
                  <p className="mt-2 text-[13px] leading-relaxed text-[#C084FC]/70">
                    {error instanceof Error
                      ? error.message
                      : "Une erreur est survenue."}
                  </p>
                </Encart>
              </div>
            )}
          </div>

          {/* Panneau de détail, glisse depuis la droite */}
          {univers && (
            <DetailPanel
              data={univers}
              selected={selected}
              onClose={() => setSelected(null)}
            />
          )}
        </>
      )}
    </div>
  );
}
