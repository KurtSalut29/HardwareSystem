type Props = {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
};

export default function PageHeader({ title, subtitle, action }: Props) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
      <div className="min-w-0">
        <h1 className="font-display text-lg md:text-xl font-extrabold leading-tight" style={{ color: "var(--text-primary)" }}>{title}</h1>
        {subtitle && <p className="text-xs md:text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
