"use client";

export type TileTone = "brand" | "warn" | "good" | "bad" | "neutral";

export type FilterTile<K extends string> = {
  key: K;
  label: string;
  value: number | string;
  /** A lucide icon element, e.g. <Clock className="size-4" />. */
  icon: React.ReactNode;
  /** Colour of the icon chip. Status colours only where the number is a signal. */
  tone?: TileTone;
  /** Short text beside the number, e.g. "12%" or "of 66". */
  hint?: string;
  /** Draw attention: the count needs someone to act. */
  urgent?: boolean;
};

const TONE: Record<TileTone, string> = {
  brand: "bg-brand-soft text-brand",
  warn: "bg-warn-soft text-warn",
  good: "bg-good-soft text-good",
  bad: "bg-bad-soft text-bad",
  neutral: "bg-recess text-ink-3",
};

/**
 * A row of summary numbers that double as filters — click one to show only
 * those records. Used on Products, Orders, Restocks and Users.
 */
export default function FilterTiles<K extends string>({ tiles, value, onChange, label, loading = false, cols = 4 }: {
  tiles: FilterTile<K>[];
  value: K;
  onChange: (key: K) => void;
  label: string;
  loading?: boolean;
  cols?: 3 | 4 | 5;
}) {
  const grid = cols === 5 ? "md:grid-cols-5" : cols === 3 ? "md:grid-cols-3" : "md:grid-cols-4";
  return (
    <div className={`grid grid-cols-2 gap-2.5 ${grid}`} role="group" aria-label={label}>
      {tiles.map((t, i) => {
        const on = value === t.key;
        // An odd count on the two-column phone grid: let the first tile take a full row.
        const wide = i === 0 && tiles.length % 2 === 1;
        return (
          <button key={t.key} type="button" onClick={() => onChange(t.key)} aria-pressed={on}
            className={`${wide ? "col-span-2 md:col-span-1" : ""} flex min-w-0 items-center gap-3 rounded-2xl border px-3.5 py-3 text-left transition ${
              on ? "border-brand bg-brand-soft/50 ring-1 ring-brand"
                : t.urgent ? "border-warn/40 bg-surface hover:border-warn"
                : "border-line bg-surface hover:border-line-strong"}`}>
            <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${TONE[t.tone ?? "brand"]}`}>{t.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-semibold text-ink-3">{t.label}</span>
              <span className="flex items-baseline gap-1.5">
                <span className={`num truncate font-display text-[22px] font-extrabold leading-tight ${t.urgent ? "text-warn" : "text-ink"}`}>
                  {loading ? "–" : t.value}
                </span>
                {t.hint && !loading && <span className="hidden truncate text-[11.5px] text-ink-4 sm:inline">{t.hint}</span>}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
