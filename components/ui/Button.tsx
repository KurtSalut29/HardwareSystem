"use client";

import { Loader2 } from "lucide-react";
import { ICON_SIZE } from "@/lib/constants/icon-size";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md";
  loading?: boolean;
  icon?: React.ReactNode;
};

const VARIANTS: Record<string, string> = {
  primary: "text-white shadow-sm active:scale-[0.98] hover:brightness-95",
  secondary: "bg-white border text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-subtle)] active:scale-[0.98]",
  danger: "text-white active:scale-[0.98] hover:brightness-95",
  ghost: "text-[color:var(--text-muted)] hover:bg-[color:var(--bg-muted)]",
};

const VARIANT_STYLE: Record<string, React.CSSProperties> = {
  primary: { background: "var(--brand)" },
  secondary: { borderColor: "var(--border)" },
  danger: { background: "var(--bad)" },
  ghost: {},
};

const SIZES: Record<string, string> = {
  sm: "py-1.5 px-3 text-xs",
  md: "py-2.5 px-4 text-sm",
};

export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  disabled,
  className = "",
  style,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      style={{ ...VARIANT_STYLE[variant], ...style }}
      className={`inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {loading ? <Loader2 size={ICON_SIZE.sm} className="animate-spin" /> : icon}
      {children}
    </button>
  );
}
