"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/dashboard";

  const [mode, setMode] = useState<"login" | "forgot">("login");

  // Login
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Forgot
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotDone, setForgotDone] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      setError("Identifiants invalides.");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  async function onForgot(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setForgotLoading(true);
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: forgotEmail }),
    });
    setForgotLoading(false);
    setForgotDone(true);
  }

  const inputCls =
    "mb-4 w-full rounded-xl border border-[var(--border)] bg-[var(--tint)] px-4 py-3 text-[14px] text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--faint-2)] focus:border-[#1B4332] focus:bg-surface";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4">
      <div className="w-full max-w-sm rounded-[22px] border border-[var(--border)] bg-surface p-8 shadow-[0_14px_40px_-20px_rgba(20,53,40,.2)]">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#1B4332] font-bold text-white text-lg">
            M
          </span>
          <div>
            <p className="font-bold text-[var(--ink)]">MyFlip</p>
            <p className="text-[13px] text-[var(--muted)]">
              {mode === "login" ? "Connecte-toi pour continuer." : "Réinitialiser ton mot de passe"}
            </p>
          </div>
        </div>

        {mode === "login" ? (
          <form onSubmit={onSubmit} className="flex flex-col">
            <label className="mb-1.5 block text-[12.5px] font-semibold text-[var(--muted)]">
              Email
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
            />
            <label className="mb-1.5 block text-[12.5px] font-semibold text-[var(--muted)]">
              Mot de passe
            </label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
            />
            {error && (
              <p className="mb-4 rounded-xl bg-[#FBEEE7] px-4 py-2.5 text-[13.5px] text-[#C2603F]">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#1B4332] py-3 text-[13.5px] font-bold text-white shadow-[0_10px_22px_-12px_rgba(20,53,40,.8)] transition-colors hover:bg-[#143528] disabled:opacity-60"
            >
              {loading ? "Connexion…" : "Se connecter"}
            </button>
            <button
              type="button"
              onClick={() => { setMode("forgot"); setError(null); }}
              className="mt-4 text-center text-[12.5px] text-[var(--faint-2)] transition-colors hover:text-[var(--muted)]"
            >
              Mot de passe oublié ?
            </button>
          </form>
        ) : forgotDone ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-[#E4F3EA] px-4 py-4 text-[14px] font-medium text-[#2D6A4F]">
              Si cet email est enregistré, un lien de réinitialisation a été envoyé.
            </div>
            <button
              onClick={() => { setMode("login"); setForgotDone(false); setForgotEmail(""); }}
              className="text-[12.5px] text-[var(--faint-2)] transition-colors hover:text-[var(--muted)]"
            >
              ← Retour à la connexion
            </button>
          </div>
        ) : (
          <form onSubmit={onForgot} className="flex flex-col">
            <label className="mb-1.5 block text-[12.5px] font-semibold text-[var(--muted)]">
              Ton adresse email
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={forgotEmail}
              onChange={(e) => setForgotEmail(e.target.value)}
              placeholder="aramis@exemple.com"
              className={inputCls}
            />
            <button
              type="submit"
              disabled={forgotLoading}
              className="w-full rounded-xl bg-[#1B4332] py-3 text-[13.5px] font-bold text-white shadow-[0_10px_22px_-12px_rgba(20,53,40,.8)] transition-colors hover:bg-[#143528] disabled:opacity-60"
            >
              {forgotLoading ? "Envoi…" : "Envoyer le lien"}
            </button>
            <button
              type="button"
              onClick={() => setMode("login")}
              className="mt-4 text-center text-[12.5px] text-[var(--faint-2)] transition-colors hover:text-[var(--muted)]"
            >
              ← Retour à la connexion
            </button>
          </form>
        )}
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
