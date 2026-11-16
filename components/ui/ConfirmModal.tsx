"use client";

import { useState } from "react";
import { Trash2, AlertTriangle, Info } from "lucide-react";
import Modal from "./Modal";
import Button from "./Button";
import { ICON_SIZE } from "@/lib/constants/icon-size";

type ConfirmVariant = "danger" | "warning" | "info";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  body?: React.ReactNode;
  variant?: ConfirmVariant;
  confirmLabel?: string;
  cancelLabel?: string;
};

const VARIANT_CONFIG: Record<ConfirmVariant, { icon: React.ReactNode; iconBg: string; iconColor: string; confirmVariant: "danger" | "primary" }> = {
  danger: { icon: <Trash2 size={ICON_SIZE.lg} />, iconBg: "bg-bad-soft", iconColor: "text-bad", confirmVariant: "danger" },
  warning: { icon: <AlertTriangle size={ICON_SIZE.lg} />, iconBg: "bg-warn-soft", iconColor: "text-warn", confirmVariant: "danger" },
  info: { icon: <Info size={ICON_SIZE.lg} />, iconBg: "bg-brand-soft", iconColor: "text-brand", confirmVariant: "primary" },
};

export default function ConfirmModal({
  open, onClose, onConfirm, title, body,
  variant = "danger", confirmLabel = "Confirm", cancelLabel = "Cancel",
}: Props) {
  const [loading, setLoading] = useState(false);
  const cfg = VARIANT_CONFIG[variant];

  async function handleConfirm() {
    const result = onConfirm();
    if (result instanceof Promise) {
      setLoading(true);
      try { await result; } finally { setLoading(false); }
    }
  }

  return (
    <Modal open={open} onClose={loading ? () => {} : onClose} size="sm" closeOnBackdrop={!loading}>
      <div className="text-center">
        <div className={`inline-flex items-center justify-center w-12 h-12 rounded-2xl ${cfg.iconBg} ${cfg.iconColor} mb-4`}>
          {cfg.icon}
        </div>
        <h2 className="mb-1 font-display text-lg font-extrabold tracking-tight text-ink">{title}</h2>
        {body && <div className="text-sm text-ink-3">{body}</div>}
      </div>
      <div className="flex gap-2 mt-5">
        <Button variant="secondary" className="flex-1" onClick={onClose} disabled={loading}>{cancelLabel}</Button>
        <Button variant={cfg.confirmVariant} className="flex-1" onClick={handleConfirm} loading={loading}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}
