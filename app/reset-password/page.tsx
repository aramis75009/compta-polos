"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function ResetForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";

  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (next !== confirm) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: next }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Une erreur est survenue.");
      } else {
        setDone(true);
        setTimeout(() => router.push("/login"), 2500);
      }
    } catch {
      setError("Impossible de contacter le serveur.");
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "w-full rounded-xl border border-[var(--border)] bg-[var(--tint)] px-4 py-3 text-[14px] text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--faint-2)] focus:border-[#1B4332] focus:bg-surface";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4">
      <div className="w-full max-w-sm rounded-[22px] border border-[var(--border)] bg-surface p-8 shadow-[0_14px_40px_-20px_rgba(20,53,40,.2)]">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#1B4332] font-bold text-white text-lg">
            M
          </span>
          <div>
            <p className="font-bold text-[var(--ink)]">MyFlip</p>
            <p className="text-[13px] text-[var(--muted)]">Nouveau mot de passe</p>
          </div>
        </div>

        {done ? (
          <div className="rounded-xl bg-[#E4F3EA] px-4 py-4 text-[14px] font-medium text-[#2D6A4F]">
            Mot de passe mis à jour. Redirection vers la connexion…
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            {!token && (
              <p className="rounded-xl bg-[#FBEEE7] px-4 py-3 text-[13.5px] text-[#C2603F]">
                Lien invalide. Recommence la procédure depuis la page de connexion.
              </p>
            )}
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
                disabled={!token}
                className={inputCls}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[12.5px] font-semibold text-[var(--muted)]">
                Confirmer
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                required
                disabled={!token}
                className={inputCls}
              />
            </div>
            {error && (
              <p className="rounded-xl bg-[#FBEEE7] px-4 py-3 text-[13.5px] text-[#C2603F]">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading || !token}
              className="mt-1 w-full rounded-xl bg-[#1B4332] py-3 text-[13.5px] font-bold text-white shadow-[0_10px_22px_-12px_rgba(20,53,40,.8)] transition-colors hover:bg-[#143528] disabled:opacity-60"
            >
              {loading ? "Mise à jour…" : "Mettre à jour le mot de passe"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
