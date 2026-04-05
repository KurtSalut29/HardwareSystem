const variants: Record<string, string> = {
  admin: "bg-purple-50 text-purple-600 border border-purple-100",
  cashier: "bg-blue-50 text-blue-600 border border-blue-100",
  customer: "bg-emerald-50 text-emerald-600 border border-emerald-100",
  pending: "bg-amber-50 text-amber-600 border border-amber-100",
  confirmed: "bg-blue-50 text-blue-600 border border-blue-100",
  delivered: "bg-emerald-50 text-emerald-600 border border-emerald-100",
  cancelled: "bg-red-50 text-red-500 border border-red-100",
  POS: "bg-indigo-50 text-indigo-600 border border-indigo-100",
  Online: "bg-teal-50 text-teal-600 border border-teal-100",
  low: "bg-red-50 text-red-500 border border-red-100",
  ok: "bg-emerald-50 text-emerald-600 border border-emerald-100",
};

export default function Badge({ label, variant }: { label: string; variant?: string }) {
  const cls = variants[variant ?? label] ?? "bg-gray-100 text-gray-500 border border-gray-200";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}
