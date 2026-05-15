import {
  formatCurrency,
  formatCurrencyShort,
  getCurrencySymbol,
} from "@/context/CurrencyContext";
import { useInvestedAmount, useSaveInvestedAmount } from "@/hooks/useQueries";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface InvestmentTrackerProps {
  icpAmount: number;
  livePrice: number;
  priceAvailable?: boolean;
  currency?: string;
  rates?: Record<string, number>;
  refreshInterval?: number;
}

export function InvestmentTracker({
  icpAmount,
  livePrice,
  priceAvailable = true,
  currency = "USD",
  rates = {},
  refreshInterval = 60_000,
}: InvestmentTrackerProps) {
  const fmt = (v: number) => formatCurrency(v, currency, rates);
  const fmtShort = (v: number) => formatCurrencyShort(v, currency, rates);
  const fmtUSD = (v: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(v);
  const fmtUSDShort = (v: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(v);
  const sym = getCurrencySymbol(currency);
  const showDual = currency !== "USD";
  const { data: savedAmount, isLoading } = useInvestedAmount(refreshInterval);
  const { mutate: saveAmount, isPending } = useSaveInvestedAmount();

  const [inputValue, setInputValue] = useState("");
  const [invested, setInvested] = useState(0);

  // Hydrate from backend
  useEffect(() => {
    if (savedAmount !== undefined && savedAmount > 0) {
      setInvested(savedAmount);
      setInputValue(
        savedAmount.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
      );
    }
  }, [savedAmount]);

  const currentValue =
    icpAmount > 0 && livePrice > 0 ? icpAmount * livePrice : 0;
  const gainLoss = currentValue - invested;
  const hasData = invested > 0;
  const breakEvenPrice =
    invested > 0 && icpAmount > 0 ? invested / icpAmount : null;

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    const stripped = val.replace(/,/g, "");
    if (stripped === "" || /^\d*\.?\d*$/.test(stripped)) {
      setInputValue(val);
      const num = Number.parseFloat(stripped);
      if (!Number.isNaN(num) && num >= 0) {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          saveAmount(num, {
            onSuccess: () => setInvested(num),
            onError: () =>
              toast.error("Failed to save invested amount", {
                description: "Please try again.",
              }),
          });
        }, 800);
      }
    }
  }

  const gainLossColor =
    !hasData || currentValue === 0
      ? "text-muted-foreground"
      : gainLoss > 0
        ? "text-emerald-400"
        : gainLoss < 0
          ? "text-destructive"
          : "text-muted-foreground";

  const InvestedInput = (
    <div className="relative">
      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none select-none font-mono">
        {sym}
      </span>
      <input
        type="text"
        inputMode="decimal"
        placeholder="0.00"
        value={inputValue}
        onChange={handleInputChange}
        className="input-field pl-7 pr-8 w-full"
        aria-label="Invested Amount"
        data-ocid="investment_tracker.input"
      />
      {isPending && (
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground animate-spin" />
      )}
    </div>
  );

  return (
    <div
      className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full"
      data-ocid="investment_tracker.section"
    >
      {/* Card 1: ICP Holdings */}
      <div
        className="card-metric space-y-3"
        data-ocid="investment_tracker.holdings_card"
      >
        <span className="text-sm-metric block">ICP Holdings</span>
        {isLoading ? (
          <div className="h-7 w-full bg-muted rounded animate-pulse" />
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                Token Balance
              </span>
              <span
                className="font-mono text-sm font-semibold text-foreground tabular-nums"
                data-ocid="investment_tracker.icp_amount.value"
              >
                {icpAmount > 0
                  ? icpAmount.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  : "\u2014"}{" "}
                ICP
              </span>
            </div>
            {livePrice > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                  Live Price
                </span>
                <div className="text-right">
                  <span className="font-mono text-xs text-accent tabular-nums block">
                    {fmtShort(livePrice)}/ICP
                  </span>
                  {showDual && (
                    <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                      {fmtUSDShort(livePrice)} USD
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Card 2: Portfolio Value */}
      <div
        className="card-metric border-accent/25 bg-accent/5 space-y-3"
        data-ocid="investment_tracker.portfolio_card"
      >
        <span className="text-sm-metric block">Portfolio Value</span>
        {isLoading ? (
          <div className="h-10 w-full bg-muted rounded animate-pulse" />
        ) : (
          <div className="space-y-1.5">
            <div>
              <span
                className="font-mono text-2xl font-bold text-accent tabular-nums block"
                data-ocid="investment_tracker.current.value"
              >
                {currentValue > 0 ? fmt(currentValue) : "\u2014"}
              </span>
              {showDual && currentValue > 0 && (
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  {fmtUSD(currentValue)} USD
                </span>
              )}
            </div>
            {currentValue > 0 && invested > 0 && (
              <span className="text-xs text-muted-foreground">
                Invested: {fmt(invested)}
                {showDual && (
                  <span className="text-[10px] text-muted-foreground/70 ml-1">
                    ({fmtUSD(invested)} USD)
                  </span>
                )}
              </span>
            )}
            {currentValue === 0 && (
              <p className="text-xs text-muted-foreground">
                Enter your ICP amount to see portfolio value.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Card 3: Gain / Loss */}
      <div
        className="card-metric space-y-3"
        data-ocid="investment_tracker.gainloss_card"
      >
        <span className="text-sm-metric block">Gain / Loss</span>
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-8 w-full bg-muted rounded animate-pulse" />
            <div className="h-5 w-3/4 bg-muted rounded animate-pulse" />
          </div>
        ) : hasData && currentValue > 0 ? (
          <div className="space-y-2">
            <div>
              <span
                className={`font-mono text-2xl font-bold tabular-nums block ${gainLossColor}`}
                data-ocid="investment_tracker.gainloss.value"
              >
                {gainLoss > 0 ? "+" : ""}
                {fmt(gainLoss)}
              </span>
              {showDual && (
                <span
                  className={`font-mono text-xs tabular-nums ${gainLossColor} opacity-70`}
                >
                  {gainLoss > 0 ? "+" : ""}
                  {fmtUSD(gainLoss)} USD
                </span>
              )}
            </div>
            {InvestedInput}
            {breakEvenPrice !== null && priceAvailable && (
              <div className="flex items-center justify-between border-t border-border/50 pt-1">
                <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                  Avg. Entry
                </span>
                <div className="text-right">
                  <span
                    className="font-mono text-sm font-semibold text-muted-foreground tabular-nums block"
                    data-ocid="investment_tracker.breakeven.value"
                  >
                    {fmtShort(breakEvenPrice)}
                  </span>
                  {showDual && (
                    <span className="font-mono text-[10px] text-muted-foreground/60 tabular-nums">
                      {fmtUSDShort(breakEvenPrice)} USD
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {InvestedInput}
            <p
              className="text-xs text-muted-foreground"
              data-ocid="investment_tracker.empty_state"
            >
              Enter your invested {currency} amount above.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
