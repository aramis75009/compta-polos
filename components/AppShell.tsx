"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import ChatBot from "./ChatBot";
import TopBar from "./TopBar";

// Pages servies sans le châssis de l'app : ni sidebar, ni bottom nav, ni
// chatbot. Ce sont les pages publiques — la landing, l'authentification et les
// mentions légales — auxquelles on accède sans session.
const SANS_CHASSIS = ["/", "/login", "/signup", "/reset-password"];

// Enveloppe l'app : sidebar + décalage du contenu.
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (SANS_CHASSIS.includes(pathname) || pathname.startsWith("/legal")) {
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
