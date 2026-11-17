"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Banknote, CheckCircle2, Clock, ImageIcon, ReceiptText, ShoppingBag, Smartphone, Undo2, Wallet, XCircle } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import StatTile from "@/components/ui/StatTile";
import Segmented from "@/components/ui/Segmented";
import EmptyState from "@/components/ui/EmptyState";
import Alert from "@/components/ui/Alert";
import Button from "@/components/ui/Button";
import PayBalanceModal from "@/components/payments/PayBalanceModal";
import { paymentStatus } from "@/components/payments/PaymentHistory";
import { useToast } from "@/components/ui/ToastProvider";
import { useSettings } from "@/lib/useSettings";

type Row = {
  id: number; orderId: number; kind: string; method: string; amount: number; amountReceived: number | null;
  reference: string | null; accountNumber: string | null; proofImage: string | null; status: string; note: string | null;
  createdAt: string; reviewedAt: string | null;
  order: { id: number; status: string; totalAmount: number; amountPaid: number; fulfillmentMode: string; paymentDueAt: string | null };
};
type Order = { id: number; status: string; totalAmount: number; amountPaid?: number; fulfillmentMode?: string; paymentDueAt?: string | null; dateTime: string; payments?: { kind: string; status: string; amount: number }[] };
type Filter = "all" | "payments" | "refunds" | "checking";

