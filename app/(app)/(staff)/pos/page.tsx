"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { ShoppingCart, Trash2, Clock, Package, PackageSearch, Minus, Plus, Banknote, Smartphone, CreditCard, Receipt as ReceiptIcon, ScanLine } from "lucide-react";
import Drawer from "@/components/ui/Drawer";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useToast } from "@/components/ui/ToastProvider";
import ProductThumb from "@/components/catalog/ProductThumb";
import CatalogToolbar, { type SortKey } from "@/components/catalog/CatalogToolbar";
import { fmtQty, peso, stockState } from "@/lib/catalog-ui";
import { filterProducts } from "@/lib/useCatalog";

import { customerLabel } from "@/lib/customer";
import ReceiptModal, { type ReceiptData } from "@/components/receipts/Receipt";
type Category = { id: number; name: string };
type Product = { brand?: string | null; id: number; name: string; categoryId: number; category: Category; subcategory: string | null; price: number; unit: string; stock: number; image: string | null; description: string | null };
// `orderQty` is how much of the line came from a customer's online order (stock already reserved).
type CartItem = Product & { quantity: number; fromOrder?: boolean; orderQty?: number };
type OItem = { id: number; quantity: number; price: number; product: { name: string }; productId: number };
type Order = { id: number; totalAmount: number; status: string; dateTime: string; customer: { username: string } | null; customerName?: string | null; customerContact?: string | null; items: OItem[] };
type PendingEntry = { orderId: number; customer: string; quantity: number; orderItemId: number; totalItems: number };
type ActiveTab = "products" | "orders";

const round2 = (n: number) => Math.round(n * 100) / 100;
const stepFor = (unit: string) => (unit === "kg" ? 0.25 : 1);
const KG_PRESETS: { label: string; value: number }[] = [
  { label: "¼", value: 0.25 },
  { label: "½", value: 0.5 },
  { label: "1 kg", value: 1 },
];
const PAYMENTS = [
  { value: "Cash", icon: Banknote },
  { value: "GCash", icon: Smartphone },
  { value: "Card", icon: CreditCard },
] as const;

