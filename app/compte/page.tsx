"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Check, AlertCircle, Lock, Mail } from "lucide-react";

export default function ComptePage() {
  const { data: session } = useSession();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccess(false);
    setError(null);

    if (next !== confirm) {
      setError("Les nouveaux mots de passe ne correspondent pas.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/user/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Une erreur est survenue.");
      } else {
        setSuccess(true);
        setCurrent("");
        setNext("");
        setConfirm("");
      }
    } catch {
      setError("Impossible de contacter le serveur.");
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "w-full rounded-xl border border-[#E4E9E2] bg-[#F7F9F6] px-4 py-3 text-[14px] text-[#16261D] outline-none transition-colors placeholder:text-[#A6B2A9] focus:border-[#1B4332] focus:bg-white";

  return (
    <main className="min-h-screen bg-[#EEF1EC] px-5 py-7 text-[#16261D] md:px-[38px] md:py-[30px] md:pb-[46px]">
      <h1 className="mb-1 font-grotesk text-[26px] font-bold tracking-[-0.025em] md:text-[30px]">
        Mon compte
      </h1>
      <p className="mb-7 text-[14.5px] font-medium text-[#71807A]">
        Gestion de tes informations personnelles.
      </p>

      <div className="flex max-w-lg flex-col gap-5">
        {/* Email */}
        <div className="rounded-[22px] border border-[#E4E9E2] bg-white px-6 py-6">
          <h2 className="mb-4 font-grotesk text-[17px] font-bold">Adresse e-mail</h2>
          <div className="flex items-center gap-3 rounded-xl border border-[#E4E9E2] bg-[#F7F9F6] px-4 py-3">
            <Mail className="h-4 w-4 flex-shrink-0 text-[#8A998F]" strokeWidth={2} />
            <span className="text-[14px] text-[#52635A]">
              {session?.user?.email ?? "—"}
            </span>
          </div>
        </div>

        {/* Changer le mot de passe */}
        <div className="rounded-[22px] border border-[#E4E9E2] bg-white px-6 py-6">
          <div className="mb-4 flex items-center gap-2.5">
            <Lock className="h-[18px] w-[18px] text-[#1B4332]" strokeWidth={2} />
            <h2 className="font-grotesk text-[17px] font-bold">Changer le mot de passe</h2>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-1.5">
              <label className="text-[12.5px] font-semibold text-[#71807A]">
                Mot de passe actuel
              </label>
              <input
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                placeholder="••••••••"
                required
                className={inputCls}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[12.5px] font-semibold text-[#71807A]">
                Nouveau mot de passe
              </label>
              <input
                type="password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                placeholder="8 caractères minimum"
                required
                className={inputCls}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[12.5px] font-semibold text-[#71807A]">
                Confirmer le nouveau mot de passe
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                required
                className={inputCls}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2.5 rounded-xl bg-[#FBEEE7] px-4 py-3 text-[13.5px] font-medium text-[#C2603F]">
                <AlertCircle className="h-4 w-4 flex-shrink-0" strokeWidth={2} />
                {error}
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2.5 rounded-xl bg-[#E4F3EA] px-4 py-3 text-[13.5px] font-medium text-[#2D6A4F]">
                <Check className="h-4 w-4 flex-shrink-0" strokeWidth={2.5} />
                Mot de passe mis à jour avec succès.
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-1 inline-flex items-center justify-center rounded-xl bg-[#1B4332] px-5 py-3 text-[13.5px] font-bold text-white shadow-[0_10px_22px_-12px_rgba(20,53,40,.8)] transition-colors hover:bg-[#143528] disabled:opacity-60"
            >
              {loading ? "Mise à jour…" : "Mettre à jour"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
