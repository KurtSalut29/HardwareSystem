"use client";

import { useState } from "react";
import Image from "next/image";
import { Minus, Plus, ShoppingCart } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { ICON_SIZE } from "@/lib/constants/icon-size";

export type CartProduct = {
  id: number; name: string; price: number; unit: string; stock: number;
  image: string | null; description: string | null; subcategory: string | null; brand?: string | null;
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
    <Modal open onClose={onClose} title="Add to cart" icon={<ShoppingCart className="size-5" />} description="Choose how many, then add it to your order." size="md">
      <div className="space-y-4">
        <div className="flex gap-3">
          <div className="relative w-20 h-20 rounded-xl bg-subtle border border-line overflow-hidden shrink-0">
            {product.image
              ? <Image src={product.image} alt={product.name} fill sizes="80px" className="object-cover" />
              : <div className="absolute inset-0 flex items-center justify-center text-white font-display font-extrabold text-xl" style={{ background: "linear-gradient(155deg, var(--brand), var(--brand-ink))" }}>{product.name.charAt(0)}</div>}
          </div>
          <div className="min-w-0">
            {(product.brand || product.subcategory) && (
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-4">
                {product.brand && <span className="text-brand">{product.brand}</span>}
                {product.brand && product.subcategory && " · "}
                {product.subcategory}
              </p>
            )}
            <p className="font-semibold text-ink leading-snug">{product.name}</p>
            <p className="text-sm text-ink-2 mt-0.5"><span className="font-display font-extrabold num">{peso(product.price)}</span> <span className="text-xs text-ink-4">per {product.unit}</span></p>
            <p className="text-[11px] mt-0.5" style={{ color: available > 0 ? "var(--good)" : "var(--bad)" }}>
              {available > 0 ? `${available} ${product.unit} available` : "No more stock available"}
              {inCart > 0 && <span className="text-ink-4"> · {inCart} {product.unit} already in cart</span>}
            </p>
          </div>
        </div>

        {siblings.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold text-ink-3 mb-1.5">Other {product.subcategory}</p>
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
              {[product, ...siblings].map((s) => {
                const active = s.id === product.id;
                return (
                  <button key={s.id} type="button" disabled={s.stock <= 0} onClick={() => !active && onSwitch(s)} aria-pressed={active}
                    className={`shrink-0 text-left rounded-lg border px-2.5 py-1.5 transition disabled:opacity-40 ${active ? "border-brand bg-brand-soft" : "border-line hover:bg-subtle"}`}>
                    <span className={`block text-xs font-semibold max-w-[150px] truncate ${active ? "text-brand" : "text-ink"}`}>{s.name}</span>
                    {s.brand && <span className="block text-[10px] text-ink-3 max-w-[150px] truncate">{s.brand}</span>}
                    <span className="block text-[10px] text-ink-3 num">{s.stock > 0 ? `${peso(s.price)}/${s.unit}` : "Out of stock"}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <label htmlFor="cart-qty" className="mb-1.5 block text-[12.5px] font-semibold text-ink-2">Quantity ({product.unit})</label>
          {isKg && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {KG_PRESETS.filter((v) => v <= available).map((v) => (
                <button key={v} type="button" onClick={() => set(v)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${qty === v ? "bg-brand text-white" : "bg-brand-soft text-brand hover:bg-brand-soft"}`}>
                  {kgLabel(v)}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Less" onClick={() => set((qty || 0) - step)} disabled={!(qty > step - 1e-9)}
              className="w-10 h-10 rounded-xl border border-line flex items-center justify-center text-ink-2 hover:bg-subtle disabled:opacity-40"><Minus size={ICON_SIZE.sm} /></button>
            <input id="cart-qty" type="number" inputMode={isKg ? "decimal" : "numeric"} min={step} step={isKg ? "0.01" : "1"} max={available}
              value={raw} onChange={(e) => setRaw(e.target.value)}
              className="w-24 text-center border border-line rounded-xl px-2 py-2 text-base font-semibold num focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand" />
            <button type="button" aria-label="More" onClick={() => set((qty || 0) + step)} disabled={qty + step > available + 1e-9}
              className="w-10 h-10 rounded-xl border border-line flex items-center justify-center text-ink-2 hover:bg-subtle disabled:opacity-40"><Plus size={ICON_SIZE.sm} /></button>
            <div className="ml-auto text-right">
              <p className="text-[10px] text-ink-4 uppercase tracking-wide">Subtotal</p>
              <p className="font-display font-extrabold text-lg text-ink num">{peso(valid ? qty * product.price : 0)}</p>
            </div>
          </div>
          {raw !== "" && !valid && (
            <p className="text-[11px] mt-1.5 text-bad">
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
