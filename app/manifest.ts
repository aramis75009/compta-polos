import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MyFlip",
    short_name: "MyFlip",
    description: "Pilotage de revente de vêtements de marque.",
    start_url: "/dashboard",
    display: "standalone",
    // Couleurs de --bg en thème clair (globals.css). Le manifeste ne connaît
    // pas les media queries : il n'a qu'une valeur, on prend celle du thème par
    // défaut. La barre d'état, elle, suit les deux thèmes via `viewport.themeColor`
    // dans app/layout.tsx.
    //
    // Ces deux champs valaient #EEF1EC et #1B4332, couleurs de l'ancien design
    // « Forest Precision » : l'écran de démarrage PWA s'ouvrait donc en vert
    // forêt avant de céder la place à une app gris-vert.
    background_color: "#e7ece8",
    theme_color: "#e7ece8",
    lang: "fr",
    icons: [
      { src: "/logo-atlas/myflip-icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/logo-atlas/myflip-icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/logo-atlas/myflip-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
