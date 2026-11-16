import {
  BrickWall, Zap, Hammer, Wrench, Ruler, Paintbrush, Droplets, Drill, HardHat, KeyRound, Nut, Trees, Package,
  type LucideIcon,
} from "lucide-react";

/**
 * Presentation helpers shared by every product list (Products, Shop, POS):
 * the product's shelf code, its stock state, and the icon that stands in for a
 * missing photo.
 */

/** Three-letter prefix from the category: "Construction" → "CON", "Paint & Finishing" → "PAI". */
function prefix(category?: string | null) {
  const letters = (category ?? "").replace(/[^A-Za-z]/g, "").toUpperCase();
  return (letters.slice(0, 3) || "ITM").padEnd(3, "X");
}

/** The code on the shelf tag, e.g. CON-0074. Built from the category and the product's id. */
export function productCode(p: { id: number; category?: { name: string } | null }) {
  return `${prefix(p.category?.name)}-${String(p.id).padStart(4, "0")}`;
}

export type StockState = "out" | "low" | "ok";

/** Out, running low (at or below the reorder point), or fine. */
export function stockState(stock: number, reorderAt: number): StockState {
  if (stock <= 0) return "out";
  if (stock <= reorderAt) return "low";
  return "ok";
}

/** "12", "2.5", "1,240": quantities without noise. */
export function fmtQty(n: number) {
  return Number.isInteger(n) ? n.toLocaleString("en-PH") : n.toLocaleString("en-PH", { maximumFractionDigits: 2 });
}

export const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ICONS: [RegExp, LucideIcon][] = [
  [/construct|cement|aggregate|masonry/i, BrickWall],
  [/electric|wire|light/i, Zap],
  [/fasten|nail|screw|bolt|anchor/i, Nut],
  [/plumb|pipe|valve|fitting/i, Droplets],
  [/power/i, Drill],
  [/measur|tape|level/i, Ruler],
  [/paint|finish/i, Paintbrush],
  [/safety|protect/i, HardHat],
  [/lock|hinge|accessor|hardware/i, KeyRound],
  [/wood|carpent|lumber|plywood/i, Trees],
  [/hand tool|hammer/i, Hammer],
  [/tool|wrench|saw/i, Wrench],
];

/** The icon that stands in for a product photo, picked from its category (then subcategory). */
export function categoryIcon(category?: string | null, subcategory?: string | null): LucideIcon {
  for (const name of [category, subcategory]) {
    if (!name) continue;
    const hit = ICONS.find(([re]) => re.test(name));
    if (hit) return hit[1];
  }
  return Package;
}
