const variants: Record<string, string> = {
  admin: "bg-info-soft text-info",
  cashier: "bg-brand-soft text-brand-ink",
  customer: "bg-good-soft text-good",
  driver: "bg-warn-soft text-warn",
  pending: "bg-warn-soft text-warn",
  confirmed: "bg-info-soft text-info",
  out_for_delivery: "bg-brand-soft text-brand-ink",
  delivered: "bg-good-soft text-good",
  cancelled: "bg-bad-soft text-bad",
  POS: "bg-info-soft text-info",
  Online: "bg-good-soft text-good",
  low: "bg-bad-soft text-bad",
  ok: "bg-good-soft text-good",
};

export default function Badge({ label, variant }: { label: string; variant?: string }) {
  const v = variants[variant ?? label] ?? "bg-recess text-ink-3";
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${v}`}>
      <span className="size-1.5 shrink-0 rounded-full bg-current" />
      {label.replace(/_/g, " ")}
    </span>
  );
}
