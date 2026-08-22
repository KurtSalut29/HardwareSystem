"use client";

type Props = {
  icon: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  variant?: "default" | "danger";
  title?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
};

const VARIANTS: Record<string, string> = {
  default: "text-[color:var(--text-muted)] hover:text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-muted)]",
  danger: "text-[color:var(--text-muted)] hover:text-[color:var(--bad)] hover:bg-[color:var(--bad-soft)]",
};

export default function IconButton({ icon, onClick, variant = "default", title, type = "button", disabled, className = "" }: Props) {
  return (
    <button
      type={type}
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`p-1.5 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
    >
      {icon}
    </button>
  );
}
