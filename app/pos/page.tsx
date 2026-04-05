"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Search, ShoppingCart, Trash2, Clock, Package, ChevronDown, ChevronRight, X } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Toast from "@/components/ui/Toast";
import Image from "next/image";

type Category = { id: number; name: string };
type Product = { id: number; name: string; category: Category; subcategory: string | null; price: number; stock: number; image: string | null; description: string | null };
type CartItem = Product & { quantity: number; fromOrder?: boolean };
type OItem = { id: number; quantity: number; price: number; product: { name: string }; productId: number };
type Order = { id: number; totalAmount: number; status: string; dateTime: string; customer: { username: string }; items: OItem[] };
type PendingEntry = { orderId: number; customer: string; quantity: number; orderItemId: number; totalItems: number };
type ActiveTab = "products" | "orders";

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
  const [toast, setToast] = useState<{ msg: string; variant: "success" | "error" | "warning" | "info" } | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [activeSub, setActiveSub] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<ActiveTab>("products");
  const [activePopover, setActivePopover] = useState<number | null>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);
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

  function showToast(msg: string, variant: "success" | "error" | "warning" | "info" = "success") { setToast({ msg, variant }); setTimeout(() => setToast(null), 3000); }

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
        const newQty = Math.min(ex.quantity + qty, product.stock);
        return prev.map((i) => i.id === product.id ? { ...i, quantity: newQty, fromOrder: ex.fromOrder || fromOrder } : i);
      }
      return [...prev, { ...product, quantity: Math.min(qty, product.stock), fromOrder }];
    });
  }

  function updateQty(id: number, qty: number) {
    if (qty <= 0) { setCart((prev) => prev.filter((i) => i.id !== id)); return; }
    const p = products.find((p) => p.id === id);
    if (p && qty > p.stock) return;
    setCart((prev) => prev.map((i) => i.id === id ? { ...i, quantity: qty } : i));
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
    setCart([]); setCartOpen(false); showToast("Transaction completed successfully!"); fetchAll();
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
      <Toast message={toast?.msg ?? ""} variant={toast?.variant} />

      <PageHeader title="Point of Sale" subtitle="Process transactions and manage customer orders" />

      {/* Tab Bar + Search + Filters all in one row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl shrink-0">
          <button onClick={() => setActiveTab("products")}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${activeTab === "products" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            Products
          </button>
          <button onClick={() => setActiveTab("orders")}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold transition ${activeTab === "orders" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            Pending Orders
            {totalPending > 0 && <span className="bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{totalPending}</span>}
          </button>
        </div>

        {activeTab === "products" && (
          <>
            <div className="relative min-w-[200px] max-w-xs flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..."
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition" />
            </div>
            <div className="flex gap-2 flex-wrap">
              {["All", ...categories.map((c) => c.name)].map((c) => (
                <button key={c} onClick={() => setFilterCat(c)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filterCat === c ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                  {c}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Products Tab — full width */}
      {activeTab === "products" && (
        <div className="space-y-6">
          {Object.keys(grouped).length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400 text-sm">No products found.</div>
          ) : Object.entries(grouped).map(([catName, items]) => (
            <div key={catName}>
              <button onClick={() => setCollapsed((prev) => ({ ...prev, [catName]: !prev[catName] }))}
                className="flex items-center gap-2.5 mb-3">
                {collapsed[catName] ? <ChevronRight size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
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
                      <div className="flex gap-2 flex-wrap mb-3">
                        {["All", ...subcats].map((s) => (
                          <button key={s} onClick={() => setActiveSub((prev) => ({ ...prev, [catName]: s }))}
                            className={`px-3 py-1 rounded-lg text-xs font-medium transition border ${currentSub === s ? "bg-blue-600 text-white border-blue-600" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-3 overflow-x-auto pb-2">
                      {visibleItems.map((p) => {
                        const pendingEntries = productOrderMap.get(p.id) ?? [];
                        const pendingQty = pendingEntries.reduce((s, e) => s + e.quantity, 0);
                        const isOpen = activePopover === p.id;
                        const inCart = cart.find((i) => i.id === p.id);
                        return (
                          <div key={p.id} className={`relative bg-white rounded-xl border flex flex-col hover:shadow-sm transition flex-shrink-0 w-44
                            ${inCart ? "border-blue-300 ring-2 ring-blue-100" : pendingEntries.length > 0 ? "border-orange-300 ring-2 ring-orange-100" : "border-gray-200 hover:border-blue-200"}`}>

                            {pendingEntries.length > 0 && (
                              <button onClick={(e) => {
                                if (isOpen) { setActivePopover(null); setPopoverPos(null); return; }
                                const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                                setPopoverPos({ top: rect.bottom + window.scrollY + 6, left: rect.left + window.scrollX - 180 });
                                setActivePopover(p.id);
                              }}
                                className={`absolute top-2 right-2 z-10 flex items-center gap-1 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow transition
                                  ${isOpen ? "bg-orange-600" : "bg-orange-500 hover:bg-orange-600"}`}>
                                <Package size={9} /> {pendingEntries.length} · {pendingQty}
                              </button>
                            )}

                            <div className="w-full h-28 bg-gray-50 flex items-center justify-center border-b border-gray-100 overflow-hidden rounded-t-xl">
                              {p.image ? (
                                <Image src={p.image} alt={p.name} width={176} height={112} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500 font-bold text-lg">{p.name.charAt(0)}</div>
                              )}
                            </div>

                            <div className="p-2.5 flex flex-col flex-1">
                              <p className="text-xs font-semibold text-gray-900 leading-tight line-clamp-2">{p.name}</p>
                              {p.subcategory && <span className="text-[10px] text-blue-500 font-medium mt-0.5">{p.subcategory}</span>}
                              <div className="mt-auto pt-2 flex items-center justify-between">
                                <span className="text-sm font-bold text-gray-900">₱{p.price.toFixed(2)}</span>
                                <span className={`text-[10px] font-semibold ${p.stock === 0 ? "text-red-500" : p.stock <= 5 ? "text-orange-500" : "text-green-600"}`}>
                                  {p.stock === 0 ? "Out" : `${p.stock} left`}
                                </span>
                              </div>
                            </div>

                            <div className="px-2.5 pb-2.5">
                              {inCart ? (
                                <div className="flex items-center justify-between gap-1">
                                  <button onClick={() => updateQty(p.id, inCart.quantity - 1)} className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm flex items-center justify-center">−</button>
                                  <span className="text-sm font-semibold text-gray-800">{inCart.quantity}</span>
                                  <button onClick={() => updateQty(p.id, inCart.quantity + 1)} className="w-7 h-7 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm flex items-center justify-center">+</button>
                                  <button onClick={() => setCart((prev) => prev.filter((c) => c.id !== p.id))} className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 text-red-400 flex items-center justify-center"><Trash2 size={11} /></button>
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
              <Clock size={28} className="mx-auto mb-2 opacity-30" />
              No pending orders right now.
            </div>
          ) : orders.filter((o) => o.status === "pending").map((order) => (
            <div key={order.id} className="bg-white rounded-xl border border-orange-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-orange-50/60 border-b border-orange-100">
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-orange-500" />
                  <span className="font-semibold text-gray-900 text-sm">Order #{order.id}</span>
                  <span className="text-xs text-gray-500">— {order.customer.username}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-900">₱{order.totalAmount.toFixed(2)}</span>
                  <button onClick={() => loadOrderToCart(order)}
                    className="flex items-center gap-1.5 text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg transition">
                    <ShoppingCart size={12} /> Load to Cart
                  </button>
                </div>
              </div>
              <div className="divide-y divide-gray-50">
                {order.items.map((item) => {
                  const product = products.find((p) => p.id === item.productId);
                  return (
                    <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                        {product?.image ? <Image src={product.image} alt={product.name} width={32} height={32} className="w-full h-full object-cover" /> : <Package size={14} className="text-gray-300" />}
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

      {/* Floating Cart Button */}
      {cartCount > 0 && (
        <button onClick={() => setCartOpen(true)}
          className="fixed top-[68px] right-6 z-50 flex items-center gap-2.5 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-2xl shadow-xl shadow-blue-500/30 font-semibold text-sm transition">
          <ShoppingCart size={18} />
          <span>{cartCount} item{cartCount > 1 ? "s" : ""}</span>
          <span className="bg-white/20 rounded-xl px-2 py-0.5">₱{total.toFixed(2)}</span>
        </button>
      )}

      {/* Cart Drawer */}
      {cartOpen && createPortal(
        <div className="fixed inset-0 z-[150] flex justify-end">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setCartOpen(false)} />
          <div className="relative bg-white w-full max-w-sm h-full flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <ShoppingCart size={18} className="text-blue-600" />
                <span className="font-semibold text-gray-900">Cart</span>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{cartCount} items</span>
              </div>
              <button onClick={() => setCartOpen(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition"><X size={16} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.map((i) => (
                <div key={i.id} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                  <div className="w-10 h-10 rounded-lg bg-white border border-gray-100 overflow-hidden flex-shrink-0 flex items-center justify-center">
                    {i.image ? <Image src={i.image} alt={i.name} width={40} height={40} className="w-full h-full object-cover" /> : <Package size={14} className="text-gray-300" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{i.name}</p>
                    <p className="text-xs text-gray-400">₱{i.price.toFixed(2)} each</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => updateQty(i.id, i.quantity - 1)} className="w-6 h-6 rounded-lg bg-white border border-gray-200 text-gray-600 font-bold text-xs flex items-center justify-center">−</button>
                    <span className="w-6 text-center text-sm font-semibold">{i.quantity}</span>
                    <button onClick={() => updateQty(i.id, i.quantity + 1)} className="w-6 h-6 rounded-lg bg-white border border-gray-200 text-gray-600 font-bold text-xs flex items-center justify-center">+</button>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-gray-900">₱{(i.price * i.quantity).toFixed(2)}</p>
                    <button onClick={() => setCart((prev) => prev.filter((c) => c.id !== i.id))} className="text-[10px] text-red-400 hover:text-red-600 transition">remove</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-gray-100 space-y-3">
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
              <button onClick={handleCheckout} disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 text-sm font-semibold transition disabled:opacity-60 shadow-lg shadow-blue-500/20">
                {loading ? "Processing..." : `Checkout — ₱${total.toFixed(2)}`}
              </button>
              <button onClick={() => { setCart([]); setCartOpen(false); }} className="w-full text-xs text-gray-400 hover:text-red-500 transition py-1">Clear cart</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Popover for pending orders per product */}
      {activePopover !== null && popoverPos && (() => {
        const p = products.find((prod) => prod.id === activePopover);
        const pendingEntries = p ? (productOrderMap.get(p.id) ?? []) : [];
        if (!p) return null;
        return createPortal(
          <div ref={popoverRef} style={{ position: "absolute", top: popoverPos.top, left: popoverPos.left }}
            className="z-[200] w-60 bg-white border border-orange-200 rounded-xl shadow-xl p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
              <Package size={12} className="text-orange-500" /> Pending for <span className="text-orange-600 truncate">{p.name}</span>
            </p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {pendingEntries.map((entry) => (
                <div key={entry.orderItemId} className="flex items-center justify-between bg-orange-50 rounded-lg px-2.5 py-2">
                  <div>
                    <p className="text-xs font-medium text-gray-800">{entry.customer}</p>
                    <p className="text-[10px] text-gray-500">Order #{entry.orderId} · qty {entry.quantity}</p>
                  </div>
                  <button onClick={() => fulfillOrder(entry.orderId, p, entry.quantity)}
                    className="text-[10px] font-semibold bg-orange-500 hover:bg-orange-600 text-white px-2 py-1 rounded-lg transition shrink-0">
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
