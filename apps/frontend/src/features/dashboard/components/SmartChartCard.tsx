import { Fragment, useMemo, useRef } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download, MoreHorizontal, Trash2, Copy, AlertCircle } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import type { ChartType } from "@/features/dashboard/types/dashboardTypes";
import type { DashboardChart } from "@/features/dashboard/utils/dashboardAnalytics";

const COLORS = ["#7c3aed", "#2563eb", "#06b6d4", "#22c55e", "#f59e0b", "#ef4444"];

type Props = {
  chart: DashboardChart;
  availableTypes?: ChartType[];
  onTypeChange?: (type: ChartType) => void;
  onRemove?: () => void;
  onDuplicate?: () => void;
};

function downloadTextFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

async function downloadSvgOrPng(root: HTMLDivElement | null, fileName: string, kind: "svg" | "png") {
  const svg = root?.querySelector("svg");
  if (!svg) return;

  const serializer = new XMLSerializer();
  const svgText = serializer.serializeToString(svg);

  if (kind === "svg") {
    downloadTextFile(`${fileName}.svg`, svgText, "image/svg+xml;charset=utf-8");
    return;
  }

  const encoded = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
  const image = new Image();

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Failed to render chart image."));
    image.src = encoded;
  });

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(svg.clientWidth, 900);
  canvas.height = Math.max(svg.clientHeight, 520);
  const context = canvas.getContext("2d");
  if (!context) return;
  context.fillStyle = "#081121";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${fileName}.png`;
    link.click();
    URL.revokeObjectURL(url);
  });
}

function HeatmapChart({ data }: { data: Array<Record<string, string | number>> }) {
  const xLabels = Array.from(new Set(data.map((item) => String(item.x))));
  const yLabels = Array.from(new Set(data.map((item) => String(item.y))));

  const getColor = (value: number) => {
    const opacity = Math.min(Math.abs(value), 1);
    return value >= 0
      ? `rgba(37, 99, 235, ${0.12 + opacity * 0.68})`
      : `rgba(239, 68, 68, ${0.12 + opacity * 0.68})`;
  };

  return (
    <div className="grid gap-2">
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `120px repeat(${xLabels.length}, minmax(0, 1fr))` }}
      >
        <div />
        {xLabels.map((label) => (
          <div key={label} className="truncate px-1 text-center text-xs text-slate-400">
            {label}
          </div>
        ))}
        {yLabels.map((rowLabel) => (
          <Fragment key={rowLabel}>
            <div key={`${rowLabel}-label`} className="truncate px-1 py-2 text-xs text-slate-300">
              {rowLabel}
            </div>
            {xLabels.map((columnLabel) => {
              const cell = data.find(
                (item) => String(item.x) === columnLabel && String(item.y) === rowLabel,
              );
              const value = Number(cell?.value ?? 0);

              return (
                <div
                  key={`${rowLabel}-${columnLabel}`}
                  className="flex h-12 items-center justify-center rounded-xl border border-slate-700/60 text-xs font-medium text-white"
                  style={{ background: getColor(value) }}
                  title={`${rowLabel} x ${columnLabel}: ${value}`}
                >
                  {value.toFixed(2)}
                </div>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

export default function SmartChartCard({
  chart,
  availableTypes = [
    "bar",
    "horizontalBar",
    "line",
    "area",
    "pie",
    "donut",
    "histogram",
    "scatter",
    "radar",
    "composed",
    "heatmap",
  ],
  onTypeChange,
  onRemove,
  onDuplicate,
}: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const empty = !chart.data?.length;

  const pieData = useMemo(
    () =>
      chart.data.map((entry, index) => ({
        ...entry,
        fill: COLORS[index % COLORS.length],
      })),
    [chart.data],
  );

  const fileName = chart.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return (
    <div className="rounded-2xl border border-slate-700/60 bg-slate-900/70 p-4 shadow-xl backdrop-blur">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-white">{chart.title}</h3>
          <p className="truncate text-xs text-slate-400">
            {chart.subtitle || `${chart.aggregation.toUpperCase()} - ${chart.xKey} / ${chart.yKey}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={chart.type}
            onChange={(event) => onTypeChange?.(event.target.value as ChartType)}
            className="rounded-xl border border-slate-700/60 bg-slate-950 px-3 py-2 text-xs text-slate-200 outline-none"
          >
            {availableTypes.map((type) => (
              <option key={type} value={type}>
                {type === "horizontalBar" ? "horizontal bar" : type}
              </option>
            ))}
          </select>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="size-9 rounded-xl border-slate-700/60 bg-slate-950 text-slate-300 hover:bg-slate-800"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="border-slate-700 bg-slate-950 text-slate-200">
              <DropdownMenuItem onClick={() => downloadSvgOrPng(rootRef.current, fileName, "png")}>
                <Download className="mr-2 size-4" />
                Download PNG
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => downloadSvgOrPng(rootRef.current, fileName, "svg")}>
                <Download className="mr-2 size-4" />
                Download SVG
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy className="mr-2 size-4" />
                Duplicate chart
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onRemove} className="text-red-300 focus:text-red-200">
                <Trash2 className="mr-2 size-4" />
                Remove chart
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {chart.warning && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          <AlertCircle className="size-4" />
          {chart.warning}
        </div>
      )}

      {empty ? (
        <div className="flex h-72 items-center justify-center rounded-2xl border border-dashed border-slate-700/60 bg-slate-950/40 text-sm text-slate-400">
          Not enough data to render this chart.
        </div>
      ) : chart.type === "heatmap" ? (
        <div className="min-h-[18rem] overflow-auto rounded-2xl bg-slate-950/30 p-2">
          <HeatmapChart data={chart.data} />
        </div>
      ) : (
        <div ref={rootRef} className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            {chart.type === "line" ? (
              <LineChart data={chart.data}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis dataKey={chart.xKey} stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip />
                <Line type="monotone" dataKey={chart.yKey} stroke="#7c3aed" strokeWidth={3} dot={false} />
              </LineChart>
            ) : chart.type === "area" ? (
              <AreaChart data={chart.data}>
                <defs>
                  <linearGradient id={`${chart.id}-gradient`} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.7} />
                    <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis dataKey={chart.xKey} stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip />
                <Area
                  type="monotone"
                  dataKey={chart.yKey}
                  stroke="#7c3aed"
                  fill={`url(#${chart.id}-gradient)`}
                  strokeWidth={2.5}
                />
              </AreaChart>
            ) : chart.type === "pie" || chart.type === "donut" ? (
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey={chart.yKey}
                  nameKey={chart.xKey}
                  innerRadius={chart.type === "donut" ? 60 : 0}
                  outerRadius={88}
                  paddingAngle={2}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`${entry[chart.xKey]}-${index}`} fill={entry.fill as string} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            ) : chart.type === "scatter" ? (
              <ScatterChart>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis dataKey={chart.xKey} stroke="#94a3b8" fontSize={11} type="number" />
                <YAxis dataKey={chart.yKey} stroke="#94a3b8" fontSize={11} type="number" />
                <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                <Scatter data={chart.data} fill="#06b6d4" />
              </ScatterChart>
            ) : chart.type === "radar" ? (
              <RadarChart data={chart.data}>
                <PolarGrid stroke="#334155" />
                <PolarAngleAxis dataKey={chart.xKey} stroke="#cbd5e1" />
                <PolarRadiusAxis stroke="#64748b" />
                <Radar dataKey={chart.yKey} stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.45} />
                <Tooltip />
              </RadarChart>
            ) : chart.type === "composed" ? (
              <ComposedChart data={chart.data}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis dataKey={chart.xKey} stroke="#94a3b8" fontSize={11} />
                <YAxis stroke="#94a3b8" fontSize={11} />
                <Tooltip />
                <Bar dataKey={chart.yKey} fill="#2563eb" radius={[8, 8, 0, 0]} />
                <Line type="monotone" dataKey={chart.yKey} stroke="#7c3aed" strokeWidth={2} />
              </ComposedChart>
            ) : (
              <BarChart
                data={chart.data}
                layout={chart.type === "horizontalBar" ? "vertical" : "horizontal"}
                margin={{ left: chart.type === "horizontalBar" ? 24 : 0 }}
              >
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
                <XAxis
                  type={chart.type === "horizontalBar" ? "number" : "category"}
                  dataKey={chart.type === "horizontalBar" ? undefined : chart.xKey}
                  stroke="#94a3b8"
                  fontSize={11}
                />
                <YAxis
                  type={chart.type === "horizontalBar" ? "category" : "number"}
                  dataKey={chart.type === "horizontalBar" ? chart.xKey : undefined}
                  stroke="#94a3b8"
                  fontSize={11}
                  width={chart.type === "horizontalBar" ? 110 : 32}
                />
                <Tooltip />
                <Bar dataKey={chart.yKey} fill="#7c3aed" radius={[8, 8, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
