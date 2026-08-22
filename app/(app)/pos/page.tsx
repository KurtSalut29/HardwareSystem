"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Search, ShoppingCart, Trash2, Clock, Package, ChevronDown, ChevronRight, PackageSearch } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Drawer from "@/components/ui/Drawer";
import ConfirmModal from "@/components/ui/ConfirmModal";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/ToastProvider";
import { ICON_SIZE } from "@/lib/constants/icon-size";
import Image from "next/image";

type Category = { id: number; name: string };
type Product = { id: number; name: string; category: Category; subcategory: string | null; price: number; unit: string; stock: number; image: string | null; description: string | null };
type CartItem = Product & { quantity: number; fromOrder?: boolean };
type OItem = { id: number; quantity: number; price: number; product: { name: string }; productId: number };
type Order = { id: number; totalAmount: number; status: string; dateTime: string; customer: { username: string }; items: OItem[] };
type PendingEntry = { orderId: number; customer: string; quantity: number; orderItemId: number; totalItems: number };
type ActiveTab = "products" | "orders";

const round2 = (n: number) => Math.round(n * 100) / 100;
const stepFor = (unit: string) => (unit === "kg" ? 0.25 : 1);
const KG_PRESETS: { label: string; value: number }[] = [
  { label: "¼ kg", value: 0.25 },
  { label: "½ kg", value: 0.5 },
  { label: "1 kg", value: 1 },
];

