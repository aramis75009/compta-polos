import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MyFlip",
    short_name: "MyFlip",
    description: "Pilotage de revente de vêtements de marque.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#EEF1EC",
    theme_color: "#1B4332",
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
