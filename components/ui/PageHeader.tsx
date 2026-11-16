type Props = {
  title: string;
  /** Small blue label above the title naming the area of the store, e.g. "Sales". */
  eyebrow?: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
};

/** The top of every back-office page: where you are, one line of context, and the page's main actions. */
export default function PageHeader({ title, eyebrow, subtitle, action }: Props) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand">{eyebrow}</p>}
        <h1 className={`${eyebrow ? "mt-1" : ""} font-display text-2xl font-extrabold leading-none tracking-tight text-ink md:text-[28px]`}>{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-ink-3">{subtitle}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </header>
  );
}
