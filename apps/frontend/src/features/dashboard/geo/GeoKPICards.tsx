import type { GeoLocationData } from "./geoIntelligenceEngine";

interface GeoKPICardsProps {
  topLocation: GeoLocationData | null;
  bottomLocation: GeoLocationData | null;
  totalLocations: number;
  averageMetric: number;
  totalRecords: number;
  metricField: string;
  activityLabel: string;
}

function formatMetricValue(value: number, field: string): string {
  if (!field || field === "__count__") return value.toLocaleString();

  const fl = field.toLowerCase();
  if (
    fl.includes("salary") || fl.includes("revenue") || fl.includes("sales") ||
    fl.includes("profit") || fl.includes("income") || fl.includes("price") ||
    fl.includes("cost") || fl.includes("budget") || fl.includes("amount")
  ) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
  }

  if (fl.includes("percent") || fl.includes("rate")) return value.toFixed(2) + "%";
  if (Number.isInteger(value)) return value.toLocaleString();
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export default function GeoKPICards({
  topLocation,
  bottomLocation: _bottomLocation,
  totalLocations,
  averageMetric,
  totalRecords,
  metricField,
  activityLabel,
}: GeoKPICardsProps) {
  const cards = [
    {
      label: "Locations",
      value: totalLocations.toLocaleString(),
      subtitle: "Countries/regions with data",
      color: "border-l-violet-500",
    },
    {
      label: "Top Location",
      value: topLocation?.name || "—",
      subtitle: topLocation
        ? `${topLocation.kpiLabel}: ${topLocation.kpiFormatted}`
        : "No data available",
      color: "border-l-emerald-500",
    },
    {
      label: "Average",
      value: formatMetricValue(averageMetric, metricField),
      subtitle: `Across ${totalLocations} locations`,
      color: "border-l-blue-500",
    },
    {
      label: "Total Records",
      value: totalRecords.toLocaleString(),
      subtitle: activityLabel,
      color: "border-l-amber-500",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`rounded-xl border border-slate-700/60 bg-slate-900/70 p-4 ${card.color} border-l-4`}
        >
          <p className="text-xs text-slate-400">{card.label}</p>
          <p className="mt-1 truncate text-lg font-semibold text-white">
            {card.value}
          </p>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {card.subtitle}
          </p>
        </div>
      ))}
    </div>
  );
}
