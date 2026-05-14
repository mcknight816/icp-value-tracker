import type { ExecutionRecord, PriceTarget } from "@/backend";
import { formatCurrency, getCurrencySymbol } from "@/context/CurrencyContext";
import {
  useICPPrice,
  usePriceTargets,
  useSaveExecutionRecord,
  useSavePriceTargets,
  useUserSettings,
} from "@/hooks/useQueries";
import {
  Activity,
  Bell,
  CheckCircle,
  CheckCircle2,
  Mail,
  MessageSquare,
  Plus,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface ExitRow {
  id: string;
  targetPrice: string;
  tokensToSell: string;
  icpAmount: number;
  notifyViaEmail: boolean;
  notifyViaPhone: boolean;
  triggered: boolean;
  executed?: boolean;
}

function formatNum(value: number, decimals = 4): string {
  if (value === 0) return "0";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function makeDefaultRow(icpAmt = 0): ExitRow {
  return {
    id: makeId(),
    targetPrice: "",
    tokensToSell: "",
    icpAmount: icpAmt,
    notifyViaEmail: false,
    notifyViaPhone: false,
    triggered: false,
  };
}

const DEFAULT_ROWS: ExitRow[] = [
  makeDefaultRow(),
  makeDefaultRow(),
  makeDefaultRow(),
];

function rowToTarget(row: ExitRow): PriceTarget {
  return {
    id: row.id,
    targetPrice: Number.parseFloat(row.targetPrice) || 0,
    tokensToSell: Number.parseFloat(row.tokensToSell) || 0,
    icpAmount: row.icpAmount,
    notifyViaEmail: row.notifyViaEmail,
    notifyViaPhone: row.notifyViaPhone,
    triggered: row.triggered,
  };
}

function targetToRow(t: PriceTarget): ExitRow {
  return {
    id: t.id,
    targetPrice: t.targetPrice > 0 ? String(t.targetPrice) : "",
    tokensToSell: t.tokensToSell > 0 ? String(t.tokensToSell) : "",
    icpAmount: t.icpAmount,
    notifyViaEmail: t.notifyViaEmail ?? false,
    notifyViaPhone: t.notifyViaPhone ?? false,
    triggered: t.triggered,
  };
}

export function ExitStrategy({
  icpAmount,
  currency = "USD",
  rates = {},
  refreshInterval = 60_000,
}: {
  icpAmount: number;
  currency?: string;
  rates?: Record<string, number>;
  refreshInterval?: number;
}) {
  const fmt = (v: number) => formatCurrency(v, currency, rates);
  const fmtUSD = (v: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(v);
  const showDual = currency !== "USD";
  const sym = getCurrencySymbol(currency);
  const { data: price } = useICPPrice(refreshInterval);
  const livePrice = price?.priceUSD ?? null;
  const { data: userSettings } = useUserSettings(refreshInterval);

  const {
    data: backendTargets,
    isLoading,
    isFetching: isTargetsFetching,
    fetchStatus,
    isError: isTargetsError,
    error: targetsError,
  } = usePriceTargets(refreshInterval);
  const { mutate: saveTargets } = useSavePriceTargets();
  const { mutate: saveExecutionRecord, isPending: isExecuting } =
    useSaveExecutionRecord();
  // Track which row IDs are currently being executed (for button loading state)
  const [executingIds, setExecutingIds] = useState<Set<string>>(new Set());

  const [rows, setRows] = useState<ExitRow[]>(DEFAULT_ROWS);
  const initialized = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstChange = useRef(true);

  // Debug log: price and targets state on every render
  console.log("[EXIT STRATEGY] render state", {
    livePrice,
    priceSource: price?.source,
    icpAmount,
    currency,

    backendTargetsCount: backendTargets?.length,
    backendTargets: backendTargets?.map((t) => ({
      id: t.id,
      targetPrice: t.targetPrice,
      tokensToSell: t.tokensToSell,
    })),
    isTargetsFetching,
    fetchStatus,
    isTargetsError,
    targetsError:
      targetsError instanceof Error ? targetsError.message : targetsError,
    initialized: initialized.current,
    rowCount: rows.length,
    rates:
      Object.keys(rates).length > 0
        ? `${Object.keys(rates).length} rates loaded`
        : "no rates",
  });

  // Initialize local state from backend on first successful load.
  // Rules:
  //   - Skip if query is idle (actor not ready — fetchStatus='idle').
  //   - Skip if the first fetch is still in progress (fetchStatus='fetching' AND no data yet).
  //   - Once the real fetch lands (fetchStatus='idle' after success, or non-empty data), apply.
  //   - If backend returns real non-empty targets at any point, always sync (handles late loads).
  useEffect(() => {
    const targets = backendTargets ?? [];
    console.log("[EXIT STRATEGY] init effect", {
      initialized: initialized.current,
      backendTargetsIsArray: Array.isArray(targets),
      backendTargetsLength: targets.length,
      isTargetsFetching,
      fetchStatus,
    });

    if (!Array.isArray(targets)) return;

    // Case 1: query still disabled — do nothing
    if (fetchStatus === "idle" && !initialized.current) {
      console.log(
        "[EXIT STRATEGY] init effect — skipping: query is idle (actor not ready yet)",
      );
      return;
    }

    // Case 2: first fetch still in progress with placeholder empty array — wait
    if (
      fetchStatus === "fetching" &&
      targets.length === 0 &&
      !initialized.current
    ) {
      console.log(
        "[EXIT STRATEGY] init effect — skipping: first fetch in progress, targets empty (placeholder)",
      );
      return;
    }

    // Case 3: real data arrived with actual targets — always sync, even if already initialized
    if (targets.length > 0) {
      console.log(
        "[EXIT STRATEGY] init effect — syncing rows from backend (targets arrived)",
        targets.map((t) => ({
          id: t.id,
          targetPrice: t.targetPrice,
          tokensToSell: t.tokensToSell,
        })),
      );
      initialized.current = true;
      isFirstChange.current = true;
      setRows(targets.map(targetToRow));
      return;
    }

    // Case 4: fetch completed with genuinely empty targets — init once with DEFAULT_ROWS
    if (!initialized.current && !isTargetsFetching) {
      console.log(
        "[EXIT STRATEGY] init effect — backend returned empty targets, keeping DEFAULT_ROWS",
      );
      initialized.current = true;
      isFirstChange.current = true;
    }
  }, [backendTargets, isTargetsFetching, fetchStatus]);

  // Debounce-save to backend on row changes
  useEffect(() => {
    if (isFirstChange.current) {
      isFirstChange.current = false;
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      saveTargets(rows.map(rowToTarget));
    }, 800);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [rows, saveTargets]);

  function executeRow(rowId: string, rowIndex: number) {
    const row = rows.find((r) => r.id === rowId);
    if (!row || row.executed) return;

    const parsedPrice = Number.parseFloat(row.targetPrice) || 0;
    const parsedTokens = Number.parseFloat(row.tokensToSell) || 0;
    if (parsedPrice <= 0 || parsedTokens <= 0) return;

    // Calculate remainingICP: icpAmount minus all executed tokensSold (including this one)
    const previouslyExecuted = rows
      .filter((r) => r.executed && r.id !== rowId)
      .reduce((sum, r) => sum + (Number.parseFloat(r.tokensToSell) || 0), 0);
    const remaining = Math.max(
      0,
      icpAmount - previouslyExecuted - parsedTokens,
    );

    const record: ExecutionRecord = {
      id: `exec-${Date.now()}-${rowIndex}`,
      targetPrice: parsedPrice,
      tokensSold: parsedTokens,
      saleValue: parsedPrice * parsedTokens,
      executedAt: BigInt(Date.now()) * BigInt(1_000_000),
      remainingICP: remaining,
    };

    setExecutingIds((prev) => new Set(prev).add(rowId));
    saveExecutionRecord(record, {
      onSuccess: () => {
        setRows((prev) =>
          prev.map((r) => (r.id === rowId ? { ...r, executed: true } : r)),
        );
        // Persist the updated executed state to backend
        const updated = rows.map((r) =>
          r.id === rowId ? { ...r, executed: true } : r,
        );
        saveTargets(updated.map(rowToTarget));
        setExecutingIds((prev) => {
          const next = new Set(prev);
          next.delete(rowId);
          return next;
        });
      },
      onError: () => {
        setExecutingIds((prev) => {
          const next = new Set(prev);
          next.delete(rowId);
          return next;
        });
      },
    });
  }

  function addRow() {
    setRows((prev) => [...prev, makeDefaultRow(icpAmount)]);
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function updateNumericField(
    id: string,
    field: "targetPrice" | "tokensToSell",
    raw: string,
  ) {
    if (raw !== "" && !/^\d*\.?\d*$/.test(raw)) return;
    setRows((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, [field]: raw, triggered: false } : r,
      ),
    );
  }

  function updateNotify(
    id: string,
    field: "notifyViaEmail" | "notifyViaPhone",
    value: boolean,
  ) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
    );
  }

  // Compute derived values
  interface RowCalc {
    value: number | null;
    tokensAfter: number | null;
  }

  const calcs: RowCalc[] = [];
  let runningRemaining = icpAmount;

  for (const row of rows) {
    const parsedPrice = Number.parseFloat(row.targetPrice) || 0;
    const parsedTokens = Number.parseFloat(row.tokensToSell) || 0;
    const validPrice = parsedPrice > 0;
    const validTokens = parsedTokens > 0;
    const value = validPrice && validTokens ? parsedPrice * parsedTokens : null;
    const tokensAfter = validTokens ? runningRemaining - parsedTokens : null;
    if (validTokens)
      runningRemaining = Math.max(0, runningRemaining - parsedTokens);
    if (validPrice || validTokens) {
      console.log("[EXIT STRATEGY] row calc", {
        rowId: row.id,
        targetPrice: parsedPrice,
        tokensToSell: parsedTokens,
        calculatedValue: value,
        tokensAfter,
        currency,
        rateForCurrency: rates[currency],
      });
    }
    calcs.push({ value, tokensAfter });
  }

  // Only count un-executed rows toward totals display (executed ones are history)
  const activeRows = rows.filter((r) => !r.executed);

  const totalTokensSold = activeRows.reduce(
    (sum, r) => sum + (Number.parseFloat(r.tokensToSell) || 0),
    0,
  );
  const totalValue = rows.reduce((sum, r, i) => {
    if (r.executed) return sum;
    return sum + (calcs[i]?.value ?? 0);
  }, 0);
  const finalRemaining =
    icpAmount -
    rows.reduce((sum, r) => sum + (Number.parseFloat(r.tokensToSell) || 0), 0);

  // Show skeleton only when the query is ACTIVELY fetching (not when it's idle/disabled).
  // In React Query v5 a disabled query has isLoading=true but fetchStatus='idle'.
  const isReallyLoading =
    (isLoading || isTargetsFetching) &&
    fetchStatus !== "idle" &&
    !initialized.current;
  if (isReallyLoading) {
    return (
      <div className="space-y-4" data-ocid="exit_strategy.section">
        <div className="card-metric space-y-3">
          <div className="h-5 w-48 bg-muted rounded animate-pulse" />
          <div className="h-4 w-64 bg-muted rounded animate-pulse" />
        </div>
        <div
          className="card-metric h-48 flex items-center justify-center"
          data-ocid="exit_strategy.loading_state"
        >
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <div className="w-6 h-6 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            <span className="text-sm">Loading price targets…</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5" data-ocid="exit_strategy.section">
      {/* Reference price banner */}
      <div className="card-metric flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <span className="text-sm-metric block">Exit Strategy Planner</span>
          <p className="text-xs text-muted-foreground">
            Plan your ICP sales at target price levels. Starting position:{" "}
            <span className="font-mono text-foreground font-semibold">
              {icpAmount > 0 ? formatNum(icpAmount) : "\u2014"}
            </span>{" "}
            ICP
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="text-xs text-muted-foreground uppercase tracking-wider">
              Live Price
            </div>
            <div className="font-mono text-lg font-semibold text-accent tabular-nums">
              {livePrice !== null ? (
                fmt(livePrice)
              ) : (
                <span className="text-muted-foreground text-sm">Loading…</span>
              )}
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider bg-accent/20 text-accent border border-accent/30 rounded px-1.5 py-0.5">
            <Activity className="w-2.5 h-2.5" /> LIVE
          </span>
        </div>
      </div>

      {/* Summary bar */}
      {icpAmount > 0 && (
        <div
          className="grid grid-cols-3 gap-3"
          data-ocid="exit_strategy.summary.section"
        >
          <div className="card-metric text-center space-y-1">
            <div className="text-sm-metric">Starting ICP</div>
            <div className="font-mono text-xl font-bold text-foreground tabular-nums">
              {formatNum(icpAmount)}
            </div>
          </div>
          <div className="card-metric text-center space-y-1 border-destructive/30 bg-destructive/5">
            <div className="text-sm-metric">Total to Sell</div>
            <div className="font-mono text-xl font-bold text-destructive tabular-nums">
              {totalTokensSold > 0 ? formatNum(totalTokensSold) : "\u2014"}
            </div>
          </div>
          <div className="card-metric text-center space-y-1 border-accent/30 bg-accent/5">
            <div className="text-sm-metric">Remaining</div>
            <div className="font-mono text-xl font-bold text-accent tabular-nums">
              {icpAmount > 0
                ? formatNum(Math.max(0, finalRemaining))
                : "\u2014"}
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div
        className="card-metric overflow-hidden p-0"
        data-ocid="exit_strategy.table"
      >
        <div className="overflow-auto" style={{ scrollbarWidth: "thin" }}>
          <table className="w-full text-sm min-w-[780px]">
            <thead className="sticky top-0 bg-card border-b border-border z-10">
              <tr>
                <th className="px-3 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground text-center w-8">
                  #
                </th>
                <th className="px-3 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground text-left w-36">
                  Target Price
                </th>
                <th className="px-3 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground text-left w-32">
                  Tokens to Sell
                </th>
                <th className="px-3 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground text-right w-32">
                  Value at Target
                </th>
                <th className="px-3 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground text-right w-28">
                  Remaining ICP
                </th>
                <th className="px-3 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground text-center w-24">
                  Notify
                </th>
                <th className="px-3 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground text-center w-24">
                  Status
                </th>
                <th className="px-3 py-3 w-28 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const calc = calcs[i];
                const hasNotify = row.notifyViaEmail || row.notifyViaPhone;
                return (
                  <tr
                    key={row.id}
                    className={`border-b border-border/50 transition-smooth group ${
                      row.executed
                        ? "bg-accent/5 opacity-75"
                        : row.triggered
                          ? "bg-accent/5"
                          : "hover:bg-muted/20"
                    }`}
                    data-ocid={`exit_strategy.row.${i + 1}`}
                  >
                    {/* # */}
                    <td className="px-3 py-2.5 text-center font-mono text-xs text-muted-foreground">
                      {i + 1}
                    </td>

                    {/* Target Price */}
                    <td className="px-3 py-2">
                      {row.executed ? (
                        <span className="flex flex-col">
                          <span className="font-mono text-sm text-foreground/70 pl-1">
                            {sym}
                            {row.targetPrice}
                          </span>
                          {showDual && (
                            <span className="text-[10px] text-muted-foreground pl-1">
                              {fmtUSD(Number.parseFloat(row.targetPrice) || 0)}{" "}
                              USD
                            </span>
                          )}
                        </span>
                      ) : (
                        <div className="relative flex items-center">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none select-none z-10 font-mono pr-0.5">
                            {sym}
                          </span>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="0.00"
                            value={row.targetPrice}
                            onChange={(e) =>
                              updateNumericField(
                                row.id,
                                "targetPrice",
                                e.target.value,
                              )
                            }
                            className="input-field py-2 pl-6 pr-2 text-sm h-9 w-full"
                            aria-label={`Target price (${currency}) for row ${i + 1}`}
                            data-ocid={`exit_strategy.price_input.${i + 1}`}
                          />
                        </div>
                      )}
                    </td>

                    {/* Tokens to Sell */}
                    <td className="px-3 py-2">
                      {row.executed ? (
                        <span className="font-mono text-sm text-foreground/70 pl-1">
                          {row.tokensToSell}
                        </span>
                      ) : (
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="0"
                          value={row.tokensToSell}
                          onChange={(e) =>
                            updateNumericField(
                              row.id,
                              "tokensToSell",
                              e.target.value,
                            )
                          }
                          className="input-field py-2 text-sm h-9 w-full"
                          aria-label={`Tokens to sell for row ${i + 1}`}
                          data-ocid={`exit_strategy.tokens_input.${i + 1}`}
                        />
                      )}
                    </td>

                    {/* Value at Target */}
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                      {calc.value !== null ? (
                        <span className="flex flex-col items-end">
                          <span className="text-accent font-semibold text-sm">
                            {fmt(calc.value)}
                          </span>
                          {showDual && (
                            <span className="text-[10px] text-muted-foreground">
                              {fmtUSD(calc.value)} USD
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>

                    {/* Remaining ICP */}
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                      {calc.tokensAfter !== null ? (
                        <span
                          className={`text-sm font-semibold ${
                            calc.tokensAfter < 0
                              ? "text-destructive"
                              : calc.tokensAfter === 0
                                ? "text-muted-foreground"
                                : "text-foreground"
                          }`}
                        >
                          {formatNum(Math.max(0, calc.tokensAfter))}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>

                    {/* Notify checkboxes */}
                    <td className="px-3 py-2">
                      <div
                        className={`flex items-center justify-center gap-3 ${row.executed ? "opacity-0 pointer-events-none" : ""}`}
                      >
                        {/* Email */}
                        <label
                          className={`flex items-center gap-1 cursor-pointer select-none ${
                            !userSettings?.email
                              ? "opacity-40 cursor-not-allowed"
                              : ""
                          }`}
                          title={
                            !userSettings?.email
                              ? "Add email in Settings"
                              : "Notify via email"
                          }
                        >
                          <input
                            type="checkbox"
                            checked={row.notifyViaEmail}
                            disabled={!userSettings?.email}
                            onChange={(e) =>
                              updateNotify(
                                row.id,
                                "notifyViaEmail",
                                e.target.checked,
                              )
                            }
                            className="w-3.5 h-3.5 accent-accent"
                            data-ocid={`exit_strategy.notify_email.${i + 1}`}
                          />
                          <Mail className="w-3 h-3 text-muted-foreground" />
                        </label>
                        {/* SMS */}
                        <label
                          className={`flex items-center gap-1 cursor-pointer select-none ${
                            !userSettings?.phone
                              ? "opacity-40 cursor-not-allowed"
                              : ""
                          }`}
                          title={
                            !userSettings?.phone
                              ? "Add phone in Settings"
                              : "Notify via text"
                          }
                        >
                          <input
                            type="checkbox"
                            checked={row.notifyViaPhone}
                            disabled={!userSettings?.phone}
                            onChange={(e) =>
                              updateNotify(
                                row.id,
                                "notifyViaPhone",
                                e.target.checked,
                              )
                            }
                            className="w-3.5 h-3.5 accent-accent"
                            data-ocid={`exit_strategy.notify_phone.${i + 1}`}
                          />
                          <MessageSquare className="w-3 h-3 text-muted-foreground" />
                        </label>
                      </div>
                    </td>

                    {/* Status / Execute */}
                    <td className="px-3 py-2.5 text-center">
                      {row.executed ? (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider bg-accent/20 text-accent border border-accent/30 rounded px-1.5 py-0.5 whitespace-nowrap"
                          data-ocid={`exit_strategy.executed_badge.${i + 1}`}
                        >
                          <CheckCircle className="w-2.5 h-2.5" /> Executed
                        </span>
                      ) : row.triggered ? (
                        <span
                          className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider bg-accent/20 text-accent border border-accent/30 rounded px-1.5 py-0.5 whitespace-nowrap"
                          data-ocid={`exit_strategy.triggered_badge.${i + 1}`}
                        >
                          <CheckCircle2 className="w-2.5 h-2.5" /> Alert Sent
                        </span>
                      ) : hasNotify ? (
                        <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/60 whitespace-nowrap">
                          <Bell className="w-2.5 h-2.5" /> Watching
                        </span>
                      ) : (
                        <span className="text-muted-foreground/30 text-xs">
                          —
                        </span>
                      )}
                    </td>

                    {/* Execute / Delete */}
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        {!row.executed && (
                          <button
                            type="button"
                            onClick={() => executeRow(row.id, i)}
                            disabled={
                              executingIds.has(row.id) ||
                              isExecuting ||
                              !row.targetPrice ||
                              !row.tokensToSell
                            }
                            className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider bg-accent/10 hover:bg-accent/20 text-accent border border-accent/30 hover:border-accent/50 rounded px-1.5 py-0.5 transition-smooth disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                            aria-label={`Mark row ${i + 1} as executed`}
                            data-ocid={`exit_strategy.execute_button.${i + 1}`}
                            title="Mark this target as executed — records the sale"
                          >
                            {executingIds.has(row.id) ? (
                              <span className="w-2.5 h-2.5 rounded-full border border-accent border-t-transparent animate-spin" />
                            ) : (
                              <CheckCircle className="w-2.5 h-2.5" />
                            )}
                            Execute
                          </button>
                        )}
                        {!row.executed && (
                          <button
                            type="button"
                            onClick={() => removeRow(row.id)}
                            className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-destructive transition-smooth rounded"
                            aria-label="Delete row"
                            data-ocid={`exit_strategy.delete_button.${i + 1}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Totals row */}
            <tfoot>
              <tr className="border-t border-border bg-muted/30">
                <td
                  className="px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                  colSpan={2}
                >
                  Totals
                </td>
                <td className="px-3 py-3 font-mono font-bold text-foreground tabular-nums text-sm">
                  {totalTokensSold > 0 ? formatNum(totalTokensSold) : "\u2014"}
                </td>
                <td className="px-3 py-3 font-mono font-bold text-right tabular-nums">
                  {totalValue > 0 ? (
                    <span className="flex flex-col items-end">
                      <span className="text-accent text-sm">
                        {fmt(totalValue)}
                      </span>
                      {showDual && (
                        <span className="text-[10px] text-muted-foreground">
                          {fmtUSD(totalValue)} USD
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </td>
                <td className="px-3 py-3 font-mono font-bold text-right tabular-nums">
                  {icpAmount > 0 ? (
                    <span className="text-accent text-sm">
                      {formatNum(Math.max(0, finalRemaining))} ICP
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Add row button */}
      <button
        type="button"
        onClick={addRow}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-accent border border-dashed border-border hover:border-accent/50 rounded-lg px-4 py-2.5 w-full justify-center transition-smooth"
        data-ocid="exit_strategy.add_button"
      >
        <Plus className="w-4 h-4" />
        Add price target
      </button>

      {/* Current value hint */}
      {livePrice !== null && totalTokensSold > 0 && (
        <div className="card-metric bg-accent/5 border-accent/20 space-y-1">
          <span className="text-sm-metric block">
            Current Value of Planned Sales
          </span>
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-mono text-2xl font-bold text-accent tabular-nums">
              {fmt(livePrice * totalTokensSold)}
            </span>
            {showDual && (
              <span className="text-[10px] text-muted-foreground font-mono">
                {fmtUSD(livePrice * totalTokensSold)} USD
              </span>
            )}
            <span className="text-sm text-muted-foreground">
              if sold now at {fmt(livePrice)}
              {showDual && (
                <span className="text-[10px] text-muted-foreground ml-1">
                  ({fmtUSD(livePrice)} USD)
                </span>
              )}
            </span>
          </div>
          {totalValue > 0 && (
            <p className="text-xs text-muted-foreground">
              vs.{" "}
              <span className="text-foreground font-mono">
                {fmt(totalValue)}
                {showDual && (
                  <span className="text-[10px] text-muted-foreground ml-1">
                    ({fmtUSD(totalValue)} USD)
                  </span>
                )}
              </span>{" "}
              at your target prices —{" "}
              <span
                className={`font-semibold font-mono ${
                  totalValue >= livePrice * totalTokensSold
                    ? "text-accent"
                    : "text-destructive"
                }`}
              >
                {totalValue >= livePrice * totalTokensSold ? "+" : ""}
                {fmt(totalValue - livePrice * totalTokensSold)}
                {showDual && (
                  <span className="text-[10px] font-normal text-muted-foreground ml-1">
                    ({fmtUSD(totalValue - livePrice * totalTokensSold)} USD)
                  </span>
                )}
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
