"use client";

import { useState } from "react";
import Image from "next/image";
import { Minus, Plus, ShoppingCart } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { ICON_SIZE } from "@/lib/constants/icon-size";

export type CartProduct = {
  id: number; name: string; price: number; unit: string; stock: number;
  image: string | null; description: string | null; subcategory: string | null;
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const KG_PRESETS = [0.25, 0.5, 1, 2, 5];
const kgLabel = (v: number) => (v === 0.25 ? "¼ kg" : v === 0.5 ? "½ kg" : `${v} kg`);
const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Choosing how much to buy before it goes in the cart: a quantity stepper (or
 * kilo presets), the stock left, and the subtotal. Products in the same
 * subcategory are listed so a customer can switch size or type here, e.g. from
 * 2" to 3" nails, without going back to the grid.
 */
export default function AddToCartModal({ product, siblings, inCart, onSwitch, onAdd, onClose }: {
  product: CartProduct;
  /** Other products in the same subcategory. */
  siblings: CartProduct[];
  /** How many of this product are already in the cart. */
  inCart: number;
  onSwitch: (p: CartProduct) => void;
  onAdd: (p: CartProduct, qty: number) => void;
  onClose: () => void;
}) {
  const isKg = product.unit === "kg";
  const step = isKg ? 0.25 : 1;
  const available = round2(product.stock - inCart);
  const [raw, setRaw] = useState(() => String(Math.min(isKg ? 1 : 1, Math.max(available, 0)) || ""));
  const [productId, setProductId] = useState(product.id);

  // Switching to a sibling resets the quantity for that product.
  if (productId !== product.id) {
    setProductId(product.id);
    setRaw(String(Math.min(1, Math.max(available, 0)) || ""));
  }

  const qty = round2(Number(raw));
  const valid = Number.isFinite(qty) && qty > 0 && qty <= available + 1e-9 && (isKg || Number.isInteger(qty));
  const set = (n: number) => setRaw(String(round2(Math.min(Math.max(n, 0), available))));

  return (
    <Modal open onClose={onClose} title="Add to cart" size="md">
      <div className="space-y-4">
        <div className="flex gap-3">
          <div className="relative w-20 h-20 rounded-xl bg-gray-50 border border-gray-100 overflow-hidden shrink-0">
            {product.image
              ? <Image src={product.image} alt={product.name} fill sizes="80px" className="object-cover" />
              : <div className="absolute inset-0 flex items-center justify-center text-white font-display font-extrabold text-xl" style={{ background: "linear-gradient(155deg, var(--brand), var(--brand-ink))" }}>{product.name.charAt(0)}</div>}
          </div>
          <div className="min-w-0">
            {product.subcategory && <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{product.subcategory}</p>}
            <p className="font-semibold text-gray-900 leading-snug">{product.name}</p>
            <p className="text-sm text-gray-700 mt-0.5"><span className="font-display font-extrabold num">{peso(product.price)}</span> <span className="text-xs text-gray-400">per {product.unit}</span></p>
            <p className="text-[11px] mt-0.5" style={{ color: available > 0 ? "var(--good)" : "var(--bad)" }}>
              {available > 0 ? `${available} ${product.unit} available` : "No more stock available"}
              {inCart > 0 && <span className="text-gray-400"> · {inCart} {product.unit} already in cart</span>}
            </p>
          </div>
        </div>

        {siblings.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold text-gray-500 mb-1.5">Other {product.subcategory}</p>
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
              {[product, ...siblings].map((s) => {
                const active = s.id === product.id;
                return (
                  <button key={s.id} type="button" disabled={s.stock <= 0} onClick={() => !active && onSwitch(s)} aria-pressed={active}
                    className={`shrink-0 text-left rounded-lg border px-2.5 py-1.5 transition disabled:opacity-40 ${active ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:bg-gray-50"}`}>
                    <span className={`block text-xs font-semibold max-w-[150px] truncate ${active ? "text-blue-700" : "text-gray-800"}`}>{s.name}</span>
                    <span className="block text-[10px] text-gray-500 num">{s.stock > 0 ? `${peso(s.price)}/${s.unit}` : "Out of stock"}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <label htmlFor="cart-qty" className="block text-xs font-medium text-gray-600 mb-1.5">Quantity ({product.unit})</label>
          {isKg && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {KG_PRESETS.filter((v) => v <= available).map((v) => (
                <button key={v} type="button" onClick={() => set(v)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${qty === v ? "bg-blue-600 text-white" : "bg-blue-50 text-blue-600 hover:bg-blue-100"}`}>
                  {kgLabel(v)}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Less" onClick={() => set((qty || 0) - step)} disabled={!(qty > step - 1e-9)}
              className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-40"><Minus size={ICON_SIZE.sm} /></button>
            <input id="cart-qty" type="number" inputMode={isKg ? "decimal" : "numeric"} min={step} step={isKg ? "0.01" : "1"} max={available}
              value={raw} onChange={(e) => setRaw(e.target.value)}
              className="w-24 text-center border border-gray-200 rounded-xl px-2 py-2 text-base font-semibold num focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
            <button type="button" aria-label="More" onClick={() => set((qty || 0) + step)} disabled={qty + step > available + 1e-9}
              className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 disabled:opacity-40"><Plus size={ICON_SIZE.sm} /></button>
            <div className="ml-auto text-right">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">Subtotal</p>
              <p className="font-display font-extrabold text-lg text-gray-900 num">{peso(valid ? qty * product.price : 0)}</p>
            </div>
          </div>
          {raw !== "" && !valid && (
            <p className="text-[11px] mt-1.5" style={{ color: "var(--bad)" }}>
              {qty > available ? `Only ${available} ${product.unit} available.` : !isKg && !Number.isInteger(qty) ? "Enter a whole number." : "Enter a quantity."}
            </p>
          )}
        </div>

        <Button className="w-full" disabled={!valid} icon={<ShoppingCart size={ICON_SIZE.sm} />} onClick={() => onAdd(product, qty)}>
          Add {valid ? `${qty} ${product.unit}` : ""} to cart
        </Button>
      </div>
    </Modal>
  );
}
