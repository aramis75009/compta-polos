export default function ConfidentialitePage() {
  return (
    <main className="min-h-screen bg-[var(--bg)] px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 font-grotesk text-[26px] font-bold text-[var(--ink)]">
          Politique de confidentialité
        </h1>
        <div className="rounded-[22px] border border-[var(--border)] bg-surface p-8">
          <ul className="space-y-3 text-[14px] leading-relaxed text-[var(--muted)]">
            <li>
              <span className="font-semibold text-[var(--ink)]">Données collectées</span>{" "}
              : email, données de ventes et stock.
            </li>
            <li>
              <span className="font-semibold text-[var(--ink)]">Finalité</span>{" "}
              : pilotage personnel de l&apos;activité de revente.
            </li>
            <li>
              <span className="font-semibold text-[var(--ink)]">Hébergement</span>{" "}
              : Neon (PostgreSQL) — serveurs EU.
            </li>
            <li>
              <span className="font-semibold text-[var(--ink)]">
                Durée de conservation
              </span>{" "}
              : jusqu&apos;à suppression du compte.
            </li>
            <li>Aucune donnée partagée avec des tiers.</li>
            <li>
              Contact :{" "}
              <a
                href="mailto:aramis.begnene@gmail.com"
                className="text-[#1B4332] underline-offset-2 hover:underline"
              >
                aramis.begnene@gmail.com
              </a>
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
}
