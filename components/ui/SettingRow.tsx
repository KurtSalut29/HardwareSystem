/**
 * Building blocks for settings forms inside modals: a row with the setting's
 * name and a plain explanation on the left and its control on the right, and an
 * input that carries its unit (₱, km, days) inside the box.
 */

export function FormSection({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1 flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.1em] text-ink-4">
        {icon && <span className="grid size-6 place-items-center rounded-lg bg-brand-soft text-brand">{icon}</span>}
        {title}
      </h3>
      <div className="divide-y divide-line">{children}</div>
    </section>
  );
}

export default function SettingRow({ id, label, hint, children, wide = false, status, tone = "neutral" }: {
  id: string;
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  /** On a full page (Settings): the explanation and the control split the width, so the control fills its half. */
  wide?: boolean;
  /**
   * For switches, buttons and read-only values: the control sits at the right
   * of a full-width tile, and this says what the current state means.
   */
  status?: React.ReactNode;
  /** Tints the tile: "good" when the thing is on/working. */
  tone?: "neutral" | "good" | "warn";
}) {
  const tile = status !== undefined;
  const toneCls = tone === "good" ? "border-good/25 bg-good-soft/50" : tone === "warn" ? "border-warn/30 bg-warn-soft/60" : "border-line bg-subtle";
  return (
    <div className={wide
      ? "grid items-center gap-x-10 gap-y-2 py-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]"
      : "grid items-center gap-x-5 gap-y-2 py-3.5 sm:grid-cols-[minmax(0,1fr)_190px]"}>
      <div className="min-w-0">
        <label htmlFor={id} className="block text-[13.5px] font-semibold text-ink">{label}</label>
        {hint && <p className="mt-0.5 text-[12px] leading-snug text-ink-4">{hint}</p>}
      </div>
      {tile ? (
        <div className={`flex min-h-12 w-full flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border px-4 py-2.5 ${toneCls}`}>
          <div className="min-w-0 flex-1 text-[13px] text-ink-2">{status}</div>
          <div className="flex shrink-0 items-center gap-2">{children}</div>
        </div>
      ) : (
        <div>{children}</div>
      )}
    </div>
  );
}

export function UnitInput({ prefix, suffix, className = "", ...rest }: React.InputHTMLAttributes<HTMLInputElement> & {
  /** Shown before the number, e.g. "₱". */
  prefix?: string;
  /** Shown after the number, e.g. "km" or "/ order". */
  suffix?: string;
}) {
  return (
    <div className={`flex h-10 items-stretch overflow-hidden rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgba(16,24,64,0.04)] transition focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10 ${className}`}>
      {prefix && <span className="grid place-items-center pl-3 text-sm font-semibold text-ink-3">{prefix}</span>}
      <input {...rest}
        className="num min-w-0 flex-1 bg-transparent px-2.5 text-right text-sm font-semibold text-ink outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" />
      {suffix && <span className="grid place-items-center whitespace-nowrap border-l border-line bg-subtle px-3 text-[12px] font-medium text-ink-3">{suffix}</span>}
    </div>
  );
}
