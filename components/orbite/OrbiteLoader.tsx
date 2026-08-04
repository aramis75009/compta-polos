"use client";

import { useMemo } from "react";

// Loader affiché pendant le lazy-load de la scène 3D.
// Reprend le placeholder du prompt 1 : fond violet, étoiles, titre.

type Star = { id: number; x: number; y: number; size: number; delay: number; opacity: number };

function useStars(count: number): Star[] {
  return useMemo(() => {
    const rng = (seed: number) => {
      let s = seed;
      return () => {
        s = (s * 16807 + 0) % 2147483647;
        return s / 2147483647;
      };
    };
    const rand = rng(42);
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: rand() * 100,
      y: rand() * 100,
      size: 1 + rand() * 2.5,
      delay: rand() * 5,
      opacity: 0.3 + rand() * 0.7,
    }));
  }, [count]);
}

export default function OrbiteLoader() {
  const stars = useStars(80);

  return (
    <div
      className="absolute inset-0 flex h-full w-full flex-col items-center justify-center overflow-hidden"
      style={{
        background: "linear-gradient(180deg, #0B0716 0%, #140A26 100%)",
      }}
    >
      {/* Étoiles CSS */}
      <div className="pointer-events-none absolute inset-0">
        {stars.map((s) => (
          <span
            key={s.id}
            className="absolute rounded-full"
            style={{
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: s.size,
              height: s.size,
              backgroundColor: s.id % 3 === 0 ? "#C084FC" : s.id % 3 === 1 ? "#A855F7" : "#ffffff",
              opacity: s.opacity,
              animation: `twinkle ${2 + s.delay}s ease-in-out ${s.delay}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Glow ambiant */}
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: 400,
          height: 400,
          background:
            "radial-gradient(circle, rgba(124,58,237,.18) 0%, rgba(168,85,247,.06) 50%, transparent 70%)",
          filter: "blur(40px)",
        }}
      />

      <h1
        className="relative font-grotesk text-[56px] font-bold tracking-[-0.03em] text-white"
        style={{
          textShadow: "0 0 40px rgba(168,85,247,.5), 0 0 80px rgba(124,58,237,.25)",
        }}
      >
        Orbite
      </h1>
      <p className="mt-4 text-[17px] font-medium text-[#C084FC]/80">
        Ton univers de revente
      </p>

      {/* Spinner violet */}
      <div className="mt-12 flex items-center gap-3">
        <div
          className="h-2.5 w-2.5 rounded-full bg-[#A855F7]"
          style={{ animation: "pulseDot 1.4s ease-in-out infinite" }}
        />
        <div
          className="h-2.5 w-2.5 rounded-full bg-[#C084FC]"
          style={{ animation: "pulseDot 1.4s ease-in-out .2s infinite" }}
        />
        <div
          className="h-2.5 w-2.5 rounded-full bg-[#7C3AED]"
          style={{ animation: "pulseDot 1.4s ease-in-out .4s infinite" }}
        />
      </div>
      <p className="mt-6 text-[12px] font-medium text-white/30">
        Chargement de la scène 3D…
      </p>
    </div>
  );
}