const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (d: string) => new Date(d).toLocaleDateString("en-PH", { weekday: "short", month: "short", day: "numeric" });
const when = (d: string) => new Date(d).toLocaleString("en-PH", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
const monthOf = (d: string) => new Date(d).toLocaleDateString("en-PH", { month: "long", year: "numeric" });

/**
 * A customer's money with the store: every payment (approved, being checked or
 * not accepted), every refund, and what is still owed — with a way to pay it.
 */
export default function MyTransactionsPage() {
  const showToast = useToast();
  const s = useSettings();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [payFor, setPayFor] = useState<Order | null>(null);

  async function load() {
    try {
      const [p, o] = await Promise.all([fetch("/api/payments"), fetch("/api/orders")]);
      if (!p.ok || !o.ok) { setError(true); return; }
      setRows(await p.json()); setOrders(await o.json()); setError(false);
    } catch { setError(true); }
  }
  useEffect(() => {
    let live = true;
    Promise.all([fetch("/api/payments"), fetch("/api/orders")]).then(async ([p, o]) => {
      if (!live) return;
      if (!p.ok || !o.ok) { setError(true); return; }
      setRows(await p.json()); setOrders(await o.json());
    }).catch(() => { if (live) setError(true); });
    return () => { live = false; };
  }, []);

  const all = rows ?? [];
  const paid = all.filter((r) => r.kind === "payment" && r.status === "approved").reduce((t, r) => t + (r.amountReceived ?? r.amount), 0);
  const refunded = all.filter((r) => r.kind === "refund" && r.status === "sent").reduce((t, r) => t + r.amount, 0);
  const refundsDue = all.filter((r) => r.kind === "refund" && r.status === "pending");
  const checking = all.filter((r) => r.kind === "payment" && r.status === "pending");
  const pendingOf = (o: Order) => (o.payments ?? []).filter((p) => p.kind === "payment" && p.status === "pending").reduce((t, p) => t + p.amount, 0);
  const owing = orders
    .filter((o) => o.status !== "cancelled" && o.status !== "delivered")
    .map((o) => ({ o, left: Math.max(0, Math.round((o.totalAmount - (o.amountPaid ?? 0)) * 100) / 100), pending: pendingOf(o) }))
    .filter((x) => x.left > 0.005);
  const owed = owing.reduce((t, x) => t + x.left, 0);

  const shown = all.filter((r) =>
    filter === "all" ? true
      : filter === "payments" ? r.kind === "payment"
      : filter === "refunds" ? r.kind === "refund"
      : r.kind === "payment" && r.status === "pending");
  const groups: [string, Row[]][] = [];
  for (const r of shown) {
    const m = monthOf(r.createdAt);
    const g = groups.find(([k]) => k === m);
    if (g) g[1].push(r); else groups.push([m, [r]]);
  }

  return (
    <div className="space-y-6">
      {payFor && (
        <PayBalanceModal orderId={payFor.id} balance={Math.max(0, payFor.totalAmount - (payFor.amountPaid ?? 0))} pending={pendingOf(payFor)}
          dueAt={payFor.paymentDueAt ?? null} onClose={() => setPayFor(null)}
          onDone={(msg) => { setPayFor(null); showToast(msg); void load(); }} />
      )}

      <PageHeader eyebrow="Shopping" title="Transactions"
        subtitle="Everything you've paid the store, what's still being checked, what you still owe, and your refunds." />

      {error && <Alert tone="bad" action={<Button size="sm" variant="secondary" onClick={load}>Try again</Button>}>Couldn&apos;t load your transactions.</Alert>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile icon={<CheckCircle2 className="size-5" />} tone="good" label="Paid to the store" value={<span className="num">{peso(Math.max(0, paid - refunded))}</span>} caption={refunded > 0 ? `${peso(refunded)} refunded` : "Approved payments"} />
        <StatTile icon={<Wallet className="size-5" />} tone={owed > 0 ? "warn" : "neutral"} label="Still to pay" value={<span className="num">{peso(owed)}</span>} caption={owing.length ? `${owing.length} ${owing.length === 1 ? "order" : "orders"}` : "Nothing owed"} />
        <StatTile icon={<Clock className="size-5" />} tone={checking.length ? "brand" : "neutral"} label="Being checked" value={<span className="num">{peso(checking.reduce((t, r) => t + r.amount, 0))}</span>} caption={checking.length ? "The store is checking your receipts" : "Nothing waiting"} />
        <StatTile icon={<Undo2 className="size-5" />} tone={refundsDue.length ? "warn" : "neutral"} label="Refunds on the way" value={<span className="num">{peso(refundsDue.reduce((t, r) => t + r.amount, 0))}</span>} caption={refundsDue.length ? "You'll be notified when sent" : "None pending"} />
      </div>

      {/* What needs the customer's attention */}
      {owing.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-[12px] font-bold uppercase tracking-[0.1em] text-ink-4">To pay</h2>
          {owing.map(({ o, left, pending }) => {
            const late = !!o.paymentDueAt && new Date(o.paymentDueAt) < new Date();
            const canSend = left - pending > 0.005 && s.gcashEnabled;
            return (
              <div key={o.id} className={`flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 ${late ? "border-bad/30 bg-bad-soft" : "border-warn/30 bg-warn-soft"}`}>
                <span className={`grid size-10 shrink-0 place-items-center rounded-xl bg-surface ${late ? "text-bad" : "text-warn"}`}><Wallet className="size-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold text-ink">Order #{o.id} · <span className="num">{peso(left)}</span> left</p>
                  <p className="text-[12.5px] text-ink-2">
                    {o.paymentDueAt ? (late ? `Was due ${day(o.paymentDueAt)} — please pay now, or call the store.` : `Due ${day(o.paymentDueAt)}.`) : (o.amountPaid ?? 0) > 0 ? "Pay before the order is handed over." : "Pay when you receive it, or now by GCash."}
                    {pending > 0 ? ` ${peso(pending)} you sent is being checked.` : ""}
                    {s.allowBalanceOnDelivery ? ` Cash ${o.fulfillmentMode === "pickup" ? "at pickup" : "on delivery"} is also fine.` : ""}
                  </p>
                </div>
                {canSend ? <Button size="sm" onClick={() => setPayFor(o)} icon={<Smartphone className="size-4" />}>Pay by GCash</Button>
                  : <span className="text-[12px] font-semibold text-brand-ink">Waiting for the store to check</span>}
              </div>
            );
          })}
        </section>
      )}

      <section className="overflow-hidden rounded-2xl border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 className="font-display text-[16px] font-extrabold text-ink">History</h2>
          <Segmented label="Show" value={filter} onChange={setFilter} options={[
            { key: "all", label: "All", count: all.length },
            { key: "payments", label: "Payments", count: all.filter((r) => r.kind === "payment").length },
            { key: "refunds", label: "Refunds", count: all.filter((r) => r.kind === "refund").length },
            { key: "checking", label: "Being checked", count: checking.length },
          ]} />
        </div>

        {!rows && !error && <div className="m-4 h-40 animate-pulse rounded-xl bg-recess" />}
        {rows && shown.length === 0 && (
          <EmptyState icon={ReceiptText} title={all.length ? "Nothing here" : "No payments yet"}
            description={all.length ? "Try another filter." : "When you pay for an order by GCash, or the store records a payment or refund, it shows here."}
            action={!all.length ? <Link href="/shop" className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand px-4 text-[13px] font-semibold text-white"><ShoppingBag className="size-4" /> Go to the shop</Link> : undefined} />
        )}
        {groups.map(([month, list]) => (
          <div key={month}>
            <p className="bg-subtle px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-ink-4">{month}</p>
            <ul className="divide-y divide-line">
              {list.map((r) => {
                const st = paymentStatus(r);
                const refund = r.kind === "refund";
                const amount = r.status === "approved" ? r.amountReceived ?? r.amount : r.amount;
                return (
                  <li key={r.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
                    <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${refund ? "bg-warn-soft text-warn" : r.status === "rejected" ? "bg-bad-soft text-bad" : "bg-recess text-ink-3"}`}>
                      {refund ? <Undo2 className="size-5" /> : r.status === "rejected" ? <XCircle className="size-5" /> : r.method === "GCash" ? <Smartphone className="size-5" /> : <Banknote className="size-5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-[14px] font-semibold text-ink">
                        {refund ? "Refund" : "Payment"} for <Link href="/orders" className="text-brand hover:underline">Order #{r.orderId}</Link>
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${st.cls}`}><st.icon className="size-3" />{st.label}</span>
                      </p>
                      <p className="text-[12px] text-ink-4">
                        {when(r.createdAt)} · {r.method}{r.reference ? <> · Ref <span className="num">{r.reference}</span></> : null}
                        {r.accountNumber ? <> · {refund ? "to" : "from"} <span className="num">{r.accountNumber}</span></> : null}
                      </p>
                      {r.note && <p className={`mt-0.5 text-[12.5px] ${r.status === "rejected" ? "text-bad" : "text-ink-3"}`}>{r.status === "rejected" ? "Reason: " : ""}{r.note}</p>}
                      {r.status === "rejected" && r.order.status !== "cancelled" && <p className="mt-0.5 text-[12px] text-ink-3">Check your GCash receipt, then send it again from &ldquo;To pay&rdquo; above or from My Orders.</p>}
                      {r.amountReceived != null && r.status === "approved" && r.amountReceived !== r.amount && !refund && (
                        <p className="text-[12px] text-warn">You entered {peso(r.amount)}; the store received {peso(r.amountReceived)}.</p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className={`num font-display text-[16px] font-extrabold ${refund ? "text-warn" : r.status === "rejected" ? "text-ink-4 line-through" : "text-ink"}`}>{refund ? "+ " : ""}{peso(amount)}</span>
                      {r.proofImage && (
                        <a href={r.proofImage} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] font-semibold text-brand hover:underline">
                          <ImageIcon className="size-3.5" /> {refund ? "Store's receipt" : "Your receipt"}
                        </a>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </section>

      <p className="text-[12px] text-ink-4">Payments you make in cash are recorded by the store when you hand them over. Questions about a payment? Contact the store{ s.storeContact ? ` at ${s.storeContact}` : "" }.</p>
    </div>
  );
}
