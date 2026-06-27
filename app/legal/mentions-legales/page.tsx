export default function MentionsLegalesPage() {
  return (
    <main className="min-h-screen bg-[#EEF1EC] px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 font-grotesk text-[26px] font-bold text-[#16261D]">
          Mentions légales
        </h1>
        <div className="rounded-[22px] border border-[#E4E9E2] bg-white p-8">
          <div className="space-y-5 text-[14px] leading-relaxed text-[#71807A]">
            <div>
              <p className="mb-1 font-semibold text-[#16261D]">Éditeur</p>
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
              <p className="mb-1 font-semibold text-[#16261D]">Hébergement</p>
              <p>Vercel Inc.</p>
              <p>340 Pine Street, San Francisco, CA 94104, États-Unis</p>
            </div>
            <div>
              <p className="mb-1 font-semibold text-[#16261D]">Base de données</p>
              <p>Neon Inc.</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
