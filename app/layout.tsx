import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import AppShell from "@/components/AppShell";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: "MyFlip",
  description:
    "Comptabilité et gestion de stock pour revendeur de vêtements de marque",
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
        className={`${jakarta.variable} ${jakarta.className} min-h-screen bg-surface text-ink antialiased`}
      >
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
