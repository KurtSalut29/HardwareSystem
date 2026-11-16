import { createElement } from "react";
import { categoryIcon } from "@/lib/catalog-ui";

/** The icon for a category (or subcategory): the stand-in for missing photos and the rail's markers. */
export default function CategoryGlyph({ category, subcategory, className, strokeWidth }: {
  category?: string | null; subcategory?: string | null; className?: string; strokeWidth?: number;
}) {
  return createElement(categoryIcon(category, subcategory), { className, strokeWidth, "aria-hidden": true });
}
