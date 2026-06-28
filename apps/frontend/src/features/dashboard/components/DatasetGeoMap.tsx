import { useMemo, useState } from "react";
import { Globe2, Maximize2, Minus, Plus } from "lucide-react";
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup } from "react-simple-maps";
import { scaleLinear } from "d3-scale";
import { extractGeoLocation, normalizeGeoValue } from "@/features/dashboard/utils/geoResolver";

type Row = Record<string, unknown>;
type Column = { name: string; type?: string; role?: string };
type Props = { rows: Row[]; columns?: Column[] };

type Point = {
  key: string;
  name: string;
  raw: string;
  coordinates: [number, number];
  records: number;
  value: number;
  source: string;
};

const WORLD_GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
const clean = (value: unknown) => String(value ?? "").trim();
const pretty = (value: string) => value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

const toNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value ?? "").replace(/[$,%]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
};

const formatValue = (value: number, metric: string) => {
  if (/revenue|sales|profit|amount|price|cost|salary|income|billing|usd|inr/i.test(metric)) return `$${Math.round(value).toLocaleString()}`;
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
};

const findColumn = (columns: Column[], names: string[], regex: RegExp) =>
  columns.find((column) => names.includes(normalizeGeoValue(column.name)) || names.includes(normalizeGeoValue(column.type || "")) || names.includes(normalizeGeoValue(column.role || "")))?.name ||
  columns.find((column) => regex.test(normalizeGeoValue(column.name)) || regex.test(normalizeGeoValue(column.type || "")) || regex.test(normalizeGeoValue(column.role || "")))?.name ||
  "";

const inferLocationColumn = (rows: Row[], columns: Column[]) => {
  let best: { column: string; ratio: number; hits: number } | null = null;
  const candidates = columns.map((column) => column.name).filter((name) => !/id|phone|zip|postal|code|pin|date|time|month|year|url|link|amount|billing|age|room/i.test(name));

  for (const column of candidates) {
    const values = Array.from(new Set(rows.slice(0, 300).map((row) => clean(row[column])).filter(Boolean))).slice(0, 90);
    if (!values.length) continue;
    const hits = values.filter((value) => extractGeoLocation(value)).length;
    const ratio = hits / values.length;
    if ((hits >= 2 && ratio >= 0.35) || ratio >= 0.75) {
      if (!best || ratio > best.ratio || hits > best.hits) best = { column, ratio, hits };
    }
  }
  return best?.column || "";
};

