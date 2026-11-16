"use client";

import { useEffect, useRef } from "react";
import { Search, X, LayoutGrid, Rows3, ArrowUpDown } from "lucide-react";

export type SortKey = "category" | "name" | "price_asc" | "price_desc" | "stock_asc";

export const SORT_LABEL: Record<SortKey, string> = {
  category: "By category",
  name: "Name, A to Z",
  price_asc: "Price, low to high",
  price_desc: "Price, high to low",
  stock_asc: "Stock, lowest first",
};

/**
 * Search, sort and (for staff) grid or list. Press "/" anywhere to jump to search.
 */
export default function CatalogToolbar({
  query, onQuery, sort, onSort, sorts, view, onView, placeholder = "Search products, brands or codes",
}: {
  query: string;
  onQuery: (q: string) => void;
  sort: SortKey;
  onSort: (s: SortKey) => void;
  sorts: SortKey[];
  view?: "grid" | "list";
  onView?: (v: "grid" | "list") => void;
  placeholder?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (e.key === "/" && !(t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable))) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="relative min-w-[220px] flex-1">
        <span className="sr-only">Search products</span>
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-4" />
        <input ref={inputRef} value={query} onChange={(e) => onQuery(e.target.value)} placeholder={placeholder}
          className="h-11 w-full rounded-xl border border-line bg-surface pl-10 pr-16 text-sm text-ink shadow-[0_1px_2px_rgba(16,24,64,0.04)] outline-none transition placeholder:text-ink-4 focus:border-brand focus:ring-4 focus:ring-brand-soft" />
        {query ? (
          <button type="button" onClick={() => onQuery("")} aria-label="Clear search"
            className="absolute right-2.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-ink-4 hover:bg-recess hover:text-ink">
            <X className="size-4" />
          </button>
        ) : (
          <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-line bg-subtle px-1.5 font-code text-[10.5px] text-ink-4 sm:block">/</kbd>
        )}
      </label>

      <label className="relative">
        <span className="sr-only">Sort</span>
        <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-4" />
        <select value={sort} onChange={(e) => onSort(e.target.value as SortKey)}
          className="h-11 cursor-pointer appearance-none rounded-xl border border-line bg-surface pl-8 pr-4 text-[13px] font-medium text-ink-2 outline-none transition hover:border-line-strong focus:border-brand focus:ring-4 focus:ring-brand-soft">
          {sorts.map((s) => <option key={s} value={s}>{SORT_LABEL[s]}</option>)}
        </select>
      </label>

      {view && onView && (
        <div className="flex h-11 items-center rounded-xl border border-line bg-surface p-1" role="group" aria-label="View">
          {(["grid", "list"] as const).map((v) => (
            <button key={v} type="button" onClick={() => onView(v)} aria-pressed={view === v} aria-label={v === "grid" ? "Grid view" : "List view"} title={v === "grid" ? "Grid view" : "List view"}
              className={`grid h-full w-9 place-items-center rounded-lg transition ${view === v ? "bg-brand-soft text-brand" : "text-ink-4 hover:text-ink"}`}>
              {v === "grid" ? <LayoutGrid className="size-4" /> : <Rows3 className="size-4" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
