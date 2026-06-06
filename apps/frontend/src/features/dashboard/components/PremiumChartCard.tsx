import { useState } from "react";
import { BarChart3, Copy, Download, Edit3, Eye, EyeOff, Globe2, Map, RefreshCw, Trash2, ZoomIn, ZoomOut } from "lucide-react";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { PremiumChart } from "@/features/dashboard/types/premiumDashboardTypes";

const palette = ["#8b5cf6", "#06b6d4", "#22c55e", "#f97316", "#ec4899", "#6366f1", "#eab308"];

const geoCoordinates: Record<string, { x: number; y: number }> = {
  usa: { x: 205, y: 188 },
  us: { x: 205, y: 188 },
  "united states": { x: 205, y: 188 },
  canada: { x: 205, y: 132 },
  mexico: { x: 188, y: 245 },
  brazil: { x: 330, y: 340 },
  argentina: { x: 315, y: 415 },
  uk: { x: 470, y: 155 },
  "united kingdom": { x: 470, y: 155 },
  england: { x: 470, y: 155 },
  france: { x: 485, y: 182 },
  germany: { x: 505, y: 172 },
  spain: { x: 470, y: 205 },
  italy: { x: 510, y: 205 },
  netherlands: { x: 492, y: 163 },
  sweden: { x: 525, y: 120 },
  norway: { x: 505, y: 115 },
  russia: { x: 650, y: 135 },
  turkey: { x: 555, y: 220 },
  egypt: { x: 535, y: 260 },
  nigeria: { x: 500, y: 305 },
  "south africa": { x: 535, y: 405 },
  uae: { x: 610, y: 255 },
  "united arab emirates": { x: 610, y: 255 },
  india: { x: 680, y: 275 },
  china: { x: 760, y: 225 },
  japan: { x: 860, y: 225 },
  singapore: { x: 735, y: 325 },
  australia: { x: 815, y: 390 },
  "new zealand": { x: 900, y: 430 },
  asia: { x: 700, y: 235 },
  europe: { x: 505, y: 170 },
  africa: { x: 530, y: 320 },
  "north america": { x: 205, y: 180 },
  "south america": { x: 325, y: 355 },
  oceania: { x: 820, y: 390 },
};

const geoPositions: Record<string, { lat: number; lng: number; region: string }> = {
  usa: { lat: 39.8, lng: -98.6, region: "North America" },
  us: { lat: 39.8, lng: -98.6, region: "North America" },
  "united states": { lat: 39.8, lng: -98.6, region: "North America" },
  canada: { lat: 56.1, lng: -106.3, region: "North America" },
  mexico: { lat: 23.6, lng: -102.5, region: "North America" },
  brazil: { lat: -14.2, lng: -51.9, region: "South America" },
  argentina: { lat: -38.4, lng: -63.6, region: "South America" },
  uk: { lat: 55.4, lng: -3.4, region: "Europe" },
  "united kingdom": { lat: 55.4, lng: -3.4, region: "Europe" },
  england: { lat: 52.4, lng: -1.2, region: "Europe" },
  france: { lat: 46.2, lng: 2.2, region: "Europe" },
  germany: { lat: 51.2, lng: 10.4, region: "Europe" },
  spain: { lat: 40.4, lng: -3.7, region: "Europe" },
  italy: { lat: 41.9, lng: 12.6, region: "Europe" },
  netherlands: { lat: 52.1, lng: 5.3, region: "Europe" },
  sweden: { lat: 60.1, lng: 18.6, region: "Europe" },
  norway: { lat: 60.5, lng: 8.5, region: "Europe" },
  russia: { lat: 61.5, lng: 105.3, region: "Europe/Asia" },
  turkey: { lat: 39.0, lng: 35.2, region: "Europe/Asia" },
  egypt: { lat: 26.8, lng: 30.8, region: "Africa" },
  nigeria: { lat: 9.1, lng: 8.7, region: "Africa" },
  "south africa": { lat: -30.6, lng: 22.9, region: "Africa" },
  uae: { lat: 24.4, lng: 54.4, region: "Middle East" },
  "united arab emirates": { lat: 24.4, lng: 54.4, region: "Middle East" },
  india: { lat: 20.6, lng: 78.9, region: "Asia" },
  china: { lat: 35.9, lng: 104.2, region: "Asia" },
  japan: { lat: 36.2, lng: 138.3, region: "Asia" },
  singapore: { lat: 1.35, lng: 103.8, region: "Asia" },
  australia: { lat: -25.3, lng: 133.8, region: "Oceania" },
  "new zealand": { lat: -40.9, lng: 174.9, region: "Oceania" },
};

