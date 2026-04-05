"use client";

import { useState, useEffect, useCallback } from "react";
import LogoutButton from "@/components/LogoutButton";
import Toast from "@/components/ui/Toast";

type Product = { id: number; name: string; category: string; price: number; stock: number };
type CartItem = Product & { quantity: number };
type OrderItem = { id: number; quantity: number; price: number; product: { name: string } };
type Order = { id: number; totalAmount: number; status: string; dateTime: string; items: OrderItem[] };

const TABS = ["Browse Products", "My Orders"] as const;
type Tab = typeof TABS[number];

export default function CustomerPortal() {
  const [tab, setTab] = useState<Tab>("Browse Products");
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [toast, setToast] = useState<{ msg: string; variant: "success" | "error" | "warning" | "info" } | null>(null);

  function showToast(msg: string, variant: "success" | "error" | "warning" | "info" = "success") {
    setToast({ msg, variant });
    setTimeout(() => setToast(null), 3000);
  }

  const fetchProducts = useCallback(async () => {
    const res = await fetch("/api/products");
    setProducts(await res.json());
  }, []);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/orders");
    setOrders(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  useEffect(() => { if (tab === "My Orders") fetchOrders(); }, [tab, fetchOrders]);

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase())
  );

  function addToCart(product: Product) {
    if (product.stock === 0) { showToast(`"${product.name}" is out of stock.`, "error"); return; }
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) { showToast(`Only ${product.stock} left in stock for "${product.name}".`, "warning"); return prev; }
        return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  }

  function updateQty(id: number, qty: number) {
    if (qty <= 0) { setCart(prev => prev.filter(i => i.id !== id)); return; }
    const product = products.find(p => p.id === id);
    if (product && qty > product.stock) { showToast(`Only ${product.stock} left in stock for "${product.name}".`, "warning"); return; }
    setCart(prev => prev.map(i => i.id === id ? { ...i, quantity: qty } : i));
  }

  const total = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  async function handlePlaceOrder() {
    if (!cart.length) return;
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: cart.map(i => ({ productId: i.id, quantity: i.quantity, price: i.price })) }),
    });
    if (!res.ok) { showToast((await res.json()).error, "error"); return; }
    setCart([]);
    setShowCart(false);
    showToast("Order placed successfully!");
    fetchProducts();
  }

  const statusColor: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700",
    confirmed: "bg-blue-100 text-blue-700",
    delivered: "bg-green-100 text-green-700",
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Toast message={toast?.msg ?? ""} variant={toast?.variant} />
      <div className="max-w-5xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Customer Portal</h1>
            <p className="text-gray-500 text-sm">Browse products and place orders</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowCart(!showCart)} className="relative bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
              🛒 Cart
              {cartCount > 0 && <span className="absolute -top-1.5 -right-1.5 bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">{cartCount}</span>}
            </button>
            <LogoutButton />
          </div>
        </div>

        <div className="flex gap-2 mb-6 border-b border-gray-200">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition ${tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              {t}
            </button>
          ))}
        </div>

        {/* BROWSE PRODUCTS */}
        {tab === "Browse Products" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-3">
              <input
                placeholder="Search products..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {filtered.map(p => (
                  <div key={p.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-3">
                    <p className="font-medium text-gray-800 text-sm truncate">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.category}</p>
                    <p className="text-blue-600 font-semibold text-sm mt-1">₱{p.price.toFixed(2)}</p>
                    <p className={`text-xs mt-0.5 ${p.stock === 0 ? "text-red-500" : p.stock <= 5 ? "text-orange-500" : "text-gray-400"}`}>
                      {p.stock === 0 ? "Out of stock" : `Stock: ${p.stock}`}
                    </p>
                    <button onClick={() => addToCart(p)} disabled={p.stock === 0}
                      className="mt-2 w-full bg-blue-600 text-white rounded-lg py-1.5 text-xs font-semibold hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed">
                      Add to Cart
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Cart panel */}
            {showCart && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col gap-3 h-fit">
                <h2 className="font-semibold text-gray-700">Your Cart</h2>
                {cart.length === 0 && <p className="text-gray-400 text-sm text-center py-4">Cart is empty</p>}
                {cart.map(i => (
                  <div key={i.id} className="flex items-center gap-2 text-sm">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 truncate">{i.name}</p>
                      <p className="text-gray-400 text-xs">₱{i.price.toFixed(2)} each</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => updateQty(i.id, i.quantity - 1)} className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-xs">−</button>
                      <span className="w-6 text-center text-sm">{i.quantity}</span>
                      <button onClick={() => updateQty(i.id, i.quantity + 1)} className="w-6 h-6 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-xs">+</button>
                    </div>
                    <span className="text-gray-700 font-medium w-16 text-right">₱{(i.price * i.quantity).toFixed(2)}</span>
                  </div>
                ))}
                {cart.length > 0 && (
                  <>
                    <div className="border-t border-gray-100 pt-2 flex justify-between font-bold text-gray-800">
                      <span>Total</span>
                      <span>₱{total.toFixed(2)}</span>
                    </div>
                    <button onClick={handlePlaceOrder} className="bg-blue-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-blue-700 transition">
                      Place Order
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* MY ORDERS */}
        {tab === "My Orders" && (
          <div className="space-y-3">
            {loading && <p className="text-gray-400 text-sm">Loading...</p>}
            {orders.map(o => (
              <div key={o.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="font-semibold text-gray-800">Order #{o.id}</span>
                    <span className="ml-2 text-xs text-gray-400">{new Date(o.dateTime).toLocaleString()}</span>
                  </div>
                  <div className="text-right flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor[o.status] ?? "bg-gray-100 text-gray-600"}`}>{o.status}</span>
                    <p className="font-bold text-gray-800">₱{o.totalAmount.toFixed(2)}</p>
                  </div>
                </div>
                <div className="text-xs text-gray-500 space-y-0.5">
                  {o.items.map(i => (
                    <div key={i.id} className="flex justify-between">
                      <span>{i.product.name} × {i.quantity}</span>
                      <span>₱{(i.price * i.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {orders.length === 0 && !loading && <p className="text-gray-400 text-sm text-center py-8">No orders yet.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
