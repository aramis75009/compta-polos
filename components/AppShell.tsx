"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import ChatBot from "./ChatBot";
import TopBar from "./TopBar";

// Enveloppe l'app : sidebar + décalage du contenu, sauf sur /login.
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/login" || pathname === "/reset-password" || pathname.startsWith("/legal")) {
    return <>{children}</>;
  }

  return (
    <>
      <Sidebar />
      {/* Décalage pour la sidebar (desktop) et la bottom nav (mobile).
          La largeur suit --sidebar-w → s'anime avec le repli de la sidebar. */}
      <div className="pb-24 transition-[padding] duration-200 ease-out md:pb-0 md:pl-[var(--sidebar-w)]">
        <TopBar />
        {children}
      </div>
      <ChatBot />
    </>
  );
}
