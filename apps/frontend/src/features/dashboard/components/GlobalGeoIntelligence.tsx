import { useMemo, useState } from "react";
import { BarChart3, Download, Globe2, Maximize2, Minus, Plus, RefreshCw } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup, Line } from "react-simple-maps";
import { scaleLinear } from "d3-scale";

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
  level: "coordinates" | "country" | "state" | "city" | "flow";
  coordinates: [number, number];
  records: number;
  value: number;
  rawValue: string;
  topCategory?: string;
};

const WORLD_GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const LOCATION_COORDS: Record<string, { name: string; coordinates: [number, number] }> = {
  "united states": { name: "United States", coordinates: [-98.58, 39.83] },
  usa: { name: "United States", coordinates: [-98.58, 39.83] },
  us: { name: "United States", coordinates: [-98.58, 39.83] },
  canada: { name: "Canada", coordinates: [-106.35, 56.13] },
  mexico: { name: "Mexico", coordinates: [-102.55, 23.63] },
  brazil: { name: "Brazil", coordinates: [-51.92, -14.23] },
  argentina: { name: "Argentina", coordinates: [-63.62, -38.42] },
  "united kingdom": { name: "United Kingdom", coordinates: [-3.43, 55.38] },
  uk: { name: "United Kingdom", coordinates: [-3.43, 55.38] },
  france: { name: "France", coordinates: [2.21, 46.22] },
  germany: { name: "Germany", coordinates: [10.45, 51.17] },
  italy: { name: "Italy", coordinates: [12.57, 41.87] },
  spain: { name: "Spain", coordinates: [-3.75, 40.46] },
  sweden: { name: "Sweden", coordinates: [18.64, 60.12] },
  norway: { name: "Norway", coordinates: [8.47, 60.47] },
  india: { name: "India", coordinates: [78.96, 20.59] },
  china: { name: "China", coordinates: [104.2, 35.86] },
  japan: { name: "Japan", coordinates: [138.25, 36.2] },
  singapore: { name: "Singapore", coordinates: [103.82, 1.35] },
  australia: { name: "Australia", coordinates: [133.78, -25.27] },
  "new zealand": { name: "New Zealand", coordinates: [174.89, -40.9] },
  uae: { name: "United Arab Emirates", coordinates: [53.85, 23.42] },
  "united arab emirates": { name: "United Arab Emirates", coordinates: [53.85, 23.42] },
  egypt: { name: "Egypt", coordinates: [30.8, 26.82] },
  nigeria: { name: "Nigeria", coordinates: [8.67, 9.08] },
  "south africa": { name: "South Africa", coordinates: [22.94, -30.56] },

  delhi: { name: "Delhi", coordinates: [77.1, 28.7] },
  noida: { name: "Noida", coordinates: [77.39, 28.54] },
  gurugram: { name: "Gurugram", coordinates: [77.03, 28.46] },
  mumbai: { name: "Mumbai", coordinates: [72.88, 19.08] },
  pune: { name: "Pune", coordinates: [73.86, 18.52] },
  bengaluru: { name: "Bengaluru", coordinates: [77.59, 12.97] },
  bangalore: { name: "Bengaluru", coordinates: [77.59, 12.97] },
  hyderabad: { name: "Hyderabad", coordinates: [78.49, 17.38] },
  chennai: { name: "Chennai", coordinates: [80.27, 13.08] },
  kolkata: { name: "Kolkata", coordinates: [88.36, 22.57] },
  ahmedabad: { name: "Ahmedabad", coordinates: [72.57, 23.02] },
  jaipur: { name: "Jaipur", coordinates: [75.79, 26.91] },
  lucknow: { name: "Lucknow", coordinates: [80.95, 26.85] },

  maharashtra: { name: "Maharashtra", coordinates: [75.71, 19.75] },
  karnataka: { name: "Karnataka", coordinates: [75.71, 15.32] },
  "uttar pradesh": { name: "Uttar Pradesh", coordinates: [80.94, 26.85] },
  delhi_ncr: { name: "Delhi NCR", coordinates: [77.1, 28.7] },
  gujarat: { name: "Gujarat", coordinates: [71.19, 22.26] },
  rajasthan: { name: "Rajasthan", coordinates: [74.22, 27.02] },
  tamil_nadu: { name: "Tamil Nadu", coordinates: [78.66, 11.13] },
  telangana: { name: "Telangana", coordinates: [79.02, 18.11] },
  west_bengal: { name: "West Bengal", coordinates: [87.85, 22.99] },
};

