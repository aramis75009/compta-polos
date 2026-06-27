"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function WelcomeModal() {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("myflip_welcomed") !== "true") {
      setOpen(true);
    }
  }, []);

  function dismiss() {
    localStorage.setItem("myflip_welcomed", "true");
    setOpen(false);
  }

  function goToCommandes() {
    localStorage.setItem("myflip_welcomed", "true");
    setOpen(false);
    router.push("/commandes");
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#16261D]/40 backdrop-blur-[2px]"
        onClick={dismiss}
      />
      {/* Card */}
      <div className="relative w-full max-w-sm rounded-[22px] border border-[#E4E9E2] bg-white p-8 shadow-[0_24px_60px_-20px_rgba(20,53,40,.35)]">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-[14px] bg-[#1B4332] font-bold text-white text-[22px]">
          M
        </div>
        <h2 className="mb-2 font-grotesk text-[22px] font-bold text-[#16261D]">
          Bienvenue sur MyFlip 👋
        </h2>
        <p className="mb-6 text-[14px] leading-relaxed text-[#71807A]">
          Commence par créer ta première commande pour alimenter ton stock et
          suivre ta rentabilité.
        </p>
        <button
          onClick={goToCommandes}
          className="mb-3 w-full rounded-xl bg-[#1B4332] py-3 text-[13.5px] font-bold text-white shadow-[0_10px_22px_-12px_rgba(20,53,40,.8)] transition-colors hover:bg-[#143528]"
        >
          Créer ma première commande
        </button>
        <button
          onClick={dismiss}
          className="w-full text-center text-[13px] font-medium text-[#94A29A] transition-colors hover:text-[#71807A]"
        >
          Plus tard
        </button>
      </div>
    </div>
  );
}
