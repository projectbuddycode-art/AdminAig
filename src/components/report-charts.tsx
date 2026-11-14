export type ChartPoint = { label: string; value: number };
export type ChartSlice = { label: string; value: number; color: string };

const COLORS = ["#1e3a5f", "#3d6f9a", "#2c7a4a", "#8d6414", "#9b1c2a", "#5c6b7a"];

export function chartColor(index: number) {
  return COLORS[index % COLORS.length];
}

export function LineChart({ points, label }: { points: ChartPoint[]; label: string }) {
  if (points.length === 0 || points.every((point) => point.value === 0)) {
    return <p className="text-sm text-[var(--muted)]">No {label.toLowerCase()} in this range.</p>;
  }
  const width = 640;
  const height = 220;
  const max = Math.max(...points.map((point) => point.value), 1);
  const step = points.length === 1 ? 0 : (width - 48) / (points.length - 1);
  const coords = points.map((point, index) => {
    const x = 32 + index * step;
    const y = 24 + (1 - point.value / max) * 160;
    return { ...point, x, y };
  });
  const path = coords.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} className="h-56 w-full">
      <line x1="32" y1="184" x2={width - 8} y2="184" stroke="#e6dcc8" />
      <path d={path} fill="none" stroke="#1e3a5f" strokeWidth="2.5" />
      {coords.map((point) => (
        <g key={point.label}>
          <circle cx={point.x} cy={point.y} r="4" fill="#1e3a5f">
            <title>{`${point.label}: ${point.value}`}</title>
          </circle>
        </g>
      ))}
      <text x="32" y="208" fontSize="11" fill="#5c564c">
        {points[0]?.label}
      </text>
      <text x={width - 120} y="208" fontSize="11" fill="#5c564c">
        {points[points.length - 1]?.label}
      </text>
    </svg>
  );
}

export function BarChart({ points, label }: { points: ChartPoint[]; label: string }) {
  if (points.length === 0 || points.every((point) => point.value === 0)) {
    return <p className="text-sm text-[var(--muted)]">No {label.toLowerCase()} in this range.</p>;
  }
  const max = Math.max(...points.map((point) => point.value), 1);
  return (
    <div className="flex h-56 items-end gap-2" role="img" aria-label={label}>
      {points.map((point) => (
        <div key={point.label} className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <div
            className="w-full rounded-t-md bg-[#1e3a5f]"
            style={{ height: `${Math.max(4, (point.value / max) * 180)}px` }}
            title={`${point.label}: ${point.value}`}
          />
          <span className="w-full truncate text-center text-[10px] text-[var(--muted)]">{point.label}</span>
        </div>
      ))}
    </div>
  );
}

export function Donut({ slices, label }: { slices: ChartSlice[]; label: string }) {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  if (total === 0) return <p className="text-sm text-[var(--muted)]">No {label.toLowerCase()} in this range.</p>;
  let cursor = 0;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="flex flex-wrap items-center gap-4">
      <svg viewBox="0 0 120 120" className="h-36 w-36" role="img" aria-label={label}>
        <circle cx="60" cy="60" r={radius} fill="none" stroke="#efe8d9" strokeWidth="14" />
        {slices.map((slice) => {
          const length = (slice.value / total) * circumference;
          const dash = `${length} ${circumference - length}`;
          const rotation = (cursor / total) * 360 - 90;
          cursor += slice.value;
          return (
            <circle
              key={slice.label}
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke={slice.color}
              strokeWidth="14"
              strokeDasharray={dash}
              transform={`rotate(${rotation} 60 60)`}
            >
              <title>{`${slice.label}: ${slice.value}`}</title>
            </circle>
          );
        })}
      </svg>
      <ul className="space-y-1 text-sm">
        {slices.map((slice) => (
          <li key={slice.label} className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: slice.color }} />
            {slice.label}: {slice.value}
          </li>
        ))}
      </ul>
    </div>
  );
}
