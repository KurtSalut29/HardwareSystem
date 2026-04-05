import { ReactNode } from "react";

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
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
      <div className={`w-9 h-9 md:w-10 md:h-10 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] md:text-xs font-medium text-gray-400 uppercase tracking-wide truncate">{title}</p>
        <p className="text-xl md:text-2xl font-bold text-gray-900 mt-0.5 truncate">{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5 truncate">{subtitle}</p>}
        {trend && (
          <p className={`text-xs font-medium mt-1 ${trend.up ? "text-emerald-500" : "text-red-500"}`}>
            {trend.up ? "↑" : "↓"} {trend.value} vs last month
          </p>
        )}
      </div>
    </div>
  );
}
