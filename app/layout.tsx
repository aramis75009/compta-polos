import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import Providers from "./providers";
import AppShell from "@/components/AppShell";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
});

// Police d'affichage (chiffres, titres, KPI) du redesign — exposée en variable
// CSS ; n'altère pas la police de corps (Plus Jakarta Sans) des autres pages.
const grotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-grotesk",
});

export const metadata: Metadata = {
  title: "MyFlip — Pilotage de revente",
  description: "Suis tes achats, ventes et marges sur Vinted et Vestiaire.",
  metadataBase: new URL("https://compta-polos.vercel.app"),
  icons: {
    icon: "/logo-atlas/myflip-favicon-32.png",
    apple: "/logo-atlas/myflip-icon-180.png",
  },
  openGraph: {
    title: "MyFlip",
    description: "Pilotage de revente de vêtements de marque.",
    locale: "fr_FR",
    type: "website",
  },
};

// viewport-fit=cover → l'app occupe toute la largeur sous l'encoche iPhone ;
// la bottom nav gère elle-même la safe area (env(safe-area-inset-bottom)).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body
        className={`${jakarta.variable} ${grotesk.variable} ${jakarta.className} min-h-screen bg-surface text-ink antialiased`}
      >
        <Providers>
          <AppShell>{children}</AppShell>
          <Toaster position="bottom-right" />
        </Providers>
      </body>
    </html>
  );
}
