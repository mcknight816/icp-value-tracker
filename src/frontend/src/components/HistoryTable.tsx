import type { ExecutionRecord, MarketDataPoint } from "@/backend";
import { formatCurrency, formatCurrencyShort } from "@/context/CurrencyContext";
import { useExecutionHistory, useMarketHistory } from "@/hooks/useQueries";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

type SortKey = "timestamp" | "priceUSD" | "volume24h" | "fearGreedScore";
type SortDir = "asc" | "desc";

function formatVolume(v: number): string {
  if (v >= 1_000_000_000) return `$${(v / 1_000_000_000).toFixed(2)}B`;
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

function formatICP(v: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(v);
}

function fgColor(score: number): string {
  if (score <= 25) return "oklch(0.6 0.2 22)";
  if (score <= 45) return "oklch(0.65 0.19 50)";
  if (score <= 55) return "oklch(0.7 0.18 90)";
  if (score <= 75) return "oklch(0.68 0.2 145)";
  return "oklch(0.65 0.22 165)";
}

function fgLabel(score: number): string {
  if (score <= 25) return "Extreme Fear";
  if (score <= 45) return "Fear";
  if (score <= 55) return "Neutral";
  if (score <= 75) return "Greed";
  return "Extreme Greed";
}

function SortIcon({
  col,
  active,
  dir,
}: { col: string; active: string; dir: SortDir }) {
  if (col !== active) return <ChevronUp className="w-3 h-3 opacity-25" />;
  return dir === "asc" ? (
    <ChevronUp className="w-3 h-3" />
  ) : (
    <ChevronDown className="w-3 h-3" />
  );
}

const PAGE_SIZE = 30;

interface HistoryTableProps {
  currency?: string;
  rates?: Record<string, number>;
  refreshInterval?: number;
}

export function HistoryTable({
  currency = "USD",
  rates = {},
  refreshInterval = 60_000,
}: HistoryTableProps = {}) {
  const fmt = (v: number) => formatCurrency(v, currency, rates);
  const currencyCode = currency || "USD";
  const { data: history, isLoading } = useMarketHistory(refreshInterval);
  const { data: executions, isLoading: execLoading } =
    useExecutionHistory(refreshInterval);
  const [sortKey, setSortKey] = useState<SortKey>("timestamp");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = history
    ? [...history]
        .sort((a, b) => {
          let av: number;
          let bv: number;
          if (sortKey === "fearGreedScore") {
            av = Number(a.fearGreedScore);
            bv = Number(b.fearGreedScore);
          } else if (sortKey === "timestamp") {
            av = Number(a.timestamp);
            bv = Number(b.timestamp);
          } else {
            av = a[sortKey];
            bv = b[sortKey];
          }
          return sortDir === "asc" ? av - bv : bv - av;
        })
        .slice(0, PAGE_SIZE)
    : [];

  // Execution history: already sorted descending by backend, newest first
  const execSorted: ExecutionRecord[] = executions
    ? [...executions].sort((a, b) => Number(b.executedAt - a.executedAt))
    : [];

  const execTotals = execSorted.reduce(
    (acc, r) => ({
      tokensSold: acc.tokensSold + r.tokensSold,
      saleValue: acc.saleValue + r.saleValue,
    }),
    { tokensSold: 0, saleValue: 0 },
  );
  const finalRemainingICP =
    execSorted.length > 0
      ? execSorted[execSorted.length - 1].remainingICP
      : null;

  const colHeader = (
    key: SortKey,
    label: string,
    align: "left" | "right" = "right",
  ) => (
    <th
      className={`px-3 py-2.5 text-xs font-medium uppercase tracking-wider whitespace-nowrap text-${align}`}
    >
      <button
        type="button"
        className="inline-flex items-center gap-1 justify-end w-full text-muted-foreground cursor-pointer select-none hover:text-foreground transition-smooth"
        onClick={() => handleSort(key)}
      >
        {label}
        <SortIcon col={key} active={sortKey} dir={sortDir} />
      </button>
    </th>
  );

  return (
    <div className="space-y-6">
      {/* ── Historical Metrics ── */}
      <div
        className="card-metric overflow-hidden space-y-3"
        data-ocid="history_table.card"
      >
        <span className="text-sm-metric block">
          Historical Metrics (Last 30 Records)
        </span>

        {isLoading ? (
          <div className="space-y-2" data-ocid="history_table.loading_state">
            {Array.from({ length: 5 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: loading skeleton
              <div key={i} className="h-9 bg-muted rounded animate-pulse" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div
            className="py-10 text-center text-muted-foreground text-sm"
            data-ocid="history_table.empty_state"
          >
            Historical data will appear after the first refresh cycle.
          </div>
        ) : (
          <div
            className="overflow-auto max-h-[380px] rounded-md border border-border"
            style={{ scrollbarWidth: "thin" }}
          >
            <table className="w-full text-sm min-w-[540px]">
              <thead className="sticky top-0 bg-card border-b border-border z-10">
                <tr>
                  {colHeader("timestamp", "Date (UTC)", "left")}
                  {colHeader("priceUSD", `Price (${currencyCode})`)}
                  {colHeader("volume24h", "24h Volume")}
                  {colHeader("fearGreedScore", "Fear & Greed")}
                </tr>
              </thead>
              <tbody>
                {sorted.map((row, i) => {
                  const ms = Number(row.timestamp / 1_000_000n);
                  const date = new Date(ms);
                  const score = Number(row.fearGreedScore);
                  const color = fgColor(score);
                  return (
                    <tr
                      key={ms}
                      className="border-b border-border/50 hover:bg-muted/30 transition-smooth"
                      data-ocid={`history_table.row.${i + 1}`}
                    >
                      <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground whitespace-nowrap">
                        {date.toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: "UTC",
                          timeZoneName: "short",
                        })}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-right text-foreground tabular-nums">
                        {formatCurrencyShort(row.priceUSD, currency, rates)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-right text-muted-foreground tabular-nums">
                        {formatVolume(row.volume24h)}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span
                          className="inline-flex items-center gap-1.5 text-xs font-semibold font-mono px-2 py-0.5 rounded-full border"
                          style={{
                            color,
                            borderColor: color,
                            backgroundColor:
                              `${color.slice(0, -1)} / 0.12)`.replace(
                                "oklch(",
                                "oklch(",
                              ),
                          }}
                        >
                          {score} · {fgLabel(score)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Execution History ── */}
      <div
        className="card-metric overflow-hidden space-y-3"
        data-ocid="execution_history.card"
      >
        <span className="text-sm-metric block">Execution History</span>

        {execLoading ? (
          <div
            className="space-y-2"
            data-ocid="execution_history.loading_state"
          >
            {Array.from({ length: 3 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: loading skeleton
              <div key={i} className="h-9 bg-muted rounded animate-pulse" />
            ))}
          </div>
        ) : execSorted.length === 0 ? (
          <div
            className="py-10 text-center text-muted-foreground text-sm"
            data-ocid="execution_history.empty_state"
          >
            No sales recorded yet — execute a target from the Exit Strategy tab
            to track your sales here.
          </div>
        ) : (
          <div
            className="overflow-auto max-h-[400px] rounded-md border border-border"
            style={{ scrollbarWidth: "thin" }}
          >
            <table className="w-full text-sm min-w-[600px]">
              <thead className="sticky top-0 bg-card border-b border-border z-10">
                <tr>
                  <th className="px-3 py-2.5 text-xs font-medium uppercase tracking-wider text-left text-muted-foreground whitespace-nowrap">
                    Date
                  </th>
                  <th className="px-3 py-2.5 text-xs font-medium uppercase tracking-wider text-right text-muted-foreground whitespace-nowrap">
                    Target Price ({currencyCode})
                  </th>
                  <th className="px-3 py-2.5 text-xs font-medium uppercase tracking-wider text-right text-muted-foreground whitespace-nowrap">
                    Tokens Sold
                  </th>
                  <th className="px-3 py-2.5 text-xs font-medium uppercase tracking-wider text-right text-muted-foreground whitespace-nowrap">
                    Sale Value ({currencyCode})
                  </th>
                  <th className="px-3 py-2.5 text-xs font-medium uppercase tracking-wider text-right text-muted-foreground whitespace-nowrap">
                    Remaining ICP
                  </th>
                </tr>
              </thead>
              <tbody>
                {execSorted.map((rec, i) => {
                  const ms = Number(rec.executedAt / 1_000_000n);
                  const date = new Date(ms);
                  return (
                    <tr
                      key={rec.id}
                      className="border-b border-border/50 hover:bg-muted/30 transition-smooth"
                      data-ocid={`execution_history.row.${i + 1}`}
                    >
                      <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground whitespace-nowrap">
                        {date.toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: "UTC",
                          timeZoneName: "short",
                        })}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-right text-foreground tabular-nums">
                        {fmt(rec.targetPrice)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-right text-foreground tabular-nums">
                        {formatICP(rec.tokensSold)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-right text-foreground tabular-nums">
                        {fmt(rec.saleValue)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-right text-muted-foreground tabular-nums">
                        {formatICP(rec.remainingICP)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/30 font-semibold">
                  <td className="px-3 py-2.5 text-xs uppercase tracking-wider text-muted-foreground">
                    Totals
                  </td>
                  <td className="px-3 py-2.5" />
                  <td className="px-3 py-2.5 font-mono text-right text-foreground tabular-nums">
                    {formatICP(execTotals.tokensSold)}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-right text-foreground tabular-nums">
                    {fmt(execTotals.saleValue)}
                  </td>
                  <td className="px-3 py-2.5 font-mono text-right text-muted-foreground tabular-nums">
                    {finalRemainingICP !== null
                      ? formatICP(finalRemainingICP)
                      : "—"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
