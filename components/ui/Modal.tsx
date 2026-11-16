"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import IconButton from "./IconButton";
import { ICON_SIZE } from "@/lib/constants/icon-size";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  closeOnBackdrop?: boolean;
};

const SIZE_CLASS: Record<string, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
};

export default function Modal({ open, onClose, title, children, footer, size = "md", closeOnBackdrop = true }: ModalProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(open);
  const panelRef = useRef<HTMLDivElement>(null);

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
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(12,16,40,0.45)] backdrop-blur-[3px] transition-opacity duration-150 ${open ? "opacity-100 animate-overlay-in" : "opacity-0"}`}
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={`bg-surface border border-line rounded-2xl shadow-[0_24px_60px_-20px_rgba(16,24,64,0.45)] w-full ${SIZE_CLASS[size]} outline-none transition-all duration-150 ${open ? "opacity-100 scale-100 animate-panel-in" : "opacity-0 scale-95"}`}
      >
        {title && (
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
            <h2 className="font-display text-base font-extrabold tracking-tight text-ink">{title}</h2>
            <IconButton icon={<X size={ICON_SIZE.md} />} onClick={onClose} title="Close" />
          </div>
        )}
        <div className="p-5 max-h-[85vh] overflow-y-auto">{children}</div>
        {footer && <div className="border-t border-line p-5">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
