import { ShoppingCart } from "lucide-react";
import ProductThumb from "@/components/catalog/ProductThumb";
import StockMeter from "@/components/catalog/StockMeter";
import { fmtQty, peso, productCode, stockState } from "@/lib/catalog-ui";

export type ShelfProduct = {
  id: number;
  name: string;
  brand?: string | null;
  price: number;
  unit: string;
  stock: number;
  image: string | null;
  description?: string | null;
  subcategory: string | null;
  category?: { name: string } | null;
};

/**
 * A product as a card whose bottom is a shelf tag: the price label you'd see
 * clipped to a hardware store shelf, with the item code and how much is left.
 * The same card serves the catalogue (staff), the shop (customers) and the POS;
 * only the footer and the stock wording change.
 */
export default function ShelfCard({
  product: p, reorderAt, audience, onOpen, openLabel, inCart = 0, footer,
}: {
  product: ShelfProduct;
  /** Stock at or below this reads as "running low". */
  reorderAt: number;
  /** staff see exact counts and the reorder line; customers see availability. */
  audience: "staff" | "customer";
  onOpen?: () => void;
  /** What clicking the card does, for screen readers ("Edit Claw Hammer"). */
  openLabel?: string;
  inCart?: number;
  footer?: React.ReactNode;
}) {
  const state = stockState(p.stock, reorderAt);
  const qty = `${fmtQty(p.stock)} ${p.unit}`;
  const stockText =
    state === "out" ? "Out of stock"
      : audience === "customer" ? (state === "low" ? `Only ${qty} left` : "In stock")
      : state === "low" ? `${qty} left` : qty;

  const body = (
    <>
      <div className="relative">
        <ProductThumb image={p.image} name={p.name} category={p.category?.name} subcategory={p.subcategory} className="aspect-[4/3]" />
        {state !== "ok" && (
          <span className={`absolute left-2.5 top-2.5 rounded-full px-2 py-0.5 text-[10.5px] font-bold shadow-sm ring-1 ring-black/5 ${
            state === "out" ? "bg-bad-soft text-bad" : "bg-warn-soft text-warn"}`}>
            {state === "out" ? "Out of stock" : "Running low"}
          </span>
        )}
        {inCart > 0 && (
          <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-brand px-2 py-0.5 text-[10.5px] font-bold text-white shadow-sm">
            <ShoppingCart className="size-3" /> {fmtQty(inCart)} in cart
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col px-3 pb-3 pt-3 min-[360px]:px-3.5 min-[360px]:pb-3.5">
        <div className="flex items-center justify-between gap-2">
          <p className="min-w-0 truncate text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-4">
            {p.brand && <span className="text-brand">{p.brand}</span>}
            {p.brand && p.subcategory && <span> · </span>}
            {p.subcategory}
          </p>
          {audience === "staff" && <span className="shrink-0 font-code text-[10px] font-medium tracking-wide text-ink-4">{productCode(p)}</span>}
        </div>
        <h3 className="mt-0.5 line-clamp-2 min-h-[2.6em] text-[14.5px] font-semibold leading-snug text-ink">{p.name}</h3>

        {/* The shelf tag */}
        <div className="relative mt-3 rounded-lg border border-line bg-subtle py-2 pl-3 pr-2.5 before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-r-full before:bg-brand">
          {/* On the narrowest phones the unit drops under the price instead of being cut off */}
          <p className="num flex flex-wrap items-baseline gap-x-0.5 leading-tight">
            <span className="font-display text-[17px] font-extrabold tracking-tight text-ink min-[360px]:text-[19px]">{peso(p.price)}</span>
            <span className="text-xs font-medium text-ink-3">/{p.unit}</span>
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1" title={audience === "staff" ? `${qty} on hand · reorder at ${fmtQty(reorderAt)} ${p.unit}` : undefined}>
            <StockMeter stock={p.stock} reorderAt={reorderAt} state={state} className="shrink-0" />
            <span className={`min-w-0 flex-1 text-[11.5px] font-medium leading-snug ${state === "out" ? "text-bad" : state === "low" ? "text-warn" : "text-ink-3"}`}>
              {stockText}
            </span>
          </div>
        </div>
      </div>
    </>
  );

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(16,24,64,0.04)] transition duration-200 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-[0_14px_30px_-18px_rgba(18,50,127,0.45)]">
      {onOpen ? (
        <button type="button" onClick={onOpen} aria-label={openLabel}
          className="flex flex-1 flex-col text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand">
          {body}
        </button>
      ) : (
        <div className="flex flex-1 flex-col">{body}</div>
      )}
      {footer && <div className="border-t border-line px-2.5 py-2.5">{footer}</div>}
    </article>
  );
}
