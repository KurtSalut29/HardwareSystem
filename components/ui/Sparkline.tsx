"use client";

import { AreaChart, Area, Tooltip } from "recharts";

type Point = { label: string; value: number };

function SparklineTooltip({ active, payload, valuePrefix }: { active?: boolean; payload?: { payload: Point }[]; valuePrefix: string }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-md px-2.5 py-1.5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{p.label}</p>
      <p className="text-xs font-semibold text-gray-900 num">{valuePrefix}{p.value.toLocaleString()}</p>
    </div>
  );
}

type Props = {
  data: Point[];
  /** Unique per mounted instance — Recharts gradients are SVG defs and collide by id if two charts share one. */
  gradientId: string;
  color?: string;
  colorInk?: string;
  width?: number;
  height?: number;
  valuePrefix?: string;
};

export default function Sparkline({ data, gradientId, color = "#1E4FD8", colorInk = "#12327F", width = 68, height = 30, valuePrefix = "₱" }: Props) {
  return (
    <AreaChart width={width} height={height} data={data} margin={{ top: 3, right: 1, left: 1, bottom: 0 }}>
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <Tooltip content={<SparklineTooltip valuePrefix={valuePrefix} />} cursor={false} />
      <Area
        type="monotone"
        dataKey="value"
        stroke={color}
        strokeWidth={1.75}
        fill={`url(#${gradientId})`}
        dot={false}
        activeDot={{ r: 3, fill: colorInk, strokeWidth: 1, stroke: "#fff" }}
        isAnimationActive
        animationDuration={1100}
        animationEasing="ease-out"
      />
    </AreaChart>
  );
}
