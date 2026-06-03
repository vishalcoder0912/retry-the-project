import type { GeoLocationData } from "./geoIntelligenceEngine";

interface GeoRankingPanelProps {
  locations: GeoLocationData[];
  onCountryClick: (country: string) => void;
}

function rankMedal(index: number): string {
  if (index === 0) return "🥇";
  if (index === 1) return "🥈";
  if (index === 2) return "🥉";
  return "";
}

export default function GeoRankingPanel({
  locations,
  onCountryClick,
}: GeoRankingPanelProps) {
  const top5 = locations.slice(0, 5);

  if (!top5.length) return null;

  return (
    <div className="rounded-xl border border-slate-700/60 bg-slate-900/70 p-4">
      <h3 className="mb-3 text-sm font-semibold text-slate-200">
        Top {Math.min(5, locations.length)} Locations
      </h3>
      <div className="space-y-2">
        {top5.map((loc, index) => {
          const maxVal = top5[0].metricValue;
          const pct = maxVal > 0 ? (loc.metricValue / maxVal) * 100 : 0;

          return (
            <button
              key={loc.name}
              type="button"
              onClick={() => onCountryClick(loc.name)}
              className="w-full rounded-lg border border-transparent p-2 text-left transition hover:border-violet-500/40 hover:bg-violet-500/5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 truncate">
                  <span className="text-sm">{rankMedal(index)}</span>
                  <span className="truncate text-sm font-medium text-slate-200">
                    {loc.name}
                  </span>
                </div>
                <span className="shrink-0 text-sm font-semibold text-violet-300">
                  {loc.kpiFormatted}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="mt-0.5 flex justify-between text-xs text-slate-500">
                <span>{loc.recordCount.toLocaleString()} records</span>
                <span>#{loc.rank}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
