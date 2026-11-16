import type { StockState } from "@/lib/catalog-ui";

const FILL: Record<StockState, string> = { out: "bg-bad", low: "bg-warn", ok: "bg-good" };

/**
 * Five ticks showing stock against the product's reorder point: the line
 * where it should be reordered sits at the second tick, so "low" reads as
 * one or two ticks and a healthy shelf fills the meter.
 */
export default function StockMeter({ stock, reorderAt, state, className = "" }: {
  stock: number; reorderAt: number; state: StockState; className?: string;
}) {
  // Two ticks = the reorder point; five ticks = 2.5× it (comfortably stocked).
  const unit = Math.max(reorderAt, 1) / 2;
  const lit = state === "out" ? 0 : Math.min(5, Math.max(1, Math.ceil(stock / unit)));
  return (
    <span className={`inline-flex items-center gap-[3px] ${className}`} aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={`h-1.5 w-2.5 rounded-[2px] ${i < lit ? FILL[state] : "bg-line"}`} />
      ))}
    </span>
  );
}
