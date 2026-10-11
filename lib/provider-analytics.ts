export const PROVIDER_ANALYTICS_RANGES = [7, 15, 30, 90, "all"] as const;

export type ProviderAnalyticsRange = (typeof PROVIDER_ANALYTICS_RANGES)[number];

export const PROVIDER_ANALYTICS_RANGE_LABELS: Record<ProviderAnalyticsRange, string> = {
  7: "Last 7 days",
  15: "Last 15 days",
  30: "Last 30 days",
  90: "Last 90 days",
  all: "All time",
};

export function parseProviderAnalyticsRange(value: string | null | undefined): ProviderAnalyticsRange {
  if (value === "all") return "all";
  const parsed = Number(value);
  return parsed === 7 || parsed === 15 || parsed === 30 || parsed === 90 ? parsed : 30;
}

export function getProviderAnalyticsWindow(range: ProviderAnalyticsRange, now = new Date()) {
  const until = new Date(now);
  const since = range === "all" ? new Date(0) : new Date(until.getTime() - range * 86400000);
  return { since, until };
}
