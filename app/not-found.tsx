import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[#EEF1EC] px-5 text-center">
      <div className="font-grotesk text-[80px] font-bold leading-none text-[#1B4332]">
        404
      </div>
      <p className="mt-4 text-[18px] font-medium text-[#71807A]">
        Cette page n&apos;existe pas.
      </p>
      <Link
        href="/dashboard"
        className="mt-8 inline-flex items-center rounded-xl bg-[#1B4332] px-6 py-3 text-[14px] font-bold text-white shadow-[0_10px_22px_-12px_rgba(20,53,40,.8)] transition-colors hover:bg-[#143528]"
      >
        ← Retour au dashboard
      </Link>
    </main>
  );
}
