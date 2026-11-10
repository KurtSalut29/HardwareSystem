import Link from "next/link";
import { ArrowRight } from "lucide-react";
import Sparkline from "@/components/ui/Sparkline";
import { ICON_SIZE } from "@/lib/constants/icon-size";

/**
 * Shared building blocks for the role dashboards. Every section and card says
 * what it is for, so a number or chart is never left to guesswork.
 */

/** Names a group of cards ("Sales & stock", "Deliveries"), with one line on what the group covers. */
export function SectionLabel({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 pt-1">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--brand)" }}>{title}</h2>
      {description && <p className="text-xs" style={{ color: "var(--text-muted)" }}>{description}</p>}
    </div>
  );
}

/** Card title, a sentence on what the card shows, and an optional link to the full page. */
export function CardHeader({
  icon,
  title,
  description,
  href,
  linkLabel = "View all",
  badge,
  className = "mb-4",
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  href?: string;
  linkLabel?: string;
  badge?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-start justify-between gap-3 ${className}`}>
      <div className="flex items-start gap-2.5 min-w-0">
        {icon && <span className="mt-0.5 shrink-0">{icon}</span>}
        <div className="min-w-0">
          <h3 className="font-display font-extrabold text-gray-900 flex items-center gap-2">
            {title}
            {badge}
          </h3>
          {description && <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{description}</p>}
        </div>
      </div>
      {href && (
        <Link href={href} className="flex items-center gap-1 text-xs font-semibold hover:underline shrink-0 mt-0.5" style={{ color: "var(--brand)" }}>
          {linkLabel} <ArrowRight size={ICON_SIZE.xs} />
        </Link>
      )}
    </div>
  );
}

/** A column of key numbers, with a header saying whose numbers they are and over what period. */
export function StatRail({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="h-full flex flex-col bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 pt-4 pb-3 border-b border-gray-100">
        <h3 className="font-display font-extrabold text-gray-900 text-sm">{title}</h3>
        <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{description}</p>
      </div>
      <div className="flex-1 flex flex-col divide-y divide-gray-100">{children}</div>
    </div>
  );
}

export type Trend = { value: string; up: boolean };

/** One number in a StatRail: label, value, a caption explaining it, and an optional small chart and trend. */
export function StatRailRow({
  title,
  caption,
  value,
  icon,
  iconBg,
  iconColor,
  trend,
  trendLabel = "vs last month",
  sparkline,
  sparklineId,
  sparklineValuePrefix = "₱",
}: {
  title: string;
  caption: string;
  value: string | number;
  icon: React.ReactNode;
  iconBg: string;
  iconColor?: string;
  trend?: Trend | null;
  trendLabel?: string;
  sparkline?: { label: string; value: number }[];
  sparklineId?: string;
  sparklineValuePrefix?: string;
}) {
  return (
    <div className="flex-1 flex items-center gap-3 px-5 py-3.5">
      <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 ${iconBg}`} style={iconColor ? { color: iconColor } : undefined}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{title}</p>
        <p className="font-display text-lg font-extrabold text-gray-900 num truncate leading-tight">{value}</p>
        <p className="text-[11px] text-gray-400 leading-snug">{caption}</p>
      </div>
      {(sparkline && sparkline.length > 1 && sparklineId) || trend ? (
        <div className="flex flex-col items-end gap-0.5 shrink-0">
          {sparkline && sparkline.length > 1 && sparklineId && (
            <Sparkline gradientId={sparklineId} data={sparkline} valuePrefix={sparklineValuePrefix} />
          )}
          {trend && (
            <span className="text-[11px] font-semibold whitespace-nowrap" style={{ color: trend.up ? "var(--good)" : "var(--bad)" }} title={`Change ${trendLabel}`}>
              {trend.up ? "↑" : "↓"} {trend.value} <span className="font-normal text-gray-400">{trendLabel}</span>
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}
