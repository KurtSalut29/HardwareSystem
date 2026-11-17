/** One block on the Settings page: a heading that says what it controls, then its rows. */
export default function SettingsCard({ title, description, icon, children, footer, id }: {
  title: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="scroll-mt-24 overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(16,24,64,0.04)]">
      <header className="flex items-start gap-3 border-b border-line px-5 py-4">
        {icon && <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">{icon}</span>}
        <div className="min-w-0">
          <h2 className="font-display text-[16px] font-extrabold text-ink">{title}</h2>
          {description && <p className="mt-0.5 text-[13px] leading-snug text-ink-3">{description}</p>}
        </div>
      </header>
      <div className="px-5 py-1">{children}</div>
      {footer && <footer className="border-t border-line bg-subtle px-5 py-3">{footer}</footer>}
    </section>
  );
}