export default function POSPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("All");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [loading, setLoading] = useState(false);
  const showToast = useToast();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [activeSub, setActiveSub] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<ActiveTab>("products");
  const [activePopover, setActivePopover] = useState<number | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
  const [kgInputs, setKgInputs] = useState<Record<number, string>>({});
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
      existing.push({ orderId: order.id, customer: order.customer.username, quantity: item.quantity, orderItemId: item.id, totalItems });
      productOrderMap.set(item.productId, existing);
    }
  }

  const filtered = products.filter((p) => {
    const q = search.toLowerCase();
    const matchSearch = p.name.toLowerCase().includes(q) || (p.subcategory ?? "").toLowerCase().includes(q);
    const matchCat = filterCat === "All" || p.category.name === filterCat;
    return matchSearch && matchCat;
  });

  const grouped = categories.reduce<Record<string, Product[]>>((acc, cat) => {
    const items = filtered.filter((p) => p.category.id === cat.id);
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

  function addToCart(product: Product, qty = 1, fromOrder = false) {
    if (product.stock === 0) return;
    setCart((prev) => {
      const ex = prev.find((i) => i.id === product.id);
      if (ex) {
        const newQty = round2(Math.min(ex.quantity + qty, product.stock));
        return prev.map((i) => i.id === product.id ? { ...i, quantity: newQty, fromOrder: ex.fromOrder || fromOrder } : i);
      }
      return [...prev, { ...product, quantity: round2(Math.min(qty, product.stock)), fromOrder }];
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
      body: JSON.stringify({ items: cart.map((i) => ({ productId: i.id, productName: i.name, quantity: i.quantity, price: i.price })), paymentMethod }),
    });
    setLoading(false);
    if (!res.ok) { showToast((await res.json().catch(() => ({ error: "Checkout failed" }))).error, "error"); return; }
    setCart([]); setCartOpen(false); setShowCheckoutConfirm(false); showToast("Transaction completed successfully!"); fetchAll();
  }

  function handleClearCart() {
    setCart([]);
    setShowClearConfirm(false);
    setCartOpen(false);
  }

  async function fulfillOrder(orderId: number, product: Product, quantity: number) {
    addToCart(product, quantity, true);
    const customerName = orders.find((o) => o.id === orderId)?.customer.username;
    const res = await fetch("/api/orders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: orderId, status: "confirmed" }) });
    if (!res.ok) return;
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
    setOrders((prev) => prev.map((o) => o.id === order.id ? { ...o, status: "confirmed" } : o));
    showToast(`Order #${order.id} from ${order.customer.username} loaded to cart`);
    setCartOpen(true);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Point of Sale"
        subtitle="Process transactions and manage customer orders"
        action={
          cartCount > 0 ? (
            <button onClick={() => setCartOpen(true)}
              className="flex items-center gap-2.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl shadow-sm font-semibold text-sm transition active:scale-[0.98]">
              <ShoppingCart size={ICON_SIZE.md} />
              <span>{cartCount} item{cartCount > 1 ? "s" : ""}</span>
              <span className="bg-white/20 rounded-lg px-2 py-0.5">₱{total.toFixed(2)}</span>
            </button>
          ) : undefined
        }
      />

      {/* Tab Bar */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button onClick={() => setActiveTab("products")}
          className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${activeTab === "products" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
          Products
        </button>
        <button onClick={() => setActiveTab("orders")}
          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition ${activeTab === "orders" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
          Pending Orders
          {totalPending > 0 && <span className="bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{totalPending}</span>}
        </button>
      </div>

      {activeTab === "products" && (
        <div className="space-y-3">
          <div className="relative max-w-md">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products by name..."
              className="w-full pl-11 pr-4 py-3 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 transition placeholder:text-gray-400" />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap md:overflow-visible md:pb-0">
            {["All", ...categories.map((c) => c.name)].map((c) => (
              <button key={c} onClick={() => setFilterCat(c)}
                className={`shrink-0 whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium transition ${filterCat === c ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Products Tab — full width */}
      {activeTab === "products" && (
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
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
                      {visibleItems.map((p) => {
                        const pendingEntries = productOrderMap.get(p.id) ?? [];
                        const pendingQty = pendingEntries.reduce((s, e) => s + e.quantity, 0);
                        const isOpen = activePopover === p.id;
                        const inCart = cart.find((i) => i.id === p.id);
                        const stockStyle =
                          p.stock === 0
                            ? { background: "var(--bad-soft)", color: "var(--bad)" }
                            : p.stock <= 5
                            ? { background: "var(--warn-soft)", color: "var(--warn)" }
                            : { background: "var(--good-soft)", color: "var(--good)" };
                        const stockLabel = p.stock === 0 ? "Out of stock" : p.stock <= 5 ? `${p.stock} left` : "In stock";
                        return (
                          <div key={p.id} className={`group relative bg-white rounded-2xl border flex flex-col shadow-sm transition-[transform,border-color] duration-200 hover:-translate-y-0.5
                            ${inCart ? "border-blue-300 ring-2 ring-blue-100" : pendingEntries.length > 0 ? "border-amber-300 ring-2 ring-amber-100" : "border-[color:var(--border-strong)] hover:border-blue-300"}`}>

                            {pendingEntries.length > 0 && (
                              <button onClick={(e) => {
                                if (isOpen) { setActivePopover(null); setPopoverPos(null); return; }
                                const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                const popoverWidth = 240;
                                const rawLeft = rect.left + window.scrollX - 180;
                                const clampedLeft = Math.max(8, Math.min(rawLeft, window.innerWidth - popoverWidth - 8));
                                setPopoverPos({ top: rect.bottom + window.scrollY + 6, left: clampedLeft });
                                setActivePopover(p.id);
                              }}
                                className={`absolute top-2 right-2 z-10 flex items-center gap-1 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow transition
                                  ${isOpen ? "bg-amber-600" : "bg-amber-500 hover:bg-amber-600"}`}>
                                <Package size={ICON_SIZE.xs} /> {pendingEntries.length} · {pendingQty}
                              </button>
                            )}

                            <div className="relative w-full aspect-[4/3] bg-gray-50 overflow-hidden rounded-t-2xl">
                              {p.image ? (
                                <Image
                                  src={p.image}
                                  alt={p.name}
                                  fill
                                  sizes="(max-width: 640px) 50vw, (max-width: 1280px) 25vw, 20vw"
                                  className="object-cover transition-transform duration-300 group-hover:scale-[1.06]"
                                />
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div
                                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-display font-extrabold text-lg shadow-sm"
                                    style={{ background: "linear-gradient(155deg, var(--brand), var(--brand-ink))" }}
                                  >
                                    {p.name.charAt(0)}
                                  </div>
                                </div>
                              )}
                              {/* Stock chip — only when it's not already covered by the pending-orders badge on the right */}
                              <span className="absolute top-2 left-2 text-[10px] font-bold px-2 py-[3px] rounded-full shadow-sm" style={stockStyle}>
                                {stockLabel}
                              </span>
                            </div>

                            <div className="p-2.5 flex flex-col flex-1">
                              {p.subcategory && (
                                <span
                                  className="self-start text-[9px] font-bold px-1.5 py-[2px] rounded uppercase tracking-wider mb-1"
                                  style={{ background: "var(--bg-muted)", color: "var(--text-muted)" }}
                                >
                                  {p.subcategory}
                                </span>
                              )}
                              <p className="text-xs font-semibold text-gray-900 leading-tight line-clamp-2">{p.name}</p>
                              <div className="mt-auto pt-2 border-t border-gray-50">
                                <span className="text-sm font-bold text-gray-900 num">₱{p.price.toFixed(2)}</span>
                              </div>
                            </div>

                            <div className="px-2.5 pb-2.5">
                              {inCart ? (
                                <div className="flex items-center justify-between gap-1">
                                  <button onClick={() => updateQty(p.id, inCart.quantity - stepFor(p.unit))} className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm flex items-center justify-center">−</button>
                                  <span className="text-sm font-semibold text-gray-800">{inCart.quantity}{p.unit === "kg" ? " kg" : ""}</span>
                                  <button onClick={() => updateQty(p.id, inCart.quantity + stepFor(p.unit))} className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm flex items-center justify-center">+</button>
                                  <button onClick={() => setCart((prev) => prev.filter((c) => c.id !== p.id))} className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 text-red-400 flex items-center justify-center"><Trash2 size={ICON_SIZE.xs} /></button>
                                </div>
                              ) : p.unit === "kg" ? (
                                <div className="space-y-1">
                                  <div className="grid grid-cols-3 gap-1">
                                    {KG_PRESETS.map((preset) => (
                                      <button key={preset.value} type="button"
                                        onClick={() => setKgInputs((prev) => ({ ...prev, [p.id]: String(preset.value) }))}
                                        className="py-1 text-[10px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition">
                                        {preset.label}
                                      </button>
                                    ))}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number" step="0.01" min="0.01" placeholder="kg"
                                      value={kgInputs[p.id] ?? ""}
                                      onChange={(e) => setKgInputs((prev) => ({ ...prev, [p.id]: e.target.value }))}
                                      className="w-12 text-[11px] border border-gray-200 rounded-lg px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition"
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
                                      className="flex-1 py-1 text-[10px] font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed">
                                      + Add
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button onClick={() => addToCart(p)} disabled={p.stock === 0}
                                  className="w-full py-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed">
                                  + Add
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
      )}

      {/* Pending Orders Tab */}
      {activeTab === "orders" && (
        <div className="space-y-3">
          {orders.filter((o) => o.status === "pending").length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400 text-sm">
              <Clock size={ICON_SIZE.xl} className="mx-auto mb-2 opacity-30" />
              No pending orders right now.
            </div>
          ) : orders.filter((o) => o.status === "pending").map((order) => (
            <div key={order.id} className="bg-white rounded-xl border border-amber-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-amber-50/60 border-b border-amber-100">
                <div className="flex items-center gap-2">
                  <Clock size={ICON_SIZE.sm} className="text-amber-500" />
                  <span className="font-semibold text-gray-900 text-sm">Order #{order.id}</span>
                  <span className="text-xs text-gray-500">— {order.customer.username}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-900">₱{order.totalAmount.toFixed(2)}</span>
                  <button onClick={() => loadOrderToCart(order)}
                    className="flex items-center gap-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg transition">
                    <ShoppingCart size={ICON_SIZE.xs} /> Load to Cart
                  </button>
                </div>
              </div>
              <div className="divide-y divide-gray-50">
                {order.items.map((item) => {
                  const product = products.find((p) => p.id === item.productId);
                  return (
                    <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                        {product?.image ? <Image src={product.image} alt={product.name} width={32} height={32} className="w-full h-full object-cover" /> : <Package size={ICON_SIZE.sm} className="text-gray-300" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{item.product.name}</p>
                        {product?.subcategory && <p className="text-[11px] text-blue-500">{product.subcategory}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-gray-500">× {item.quantity}</p>
                        <p className="text-sm font-semibold text-gray-900">₱{(item.price * item.quantity).toFixed(2)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}


      {/* Cart Drawer */}
      <Drawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        title={
          <>
            <ShoppingCart size={ICON_SIZE.md} className="text-blue-600" />
            <span>Cart</span>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{cartCount} items</span>
          </>
        }
        footer={
          <div className="p-4 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-500">Total</span>
              <span className="font-bold text-gray-900 text-xl">₱{total.toFixed(2)}</span>
            </div>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition bg-white">
              <option>Cash</option>
              <option>GCash</option>
              <option>Card</option>
            </select>
            <Button onClick={() => setShowCheckoutConfirm(true)} disabled={!cart.length} className="w-full" size="md">
              {`Checkout — ₱${total.toFixed(2)}`}
            </Button>
            <button onClick={() => setShowClearConfirm(true)} className="w-full text-xs text-gray-400 hover:text-red-500 transition py-1">Clear cart</button>
          </div>
        }
      >
        <div className="p-4 space-y-3">
          {cart.map((i) => (
            <div key={i.id} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
              <div className="w-10 h-10 rounded-lg bg-white border border-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                {i.image ? <Image src={i.image} alt={i.name} width={40} height={40} className="w-full h-full object-cover" /> : <Package size={ICON_SIZE.sm} className="text-gray-300" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{i.name}</p>
                <p className="text-xs text-gray-400">₱{i.price.toFixed(2)} each</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => updateQty(i.id, i.quantity - stepFor(i.unit))} className="w-6 h-6 rounded-lg bg-white border border-gray-200 text-gray-600 font-bold text-xs flex items-center justify-center">−</button>
                <span className="min-w-[2.5rem] text-center text-sm font-semibold">{i.quantity}{i.unit === "kg" ? " kg" : ""}</span>
                <button onClick={() => updateQty(i.id, i.quantity + stepFor(i.unit))} className="w-6 h-6 rounded-lg bg-white border border-gray-200 text-gray-600 font-bold text-xs flex items-center justify-center">+</button>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-gray-900">₱{(i.price * i.quantity).toFixed(2)}</p>
                <button onClick={() => setCart((prev) => prev.filter((c) => c.id !== i.id))} className="text-[10px] text-red-400 hover:text-red-600 transition">remove</button>
              </div>
            </div>
          ))}
        </div>
      </Drawer>

      <ConfirmModal
        open={showCheckoutConfirm}
        onClose={() => setShowCheckoutConfirm(false)}
        onConfirm={handleCheckout}
        title="Complete this sale?"
        body={<>Charge <span className="font-semibold text-gray-800">₱{total.toFixed(2)}</span> via {paymentMethod} for {cartCount} item{cartCount > 1 ? "s" : ""}. Stock will be deducted immediately.</>}
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
            className="z-[200] w-60 bg-white border border-amber-200 rounded-xl shadow-xl p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
              <Package size={ICON_SIZE.xs} className="text-amber-500" /> Pending for <span className="text-amber-600 truncate">{p.name}</span>
            </p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {pendingEntries.map((entry) => (
                <div key={entry.orderItemId} className="flex items-center justify-between bg-amber-50 rounded-lg px-2.5 py-2">
                  <div>
                    <p className="text-xs font-medium text-gray-800">{entry.customer}</p>
                    <p className="text-[10px] text-gray-500">Order #{entry.orderId} · qty {entry.quantity}</p>
                  </div>
                  <button onClick={() => fulfillOrder(entry.orderId, p, entry.quantity)}
                    className="text-[10px] font-semibold bg-amber-500 hover:bg-amber-600 text-white px-2 py-1 rounded-lg transition shrink-0">
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
