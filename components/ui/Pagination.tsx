"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ICON_SIZE } from "@/lib/constants/icon-size";

/**
 * Client-side paging for a list that is already loaded.
 *
 * `resetKey` is whatever decides what the list shows (a search, a filter, a
 * selected date). When it changes the list starts again from page 1. The page
 * is also clamped to the last page, so a shrinking list never shows an empty page.
 */
export function usePagination<T>(items: T[], pageSize = 10, resetKey: unknown = null) {
  const [state, setState] = useState<{ page: number; key: unknown }>({ page: 1, key: resetKey });
  const page = Object.is(state.key, resetKey) ? state.page : 1;
  const setPage = (p: number) => setState({ page: p, key: resetKey });
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, totalPages);
  const start = (current - 1) * pageSize;
  return {
    page: current,
    setPage,
    totalPages,
    pageItems: items.slice(start, start + pageSize),
    total: items.length,
    pageSize,
  };
}

/** Page numbers to show: always the first and last, the current one and its neighbours, with gaps as "…". */
function pageList(page: number, totalPages: number): (number | "gap")[] {
  const wanted = new Set([1, totalPages, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((p) => wanted.add(p));
  if (page >= totalPages - 2) [totalPages - 3, totalPages - 2, totalPages - 1].forEach((p) => wanted.add(p));
  const pages = [...wanted].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  pages.forEach((p, i) => {
    if (i > 0 && p - pages[i - 1] > 1) out.push("gap");
    out.push(p);
  });
  return out;
}

export default function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onChange,
  noun = "records",
  className = "",
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
  /** What is being counted, e.g. "orders". */
  noun?: string;
  className?: string;
}) {
  if (total <= pageSize) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const go = (p: number) => onChange(Math.min(totalPages, Math.max(1, p)));
  const arrow = "h-8 px-2.5 inline-flex items-center gap-1 rounded-lg text-xs font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100";

  return (
    <nav aria-label="Pagination" className={`flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-gray-100 ${className}`}>
      <p className="text-xs text-gray-400 num">
        Showing <span className="font-semibold text-gray-600">{from.toLocaleString()}–{to.toLocaleString()}</span> of{" "}
        <span className="font-semibold text-gray-600">{total.toLocaleString()}</span> {noun}
      </p>
      <div className="flex items-center gap-1">
        <button type="button" onClick={() => go(page - 1)} disabled={page === 1} className={arrow} style={{ color: "var(--text-secondary)" }} aria-label="Previous page">
          <ChevronLeft size={ICON_SIZE.sm} /> <span className="hidden sm:inline">Prev</span>
        </button>

        {/* Page numbers on wider screens; a compact "3 / 12" on phones. */}
        <div className="hidden sm:flex items-center gap-1">
          {pageList(page, totalPages).map((p, i) =>
            p === "gap" ? (
              <span key={`gap-${i}`} className="w-6 text-center text-xs text-gray-400" aria-hidden>…</span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => go(p)}
                aria-current={p === page ? "page" : undefined}
                className={`min-w-8 h-8 px-1.5 rounded-lg text-xs font-semibold num transition ${p === page ? "text-white" : "text-gray-500 hover:bg-gray-100"}`}
                style={p === page ? { background: "var(--brand)" } : undefined}
              >
                {p}
              </button>
            )
          )}
        </div>
        <span className="sm:hidden text-xs font-semibold text-gray-600 num px-2">{page} / {totalPages}</span>

        <button type="button" onClick={() => go(page + 1)} disabled={page === totalPages} className={arrow} style={{ color: "var(--text-secondary)" }} aria-label="Next page">
          <span className="hidden sm:inline">Next</span> <ChevronRight size={ICON_SIZE.sm} />
        </button>
      </div>
    </nav>
  );
}
