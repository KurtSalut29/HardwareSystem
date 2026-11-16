"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Store, Truck, Banknote, Smartphone, UserRound, UserPlus } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import LocationPicker, { type PickedLocation } from "@/components/LocationPicker";
import { describeQuote } from "@/lib/deliveryFee";
import { useDeliveryQuote } from "@/lib/useDeliveryQuote";
import { PAY_NOW_OPTIONS, payNowAmount, type PayNow } from "@/lib/payment";
import { ICON_SIZE } from "@/lib/constants/icon-size";

type Product = { id: number; name: string; price: number; unit: string; stock: number; category: { name: string } | null };
type Customer = { id: number; username: string; contact: string | null };
type Line = { productId: number; quantity: string };

const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition bg-white";
const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string; icon: React.ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="grid gap-1 rounded-xl border border-gray-200 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)} aria-pressed={value === o.value}
          className="flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition"
          style={value === o.value ? { background: "var(--brand)", color: "#fff" } : { color: "var(--text-muted)" }}>
          {o.icon} {o.label}
        </button>
      ))}
    </div>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
        <span className="w-5 h-5 rounded-full text-[11px] font-bold text-white flex items-center justify-center" style={{ background: "var(--brand)" }}>{n}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

/**
 * Staff take an order for a customer who called, texted or came to the counter:
 * who it's for (an account, or just a name and number), what they want, pickup
 * or delivery (with the drop-off pin and its fee), and how they pay. The order is
 * created already confirmed, and its receipt opens right after.
 */