const projectGeoPoint = (lat: number, lng: number, mode: "Map" | "Globe") => {
  if (mode === "Globe") {
    const lambda = (lng * Math.PI) / 180;
    const phi = (lat * Math.PI) / 180;
    const x = 500 + 295 * Math.cos(phi) * Math.sin(lambda);
    const y = 260 - 235 * Math.sin(phi);
    return { x, y };
  }
  return {
    x: ((lng + 180) / 360) * 1000,
    y: ((90 - lat) / 180) * 520,
  };
};

const normalizeGeoLabel = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const shortTick = (value: unknown) => {
  const text = String(value ?? "");
  return text.length > 10 ? `${text.slice(0, 9)}\u2026` : text;
};

function ChartBody({ chart }: { chart: PremiumChart }) {
  const [mapMetric, setMapMetric] = useState(chart.yKey || "value");
  const [hoveredLocation, setHoveredLocation] = useState<string | null>(null);
  const [geoViewMode, setGeoViewMode] = useState<"Map" | "Globe" | "Chart">("Map");
  const [geoChartType, setGeoChartType] = useState<"bar" | "area" | "donut">("bar");
  const [mapZoom, setMapZoom] = useState(1);
  const activeMapMetric = chart.metricOptions?.some((item) => item.key === mapMetric) ? mapMetric : chart.yKey || "value";

  if (!Array.isArray(chart.data) || !chart.data.length) {
    return (
      <div className="min-h-[300px] rounded-2xl border border-slate-800 bg-slate-950/70 p-6 text-slate-300">
        <h3 className="mb-2 text-base font-semibold text-white">
          {chart.title || "Empty chart"}
        </h3>
        <p className="text-sm text-slate-400">
          This chart has no data yet. Try changing the aggregation, field, or
          filter.
        </p>
      </div>
    );
  }

  if (chart.type === "donut") {
    return (
      <ResponsiveContainer width="100%" height={250}>
        <PieChart>
          <Pie data={chart.data} dataKey={chart.yKey || "value"} nameKey={chart.xKey || "label"} innerRadius={62} outerRadius={92} paddingAngle={3}>
            {chart.data.map((entry, index) => (
              <Cell key={`${String(entry[chart.xKey || "label"] ?? entry.label ?? "slice")}-${index}`} fill={palette[index % palette.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={{ background: "#020617", border: "1px solid rgba(139,92,246,.35)", borderRadius: 12, color: "#fff" }} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (chart.type === "scatter") {
    let scatterData = chart.data;
    if (scatterData.length > 150) {
      const step = Math.ceil(scatterData.length / 150);
      scatterData = scatterData.filter((_, idx) => idx % step === 0);
    }

    return (
      <ResponsiveContainer width="100%" height={250}>
        <ScatterChart margin={{ top: 12, right: 20, bottom: 20, left: 10 }}>
          <CartesianGrid stroke="rgba(148,163,184,.12)" />
          <XAxis 
            dataKey={chart.xKey || "x"} 
            stroke="#94a3b8" 
            fontSize={11} 
            tickCount={5} 
            label={{ value: chart.xKey || "X Axis", position: 'insideBottom', offset: -10, fill: '#94a3b8', fontSize: 10 }}
            height={40}
          />
          <YAxis 
            dataKey={chart.yKey || "y"} 
            stroke="#94a3b8" 
            fontSize={11} 
            tickCount={5} 
            label={{ value: chart.yKey || "Y Axis", angle: -90, position: 'insideLeft', offset: 0, fill: '#94a3b8', fontSize: 10 }}
          />
          <Tooltip 
            cursor={{ strokeDasharray: "3 3" }} 
            contentStyle={{ background: "#020617", border: "1px solid rgba(34,211,238,.35)", borderRadius: 12, color: "#fff" }} 
          />
          <Scatter data={scatterData} fill="#22d3ee" fillOpacity={0.6} />
        </ScatterChart>
      </ResponsiveContainer>
    );
  }

  if (chart.type === "map") {
    const max = Math.max(...chart.data.map((item) => Number(item[activeMapMetric] ?? item[chart.yKey || "value"] ?? 0)), 1);
    const min = Math.min(...chart.data.map((item) => Number(item[activeMapMetric] ?? item[chart.yKey || "value"] ?? 0)).filter(Number.isFinite), 0);
    const locationKey = chart.xKey || "label";
    const valueKey = activeMapMetric;
    const metricLabel = chart.metricOptions?.find((item) => item.key === activeMapMetric)?.label || "Metric";
    const ranked = chart.data
      .map((row) => ({
        label: String(row[locationKey] ?? row.label ?? "Unknown"),
        value: Number(row[valueKey] ?? row.value ?? row.count ?? 0),
        count: Number(row.count ?? row.value ?? 0),
        lat: Number(row.lat),
        lng: Number(row.lng),
        topCategory: String(row.topCategory ?? "Not available"),
      }))
      .sort((left, right) => right.value - left.value);
    const activeLocation = ranked.find((row) => row.label === hoveredLocation) || ranked[0];
    const markers = ranked
      .map((row) => {
        const labelKey = normalizeGeoLabel(row.label);
        const knownPosition = geoPositions[labelKey];
        const point =
          geoViewMode === "Globe"
            ? (Number.isFinite(row.lat) && Number.isFinite(row.lng)
                ? projectGeoPoint(row.lat, row.lng, "Globe")
                : knownPosition
                  ? projectGeoPoint(knownPosition.lat, knownPosition.lng, "Globe")
                  : null)
            : (geoCoordinates[labelKey]
                ? geoCoordinates[labelKey]
                : (Number.isFinite(row.lat) && Number.isFinite(row.lng)
                    ? projectGeoPoint(row.lat, row.lng, "Map")
                    : knownPosition
                      ? projectGeoPoint(knownPosition.lat, knownPosition.lng, "Map")
                      : null));
        return { ...row, point, region: knownPosition?.region || "Global" };
      })
      .filter((row): row is { label: string; value: number; count: number; topCategory: string; region: string; point: { x: number; y: number } } => Boolean(row.point));
    const topMetric = ranked[0];
    const lowMetric = [...ranked].reverse()[0];
    const mostRecords = [...ranked].sort((left, right) => right.count - left.count)[0];
    const geoQuality = Math.round((markers.length / Math.max(ranked.length, 1)) * 100);
    const topTen = ranked.slice(0, 10);
    const totalRecords = ranked.reduce((sum, row) => sum + row.count, 0) || 1;
    const exportGeo = () => {
      const csv = ["country,records,metric,top_category,rank", ...ranked.map((row, index) => `${row.label},${row.count},${row.value},"${row.topCategory}",${index + 1}`)].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = "global-geo-intelligence.csv";
      link.click();
      URL.revokeObjectURL(href);
    };

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4 rounded-3xl border border-cyan-300/20 bg-slate-950/75 p-4 shadow-[0_0_34px_rgba(6,182,212,0.12)] backdrop-blur-xl">
          <div>
            <h3 className="text-xl font-black tracking-tight text-white">Global Geo Intelligence</h3>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-400">
              Country-level distribution, metric intensity, and regional performance insights
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {chart.metricOptions && chart.metricOptions.length > 1 && (
              <select
                aria-label="Map metric"
                value={activeMapMetric}
                onChange={(event) => setMapMetric(event.target.value)}
                className="h-10 rounded-xl border border-slate-700 bg-slate-950 px-3 text-xs font-semibold text-slate-100 outline-none transition focus:border-cyan-400"
              >
                {chart.metricOptions.map((metric) => (
                  <option key={metric.key} value={metric.key}>{metric.label}</option>
                ))}
              </select>
            )}
            <div className="flex rounded-xl border border-slate-700 bg-slate-950/80 p-1">
              {(["Map", "Globe", "Chart"] as const).map((mode) => {
                const Icon = mode === "Map" ? Map : mode === "Globe" ? Globe2 : BarChart3;
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setGeoViewMode(mode)}
                    className={`inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs transition ${geoViewMode === mode ? "bg-violet-600 text-white shadow-[0_0_14px_rgba(124,58,237,.38)]" : "text-slate-400 hover:text-white"}`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {mode}
                  </button>
                );
              })}
            </div>
            <button type="button" onClick={() => setHoveredLocation(null)} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-700 bg-slate-950 text-slate-300 transition hover:border-cyan-300/50 hover:text-cyan-200" title="Refresh geo view">
              <RefreshCw className="h-4 w-4" />
            </button>
            <button type="button" onClick={exportGeo} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-700 bg-slate-950 text-slate-300 transition hover:border-emerald-300/50 hover:text-emerald-200" title="Export geo data">
              <Download className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="grid gap-4 2xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]">
          {geoViewMode !== "Chart" && (
            <div className="relative min-h-[460px] overflow-hidden rounded-3xl border border-cyan-400/20 bg-[#020817] shadow-[inset_0_0_55px_rgba(14,165,233,0.09),0_0_35px_rgba(6,182,212,0.09)]">
              <div className="absolute left-4 top-4 z-10 w-72 rounded-2xl border border-white/10 bg-slate-950/90 p-4 text-xs shadow-[0_0_28px_rgba(0,0,0,0.5)] backdrop-blur-xl">
                <div className="flex items-center gap-2 border-b border-white/10 pb-2 mb-2">
                  <span className="text-lg">
                    {(() => {
                      const labelKey = normalizeGeoLabel(activeLocation?.label);
                      return labelKey === 'usa' || labelKey === 'united states' ? '🇺🇸' :
                             labelKey === 'uk' || labelKey === 'united kingdom' ? '🇬🇧' :
                             labelKey === 'canada' ? '🇨🇦' :
                             labelKey === 'germany' ? '🇩🇪' :
                             labelKey === 'france' ? '🇫🇷' :
                             labelKey === 'japan' ? '🇯🇵' :
                             labelKey === 'singapore' ? '🇸🇬' :
                             labelKey === 'australia' ? '🇦🇺' :
                             labelKey === 'brazil' ? '🇧🇷' :
                             labelKey === 'india' ? '🇮🇳' : '🌍';
                    })()}
                  </span>
                  <span className="text-base font-bold text-white">{activeLocation?.label || "No location"}</span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Records</span>
                    <span className="font-semibold text-white">{Number(activeLocation?.count || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">{metricLabel}</span>
                    <span className="font-semibold text-cyan-300">
                      {/salary|amount|revenue|sales|profit|price|cost|usd/i.test(activeMapMetric)
                        ? `$${Number(activeLocation?.value || 0).toLocaleString()}`
                        : Number(activeLocation?.value || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Top Category</span>
                    <span className="font-semibold text-white truncate max-w-[150px]">{activeLocation?.topCategory || "Not available"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Rank</span>
                    <span className={`font-semibold ${ranked.findIndex((row) => row.label === activeLocation?.label) === 0 ? "text-yellow-400" : "text-white"}`}>
                      #{Math.max(1, ranked.findIndex((row) => row.label === activeLocation?.label) + 1)}
                    </span>
                  </div>
                </div>
                <div className="mt-3 pt-2 border-t border-white/10 text-right">
                  <button type="button" className="text-xs font-semibold text-cyan-400 hover:underline">View Details →</button>
                </div>
              </div>
              <div className="absolute right-4 top-4 z-10 flex rounded-2xl border border-slate-700 bg-slate-950/85 p-1 backdrop-blur">
                <button type="button" onClick={() => setMapZoom((value) => Math.min(1.8, Number((value + 0.15).toFixed(2))))} className="grid h-8 w-8 place-items-center rounded-xl text-slate-300 hover:bg-slate-800 hover:text-white" title="Zoom in">
                  <ZoomIn className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => setMapZoom((value) => Math.max(0.75, Number((value - 0.15).toFixed(2))))} className="grid h-8 w-8 place-items-center rounded-xl text-slate-300 hover:bg-slate-800 hover:text-white" title="Zoom out">
                  <ZoomOut className="h-4 w-4" />
                </button>
              </div>
              <svg viewBox="0 0 1000 540" className="h-[460px] w-full" role="img" aria-label={`${chart.title} global map`}>
                <defs>
                  <radialGradient id={`${chart.id}-activity-glow`} cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.8" />
                    <stop offset="58%" stopColor="#8b5cf6" stopOpacity="0.24" />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" />
                  </radialGradient>
                  <linearGradient id={`${chart.id}-ocean`} x1="0%" x2="100%" y1="0%" y2="100%">
                    <stop offset="0%" stopColor="#02010a" />
                    <stop offset="55%" stopColor="#050212" />
                    <stop offset="100%" stopColor="#0e0620" />
                  </linearGradient>
                  <linearGradient id={`${chart.id}-land`} x1="0%" x2="100%" y1="0%" y2="100%">
                    <stop offset="0%" stopColor="#0f224a" />
                    <stop offset="100%" stopColor="#132c63" />
                  </linearGradient>
                </defs>
                <rect width="1000" height="540" fill={`url(#${chart.id}-ocean)`} />
                <g transform={`translate(500 270) scale(${mapZoom}) translate(-500 -270)`}>
                  {geoViewMode === "Globe" && <circle cx="500" cy="270" r="255" fill={`url(#${chart.id}-ocean)`} stroke="#2f63d4" strokeOpacity="0.4" strokeWidth={1.2} />}
                  {Array.from({ length: 7 }).map((_, index) => (
                    <path key={`lat-${index}`} d={`M55 ${100 + index * 55} H945`} stroke="#1e3a5f" strokeOpacity="0.38" strokeDasharray="5 12" />
                  ))}
                  {Array.from({ length: 9 }).map((_, index) => (
                    <path key={`lon-${index}`} d={`M${100 + index * 100} 60 V480`} stroke="#1e3a5f" strokeOpacity="0.32" strokeDasharray="5 12" />
                  ))}
                  <path d="M105 142 C140 91 220 79 289 108 C336 129 346 185 301 214 C259 243 181 233 133 203 C103 184 84 166 105 142 Z" fill={`url(#${chart.id}-land)`} stroke="#2f63d4" strokeOpacity={0.8} strokeWidth={1.2} />
                  <path d="M258 250 C316 260 368 312 362 378 C354 444 309 480 271 439 C232 396 230 313 258 250 Z" fill={`url(#${chart.id}-land)`} stroke="#2f63d4" strokeOpacity={0.8} strokeWidth={1.2} />
                  <path d="M426 145 C470 99 561 97 632 131 C702 164 704 222 623 230 C545 237 458 211 421 176 C405 162 407 154 426 145 Z" fill={`url(#${chart.id}-land)`} stroke="#2f63d4" strokeOpacity={0.8} strokeWidth={1.2} />
                  <path d="M503 232 C569 214 644 253 652 330 C660 408 593 459 538 410 C490 368 463 266 503 232 Z" fill={`url(#${chart.id}-land)`} stroke="#2f63d4" strokeOpacity={0.8} strokeWidth={1.2} />
                  <path d="M630 183 C706 96 865 123 915 214 C951 279 874 344 758 315 C673 294 590 240 630 183 Z" fill={`url(#${chart.id}-land)`} stroke="#2f63d4" strokeOpacity={0.8} strokeWidth={1.2} />
                  <path d="M758 372 C815 340 900 369 923 423 C891 472 788 468 743 418 Z" fill={`url(#${chart.id}-land)`} stroke="#2f63d4" strokeOpacity={0.8} strokeWidth={1.2} />
                  <path d="M500 270 m-420 0 a420 165 0 1 0 840 0 a420 165 0 1 0 -840 0" fill="none" stroke="#38bdf8" strokeOpacity="0.16" />
                  {markers.map((marker, index) => {
                    const radius = Math.max(9, Math.min(30, 7 + (marker.count / Math.max(...ranked.map((row) => row.count), 1)) * 24));
                    const intensity = max === min ? 1 : (marker.value - min) / (max - min);
                    const fill = intensity > 0.78 ? "#22c55e" : intensity > 0.55 ? "#22d3ee" : intensity > 0.32 ? "#8b5cf6" : "#f97316";
                    const isActive = hoveredLocation === marker.label;
                    return (
                      <motion.g
                        key={`${marker.label}-${index}`}
                        tabIndex={0}
                        role="button"
                        aria-label={`${marker.label}: ${metricLabel} ${marker.value.toLocaleString()}, ${marker.count.toLocaleString()} records, rank ${index + 1}`}
                        onMouseEnter={() => setHoveredLocation(marker.label)}
                        onFocus={() => setHoveredLocation(marker.label)}
                        onMouseLeave={() => setHoveredLocation(null)}
                        className="cursor-pointer outline-none"
                        initial={{ opacity: 0, scale: 0.82 }}
                        animate={{ opacity: 1, scale: isActive ? 1.08 : 1 }}
                        transition={{ delay: index * 0.035, type: "spring", stiffness: 170, damping: 18 }}
                      >
                        <circle cx={marker.point.x} cy={marker.point.y} r={radius * 2.6} fill={`url(#${chart.id}-activity-glow)`} opacity={isActive ? 1 : 0.72} />
                        <circle cx={marker.point.x} cy={marker.point.y} r={radius} fill={fill} fillOpacity={isActive ? 1 : 0.84} stroke="#e0f2fe" strokeWidth={isActive ? 3 : 1.8} />
                        <circle cx={marker.point.x} cy={marker.point.y} r={radius + 7} fill="none" stroke={fill} strokeOpacity={isActive ? 0.9 : 0.28} />
                        {isActive && <text x={marker.point.x + radius + 8} y={marker.point.y + 4} fill="#ffffff" fontSize="14" fontWeight="800" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.8))">{marker.label}</text>}
                        <title>{`${marker.label}\nRecords: ${marker.count.toLocaleString()}\n${metricLabel}: ${marker.value.toLocaleString()}\nTop category: ${marker.topCategory}\nRank: ${index + 1}`}</title>
                      </motion.g>
                    );
                  })}
                </g>
              </svg>
              <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-700/60 bg-slate-950/75 px-3 py-2 text-[11px] text-slate-300 backdrop-blur">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-24 rounded-full bg-gradient-to-r from-orange-400 via-violet-400 via-cyan-300 to-emerald-400" />
                  <span>{min.toLocaleString()} low</span>
                  <span>{max.toLocaleString()} high</span>
                </div>
                <span className="text-slate-500">Marker size = records. Marker color = {metricLabel.toLowerCase()} intensity.</span>
              </div>
              {!markers.length && (
                <div className="absolute inset-0 grid place-items-center bg-slate-950/80 px-6 text-center text-sm text-slate-300">
                  No geographic columns detected. Upload data with country, city, latitude, or longitude.
                </div>
              )}
            </div>
          )}

          <div className="space-y-4">
            <section className="rounded-3xl border border-violet-400/20 bg-slate-950/75 p-4 shadow-[0_0_28px_rgba(124,58,237,0.1)]">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-white">Global Performance Chart</h4>
                  <p className="text-xs text-slate-500">Top 10 countries by {metricLabel.toLowerCase()}</p>
                </div>
                <div className="flex rounded-xl border border-slate-700 bg-slate-950 p-1">
                  {(["bar", "area", "donut"] as const).map((type) => (
                    <button key={type} type="button" onClick={() => setGeoChartType(type)} className={`rounded-lg px-2 py-1 text-[11px] ${geoChartType === type ? "bg-cyan-500/20 text-cyan-200" : "text-slate-500 hover:text-white"}`}>
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  {geoChartType === "donut" ? (
                    <PieChart>
                      <Pie data={topTen.map((row) => ({ ...row, share: Number(((row.count / totalRecords) * 100).toFixed(2)) }))} dataKey="share" nameKey="label" innerRadius={58} outerRadius={92} paddingAngle={3}>
                        {topTen.map((entry, index) => (
                          <Cell key={`${entry.label}-area-${index}`} fill={palette[index % palette.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: "#020617", border: "1px solid rgba(34,211,238,.35)", borderRadius: 12, color: "#fff" }} />
                    </PieChart>
                  ) : geoChartType === "area" ? (
                    <AreaChart data={topTen} margin={{ top: 12, right: 20, bottom: 12, left: 0 }}>
                      <CartesianGrid stroke="rgba(148,163,184,.12)" />
                      <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickFormatter={shortTick} />
                      <YAxis stroke="#94a3b8" fontSize={11} tickCount={5} />
                      <Tooltip contentStyle={{ background: "#020617", border: "1px solid rgba(34,211,238,.35)", borderRadius: 12, color: "#fff" }} />
                      <Area type="monotone" dataKey="value" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.25} />
                    </AreaChart>
                  ) : (
                    <BarChart data={topTen} margin={{ top: 12, right: 20, bottom: 12, left: 0 }}>
                      <CartesianGrid stroke="rgba(148,163,184,.12)" vertical={false} />
                      <XAxis dataKey="label" stroke="#94a3b8" fontSize={11} tickFormatter={shortTick} />
                      <YAxis stroke="#94a3b8" fontSize={11} tickCount={5} />
                      <Tooltip contentStyle={{ background: "#020617", border: "1px solid rgba(34,211,238,.35)", borderRadius: 12, color: "#fff" }} />
                      <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                        {topTen.map((entry, index) => (
                          <Cell key={`${entry.label}-donut-${index}`} fill={palette[index % palette.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </section>

            <section className="rounded-3xl border border-cyan-400/20 bg-slate-950/75 p-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-cyan-200">Activity by location</p>
                <span className="rounded-full bg-cyan-400/10 px-2 py-1 text-[10px] text-cyan-200">{ranked.length} regions</span>
              </div>
              <div className="max-h-72 space-y-2 overflow-auto pr-1">
                {ranked.slice(0, 12).map((row, index) => {
                  const width = `${Math.max(10, (row.value / max) * 100)}%`;
                  const labelKey = normalizeGeoLabel(row.label);
                  const flag = labelKey === 'usa' || labelKey === 'united states' ? '🇺🇸' :
                               labelKey === 'uk' || labelKey === 'united kingdom' ? '🇬🇧' :
                               labelKey === 'canada' ? '🇨🇦' :
                               labelKey === 'germany' ? '🇩🇪' :
                               labelKey === 'france' ? '🇫🇷' :
                               labelKey === 'japan' ? '🇯🇵' :
                               labelKey === 'singapore' ? '🇸🇬' :
                               labelKey === 'australia' ? '🇦🇺' :
                               labelKey === 'brazil' ? '🇧🇷' :
                               labelKey === 'india' ? '🇮🇳' : '🌍';
                  return (
                    <button
                      key={`${row.label}-${index}`}
                      type="button"
                      onMouseEnter={() => setHoveredLocation(row.label)}
                      onFocus={() => setHoveredLocation(row.label)}
                      onMouseLeave={() => setHoveredLocation(null)}
                      className={`w-full rounded-xl border px-3 py-2 text-left transition ${hoveredLocation === row.label ? "border-cyan-300/40 bg-cyan-400/10" : "border-transparent bg-slate-900/50 hover:border-slate-700"}`}
                    >
                      <div className="mb-1 flex items-center justify-between gap-3 text-xs">
                        <span className="truncate font-medium text-slate-100">#{index + 1} {flag} {row.label}</span>
                        <span className="text-cyan-200">{row.value.toLocaleString()}</span>
                      </div>
                      <p className="mb-1 truncate text-[10px] text-slate-500">{row.count.toLocaleString()} records - {row.topCategory}</p>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                        <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-400" style={{ width }} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {[
            { label: "Highest performing country", value: topMetric?.label || "-", detail: topMetric ? `${metricLabel}: ${topMetric.value.toLocaleString()}` : "No metric" },
            { label: "Lowest performing country", value: lowMetric?.label || "-", detail: lowMetric ? `${metricLabel}: ${lowMetric.value.toLocaleString()}` : "No metric" },
            { label: "Most records country", value: mostRecords?.label || "-", detail: mostRecords ? `${mostRecords.count.toLocaleString()} records` : "No records" },
            { label: "Fastest growing region", value: "Trend unavailable", detail: "Upload a date column to unlock growth" },
            { label: "Geo data quality score", value: `${geoQuality}/100`, detail: `${markers.length} of ${ranked.length} locations mapped` },
          ].map((item) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-slate-800 bg-slate-950/75 p-4 shadow-[0_0_20px_rgba(34,211,238,0.06)]"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
              <p className="mt-2 truncate text-lg font-black text-white">{item.value}</p>
              <p className="mt-1 text-xs text-slate-400">{item.detail}</p>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  if (chart.type === "line") {
    return (
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={chart.data} margin={{ top: 12, right: 20, bottom: 12, left: 0 }}>
          <CartesianGrid stroke="rgba(148,163,184,.12)" />
          <XAxis dataKey={chart.xKey || "label"} stroke="#94a3b8" fontSize={11} tickFormatter={shortTick} interval="preserveStartEnd" />
          <YAxis stroke="#94a3b8" fontSize={11} tickCount={5} />
          <Tooltip contentStyle={{ background: "#020617", border: "1px solid rgba(139,92,246,.35)", borderRadius: 12, color: "#fff" }} />
          <Line type="monotone" dataKey={chart.yKey || "value"} stroke="#a855f7" strokeWidth={3} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (chart.type === "table") {
    const max = Math.max(...chart.data.map((item) => Number(item[chart.yKey || "value"] || 0)), 1);
    return (
      <div className="max-h-[250px] overflow-auto pr-1">
        <table className="w-full text-left text-xs">
          <thead className="text-slate-500">
            <tr><th className="py-2">Rank</th><th>Item</th><th className="text-right">Value</th><th className="w-28 text-right">Strength</th></tr>
          </thead>
          <tbody>
            {chart.data.map((row, index) => {
              const value = Number(row[chart.yKey || "value"] || 0);
              return (
                <tr key={`${row.label}-${index}`} className="border-t border-slate-800/80 text-slate-200">
                  <td className="py-2 text-slate-500">{index + 1}</td>
                  <td>{String(row.label)}</td>
                  <td className="text-right">{value.toLocaleString()}</td>
                  <td><div className="ml-auto h-2 w-24 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400" style={{ width: `${Math.max(8, (value / max) * 100)}%` }} /></div></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={chart.data} margin={{ top: 12, right: 20, bottom: 12, left: 0 }}>
        <CartesianGrid stroke="rgba(148,163,184,.12)" vertical={false} />
        <XAxis dataKey={chart.xKey || "label"} stroke="#94a3b8" fontSize={11} interval={chart.data.length > 6 ? "preserveStartEnd" : 0} tickFormatter={shortTick} angle={chart.data.length > 5 ? -30 : 0} textAnchor={chart.data.length > 5 ? "end" : "middle"} height={chart.data.length > 5 ? 68 : 50} />
        <YAxis stroke="#94a3b8" fontSize={11} tickCount={5} />
        <Tooltip contentStyle={{ background: "#020617", border: "1px solid rgba(139,92,246,.35)", borderRadius: 12, color: "#fff" }} />
        <Bar dataKey={chart.yKey || "value"} radius={[8, 8, 0, 0]}>
          {chart.data.map((entry, index) => (
            <Cell key={`${String(entry[chart.xKey || "label"] ?? entry.label ?? "bar")}-${index}`} fill={palette[index % palette.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export interface PremiumChartCardProps {
  chart: PremiumChart;
  isVisible?: boolean;
  isSelected?: boolean;
  isLoading?: boolean;
  error?: string | null;
  onEdit?: (chartId: string) => void;
  onRemove?: (chartId: string) => void;
  onDuplicate?: (chartId: string) => void;
  onToggleVisibility?: (chartId: string) => void;
  onSelect?: (chartId: string) => void;
  onReload?: (chartId: string) => void;
}

export default function PremiumChartCard({
  chart,
  isVisible = true,
  isSelected = false,
  isLoading = false,
  error = null,
  onEdit,
  onRemove,
  onDuplicate,
  onToggleVisibility,
  onSelect,
  onReload,
}: PremiumChartCardProps) {
  if (isLoading) {
    return (
      <div className={`relative rounded-2xl border border-indigo-400/20 bg-slate-950/70 p-5 shadow-[0_0_26px_rgba(79,70,229,0.12)] backdrop-blur-xl animate-pulse min-h-[300px] flex flex-col justify-between ${chart.type === "map" ? "xl:col-span-2 2xl:col-span-3" : ""}`}>
        <div className="space-y-2">
          <div className="h-4 bg-slate-800 rounded w-1/3"></div>
          <div className="h-3 bg-slate-800 rounded w-1/4"></div>
        </div>
        <div className="flex-1 flex items-end justify-between gap-4 mt-6 mb-4">
          <div className="bg-slate-800 rounded w-1/12 h-2/3"></div>
          <div className="bg-slate-800 rounded w-1/12 h-4/5"></div>
          <div className="bg-slate-800 rounded w-1/12 h-1/2"></div>
          <div className="bg-slate-800 rounded w-1/12 h-5/6"></div>
          <div className="bg-slate-800 rounded w-1/12 h-3/4"></div>
          <div className="bg-slate-800 rounded w-1/12 h-1/2"></div>
          <div className="bg-slate-800 rounded w-1/12 h-4/5"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`relative rounded-2xl border border-rose-500/20 bg-slate-950/70 p-5 shadow-[0_0_26px_rgba(244,63,94,0.12)] backdrop-blur-xl min-h-[300px] flex flex-col justify-center items-center text-center ${chart.type === "map" ? "xl:col-span-2 2xl:col-span-3" : ""}`}>
        <div className="rounded-full bg-rose-500/10 p-3 mb-4 text-rose-400">
          <RefreshCw className="h-6 w-6 animate-spin" />
        </div>
        <h4 className="text-sm font-bold text-white mb-2">Failed to render chart</h4>
        <p className="text-xs text-slate-400 max-w-xs mb-4">{error}</p>
        {onReload && (
          <button
            onClick={() => onReload(chart.id)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30 px-3 py-1.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 transition"
            type="button"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry Load
          </button>
        )}
      </div>
    );
  }

  const hasData = Array.isArray(chart.data) && chart.data.length > 0;

  if (!hasData) {
    return (
      <div className={`min-h-[300px] rounded-2xl border border-slate-800 bg-slate-950/70 p-6 text-slate-300 ${chart.type === "map" ? "xl:col-span-2 2xl:col-span-3" : ""}`}>
        <h3 className="mb-2 text-base font-semibold text-white">
          {chart.title || "Empty chart"}
        </h3>
        <p className="text-sm text-slate-400">
          This chart has no data yet. Try changing the aggregation, field, or
          filter.
        </p>
      </div>
    );
  }

  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className={`group relative rounded-2xl border border-indigo-400/20 bg-slate-950/70 p-4 shadow-[0_0_26px_rgba(79,70,229,0.12)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-cyan-300/30 hover:shadow-[0_0_38px_rgba(34,211,238,0.16)] ${chart.type === "map" ? "xl:col-span-2 2xl:col-span-3" : ""}`}
    >
      {chart.type !== "map" && <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">{chart.title}</h3>
          <p className="text-xs text-slate-500">{chart.subtitle || chart.type}</p>
        </div>
        <span className="rounded-lg border border-violet-400/20 bg-violet-500/10 px-2 py-1 text-[11px] text-violet-200">{chart.type}</span>
      </div>}
      <ChartBody chart={chart} />

      {/* Action buttons - shown on hover */}
      {(onEdit || onRemove || onDuplicate || onToggleVisibility) && (
        <div className="absolute top-3 right-3 flex gap-1 rounded-lg border border-slate-700/50 bg-slate-900/80 p-2 opacity-0 transition-opacity group-hover:opacity-100">
          {onEdit && (
            <button
              onClick={() => onEdit(chart.id)}
              title="Edit chart"
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
              type="button"
            >
              <Edit3 className="h-4 w-4" />
            </button>
          )}
          
          {onDuplicate && (
            <button
              onClick={() => onDuplicate(chart.id)}
              title="Duplicate chart"
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
              type="button"
            >
              <Copy className="h-4 w-4" />
            </button>
          )}
          
          {onToggleVisibility && (
            <button
              onClick={() => onToggleVisibility(chart.id)}
              title={isVisible ? "Hide chart" : "Show chart"}
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
              type="button"
            >
              {isVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          )}
          
          {onRemove && (
            <button
              onClick={() => {
                if (window.confirm(`Remove "${chart.title}"?`)) {
                  onRemove(chart.id);
                }
              }}
              title="Remove chart"
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-rose-500/20 hover:text-rose-300"
              type="button"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
    </motion.section>
  );
}
