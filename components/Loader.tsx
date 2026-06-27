"use client";

interface LoaderProps {
  label?: string;
  size?: "sm" | "md";
}

export default function Loader({ label = "Chargement", size = "md" }: LoaderProps) {
  const svgSize = size === "sm" ? 48 : 72;
  const pad = size === "sm" ? 10 : 14;
  const radius = size === "sm" ? 18 : 24;
  const py = size === "sm" ? "py-8" : "py-16";
  const fontSize = size === "sm" ? 13 : 14;

  return (
    <div className={`flex flex-col items-center justify-center ${py} gap-4`}>
      <div
        style={{
          display: "inline-flex",
          padding: pad,
          borderRadius: radius,
          background: "radial-gradient(120% 120% at 50% 0%, #214f3b 0%, #16261D 100%)",
        }}
      >
        <svg width={svgSize} height={svgSize} viewBox="0 0 96 96" fill="none">
          <path
            d="M27 69 V31 L48 54 L69 31 V69"
            fill="none"
            stroke="#2D6A4F"
            strokeWidth="8.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.28"
          />
          <path
            d="M27 69 V31 L48 54 L69 31 V69"
            fill="none"
            stroke="#A8D5B5"
            strokeWidth="8.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength="100"
            style={{
              strokeDasharray: 100,
              animation: "atlas-draw 2.1s cubic-bezier(.65,.05,.36,1) infinite",
              filter: "drop-shadow(0 0 5px rgba(168,213,181,.45))",
            }}
          />
        </svg>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 3,
          fontFamily: "'Space Grotesk', sans-serif",
          fontWeight: 600,
          fontSize,
          color: "#16261D",
          letterSpacing: "-0.01em",
        }}
      >
        {label}
        <span style={{ display: "inline-flex", gap: 3, marginLeft: 1 }}>
          {([0, 0.2, 0.4] as const).map((delay, i) => (
            <span
              key={i}
              style={{
                display: "inline-block",
                width: 3,
                height: 3,
                borderRadius: "50%",
                background: "#2D6A4F",
                animation: "atlas-dots 1.4s infinite",
                animationDelay: `${delay}s`,
              }}
            />
          ))}
        </span>
      </div>
    </div>
  );
}
