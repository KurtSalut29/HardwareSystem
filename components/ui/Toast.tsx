"use client";

import { CheckCircle, XCircle, AlertTriangle, Info } from "lucide-react";
import { ICON_SIZE } from "@/lib/constants/icon-size";

export type ToastVariant = "success" | "error" | "warning" | "info";

const CONFIG: Record<ToastVariant, { icon: React.ReactNode; cls: string }> = {
  success: { icon: <CheckCircle size={ICON_SIZE.sm} />, cls: "bg-white border-green-200 text-green-700" },
  error:   { icon: <XCircle size={ICON_SIZE.sm} />,    cls: "bg-white border-red-200 text-red-600" },
  warning: { icon: <AlertTriangle size={ICON_SIZE.sm} />, cls: "bg-white border-amber-200 text-amber-600" },
  info:    { icon: <Info size={ICON_SIZE.sm} />,        cls: "bg-white border-blue-200 text-blue-600" },
};

export default function Toast({ message, variant = "success" }: { message: string; variant?: ToastVariant }) {
  if (!message) return null;
  const { icon, cls } = CONFIG[variant];
  return (
    <div className={`animate-fade-in fixed top-5 left-1/2 -translate-x-1/2 z-[200] flex items-center gap-2.5 px-5 py-3 rounded-2xl shadow-lg text-sm font-medium border ${cls}`}>
      {icon} {message}
    </div>
  );
}
