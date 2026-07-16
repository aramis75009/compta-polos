export default function CguPage() {
  return (
    <main className="min-h-screen bg-[var(--bg)] px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 font-grotesk text-[26px] font-bold text-[var(--ink)]">
          Conditions générales d&apos;utilisation
        </h1>
        <div className="rounded-[22px] border border-[var(--border)] bg-surface p-8">
          <ul className="space-y-3 text-[14px] leading-relaxed text-[var(--muted)]">
            <li>
              MyFlip est un outil personnel de pilotage de revente de vêtements.
            </li>
            <li>L&apos;accès est réservé aux utilisateurs autorisés.</li>
            <li>
              L&apos;utilisateur s&apos;engage à ne pas partager ses identifiants.
            </li>
            <li>Les données saisies appartiennent à l&apos;utilisateur.</li>
            <li>
              L&apos;éditeur se réserve le droit de modifier ou interrompre le
              service.
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
}
