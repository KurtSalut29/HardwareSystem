"use client";

import { createElement } from "react";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";

export type ToastVariant = "success" | "error" | "warning" | "info";

const CONFIG: Record<ToastVariant, { icon: typeof Info; chip: string; bar: string; label: string }> = {
  success: { icon: CheckCircle2, chip: "bg-good-soft text-good", bar: "bg-good", label: "Done" },
  error: { icon: XCircle, chip: "bg-bad-soft text-bad", bar: "bg-bad", label: "Something went wrong" },
  warning: { icon: AlertTriangle, chip: "bg-warn-soft text-warn", bar: "bg-warn", label: "Heads up" },
  info: { icon: Info, chip: "bg-brand-soft text-brand", bar: "bg-brand", label: "Update" },
};

/** A short confirmation that floats at the top, then fades on its own. */
export default function Toast({ message, variant = "success", duration = 3500, onClose }: {
  message: string;
  variant?: ToastVariant;
  duration?: number;
  onClose?: () => void;
}) {
  if (!message) return null;
  const c = CONFIG[variant];
  return (
    <div role={variant === "error" ? "alert" : "status"} aria-live="polite"
      className="animate-toast-in fixed left-1/2 top-4 z-[200] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_18px_50px_-18px_rgba(10,14,36,0.45)]">
      <div className="flex items-start gap-3 px-4 py-3">
        <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${c.chip}`}>{createElement(c.icon, { className: "size-[18px]" })}</span>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-4">{c.label}</p>
          <p className="text-[13.5px] font-medium leading-snug text-ink">{message}</p>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} aria-label="Dismiss"
            className="-mr-1 grid size-8 shrink-0 place-items-center rounded-lg text-ink-4 transition hover:bg-recess hover:text-ink-2">
            <X className="size-4" />
          </button>
        )}
      </div>
      <span aria-hidden className={`animate-toast-bar block h-[3px] ${c.bar}`} style={{ animationDuration: `${duration}ms` }} />
    </div>
  );
}
