import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Neutres → variables CSS (thème clair/sombre, cf. globals.css).
        bg: "var(--bg)",
        surface: "var(--surface)", // fond principal du contenu
        "surface-soft": "var(--surface-2)", // sidebar, cartes teintées
        "surface-container": "var(--tint)",
        "surface-container-high": "var(--tint)",
        tint: "var(--tint)",
        // Texte
        ink: "var(--ink)", // on-surface
        "ink-muted": "var(--ink2)", // on-surface-variant
        "ink-faint": "var(--faint)", // outline / texte tertiaire
        muted: "var(--muted)",
        faint: "var(--faint)",
        nav: "var(--nav)",
        // Bordures
        line: "var(--border)",
        "line-strong": "var(--border-strong)",
        // Vert forêt (couleur de marque)
        primary: "#1a5336",
        "primary-dark": "#003b22",
        "primary-container": "#b5f0c9",
        "on-primary": "#ffffff",
        // Vert menthe (tendances positives, accents)
        mint: "#47c98e",
        "mint-soft": "#79f7b8",
        // États
        error: "#ba1a1a",
        "error-container": "#ffdad6",
        "on-error-container": "#93000a",
        // Alias de sécurité : neutralise toute ancienne couleur violette
        accent: "#1a5336",
        background: "#ffffff",
        card: "#ffffff",
      },
      fontFamily: {
        sans: [
          "var(--font-jakarta)",
          "Plus Jakarta Sans",
          "system-ui",
          "sans-serif",
        ],
        // Police d'affichage du redesign (chiffres / titres / KPI).
        grotesk: [
          "var(--font-grotesk)",
          "Space Grotesk",
          "system-ui",
          "sans-serif",
        ],
      },
      fontSize: {
        "label-sm": ["12px", { lineHeight: "1.2", fontWeight: "500" }],
        "body-md": ["14px", { lineHeight: "1.5", fontWeight: "400" }],
        "title-sm": ["18px", { lineHeight: "1.4", fontWeight: "600" }],
        "headline-md": ["24px", { lineHeight: "1.3", fontWeight: "600" }],
        "display-lg": [
          "32px",
          { lineHeight: "1.2", letterSpacing: "-0.02em", fontWeight: "700" },
        ],
        "stat-lg": ["52px", { lineHeight: "1.05", fontWeight: "700" }],
      },
      borderRadius: {
        sm: "0.25rem",
        DEFAULT: "0.5rem",
        md: "0.75rem",
        lg: "1rem",
        xl: "1.5rem",
        card: "1.25rem", // 20px — rayon standard des cards
        full: "9999px",
      },
      boxShadow: {
        // Ombre douce et large (blur 20px, opacité 4%) — cards qui "flottent"
        card: "0 4px 20px rgba(0,0,0,0.04)",
        "card-hover": "0 8px 28px rgba(0,0,0,0.08)",
      },
      spacing: {
        sidebar: "256px",
      },
    },
  },
  plugins: [],
};
export default config;
