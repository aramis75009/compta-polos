"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

// Libellés des offres de la landing. Sert uniquement à confirmer à l'utilisateur
// le bouton qu'il a cliqué — aucun quota n'en découle aujourd'hui.
const PLANS: Record<string, string> = {
  solo: "Solo",
  atelier: "Atelier",
  negoce: "Négoce",
};

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const plan = params.get("plan") ?? "";
  const planLabel = PLANS[plan];

  const [prenom, setPrenom] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prenom, email, password, code, plan }),
    });

    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;
      setError(data?.error ?? "La création du compte a échoué.");
      setLoading(false);
      return;
    }

    // Compte créé : on connecte directement plutôt que de renvoyer vers /login
    // avec des identifiants à ressaisir.
    const login = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);

    if (login?.error) {
      setError("Compte créé, mais la connexion a échoué. Essaie de te connecter.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  const inputCls =
    "mb-4 w-full rounded-xl border border-[var(--border)] bg-[var(--tint)] px-4 py-3 text-[14px] text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--faint-2)] focus:border-[var(--acc)] focus:bg-surface";
  const labelCls =
    "mb-1.5 block text-[12.5px] font-semibold text-[var(--muted)]";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4 py-10">
      <div className="w-full max-w-sm rounded-[22px] border border-[var(--border)] bg-surface p-8 shadow-[0_14px_40px_-20px_rgba(20,53,40,.2)]">
        <div className="mb-6 flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[var(--acc)] text-lg font-bold text-[var(--acc-ink)]">
            M
          </span>
          <div>
            <p className="font-bold text-[var(--ink)]">MyFlip</p>
            <p className="text-[13px] text-[var(--muted)]">
              {planLabel ? `Créer ton compte ${planLabel}` : "Créer ton compte"}
            </p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col">
          <label htmlFor="prenom" className={labelCls}>
            Prénom
          </label>
          <input
            id="prenom"
            type="text"
            required
            autoComplete="given-name"
            value={prenom}
            onChange={(e) => setPrenom(e.target.value)}
            className={inputCls}
          />

          <label htmlFor="email" className={labelCls}>
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
          />

          <label htmlFor="password" className={labelCls}>
            Mot de passe
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby="password-aide"
            className={inputCls}
          />
          <p
            id="password-aide"
            className="-mt-2.5 mb-4 text-[11.5px] text-[var(--faint-2)]"
          >
            8 caractères minimum.
          </p>

          <label htmlFor="code" className={labelCls}>
            Code d&apos;invitation
          </label>
          <input
            id="code"
            type="text"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Fourni par MyFlip"
            className={`${inputCls} font-mono uppercase tracking-[0.08em]`}
          />

          {error && (
            <p
              role="alert"
              className="mb-4 rounded-xl bg-[var(--neg-soft)] px-4 py-2.5 text-[13.5px] text-[var(--neg)]"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[var(--acc)] py-3 text-[13.5px] font-bold text-[var(--acc-ink)] shadow-[0_10px_22px_-12px_rgba(20,53,40,.8)] transition-colors hover:bg-[var(--acc-hover)] disabled:opacity-60"
          >
            {loading ? "Création…" : "Créer mon compte"}
          </button>

          {/* min-h-44 : cible tactile, règle mobile de CLAUDE.md. */}
          <Link
            href="/login"
            className="mt-2 flex min-h-[44px] items-center justify-center text-[12.5px] text-[var(--faint-2)] transition-colors hover:text-[var(--muted)]"
          >
            J&apos;ai déjà un compte
          </Link>
        </form>
      </div>
    </main>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
