export default function KpiCard({
  label,
  value,
  badge,
  variant = "default",
}: {
  label: string;
  value: string;
  badge?: string;
  variant?: "default" | "primary";
}) {
  const primary = variant === "primary";

  return (
    <div
      className={`relative rounded-card border p-6 shadow-card transition-shadow hover:shadow-card-hover ${
        primary
          ? "border-primary bg-primary text-on-primary"
          : "border-line bg-surface text-ink"
      }`}
    >
      <p
        className={`text-label-sm uppercase tracking-wide ${
          primary ? "text-mint-soft" : "text-ink-faint"
        }`}
      >
        {label}
      </p>
      <p
        className={`mt-3 text-stat-lg ${primary ? "text-on-primary" : "text-ink"}`}
      >
        {value}
      </p>
      {badge && (
        <span
          className={`mt-3 inline-flex items-center rounded-full px-3 py-1 text-label-sm ${
            primary
              ? "bg-white/15 text-on-primary"
              : "bg-surface-container text-ink-muted"
          }`}
        >
          {badge}
        </span>
      )}
    </div>
  );
}
