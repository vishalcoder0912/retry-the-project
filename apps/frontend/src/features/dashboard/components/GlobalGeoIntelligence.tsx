import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  Download,
  Globe2,
  Plus,
  Minus,
  Maximize2,
  RefreshCw,
  ShieldCheck,
  Trophy,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  ZoomableGroup,
  Line,
} from "react-simple-maps";
import { scaleLinear } from "d3-scale";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type DataRow = Record<string, unknown>;

type ColumnMeta = {
  name: string;
  type?: string;
  role?: string;
};

type Props = {
  rows: DataRow[];
  columns?: ColumnMeta[];
};

type GeoDatum = {
  key: string;
  name: string;
  flag: string;
  region: string;
  coordinates: [number, number];
  records: number;
  avg: number;
};

const WORLD_GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const COUNTRY_COORDS: Record<string, { name: string; flag: string; region: string; coordinates: [number, number] }> = {
  "united states": { name: "United States", flag: "🇺🇸", region: "North America", coordinates: [-98, 39] },
  canada: { name: "Canada", flag: "🇨🇦", region: "North America", coordinates: [-106, 56] },
  brazil: { name: "Brazil", flag: "🇧🇷", region: "South America", coordinates: [-51, -10] },
  germany: { name: "Germany", flag: "🇩🇪", region: "Europe", coordinates: [10, 51] },
  france: { name: "France", flag: "🇫🇷", region: "Europe", coordinates: [2, 46] },
  "united kingdom": { name: "United Kingdom", flag: "🇬🇧", region: "Europe", coordinates: [-2, 54] },
  india: { name: "India", flag: "🇮🇳", region: "Asia", coordinates: [78, 22] },
  nepal: { name: "Nepal", flag: "🇳🇵", region: "Asia", coordinates: [84.12, 28.39] },
  japan: { name: "Japan", flag: "🇯🇵", region: "Asia", coordinates: [138, 37] },
  singapore: { name: "Singapore", flag: "🇸🇬", region: "Asia", coordinates: [104, 1.35] },
  australia: { name: "Australia", flag: "🇦🇺", region: "Oceania", coordinates: [134, -25] },
  china: { name: "China", flag: "🇨🇳", region: "Asia", coordinates: [104, 35] },
  mexico: { name: "Mexico", flag: "🇲🇽", region: "North America", coordinates: [-102, 23] },
  argentina: { name: "Argentina", flag: "🇦🇷", region: "South America", coordinates: [-63, -38] },
  sweden: { name: "Sweden", flag: "🇸🇪", region: "Europe", coordinates: [18, 60] },
  norway: { name: "Norway", flag: "🇳🇴", region: "Europe", coordinates: [8, 60] },
  egypt: { name: "Egypt", flag: "🇪🇬", region: "Africa", coordinates: [30, 26] },
  nigeria: { name: "Nigeria", flag: "🇳🇬", region: "Africa", coordinates: [8, 9] },
  "south africa": { name: "South Africa", flag: "🇿🇦", region: "Africa", coordinates: [22, -30] },
  uae: { name: "United Arab Emirates", flag: "🇦🇪", region: "Middle East", coordinates: [54, 24] },
  "new zealand": { name: "New Zealand", flag: "🇳🇿", region: "Oceania", coordinates: [174, -40] },
};

const PIE_COLORS = ["#38bdf8", "#8b5cf6", "#22c55e", "#f59e0b", "#ec4899", "#06b6d4"];

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function key(value: unknown) {
  return clean(value).toLowerCase();
}

function canonicalCountryKey(value: unknown) {
  const normalized = key(value).replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
  const aliases: Record<string, string> = {
    america: "united states",
    england: "united kingdom",
    greatbritain: "united kingdom",
    "great britain": "united kingdom",
    uk: "united kingdom",
    us: "united states",
    usa: "united states",
    "u s a": "united states",
    "united states of america": "united states",
  };

  return aliases[normalized] || aliases[normalized.replace(/\s+/g, "")] || normalized;
}

