"use client";

import { Search, X } from "lucide-react";

/** The search box used across the back office: icon, clear button, consistent height. */
export default function SearchField({ value, onChange, placeholder, label, className = "" }: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label?: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-4" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label ?? placeholder}
        className="h-10 w-full rounded-xl border border-line bg-surface pl-9 pr-9 text-sm text-ink shadow-[0_1px_2px_rgba(16,24,64,0.04)] transition placeholder:text-ink-4 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/10" />
      {value && (
        <button type="button" onClick={() => onChange("")} aria-label="Clear search"
          className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-ink-4 transition hover:bg-recess hover:text-ink-2">
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
