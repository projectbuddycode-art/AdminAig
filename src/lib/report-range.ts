export const REPORT_PRESETS = [
  "today",
  "yesterday",
  "7d",
  "30d",
  "90d",
  "month",
  "lastMonth",
  "year",
  "custom",
] as const;

export type ReportPreset = (typeof REPORT_PRESETS)[number];

export type ReportRange = {
  preset: ReportPreset;
  label: string;
  from: Date;
  to: Date;
  previousFrom: Date;
  previousTo: Date;
};

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export function resolveReportRange(input: {
  preset?: string;
  from?: string;
  to?: string;
  now?: Date;
}): ReportRange {
  const now = input.now ?? new Date();
  const preset = (REPORT_PRESETS as readonly string[]).includes(input.preset ?? "")
    ? (input.preset as ReportPreset)
    : "30d";
  let from = startOfDay(addDays(now, -29));
  let to = endOfDay(now);
  let label = "Last 30 days";

  if (preset === "today") {
    from = startOfDay(now);
    to = endOfDay(now);
    label = "Today";
  } else if (preset === "yesterday") {
    from = startOfDay(addDays(now, -1));
    to = endOfDay(addDays(now, -1));
    label = "Yesterday";
  } else if (preset === "7d") {
    from = startOfDay(addDays(now, -6));
    label = "Last 7 days";
  } else if (preset === "90d") {
    from = startOfDay(addDays(now, -89));
    label = "Last 90 days";
  } else if (preset === "month") {
    from = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1));
    label = "This month";
  } else if (preset === "lastMonth") {
    from = startOfDay(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    to = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
    label = "Last month";
  } else if (preset === "year") {
    from = startOfDay(new Date(now.getFullYear(), 0, 1));
    label = "This year";
  } else if (preset === "custom") {
    const parsedFrom = input.from ? new Date(input.from) : from;
    const parsedTo = input.to ? new Date(input.to) : to;
    if (!Number.isNaN(parsedFrom.getTime())) from = startOfDay(parsedFrom);
    if (!Number.isNaN(parsedTo.getTime())) to = endOfDay(parsedTo);
    if (from.getTime() > to.getTime()) {
      const swap = from;
      from = startOfDay(to);
      to = endOfDay(swap);
    }
    label = "Custom range";
  }

  const duration = to.getTime() - from.getTime();
  const previousTo = new Date(from.getTime() - 1);
  const previousFrom = new Date(previousTo.getTime() - duration);
  return { preset, label, from, to, previousFrom, previousTo };
}

export function formatChange(change: number | null) {
  if (change === null) return "No prior period";
  const rounded = Math.round(change * 10) / 10;
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded}% vs previous period`;
}
