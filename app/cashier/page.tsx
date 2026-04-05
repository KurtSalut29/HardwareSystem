"use client";

import { useState, useEffect, useCallback } from "react";
import LogoutButton from "@/components/LogoutButton";

type Product = { id: number; name: string; category: string; price: number; stock: number };
type CartItem = Product & { quantity: number };
type TransactionItem = { id: number; quantity: number; price: number; product: { name: string } };
type Transaction = { id: number; totalAmount: number; paymentMethod: string; dateTime: string; items: TransactionItem[] };

const TABS = ["New Transaction", "My Transactions"] as const;
type Tab = typeof TABS[number];

export default function CashierDashboard() {
  const [tab, setTab] = useState<Tab>("New Transaction");
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const fetchProducts = useCallback(async () => {
    const res = await fetch("/api/products");
    setProducts(await res.json());
  }, []);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/transactions");
    setTransactions(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  useEffect(() => { if (tab === "My Transactions") fetchTransactions(); }, [tab, fetchTransactions]);

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) || p.category.toLowerCase().includes(search.toLowerCase())
  );

  function addToCart(product: Product) {
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      if (product.stock === 0) return prev;
      return [...prev, { ...product, quantity: 1 }];
    });
  }

  function updateQty(id: number, qty: number) {
    if (qty <= 0) { setCart(prev => prev.filter(i => i.id !== id)); return; }
    const product = products.find(p => p.id === id);
    if (product && qty > product.stock) return;
    setCart(prev => prev.map(i => i.id === id ? { ...i, quantity: qty } : i));
  }

  const total = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);

  async function handleCheckout() {
    if (!cart.length) return;
    setError(""); setSuccess("");
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: cart.map(i => ({ productId: i.id, quantity: i.quantity, price: i.price })),
        paymentMethod,
      }),
    });
    if (!res.ok) { setError((await res.json()).error); return; }
    setCart([]);
    setSuccess("Transaction completed!");
    fetchProducts();
    setTimeout(() => setSuccess(""), 3000);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Cashier Dashboard</h1>
            <p className="text-gray-500 text-sm">Process POS transactions</p>
          </div>
          <LogoutButton />
        </div>

        <div className="flex gap-2 mb-6 border-b border-gray-200">
          {TABS.map(t => (
            <button key={t} onClick={() => { setTab(t); setError(""); setSuccess(""); }}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition ${tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              {t}
            </button>
          ))}
        </div>

        {/* NEW TRANSACTION */}
        {tab === "New Transaction" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Product list */}
            <div className="lg:col-span-2 space-y-3">
              <input
                placeholder="Search products..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {filtered.map(p => (
                  <button key={p.id} onClick={() => addToCart(p)} disabled={p.stock === 0}
                    className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 text-left hover:border-blue-300 hover:shadow-md transition disabled:opacity-40 disabled:cursor-not-allowed">
                    <p className="font-medium text-gray-800 text-sm truncate">{p.name}</p>
                    <p className="text-xs text-gray-400">{p.category}</p>
                    <p className="text-blue-600 font-semibold text-sm mt-1">₱{p.price.toFixed(2)}</p>
                    <p className={`text-xs mt-0.5 ${p.stock <= 5 ? "text-red-500" : "text-gray-400"}`}>Stock: {p.stock}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Cart */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col gap-3 h-fit">
              <h2 className="font-semibold text-gray-700">Cart</h2>
              {cart.length === 0 && <p className="text-gray-400 text-sm text-center py-4">No items added</p>}
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
                  <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>Cash</option>
                    <option>GCash</option>
                    <option>Card</option>
                  </select>
                  {error && <p className="text-red-500 text-xs">{error}</p>}
                  {success && <p className="text-green-600 text-xs">{success}</p>}
                  <button onClick={handleCheckout} className="bg-blue-600 text-white rounded-lg py-2 text-sm font-semibold hover:bg-blue-700 transition">
                    Checkout
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* MY TRANSACTIONS */}
        {tab === "My Transactions" && (
          <div className="space-y-3">
            {loading && <p className="text-gray-400 text-sm">Loading...</p>}
            {transactions.map(t => (
              <div key={t.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="font-semibold text-gray-800">#{t.id}</span>
                    <span className="ml-2 text-xs text-gray-400">{new Date(t.dateTime).toLocaleString()}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-800">₱{t.totalAmount.toFixed(2)}</p>
                    <p className="text-xs text-gray-400">{t.paymentMethod}</p>
                  </div>
                </div>
                <div className="text-xs text-gray-500 space-y-0.5">
                  {t.items.map(i => (
                    <div key={i.id} className="flex justify-between">
                      <span>{i.product.name} × {i.quantity}</span>
                      <span>₱{(i.price * i.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {transactions.length === 0 && !loading && <p className="text-gray-400 text-sm text-center py-8">No transactions yet.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
