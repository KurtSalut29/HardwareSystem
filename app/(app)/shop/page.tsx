"use client";

import { useEffect, useState, useCallback } from "react";
import { Search, ShoppingCart, Trash2, CheckCircle, ChevronDown, ChevronRight, PackageSearch, Banknote, Smartphone, Copy, Check, QrCode, AlertTriangle } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Drawer from "@/components/ui/Drawer";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import Image from "next/image";
import LocationPicker, { PickedLocation } from "@/components/LocationPicker";
import { ICON_SIZE } from "@/lib/constants/icon-size";
import { STORE_NAME } from "@/lib/brand";

type Category = { id: number; name: string };
type Product = { id: number; name: string; category: Category; categoryId: number; subcategory: string | null; price: number; unit: string; stock: number; image: string | null; description: string | null };
type CartItem = Product & { quantity: number };
type StorePayment = { gcashName: string | null; gcashNumber: string | null; gcashQr: string | null };

const round2 = (n: number) => Math.round(n * 100) / 100;
const stepFor = (unit: string) => (unit === "kg" ? 0.25 : 1);
const KG_PRESETS: { label: string; value: number }[] = [
  { label: "¼ kg", value: 0.25 },
  { label: "½ kg", value: 0.5 },
  { label: "1 kg", value: 1 },
];

// Must mirror the server-side rules in /api/orders.
const GCASH_NUMBER_RE = /^09\d{9}$/;
const GCASH_REFERENCE_RE = /^\d{13}$/;
const digitsOnly = (v: string) => v.replace(/\D/g, "");

