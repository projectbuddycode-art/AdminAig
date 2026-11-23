"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart as ReBarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart as ReLineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type ChartPoint = { label: string; value: number };
export type ChartSlice = { label: string; value: number; color: string };

const COLORS = ["#1e3a5f", "#3d6f9a", "#2c7a4a", "#8d6414", "#9b1c2a", "#5c6b7a", "#4a6fa5", "#6b8f71"];
const TOOLTIP_STYLE = {
  borderRadius: 8,
  border: "1px solid #d7deea",
  background: "#ffffff",
  boxShadow: "0 8px 24px rgba(30, 58, 95, 0.08)",
  fontSize: 12,
};

export function chartColor(index: number) {
  return COLORS[index % COLORS.length];
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-[#d7deea] bg-[#f7f9fc] px-4 text-center text-sm text-[var(--muted)]">
      No {label.toLowerCase()} in this range.
    </div>
  );
}

export function LineChart({ points, label, color = "#1e3a5f" }: { points: ChartPoint[]; label: string; color?: string }) {
  if (points.length === 0 || points.every((point) => point.value === 0)) return <EmptyChart label={label} />;
  return (
    <div className="h-56 w-full" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <ReLineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#e8eef5" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: "#6b7280", fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} tickLine={false} axisLine={false} width={36} allowDecimals={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Line type="monotone" dataKey="value" name={label} stroke={color} strokeWidth={2.5} dot={{ r: 3, fill: color }} activeDot={{ r: 5 }} />
        </ReLineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AreaTrend({ points, label, color = "#1e3a5f" }: { points: ChartPoint[]; label: string; color?: string }) {
  if (points.length === 0 || points.every((point) => point.value === 0)) return <EmptyChart label={label} />;
  const fillId = `fill-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <div className="h-56 w-full" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#e8eef5" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: "#6b7280", fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} tickLine={false} axisLine={false} width={36} allowDecimals={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Area type="monotone" dataKey="value" name={label} stroke={color} fill={`url(#${fillId})`} strokeWidth={2.25} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DualTrend({
  primary,
  secondary,
  primaryLabel,
  secondaryLabel,
}: {
  primary: ChartPoint[];
  secondary: ChartPoint[];
  primaryLabel: string;
  secondaryLabel: string;
}) {
  if (primary.length === 0 && secondary.length === 0) return <EmptyChart label={primaryLabel} />;
  const labels = [...new Set([...primary.map((p) => p.label), ...secondary.map((p) => p.label)])].sort();
  const primaryMap = new Map(primary.map((p) => [p.label, p.value]));
  const secondaryMap = new Map(secondary.map((p) => [p.label, p.value]));
  const data = labels.map((label) => ({
    label,
    [primaryLabel]: primaryMap.get(label) ?? 0,
    [secondaryLabel]: secondaryMap.get(label) ?? 0,
  }));
  return (
    <div className="h-56 w-full" role="img" aria-label={`${primaryLabel} and ${secondaryLabel}`}>
      <ResponsiveContainer width="100%" height="100%">
        <ReLineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="#e8eef5" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: "#6b7280", fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={24} />
          <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} tickLine={false} axisLine={false} width={36} allowDecimals={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend verticalAlign="top" height={28} iconType="circle" />
          <Line type="monotone" dataKey={primaryLabel} stroke="#1e3a5f" strokeWidth={2.4} dot={false} />
          <Line type="monotone" dataKey={secondaryLabel} stroke="#2c7a4a" strokeWidth={2.2} strokeDasharray="4 3" dot={false} />
        </ReLineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function BarChart({ points, label, color = "#1e3a5f", horizontal = false }: { points: ChartPoint[]; label: string; color?: string; horizontal?: boolean }) {
  if (points.length === 0 || points.every((point) => point.value === 0)) return <EmptyChart label={label} />;
  return (
    <div className="h-56 w-full" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <ReBarChart data={points} layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 8, right: 8, left: horizontal ? 16 : 0, bottom: 0 }}>
          <CartesianGrid stroke="#e8eef5" strokeDasharray="3 3" horizontal={!horizontal} vertical={horizontal} />
          {horizontal ? (
            <>
              <XAxis type="number" tick={{ fill: "#6b7280", fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis type="category" dataKey="label" width={88} tick={{ fill: "#6b7280", fontSize: 11 }} tickLine={false} axisLine={false} />
            </>
          ) : (
            <>
              <XAxis dataKey="label" tick={{ fill: "#6b7280", fontSize: 11 }} tickLine={false} axisLine={false} minTickGap={16} />
              <YAxis tick={{ fill: "#6b7280", fontSize: 11 }} tickLine={false} axisLine={false} width={36} allowDecimals={false} />
            </>
          )}
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Bar dataKey="value" name={label} fill={color} radius={horizontal ? [0, 6, 6, 0] : [6, 6, 0, 0]} maxBarSize={42}>
            {points.map((point, index) => (
              <Cell key={point.label} fill={chartColor(index)} />
            ))}
          </Bar>
        </ReBarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Donut({ slices, label }: { slices: ChartSlice[]; label: string }) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  if (total === 0) return <EmptyChart label={label} />;
  return (
    <div className="flex h-56 flex-col items-center gap-2 sm:flex-row" role="img" aria-label={label}>
      <div className="h-44 w-full min-w-0 flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={slices} dataKey="value" nameKey="label" innerRadius={48} outerRadius={72} paddingAngle={2} stroke="#fff" strokeWidth={2}>
              {slices.map((slice) => (
                <Cell key={slice.label} fill={slice.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="w-full space-y-1.5 text-sm sm:max-w-[11rem]">
        {slices.map((slice) => (
          <li key={slice.label} className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: slice.color }} />
              <span className="truncate">{slice.label}</span>
            </span>
            <span className="font-semibold tabular-nums text-[#1e3a5f]">{slice.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
