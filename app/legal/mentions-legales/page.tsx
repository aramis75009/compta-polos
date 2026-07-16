export default function MentionsLegalesPage() {
  return (
    <main className="min-h-screen bg-[var(--bg)] px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 font-grotesk text-[26px] font-bold text-[var(--ink)]">
          Mentions légales
        </h1>
        <div className="rounded-[22px] border border-[var(--border)] bg-surface p-8">
          <div className="space-y-5 text-[14px] leading-relaxed text-[var(--muted)]">
            <div>
              <p className="mb-1 font-semibold text-[var(--ink)]">Éditeur</p>
              <p>Aramis Begnene</p>
              <p>
                Contact :{" "}
                <a
                  href="mailto:aramis.begnene@gmail.com"
                  className="text-[#1B4332] underline-offset-2 hover:underline"
                >
                  aramis.begnene@gmail.com
                </a>
              </p>
            </div>
            <div>
              <p className="mb-1 font-semibold text-[var(--ink)]">Hébergement</p>
              <p>Vercel Inc.</p>
              <p>340 Pine Street, San Francisco, CA 94104, États-Unis</p>
            </div>
            <div>
              <p className="mb-1 font-semibold text-[var(--ink)]">Base de données</p>
              <p>Neon Inc.</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
