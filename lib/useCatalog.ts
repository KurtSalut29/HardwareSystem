"use client";

import { useSyncExternalStore } from "react";
import type { RailCategory, RailValue } from "@/components/catalog/CategoryRail";
import type { SortKey } from "@/components/catalog/CatalogToolbar";
import { productCode } from "@/lib/catalog-ui";

type CatalogProduct = {
  id: number; name: string; brand?: string | null; price: number; stock: number; description?: string | null;
  categoryId: number; category?: { id?: number; name: string } | null; subcategory: string | null;
};

/** The rail's categories with product counts, and their subcategories (both A to Z). */
export function railCategories(categories: { id: number; name: string }[], products: CatalogProduct[]): RailCategory[] {
  return categories
    .map((c) => {
      const items = products.filter((p) => p.categoryId === c.id);
      const subs = new Map<string, number>();
      for (const p of items) if (p.subcategory) subs.set(p.subcategory, (subs.get(p.subcategory) ?? 0) + 1);
      return {
        id: c.id, name: c.name, count: items.length,
        subs: [...subs.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name)),
      };
    })
    .filter((c) => c.count > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Search (name, brand, subcategory, description, shelf code), category filter and sort. */
export function filterProducts<P extends CatalogProduct>(
  products: P[], rail: RailValue, query: string, sort: SortKey, extra: (p: P) => boolean = () => true,
): P[] {
  {
    const q = query.trim().toLowerCase();
    const words = q.split(/\s+/).filter(Boolean);
    const list = products.filter((p) => {
      if (rail.categoryId !== null && p.categoryId !== rail.categoryId) return false;
      if (rail.sub && p.subcategory !== rail.sub) return false;
      if (!extra(p)) return false;
      if (!words.length) return true;
      const hay = [p.name, p.brand, p.subcategory, p.category?.name, p.description, productCode(p)].filter(Boolean).join(" ").toLowerCase();
      return words.every((w) => hay.includes(w));
    });
    const byName = (a: P, b: P) => a.name.localeCompare(b.name);
    const cmp: Record<SortKey, (a: P, b: P) => number> = {
      category: (a, b) => (a.category?.name ?? "").localeCompare(b.category?.name ?? "") || (a.subcategory ?? "").localeCompare(b.subcategory ?? "") || byName(a, b),
      name: byName,
      price_asc: (a, b) => a.price - b.price || byName(a, b),
      price_desc: (a, b) => b.price - a.price || byName(a, b),
      stock_asc: (a, b) => a.stock - b.stock || byName(a, b),
    };
    return [...list].sort(cmp[sort]);
  }
}

/** Group a sorted list by category, keeping the order. */
export function groupByCategory<P extends CatalogProduct>(list: P[]): { name: string; categoryId: number; items: P[] }[] {
  const groups: { name: string; categoryId: number; items: P[] }[] = [];
  for (const p of list) {
    const name = p.category?.name ?? "Other";
    const last = groups[groups.length - 1];
    if (last && last.categoryId === p.categoryId) last.items.push(p);
    else groups.push({ name, categoryId: p.categoryId, items: [p] });
  }
  return groups;
}

/** A small per-browser preference (e.g. grid or list), safe when storage is blocked. */
export function usePreference<T extends string>(key: string, fallback: T, allowed: readonly T[]): [T, (v: T) => void] {
  const subscribe = (cb: () => void) => {
    window.addEventListener("storage", cb);
    window.addEventListener(`pref:${key}`, cb);
    return () => { window.removeEventListener("storage", cb); window.removeEventListener(`pref:${key}`, cb); };
  };
  const read = () => {
    try { const v = localStorage.getItem(key) as T | null; return v && allowed.includes(v) ? v : fallback; } catch { return fallback; }
  };
  const value = useSyncExternalStore(subscribe, read, () => fallback);
  const set = (v: T) => {
    try { localStorage.setItem(key, v); } catch { /* storage blocked: lasts until reload */ }
    window.dispatchEvent(new Event(`pref:${key}`));
  };
  return [value, set];
}
