"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Banknote, CheckCircle2, ClipboardCheck, Home, MapPin, MapPinPlus, PackageCheck, ShoppingCart, Smartphone,
  StickyNote, Store, Trash2, Truck, UserRound,
} from "lucide-react";
import Drawer from "@/components/ui/Drawer";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import LocationPicker, { type PickedLocation } from "@/components/LocationPicker";
import CartQty from "@/components/shop/CartQty";
import GcashPayFields, { EMPTY_GCASH, gcashProblem, type GcashDraft } from "@/components/payments/GcashPayFields";
import { useDeliveryQuote } from "@/lib/useDeliveryQuote";
import { describeQuote } from "@/lib/deliveryFee";
import { useSettings } from "@/lib/useSettings";
import { useToast } from "@/components/ui/ToastProvider";
import { limitPhoneInput } from "@/lib/validation";
import { cancellationFee } from "@/lib/settings-schema";

export type CartLine = { id: number; name: string; unit: string; price: number; stock: number; image: string | null; quantity: number };
type Saved = { id: number; label: string; address: string; latitude: number; longitude: number; notes: string | null; recipientName: string | null; recipientContact: string | null };

const round2 = (n: number) => Math.round(n * 100) / 100;
const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const stepFor = (unit: string) => (unit === "kg" ? 0.25 : 1);
const FIELD = "h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink placeholder:text-ink-4 shadow-[0_1px_2px_rgba(16,24,64,0.04)] transition focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10";

