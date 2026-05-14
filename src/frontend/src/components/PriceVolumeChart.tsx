import type { PriceVolumePoint } from "@/backend";
import { getCurrencySymbol } from "@/context/CurrencyContext";
import { useMarketChart } from "@/hooks/useQueries";
import { useState } from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Range = { label: string; days: bigint };
const RANGES: Range[] = [
  { label: "7d", days: 7n },
  { label: "30d", days: 30n },
  { label: "90d", days: 90n },
];

function formatDate(ms: number, days: bigint): string {
  const d = new Date(ms);
  if (days <= 7n)
    return d.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

interface ChartRow {
  ms: number;
  price: number;
  volume: number;
}

function toRows(points: PriceVolumePoint[], _days: bigint): ChartRow[] {
  return points
    .map((p) => ({
      ms: Number(p.timestamp / 1_000_000n),
      price: p.priceUSD,
      volume: p.volume24h,
    }))
    .sort((a, b) => a.ms - b.ms)
    .filter((_, i, arr) => {
      // Thin out to ~60 points for rendering performance
      const step = Math.max(1, Math.floor(arr.length / 60));
      return i % step === 0 || i === arr.length - 1;
    });
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ChartRow }>;
  days: bigint;
  sym: string;
  rate: number;
}
function ChartTooltip({ active, payload, days, sym, rate }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const row: ChartRow = payload[0].payload;
  const convertedPrice = row.price * rate;
  const convertedVol = row.volume * rate;
  function fmtVol(val: number): string {
    if (val >= 1_000_000) return `${sym}${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `${sym}${(val / 1_000).toFixed(0)}K`;
    return `${sym}${val.toFixed(0)}`;
  }
  return (
    <div className="card-metric text-xs min-w-[160px] shadow-subtle">
      <p className="text-muted-foreground mb-1">{formatDate(row.ms, days)}</p>
      <p className="font-mono text-accent font-semibold">
        Price: {sym}
        {convertedPrice.toFixed(4)}
      </p>
      <p className="font-mono text-foreground">Vol: {fmtVol(convertedVol)}</p>
    </div>
  );
}

export function PriceVolumeChart({
  currency = "USD",
  rates = {},
  refreshInterval = 60_000,
}: {
  currency?: string;
  rates?: Record<string, number>;
  refreshInterval?: number;
}) {
  const sym = getCurrencySymbol(currency);
  const rate = currency !== "USD" && rates[currency] ? rates[currency] : 1;
  const [range, setRange] = useState<Range>(RANGES[0]);
  const { data: points, isLoading } = useMarketChart(
    range.days,
    refreshInterval,
  );

  const rawRows = points ? toRows(points, range.days) : [];
  const rows = rawRows;
  const hasData = rows.length > 0;

  // Compute Y-axis domains with padding (apply currency rate)
  const prices = rows.map((r) => r.price * rate);
  const priceMin = hasData ? Math.min(...prices) * 0.98 : 0;
  const priceMax = hasData ? Math.max(...prices) * 1.02 : 100;
  const volumes = rows.map((r) => r.volume * rate);
  const volMax = hasData ? Math.max(...volumes) * 1.1 : 1;

  function formatK(val: number): string {
    if (val >= 1_000_000) return `${sym}${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `${sym}${(val / 1_000).toFixed(0)}K`;
    return `${sym}${val.toFixed(0)}`;
  }

  return (
    <div className="card-metric space-y-4" data-ocid="price_chart.card">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-sm-metric">Price &amp; Volume</span>
        <div className="flex gap-1" data-ocid="price_chart.range_tabs">
          {RANGES.map((r) => (
            <button
              key={r.label}
              type="button"
              onClick={() => setRange(r)}
              className={`px-2.5 py-1 text-xs font-mono rounded transition-smooth ${
                range.label === r.label
                  ? "bg-accent/20 text-accent border border-accent/40"
                  : "text-muted-foreground hover:text-foreground border border-transparent hover:border-border"
              }`}
              data-ocid={`price_chart.${r.label}_tab`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      {isLoading ? (
        <div
          className="h-56 w-full bg-muted rounded animate-pulse"
          data-ocid="price_chart.loading_state"
        />
      ) : !hasData ? (
        <div
          className="h-56 flex items-center justify-center text-muted-foreground text-sm"
          data-ocid="price_chart.empty_state"
        >
          No chart data available yet. Data populates on the next refresh cycle.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart
            data={rows}
            margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="oklch(0.62 0.21 250)"
                  stopOpacity={0.35}
                />
                <stop
                  offset="95%"
                  stopColor="oklch(0.62 0.21 250)"
                  stopOpacity={0.02}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="oklch(0.25 0.01 240 / 0.5)"
              vertical={false}
            />
            <XAxis
              dataKey="ms"
              tickFormatter={(v: number) => formatDate(v, range.days)}
              tick={{ fontSize: 10, fill: "oklch(0.55 0.01 250)" }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={48}
            />
            <YAxis
              yAxisId="price"
              orientation="left"
              domain={[priceMin, priceMax]}
              tickFormatter={(v: number) => `${sym}${v.toFixed(2)}`}
              tick={{ fontSize: 10, fill: "oklch(0.55 0.01 250)" }}
              axisLine={false}
              tickLine={false}
              width={64}
            />
            <YAxis
              yAxisId="volume"
              orientation="right"
              domain={[0, volMax]}
              tickFormatter={formatK}
              tick={{ fontSize: 10, fill: "oklch(0.55 0.01 250)" }}
              axisLine={false}
              tickLine={false}
              width={52}
            />
            <Tooltip
              content={<ChartTooltip days={range.days} sym={sym} rate={rate} />}
              cursor={{
                stroke: "oklch(0.62 0.21 250 / 0.4)",
                strokeWidth: 1,
              }}
            />
            {/* Volume bars (behind price line) */}
            <Bar
              yAxisId="volume"
              dataKey="volume"
              fill="oklch(0.6 0.18 280 / 0.35)"
              radius={[2, 2, 0, 0]}
              maxBarSize={6}
            />
            {/* Price area */}
            <Area
              yAxisId="price"
              type="monotone"
              dataKey="price"
              stroke="oklch(0.68 0.22 250)"
              strokeWidth={2}
              fill="url(#priceGrad)"
              dot={false}
              activeDot={{ r: 4, fill: "oklch(0.68 0.22 250)" }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
