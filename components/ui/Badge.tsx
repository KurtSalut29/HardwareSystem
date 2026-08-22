const variants: Record<string, { color: string; soft: string }> = {
  admin: { color: "var(--info)", soft: "var(--info-soft)" },
  cashier: { color: "var(--accent-ink)", soft: "var(--accent-soft)" },
  customer: { color: "var(--good)", soft: "var(--good-soft)" },
  driver: { color: "var(--warn)", soft: "var(--warn-soft)" },
  pending: { color: "var(--warn)", soft: "var(--warn-soft)" },
  confirmed: { color: "var(--info)", soft: "var(--info-soft)" },
  out_for_delivery: { color: "var(--accent-ink)", soft: "var(--accent-soft)" },
  delivered: { color: "var(--good)", soft: "var(--good-soft)" },
  cancelled: { color: "var(--bad)", soft: "var(--bad-soft)" },
  POS: { color: "var(--info)", soft: "var(--info-soft)" },
  Online: { color: "var(--good)", soft: "var(--good-soft)" },
  low: { color: "var(--bad)", soft: "var(--bad-soft)" },
  ok: { color: "var(--good)", soft: "var(--good-soft)" },
};

export default function Badge({ label, variant }: { label: string; variant?: string }) {
  const v = variants[variant ?? label] ?? { color: "var(--text-muted)", soft: "var(--bg-muted)" };
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize"
      style={{ background: v.soft, color: v.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: v.color }} />
      {label.replace(/_/g, " ")}
    </span>
  );
}
