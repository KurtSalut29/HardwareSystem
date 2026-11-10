/**
 * Products are read by many screens (shop, POS, products, landing page) that
 * show the subcategory as plain text. The database keeps it as a managed row
 * (Subcategory), so reads include that row and flatten it back to its name,
 * alongside the id the product form needs.
 */
export const productInclude = {
  category: true,
  subcategory: { select: { id: true, name: true } },
} as const;

export function flattenProduct<P extends { subcategory: { id: number; name: string } | null }>(p: P) {
  return { ...p, subcategory: p.subcategory?.name ?? null };
}
