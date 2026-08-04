import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import Providers from "./providers";
import AppShell from "@/components/AppShell";

// Police d'interface de Direction C : Space Grotesk porte tout, des libellés
// aux chiffres héros. Plus Jakarta Sans a été retirée une fois Calendrier et
// Mise en vente convertis — c'était sa dernière dépendance.
const grotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-grotesk",
});

// Police mono du Stock (SKU, montants, micro-labels d'en-tête). Sa chasse fixe
// est ce qui aligne les colonnes de chiffres à l'œil sur 1 200 lignes ; les
// autres pages ne la chargent pas tant qu'elles ne posent pas `font-mono`.
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
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
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MyFlip",
  },
};

// viewport-fit=cover → l'app occupe toute la largeur sous l'encoche iPhone ;
// la bottom nav gère elle-même la safe area (env(safe-area-inset-bottom)).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#1B4332",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`${grotesk.variable} ${mono.variable} ${grotesk.className} min-h-screen bg-bg text-ink antialiased`}
      >
        {/* Applique le thème avant le premier paint pour éviter tout flash clair
            au chargement en mode sombre. Miroir de ThemeToggle (clé identique). */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('myflip-theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme:dark)').matches))document.documentElement.dataset.theme='dark';}catch(e){}try{if(localStorage.getItem('myflip-sidebar')==='collapsed')document.documentElement.dataset.sidebar='collapsed';}catch(e){}`,
          }}
        />
        <Providers>
          <AppShell>{children}</AppShell>
          <Toaster position="bottom-right" />
        </Providers>
      </body>
    </html>
  );
}
