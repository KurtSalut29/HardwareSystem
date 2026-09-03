"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import IconButton from "./IconButton";
import { ICON_SIZE } from "@/lib/constants/icon-size";

type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: "sm" | "md" | "lg";
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
    <div className={`fixed inset-0 z-50 flex ${centered ? "items-center justify-center p-4 sm:p-6" : "justify-end"}`}>
      <div
        className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${open ? "opacity-100 animate-overlay-in" : "opacity-0"}`}
        onClick={onClose}
      />
      <div
        className={
          centered
            ? `relative w-full ${WIDTH_CLASS[width]} max-h-full bg-white shadow-2xl rounded-2xl flex flex-col overflow-hidden transition-all duration-200 ${open ? "opacity-100 scale-100 animate-panel-in" : "opacity-0 scale-95"}`
            : `relative w-full ${WIDTH_CLASS[width]} h-full bg-white shadow-2xl flex flex-col transition-transform duration-200 ${open ? "translate-x-0 animate-drawer-in" : "translate-x-full"}`
        }
      >
        {title && (
          <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0">
            <div className="font-semibold text-gray-800 flex items-center gap-2">{title}</div>
            <IconButton icon={<X size={ICON_SIZE.md} />} onClick={onClose} title="Close" />
          </div>
        )}
        <div className="flex-1 overflow-y-auto min-h-0">{children}</div>
        {/* max-h + scroll so an unusually tall footer can never push its own
            controls past the bottom of the panel with no way to reach them. */}
        {footer && <div className="border-t border-gray-100 shrink-0 max-h-[60vh] overflow-y-auto">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
