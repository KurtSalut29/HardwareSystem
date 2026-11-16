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
  default: "text-ink-3 hover:bg-recess hover:text-ink-2",
  danger: "text-ink-4 hover:bg-bad-soft hover:text-bad",
};

export default function IconButton({ icon, onClick, variant = "default", title, type = "button", disabled, className = "" }: Props) {
  return (
    <button
      type={type}
      onClick={onClick}
      title={title}
      aria-label={title}
      disabled={disabled}
      className={`grid size-8 place-items-center rounded-lg transition disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTS[variant]} ${className}`}
    >
      {icon}
    </button>
  );
}
