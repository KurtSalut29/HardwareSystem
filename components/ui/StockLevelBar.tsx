export default function StockLevelBar({ stock, threshold, ready }: { stock: number; threshold: number; ready: boolean }) {
  const pct = Math.min(100, Math.round((stock / threshold) * 100));
  const tone = stock === 0 ? "var(--bad)" : "var(--warn)";
  return (
    <div
      className="h-1.5 rounded-full overflow-hidden mt-2"
      style={{ background: "var(--border-strong)" }}
      title={`${stock} of ${threshold} units left before restock is safe`}
    >
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{ width: ready ? `${pct}%` : "0%", background: tone }}
      />
    </div>
  );
}
