"use client";

import { Loader2 } from "lucide-react";
import { ICON_SIZE } from "@/lib/constants/icon-size";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "success" | "danger" | "danger-soft" | "ghost" | "soft";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: React.ReactNode;
};

const VARIANTS: Record<string, string> = {
  primary: "bg-brand text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_8px_18px_-10px_rgba(30,79,216,0.9)] hover:brightness-110",
  secondary: "border border-line bg-surface text-ink-2 shadow-[0_1px_2px_rgba(16,24,64,0.05)] hover:border-line-strong hover:text-ink",
  soft: "bg-brand-soft text-brand-ink hover:bg-brand-soft/70",
  success: "bg-good text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_8px_18px_-10px_rgba(18,138,74,0.8)] hover:brightness-110",
  danger: "bg-bad text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_8px_18px_-10px_rgba(209,54,42,0.8)] hover:brightness-110",
  "danger-soft": "border border-line bg-surface text-bad hover:border-bad/40 hover:bg-bad-soft",
  ghost: "text-ink-3 hover:bg-recess hover:text-ink-2",
};

const SIZES: Record<string, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-[15px]",
};

export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  disabled,
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...rest}
    >
      {loading ? <Loader2 size={ICON_SIZE.sm} className="animate-spin" /> : icon}
      {children}
    </button>
  );
}
