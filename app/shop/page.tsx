"use client";

import { useEffect, useState, useCallback } from "react";
import { Search, ShoppingCart, Trash2, CheckCircle, ChevronDown, ChevronRight } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import Image from "next/image";
import LocationPicker, { PickedLocation } from "@/components/LocationPicker";

type Category = { id: number; name: string };
type Product = { id: number; name: string; category: Category; categoryId: number; subcategory: string | null; price: number; unit: string; stock: number; image: string | null; description: string | null };
type CartItem = Product & { quantity: number };

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

  const fetchProducts = useCallback(async () => {
    const [pRes, cRes] = await Promise.all([fetch("/api/products"), fetch("/api/categories")]);
    setProducts(await pRes.json());
    setCategories(await cRes.json());
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

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

  function addToCart(product: Product) {
    if (product.stock === 0) return;
    setCart((prev) => {
      const ex = prev.find((i) => i.id === product.id);
      if (ex) {
        if (ex.quantity >= product.stock) return prev;
        return prev.map((i) => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...product, quantity: 1 }];
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

  async function handleOrder() {
    if (!cart.length) return;
    setError(""); setLoading(true);
    const res = await fetch("/api/orders", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: cart.map((i) => ({ productId: i.id, quantity: i.quantity, price: i.price })),
        ...(pickedLocation ? {
          deliveryAddress: pickedLocation.address,
          latitude: pickedLocation.lat,
          longitude: pickedLocation.lng,
        } : {}),
      }),
    });
    setLoading(false);
    if (!res.ok) { setError((await res.json()).error); return; }
    setCart([]); setPickedLocation(null); setShowCart(false); setSuccess(true); fetchProducts();
    setTimeout(() => setSuccess(false), 4000);
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Shop"
        subtitle="Browse and order hardware products"
        action={
          <button onClick={() => setShowCart(true)} className="relative flex items-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium transition shadow-sm">
            <ShoppingCart size={16} /> Cart
            {cartCount > 0 && <span className="absolute -top-2 -right-2 w-5 h-5 bg-blue-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{cartCount}</span>}
          </button>
        }
      />

      {success && (
        <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-emerald-700 text-sm font-medium">
          <CheckCircle size={18} /> Order placed successfully! Check your orders for status updates.
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition shadow-sm" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {["All", ...categories.map((c) => c.name)].map((c) => (
            <button key={c} onClick={() => setFilterCat(c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filterCat === c ? "bg-blue-600 text-white shadow-sm" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Grouped Product Cards */}
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
                      const inCart = cart.find((i) => i.id === p.id);
                      return (
                        <div key={p.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col hover:border-blue-200 hover:shadow-sm transition flex-shrink-0 w-48">
                          {/* Image */}
                          <div className="w-full h-36 bg-gray-50 flex items-center justify-center border-b border-gray-100 overflow-hidden">
                            {p.image ? (
                              <Image src={p.image} alt={p.name} width={192} height={144} className="w-full h-full object-cover" />
                            ) : (
                              <div className="flex flex-col items-center gap-1">
                                <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500 font-bold text-xl">
                                  {p.name.charAt(0)}
                                </div>
                                <span className="text-[10px] text-gray-300">No image</span>
                              </div>
                            )}
                          </div>

                          {/* Details */}
                          <div className="p-3 flex flex-col flex-1">
                            <p className="text-sm font-semibold text-gray-900 leading-tight line-clamp-2">{p.name}</p>
                            {p.subcategory && <span className="text-[10px] text-blue-500 font-medium mt-0.5">{p.subcategory}</span>}
                            {p.description && <p className="text-[11px] text-gray-400 mt-1 line-clamp-2">{p.description}</p>}

                            <div className="mt-auto pt-2 space-y-1">
                              <div className="flex items-baseline gap-1">
                                <span className="text-base font-bold text-gray-900">₱{p.price.toFixed(2)}</span>
                                <span className="text-[11px] text-gray-400 font-medium">per {p.unit}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-[11px] text-gray-500">Stock:</span>
                                <span className={`text-[11px] font-bold ${p.stock === 0 ? "text-red-500" : p.stock <= 5 ? "text-orange-500" : "text-green-600"}`}>
                                  {p.stock === 0 ? "Out of stock" : p.stock}
                                </span>
                              </div>
                            </div>

                            <button onClick={() => addToCart(p)} disabled={p.stock === 0}
                              className="mt-2 w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg py-1.5 text-xs font-semibold transition">
                              {inCart ? `In cart (${inCart.quantity})` : "Add to Cart"}
                            </button>
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
      {showCart && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setShowCart(false)} />
          <div className="w-full max-w-sm bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h2 className="font-semibold text-gray-800 flex items-center gap-2"><ShoppingCart size={18} /> Your Cart</h2>
              <button onClick={() => setShowCart(false)} className="text-gray-400 hover:text-gray-600 text-xl font-light">×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {cart.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <ShoppingCart size={40} className="mx-auto mb-3 opacity-20" />
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
                    <button onClick={() => updateQty(i.id, i.quantity - 1)} className="w-6 h-6 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-bold transition flex items-center justify-center">−</button>
                    <span className="w-6 text-center text-sm">{i.quantity}</span>
                    <button onClick={() => updateQty(i.id, i.quantity + 1)} className="w-6 h-6 rounded-lg bg-gray-100 hover:bg-gray-200 text-xs font-bold transition flex items-center justify-center">+</button>
                  </div>
                  <button onClick={() => setCart((prev) => prev.filter((c) => c.id !== i.id))} className="p-1 text-gray-300 hover:text-red-400 transition"><Trash2 size={13} /></button>
                </div>
              ))}
            </div>
            {cart.length > 0 && (
              <div className="p-5 border-t border-gray-100 space-y-3">
                <div className="flex justify-between font-bold text-gray-800">
                  <span>Total</span>
                  <span className="text-lg">₱{total.toFixed(2)}</span>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Delivery Location <span className="text-gray-400 font-normal">(optional)</span></label>
                  <LocationPicker value={pickedLocation} onChange={setPickedLocation} />
                </div>
                {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
                <button onClick={handleOrder} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 text-sm font-semibold transition disabled:opacity-60 shadow-lg shadow-blue-500/20">
                  {loading ? "Placing order..." : "Place Order"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
