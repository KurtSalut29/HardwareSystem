"use client";

import { useState } from "react";
import { Trash2, AlertTriangle, Info } from "lucide-react";
import Modal from "./Modal";
import Button from "./Button";

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

const VARIANT_CONFIG: Record<ConfirmVariant, { icon: React.ReactNode; chip: string; confirmVariant: "danger" | "primary" }> = {
  danger: { icon: <Trash2 className="size-5" />, chip: "bg-bad-soft text-bad ring-bad/15", confirmVariant: "danger" },
  warning: { icon: <AlertTriangle className="size-5" />, chip: "bg-warn-soft text-warn ring-warn/15", confirmVariant: "danger" },
  info: { icon: <Info className="size-5" />, chip: "bg-brand-soft text-brand ring-brand/15", confirmVariant: "primary" },
};

/** "Are you sure?" — the question, what happens, and two clear answers. */
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
      <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:text-left">
        <span className={`grid size-12 shrink-0 place-items-center rounded-2xl ring-4 ${cfg.chip}`}>{cfg.icon}</span>
        <div className="min-w-0 pt-0.5">
          <h2 className="font-display text-lg font-extrabold leading-snug tracking-tight text-ink">{title}</h2>
          {body && <div className="mt-1 text-sm leading-relaxed text-ink-3">{body}</div>}
        </div>
      </div>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" className="sm:min-w-[110px]" onClick={onClose} disabled={loading}>{cancelLabel}</Button>
        <Button variant={cfg.confirmVariant} className="sm:min-w-[110px]" onClick={handleConfirm} loading={loading}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}
