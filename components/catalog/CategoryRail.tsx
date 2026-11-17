"use client";

import { LayoutGrid } from "lucide-react";
import CategoryGlyph from "@/components/catalog/CategoryGlyph";

export type RailCategory = { id: number; name: string; count: number; subs: { name: string; count: number }[] };
export type RailValue = { categoryId: number | null; sub: string | null };

/**
 * Category navigation. On a desktop it is a sticky list down the left with the
 * chosen category's subcategories nested under it; on a phone it becomes two
 * swipeable rows of chips (categories, then that category's subcategories).
 */
export default function CategoryRail({ categories, total, value, onChange }: {
  categories: RailCategory[];
  total: number;
  value: RailValue;
  onChange: (v: RailValue) => void;
}) {
  const active = categories.find((c) => c.id === value.categoryId) ?? null;

  return (
    <>
      {/* Desktop: sticky list */}
      <nav aria-label="Categories" className="sticky top-4 hidden self-start lg:block">
        <p className="px-3 pb-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-ink-4">Categories</p>
        <ul className="space-y-0.5">
          <li>
            <RailButton active={value.categoryId === null} onClick={() => onChange({ categoryId: null, sub: null })}
              icon={<LayoutGrid className="size-4" />} label="All products" count={total} />
          </li>
          {categories.map((c) => {
            const on = c.id === value.categoryId;
            return (
              <li key={c.id}>
                <RailButton active={on && !value.sub} parentActive={on} onClick={() => onChange({ categoryId: c.id, sub: null })}
                  icon={<CategoryGlyph category={c.name} className="size-4" />} label={c.name} count={c.count} />
                {on && c.subs.length > 0 && (
                  <ul className="mb-1.5 ml-[22px] mt-0.5 space-y-px border-l border-line pl-2.5">
                    {c.subs.map((s) => (
                      <li key={s.name}>
                        <button type="button" onClick={() => onChange({ categoryId: c.id, sub: s.name })} aria-current={value.sub === s.name ? "true" : undefined}
                          className={`flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] transition ${
                            value.sub === s.name ? "bg-brand-soft font-semibold text-brand-ink" : "text-ink-3 hover:bg-recess hover:text-ink"}`}>
                          <span className="truncate">{s.name}</span>
                          <span className="font-code text-[10.5px] text-ink-4">{s.count}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Phone and tablet: chip rows */}
      <div className="-mx-3 min-w-0 space-y-2 lg:hidden">
        <div className="flex gap-1.5 overflow-x-auto px-3 pb-1 [scrollbar-width:none]" role="group" aria-label="Categories">
          <Chip on={value.categoryId === null} onClick={() => onChange({ categoryId: null, sub: null })}>All · {total}</Chip>
          {categories.map((c) => (
            <Chip key={c.id} on={c.id === value.categoryId} onClick={() => onChange({ categoryId: c.id, sub: null })}>{c.name}</Chip>
          ))}
        </div>
        {active && active.subs.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto px-3 pb-1 [scrollbar-width:none]" role="group" aria-label={`${active.name} subcategories`}>
            <Chip small on={!value.sub} onClick={() => onChange({ categoryId: active.id, sub: null })}>All {active.name}</Chip>
            {active.subs.map((s) => (
              <Chip small key={s.name} on={value.sub === s.name} onClick={() => onChange({ categoryId: active.id, sub: s.name })}>{s.name}</Chip>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function RailButton({ active, parentActive = false, onClick, icon, label, count }: {
  active: boolean; parentActive?: boolean; onClick: () => void; icon: React.ReactNode; label: string; count: number;
}) {
  return (
    <button type="button" onClick={onClick} aria-current={active ? "true" : undefined}
      className={`relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13.5px] transition ${
        active ? "bg-brand-soft font-semibold text-brand-ink"
          : parentActive ? "font-semibold text-ink"
          : "text-ink-2 hover:bg-recess hover:text-ink"}`}>
      {active && <span aria-hidden className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-brand" />}
      <span className={active || parentActive ? "text-brand" : "text-ink-4"}>{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="font-code text-[11px] text-ink-4">{count}</span>
    </button>
  );
}

function Chip({ on, onClick, children, small = false }: { on: boolean; onClick: () => void; children: React.ReactNode; small?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      className={`shrink-0 whitespace-nowrap rounded-full border font-semibold transition ${small ? "px-3 py-1 text-xs" : "px-3.5 py-1.5 text-[13px]"} ${
        on ? "border-brand bg-brand text-white" : "border-line bg-surface text-ink-2 hover:border-line-strong"}`}>
      {children}
    </button>
  );
}
