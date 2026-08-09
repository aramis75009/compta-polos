import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // TOUT alias de couleur pointe sur une variable CSS de globals.css, sans
      // exception. Une valeur en dur ici ne suit pas le thème sombre : elle
      // passe la revue visuelle en clair et disparaît sur le graphite.
      colors: {
        // Neutres
        bg: "var(--bg)",
        surface: "var(--surface)", // fond principal du contenu
        "surface-soft": "var(--surface-2)", // sidebar, cartes teintées
        "surface-container": "var(--tint)",
        tint: "var(--tint)",
        // Texte
        ink: "var(--ink)", // encre principale
        "ink-muted": "var(--ink2)", // encre secondaire
        "ink-faint": "var(--faint)", // encre tertiaire
        muted: "var(--muted)",
        faint: "var(--faint)",
        nav: "var(--nav)",
        // Bordures
        line: "var(--border)",
        // Accent. `primary` est l'ancien nom de `--acc` : vert forêt en clair,
        // lime en sombre. Les deux noms coexistent le temps que les usages
        // migrent ; ils désignent la même chose.
        primary: "var(--acc)",
        "primary-dark": "var(--acc-hover)",
        "on-primary": "var(--acc-ink)",
        // États
        error: "var(--neg)",
      },
      fontFamily: {
        // Direction C n'a qu'une police d'interface : Space Grotesk, des
        // libellés aux chiffres héros.
        sans: [
          "var(--font-grotesk)",
          "Space Grotesk",
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
        // Chasse fixe du Stock : SKU, montants, coefficients, micro-labels.
        mono: [
          "var(--font-mono)",
          "JetBrains Mono",
          "ui-monospace",
          "monospace",
        ],
      },
      // Direction C travaille au demi-pixel (12,5 / 13,5 / 10,5 px), que
      // l'échelle Tailwind ne sait pas nommer : le produit pose donc des
      // valeurs arbitraires (`text-[13.5px]`) et c'est assumé. Les trois
      // alias ci-dessous sont les seuls encore utilisés ; l'échelle complète
      // est documentée dans docs/design-system.md.
      fontSize: {
        "label-sm": ["12px", { lineHeight: "1.2", fontWeight: "500" }],
        "body-md": ["14px", { lineHeight: "1.5", fontWeight: "400" }],
        "title-sm": ["18px", { lineHeight: "1.4", fontWeight: "600" }],
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
      // Pas d'alias de largeur de sidebar ici : elle se replie, donc sa valeur
      // est dynamique. Elle vit dans --sidebar-w (globals.css), lue en
      // md:pl-[var(--sidebar-w)] par AppShell.
    },
  },
  plugins: [],
};
export default config;
