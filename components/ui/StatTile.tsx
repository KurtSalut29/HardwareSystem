export type StatTone = "brand" | "good" | "warn" | "bad" | "neutral";

const TONE: Record<StatTone, string> = {
  brand: "bg-brand-soft text-brand",
  good: "bg-good-soft text-good",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  neutral: "bg-recess text-ink-3",
};

/** A number worth knowing at a glance, with an icon chip and an optional caption. */
export default function StatTile({ icon, label, value, caption, tone = "brand", className = "" }: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  caption?: React.ReactNode;
  tone?: StatTone;
  className?: string;
}) {
  return (
    <div className={`flex min-w-0 items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-3 ${className}`}>
      <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${TONE[tone]}`}>{icon}</span>
      <div className="min-w-0">
        <p className="truncate text-[12px] font-semibold text-ink-3">{label}</p>
        <p className="num truncate font-display text-[20px] font-extrabold leading-tight text-ink sm:text-[22px]">{value}</p>
        {caption && <p className="truncate text-[11.5px] text-ink-4">{caption}</p>}
      </div>
    </div>
  );
}