function Choice({ on, onClick, icon, title, sub, disabled }: { on: boolean; onClick: () => void; icon: React.ReactNode; title: string; sub?: string; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={on}
      className={`flex w-full items-start gap-2.5 rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${on ? "border-brand bg-brand-soft ring-2 ring-brand/15" : "border-line bg-surface hover:border-brand/40"}`}>
      <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${on ? "bg-brand text-white" : "bg-recess text-ink-3"}`}>{icon}</span>
      <span className="min-w-0">
        <span className="block text-[13.5px] font-semibold text-ink">{title}</span>
        {sub && <span className="block text-[11.5px] leading-snug text-ink-3">{sub}</span>}
      </span>
    </button>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2.5">
      <h3 className="flex items-center gap-2 text-[13.5px] font-bold text-ink">
        <span className="grid size-6 place-items-center rounded-lg bg-brand-soft text-[12px] font-bold text-brand-ink">{n}</span>{title}
      </h3>
      {children}
    </section>
  );
}

/**
 * The cart and checkout for customers: items, how to get the order (delivery
 * to home / a saved place / somewhere else, or pickup), who receives it, how to
 * pay (cash, full GCash, or a GCash downpayment with the receipt), and the
 * store's refund policy. Every rule comes from the admin's Settings.
 */
export default function CartCheckout({ open, onClose, cart, setCart, onPlaced }: {
  open: boolean;
  onClose: () => void;
  cart: CartLine[];
  setCart: (fn: (prev: CartLine[]) => CartLine[]) => void;
  onPlaced: () => void;
}) {
  const s = useSettings();
  const showToast = useToast();
  const [home, setHome] = useState<PickedLocation | null>(null);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [mode, setMode] = useState<"delivery" | "pickup" | null>(null);
  const [dest, setDest] = useState<string>("home");
  const [otherLoc, setOtherLoc] = useState<PickedLocation | null>(null);
  const [saveOther, setSaveOther] = useState(false);
  const [saveLabel, setSaveLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [someoneElse, setSomeoneElse] = useState(false);
  const [rName, setRName] = useState("");
  const [rContact, setRContact] = useState("");
  const [method, setMethod] = useState<"Cash" | "GCash" | null>(null);
  const [plan, setPlan] = useState<"full" | "down">("full");
  const [gcash, setGcash] = useState<GcashDraft>(EMPTY_GCASH);
  const [agree, setAgree] = useState(false);
  const [review, setReview] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState("");
  const [placed, setPlaced] = useState<{ id: number; gcash: boolean; balance: number } | null>(null);
  const [store, setStore] = useState<{ lat: number; lng: number; name: string } | null>(null);

  useEffect(() => {
    let live = true;
    fetch("/api/store-location").then((r) => (r.ok ? r.json() : null)).then((d) => { if (live && d) setStore(d); }).catch(() => {});
    Promise.all([fetch("/api/account"), fetch("/api/account/addresses")]).then(async ([a, b]) => {
      if (!live) return;
      if (a.ok) {
        const d = await a.json();
        if (d.defaultLat != null && d.defaultLng != null) setHome({ address: d.defaultAddress ?? "Home", lat: d.defaultLat, lng: d.defaultLng });
      }
      if (b.ok) setSaved(await b.json());
    }).catch(() => {});
    return () => { live = false; };
  }, []);

  // Choices default to what the store offers.
  const fulfil = mode ?? (s.deliveryEnabled ? "delivery" : "pickup");
  const pay = method ?? (s.codEnabled ? "Cash" : "GCash");

  const savedPick = dest.startsWith("saved-") ? saved.find((x) => `saved-${x.id}` === dest) ?? null : null;
  const location: PickedLocation | null = fulfil !== "delivery" ? null
    : dest === "home" ? home
    : savedPick ? { address: savedPick.address, lat: savedPick.latitude, lng: savedPick.longitude }
    : otherLoc;

  const subtotal = round2(cart.reduce((t, i) => t + i.price * i.quantity, 0));
  const delivery = useDeliveryQuote(fulfil === "delivery" ? location : null);
  const quote = fulfil === "delivery" ? delivery.quote : null;
  const fee = quote && !quote.tooFar ? quote.fee : 0;
  const total = round2(subtotal + fee);

  const belowMin = fulfil === "delivery" && s.deliveryMinOrder > 0 && subtotal < s.deliveryMinOrder;
  const needsDown = pay === "Cash" && s.requireDownpaymentOver > 0 && total > s.requireDownpaymentOver;
  const usesGcash = pay === "GCash" || needsDown;
  const minDown = Math.min(total, Math.ceil((total * s.minDownpaymentPct) / 100));
  const canSplit = s.minDownpaymentPct < 100;
  const minSend = pay === "GCash" && plan === "full" ? total : minDown;
  const sendAmount = Number(gcash.amount) || 0;
  const balanceAfter = usesGcash ? round2(Math.max(0, total - sendAmount)) : total;
  const receiverName = someoneElse ? rName.trim() : savedPick?.recipientName ?? "";
  const receiverContact = someoneElse ? rContact : savedPick?.recipientContact ?? "";
  const fullPayAuto = pay === "GCash" && plan === "full";

  // Keep the amount in step with "Pay in full".
  const gcashForCheck = fullPayAuto ? { ...gcash, amount: String(total) } : gcash;
  const payIssue = usesGcash ? gcashProblem(gcashForCheck, minSend, total) : null;

  // Everything still missing before the order can be reviewed, in the order it appears.
  const blockers: string[] = (() => {
    const b: string[] = [];
    if (!cart.length) b.push("Your cart is empty.");
    if (!s.deliveryEnabled && !s.pickupEnabled) b.push("The store isn't taking online orders right now.");
    if (belowMin) b.push(`Delivery needs at least ${peso(s.deliveryMinOrder)} of items. Add more, or choose pickup.`);
    if (fulfil === "delivery") {
      if (!location) b.push(dest === "home" ? "Pin your home address (in Settings → Addresses), or choose another place." : "Pin where we should deliver.");
      else if (delivery.loading) b.push("Working out the delivery fee…");
      else if (!quote) b.push(delivery.error ?? "Couldn't work out the delivery fee for that spot. Move the pin and try again.");
      else if (quote.tooFar) b.push("That place is beyond the delivery area. Choose pickup instead.");
      if (someoneElse && !rName.trim()) b.push("Enter the receiver's name.");
      if (someoneElse && rContact.replace(/\D/g, "").length !== 11) b.push("Enter the receiver's 11-digit mobile number.");
      if (dest === "other" && saveOther && !saveLabel.trim()) b.push("Name the place you're saving (e.g. Work).");
    }
    if (pay === "Cash" && !s.codEnabled) b.push("Cash isn't accepted right now. Choose GCash.");
    if (pay === "GCash" && !s.gcashEnabled) b.push("GCash isn't available right now. Choose cash.");
    if (usesGcash && payIssue) b.push(payIssue);
    if (!agree) b.push("Read and agree to the cancellation and refund policy.");
    return b;
  })();

  const cancelRule = s.customerCancelUntil === "pending" ? "until the store confirms your order" : "until your order leaves the store";
  const feeAfterConfirm = cancellationFee(100, s) > 0
    ? (s.cancelFeeType === "fixed" ? `${peso(s.cancelFeeValue)} is kept` : `${s.cancelFeeValue}% of what you paid is kept`)
    : null;

  async function place() {
    setError(""); setPlacing(true);
    const body = {
      items: cart.map((i) => ({ productId: i.id, quantity: i.quantity })),
      fulfillmentMode: fulfil,
      paymentMethod: pay,
      ...(fulfil === "delivery" && location ? { deliveryAddress: location.address, latitude: location.lat, longitude: location.lng } : {}),
      ...(fulfil === "delivery" ? {
        deliveryNotes: notes.trim() || savedPick?.notes || undefined,
        recipientName: receiverName || undefined,
        recipientContact: receiverContact || undefined,
      } : {}),
      ...(usesGcash ? { payment: { amount: fullPayAuto ? total : Number(gcash.amount), reference: gcash.reference, accountNumber: gcash.accountNumber, proofImage: gcash.proofImage } } : {}),
    };
    const res = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setPlacing(false); setError(d.error ?? "Couldn't place your order. Nothing was charged by the store. Try again."); return; }

    if (fulfil === "delivery" && dest === "other" && saveOther && otherLoc) {
      const r = await fetch("/api/account/addresses", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: saveLabel, address: otherLoc.address, latitude: otherLoc.lat, longitude: otherLoc.lng, notes, recipientName: receiverName, recipientContact: receiverContact }),
      }).catch(() => null);
      if (!r?.ok) showToast("Your order is placed, but the address couldn't be saved. Add it in Settings → Addresses.", "warning");
    }
    setPlacing(false);
    setReview(false);
    setPlaced({ id: d.id, gcash: usesGcash, balance: usesGcash ? balanceAfter : total });
    setCart(() => []);
    setGcash(EMPTY_GCASH); setAgree(false); setNotes(""); setSomeoneElse(false); setRName(""); setRContact(""); setSaveOther(false); setSaveLabel(""); setDest("home");
    showToast(`Order #${d.id} placed.`);
    onPlaced();
  }

  const destOptions = [
    { key: "home", label: "Home", sub: home?.address ?? "Not pinned yet", icon: <Home className="size-4" /> },
    ...saved.map((x) => ({ key: `saved-${x.id}`, label: x.label, sub: x.address, icon: <MapPin className="size-4" /> })),
    { key: "other", label: "Somewhere else", sub: "Pin a new place on the map", icon: <MapPinPlus className="size-4" /> },
  ];

  return (
    <>
      <Drawer open={open} onClose={onClose} placement="center" width="lg"
        title={<><ShoppingCart className="size-4 text-brand" /> <span>Your cart</span></>}
        footer={cart.length > 0 ? (
          <div className="space-y-3 p-5">
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-ink-3"><span>Items</span><span className="num">{peso(subtotal)}</span></div>
              {fulfil === "delivery" && (
                <div className="flex justify-between text-ink-3"><span>Delivery fee</span>
                  <span className="num">{quote ? (quote.tooFar ? "Too far" : quote.fee === 0 ? "Free" : peso(quote.fee)) : location && delivery.loading ? "Checking…" : "Pin the place"}</span>
                </div>
              )}
              <div className="flex justify-between pt-1 font-bold text-ink"><span>Total</span><span className="num text-lg">{peso(total)}</span></div>
              {usesGcash && sendAmount > 0 && balanceAfter > 0 && (
                <p className="text-right text-[12px] text-warn">Paying {peso(sendAmount)} now · {peso(balanceAfter)} later</p>
              )}
            </div>
            {blockers.length > 0 && <p className="text-[12px] text-ink-3"><span className="font-semibold text-warn">Before you review:</span> {blockers[0]}</p>}
            <Button onClick={() => { setError(""); setReview(true); }} disabled={blockers.length > 0} className="w-full" size="lg" icon={<ClipboardCheck className="size-4" />}>
              Review order
            </Button>
          </div>
        ) : undefined}>
        <div className="space-y-6 p-5">
          {/* Items */}
          {cart.length === 0 ? (
            <div className="py-12 text-center text-ink-4">
              <ShoppingCart className="mx-auto mb-3 size-10 opacity-25" />
              <p className="text-sm font-semibold text-ink-3">Your cart is empty</p>
              <p className="mt-1 text-[12.5px]">Add products from the shop, then come back here to check out.</p>
            </div>
          ) : (
            <Step n={1} title={`Items (${cart.length})`}>
              <ul className="space-y-3">
                {cart.map((i) => (
                  <li key={i.id} className="flex items-start gap-3">
                    {i.image ? <Image src={i.image} alt={i.name} width={40} height={40} className="size-10 shrink-0 rounded-xl border border-line object-cover" />
                      : <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-sm font-bold text-brand">{i.name.charAt(0)}</div>}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{i.name}</p>
                      <p className="text-xs text-ink-4">{peso(i.price)} / {i.unit} · <span className="num font-semibold text-ink-2">{peso(i.price * i.quantity)}</span></p>
                    </div>
                    <CartQty name={i.name} quantity={i.quantity} unit={i.unit} step={stepFor(i.unit)} max={i.stock}
                      onChange={(q) => setCart((prev) => prev.map((c) => (c.id === i.id ? { ...c, quantity: q } : c)))} />
                    <button type="button" onClick={() => { setCart((prev) => prev.filter((c) => c.id !== i.id)); showToast(`${i.name} removed from your cart.`, "info"); }} aria-label={`Remove ${i.name}`}
                      className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-[11.5px] font-semibold text-bad transition hover:bg-bad-soft"><Trash2 className="size-3.5" /> Remove</button>
                  </li>
                ))}
              </ul>
            </Step>
          )}

          {cart.length > 0 && (
            <>
              {/* How to get it */}
              <Step n={2} title="How do you want to get it?">
                {!s.deliveryEnabled && !s.pickupEnabled ? (
                  <Alert tone="warn" compact>The store isn&apos;t taking online orders right now. Please call the store.</Alert>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Choice on={fulfil === "delivery"} onClick={() => setMode("delivery")} disabled={!s.deliveryEnabled} icon={<Truck className="size-4" />}
                      title="Delivery" sub={s.deliveryEnabled ? "A driver brings it to you" : "Not available right now"} />
                    <Choice on={fulfil === "pickup"} onClick={() => setMode("pickup")} disabled={!s.pickupEnabled} icon={<Store className="size-4" />}
                      title="Pickup at the store" sub={s.pickupEnabled ? s.storeHours : "Not available right now"} />
                  </div>
                )}
                {belowMin && <Alert tone="warn" compact>Delivery needs at least {peso(s.deliveryMinOrder)} of items (you have {peso(subtotal)}). Add more, or choose pickup.</Alert>}

                {fulfil === "pickup" && (
                  <Alert tone="info" compact title={s.storeName}>
                    Pick it up at {s.storeAddress}{s.storeHours ? ` (${s.storeHours})` : ""}. We&apos;ll notify you when it&apos;s ready — please wait for that before going.
                  </Alert>
                )}

                {fulfil === "delivery" && (
                  <div className="space-y-3">
                    <p className="text-[12.5px] font-semibold text-ink-2">Deliver to</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {destOptions.map((o) => (
                        <Choice key={o.key} on={dest === o.key} onClick={() => setDest(o.key)} icon={o.icon} title={o.label} sub={o.sub} />
                      ))}
                    </div>
                    {dest === "home" && !home && (
                      <Alert tone="warn" compact action={<Link href="/settings?tab=addresses" className="text-[12px] font-bold text-brand hover:underline">Pin home</Link>}>
                        Your home isn&apos;t pinned yet. Pin it in Settings, or choose &ldquo;Somewhere else&rdquo;.
                      </Alert>
                    )}
                    {/* The map always shows the store and the drop-off, with the distance between them */}
                    {dest !== "other" && location && (
                      <div className="space-y-1">
                        <LocationPicker value={location} store={store} distance={quote && !quote.tooFar ? { km: quote.roadKm, minutes: quote.minutes } : null}
                          onChange={(v) => { setOtherLoc(v); setDest("other"); }} />
                        <p className="text-[11px] text-ink-4">Moving the pin delivers to that spot instead (&ldquo;Somewhere else&rdquo;).</p>
                      </div>
                    )}
                    {dest === "other" && (
                      <div className="space-y-2">
                        <LocationPicker value={otherLoc} onChange={setOtherLoc} store={store} distance={quote && !quote.tooFar ? { km: quote.roadKm, minutes: quote.minutes } : null} />
                        <label className="flex items-center gap-2 text-[12.5px] text-ink-2">
                          <input type="checkbox" checked={saveOther} onChange={(e) => setSaveOther(e.target.checked)} />
                          Save this place for next time
                        </label>
                        {saveOther && <input value={saveLabel} onChange={(e) => setSaveLabel(e.target.value)} maxLength={40} className={FIELD} placeholder="Name it, e.g. Work or Nanay's house" />}
                      </div>
                    )}
                    {location && delivery.loading && <p className="animate-pulse rounded-lg bg-recess px-3 py-2 text-xs text-ink-3">Checking the road distance…</p>}
                    {location && !delivery.loading && delivery.error && <Alert tone="bad" compact>{delivery.error}</Alert>}
                    {quote && !quote.tooFar && (
                      <div className="grid grid-cols-3 divide-x divide-line overflow-hidden rounded-xl border border-line bg-surface text-center">
                        <div className="px-2 py-2.5"><p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-4">Distance</p><p className="num font-display text-[17px] font-extrabold text-ink">{quote.roadKm.toFixed(1)} km</p></div>
                        <div className="px-2 py-2.5"><p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-4">Drive</p><p className="num font-display text-[17px] font-extrabold text-ink">{quote.minutes != null ? `~${quote.minutes} min` : "—"}</p></div>
                        <div className="px-2 py-2.5"><p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-4">Delivery fee</p><p className="num font-display text-[17px] font-extrabold text-brand">{quote.fee === 0 ? "Free" : peso(quote.fee)}</p></div>
                      </div>
                    )}
                    {quote && delivery.settings && (
                      <div className={`flex justify-between gap-3 rounded-lg px-3 py-2 text-xs ${quote.tooFar ? "bg-bad-soft" : "bg-info-soft"}`}>
                        <span className="text-ink-2">
                          {quote.tooFar ? `About ${quote.roadKm.toFixed(0)} km away — beyond the ${delivery.settings.maxKm} km delivery area. Choose pickup instead.` : describeQuote(quote, delivery.settings)}
                          {!quote.tooFar && quote.minutes != null && <span className="text-ink-4"> · about {quote.minutes} min drive</span>}
                        </span>
                        {!quote.tooFar && <span className="num whitespace-nowrap font-bold text-ink">{quote.fee === 0 ? "Free" : peso(quote.fee)}</span>}
                      </div>
                    )}

                    <div>
                      <label htmlFor="co-notes" className="mb-1 flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-2"><StickyNote className="size-3.5" /> Exact spot or landmark <span className="font-normal text-ink-4">(optional)</span></label>
                      <input id="co-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={200} className={FIELD}
                        placeholder={savedPick?.notes ?? "e.g. Blue gate beside the sari-sari store, 2nd floor"} />
                    </div>

                    <div className="rounded-xl border border-line p-3">
                      <label className="flex items-start gap-2.5 text-[13px] text-ink">
                        <input type="checkbox" className="mt-0.5" checked={someoneElse} onChange={(e) => setSomeoneElse(e.target.checked)} />
                        <span><span className="font-semibold">Someone else will receive it</span>
                          <span className="block text-[11.5px] text-ink-4">{savedPick?.recipientName && !someoneElse ? `Saved receiver: ${savedPick.recipientName}${savedPick.recipientContact ? ` · ${savedPick.recipientContact}` : ""}` : "The driver calls them when they arrive."}</span></span>
                      </label>
                      {someoneElse && (
                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          <div className="relative">
                            <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-4" />
                            <input aria-label="Receiver's name" value={rName} onChange={(e) => setRName(e.target.value)} maxLength={80} className={`${FIELD} pl-9`} placeholder="Receiver's name" />
                          </div>
                          <input aria-label="Receiver's mobile number" inputMode="numeric" value={rContact} onChange={(e) => setRContact(limitPhoneInput(e.target.value))} maxLength={13} className={`${FIELD} num`} placeholder="Receiver's number (09…)" />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </Step>

              {/* How to pay */}
              <Step n={3} title="How will you pay?">
                <div className="grid gap-2 sm:grid-cols-2">
                  <Choice on={pay === "Cash"} onClick={() => setMethod("Cash")} disabled={!s.codEnabled} icon={<Banknote className="size-4" />}
                    title={fulfil === "delivery" ? "Cash on delivery" : "Cash at pickup"} sub={s.codEnabled ? (fulfil === "delivery" ? "Pay the driver when it arrives" : "Pay at the counter") : "Not accepted right now"} />
                  <Choice on={pay === "GCash"} onClick={() => setMethod("GCash")} disabled={!s.gcashEnabled} icon={<Smartphone className="size-4" />}
                    title="GCash" sub={s.gcashEnabled ? (canSplit ? `Pay in full, or ${s.minDownpaymentPct}% down first` : "Pay the full amount now") : "Not available right now"} />
                </div>

                {pay === "Cash" && !needsDown && (
                  <Alert tone="info" compact>
                    Pay {peso(total)} in cash {fulfil === "delivery" ? "to the driver when your order arrives" : "at the counter when you pick it up"}. The store confirms your order first, and you&apos;ll get a notification at each step.
                  </Alert>
                )}
                {needsDown && (
                  <Alert tone="warn" compact title="A GCash downpayment is needed first">
                    Orders over {peso(s.requireDownpaymentOver)} need a GCash downpayment of at least {peso(minDown)} before the store prepares them. The rest is paid in cash {fulfil === "delivery" ? "on delivery" : "at pickup"}.
                  </Alert>
                )}

                {pay === "GCash" && canSplit && (
                  <div className="grid grid-cols-2 gap-1 rounded-xl bg-recess p-1" role="radiogroup" aria-label="How much to pay now">
                    {([["full", `Pay in full · ${peso(total)}`], ["down", `Downpayment · from ${peso(minDown)}`]] as const).map(([k, label]) => (
                      <button key={k} type="button" role="radio" aria-checked={plan === k} onClick={() => setPlan(k)}
                        className={`rounded-lg px-2 py-2 text-[12.5px] font-semibold transition ${plan === k ? "bg-surface text-brand-ink shadow-[0_1px_3px_rgba(16,24,64,0.14)] ring-1 ring-brand/25" : "text-ink-3 hover:text-ink"}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                )}

                {usesGcash && (
                  <GcashPayFields value={fullPayAuto ? { ...gcash, amount: String(total) } : gcash}
                    onChange={(v) => setGcash(fullPayAuto ? { ...v, amount: "" } : v)}
                    payTo={fullPayAuto ? total : Math.max(minDown, sendAmount || minDown)}
                    amountHint={fullPayAuto ? "The full total." : `At least ${peso(minDown)} (${s.minDownpaymentPct}%), up to ${peso(total)}.`} />
                )}

                {usesGcash && (
                  <Alert tone="info" compact title="What happens after you order">
                    The store checks your GCash receipt{s.prepareAfterDownpayment ? " before preparing your order" : ""}. You&apos;ll get a notification when it&apos;s approved — or, if something doesn&apos;t match, what to fix.
                    {balanceAfter > 0 && sendAmount > 0 && (
                      <> The remaining <b>{peso(balanceAfter)}</b> is due within {s.balanceDueDays} {s.balanceDueDays === 1 ? "day" : "days"} after your downpayment is approved{s.allowBalanceOnDelivery ? `, by GCash from My Orders or in cash ${fulfil === "delivery" ? "on delivery" : "at pickup"}` : ", by GCash from My Orders, before your order goes out"}.</>
                    )}
                  </Alert>
                )}
              </Step>

              {/* Policy */}
              <Step n={4} title="Cancellation and refunds">
                <div className="rounded-xl border border-line bg-subtle p-3.5 text-[12.5px] leading-relaxed text-ink-2">
                  <p className="whitespace-pre-line">{s.refundPolicy}</p>
                  <ul className="mt-2 space-y-0.5 text-ink-3">
                    <li>• You can cancel from My Orders {cancelRule}.</li>
                    <li>• Cancelling before the store confirms: full refund.{feeAfterConfirm && s.customerCancelUntil === "confirmed" ? ` After it confirms: ${feeAfterConfirm}.` : ""}</li>
                    <li>• If the store cancels your order, you get everything back.</li>
                  </ul>
                </div>
                <label className="flex items-start gap-2.5 text-[13px] font-medium text-ink">
                  <input type="checkbox" className="mt-0.5" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                  I&apos;ve read and agree to the cancellation and refund policy.
                </label>
              </Step>
            </>
          )}
        </div>
      </Drawer>

      {/* Review */}
      <Modal open={review} onClose={() => !placing && setReview(false)} title="Review your order" icon={<ClipboardCheck className="size-5" />}
        description="Check everything once more. You can still go back and change it." size="md"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setReview(false)} disabled={placing}>Back to cart</Button>
            <Button className="flex-1" onClick={place} loading={placing} icon={<PackageCheck className="size-4" />}>Place order</Button>
          </div>
        }>
        <div className="space-y-4 text-[13px]">
          <ul className="max-h-48 space-y-1.5 overflow-y-auto">
            {cart.map((i) => (
              <li key={i.id} className="flex justify-between gap-3"><span className="text-ink-2">{i.name} <span className="text-ink-4">× {i.quantity} {i.unit}</span></span><span className="num font-medium text-ink">{peso(i.price * i.quantity)}</span></li>
            ))}
          </ul>
          <div className="space-y-1 border-t border-dashed border-line pt-3">
            <div className="flex justify-between text-ink-3"><span>Items</span><span className="num">{peso(subtotal)}</span></div>
            {fulfil === "delivery" && <div className="flex justify-between text-ink-3"><span>Delivery fee</span><span className="num">{fee === 0 ? "Free" : peso(fee)}</span></div>}
            <div className="flex justify-between text-[15px] font-bold text-ink"><span>Total</span><span className="num">{peso(total)}</span></div>
          </div>
          <div className="space-y-1.5 rounded-xl bg-subtle p-3 text-ink-2">
            <p className="flex items-start gap-2">{fulfil === "delivery" ? <Truck className="mt-0.5 size-4 shrink-0 text-ink-4" /> : <Store className="mt-0.5 size-4 shrink-0 text-ink-4" />}
              <span>{fulfil === "delivery" ? <>Delivery to <b className="text-ink">{location?.address}</b></> : <>Pickup at {s.storeName}</>}</span></p>
            {fulfil === "delivery" && (notes.trim() || savedPick?.notes) && <p className="flex items-start gap-2"><StickyNote className="mt-0.5 size-4 shrink-0 text-ink-4" /> {notes.trim() || savedPick?.notes}</p>}
            {fulfil === "delivery" && receiverName && <p className="flex items-start gap-2"><UserRound className="mt-0.5 size-4 shrink-0 text-ink-4" /> Receiver: {receiverName}{receiverContact ? ` · ${receiverContact}` : ""}</p>}
            <p className="flex items-start gap-2">{usesGcash ? <Smartphone className="mt-0.5 size-4 shrink-0 text-ink-4" /> : <Banknote className="mt-0.5 size-4 shrink-0 text-ink-4" />}
              <span>{usesGcash
                ? <>GCash {peso(fullPayAuto ? total : sendAmount)} · Ref <span className="num">{gcash.reference}</span>{balanceAfter > 0 ? <> · <b className="text-warn">{peso(balanceAfter)} left to pay</b></> : null}</>
                : <>Cash {fulfil === "delivery" ? "on delivery" : "at pickup"} · {peso(total)}</>}</span></p>
          </div>
          <div>
            <p className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.08em] text-ink-4">What happens next</p>
            <ol className="space-y-1.5 text-ink-2">
              <li className="flex gap-2"><span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand-soft text-[11px] font-bold text-brand-ink">1</span>{usesGcash ? "The store checks your GCash receipt, then confirms the order." : "The store confirms your order."}</li>
              <li className="flex gap-2"><span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand-soft text-[11px] font-bold text-brand-ink">2</span>Your items are prepared.</li>
              <li className="flex gap-2"><span className="grid size-5 shrink-0 place-items-center rounded-full bg-brand-soft text-[11px] font-bold text-brand-ink">3</span>{fulfil === "delivery" ? "A driver brings it to you" : "We tell you it's ready for pickup"}. You get a notification at every step.</li>
            </ol>
          </div>
          {error && <Alert tone="bad" compact>{error}</Alert>}
        </div>
      </Modal>

      {/* Placed */}
      <Modal open={!!placed} onClose={() => setPlaced(null)} title={placed ? `Order #${placed.id} placed` : ""} icon={<CheckCircle2 className="size-5" />}
        description="Thank you! Here's what happens now." size="sm"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setPlaced(null)}>Keep shopping</Button>
            <Link href="/orders" className="inline-flex h-10 flex-1 items-center justify-center rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:brightness-110">View my orders</Link>
          </div>
        }>
        {placed && (
          <div className="space-y-3 text-[13px] text-ink-2">
            {placed.gcash
              ? <Alert tone="info" compact>The store is checking your GCash receipt. You&apos;ll get a notification when it&apos;s approved.</Alert>
              : <Alert tone="info" compact>The store will confirm your order soon. You&apos;ll get a notification when it does.</Alert>}
            {placed.balance > 0 && placed.gcash && (
              <Alert tone="warn" compact>You still owe {peso(placed.balance)}. Pay it from My Orders within {s.balanceDueDays} {s.balanceDueDays === 1 ? "day" : "days"} after your downpayment is approved{s.allowBalanceOnDelivery ? ", or in cash when you receive the order" : ""}.</Alert>
            )}
            <p>You can follow your order, pay a balance, or cancel (while it&apos;s still allowed) from <b className="text-ink">My Orders</b>.</p>
          </div>
        )}
      </Modal>
    </>
  );
}