export default function ShopPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("All");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [pickedLocation, setPickedLocation] = useState<PickedLocation | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [activeSub, setActiveSub] = useState<Record<string, string>>({});
  const [fulfillmentMode, setFulfillmentMode] = useState<"delivery" | "pickup">("delivery");
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [storeInfo, setStoreInfo] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const [kgInputs, setKgInputs] = useState<Record<number, string>>({});
  const [showReview, setShowReview] = useState(false);
  const [storePayment, setStorePayment] = useState<StorePayment | null>(null);
  const [gcashNumber, setGcashNumber] = useState("");
  const [gcashReference, setGcashReference] = useState("");
  // Blank means "paid the full total" — the common case, so the customer only
  // has to touch this when they actually sent less.
  const [gcashAmount, setGcashAmount] = useState("");
  const [copied, setCopied] = useState(false);

  const fetchProducts = useCallback(async () => {
    const [pRes, cRes] = await Promise.all([fetch("/api/products"), fetch("/api/categories")]);
    setProducts(await pRes.json());
    setCategories(await cRes.json());
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  useEffect(() => {
    fetch("/api/store-location").then((r) => (r.ok ? r.json() : null)).then(setStoreInfo).catch(() => {});
    fetch("/api/store-payment").then((r) => (r.ok ? r.json() : null)).then(setStorePayment).catch(() => {});
  }, []);

  const filtered = products.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch = p.name.toLowerCase().includes(q) || (p.subcategory ?? "").toLowerCase().includes(q);
    const matchCat = filterCat === "All" || p.category.name === filterCat;
    return matchSearch && matchCat;
  });

  const grouped = categories.reduce<Record<string, Product[]>>((acc, cat) => {
    const items = filtered.filter((p) => p.categoryId === cat.id);
    if (items.length > 0) acc[cat.name] = items;
    return acc;
  }, {});

  function getSubcats(items: Product[]) {
    const seen = new Map<string, string>();
    items.forEach((p) => {
      if (!p.subcategory) return;
      const key = p.subcategory.trim().toLowerCase();
      if (!seen.has(key)) seen.set(key, p.subcategory);
    });
    return [...seen.values()];
  }

  function addToCart(product: Product, qty = 1) {
    if (product.stock === 0) return;
    setCart((prev) => {
      const ex = prev.find((i) => i.id === product.id);
      if (ex) {
        const next = round2(ex.quantity + qty);
        if (next > product.stock) return prev;
        return prev.map((i) => i.id === product.id ? { ...i, quantity: next } : i);
      }
      if (qty > product.stock) return prev;
      return [...prev, { ...product, quantity: qty }];
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

  const gcashNumberValid = GCASH_NUMBER_RE.test(gcashNumber);
  const gcashReferenceValid = GCASH_REFERENCE_RE.test(gcashReference);

  // What the customer says they sent. Anything short of the total becomes a
  // balance they settle on delivery or pickup.
  const paidEntered = gcashAmount.trim() === "" ? total : Number(gcashAmount);
  const gcashAmountValid = Number.isFinite(paidEntered) && paidEntered > 0 && paidEntered <= total + 0.01;
  const amountPaid = gcashAmountValid ? Math.min(paidEntered, total) : 0;
  const balance = Math.max(0, round2(total - amountPaid));
  const isPartialPayment = paymentMethod === "GCash" && gcashAmountValid && balance > 0;

  const gcashReady = paymentMethod !== "GCash" || (gcashNumberValid && gcashReferenceValid && gcashAmountValid);

  async function copyGcashNumber() {
    if (!storePayment?.gcashNumber) return;
    try {
      await navigator.clipboard.writeText(storePayment.gcashNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard blocked — the number is still visible on screen */ }
  }

  function openReview() {
    if (!cart.length) return;
    if (fulfillmentMode === "delivery" && !pickedLocation) {
      setError("Please set a delivery location.");
      return;
    }
    if (paymentMethod === "GCash") {
      if (!gcashNumberValid) {
        setError("Enter the GCash number you paid from (11 digits, starts with 09).");
        return;
      }
      if (!gcashReferenceValid) {
        setError("Enter the 13-digit reference number from your GCash receipt.");
        return;
      }
    }
    setError("");
    setShowReview(true);
  }

  async function handleOrder() {
    setError(""); setLoading(true);
    const res = await fetch("/api/orders", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: cart.map((i) => ({ productId: i.id, quantity: i.quantity, price: i.price })),
        fulfillmentMode,
        paymentMethod,
        ...(paymentMethod === "GCash" ? { gcashNumber, gcashReference, amountPaid } : {}),
        ...(fulfillmentMode === "delivery" && pickedLocation ? {
          deliveryAddress: pickedLocation.address,
          latitude: pickedLocation.lat,
          longitude: pickedLocation.lng,
        } : {}),
      }),
    });
    setLoading(false);
    if (!res.ok) { setError((await res.json()).error); return; }
    setCart([]); setPickedLocation(null); setFulfillmentMode("delivery"); setPaymentMethod("Cash");
    setGcashNumber(""); setGcashReference(""); setGcashAmount("");
    setShowReview(false); setShowCart(false); setSuccess(true); fetchProducts();
    setTimeout(() => setSuccess(false), 4000);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Shop"
        subtitle="Browse and order hardware products"
        action={
          <button onClick={() => setShowCart(true)} className="relative flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium transition shadow-sm">
            <ShoppingCart size={ICON_SIZE.md} /> Cart
            {cartCount > 0 && <span className="absolute -top-2 -right-2 w-5 h-5 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{cartCount}</span>}
          </button>
        }
      />

      {success && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-emerald-700 text-sm font-medium">
          <CheckCircle size={ICON_SIZE.md} /> Order placed successfully! Check your orders for status updates.
        </div>
      )}

      {/* Filters */}
      <div className="space-y-3">
        <div className="relative max-w-md">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products by name..."
            className="w-full pl-11 pr-4 py-3 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition placeholder:text-gray-400" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap md:overflow-visible md:pb-0">
          {["All", ...categories.map((c) => c.name)].map((c) => (
            <button key={c} onClick={() => setFilterCat(c)}
              className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium transition ${filterCat === c ? "bg-blue-600 text-white shadow-sm" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Grouped Product Cards */}
      <div className="space-y-6">
        {Object.keys(grouped).length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200">
            <EmptyState icon={PackageSearch} title="No products found" description="Try a different search or category filter." />
          </div>
        ) : Object.entries(grouped).map(([catName, items]) => (
          <div key={catName}>
            <button onClick={() => setCollapsed((prev) => ({ ...prev, [catName]: !prev[catName] }))}
              className="flex items-center gap-2.5 mb-3">
              {collapsed[catName] ? <ChevronRight size={ICON_SIZE.sm} className="text-gray-400" /> : <ChevronDown size={ICON_SIZE.sm} className="text-gray-400" />}
              <span className="font-bold text-gray-900 text-sm">{catName}</span>
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">{items.length}</span>
            </button>

            {!collapsed[catName] && (() => {
              const subcats = getSubcats(items);
              const currentSub = activeSub[catName] ?? "All";
              const visibleItems = currentSub === "All" ? items : items.filter((p) =>
                p.subcategory?.trim().toLowerCase() === currentSub.trim().toLowerCase()
              );
              return (
                <>
                  {subcats.length > 0 && (
                    <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap md:overflow-visible md:pb-0 mb-3">
                      {["All", ...subcats].map((s) => (
                        <button key={s} onClick={() => setActiveSub((prev) => ({ ...prev, [catName]: s }))}
                          className={`shrink-0 whitespace-nowrap px-3 py-1 rounded-lg text-xs font-medium transition border ${currentSub === s ? "bg-blue-600 text-white border-blue-600" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
                    {visibleItems.map((p) => {
                      const inCart = cart.find((i) => i.id === p.id);
                      const stockStyle =
                        p.stock === 0
                          ? { background: "var(--bad-soft)", color: "var(--bad)" }
                          : p.stock <= 5
                          ? { background: "var(--warn-soft)", color: "var(--warn)" }
                          : { background: "var(--good-soft)", color: "var(--good)" };
                      const stockLabel = p.stock === 0 ? "Out of stock" : p.stock <= 5 ? `${p.stock} left` : "In stock";
                      return (
                        <div key={p.id} className="group bg-white rounded-2xl border border-[color:var(--border-strong)] overflow-hidden flex flex-col shadow-sm transition-[transform,border-color] duration-200 hover:border-blue-300 hover:-translate-y-1">
                          {/* Image */}
                          <div className="relative w-full aspect-[4/3] bg-gray-50 overflow-hidden">
                            {p.image ? (
                              <Image
                                src={p.image}
                                alt={p.name}
                                fill
                                sizes="(max-width: 640px) 50vw, (max-width: 1280px) 25vw, 20vw"
                                className="object-cover transition-transform duration-300 group-hover:scale-[1.06]"
                              />
                            ) : (
                              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
                                <div
                                  className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-display font-extrabold text-lg shadow-sm"
                                  style={{ background: "linear-gradient(155deg, var(--brand), var(--brand-ink))" }}
                                >
                                  {p.name.charAt(0)}
                                </div>
                                <span className="text-[10px] text-gray-300 font-medium">No image</span>
                              </div>
                            )}

                            {/* Stock chip */}
                            <span className="absolute top-2 left-2 text-[10px] font-bold px-2 py-[3px] rounded-full shadow-sm" style={stockStyle}>
                              {stockLabel}
                            </span>
                          </div>

                          {/* Details */}
                          <div className="p-3 flex flex-col flex-1">
                            {p.subcategory && (
                              <span
                                className="self-start text-[9.5px] font-bold px-1.5 py-[3px] rounded uppercase tracking-wider mb-1"
                                style={{ background: "var(--bg-muted)", color: "var(--text-muted)" }}
                              >
                                {p.subcategory}
                              </span>
                            )}
                            <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">{p.name}</p>
                            {p.description && <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-1">{p.description}</p>}

                            <div className="mt-auto pt-2.5 border-t border-gray-50 flex items-baseline gap-1">
                              <span className="font-display text-base font-extrabold text-gray-900 num">₱{p.price.toFixed(2)}</span>
                              <span className="text-[11px] text-gray-400 font-medium">per {p.unit}</span>
                            </div>

                            {p.unit === "kg" ? (
                              <div className="mt-2 space-y-1.5">
                                {inCart && <p className="text-[11px] text-blue-600 font-semibold text-center">In cart: {inCart.quantity} kg</p>}
                                <div className="grid grid-cols-3 gap-1">
                                  {KG_PRESETS.map((preset) => (
                                    <button key={preset.value} type="button"
                                      onClick={() => setKgInputs((prev) => ({ ...prev, [p.id]: String(preset.value) }))}
                                      className="bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg py-1 text-[11px] font-semibold transition">
                                      {preset.label}
                                    </button>
                                  ))}
                                </div>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number" step="0.01" min="0.01" placeholder="kg"
                                    value={kgInputs[p.id] ?? ""}
                                    onChange={(e) => setKgInputs((prev) => ({ ...prev, [p.id]: e.target.value }))}
                                    className="w-14 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const qty = round2(parseFloat(kgInputs[p.id] ?? "0"));
                                      if (!qty || qty <= 0) return;
                                      addToCart(p, qty);
                                      setKgInputs((prev) => ({ ...prev, [p.id]: "" }));
                                    }}
                                    disabled={p.stock === 0}
                                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg py-1.5 text-[11px] font-semibold transition">
                                    Add to Cart
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button onClick={() => addToCart(p)} disabled={p.stock === 0}
                                className="mt-2 w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg py-1.5 text-xs font-semibold transition">
                                {inCart ? `In cart (${inCart.quantity})` : "Add to Cart"}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
        ))}
      </div>

      {/* Cart Drawer */}
      <Drawer
        open={showCart}
        onClose={() => setShowCart(false)}
        placement="center"
        width="lg"
        title={<><ShoppingCart size={ICON_SIZE.md} /> Your Cart</>}
        footer={cart.length > 0 ? (
          <div className="p-5 space-y-3">
            <div className="flex justify-between font-bold text-gray-800">
              <span>Total</span>
              <span className="text-lg">₱{total.toFixed(2)}</span>
            </div>
            {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <Button onClick={openReview} disabled={!gcashReady} className="w-full">
              Review Order
            </Button>
          </div>
        ) : undefined}
      >
        <div className="p-5 space-y-4">
          {cart.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <ShoppingCart size={ICON_SIZE.xl} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm">Your cart is empty</p>
            </div>
          ) : cart.map((i) => (
            <div key={i.id} className="flex items-center gap-3">
              {i.image ? (
                <Image src={i.image} alt={i.name} width={40} height={40} className="w-10 h-10 rounded-xl object-cover shrink-0 border border-gray-100" />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-sm shrink-0">{i.name.charAt(0)}</div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{i.name}</p>
                <p className="text-xs text-gray-400">₱{i.price.toFixed(2)} / {i.unit}</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => updateQty(i.id, i.quantity - stepFor(i.unit))} className="w-6 h-6 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-bold transition flex items-center justify-center">−</button>
                <span className="min-w-[2.5rem] text-center text-sm">{i.quantity}{i.unit === "kg" ? " kg" : ""}</span>
                <button onClick={() => updateQty(i.id, i.quantity + stepFor(i.unit))} className="w-6 h-6 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-bold transition flex items-center justify-center">+</button>
              </div>
              <button onClick={() => setCart((prev) => prev.filter((c) => c.id !== i.id))} className="p-1 text-gray-300 hover:text-red-400 transition"><Trash2 size={ICON_SIZE.xs} /></button>
            </div>
          ))}

          {/* Checkout options live in the scrollable body — the GCash panel and
              the map picker together are far taller than a pinned footer can hold. */}
          {cart.length > 0 && (
            <div className="pt-4 mt-2 border-t border-gray-100 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Fulfillment</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setFulfillmentMode("delivery")}
                  className={`py-2 rounded-lg text-xs font-semibold border transition ${fulfillmentMode === "delivery" ? "bg-blue-600 text-white border-blue-600" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                  🚚 Delivery
                </button>
                <button type="button" onClick={() => setFulfillmentMode("pickup")}
                  className={`py-2 rounded-lg text-xs font-semibold border transition ${fulfillmentMode === "pickup" ? "bg-blue-600 text-white border-blue-600" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                  🏪 Pickup at Store
                </button>
              </div>
            </div>

            {fulfillmentMode === "delivery" ? (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Delivery Location</label>
                <LocationPicker value={pickedLocation} onChange={setPickedLocation} />
              </div>
            ) : (
              <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2.5 text-xs text-blue-700">
                <p className="font-semibold">{storeInfo?.name ?? STORE_NAME}</p>
                <p className="text-blue-500 mt-0.5">We&apos;ll notify you when your order is ready for pickup.</p>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Payment Method</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { value: "Cash", icon: Banknote, label: fulfillmentMode === "delivery" ? "Cash on Delivery" : "Cash on Pickup" },
                  { value: "GCash", icon: Smartphone, label: "GCash" },
                ].map((m) => (
                  <button key={m.value} type="button" onClick={() => { setPaymentMethod(m.value); setError(""); }}
                    className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-lg border text-[11px] font-semibold leading-tight text-center transition ${
                      paymentMethod === m.value ? "bg-blue-600 text-white border-blue-600" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}>
                    <m.icon size={ICON_SIZE.sm} />
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {paymentMethod === "GCash" && (
              <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <QrCode size={ICON_SIZE.sm} className="text-blue-600 shrink-0" />
                  <p className="text-xs font-bold text-blue-800">Pay ₱{total.toFixed(2)} via GCash</p>
                </div>

                {storePayment?.gcashQr || storePayment?.gcashNumber ? (
                  <>
                    <p className="text-[11px] text-blue-700 leading-relaxed">
                      <span className="font-semibold">1.</span> Pay in your GCash app &nbsp;
                      <span className="font-semibold">2.</span> Enter your number &amp; ref. no. below &nbsp;
                      <span className="font-semibold">3.</span> Tap Review Order to place it
                    </p>
                    <div className="flex gap-3 items-center">
                      {storePayment.gcashQr && (
                        <div className="relative w-24 h-24 shrink-0 rounded-lg overflow-hidden border border-blue-200 bg-white">
                          <Image src={storePayment.gcashQr} alt="Store GCash QR code" fill sizes="96px" className="object-contain p-1" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-500">Send payment to</p>
                        <p className="text-sm font-bold text-gray-900 truncate">{storePayment.gcashName ?? storeInfo?.name ?? STORE_NAME}</p>
                        {storePayment.gcashNumber && (
                          <button type="button" onClick={copyGcashNumber}
                            className="flex items-center gap-1.5 text-sm font-bold text-blue-700 num hover:underline">
                            {storePayment.gcashNumber}
                            {copied ? <Check size={ICON_SIZE.xs} className="text-emerald-600" /> : <Copy size={ICON_SIZE.xs} className="text-blue-400" />}
                          </button>
                        )}
                        <p className="text-[10px] text-blue-500">{copied ? "Number copied!" : "Scan the QR or send to this number."}</p>
                      </div>
                    </div>

                    <div className="space-y-2 pt-1 border-t border-blue-200">
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-700 mb-1 mt-2">Your GCash number</label>
                        <input
                          value={gcashNumber}
                          onChange={(e) => setGcashNumber(digitsOnly(e.target.value).slice(0, 11))}
                          inputMode="numeric" placeholder="09XXXXXXXXX"
                          className={`w-full text-sm num border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 transition ${
                            gcashNumber && !gcashNumberValid ? "border-red-300 focus:ring-red-500/20" : "border-gray-200 focus:ring-blue-500/20 focus:border-blue-400"
                          }`}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-700 mb-1">GCash reference number</label>
                        <input
                          value={gcashReference}
                          onChange={(e) => setGcashReference(digitsOnly(e.target.value).slice(0, 13))}
                          inputMode="numeric" placeholder="13-digit ref. no."
                          className={`w-full text-sm num border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 transition ${
                            gcashReference && !gcashReferenceValid ? "border-red-300 focus:ring-red-500/20" : "border-gray-200 focus:ring-blue-500/20 focus:border-blue-400"
                          }`}
                        />
                        <p className="text-[10px] text-gray-500 mt-1">
                          Found on your GCash receipt as &ldquo;Ref. No.&rdquo; — the store checks this before releasing your order.
                        </p>
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[11px] font-semibold text-gray-700">Amount you sent</label>
                          {gcashAmount.trim() !== "" && (
                            <button type="button" onClick={() => setGcashAmount("")}
                              className="text-[10px] font-bold text-blue-600 hover:underline">
                              Paid in full
                            </button>
                          )}
                        </div>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">₱</span>
                          <input
                            value={gcashAmount}
                            onChange={(e) => setGcashAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                            inputMode="decimal"
                            placeholder={total.toFixed(2)}
                            className={`w-full text-sm num border rounded-lg pl-7 pr-3 py-2 bg-white focus:outline-none focus:ring-2 transition ${
                              gcashAmount.trim() !== "" && !gcashAmountValid
                                ? "border-red-300 focus:ring-red-500/20"
                                : "border-gray-200 focus:ring-blue-500/20 focus:border-blue-400"
                            }`}
                          />
                        </div>
                        {gcashAmount.trim() !== "" && !gcashAmountValid ? (
                          <p className="text-[10px] text-red-500 mt-1">
                            Enter an amount between ₱0.01 and the order total of ₱{total.toFixed(2)}.
                          </p>
                        ) : (
                          <p className="text-[10px] text-gray-500 mt-1">
                            Leave this blank if you paid the full ₱{total.toFixed(2)}.
                          </p>
                        )}
                      </div>

                      {/* Partial payment — spell out the balance before they commit. */}
                      {isPartialPayment && (
                        <div className="rounded-lg border px-3 py-2.5" style={{ borderColor: "var(--warn)", background: "var(--warn-soft)" }}>
                          <p className="text-[11px] font-bold flex items-center gap-1.5" style={{ color: "var(--warn)" }}>
                            <AlertTriangle size={ICON_SIZE.xs} /> You will still owe ₱{balance.toFixed(2)}
                          </p>
                          <p className="text-[10px] mt-1 leading-relaxed" style={{ color: "var(--warn)" }}>
                            You&apos;re sending ₱{amountPaid.toFixed(2)} of the ₱{total.toFixed(2)} total. The remaining
                            ₱{balance.toFixed(2)} must be paid {fulfillmentMode === "delivery" ? "to the driver on delivery" : "at the counter when you pick up"}.
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-blue-700">
                    The store hasn&apos;t set up its GCash details yet. Please choose another payment method or contact the store.
                  </p>
                )}
              </div>
            )}

            </div>
          )}
        </div>
      </Drawer>

      {/* Order Review Modal */}
      <Modal open={showReview} onClose={() => setShowReview(false)} title="Review Your Order" size="sm">
        <div className="space-y-4">
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {cart.map((i) => (
              <div key={i.id} className="flex justify-between text-sm">
                <span className="text-gray-600">{i.name} <span className="text-gray-400">× {i.quantity}{i.unit === "kg" ? " kg" : ""}</span></span>
                <span className="font-medium text-gray-800">₱{(i.price * i.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-dashed border-gray-200 pt-3 flex justify-between font-bold text-gray-900">
            <span>Total</span>
            <span>₱{total.toFixed(2)}</span>
          </div>
          <div className="bg-gray-50 rounded-lg px-3 py-2.5 text-xs text-gray-600 space-y-1">
            <p>{fulfillmentMode === "delivery" ? "🚚 Delivery" : "🏪 Pickup at Store"}{fulfillmentMode === "delivery" && pickedLocation ? ` — ${pickedLocation.address}` : ""}</p>
            <p>💳 {paymentMethod}{paymentMethod === "Cash" ? (fulfillmentMode === "delivery" ? " on Delivery" : " on Pickup") : ""}</p>
            {paymentMethod === "GCash" && (
              <>
                <p>📱 Paid from <span className="num font-medium text-gray-700">{gcashNumber}</span></p>
                <p>🧾 Ref. No. <span className="num font-medium text-gray-700">{gcashReference}</span></p>
                <p>💵 Amount sent <span className="num font-medium text-gray-700">₱{amountPaid.toFixed(2)}</span></p>
              </>
            )}
          </div>
          {isPartialPayment && (
            <div className="rounded-lg border px-3 py-2.5" style={{ borderColor: "var(--warn)", background: "var(--warn-soft)" }}>
              <p className="text-xs font-bold flex items-center gap-1.5" style={{ color: "var(--warn)" }}>
                <AlertTriangle size={ICON_SIZE.sm} /> Outstanding balance: ₱{balance.toFixed(2)}
              </p>
              <p className="text-[11px] mt-1 leading-relaxed" style={{ color: "var(--warn)" }}>
                This order is only partly paid. Please settle the remaining ₱{balance.toFixed(2)}
                {fulfillmentMode === "delivery" ? " with the driver on delivery" : " at the counter on pickup"}.
              </p>
            </div>
          )}
          {paymentMethod === "GCash" && (
            <p className="text-[11px] text-gray-500 -mt-1">
              The store will verify this reference number against their GCash account before confirming your order.
            </p>
          )}
          {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex gap-2">
            <Button variant="secondary" className="flex-1" onClick={() => setShowReview(false)} disabled={loading}>Back to Cart</Button>
            <Button className="flex-1" onClick={handleOrder} loading={loading}>Confirm & Place Order</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