function toNumber(value: unknown) {
  if (typeof value === "number") return value;
  const number = Number(String(value ?? "").replace(/[$,%]/g, "").trim());
  return Number.isFinite(number) ? number : null;
}

function label(text: string) {
  return text.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatMetric(value: number, metricKey: string) {
  if (/salary|amount|revenue|sales|profit|price|cost|usd|inr/i.test(metricKey)) {
    return `$${Math.round(value).toLocaleString()}`;
  }
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: value >= 100 ? 0 : 1 }).format(value);
}

const CustomYAxisTick = ({ x, y, payload, geoData }: any) => {
  const item = geoData.find((d: any) => d.name === payload.value);
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={-6} y={4} fill="#cbd5e1" fontSize={11} textAnchor="end">
        {item ? `${item.flag} ${item.name}` : payload.value}
      </text>
    </g>
  );
};

export default function GlobalGeoIntelligence({ rows, columns = [] }: Props) {
  const [metric, setMetric] = useState("");
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState<[number, number]>([8, 12]);
  const [viewMode, setViewMode] = useState<"Map" | "Globe" | "Chart">("Map");

  const columnNames = useMemo(
    () => (columns.length ? columns.map((column) => column.name) : Object.keys(rows[0] || {})),
    [columns, rows],
  );

  // Schema Detection for coordinates, countries, cities, and flow metrics
  const latColumn = useMemo(() => columnNames.find((name) => /latitude|lat/i.test(name)) || "", [columnNames]);
  const lngColumn = useMemo(() => columnNames.find((name) => /longitude|lng|lon/i.test(name)) || "", [columnNames]);
  const sourceCountryCol = useMemo(() => columnNames.find((name) => /source_country|from_country|src_country/i.test(name)) || "", [columnNames]);
  const targetCountryCol = useMemo(() => columnNames.find((name) => /target_country|to_country|dest_country/i.test(name)) || "", [columnNames]);
  const countryCol = useMemo(() => columnNames.find((name) => /country|nation/i.test(name)) || "", [columnNames]);
  const stateCol = useMemo(() => columnNames.find((name) => /state|province/i.test(name)) || "", [columnNames]);
  const cityCol = useMemo(() => columnNames.find((name) => /city/i.test(name)) || "", [columnNames]);

  const mapMode = useMemo(() => {
    if (sourceCountryCol && targetCountryCol) return "arc";
    if (latColumn && lngColumn) return "point";
    if (countryCol || stateCol || cityCol) return "choropleth";
    return "empty";
  }, [sourceCountryCol, targetCountryCol, latColumn, lngColumn, countryCol, stateCol, cityCol]);

  const geoColumn = useMemo(() => {
    return countryCol || stateCol || cityCol || sourceCountryCol || targetCountryCol || "";
  }, [countryCol, stateCol, cityCol, sourceCountryCol, targetCountryCol]);

  const metricColumns = useMemo(
    () =>
      columnNames
        .filter((name) => {
          const meta = columns.find((column) => column.name === name);
          if (/id|code|phone|zip|postal/i.test(name)) return false;
          if (meta?.role && /id|category|location|date|text/i.test(meta.role)) return false;

          const valid = rows
            .slice(0, 50)
            .map((row) => toNumber(row[name]))
            .filter((value) => value !== null);

          return valid.length >= Math.min(3, rows.length);
        }),
    [columnNames, columns, rows],
  );

  const metricColumn = (metricColumns.includes(metric) ? metric : "") || metricColumns[0] || "count";

  // Build Geo Data
  const geoData = useMemo<GeoDatum[]>(() => {
    if (mapMode === "empty") return [];

    const activeCol = countryCol || sourceCountryCol || stateCol || cityCol || "";
    if (!activeCol) return [];

    const buckets = new Map<string, { raw: string; records: number; total: number }>();

    rows.forEach((row) => {
      const location = clean(row[activeCol]);
      const value = metricColumn === "count" ? 1 : (toNumber(row[metricColumn]) ?? 1);
      if (!location) return;

      const id = canonicalCountryKey(location);
      const current = buckets.get(id) || { raw: location, records: 0, total: 0 };
      current.records += 1;
      current.total += value;
      buckets.set(id, current);
    });

    return Array.from(buckets.entries())
      .map(([id, item]) => {
        const meta = COUNTRY_COORDS[id] || {
          name: item.raw,
          flag: "🌍",
          region: "Other",
          coordinates: [0, 0] as [number, number],
        };

        return {
          key: id,
          name: meta.name,
          flag: meta.flag,
          region: meta.region,
          coordinates: meta.coordinates,
          records: item.records,
          avg: item.total / item.records,
        };
      })
      .filter((item) => item.coordinates[0] !== 0 || item.coordinates[1] !== 0)
      .sort((left, right) => right.avg - left.avg);
  }, [rows, countryCol, sourceCountryCol, stateCol, cityCol, metricColumn, mapMode]);

  // Points list for Points Map Mode
  const points = useMemo(() => {
    if (mapMode !== "point") return [];
    return rows.map((row, index) => {
      const lat = toNumber(row[latColumn]);
      const lng = toNumber(row[lngColumn]);
      const name = clean(row[countryCol] || row[cityCol] || row[stateCol] || `Coordinates ${index + 1}`);
      const value = metricColumn === "count" ? 1 : (toNumber(row[metricColumn]) ?? 1);
      return {
        key: `pt-${index}`,
        name,
        coordinates: [lng, lat] as [number, number],
        val: value,
      };
    }).filter(p => Number.isFinite(p.coordinates[0]) && Number.isFinite(p.coordinates[1]));
  }, [rows, latColumn, lngColumn, countryCol, cityCol, stateCol, metricColumn, mapMode]);

  // Arc paths for Flow Map Mode
  const flowArcs = useMemo(() => {
    if (mapMode !== "arc") return [];
    const arcsList: Array<{ source: [number, number]; target: [number, number]; key: string; label: string }> = [];
    rows.forEach((row, index) => {
      const srcRaw = clean(row[sourceCountryCol]);
      const destRaw = clean(row[targetCountryCol]);
      const srcId = canonicalCountryKey(srcRaw);
      const destId = canonicalCountryKey(destRaw);
      const srcCoord = COUNTRY_COORDS[srcId]?.coordinates;
      const destCoord = COUNTRY_COORDS[destId]?.coordinates;

      if (srcCoord && destCoord) {
        arcsList.push({
          source: srcCoord,
          target: destCoord,
          key: `arc-${index}`,
          label: `${srcRaw} ➔ ${destRaw}`,
        });
      }
    });
    return arcsList.slice(0, 30); // Limit to 30 paths to avoid canvas clogging
  }, [rows, sourceCountryCol, targetCountryCol, mapMode]);

  const totalRecords = geoData.reduce((sum, item) => sum + item.records, 0) || rows.length;
  const totalMetric = geoData.reduce((sum, item) => sum + item.avg * item.records, 0);
  const maxAvg = Math.max(...geoData.map((item) => item.avg), 1);
  const maxRecords = Math.max(...geoData.map((item) => item.records), 1);
  const globalAvg = totalRecords ? totalMetric / totalRecords : 0;
  const uniqueGeoValues = new Set(rows.map((row) => canonicalCountryKey(row[geoColumn])).filter(Boolean)).size;
  const geoQuality = Math.round((geoData.length / Math.max(uniqueGeoValues, 1)) * 100) || 85;
  const qualityLabel = geoQuality >= 90 ? "Excellent" : geoQuality >= 70 ? "Good" : "Sparse";

  const active = geoData.find((item) => item.key === activeKey) || geoData[0];
  const highest = geoData[0];
  const lowest = geoData[geoData.length - 1];
  const mostRecords = [...geoData].sort((left, right) => right.records - left.records)[0];

  const colorScale = scaleLinear<string>().domain([0, maxAvg]).range(["#1e1b4b", "#06b6d4"]);

  const regionData = useMemo(() => {
    const regionMap = new Map<string, number>();
    geoData.forEach((item) => {
      regionMap.set(item.region, (regionMap.get(item.region) || 0) + item.records);
    });

    return Array.from(regionMap.entries())
      .map(([name, value]) => ({
        name,
        value,
        percent: totalRecords ? (value / totalRecords) * 100 : 0,
      }))
      .sort((left, right) => right.value - left.value);
  }, [geoData, totalRecords]);

  // Handle Empty State
  if (mapMode === "empty" || !geoData.length) {
    return (
      <section className="relative overflow-hidden rounded-3xl border border-cyan-400/20 bg-slate-950 p-10 text-center shadow-[inset_0_0_55px_rgba(6,182,212,0.06)] min-h-[350px] flex flex-col justify-center items-center">
        <Globe2 className="mx-auto mb-4 size-14 text-slate-600 animate-pulse" />
        <h2 className="text-xl font-bold text-white">No Geographic Fields Detected</h2>
        <p className="mt-2 text-sm text-slate-400 max-w-md">
          Geo Intelligence needs country, region, state, city, latitude, or longitude fields to visualize metrics globally.
        </p>
      </section>
    );
  }

  const exportGeo = () => {
    const csv = ["country,records,metric,region", ...geoData.map((row) => `${row.name},${row.records},${row.avg},${row.region}`)].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = "global-geo-intelligence.csv";
    link.click();
    URL.revokeObjectURL(href);
  };

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-cyan-400/20 bg-[#040816] p-5 shadow-[0_0_90px_rgba(59,130,246,.18)]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(124,58,237,.28),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(6,182,212,.18),transparent_35%)]" />

      <div className="relative z-10">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg shadow-cyan-500/20">
              <Globe2 className="size-7 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-black tracking-tight text-white">Global Geo Intelligence</h2>
              <p className="text-sm text-slate-400">
                Visualizing data distribution using a choropleth, coordinates point map, or flow routing arcs.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {metricColumns.length > 0 && (
              <select
                aria-label="Map metric"
                value={metricColumn}
                onChange={(event) => setMetric(event.target.value)}
                className="h-11 rounded-xl border border-white/10 bg-slate-950 px-4 text-sm font-semibold text-white outline-none focus:border-violet-400"
              >
                <option value="count">Record Count</option>
                {metricColumns.map((column) => (
                  <option key={column} value={column}>
                    {label(column)} (Average)
                  </option>
                ))}
              </select>
            )}

            {(["Map", "Globe", "Chart"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`h-11 rounded-xl px-5 text-sm font-bold transition ${
                  viewMode === mode
                    ? "bg-violet-600 text-white shadow-lg shadow-violet-600/30"
                    : "border border-white/10 bg-white/5 text-slate-300 hover:text-white"
                }`}
              >
                {mode}
              </button>
            ))}
            <button
              onClick={() => {
                setZoom(1);
                setCenter([8, 12]);
              }}
              className="grid size-11 place-items-center rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/10 transition"
              title="Reset View"
            >
              <RefreshCw className="size-4" />
            </button>
            <button
              onClick={exportGeo}
              className="grid size-11 place-items-center rounded-xl border border-white/10 bg-white/5 text-white hover:bg-white/10 transition"
              title="Export CSV"
            >
              <Download className="size-4" />
            </button>
          </div>
        </header>

        <div className="mb-5 grid gap-4 md:grid-cols-4">
          <TopCard icon={<BarChart3 />} title="Total Records" value={totalRecords.toLocaleString()} sub={`Across ${geoData.length} countries`} />
          <TopCard icon={<TrendingUp />} title={`Global Avg ${label(metricColumn)}`} value={metricColumn === "count" ? "N/A" : formatMetric(globalAvg, metricColumn)} sub="Weighted average" positive />
          <TopCard icon={<Globe2 />} title="Geographies Mapped" value={geoData.length.toString()} sub={`${mapMode.toUpperCase()} mode enabled`} />
          <TopCard icon={<ShieldCheck />} title="Mapping Confidence" value={`${geoQuality}%`} sub={qualityLabel} positive={geoQuality >= 70} />
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.65fr_.9fr]">
          <Panel className="min-h-[580px]">
            <div className="mb-4 flex justify-between gap-4">
              <div>
                <h3 className="text-xl font-black text-white">Interactive World Map</h3>
                <p className="text-sm text-slate-400">
                  {mapMode === "arc" && "Rendering flow connections (arc lines)"}
                  {mapMode === "point" && "Plotting data coordinates (lat/lng points)"}
                  {mapMode === "choropleth" && "Coloring regional country performance metrics"}
                </p>
              </div>
              <div className="flex gap-2">
                <span className="rounded-full bg-cyan-400/10 px-3 py-1 text-xs text-cyan-200 border border-cyan-400/20 font-semibold self-center capitalize">
                  {mapMode} Mode
                </span>
              </div>
            </div>

            <div className="relative h-[500px] overflow-hidden rounded-3xl border border-cyan-300/20 bg-slate-950/75 shadow-[0_0_34px_rgba(6,182,212,0.12)] backdrop-blur-xl">
              <div className="absolute inset-0 bg-[linear-gradient(rgba(139,92,246,.04)_1px,transparent_1px),linear-gradient(90deg,rgba(139,92,246,.04)_1px,transparent_1px)] bg-[size:44px_44px]" />

              {/* Zoom Controls */}
              <div className="absolute left-4 top-1/3 z-20 flex flex-col gap-1 rounded-xl border border-white/10 bg-slate-950/80 p-1.5 backdrop-blur-xl">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(6, z + 0.35))}
                  className="grid size-8 place-items-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"
                  title="Zoom In"
                >
                  <Plus className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.75, z - 0.35))}
                  className="grid size-8 place-items-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"
                  title="Zoom Out"
                >
                  <Minus className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setZoom(1);
                    setCenter([8, 12]);
                  }}
                  className="grid size-8 place-items-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"
                  title="Reset view"
                >
                  <Maximize2 className="size-4" />
                </button>
              </div>

              {viewMode === "Chart" ? (
                <div className="absolute inset-0 p-6">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={geoData.slice(0, 12)} margin={{ top: 30, right: 30, bottom: 55, left: 10 }}>
                      <CartesianGrid stroke="rgba(148,163,184,.14)" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: "#cbd5e1", fontSize: 12 }} interval={0} angle={-25} textAnchor="end" height={70} />
                      <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{ background: "#020617", border: "1px solid rgba(255,255,255,.14)", borderRadius: 14, color: "#fff" }}
                        formatter={(value) => formatMetric(Number(value), metricColumn)}
                      />
                      <Bar dataKey="avg" radius={[10, 10, 0, 0]}>
                        {geoData.slice(0, 12).map((item, index) => (
                          <Cell key={`main-chart-${item.key}`} fill={index === 0 ? "#34d399" : index < 4 ? "#38bdf8" : "#8b5cf6"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <ComposableMap
                  projection={viewMode === "Globe" ? "geoOrthographic" : "geoEqualEarth"}
                  projectionConfig={{
                    scale: viewMode === "Globe" ? 235 : 175,
                    rotate: viewMode === "Globe" ? [-12, -5, 0] : [0, 0, 0],
                  }}
                  className="absolute inset-0 h-full w-full"
                >
                  <defs>
                    <linearGradient id="mapOceanGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#02010a" />
                      <stop offset="60%" stopColor="#050212" />
                      <stop offset="100%" stopColor="#0e0620" />
                    </linearGradient>
                    <linearGradient id="mapLandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#0f224a" opacity={0.6} />
                      <stop offset="100%" stopColor="#132c63" opacity={0.7} />
                    </linearGradient>
                    <filter id="mapGlow" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="3.5" result="coloredBlur" />
                      <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  {viewMode === "Globe" ? (
                    <circle cx={400} cy={300} r={235} fill="url(#mapOceanGrad)" stroke="#22d3ee" strokeOpacity={0.3} strokeWidth={1} />
                  ) : (
                    <rect width="800" height="600" fill="url(#mapOceanGrad)" />
                  )}

                  <ZoomableGroup zoom={zoom} center={center} onMoveEnd={({ coordinates, zoom }) => { setCenter(coordinates); setZoom(zoom); }}>
                    <Geographies geography={WORLD_GEO_URL}>
                      {({ geographies }) =>
                        geographies.map((geo) => {
                          const geoName = canonicalCountryKey(geo.properties.name || "");
                          const match = geoData.find(
                            (item) => geoName === item.key || geoName.includes(item.key) || item.key.includes(geoName),
                          );

                          return (
                            <Geography
                              key={geo.rsmKey}
                              geography={geo}
                              fill={match ? colorScale(match.avg) : "url(#mapLandGrad)"}
                              stroke={match ? "#22d3ee" : "#1b263b"}
                              strokeWidth={match ? 1.2 : 0.4}
                              style={{
                                default: { outline: "none" },
                                hover: { fill: "#1e3a8a", outline: "none" },
                                pressed: { outline: "none" },
                              }}
                              onMouseEnter={() => match && setActiveKey(match.key)}
                              onMouseLeave={() => setActiveKey(null)}
                            />
                          );
                        })
                      }
                    </Geographies>

                    {/* Point Map Markers */}
                    {mapMode === "point" && points.map((p) => (
                      <Marker
                        key={p.key}
                        coordinates={p.coordinates}
                        onMouseEnter={() => setActiveKey(p.key)}
                        onMouseLeave={() => setActiveKey(null)}
                      >
                        <circle r={7} fill="#06b6d4" stroke="#ffffff" strokeWidth={1.5} filter="url(#mapGlow)" />
                        <circle r={16} fill="none" stroke="#22d3ee" strokeWidth={1} opacity={0.5}>
                          <animate attributeName="r" values="7;18;7" dur="2s" repeatCount="indefinite" />
                          <animate attributeName="opacity" values=".6;0;.6" dur="2s" repeatCount="indefinite" />
                        </circle>
                      </Marker>
                    ))}

                    {/* Arc Routing Flow Vectors */}
                    {mapMode === "arc" && flowArcs.map((arc) => (
                      <g key={arc.key}>
                        <Line
                          from={arc.source}
                          to={arc.target}
                          stroke="#22d3ee"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeDasharray="4 6"
                        >
                          <animate attributeName="stroke-dashoffset" values="50;0" dur="2.5s" repeatCount="indefinite" />
                        </Line>
                        {/* Source Dot */}
                        <Marker coordinates={arc.source}>
                          <circle r={4} fill="#a855f7" />
                        </Marker>
                        {/* Target Dot */}
                        <Marker coordinates={arc.target}>
                          <circle r={5} fill="#22d3ee" filter="url(#mapGlow)" />
                        </Marker>
                      </g>
                    ))}

                    {/* Default Choropleth Markers */}
                    {mapMode === "choropleth" && geoData.map((item) => {
                      const radius = 5 + (item.records / maxRecords) * 12;
                      const glowColor = item.avg / maxAvg > 0.7 ? "#34d399" : "#22d3ee";
                      return (
                        <Marker
                          key={item.key}
                          coordinates={item.coordinates}
                          onMouseEnter={() => setActiveKey(item.key)}
                          onMouseLeave={() => setActiveKey(null)}
                        >
                          <circle r={radius} fill="none" stroke={glowColor} strokeOpacity={0.7} strokeWidth={1.8} filter="url(#mapGlow)" />
                          <circle r={radius + 8} fill="none" stroke={glowColor} strokeWidth={1} opacity={0.3}>
                            <animate attributeName="r" values={`${radius};${radius + 14};${radius}`} dur="3s" repeatCount="indefinite" />
                            <animate attributeName="opacity" values="0.45;0.05;0.45" dur="3s" repeatCount="indefinite" />
                          </circle>
                        </Marker>
                      );
                    })}
                  </ZoomableGroup>
                </ComposableMap>
              )}

              {active && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute left-5 top-5 z-20 w-72 rounded-2xl border border-cyan-400/30 bg-slate-950/90 p-4 shadow-2xl backdrop-blur-xl"
                >
                  <h4 className="text-base font-black text-white flex items-center gap-2">
                    <span className="text-xl">{active.flag}</span>
                    <span>{active.name}</span>
                  </h4>
                  <div className="mt-4 space-y-2 text-xs">
                    <Info label="Records" value={active.records.toLocaleString()} />
                    <Info label={`${label(metricColumn)}`} value={metricColumn === "count" ? active.records.toLocaleString() : formatMetric(active.avg, metricColumn)} />
                    <Info label="Percentage Share" value={`${((active.records / totalRecords) * 100).toFixed(1)}%`} />
                    <Info label="Global Rank" value={`#${geoData.findIndex((item) => item.key === active.key) + 1}`} />
                  </div>
                </motion.div>
              )}

              <div className="absolute bottom-5 left-5 rounded-2xl border border-white/10 bg-slate-950/80 p-4 backdrop-blur-xl">
                <p className="mb-2 text-xs font-semibold text-slate-300">
                  Metric Gradient Scale
                </p>
                <div className="h-3 w-56 rounded-full bg-gradient-to-r from-violet-900 via-cyan-500 to-emerald-400" />
                <div className="mt-2 flex justify-between text-xs text-slate-400 font-medium">
                  <span>Low ({metricColumn === "count" ? "0" : formatMetric(Math.min(...geoData.map(d => d.avg)), metricColumn)})</span>
                  <span>High ({metricColumn === "count" ? maxRecords.toLocaleString() : formatMetric(maxAvg, metricColumn)})</span>
                </div>
              </div>

              <div className="absolute bottom-5 right-5 rounded-2xl border border-white/10 bg-slate-950/80 p-4 text-xs text-slate-300 backdrop-blur-xl">
                <p className="mb-2 font-bold text-white">Intensity Legend</p>
                <div className="flex gap-4">
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-violet-600" />Low</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-cyan-400" />Medium</span>
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-400" />High</span>
                </div>
              </div>
            </div>
          </Panel>

          <div className="grid gap-5">
            <Panel>
              <h3 className="text-xl font-black text-white">Global Performance</h3>
              <p className="mb-5 text-sm text-slate-400">Top countries by selected metric</p>

              <ResponsiveContainer width="100%" height={315}>
                <BarChart data={geoData.slice(0, 10)} layout="vertical">
                  <defs>
                    <linearGradient id="barPerformanceGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#8b5cf6" />
                      <stop offset="100%" stopColor="#06b6d4" />
                    </linearGradient>
                  </defs>
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={125}
                    tick={<CustomYAxisTick geoData={geoData} />}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#020617",
                      border: "1px solid rgba(255,255,255,.14)",
                      borderRadius: 14,
                      color: "#fff",
                    }}
                    formatter={(value) => formatMetric(Number(value), metricColumn)}
                  />
                  <Bar dataKey="avg" fill="url(#barPerformanceGrad)" radius={[0, 10, 10, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Panel>

            <Panel>
              <h3 className="text-xl font-black text-white">Regional Distribution</h3>
              <p className="mb-5 text-sm text-slate-400">Share of total records by region</p>

              <div className="grid gap-4 md:grid-cols-[1fr_.9fr] xl:grid-cols-1 2xl:grid-cols-[1fr_.9fr]">
                <div className="relative h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={regionData} dataKey="value" nameKey="name" innerRadius={70} outerRadius={110} paddingAngle={2}>
                        {regionData.map((region, index) => (
                          <Cell key={`region-${region.name}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: "#020617", border: "1px solid rgba(255,255,255,.14)", borderRadius: 14, color: "#fff" }} />
                    </PieChart>
                  </ResponsiveContainer>

                  <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                    <div>
                      <p className="text-3xl font-black text-white">{totalRecords.toLocaleString()}</p>
                      <p className="text-xs text-slate-400">Total Records</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 self-center">
                  {regionData.map((region, index) => (
                    <div key={region.name} className="grid grid-cols-[12px_1fr_auto] items-center gap-3 text-sm">
                      <span className="size-3 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                      <span className="text-slate-300 font-medium">{region.name}</span>
                      <span className="font-semibold text-white">{region.percent.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-5">
          <BottomCard icon={<Trophy />} title={`Highest Avg`} value={highest?.name || "N/A"} sub={highest ? formatMetric(highest.avg, metricColumn) : ""} />
          <BottomCard icon={<TrendingDown />} title={`Lowest Avg`} value={lowest?.name || "N/A"} sub={lowest ? formatMetric(lowest.avg, metricColumn) : ""} warning />
          <BottomCard icon={<Users />} title="Most Records" value={mostRecords?.name || "N/A"} sub={mostRecords ? `${mostRecords.records.toLocaleString()} records` : ""} />
          <BottomCard icon={<TrendingUp />} title="Top Region" value={regionData[0]?.name || "Unknown"} sub={`${regionData[0]?.percent.toFixed(1) || 0}% of total`} />
          <BottomCard icon={<ShieldCheck />} title="Geo Data Quality" value={`${geoQuality}%`} sub={qualityLabel} />
        </div>
      </div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-400 font-medium">{label}</span>
      <span className="font-semibold text-white">{value}</span>
    </div>
  );
}

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-3xl border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl ${className}`}>
      {children}
    </div>
  );
}

function TopCard({
  icon,
  title,
  value,
  sub,
  positive,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  sub: string;
  positive?: boolean;
}) {
  const iconColorClass = title.toLowerCase().includes("records")
    ? "bg-emerald-500/10 text-emerald-400"
    : title.toLowerCase().includes("avg")
      ? "bg-blue-500/10 text-blue-400"
      : title.toLowerCase().includes("geographies")
        ? "bg-violet-500/10 text-violet-400"
        : "bg-cyan-500/10 text-cyan-300";

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl">
      <div className="flex items-center gap-4">
        <div className={`grid size-14 place-items-center rounded-2xl ${iconColorClass}`}>
          {icon}
        </div>
        <div>
          <p className="text-sm text-slate-400">{title}</p>
          <p className="text-3xl font-black text-white">{value}</p>
          <p className={positive ? "text-xs text-emerald-400 font-semibold animate-pulse" : "text-xs text-slate-500"}>
            {sub}
          </p>
        </div>
      </div>
    </div>
  );
}

function BottomCard({
  icon,
  title,
  value,
  sub,
  warning,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  sub: string;
  warning?: boolean;
}) {
  const colorClass = title.toLowerCase().includes("highest")
    ? "bg-violet-500/10 text-violet-400"
    : title.toLowerCase().includes("lowest")
      ? "bg-amber-500/10 text-amber-400"
      : title.toLowerCase().includes("most")
        ? "bg-emerald-500/10 text-emerald-400"
        : title.toLowerCase().includes("growing")
          ? "bg-blue-500/10 text-blue-400"
          : "bg-cyan-500/10 text-cyan-400";

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-5 backdrop-blur-xl">
      <div className={`grid size-12 place-items-center rounded-xl mb-3 ${colorClass}`}>
        {icon}
      </div>
      <p className="text-sm font-bold text-slate-300">{title}</p>
      <p className="mt-1 text-2xl font-black text-white truncate max-w-full">{value}</p>
      <p className="text-xs text-slate-400 font-semibold mt-1">{sub}</p>
    </div>
  );
}
