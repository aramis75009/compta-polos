export function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-xl bg-[#E4E9E2] ${className}`} />
  );
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-[22px] border border-[#E4E9E2] bg-white px-6 py-6 ${className}`}
    >
      <SkeletonBlock className="mb-4 h-4 w-1/3" />
      <SkeletonBlock className="mb-3 h-8 w-1/2" />
      <SkeletonBlock className="h-4 w-2/3" />
    </div>
  );
}
