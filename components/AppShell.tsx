"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import ChatBot from "./ChatBot";

// Enveloppe l'app : sidebar + décalage du contenu, sauf sur /login.
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/login") {
    return <>{children}</>;
  }

  return (
    <>
      <Sidebar />
      {/* Décalage pour la sidebar (desktop) et la bottom nav (mobile) */}
      <div className="pb-24 md:pb-0 md:pl-sidebar">{children}</div>
      <ChatBot />
    </>
  );
}
