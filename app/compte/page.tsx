"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Lock, Mail } from "lucide-react";
import { toast } from "sonner";

export default function ComptePage() {
  const { data: session } = useSession();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (next !== confirm) {
      toast.error("Les nouveaux mots de passe ne correspondent pas.");
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
        toast.error(json.error ?? "Une erreur est survenue.");
      } else {
        toast.success("Mot de passe mis à jour avec succès.");
        setCurrent("");
        setNext("");
        setConfirm("");
      }
    } catch {
      toast.error("Impossible de contacter le serveur.");
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "w-full rounded-xl border border-[var(--border)] bg-[var(--tint)] px-4 py-3 text-[14px] text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--faint-2)] focus:border-[#1B4332] focus:bg-surface";

  return (
    <main className="min-h-screen bg-[var(--bg)] px-5 py-7 text-[var(--ink)] md:px-[38px] md:py-[30px] md:pb-[46px]">
      <p className="mb-7 text-[14.5px] font-medium text-[var(--muted)]">
        Gestion de tes informations personnelles.
      </p>

      <div className="flex max-w-lg flex-col gap-5">
        {/* Email */}
        <div className="rounded-[22px] border border-[var(--border)] bg-surface px-6 py-6">
          <h2 className="mb-4 font-grotesk text-[17px] font-bold">Adresse e-mail</h2>
          <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--tint)] px-4 py-3">
            <Mail className="h-4 w-4 flex-shrink-0 text-[var(--faint)]" strokeWidth={2} />
            <span className="text-[14px] text-[#52635A]">
              {session?.user?.email ?? "—"}
            </span>
          </div>
        </div>

        {/* Changer le mot de passe */}
        <div className="rounded-[22px] border border-[var(--border)] bg-surface px-6 py-6">
          <div className="mb-4 flex items-center gap-2.5">
            <Lock className="h-[18px] w-[18px] text-[#1B4332]" strokeWidth={2} />
            <h2 className="font-grotesk text-[17px] font-bold">Changer le mot de passe</h2>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-1.5">
              <label className="text-[12.5px] font-semibold text-[var(--muted)]">
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
              <label className="text-[12.5px] font-semibold text-[var(--muted)]">
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
              <label className="text-[12.5px] font-semibold text-[var(--muted)]">
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