const normalize = (value: unknown) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

const clean = (value: unknown) => String(value ?? "").trim();

const toNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replace(/[$,%]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const pretty = (value: string) => value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

const formatValue = (value: number, metric: string) => {
  if (/revenue|sales|profit|amount|price|cost|salary|income|usd|inr/i.test(metric)) {
    return `$${Math.round(value).toLocaleString()}`;
  }
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: value > 100 ? 0 : 1 }).format(value);
};

const findColumn = (columns: ColumnMeta[], names: string[], regex: RegExp) => {
  const exact = columns.find((column) => names.includes(normalize(column.name)) || names.includes(normalize(column.type || "")) || names.includes(normalize(column.role || "")));
  if (exact) return exact.name;
  return columns.find((column) => regex.test(normalize(column.name)) || regex.test(normalize(column.type || "")) || regex.test(normalize(column.role || "")))?.name || "";
};

const resolveLocation = (value: unknown) => LOCATION_COORDS[normalize(value)] || null;

export default function GlobalGeoIntelligence({ rows, columns = [] }: Props) {
  const [metric, setMetric] = useState("");
  const [viewMode, setViewMode] = useState<"Map" | "Globe" | "Chart">("Map");
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState<[number, number]>([20, 18]);

  const schemaColumns = useMemo<ColumnMeta[]>(() => {
    if (columns.length) return columns;
    return Object.keys(rows[0] || {}).map((name) => ({ name }));
  }, [columns, rows]);

  const schema = useMemo(() => {
    const lat = findColumn(schemaColumns, ["lat", "latitude"], /^(lat|latitude)$/);
    const lng = findColumn(schemaColumns, ["lng", "lon", "long", "longitude"], /^(lng|lon|long|longitude)$/);
    const country = findColumn(schemaColumns, ["country", "country_name", "nation"], /(^|_)country($|_)|nation/);
    const state = findColumn(schemaColumns, ["state", "province", "territory"], /state|province|territory/);
    const city = findColumn(schemaColumns, ["city", "town"], /city|town/);
    const source = findColumn(schemaColumns, ["source_country", "from_country", "src_country"], /source_country|from_country|src_country/);
    const target = findColumn(schemaColumns, ["target_country", "to_country", "dest_country"], /target_country|to_country|dest_country/);
    const locationColumn = country || state || city;
    const mode = source && target ? "flow" : lat && lng ? "coordinates" : country ? "country" : state ? "state" : city ? "city" : "none";
    return { lat, lng, country, state, city, source, target, locationColumn, mode };
  }, [schemaColumns]);

  const metricColumns = useMemo(() => {
    return schemaColumns
      .map((column) => column.name)
      .filter((name) => {
        if ([schema.lat, schema.lng].includes(name)) return false;
        if (/id|phone|zip|postal|code|pin/i.test(name)) return false;
        const values = rows.slice(0, 100).map((row) => toNumber(row[name])).filter((value) => value !== null);
        return values.length >= Math.min(3, Math.max(rows.length, 1));
      });
  }, [rows, schemaColumns, schema.lat, schema.lng]);

  const metricColumn = metricColumns.includes(metric) ? metric : metricColumns[0] || "count";

  const geoData = useMemo<GeoDatum[]>(() => {
    if (!rows.length || schema.mode === "none") return [];

    if (schema.mode === "coordinates") {
      return rows
        .map((row, index) => {
          const lat = toNumber(row[schema.lat]);
          const lng = toNumber(row[schema.lng]);
          if (lat === null || lng === null) return null;
          const label = clean(row[schema.city] || row[schema.state] || row[schema.country] || `Point ${index + 1}`);
          const value = metricColumn === "count" ? 1 : toNumber(row[metricColumn]) ?? 0;
          return {
            key: `coord-${index}`,
            name: label,
            rawValue: label,
            level: "coordinates" as const,
            coordinates: [lng, lat] as [number, number],
            records: 1,
            value,
          };
        })
        .filter((item): item is GeoDatum => Boolean(item))
        .slice(0, 500);
    }

    const locationColumn = schema.locationColumn;
    if (!locationColumn) return [];

    const buckets = new Map<string, { raw: string; rows: DataRow[]; sum: number }>();
    rows.forEach((row) => {
      const raw = clean(row[locationColumn]);
      if (!raw) return;
      const resolved = resolveLocation(raw);
      if (!resolved) return;
      const id = normalize(raw);
      const current = buckets.get(id) || { raw, rows: [], sum: 0 };
      current.rows.push(row);
      current.sum += metricColumn === "count" ? 1 : toNumber(row[metricColumn]) ?? 0;
      buckets.set(id, current);
    });

    return Array.from(buckets.entries())
      .map(([id, bucket]) => {
        const resolved = resolveLocation(bucket.raw)!;
        return {
          key: id,
          name: resolved.name,
          rawValue: bucket.raw,
          level: schema.mode as GeoDatum["level"],
          coordinates: resolved.coordinates,
          records: bucket.rows.length,
          value: metricColumn === "count" ? bucket.rows.length : bucket.sum / Math.max(bucket.rows.length, 1),
          topCategory: bucket.rows[0] ? Object.keys(bucket.rows[0]).find((key) => /category|segment|type|department/i.test(key)) : undefined,
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [rows, schema, metricColumn]);

  const flows = useMemo(() => {
    if (schema.mode !== "flow") return [];
    return rows
      .map((row, index) => {
        const source = resolveLocation(row[schema.source]);
        const target = resolveLocation(row[schema.target]);
        if (!source || !target) return null;
        return { key: `flow-${index}`, source: source.coordinates, target: target.coordinates, label: `${source.name} to ${target.name}` };
      })
      .filter((item): item is { key: string; source: [number, number]; target: [number, number]; label: string } => Boolean(item))
      .slice(0, 60);
  }, [rows, schema]);

  const totalRecords = geoData.reduce((sum, item) => sum + item.records, 0);
  const maxValue = Math.max(...geoData.map((item) => item.value), 1);
  const minValue = Math.min(...geoData.map((item) => item.value), 0);
  const active = geoData.find((item) => item.key === activeKey) || geoData[0];
  const colorScale = scaleLinear<string>().domain([minValue, maxValue]).range(["#ddd6fe", "#6d28d9"]);

  const unmappedCount = useMemo(() => {
    if (schema.mode === "none" || schema.mode === "coordinates") return 0;
    const locationColumn = schema.locationColumn;
    if (!locationColumn) return 0;
    return rows.filter((row) => clean(row[locationColumn]) && !resolveLocation(row[locationColumn])).length;
  }, [rows, schema]);

  const exportGeo = () => {
    const csv = ["location,records,value,level", ...geoData.map((row) => `${row.name},${row.records},${row.value},${row.level}`)].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = "schema-geo-intelligence.csv";
    link.click();
    URL.revokeObjectURL(href);
  };

  if (schema.mode === "none") {
    return (
      <section className="grid min-h-[320px] place-items-center rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center shadow-sm">
        <div>
          <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-violet-50 text-violet-600"><Globe2 className="size-7" /></div>
          <h2 className="text-lg font-black text-slate-950">No mappable schema detected</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">Add country, state, city, latitude/longitude, or source/target country fields. Plain business region values like North, South, East, West are not treated as real map locations.</p>
        </div>
      </section>
    );
  }

  if (!geoData.length && !flows.length) {
    return (
      <section className="grid min-h-[320px] place-items-center rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center shadow-sm">
        <div>
          <div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-amber-50 text-amber-600"><Globe2 className="size-7" /></div>
          <h2 className="text-lg font-black text-slate-950">Geo fields found, but locations were not mappable</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">Detected schema: {schema.mode}. Use recognizable country/city/state names or provide latitude and longitude columns for exact plotting.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-100 bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">
            <Globe2 className="size-3.5" />
            Schema-aware map
          </div>
          <h2 className="mt-3 text-xl font-black tracking-tight text-slate-950">Interactive Geo Intelligence</h2>
          <p className="mt-1 text-sm text-slate-500">Using schema mode: <span className="font-bold text-slate-700">{schema.mode}</span>{schema.locationColumn ? ` · location field: ${schema.locationColumn}` : ""}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {metricColumns.length > 0 && (
            <select aria-label="Map metric" value={metricColumn} onChange={(event) => setMetric(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 outline-none focus:border-violet-300">
              <option value="count">Record Count</option>
              {metricColumns.map((column) => <option key={column} value={column}>{pretty(column)} Avg</option>)}
            </select>
          )}
          {(["Map", "Globe", "Chart"] as const).map((mode) => (
            <button key={mode} type="button" onClick={() => setViewMode(mode)} className={`h-10 rounded-xl px-4 text-xs font-bold transition ${viewMode === mode ? "bg-violet-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-violet-50 hover:text-violet-700"}`}>{mode}</button>
          ))}
          <button onClick={() => { setZoom(1); setCenter([20, 18]); }} className="grid size-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50" title="Reset view" type="button"><RefreshCw className="size-4" /></button>
          <button onClick={exportGeo} className="grid size-10 place-items-center rounded-xl border border-violet-100 bg-violet-50 text-violet-700" title="Export CSV" type="button"><Download className="size-4" /></button>
        </div>
      </header>

      <div className="mb-5 grid gap-3 md:grid-cols-4">
        <Stat title="Mapped records" value={totalRecords.toLocaleString()} subtitle={`${geoData.length || flows.length} mapped points`} />
        <Stat title="Metric" value={metricColumn === "count" ? "Count" : pretty(metricColumn)} subtitle="Selected map measure" />
        <Stat title="Schema mode" value={pretty(schema.mode)} subtitle="Auto-detected" />
        <Stat title="Unmapped" value={unmappedCount.toLocaleString()} subtitle="Unrecognized locations" muted={unmappedCount === 0} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.6fr_.8fr]">
        <div className="relative min-h-[560px] overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
          <div className="absolute left-4 top-4 z-20 flex flex-col gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
            <button type="button" onClick={() => setZoom((value) => Math.min(6, value + 0.35))} className="grid size-8 place-items-center rounded-xl text-slate-600 hover:bg-violet-50 hover:text-violet-700"><Plus className="size-4" /></button>
            <button type="button" onClick={() => setZoom((value) => Math.max(0.8, value - 0.35))} className="grid size-8 place-items-center rounded-xl text-slate-600 hover:bg-violet-50 hover:text-violet-700"><Minus className="size-4" /></button>
            <button type="button" onClick={() => { setZoom(1); setCenter([20, 18]); }} className="grid size-8 place-items-center rounded-xl text-slate-600 hover:bg-violet-50 hover:text-violet-700"><Maximize2 className="size-4" /></button>
          </div>

          {viewMode === "Chart" ? (
            <div className="absolute inset-0 p-6">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={geoData.slice(0, 15)} margin={{ top: 20, right: 20, bottom: 60, left: 10 }}>
                  <CartesianGrid stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="name" angle={-25} textAnchor="end" height={72} tick={{ fill: "#64748b", fontSize: 12 }} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, color: "#0f172a" }} formatter={(value) => formatValue(Number(value), metricColumn)} />
                  <Bar dataKey="value" radius={[10, 10, 0, 0]} fill="#7c3aed" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <ComposableMap projection={viewMode === "Globe" ? "geoOrthographic" : "geoEqualEarth"} projectionConfig={{ scale: viewMode === "Globe" ? 230 : 165, rotate: viewMode === "Globe" ? [-20, -8, 0] : [0, 0, 0] }} className="absolute inset-0 h-full w-full">
              <defs>
                <linearGradient id="schemaMapOcean" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#ffffff" /><stop offset="100%" stopColor="#f1f5f9" /></linearGradient>
              </defs>
              {viewMode === "Globe" ? <circle cx={400} cy={300} r={232} fill="url(#schemaMapOcean)" stroke="#cbd5e1" /> : <rect width="800" height="600" fill="url(#schemaMapOcean)" />}
              <ZoomableGroup zoom={zoom} center={center} onMoveEnd={({ coordinates, zoom }) => { setCenter(coordinates as [number, number]); setZoom(zoom); }}>
                <Geographies geography={WORLD_GEO_URL}>
                  {({ geographies }: any) => geographies.map((geo: any) => {
                    const name = normalize(geo.properties?.name || "");
                    const match = geoData.find((item) => normalize(item.name) === name || normalize(item.rawValue) === name);
                    return <Geography key={geo.rsmKey} geography={geo} fill={match ? colorScale(match.value) : "#e2e8f0"} stroke="#ffffff" strokeWidth={0.55} style={{ default: { outline: "none" }, hover: { fill: match ? "#6d28d9" : "#cbd5e1", outline: "none" }, pressed: { outline: "none" } }} onMouseEnter={() => match && setActiveKey(match.key)} onMouseLeave={() => setActiveKey(null)} />;
                  })}
                </Geographies>

                {flows.map((flow) => <Line key={flow.key} from={flow.source} to={flow.target} stroke="#7c3aed" strokeWidth={2} strokeLinecap="round" strokeDasharray="5 7" />)}

                {geoData.map((item) => {
                  const radius = 5 + (item.records / Math.max(...geoData.map((geo) => geo.records), 1)) * 14;
                  const activeItem = activeKey === item.key;
                  return (
                    <Marker key={item.key} coordinates={item.coordinates} onMouseEnter={() => setActiveKey(item.key)} onMouseLeave={() => setActiveKey(null)}>
                      <circle r={radius + 8} fill="#7c3aed" opacity={activeItem ? 0.18 : 0.08} />
                      <circle r={radius} fill={colorScale(item.value)} stroke="#ffffff" strokeWidth={2} />
                      {activeItem && <text y={-radius - 8} textAnchor="middle" fontSize={11} fontWeight={800} fill="#0f172a">{item.name}</text>}
                    </Marker>
                  );
                })}
              </ZoomableGroup>
            </ComposableMap>
          )}

          {active && viewMode !== "Chart" && (
            <div className="absolute bottom-4 left-4 z-20 w-72 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur">
              <h4 className="text-sm font-black text-slate-950">{active.name}</h4>
              <div className="mt-3 space-y-2 text-xs text-slate-600">
                <Info label="Records" value={active.records.toLocaleString()} />
                <Info label={metricColumn === "count" ? "Count" : pretty(metricColumn)} value={formatValue(active.value, metricColumn)} />
                <Info label="Schema level" value={pretty(active.level)} />
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-black text-slate-950">Top mapped locations</h3>
            <div className="mt-4 space-y-3">
              {geoData.slice(0, 8).map((item, index) => (
                <button key={item.key} type="button" onMouseEnter={() => setActiveKey(item.key)} onMouseLeave={() => setActiveKey(null)} className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-left hover:border-violet-200 hover:bg-violet-50">
                  <span><span className="text-xs font-bold text-slate-400">#{index + 1}</span> <span className="ml-2 text-sm font-bold text-slate-800">{item.name}</span></span>
                  <span className="text-xs font-black text-violet-700">{formatValue(item.value, metricColumn)}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-black text-slate-950">Schema mapping</h3>
            <div className="mt-3 space-y-2 text-xs text-slate-600">
              <Info label="Mode" value={pretty(schema.mode)} />
              <Info label="Country" value={schema.country || "Not detected"} />
              <Info label="State" value={schema.state || "Not detected"} />
              <Info label="City" value={schema.city || "Not detected"} />
              <Info label="Latitude" value={schema.lat || "Not detected"} />
              <Info label="Longitude" value={schema.lng || "Not detected"} />
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}

function Stat({ title, value, subtitle, muted = false }: { title: string; value: string; subtitle: string; muted?: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{title}</p>
      <p className={`mt-1 text-2xl font-black ${muted ? "text-emerald-700" : "text-slate-950"}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4"><span className="text-slate-500">{label}</span><span className="font-bold text-slate-800">{value}</span></div>;
}
