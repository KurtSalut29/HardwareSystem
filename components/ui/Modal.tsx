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
  size?: "sm" | "md" | "lg";
  closeOnBackdrop?: boolean;
};

const SIZE_CLASS: Record<string, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
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
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm transition-opacity duration-150 ${open ? "opacity-100 animate-overlay-in" : "opacity-0"}`}
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={`bg-white rounded-2xl shadow-xl w-full ${SIZE_CLASS[size]} outline-none transition-all duration-150 ${open ? "opacity-100 scale-100 animate-panel-in" : "opacity-0 scale-95"}`}
      >
        {title && (
          <div className="flex items-center justify-between p-5 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 text-sm">{title}</h2>
            <IconButton icon={<X size={ICON_SIZE.md} />} onClick={onClose} title="Close" />
          </div>
        )}
        <div className="p-5 max-h-[85vh] overflow-y-auto">{children}</div>
        {footer && <div className="p-5 pt-0 border-t border-gray-100">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
