import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg)] px-5 text-center">
      <div className="font-grotesk text-[80px] font-bold leading-none text-[var(--acc)]">
        404
      </div>
      <p className="mt-4 text-[18px] font-medium text-[var(--muted)]">
        Cette page n&apos;existe pas.
      </p>
      <Link
        href="/dashboard"
        className="mt-8 inline-flex items-center rounded-xl bg-[var(--acc)] px-6 py-3 text-[14px] font-bold text-[var(--acc-ink)] shadow-[0_10px_22px_-12px_rgba(20,53,40,.8)] transition-colors hover:bg-[var(--acc-hover)]"
      >
        ← Retour au dashboard
      </Link>
    </main>
  );
}
