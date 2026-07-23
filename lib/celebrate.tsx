import { toast } from "sonner";
import { euros } from "./calc";

// Célébration à la vente : burst de confettis aux couleurs MyFlip + toast riche
// (montant encaissé + marge nette). Appelé depuis le onSuccess d'une vente.

const COLORS = ["#1B4332", "#2D6A4F", "#A8D5B5", "#47C98E", "#7CE0A8", "#B5872E"];

/** Petit feu d'artifice DOM, sans dépendance. Nettoyé après l'animation. */
export function burstConfetti() {
  if (typeof document === "undefined") return;
  const layer = document.createElement("div");
  layer.style.cssText =
    "position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:hidden";
  document.body.appendChild(layer);

  const N = 42;
  for (let i = 0; i < N; i++) {
    const ang = (Math.PI * 2 * i) / N + (Math.random() - 0.5);
    const dist = 140 + Math.random() * 190;
    const sz = 7 + Math.random() * 8;
    const p = document.createElement("span");
    p.style.cssText = [
      "position:absolute",
      "left:50%",
      "top:42%",
      `width:${sz}px`,
      `height:${(sz * (Math.random() > 0.5 ? 1 : 0.5)).toFixed(1)}px`,
      `border-radius:${Math.random() > 0.5 ? "9999px" : "2px"}`,
      `background:${COLORS[i % COLORS.length]}`,
    ].join(";");
    p.style.setProperty("--tx", `${(Math.cos(ang) * dist).toFixed(1)}px`);
    p.style.setProperty("--ty", `${(Math.sin(ang) * dist - 40).toFixed(1)}px`);
    p.style.setProperty("--rot", `${(Math.random() * 720 - 360).toFixed(0)}deg`);
    p.style.animation = `confettiFly ${(0.9 + Math.random() * 0.6).toFixed(2)}s cubic-bezier(.15,.7,.3,1) forwards`;
    layer.appendChild(p);
  }
  setTimeout(() => layer.remove(), 1800);
}

/** Confettis + toast « Article vendu 🎉 » avec CA encaissé et marge nette. */
export function celebrateSale(ca: number | null, margeNette: number | null) {
  burstConfetti();
  toast.custom(
    () => (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          background: "#16261D",
          color: "#fff",
          padding: "13px 16px",
          borderRadius: 14,
          boxShadow: "0 16px 34px -14px rgba(0,0,0,.55)",
          minWidth: 232,
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
            borderRadius: 9999,
            background: "#A8D5B5",
            flexShrink: 0,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16261D" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13.5 }}>Article vendu 🎉</div>
          <div style={{ fontSize: 12, color: "#9FD4B5", marginTop: 1 }}>
            {ca != null ? `+${euros(ca)}` : ""}
            {margeNette != null ? ` · marge +${euros(margeNette)}` : ""}
          </div>
        </div>
      </div>
    ),
    { duration: 3200 },
  );
}
