export default function ConfidentialitePage() {
  return (
    <main className="min-h-screen bg-[#EEF1EC] px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 font-grotesk text-[26px] font-bold text-[#16261D]">
          Politique de confidentialité
        </h1>
        <div className="rounded-[22px] border border-[#E4E9E2] bg-white p-8">
          <ul className="space-y-3 text-[14px] leading-relaxed text-[#71807A]">
            <li>
              <span className="font-semibold text-[#16261D]">Données collectées</span>{" "}
              : email, données de ventes et stock.
            </li>
            <li>
              <span className="font-semibold text-[#16261D]">Finalité</span>{" "}
              : pilotage personnel de l&apos;activité de revente.
            </li>
            <li>
              <span className="font-semibold text-[#16261D]">Hébergement</span>{" "}
              : Neon (PostgreSQL) — serveurs EU.
            </li>
            <li>
              <span className="font-semibold text-[#16261D]">
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
