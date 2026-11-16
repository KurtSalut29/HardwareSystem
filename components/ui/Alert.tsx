import { createElement } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

export type AlertTone = "info" | "good" | "warn" | "bad";

const TONE: Record<AlertTone, { box: string; chip: string; title: string; icon: typeof Info }> = {
  info: { box: "border-brand/25 bg-brand-soft/60", chip: "bg-surface text-brand", title: "text-brand-ink", icon: Info },
  good: { box: "border-good/30 bg-good-soft", chip: "bg-surface text-good", title: "text-good", icon: CheckCircle2 },
  warn: { box: "border-warn/30 bg-warn-soft", chip: "bg-surface text-warn", title: "text-warn", icon: AlertTriangle },
  bad: { box: "border-bad/30 bg-bad-soft", chip: "bg-surface text-bad", title: "text-bad", icon: XCircle },
};

/**
 * A message that sits in the page or a form: what happened and, when there is
 * one, what to do about it. Tone says how serious it is.
 */
export default function Alert({ tone = "info", title, children, action, compact = false, className = "" }: {
  tone?: AlertTone;
  title?: React.ReactNode;
  children?: React.ReactNode;
  /** A button or link on the right, e.g. "Review". */
  action?: React.ReactNode;
  /** One tight line, for errors under a form. */
  compact?: boolean;
  className?: string;
}) {
  const t = TONE[tone];
  return (
    <div role={tone === "bad" || tone === "warn" ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-xl border ${compact ? "px-3 py-2.5" : "px-3.5 py-3"} ${t.box} ${className}`}>
      <span className={`grid shrink-0 place-items-center rounded-lg shadow-[0_1px_2px_rgba(16,24,64,0.08)] ${compact ? "size-6" : "size-8"} ${t.chip}`}>
        {createElement(t.icon, { className: compact ? "size-3.5" : "size-4" })}
      </span>
      <div className={`min-w-0 flex-1 ${compact ? "pt-0.5 text-[13px]" : "pt-1 text-[13.5px]"} leading-snug text-ink-2`}>
        {title && <p className={`font-semibold ${t.title}`}>{title}</p>}
        {children && <div className={title ? "mt-0.5" : ""}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}