export default function NewOrderModal({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: (order: { id: number }) => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [who, setWho] = useState<"walkin" | "account">("walkin");
  const [customerId, setCustomerId] = useState("");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [pick, setPick] = useState("");
  const [mode, setMode] = useState<"pickup" | "delivery">("pickup");
  const [location, setLocation] = useState<PickedLocation | null>(null);
  const [payment, setPayment] = useState<"Cash" | "GCash">("Cash");
  const [gcashReference, setGcashReference] = useState("");
  const [gcashNumber, setGcashNumber] = useState("");
  // How much the customer pays now: all of it, a half downpayment, nothing yet, or another amount.
  const [payNow, setPayNow] = useState<PayNow>("later");
  const [payOther, setPayOther] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    Promise.all([fetch("/api/products"), fetch("/api/customers")]).then(async ([p, c]) => {
      if (!live) return;
      if (p.ok) setProducts(await p.json());
      if (c.ok) setCustomers(await c.json());
    }).catch(() => {});
    return () => { live = false; };
  }, []);

  const byCategory = useMemo(() => {
    const g = new Map<string, Product[]>();
    for (const p of products) { const k = p.category?.name ?? "Other"; if (!g.has(k)) g.set(k, []); g.get(k)!.push(p); }
    return [...g.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [products]);

  const productOf = (id: number) => products.find((p) => p.id === id);
  const subtotal = lines.reduce((s, l) => s + (productOf(l.productId)?.price ?? 0) * (Number(l.quantity) || 0), 0);
  const delivery = useDeliveryQuote(mode === "delivery" ? location : null);
  const quote = mode === "delivery" ? delivery.quote : null;
  const fee = quote?.fee ?? 0;
  const total = Math.round((subtotal + fee) * 100) / 100;
  const paidNow = payNowAmount(payNow, total, payOther);
  const payOtherInvalid = payNow === "other" && (paidNow == null || paidNow > total);

  function addLine() {
    const id = Number(pick);
    if (!id) return;
    setLines((ls) => (ls.some((l) => l.productId === id) ? ls : [...ls, { productId: id, quantity: "1" }]));
    setPick("");
  }

  const lineError = lines.map((l) => {
    const p = productOf(l.productId); const q = Number(l.quantity);
    if (!p) return null;
    if (!(q > 0)) return "Enter a quantity";
    if (p.unit !== "kg" && !Number.isInteger(q)) return "Whole numbers only";
    if (q > p.stock) return `Only ${p.stock} ${p.unit} in stock`;
    return null;
  });

  async function submit() {
    setError("");
    if (who === "walkin" && !name.trim()) { setError("Enter the customer's name."); return; }
    if (who === "account" && !customerId) { setError("Choose the customer's account."); return; }
    if (lines.length === 0) { setError("Add at least one product."); return; }
    if (lineError.some(Boolean)) { setError("Fix the quantities marked in red."); return; }
    if (mode === "delivery" && !location) { setError("Pin the delivery location on the map."); return; }
    if (mode === "delivery" && delivery.loading) { setError("Still working out the delivery fee — one moment."); return; }
    if (mode === "delivery" && !quote) { setError(delivery.error ?? "Couldn't work out the delivery fee. Move the pin and try again."); return; }
    if (quote?.tooFar) { setError("That location is beyond the delivery area."); return; }
    if (payOtherInvalid) { setError(`Enter an amount from ₱0 to ${peso(total)}.`); return; }

    setSaving(true);
    const res = await fetch("/api/orders", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(who === "account" ? { customerId: Number(customerId) } : { customerName: name, customerContact: contact }),
        items: lines.map((l) => ({ productId: l.productId, quantity: Number(l.quantity) })),
        fulfillmentMode: mode,
        ...(mode === "delivery" && location ? { deliveryAddress: location.address, latitude: location.lat, longitude: location.lng } : {}),
        paymentMethod: payment,
        ...(payment === "GCash" ? { gcashNumber, gcashReference } : {}),
        amountPaid: paidNow ?? 0,
      }),
    });
    setSaving(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { setError(data.error ?? "Couldn't create the order."); return; }
    onCreated(data);
  }

  return (
    <Modal open onClose={onClose} title="New order (phone or walk-in)" size="xl"
      footer={
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-auto text-xs text-gray-500">
            {fee > 0 && <>{peso(subtotal)} + {peso(fee)} delivery = </>}
            <span className="text-sm font-bold text-gray-900 num">{peso(total)}</span>
          </div>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={saving}>Create order</Button>
        </div>
      }>
      <div className="space-y-6">
        <Section n={1} title="Customer">
          <Segmented value={who} onChange={setWho} options={[
            { value: "walkin", label: "Phone / walk-in", icon: <UserPlus size={13} /> },
            { value: "account", label: "Has an account", icon: <UserRound size={13} /> },
          ]} />
          {who === "walkin" ? (
            <div className="grid sm:grid-cols-2 gap-2">
              <input aria-label="Customer name" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Customer name" maxLength={80} />
              <input aria-label="Contact number" value={contact} onChange={(e) => setContact(e.target.value.replace(/[^\d+]/g, "").slice(0, 13))} className={inputCls} placeholder="Contact no. (09…)" inputMode="tel" />
            </div>
          ) : (
            <select aria-label="Customer account" value={customerId} onChange={(e) => setCustomerId(e.target.value)} className={inputCls}>
              <option value="">Choose a customer…</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.username}{c.contact ? ` — ${c.contact}` : ""}</option>)}
            </select>
          )}
        </Section>

        <Section n={2} title="Products">
          <div className="flex gap-2">
            <select aria-label="Product to add" value={pick} onChange={(e) => setPick(e.target.value)} className={inputCls}>
              <option value="">Choose a product…</option>
              {byCategory.map(([cat, items]) => (
                <optgroup key={cat} label={cat}>
                  {items.map((p) => (
                    <option key={p.id} value={p.id} disabled={p.stock <= 0 || lines.some((l) => l.productId === p.id)}>
                      {p.name} — {peso(p.price)}/{p.unit} · {p.stock > 0 ? `${p.stock} in stock` : "out of stock"}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <Button type="button" onClick={addLine} disabled={!pick} icon={<Plus size={ICON_SIZE.sm} />}>Add</Button>
          </div>
          {lines.length === 0 ? (
            <p className="text-xs text-gray-400 py-3 text-center border border-dashed border-gray-200 rounded-xl">No products yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100 border border-gray-200 rounded-xl">
              {lines.map((l, i) => {
                const p = productOf(l.productId);
                if (!p) return null;
                return (
                  <li key={l.productId} className="flex flex-wrap items-center gap-2 px-3 py-2">
                    <div className="flex-1 min-w-[140px]">
                      <p className="text-sm font-medium text-gray-900">{p.name}</p>
                      <p className="text-[11px] text-gray-400">{peso(p.price)} per {p.unit}</p>
                      {lineError[i] && <p className="text-[11px]" style={{ color: "var(--bad)" }}>{lineError[i]}</p>}
                    </div>
                    <div className="relative w-28">
                      <input aria-label={`Quantity of ${p.name}`} type="number" min="0" step={p.unit === "kg" ? "0.25" : "1"} value={l.quantity}
                        onChange={(e) => setLines((ls) => ls.map((x) => (x.productId === l.productId ? { ...x, quantity: e.target.value } : x)))}
                        className={`${inputCls} pr-10`} />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-gray-400 pointer-events-none">{p.unit}</span>
                    </div>
                    <span className="w-24 text-right text-sm font-semibold text-gray-900 num">{peso(p.price * (Number(l.quantity) || 0))}</span>
                    <button type="button" onClick={() => setLines((ls) => ls.filter((x) => x.productId !== l.productId))} aria-label={`Remove ${p.name}`}
                      className="w-8 h-8 flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50"><Trash2 size={ICON_SIZE.sm} /></button>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <Section n={3} title="Pickup or delivery">
          <Segmented value={mode} onChange={setMode} options={[
            { value: "pickup", label: "Pickup at store", icon: <Store size={13} /> },
            { value: "delivery", label: "Delivery", icon: <Truck size={13} /> },
          ]} />
          {mode === "delivery" && (
            <div className="space-y-2">
              <LocationPicker value={location} onChange={setLocation} />
              {location && delivery.loading && <p className="rounded-lg px-3 py-2 text-xs text-gray-500 animate-pulse" style={{ background: "var(--bg-muted)" }}>Checking the road distance…</p>}
              {location && !delivery.loading && delivery.error && <p className="rounded-lg px-3 py-2 text-xs" style={{ background: "var(--bad-soft)", color: "var(--bad)" }}>{delivery.error}</p>}
              {quote && delivery.settings && (
                <div className="rounded-lg px-3 py-2 text-xs flex justify-between gap-3" style={{ background: quote.tooFar ? "var(--bad-soft)" : "var(--info-soft)" }}>
                  <span className="text-gray-600">{quote.tooFar ? `About ${quote.roadKm.toFixed(0)} km — beyond the ${delivery.settings.maxKm} km delivery area` : describeQuote(quote, delivery.settings)}</span>
                  <span className="font-bold text-gray-900 num whitespace-nowrap">{quote.fee === 0 ? "Free" : peso(quote.fee)}</span>
                </div>
              )}
            </div>
          )}
        </Section>

        <Section n={4} title="Payment">
          <Segmented value={payment} onChange={setPayment} options={[
            { value: "Cash", label: mode === "delivery" ? "Cash on delivery" : "Cash", icon: <Banknote size={13} /> },
            { value: "GCash", label: "GCash", icon: <Smartphone size={13} /> },
          ]} />
          {payment === "GCash" && (
            <div className="space-y-1.5">
              <div className="grid sm:grid-cols-2 gap-2">
                <input aria-label="GCash number paid from" value={gcashNumber} onChange={(e) => setGcashNumber(e.target.value.replace(/\D/g, "").slice(0, 11))} className={inputCls} placeholder="Paid from (09…)" inputMode="numeric" />
                <input aria-label="GCash reference number" value={gcashReference} onChange={(e) => setGcashReference(e.target.value.replace(/\D/g, "").slice(0, 13))} className={inputCls} placeholder="13-digit Ref. No." inputMode="numeric" />
              </div>
              <p className="text-[11px] text-gray-400">Leave blank if the customer hasn&apos;t sent it yet. It stays &ldquo;not verified&rdquo; until you check it.</p>
            </div>
          )}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-gray-600">Paid now</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 rounded-xl border border-gray-200 p-1" role="group" aria-label="Amount paid now">
              {PAY_NOW_OPTIONS.map((o) => (
                <button key={o.value} type="button" onClick={() => setPayNow(o.value)} aria-pressed={payNow === o.value}
                  className="rounded-lg py-2 px-1 text-xs font-semibold transition leading-tight"
                  style={payNow === o.value ? { background: "var(--brand)", color: "#fff" } : { color: "var(--text-muted)" }}>
                  {o.label}
                  {o.value !== "other" && total > 0 && <span className="block text-[10.5px] font-normal opacity-80 num">{peso(payNowAmount(o.value, total, "") ?? 0)}</span>}
                </button>
              ))}
            </div>
            {payNow === "other" && (
              <div className="relative w-40">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">₱</span>
                <input aria-label="Amount paid now" type="number" min="0" step="0.01" value={payOther} onChange={(e) => setPayOther(e.target.value)} className={`${inputCls} pl-7`} placeholder="0.00" />
              </div>
            )}
            {paidNow != null && total > 0 && !payOtherInvalid && (
              <p className="text-[11px] text-gray-500">
                {paidNow >= total ? "Paid in full." : paidNow > 0
                  ? <>Downpayment {peso(paidNow)} · <b className="text-gray-700">{peso(total - paidNow)}</b> left to collect {mode === "delivery" ? "on delivery" : "at pickup"}.</>
                  : <>Nothing paid yet · the full {peso(total)} is collected {mode === "delivery" ? "on delivery" : "at pickup"}.</>}
              </p>
            )}
            {payOtherInvalid && payOther !== "" && <p className="text-[11px]" style={{ color: "var(--bad)" }}>Enter an amount from ₱0 to {peso(total)}.</p>}
          </div>
        </Section>

        {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
      </div>
    </Modal>
  );
}
