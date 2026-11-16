"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  /** One line under the title saying what this window is for. */
  description?: React.ReactNode;
  /** A lucide icon element shown in a tinted chip beside the title. */
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  closeOnBackdrop?: boolean;
};

const SIZE_CLASS: Record<string, string> = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-2xl",
};

/**
 * The one modal for the whole system. A centred card on wider screens and a
 * sheet that rises from the bottom on phones, with a fixed header and footer so
 * the actions never scroll out of reach.
 */
export default function Modal({ open, onClose, title, description, icon, children, footer, size = "md", closeOnBackdrop = true }: ModalProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(open);
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (open) {
      setVisible(true);
      return;
    }
    const t = setTimeout(() => setVisible(false), 150);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!visible) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prevOverflow; };
  }, [visible]);

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  if (!mounted || !visible) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center bg-[rgba(10,14,36,0.5)] backdrop-blur-[3px] transition-opacity duration-150 sm:items-center sm:p-4 ${open ? "opacity-100 animate-overlay-in" : "opacity-0"}`}
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        onClick={(e) => e.stopPropagation()}
        className={`modal-panel relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[24px] border border-line bg-surface shadow-[0_30px_80px_-24px_rgba(10,14,36,0.55)] outline-none sm:max-h-[88vh] sm:rounded-[20px] ${SIZE_CLASS[size]} ${open ? "" : "opacity-0"}`}
      >
        {/* Grab handle: tells phone users this is a sheet */}
        <span aria-hidden className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-line-strong sm:hidden" />

        {title && (
          <div className="relative shrink-0 overflow-hidden border-b border-line bg-gradient-to-br from-brand-soft via-surface to-surface px-5 pb-4 pt-4 sm:px-6 sm:pt-5">
            {/* A soft wash of brand colour behind the title */}
            <span aria-hidden className="pointer-events-none absolute -right-12 -top-20 size-48 rounded-full bg-brand/10 blur-2xl" />
            <div className="relative flex items-start gap-3.5">
              {icon && (
                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-surface text-brand shadow-[0_6px_16px_-8px_rgba(30,79,216,0.55)] ring-1 ring-brand/15">
                  {icon}
                </span>
              )}
              <div className="min-w-0 flex-1 pt-0.5">
                <h2 id={titleId} className="font-display text-[18px] font-extrabold leading-snug tracking-tight text-ink">{title}</h2>
                {description && <p className="mt-0.5 text-[13px] leading-snug text-ink-3">{description}</p>}
              </div>
              <button type="button" onClick={onClose} aria-label="Close"
                className="-mr-1.5 -mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl text-ink-3 transition hover:bg-surface hover:text-ink hover:shadow-[0_1px_3px_rgba(16,24,64,0.12)]">
                <X className="size-[18px]" />
              </button>
            </div>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>

        {footer && <div className="shrink-0 border-t border-line bg-subtle px-5 py-3.5 sm:px-6">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
