"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: "sm" | "md" | "lg" | "xl";
  /**
   * Where the panel sits. "edge" is the classic side sheet; "center" floats it
   * in the middle of the screen — which is what the cart uses, so the customer
   * and the staff member are both looking at the order dead centre instead of
   * off to one side.
   */
  placement?: "edge" | "center";
};

const WIDTH_CLASS: Record<string, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-3xl",
};

export default function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
  width = "sm",
  placement = "edge",
}: DrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(open);
  const centered = placement === "center";

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (open) { setVisible(true); return; }
    const t = setTimeout(() => setVisible(false), 220);
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
    function handleKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!mounted || !visible) return null;

  return createPortal(
    <div className={`fixed inset-0 z-50 flex ${centered ? "items-end justify-center sm:items-center sm:p-6" : "justify-end p-0 sm:p-3"}`}>
      <div
        className={`absolute inset-0 bg-[rgba(10,14,36,0.5)] backdrop-blur-[3px] transition-opacity duration-200 ${open ? "opacity-100 animate-overlay-in" : "opacity-0"}`}
        onClick={onClose}
      />
      <div
        className={
          centered
            ? `modal-panel relative flex max-h-[92vh] w-full ${WIDTH_CLASS[width]} flex-col overflow-hidden rounded-t-[24px] border border-line bg-surface shadow-[0_30px_80px_-24px_rgba(10,14,36,0.55)] transition-opacity duration-200 sm:max-h-full sm:rounded-[20px] ${open ? "opacity-100" : "opacity-0"}`
            : `relative flex h-full w-full ${WIDTH_CLASS[width]} flex-col overflow-hidden border-line bg-surface shadow-[0_30px_80px_-24px_rgba(10,14,36,0.55)] transition-transform duration-200 sm:rounded-[20px] sm:border ${open ? "translate-x-0 animate-drawer-in" : "translate-x-[110%]"}`
        }
      >
        {title && (
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-5 py-4">
            <div className="flex min-w-0 items-center gap-2 font-display text-[17px] font-extrabold tracking-tight text-ink">{title}</div>
            <button type="button" onClick={onClose} aria-label="Close"
              className="-mr-1 grid size-9 shrink-0 place-items-center rounded-xl text-ink-3 transition hover:bg-recess hover:text-ink">
              <X className="size-[18px]" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto min-h-0">{children}</div>
        {/* max-h + scroll so an unusually tall footer can never push its own
            controls past the bottom of the panel with no way to reach them. */}
        {footer && <div className="max-h-[60vh] shrink-0 overflow-y-auto border-t border-line bg-subtle">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
