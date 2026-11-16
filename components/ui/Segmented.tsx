"use client";

export type SegmentOption<K extends string> = { key: K; label: string; icon?: React.ReactNode; count?: number };

/** A small "pick one" switch, e.g. All / Delivery / Pickup. */
export default function Segmented<K extends string>({ options, value, onChange, label, size = "md" }: {
  options: SegmentOption<K>[];
  value: K;
  onChange: (key: K) => void;
  label: string;
  size?: "sm" | "md";
}) {
  const h = size === "sm" ? "h-7 px-2.5 text-[12px]" : "h-8 px-3 text-[13px]";
  return (
    <div role="group" aria-label={label} className="inline-flex max-w-full overflow-x-auto rounded-xl border border-line bg-surface p-0.5">
      {options.map((o) => {
        const on = value === o.key;
        return (
          <button key={o.key} type="button" aria-pressed={on} onClick={() => onChange(o.key)}
            className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[10px] font-semibold transition ${h} ${
              on ? "bg-brand-soft text-brand-ink" : "text-ink-3 hover:text-ink"}`}>
            {o.icon}
            {o.label}
            {o.count !== undefined && (
              <span className={`num rounded-full px-1.5 text-[10.5px] font-bold ${on ? "bg-surface text-brand-ink" : "bg-recess text-ink-4"}`}>{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
