"use client";

import { useEffect, useRef, useState } from "react";
import type { OrbiteData, OrbiteSelection } from "@/lib/orbite/types";
import { createOrbiteScene, type OrbiteSceneHandle } from "./sceneEngine";

// Enveloppe React du moteur three.js. Elle ne fait que trois choses : détecter
// WebGL, monter/démonter la scène, et lui transmettre la sélection. Toute
// l'animation vit dans orbiteScene.ts, hors du cycle de rendu de React.

type Props = {
  data: OrbiteData;
  selected: OrbiteSelection | null;
  onSelect: (selection: OrbiteSelection | null) => void;
};

/** Le contexte WebGL est-il obtenable ? Testé une fois, sur un canvas jetable. */
function webglDisponible(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      canvas.getContext("webgl2") ||
        canvas.getContext("webgl") ||
        canvas.getContext("experimental-webgl"),
    );
  } catch {
    return false;
  }
}

export default function OrbiteScene({ data, selected, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<OrbiteSceneHandle | null>(null);
  const onSelectRef = useRef(onSelect);
  const selectedRef = useRef(selected);
  const [webgl, setWebgl] = useState<"ok" | "ko" | "inconnu">("inconnu");

  // Les callbacks passent par des refs : leur identité change à chaque rendu
  // du parent, et la scène ne doit pas être reconstruite pour si peu.
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    setWebgl(webglDisponible() ? "ok" : "ko");
  }, []);

  // Montage de la scène. Reconstruite si les données changent réellement
  // (TanStack Query préserve l'identité de l'objet tant qu'il est inchangé).
  useEffect(() => {
    if (webgl !== "ok" || !containerRef.current) return;
    const handle = createOrbiteScene({
      container: containerRef.current,
      data,
      onSelect: (s) => onSelectRef.current(s),
    });
    handleRef.current = handle;
    // Réapplique la sélection en cours à une scène fraîchement reconstruite.
    if (selectedRef.current) handle.setSelected(selectedRef.current);
    return () => {
      handle.dispose();
      handleRef.current = null;
    };
  }, [data, webgl]);

  useEffect(() => {
    handleRef.current?.setSelected(selected);
  }, [selected]);

  if (webgl === "ko") {
    return (
      <div className="flex h-full w-full items-center justify-center px-6">
        <div
          className="max-w-md rounded-2xl px-7 py-6 text-center"
          style={{
            background: "rgba(124,58,237,0.16)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(168,85,247,0.3)",
            boxShadow: "0 8px 40px rgba(124,58,237,0.25)",
          }}
        >
          <p className="text-[16px] font-bold text-white">
            Orbite a besoin de WebGL
          </p>
          <p className="mt-2 text-[14px] leading-relaxed text-[#C084FC]/80">
            Ton navigateur ne l&apos;expose pas. Active l&apos;accélération
            matérielle ou ouvre MyFlip dans un autre navigateur pour explorer
            ton univers.
          </p>
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className="relative h-full w-full" />;
}