export default function DatasetGeoMap({ rows, columns = [] }: Props) {
  const [metric, setMetric] = useState("");
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState<[number, number]>([20, 18]);

  const schemaColumns = useMemo(() => (columns.length ? columns : Object.keys(rows[0] || {}).map((name) => ({ name }))), [columns, rows]);

  const schema = useMemo(() => {
    const lat = findColumn(schemaColumns, ["lat", "latitude"], /^(lat|latitude)$/);
    const lng = findColumn(schemaColumns, ["lng", "lon", "long", "longitude"], /^(lng|lon|long|longitude)$/);
    const country = findColumn(schemaColumns, ["country", "country_name", "nation"], /country|nation/);
    const state = findColumn(schemaColumns, ["state", "province", "territory"], /state|province|territory/);
    const city = findColumn(schemaColumns, ["city", "town", "hospital_city", "patient_city", "facility_city", "location_city"], /city|town/);
    const facility = findColumn(schemaColumns, ["hospital", "facility", "clinic", "medical_center", "medical_centre"], /hospital|facility|clinic|medical_center|medical_centre/);
    const inferred = inferLocationColumn(rows, schemaColumns);
    const location = city || state || country || inferred;
    const mode = lat && lng ? "coordinates" : city ? "city" : state ? "state" : country ? "country" : inferred ? "data values" : facility ? "facility needs city" : "none";
    return { lat, lng, country, state, city, facility, inferred, location, mode };
  }, [rows, schemaColumns]);

  const metricColumns = useMemo(
    () => schemaColumns.map((column) => column.name).filter((name) => {
      if ([schema.lat, schema.lng].includes(name)) return false;
      if (/id|phone|zip|postal|code|pin/i.test(name)) return false;
      const values = rows.slice(0, 100).map((row) => toNumber(row[name])).filter((value) => value !== null);
      return values.length >= Math.min(3, Math.max(rows.length, 1));
    }),
    [rows, schemaColumns, schema.lat, schema.lng],
  );

  const metricColumn = metricColumns.includes(metric) ? metric : metricColumns[0] || "count";

  const points = useMemo<Point[]>(() => {
    if (!rows.length || schema.mode === "none" || schema.mode === "facility needs city") return [];

    if (schema.mode === "coordinates") {
      return rows.map((row, index) => {
        const lat = toNumber(row[schema.lat]);
        const lng = toNumber(row[schema.lng]);
        if (lat === null || lng === null) return null;
        const name = clean(row[schema.city] || row[schema.state] || row[schema.country] || row[schema.inferred] || `Point ${index + 1}`);
        const value = metricColumn === "count" ? 1 : toNumber(row[metricColumn]) ?? 0;
        return { key: `pt-${index}`, name, raw: name, coordinates: [lng, lat] as [number, number], records: 1, value, source: "coordinates" };
      }).filter((item): item is Point => Boolean(item)).slice(0, 500);
    }

    const bucket = new Map<string, { raw: string; records: number; sum: number; location: NonNullable<ReturnType<typeof extractGeoLocation>> }>();
    rows.forEach((row) => {
      const raw = clean(row[schema.location]);
      const location = extractGeoLocation(raw);
      if (!raw || !location) return;
      const key = normalizeGeoValue(location.name || raw);
      const current = bucket.get(key) || { raw, records: 0, sum: 0, location };
      current.records += 1;
      current.sum += metricColumn === "count" ? 1 : toNumber(row[metricColumn]) ?? 0;
      bucket.set(key, current);
    });

    return Array.from(bucket.entries()).map(([key, item]) => ({
      key,
      name: item.location.name,
      raw: item.raw,
      coordinates: item.location.coordinates,
      records: item.records,
      value: metricColumn === "count" ? item.records : item.sum / Math.max(item.records, 1),
      source: schema.mode,
    })).sort((a, b) => b.value - a.value);
  }, [rows, schema, metricColumn]);

  const maxValue = Math.max(...points.map((point) => point.value), 1);
  const minValue = Math.min(...points.map((point) => point.value), 0);
  const colorScale = scaleLinear<string>().domain([minValue, maxValue]).range(["#ddd6fe", "#6d28d9"]);
  const active = points.find((point) => point.key === activeKey) || points[0];
  const unmapped = schema.location ? rows.filter((row) => clean(row[schema.location]) && !extractGeoLocation(row[schema.location])).length : 0;

  if (schema.mode === "facility needs city") {
    return <Empty title="City schema required for healthcare map" message={`Detected ${schema.facility}, but hospital names alone are not enough for a real map. Add a City, Hospital City, State, Country, Latitude, or Longitude column and the map will plot real locations.`} />;
  }

  if (schema.mode === "none") {
    return <Empty title="No mappable location schema detected" message="Add City, Hospital City, State, Country, Latitude/Longitude, or a column whose values contain real places like Delhi, Mumbai, India, USA, or Germany." />;
  }

  if (!points.length) {
    return <Empty title="Geo schema found, but city values were not mappable" message={`Detected ${schema.mode}. Use recognizable city/state/country names or add latitude and longitude columns for exact plotting.`} />;
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-100 bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700"><Globe2 className="size-3.5" />Real city map</div>
          <h2 className="mt-3 text-xl font-black tracking-tight text-slate-950">Interactive Geo Intelligence</h2>
          <p className="mt-1 text-sm text-slate-500">Mapping source: <span className="font-bold text-slate-700">{schema.mode}</span> · field: <span className="font-bold text-slate-700">{schema.location || "coordinates"}</span></p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {metricColumns.length > 0 && <select value={metricColumn} onChange={(event) => setMetric(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-700 outline-none focus:border-violet-300"><option value="count">Record Count</option>{metricColumns.map((column) => <option key={column} value={column}>{pretty(column)} Avg</option>)}</select>}
        </div>
      </header>

      <div className="mb-5 grid gap-3 md:grid-cols-4">
        <Stat title="Mapped records" value={points.reduce((sum, point) => sum + point.records, 0).toLocaleString()} subtitle={`${points.length} mapped locations`} />
        <Stat title="Metric" value={metricColumn === "count" ? "Count" : pretty(metricColumn)} subtitle="Selected measure" />
        <Stat title="Source" value={schema.mode === "data values" ? "Dataset Values" : "Schema"} subtitle={schema.location || "coordinates"} />
        <Stat title="Unmapped" value={unmapped.toLocaleString()} subtitle="Skipped values" muted={unmapped === 0} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.6fr_.8fr]">
        <div className="relative min-h-[560px] overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
          <div className="absolute left-4 top-4 z-20 flex flex-col gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
            <button type="button" onClick={() => setZoom((value) => Math.min(6, value + 0.35))} className="grid size-8 place-items-center rounded-xl text-slate-600 hover:bg-violet-50 hover:text-violet-700"><Plus className="size-4" /></button>
            <button type="button" onClick={() => setZoom((value) => Math.max(0.8, value - 0.35))} className="grid size-8 place-items-center rounded-xl text-slate-600 hover:bg-violet-50 hover:text-violet-700"><Minus className="size-4" /></button>
            <button type="button" onClick={() => { setZoom(1); setCenter([20, 18]); }} className="grid size-8 place-items-center rounded-xl text-slate-600 hover:bg-violet-50 hover:text-violet-700"><Maximize2 className="size-4" /></button>
          </div>
          <ComposableMap projection="geoEqualEarth" projectionConfig={{ scale: 165 }} className="absolute inset-0 h-full w-full">
            <rect width="800" height="600" fill="#f8fafc" />
            <ZoomableGroup zoom={zoom} center={center} onMoveEnd={({ coordinates, zoom }) => { setCenter(coordinates as [number, number]); setZoom(zoom); }}>
              <Geographies geography={WORLD_GEO_URL}>{({ geographies }: any) => geographies.map((geo: any) => { const name = normalizeGeoValue(geo.properties?.name || ""); const match = points.find((point) => normalizeGeoValue(point.name) === name || normalizeGeoValue(point.raw) === name); return <Geography key={geo.rsmKey} geography={geo} fill={match ? colorScale(match.value) : "#e2e8f0"} stroke="#ffffff" strokeWidth={0.55} style={{ default: { outline: "none" }, hover: { fill: match ? "#6d28d9" : "#cbd5e1", outline: "none" }, pressed: { outline: "none" } }} onMouseEnter={() => match && setActiveKey(match.key)} onMouseLeave={() => setActiveKey(null)} />; })}</Geographies>
              {points.map((point) => { const radius = 5 + (point.records / Math.max(...points.map((item) => item.records), 1)) * 14; const isActive = activeKey === point.key; return <Marker key={point.key} coordinates={point.coordinates} onMouseEnter={() => setActiveKey(point.key)} onMouseLeave={() => setActiveKey(null)}><circle r={radius + 8} fill="#7c3aed" opacity={isActive ? 0.18 : 0.08} /><circle r={radius} fill={colorScale(point.value)} stroke="#ffffff" strokeWidth={2} />{isActive && <text y={-radius - 8} textAnchor="middle" fontSize={11} fontWeight={800} fill="#0f172a">{point.name}</text>}</Marker>; })}
            </ZoomableGroup>
          </ComposableMap>
          {active && <div className="absolute bottom-4 left-4 z-20 w-72 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-lg backdrop-blur"><h4 className="text-sm font-black text-slate-950">{active.name}</h4><div className="mt-3 space-y-2 text-xs text-slate-600"><Info label="Records" value={active.records.toLocaleString()} /><Info label={metricColumn === "count" ? "Count" : pretty(metricColumn)} value={formatValue(active.value, metricColumn)} /><Info label="From" value={active.source} /></div></div>}
        </div>
        <aside className="space-y-4"><section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"><h3 className="text-sm font-black text-slate-950">Top mapped locations</h3><div className="mt-4 space-y-3">{points.slice(0, 8).map((point, index) => <button key={point.key} type="button" onMouseEnter={() => setActiveKey(point.key)} onMouseLeave={() => setActiveKey(null)} className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-left hover:border-violet-200 hover:bg-violet-50"><span><span className="text-xs font-bold text-slate-400">#{index + 1}</span> <span className="ml-2 text-sm font-bold text-slate-800">{point.name}</span></span><span className="text-xs font-black text-violet-700">{formatValue(point.value, metricColumn)}</span></button>)}</div></section></aside>
      </div>
    </section>
  );
}

function Empty({ title, message }: { title: string; message: string }) {
  return <section className="grid min-h-[320px] place-items-center rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center shadow-sm"><div><div className="mx-auto mb-4 grid size-14 place-items-center rounded-2xl bg-violet-50 text-violet-600"><Globe2 className="size-7" /></div><h2 className="text-lg font-black text-slate-950">{title}</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">{message}</p></div></section>;
}

function Stat({ title, value, subtitle, muted = false }: { title: string; value: string; subtitle: string; muted?: boolean }) {
  return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">{title}</p><p className={`mt-1 text-2xl font-black ${muted ? "text-emerald-700" : "text-slate-950"}`}>{value}</p><p className="mt-1 text-xs text-slate-500">{subtitle}</p></div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-4"><span className="text-slate-500">{label}</span><span className="font-bold text-slate-800">{value}</span></div>;
}
