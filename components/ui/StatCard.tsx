import { ReactNode } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { ICON_SIZE } from "@/lib/constants/icon-size";

type Props = {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: ReactNode;
  iconBg: string;
  trend?: { value: string; up: boolean };
};

export default function StatCard({ title, value, subtitle, icon, iconBg, trend }: Props) {
  return (
    <div
      className="rounded-2xl border p-4 flex items-start gap-3 transition-shadow hover:shadow-md"
      style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
    >
      <div className={`w-9 h-9 md:w-10 md:h-10 rounded-[10px] flex items-center justify-center shrink-0 ${iconBg}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] md:text-xs font-medium uppercase tracking-wide leading-snug line-clamp-2" style={{ color: "var(--text-muted)" }}>{title}</p>
        <p className="font-display text-xl md:text-2xl font-extrabold mt-0.5 truncate num" style={{ color: "var(--text-primary)" }}>{value}</p>
        {subtitle && <p className="text-xs mt-0.5 truncate" style={{ color: "var(--text-muted)" }}>{subtitle}</p>}
        {trend && (
          <p className="flex items-center gap-1 text-xs font-semibold mt-1" style={{ color: trend.up ? "var(--good)" : "var(--bad)" }}>
            {trend.up ? <TrendingUp size={ICON_SIZE.xs} /> : <TrendingDown size={ICON_SIZE.xs} />} {trend.value} vs last month
          </p>
        )}
      </div>
    </div>
  );
}