/** The sale being rung up, like a receipt growing at the counter. Shown beside the products on a desktop, in a drawer on a phone. */
function Ticket({ cart, total, count, loadedOrderIds, paymentMethod, busy, onPayment, onQty, onRemove, onClear, onCharge }: {
  cart: CartItem[]; total: number; count: number; loadedOrderIds: number[]; paymentMethod: string; busy: boolean;
  onPayment: (m: string) => void; onQty: (id: number, q: number) => void; onRemove: (id: number) => void; onClear: () => void; onCharge: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-dashed border-line-strong px-4 py-3">
        <div className="min-w-0">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-4">Current sale</p>
          <p className="font-display text-base font-extrabold text-ink">{cart.length ? `${cart.length} line${cart.length === 1 ? "" : "s"} · ${fmtQty(count)} item${count === 1 ? "" : "s"}` : "Nothing yet"}</p>
        </div>
        {cart.length > 0 && (
          <button type="button" onClick={onClear} className="rounded-lg px-2 py-1 text-xs font-semibold text-ink-4 transition hover:bg-bad-soft hover:text-bad">Clear</button>
        )}
      </div>

      {loadedOrderIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-b border-line px-4 py-2">
          {loadedOrderIds.map((id) => (
            <span key={id} className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand-ink">
              <ReceiptIcon className="size-3" /> Order #{id}
            </span>
          ))}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {cart.length === 0 ? (
          <div className="grid h-full place-items-center px-6 py-10 text-center">
            <div>
              <ScanLine className="mx-auto size-10 text-ink-4" strokeWidth={1.4} />
              <p className="mt-3 text-sm font-semibold text-ink-2">Tap a product to start a sale</p>
              <p className="mt-1 text-xs text-ink-4">Or load a customer&apos;s online order from Pending orders.</p>
            </div>
          </div>
        ) : (
          <ul className="space-y-1">
            {cart.map((i) => (
              <li key={i.id} className="rounded-xl px-2 py-2 transition hover:bg-subtle">
                <div className="flex items-start gap-2.5">
                  <ProductThumb size="row" image={i.image} name={i.name} category={i.category?.name} subcategory={i.subcategory} className="!size-9" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-ink">{i.name}</p>
                    <p className="num text-[11.5px] text-ink-4">{peso(i.price)} / {i.unit}{i.orderQty ? <span className="text-brand"> · online order</span> : null}</p>
                  </div>
                  <p className="num shrink-0 text-[13px] font-bold text-ink">{peso(i.price * i.quantity)}</p>
                </div>
                <div className="mt-1.5 flex items-center justify-between pl-[46px]">
                  <div className="flex items-center rounded-lg border border-line bg-surface">
                    <button type="button" onClick={() => onQty(i.id, i.quantity - stepFor(i.unit))} aria-label={`One less ${i.name}`}
                      className="grid size-7 place-items-center rounded-l-lg text-ink-3 transition hover:bg-recess hover:text-ink"><Minus className="size-3.5" /></button>
                    <span className="num min-w-[3.25rem] text-center text-[13px] font-semibold text-ink">{fmtQty(i.quantity)}{i.unit === "kg" ? " kg" : ""}</span>
                    <button type="button" onClick={() => onQty(i.id, i.quantity + stepFor(i.unit))} aria-label={`One more ${i.name}`}
                      className="grid size-7 place-items-center rounded-r-lg text-ink-3 transition hover:bg-recess hover:text-ink"><Plus className="size-3.5" /></button>
                  </div>
                  <button type="button" onClick={() => onRemove(i.id)} aria-label={`Remove ${i.name}`}
                    className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-[11.5px] font-semibold text-bad transition hover:bg-bad-soft"><Trash2 className="size-3" /> Remove</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-3 border-t border-dashed border-line-strong bg-subtle px-4 py-4">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold text-ink-3">Total</span>
          <span className="num font-display text-[28px] font-extrabold leading-none tracking-tight text-ink">{peso(total)}</span>
        </div>
        <div className="grid grid-cols-3 gap-1 rounded-xl border border-line bg-surface p-1" role="group" aria-label="Payment method">
          {PAYMENTS.map(({ value, icon: Icon }) => (
            <button key={value} type="button" onClick={() => onPayment(value)} aria-pressed={paymentMethod === value}
              className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg text-[13px] font-semibold transition ${
                paymentMethod === value ? "bg-brand text-white" : "text-ink-3 hover:bg-recess hover:text-ink"}`}>
              <Icon className="size-4" /> {value}
            </button>
          ))}
        </div>
        <button type="button" onClick={onCharge} disabled={!cart.length || busy}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand text-[15px] font-bold text-white shadow-[0_10px_22px_-12px_rgba(30,79,216,0.9)] transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-line-strong disabled:shadow-none">
          {busy ? "Recording the sale…" : cart.length ? <>Charge {peso(total)}</> : "Charge"}
        </button>
      </div>
    </div>
  );
}

export default function POSPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState("");
  const [catId, setCatId] = useState<number | null>(null);
  const [sub, setSub] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("name");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [saleReceipt, setSaleReceipt] = useState<ReceiptData | null>(null);
  // Online orders loaded into the cart, linked to the sale at checkout.
  const [loadedOrderIds, setLoadedOrderIds] = useState<number[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [loading, setLoading] = useState(false);
  const showToast = useToast();
  const [activeTab, setActiveTab] = useState<ActiveTab>("products");
  const [activePopover, setActivePopover] = useState<number | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const [showCheckoutConfirm, setShowCheckoutConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const fetchAll = useCallback(async () => {
    const [pRes, cRes, oRes] = await Promise.all([fetch("/api/products"), fetch("/api/categories"), fetch("/api/orders")]);
    setProducts(await pRes.json());
    setCategories(await cRes.json());
    setOrders(await oRes.json());
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setActivePopover(null); setPopoverPos(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const productOrderMap = new Map<number, PendingEntry[]>();
  for (const order of orders) {
    if (order.status !== "pending") continue;
    const totalItems = order.items.reduce((s, i) => s + i.quantity, 0);
    for (const item of order.items) {
      const existing = productOrderMap.get(item.productId) ?? [];
      existing.push({ orderId: order.id, customer: customerLabel(order), quantity: item.quantity, orderItemId: item.id, totalItems });
      productOrderMap.set(item.productId, existing);
    }
  }

  // Categories that have products, A to Z, and the chosen one's subcategories.
  const catList = categories
    .map((c) => ({ ...c, count: products.filter((p) => p.categoryId === c.id).length }))
    .filter((c) => c.count > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
  const subList = catId === null ? [] : [...new Set(products.filter((p) => p.categoryId === catId && p.subcategory).map((p) => p.subcategory as string))].sort();
  const list = filterProducts(products, { categoryId: catId, sub }, search, sort);

  function addToCart(product: Product, qty = 1, fromOrder = false) {
    if (product.stock === 0) return;
    setCart((prev) => {
      const ex = prev.find((i) => i.id === product.id);
      if (ex) {
        const newQty = round2(Math.min(ex.quantity + qty, product.stock));
        return prev.map((i) => i.id === product.id
          ? { ...i, quantity: newQty, fromOrder: ex.fromOrder || fromOrder, orderQty: round2((ex.orderQty ?? 0) + (fromOrder ? qty : 0)) }
          : i);
      }
      const quantity = round2(Math.min(qty, product.stock));
      return [...prev, { ...product, quantity, fromOrder, orderQty: fromOrder ? quantity : 0 }];
    });
  }

  function updateQty(id: number, qty: number) {
    const rounded = round2(qty);
    if (rounded <= 0) { setCart((prev) => prev.filter((i) => i.id !== id)); return; }
    const p = products.find((p) => p.id === id);
    if (p && rounded > p.stock) return;
    setCart((prev) => prev.map((i) => i.id === id ? { ...i, quantity: rounded } : i));
  }

  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const totalPending = orders.filter((o) => o.status === "pending").length;

  async function handleCheckout() {
    if (!cart.length) return;
    setLoading(true);
    const res = await fetch("/api/transactions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: cart.map((i) => ({ productId: i.id, productName: i.name, quantity: i.quantity, price: i.price, orderQuantity: i.orderQty ?? 0 })),
        paymentMethod,
        orderIds: loadedOrderIds,
      }),
    });
    setLoading(false);
    if (!res.ok) { showToast((await res.json().catch(() => ({ error: "Checkout failed" }))).error, "error"); return; }
    const sale = await res.json();
    // The receipt is built from what was just rung up, so it opens instantly.
    setSaleReceipt({
      number: `Sale #${sale.id}`,
      date: sale.dateTime ?? new Date().toISOString(),
      fulfillment: "Walk-in",
      items: cart.map((i) => ({ name: i.name, quantity: i.quantity, unit: i.unit, price: i.price })),
      total: sale.totalAmount ?? total,
      payment: [{ label: "Payment", value: paymentMethod }],
    });
    setCart([]); setLoadedOrderIds([]); setCartOpen(false); setShowCheckoutConfirm(false); showToast("Transaction completed successfully!"); fetchAll();
  }

  function handleClearCart() {
    setCart([]);
    setLoadedOrderIds([]);
    setShowClearConfirm(false);
    setCartOpen(false);
  }

  async function fulfillOrder(orderId: number, product: Product, quantity: number) {
    addToCart(product, quantity, true);
    const found = orders.find((o) => o.id === orderId);
    const customerName = found ? customerLabel(found) : "customer";
    const res = await fetch("/api/orders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: orderId, status: "confirmed" }) });
    if (!res.ok) return;
    setLoadedOrderIds((prev) => (prev.includes(orderId) ? prev : [...prev, orderId]));
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
    setActivePopover(null); setPopoverPos(null);
    showToast(`Order #${orderId} from ${customerName} added to cart`);
  }

  async function loadOrderToCart(order: Order) {
    for (const item of order.items) {
      const product = products.find((p) => p.id === item.productId);
      if (product) addToCart(product, item.quantity, true);
    }
    const res = await fetch("/api/orders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: order.id, status: "confirmed" }) });
    if (!res.ok) return;
    setLoadedOrderIds((prev) => (prev.includes(order.id) ? prev : [...prev, order.id]));
    setOrders((prev) => prev.map((o) => o.id === order.id ? { ...o, status: "confirmed" } : o));
    showToast(`Order #${order.id} from ${customerLabel(order)} loaded to cart`);
    setCartOpen(true);
  }

  const pendingOrders = orders.filter((o) => o.status === "pending");
  const ticket = (
    <Ticket cart={cart} total={total} count={cartCount} loadedOrderIds={loadedOrderIds} paymentMethod={paymentMethod} busy={loading}
      onPayment={setPaymentMethod} onQty={updateQty} onRemove={(id) => setCart((prev) => prev.filter((c) => c.id !== id))}
      onClear={() => setShowClearConfirm(true)} onCharge={() => setShowCheckoutConfirm(true)} />
  );

  return (
    <div className={`grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_360px] ${cart.length > 0 ? "pb-24 xl:pb-0" : ""}`}>
      <div className="min-w-0 space-y-4">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand">Counter</p>
            <h1 className="mt-1 font-display text-[28px] font-extrabold leading-none tracking-tight text-ink">Point of Sale</h1>
          </div>
          <div className="flex rounded-xl border border-line bg-surface p-1" role="tablist" aria-label="Sell from">
            {(["products", "orders"] as const).map((t) => (
              <button key={t} type="button" role="tab" aria-selected={activeTab === t} onClick={() => setActiveTab(t)}
                className={`inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-[13px] font-semibold transition ${
                  activeTab === t ? "bg-brand-soft text-brand-ink" : "text-ink-3 hover:text-ink"}`}>
                {t === "products" ? "Products" : "Pending orders"}
                {t === "orders" && totalPending > 0 && (
                  <span className="rounded-full bg-warn px-1.5 py-px text-[10.5px] font-bold text-white">{totalPending}</span>
                )}
              </button>
            ))}
          </div>
        </header>

        {activeTab === "products" ? (
          <>
            <CatalogToolbar query={search} onQuery={setSearch} sort={sort} onSort={setSort}
              sorts={["name", "category", "price_asc", "price_desc"]} placeholder="Scan or type a product, brand or code" />

            <div className="-mx-4 min-w-0 space-y-2 sm:mx-0">
              <div className="flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:flex-wrap sm:px-0" role="group" aria-label="Categories">
                <button type="button" onClick={() => { setCatId(null); setSub(null); }} aria-pressed={catId === null}
                  className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition ${catId === null ? "border-brand bg-brand text-white" : "border-line bg-surface text-ink-2 hover:border-line-strong"}`}>
                  All
                </button>
                {catList.map((c) => (
                  <button key={c.id} type="button" onClick={() => { setCatId(c.id); setSub(null); }} aria-pressed={catId === c.id}
                    className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition ${catId === c.id ? "border-brand bg-brand text-white" : "border-line bg-surface text-ink-2 hover:border-line-strong"}`}>
                    {c.name} <span className={catId === c.id ? "text-white/70" : "text-ink-4"}>{c.count}</span>
                  </button>
                ))}
              </div>
              {subList.length > 0 && (
                <div className="flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:flex-wrap sm:px-0" role="group" aria-label="Subcategories">
                  {[null, ...subList].map((s) => (
                    <button key={s ?? "all"} type="button" onClick={() => setSub(s)} aria-pressed={sub === s}
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition ${sub === s ? "bg-brand-soft text-brand-ink ring-1 ring-brand/30" : "text-ink-3 hover:bg-recess hover:text-ink"}`}>
                      {s ?? "All types"}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {list.length === 0 ? (
              <div className="grid place-items-center rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-14 text-center">
                <PackageSearch className="size-10 text-ink-4" strokeWidth={1.5} />
                <p className="mt-3 font-semibold text-ink-2">No product matches “{search}”</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
                {list.map((p) => {
                  const pendingEntries = productOrderMap.get(p.id) ?? [];
                  const pendingQty = pendingEntries.reduce((sum, e) => sum + e.quantity, 0);
                  const isOpen = activePopover === p.id;
                  const inCart = cart.find((i) => i.id === p.id);
                  const st = stockState(p.stock, 5);
                  const out = st === "out";
                  return (
                    <div key={p.id} className={`group relative flex flex-col overflow-hidden rounded-xl border bg-surface transition ${
                      inCart ? "border-brand ring-2 ring-brand/20" : "border-line hover:border-brand/40 hover:shadow-[0_10px_24px_-16px_rgba(18,50,127,0.5)]"} ${out ? "opacity-60" : ""}`}>
                      {pendingEntries.length > 0 && (
                        <button type="button" onClick={(e) => {
                          if (isOpen) { setActivePopover(null); setPopoverPos(null); return; }
                          const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                          const popoverWidth = 240;
                          const rawLeft = rect.left + window.scrollX - 180;
                          const clampedLeft = Math.max(8, Math.min(rawLeft, window.innerWidth - popoverWidth - 8));
                          setPopoverPos({ top: rect.bottom + window.scrollY + 6, left: clampedLeft });
                          setActivePopover(p.id);
                        }}
                          title={`${pendingEntries.length} online order${pendingEntries.length === 1 ? "" : "s"} waiting for ${fmtQty(pendingQty)} ${p.unit}`}
                          className="absolute right-2 top-2 z-10 inline-flex items-center gap-1 rounded-full bg-warn px-2 py-0.5 text-[10.5px] font-bold text-white shadow-sm transition hover:brightness-110">
                          <Package className="size-3" /> {pendingEntries.length} order{pendingEntries.length === 1 ? "" : "s"}
                        </button>
                      )}
                      {inCart && (
                        <span className="num absolute left-2 top-2 z-10 rounded-full bg-brand px-2 py-0.5 text-[10.5px] font-bold text-white shadow-sm">
                          × {fmtQty(inCart.quantity)}{p.unit === "kg" ? " kg" : ""}
                        </span>
                      )}

                      <button type="button" onClick={() => addToCart(p)} disabled={out} aria-label={`Add ${p.name}`}
                        className="flex flex-1 flex-col text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand disabled:cursor-not-allowed">
                        <ProductThumb image={p.image} name={p.name} category={p.category?.name} subcategory={p.subcategory} className="aspect-[16/10]" />
                        <span className="flex flex-1 flex-col px-3 pb-2.5 pt-2">
                          <span className="line-clamp-2 min-h-[2.5em] text-[13px] font-semibold leading-tight text-ink">{p.name}</span>
                          <span className="mt-1.5 flex items-baseline justify-between gap-2">
                            <span className="num font-display text-[15px] font-extrabold text-ink">{peso(p.price)}<span className="font-sans text-[11px] font-medium text-ink-4">/{p.unit}</span></span>
                            <span className={`num shrink-0 text-[11px] font-medium ${out ? "text-bad" : st === "low" ? "text-warn" : "text-ink-4"}`}>
                              {out ? "Out" : `${fmtQty(p.stock)} left`}
                            </span>
                          </span>
                        </span>
                      </button>

                      {p.unit === "kg" && !out && (
                        <div className="grid grid-cols-3 gap-1 border-t border-line p-1.5">
                          {KG_PRESETS.map((preset) => (
                            <button key={preset.value} type="button" onClick={() => addToCart(p, preset.value)}
                              className="rounded-md py-1 text-[11px] font-semibold text-brand transition hover:bg-brand-soft">
                              + {preset.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : pendingOrders.length === 0 ? (
          <div className="grid place-items-center rounded-2xl border border-dashed border-line-strong bg-surface px-6 py-16 text-center">
            <Clock className="size-10 text-ink-4" strokeWidth={1.5} />
            <p className="mt-3 font-semibold text-ink-2">No online orders waiting</p>
            <p className="mt-1 text-sm text-ink-4">New orders from the shop show up here to load into a sale.</p>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {pendingOrders.map((order) => (
              <article key={order.id} className="overflow-hidden rounded-2xl border border-line bg-surface">
                <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-display text-base font-extrabold text-ink">Order #{order.id}</p>
                    <p className="truncate text-xs text-ink-3">{customerLabel(order)} · {new Date(order.dateTime).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</p>
                  </div>
                  <span className="rounded-full bg-warn-soft px-2 py-0.5 text-[11px] font-bold text-warn">Waiting</span>
                </div>
                <ul className="divide-y divide-line">
                  {order.items.map((item) => {
                    const product = products.find((p) => p.id === item.productId);
                    return (
                      <li key={item.id} className="flex items-center gap-3 px-4 py-2">
                        <ProductThumb size="row" image={product?.image ?? null} name={item.product.name} category={product?.category?.name} subcategory={product?.subcategory} className="!size-8" />
                        <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">{item.product.name}</p>
                        <p className="num shrink-0 text-xs text-ink-4">× {fmtQty(item.quantity)}</p>
                        <p className="num w-20 shrink-0 text-right text-[13px] font-semibold text-ink">{peso(item.price * item.quantity)}</p>
                      </li>
                    );
                  })}
                </ul>
                <div className="flex items-center justify-between gap-3 bg-subtle px-4 py-3">
                  <span className="num font-display text-lg font-extrabold text-ink">{peso(order.totalAmount)}</span>
                  <button type="button" onClick={() => loadOrderToCart(order)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-[13px] font-semibold text-white transition hover:brightness-110">
                    <ShoppingCart className="size-4" /> Load into sale
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* Desktop: the ticket stays beside the products */}
      <aside className="sticky top-4 hidden h-[calc(100vh-6.5rem)] self-start overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(16,24,64,0.04)] xl:block" aria-label="Current sale">
        {ticket}
      </aside>

      {/* Smaller screens: a bar that opens the ticket */}
      {cart.length > 0 && !cartOpen && (
        <button type="button" onClick={() => setCartOpen(true)}
          className="fixed inset-x-4 bottom-4 z-30 flex items-center justify-between rounded-2xl bg-brand px-5 py-3.5 text-white shadow-[0_18px_40px_-14px_rgba(18,50,127,0.7)] xl:hidden">
          <span className="flex items-center gap-2 text-sm font-semibold"><ShoppingCart className="size-4" /> Current sale · {cart.length}</span>
          <span className="num font-display text-base font-extrabold">{peso(total)}</span>
        </button>
      )}

      {/* Cart drawer (phones and tablets) */}
      <Drawer open={cartOpen} onClose={() => setCartOpen(false)} placement="center" width="lg"
        title={<><ShoppingCart className="size-4 text-brand" /> <span>Current sale</span></>}>
        <div className="h-[70vh]">{ticket}</div>
      </Drawer>

      {saleReceipt && <ReceiptModal title="Sale complete" data={saleReceipt} onClose={() => setSaleReceipt(null)} />}
      <ConfirmModal
        open={showCheckoutConfirm}
        onClose={() => setShowCheckoutConfirm(false)}
        onConfirm={handleCheckout}
        title="Complete this sale?"
        body={<>Charge <span className="font-semibold text-ink">₱{total.toFixed(2)}</span> via {paymentMethod} for {cartCount} item{cartCount > 1 ? "s" : ""}. Stock will be deducted immediately.</>}
        variant="info"
        confirmLabel="Yes, Checkout"
      />
      <ConfirmModal
        open={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={handleClearCart}
        title="Clear the cart?"
        body="All items currently in the cart will be removed."
        confirmLabel="Yes, Clear Cart"
      />

      {/* Popover for pending orders per product */}
      {activePopover !== null && popoverPos && (() => {
        const p = products.find((prod) => prod.id === activePopover);
        const pendingEntries = p ? (productOrderMap.get(p.id) ?? []) : [];
        if (!p) return null;
        return createPortal(
          <div ref={popoverRef} style={{ position: "absolute", top: popoverPos.top, left: popoverPos.left }}
            className="z-[200] w-60 space-y-2 rounded-xl border border-line bg-surface p-3 shadow-xl">
            <p className="text-xs font-semibold text-ink-2 flex items-center gap-1.5">
              <Package className="size-3.5 text-warn" /> Waiting for <span className="truncate text-ink">{p.name}</span>
            </p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {pendingEntries.map((entry) => (
                <div key={entry.orderItemId} className="flex items-center justify-between rounded-lg bg-subtle px-2.5 py-2">
                  <div>
                    <p className="text-xs font-medium text-ink">{entry.customer}</p>
                    <p className="text-[10px] text-ink-3">Order #{entry.orderId} · qty {entry.quantity}</p>
                  </div>
                  <button onClick={() => fulfillOrder(entry.orderId, p, entry.quantity)}
                    className="shrink-0 rounded-lg bg-brand px-2 py-1 text-[10.5px] font-semibold text-white transition hover:brightness-110">
                    Add
                  </button>
                </div>
              ))}
            </div>
          </div>,
          document.body
        );
      })()}
    </div>
  );
}
