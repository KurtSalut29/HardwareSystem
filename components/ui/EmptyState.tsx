import { LucideIcon } from "lucide-react";

type Props = {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Optional next step, e.g. a "Clear filters" button. */
  action?: React.ReactNode;
};

export default function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <span className="grid size-12 place-items-center rounded-2xl bg-recess text-ink-4">
        <Icon className="size-6" strokeWidth={1.6} />
      </span>
      <p className="mt-3 font-display text-base font-extrabold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-3">{description}</p>}
      {action && <div className="mt-4 flex gap-2">{action}</div>}
    </div>
  );
}
