import { AboutTab } from "@/components/AboutTab";
import { AdminTab } from "@/components/AdminTab";
import { ExitStrategy } from "@/components/ExitStrategy";
import { FearGreedGauge } from "@/components/FearGreedGauge";
import { HistoryTable } from "@/components/HistoryTable";
import { ICPCommunityChat } from "@/components/ICPCommunityChat";
import { ICPNews } from "@/components/ICPNews";
import { InvestmentTracker } from "@/components/InvestmentTracker";
import { LoginScreen } from "@/components/LoginScreen";
import { PriceVolumeChart } from "@/components/PriceVolumeChart";
import { SettingsPanel } from "@/components/SettingsPanel";
import { SocialTrending } from "@/components/SocialTrending";
import { Toaster } from "@/components/ui/sonner";
import {
  formatCurrency,
  formatCurrencyShort,
  getCurrencySymbol,
} from "@/context/CurrencyContext";
import {
  useBackendActor,
  useCanisterStopped,
  useChatMessages,
  useCyclesBalance,
  useExchangeRates,
  useFearGreed,
  useICP24hStats,
  useICPNews,
  useICPPrice,
  useIsAdmin,
  useMarketChart,
  useMarketHistory,
  usePortfolioRecord,
  usePriceTargets,
  useSavePortfolioRecord,
  useUserSettings,
} from "@/hooks/useQueries";
import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  MessageSquare,
  RefreshCw,
  TrendingUp,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const INTERVAL_OPTIONS = [
  { label: "30 seconds", value: 30_000 },
  { label: "1 minute", value: 60_000 },
  { label: "2 minutes", value: 120_000 },
  { label: "5 minutes", value: 300_000 },
];

function getStoredInterval(): number {
  const stored = localStorage.getItem("refreshInterval");
  if (stored) {
    const parsed = Number(stored);
    if (INTERVAL_OPTIONS.some((o) => o.value === parsed)) return parsed;
  }
  return 60_000;
}

function formatTimestamp(ns: bigint): string {
  const ms = Number(ns / 1_000_000n);
  return new Date(ms).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatLastUpdated(ns: bigint): string {
  const ms = Number(ns / 1_000_000n);
  const diffMs = Date.now() - ms;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return new Date(ms).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function CountdownBar({
  interval,
  resetKey,
}: { interval: number; resetKey: number }) {
  const [remaining, setRemaining] = useState(interval);
  const startRef = useRef(Date.now());

  // Reset the bar whenever the parent signals a fresh fetch (resetKey changes)
  // biome-ignore lint/correctness/useExhaustiveDependencies: resetKey is intentionally used to restart the countdown
  useEffect(() => {
    startRef.current = Date.now();
    setRemaining(interval);
  }, [resetKey, interval]);

  useEffect(() => {
    const id = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      const left = Math.max(0, interval - elapsed);
      setRemaining(left);
      if (left === 0) {
        startRef.current = Date.now();
        setRemaining(interval);
      }
    }, 250);
    return () => clearInterval(id);
  }, [interval]);

  const secs = Math.ceil(remaining / 1000);
  const pct = (remaining / interval) * 100;

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <RefreshCw
        className="w-3 h-3 animate-spin"
        style={{ animationDuration: `${interval / 1000}s` }}
      />
      <span>Auto-refreshing in {secs}s…</span>
      <div className="flex-1 h-0.5 bg-border rounded-full overflow-hidden min-w-[60px]">
        <div
          className="h-full bg-accent rounded-full transition-all duration-250"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function App() {
  const { isAuthenticated, isInitializing, identity, clear } =
    useInternetIdentity();
  const queryClient = useQueryClient();
  const principalStr = identity?.getPrincipal().toString() ?? null;
  const [activeTab, setActiveTab] = useState<
    "tracker" | "exit" | "chat" | "news" | "history" | "about" | "admin"
  >("tracker");
  const [refreshInterval, setRefreshInterval] =
    useState<number>(getStoredInterval);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const lastSeenChatCountRef = useRef(0);

  // Listen for interval changes from SettingsPanel
  useEffect(() => {
    function onIntervalChange() {
      setRefreshInterval(getStoredInterval());
    }
    window.addEventListener("refreshIntervalChanged", onIntervalChange);
    return () =>
      window.removeEventListener("refreshIntervalChanged", onIntervalChange);
  }, []);

  const handleLogout = () => {
    clear();
    queryClient.clear();
  };

  // ── Canister stopped banner ────────────────────────────────────────────────
  const isCanisterStopped = useCanisterStopped();
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const prevCanisterStopped = useRef(false);

  // Re-show banner when canister goes stopped again after dismissal
  useEffect(() => {
    if (isCanisterStopped && !prevCanisterStopped.current) {
      setBannerDismissed(false);
    }
    if (!isCanisterStopped && prevCanisterStopped.current) {
      // Service just came back — show success toast then dismiss
      setBannerDismissed(true);
      toast.success("Service restored — reloading your data", {
        duration: 4000,
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
      });
    }
    prevCanisterStopped.current = isCanisterStopped;
  }, [isCanisterStopped]);

  const showBanner = isCanisterStopped && !bannerDismissed;
  // ── / Canister stopped banner ───────────────────────────────────────────────

  // ── Low cycles warning bar ───────────────────────────────────────────────
  const { data: cyclesBalance } = useCyclesBalance();
  const [cyclesDismissed, setCyclesDismissed] = useState<boolean>(() => {
    return sessionStorage.getItem("cyclesWarningDismissed") === "1";
  });
  const handleDismissCycles = () => {
    sessionStorage.setItem("cyclesWarningDismissed", "1");
    setCyclesDismissed(true);
  };
  // Show when: balance is 0 (stub/unknown) OR canister was recently stopped.
  // Only show to authenticated users.
  const showCyclesWarning =
    isAuthenticated &&
    !cyclesDismissed &&
    (cyclesBalance === 0n || (cyclesBalance === null && isCanisterStopped));
  // ── / Low cycles warning bar ─────────────────────────────────────────────

  const {
    data: price,
    isLoading,
    isError,
    refetch,
    isFetching,
    dataUpdatedAt,
  } = useICPPrice(refreshInterval);
  const { data: fearGreed } = useFearGreed(refreshInterval);
  const { data: stats24h } = useICP24hStats(refreshInterval);
  // Keep market hooks synced too (PriceVolumeChart and HistoryTable use their own hook calls,
  // but we call here to keep query cache in sync with the global interval)
  useMarketChart(7n, refreshInterval);
  useMarketHistory(refreshInterval);
  const { actor, isReady: isActorReady } = useBackendActor();
  const isActorFetching = !isActorReady;

  // Eagerly prefetch exit-strategy data AND news so both tabs are ready before clicked
  usePriceTargets(refreshInterval);
  // Eagerly prefetch ICP news in background so the tab is populated before first click
  useICPNews(refreshInterval);

  // Portfolio record — icpAmount lives here now (unified with investedAmount + priceTargets)
  const { data: portfolioRecord, isLoading: isPortfolioLoading } =
    usePortfolioRecord(refreshInterval);
  const { mutate: savePortfolioRecord } = useSavePortfolioRecord();

  const [icpAmount, setIcpAmount] = useState<string>("");
  const [displayAmount, setDisplayAmount] = useState<string>("");
  const [isAmountLoading, setIsAmountLoading] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasMountedRef = useRef(false);

  // Load & apply persisted theme from user settings
  const { data: userSettings } = useUserSettings(refreshInterval);
  const { data: isAdmin } = useIsAdmin();
  const { data: chatMessages } = useChatMessages(20, 0);

  // Track unread chat messages when not on the chat tab
  // biome-ignore lint/correctness/useExhaustiveDependencies: lastSeenChatCountRef is a ref
  useEffect(() => {
    const count = chatMessages?.length ?? 0;
    if (activeTab !== "chat" && count > lastSeenChatCountRef.current) {
      setUnreadChatCount(count - lastSeenChatCountRef.current);
    }
  }, [chatMessages, activeTab]);
  useEffect(() => {
    if (userSettings?.theme) {
      if (userSettings.theme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
  }, [userSettings?.theme]);

  // Base currency: initialized from saved settings, updated when user changes in SettingsPanel
  const [baseCurrency, setBaseCurrency] = useState<string>("USD");
  // Sync baseCurrency when settings load
  useEffect(() => {
    if (userSettings?.baseCurrency) {
      setBaseCurrency(userSettings.baseCurrency);
    }
  }, [userSettings?.baseCurrency]);

  // Listen for currency changes dispatched by SettingsPanel
  useEffect(() => {
    function onCurrencyChange(e: Event) {
      const detail = (e as CustomEvent<{ currency: string }>).detail;
      if (detail?.currency) setBaseCurrency(detail.currency);
    }
    window.addEventListener("currencyChanged", onCurrencyChange);
    return () =>
      window.removeEventListener("currencyChanged", onCurrencyChange);
  }, []);

  const { data: exchangeRates = {} } = useExchangeRates(baseCurrency);

  // Convenience formatter bound to the active currency
  const fmt = (v: number) => formatCurrency(v, baseCurrency, exchangeRates);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _fmtShort = (v: number) =>
    formatCurrencyShort(v, baseCurrency, exchangeRates);
  const currencySymbol = getCurrencySymbol(baseCurrency);

  // Reset on auth change
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional reset when identity changes
  useEffect(() => {
    hasMountedRef.current = false;
    setIcpAmount("");
    setDisplayAmount("");
    setIsAmountLoading(true);
  }, [principalStr]);

  // Safety timeout: if actor never resolves within 5s, stop blocking the input
  useEffect(() => {
    if (!isAmountLoading) return;
    const timer = setTimeout(() => {
      setIsAmountLoading(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, [isAmountLoading]);

  // If actor never becomes ready (no session), clear loading state
  useEffect(() => {
    if (!isActorFetching && !actor) setIsAmountLoading(false);
  }, [isActorFetching, actor]);

  // Hydrate icpAmount from portfolio record (replaces direct actor.getICPAmount call)

  useEffect(() => {
    if (hasMountedRef.current) return;
    if (isPortfolioLoading) return; // still loading
    const saved =
      typeof portfolioRecord?.icpAmount === "number"
        ? portfolioRecord.icpAmount
        : 0;
    hasMountedRef.current = true;
    const raw = saved > 0 ? String(saved) : "";
    setIcpAmount(raw);
    setDisplayAmount(
      saved > 0
        ? saved.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : "",
    );
    setIsAmountLoading(false);
  }, [portfolioRecord, isPortfolioLoading]);

  const saveAmount = useCallback(
    (val: string) => {
      const num = Number.parseFloat(val);
      if (Number.isNaN(num) || num < 0) return;
      // Read the current portfolio record from cache so we keep investedAmount and priceTargets intact
      const cached =
        queryClient.getQueryData<import("@/backend").PortfolioRecord>([
          "portfolioRecord",
          principalStr,
        ]) ??
        queryClient.getQueryData<import("@/backend").PortfolioRecord>([
          "portfolioRecord",
          null,
        ]);
      savePortfolioRecord({
        icpAmount: num,
        investedAmount: cached?.investedAmount ?? 0,
        priceTargets: cached?.priceTargets ?? [],
      });
    },
    [savePortfolioRecord, queryClient, principalStr],
  );

  const parsedAmount = Number.parseFloat(icpAmount) || 0;
  const portfolioValue = price ? parsedAmount * price.priceUSD : null;

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // Strip commas so validation works on raw input
    const stripped = val.replace(/,/g, "");
    if (stripped === "" || /^\d*\.?\d*$/.test(stripped)) {
      setIcpAmount(stripped);
      setDisplayAmount(val);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => saveAmount(stripped), 800);
    }
  };

  const handleAmountFocus = () => {
    // Show raw number while editing
    setDisplayAmount(icpAmount);
  };

  const handleAmountBlur = () => {
    const num = Number.parseFloat(icpAmount);
    if (!Number.isNaN(num) && icpAmount !== "") {
      setDisplayAmount(
        num.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }),
      );
    } else {
      setDisplayAmount(icpAmount);
    }
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/20 border border-accent/30 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-accent" />
          </div>
          <div className="h-2 w-32 bg-muted rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  const abbrevPrincipal = principalStr
    ? `${principalStr.slice(0, 5)}\u2026${principalStr.slice(-4)}`
    : null;

  const tabs: {
    id: "tracker" | "exit" | "chat" | "news" | "history" | "about" | "admin";
    label: string;
  }[] = [
    { id: "tracker", label: "Value Tracker" },
    { id: "exit", label: "Exit Strategy" },
    { id: "chat", label: "Community Chat" },
    { id: "news", label: "ICP News" },
    { id: "history", label: "Historical Data" },
    { id: "about", label: "About" },
    ...(isAdmin ? [{ id: "admin" as const, label: "Admin" }] : []),
  ];

  return (
    <div
      className="min-h-screen bg-background flex flex-col"
      data-ocid="app.page"
    >
      {/* Header */}
      <header className="relative bg-card border-b border-border px-6 py-4 shadow-subtle">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-accent/20 border border-accent/30 flex items-center justify-center">
              <TrendingUp className="w-4 h-4 text-accent" />
            </div>
            <span className="font-display font-semibold text-foreground tracking-tight">
              ICP Nexus
            </span>
            {baseCurrency !== "USD" && (
              <span
                className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider bg-primary/15 text-primary border border-primary/30 rounded px-1.5 py-0.5"
                title={`Displaying values in ${baseCurrency}`}
                data-ocid="header.currency_badge"
              >
                {currencySymbol} {baseCurrency}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${
                  isLoading || isFetching
                    ? "bg-amber-400 animate-pulse"
                    : isError && price
                      ? "bg-amber-400"
                      : isError
                        ? "bg-destructive"
                        : price?.isStale
                          ? "bg-amber-400"
                          : "bg-emerald-400"
                }`}
              />
              <span className="text-xs text-muted-foreground hidden sm:inline">
                {isLoading || isFetching
                  ? "Fetching\u2026"
                  : isError && price
                    ? "Last Known"
                    : isError
                      ? "Unavailable"
                      : price?.isStale
                        ? "Stale"
                        : "Live"}
              </span>
            </div>
            {abbrevPrincipal && (
              <span
                className="hidden sm:inline text-xs font-mono bg-muted px-2 py-1 rounded border border-border text-muted-foreground"
                title={principalStr ?? undefined}
                data-ocid="header.principal"
              >
                {abbrevPrincipal}
              </span>
            )}
            <SettingsPanel />
            <button
              type="button"
              onClick={handleLogout}
              className="text-xs px-3 py-1.5 rounded-md border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-smooth"
              data-ocid="header.logout_button"
            >
              Log out
            </button>
          </div>
        </div>
        {/* Beta pill — top-right corner of header */}
        <span
          className="absolute top-2 right-3 inline-flex items-center rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white shadow-sm"
          data-ocid="header.beta_badge"
        >
          beta
        </span>
      </header>

      {/* Low cycles warning bar — shown above the canister-stopped banner */}
      <AnimatePresence>
        {showCyclesWarning && (
          <motion.div
            key="cycles-warning"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="relative bg-yellow-400/15 border-b border-yellow-400/40 px-6 py-2.5"
            data-ocid="cycles_warning.banner"
            aria-live="polite"
          >
            <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
              <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-wrap">
                <span
                  className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5 sm:mt-0"
                  aria-hidden="true"
                >
                  ⚠️
                </span>
                <p className="text-xs text-yellow-800 dark:text-yellow-300 leading-relaxed">
                  <span className="font-semibold">
                    Canister cycles may be running low
                  </span>
                  {" — this can cause the service to stop. "}
                  <a
                    href="https://nns.ic0.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 hover:text-yellow-900 dark:hover:text-yellow-100 transition-colors duration-150 font-medium"
                    data-ocid="cycles_warning.nns_link"
                  >
                    Top up via NNS app
                  </a>
                  {" to keep it running."}
                  <span className="hidden sm:inline text-yellow-700/70 dark:text-yellow-400/70">
                    {" Canister ID: "}
                    <button
                      type="button"
                      className="font-mono text-[11px] bg-yellow-300/30 dark:bg-yellow-500/20 px-1 py-0.5 rounded cursor-pointer hover:bg-yellow-300/50 dark:hover:bg-yellow-500/30 transition-colors duration-150 select-all"
                      title="Click to copy canister ID"
                      data-ocid="cycles_warning.canister_id"
                      onClick={() => {
                        navigator.clipboard
                          .writeText("7542p-siaaa-aaaab-qbyxq-cai")
                          .then(() => {
                            toast.success("Canister ID copied!", {
                              duration: 2000,
                            });
                          });
                      }}
                    >
                      7542p-siaaa-aaaab-qbyxq-cai
                    </button>
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={handleDismissCycles}
                className="flex-shrink-0 p-1 rounded-md text-yellow-700/70 dark:text-yellow-400/70 hover:text-yellow-900 dark:hover:text-yellow-200 hover:bg-yellow-400/20 transition-colors duration-150"
                aria-label="Dismiss cycles warning"
                data-ocid="cycles_warning.close_button"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Canister stopped banner */}
      <AnimatePresence>
        {showBanner && (
          <motion.div
            key="canister-banner"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="relative bg-amber-500/15 border-b border-amber-500/30 px-6 py-3"
            data-ocid="canister_stopped.banner"
            role="alert"
            aria-live="polite"
          >
            <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {/* Pulsing amber dot */}
                <span className="relative flex-shrink-0">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-60 animate-ping" />
                  <AlertTriangle className="relative w-4 h-4 text-amber-500" />
                </span>
                <p className="text-sm font-medium text-amber-700 dark:text-amber-300 leading-snug">
                  Service temporarily unavailable
                  <span className="hidden sm:inline text-amber-600/80 dark:text-amber-400/80 font-normal">
                    {" "}
                    — your data will reload automatically when the service
                    restores.
                  </span>
                </p>
                {/* Animated retry indicator */}
                <span className="hidden md:flex items-center gap-1.5 text-xs text-amber-600/70 dark:text-amber-400/70 flex-shrink-0">
                  <RefreshCw
                    className="w-3 h-3 animate-spin"
                    style={{ animationDuration: "2s" }}
                  />
                  Retrying…
                </span>
              </div>
              <button
                type="button"
                onClick={() => setBannerDismissed(true)}
                className="flex-shrink-0 p-1 rounded-md text-amber-600/70 dark:text-amber-400/70 hover:text-amber-700 dark:hover:text-amber-300 hover:bg-amber-500/20 transition-colors duration-150"
                aria-label="Dismiss service unavailable banner"
                data-ocid="canister_stopped.close_button"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tab navigation */}
      <div className="bg-card border-b border-border px-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex gap-1" role="tablist" data-ocid="tabs.nav">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => {
                  if (tab.id === "chat") {
                    setUnreadChatCount(0);
                    lastSeenChatCountRef.current = chatMessages?.length ?? 0;
                  }
                  setActiveTab(tab.id);
                }}
                className={`relative px-4 py-3.5 text-sm font-medium transition-smooth whitespace-nowrap ${
                  activeTab === tab.id
                    ? "text-accent"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                data-ocid={`tabs.${tab.id}.tab`}
              >
                <span className="flex items-center gap-1.5">
                  {tab.label}
                  {tab.id === "chat" && unreadChatCount > 0 && (
                    <span
                      className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-orange-500 text-white text-[10px] font-bold leading-none"
                      data-ocid="tabs.chat.unread_badge"
                    >
                      {unreadChatCount > 99 ? "99+" : unreadChatCount}
                    </span>
                  )}
                </span>
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent rounded-t-full" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 px-4 py-8">
        {/* All tab panels are always mounted so queries fire immediately on load.
            Visibility is toggled with CSS hidden to avoid lazy-load delays. */}
        <AnimatePresence mode="wait">
          {/* Tab 1: Value Tracker */}
          <motion.div
            key="tracker"
            initial={activeTab === "tracker" ? { opacity: 0, y: 10 } : false}
            animate={{ opacity: activeTab === "tracker" ? 1 : 0, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className={`max-w-5xl mx-auto space-y-5 ${activeTab !== "tracker" ? "hidden" : ""}`}
            data-ocid="tracker.section"
          >
            {/* Row 1: Input + Price + Portfolio — side by side on md+ */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* ICP Amount input */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.0 }}
                className="card-metric space-y-3"
                data-ocid="calculator.card"
              >
                <label htmlFor="icp-amount" className="text-sm-metric block">
                  Enter ICP Amount
                </label>
                {isAmountLoading ? (
                  <div
                    className="h-10 w-full bg-muted rounded animate-pulse"
                    data-ocid="calculator.loading_state"
                  />
                ) : (
                  <input
                    id="icp-amount"
                    type="text"
                    inputMode="decimal"
                    placeholder="e.g., 250"
                    value={displayAmount}
                    onChange={handleAmountChange}
                    onFocus={handleAmountFocus}
                    onBlur={handleAmountBlur}
                    className="input-field"
                    data-ocid="calculator.input"
                  />
                )}
                {parsedAmount > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {parsedAmount.toLocaleString()} ICP
                  </p>
                )}
              </motion.div>

              {/* Live price card */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.08 }}
                className="card-metric space-y-2"
                data-ocid="price.card"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm-metric">Live ICP Price</span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider bg-accent/20 text-accent border border-accent/30 rounded px-1.5 py-0.5">
                      <Activity className="w-2.5 h-2.5" /> LIVE
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => refetch()}
                    disabled={isFetching}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-accent transition-smooth disabled:opacity-50"
                    data-ocid="price.refresh_button"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`}
                    />
                  </button>
                </div>
                <AnimatePresence mode="wait">
                  {isLoading && !price && (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <div
                        className="h-10 w-32 bg-muted rounded animate-pulse"
                        data-ocid="price.loading_state"
                      />
                    </motion.div>
                  )}
                  {/* No price at all: show inline notice, never block other data */}
                  {!price && !isLoading && (
                    <motion.div
                      key="no-price"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <p
                        className="text-muted-foreground text-sm"
                        data-ocid="price.error_state"
                      >
                        Fetching price…
                      </p>
                      <p className="text-xs text-amber-500/80 mt-0.5">
                        Retrying every 15s
                      </p>
                    </motion.div>
                  )}
                  {price && (
                    <motion.div
                      key="price"
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      <div className="flex items-baseline gap-2">
                        <div
                          className="font-mono text-2xl font-bold text-accent tabular-nums"
                          data-ocid="price.value"
                        >
                          {fmt(price.priceUSD)}
                        </div>
                        {(price.isStale || isError) && (
                          <span className="text-[10px] font-medium text-amber-500/80 uppercase tracking-wide">
                            {isError ? "last known" : "cached"}
                          </span>
                        )}
                      </div>
                      {/* 24h High / Low */}
                      <div
                        className="flex items-center gap-3 mt-2"
                        data-ocid="price.24h_stats"
                      >
                        {stats24h ? (
                          <>
                            <span className="flex items-center gap-0.5 text-xs font-mono tabular-nums text-emerald-400">
                              <ArrowUp className="w-3 h-3" />
                              {fmt(stats24h.high)}
                              {stats24h.isStale && (
                                <span className="text-[9px] text-muted-foreground/60 ml-0.5">
                                  (stale)
                                </span>
                              )}
                            </span>
                            <span className="text-border/60 text-xs">|</span>
                            <span className="flex items-center gap-0.5 text-xs font-mono tabular-nums text-destructive">
                              <ArrowDown className="w-3 h-3" />
                              {fmt(stats24h.low)}
                            </span>
                          </>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div
                              className="h-4 w-16 bg-muted rounded animate-pulse"
                              data-ocid="price.24h_high.loading_state"
                            />
                            <div
                              className="h-4 w-16 bg-muted rounded animate-pulse"
                              data-ocid="price.24h_low.loading_state"
                            />
                          </div>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground mt-1">
                        {isError
                          ? `Last known: ${formatLastUpdated(price.fetchedAt)}`
                          : price.isStale
                            ? `Last updated: ${formatLastUpdated(price.fetchedAt)}`
                            : formatTimestamp(price.fetchedAt)}
                      </p>
                      <p className="text-[11px] text-muted-foreground/70 mt-0.5 italic">
                        {isError
                          ? "live feed unavailable \u2014 retrying\u2026"
                          : price.isStale || price.source === "cached"
                            ? "using cached price"
                            : `via ${price.source}`}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Portfolio value card */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.16 }}
                className="card-metric border-accent/25 bg-accent/5 space-y-2"
                data-ocid="portfolio.card"
              >
                <span className="text-sm-metric">Total Portfolio Value</span>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={portfolioValue ?? "no-price"}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    {portfolioValue !== null ? (
                      <>
                        <span
                          className="font-mono text-2xl sm:text-3xl font-bold text-accent tabular-nums block"
                          data-ocid="portfolio.value"
                        >
                          {fmt(portfolioValue)}
                        </span>
                        {price && parsedAmount > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {parsedAmount.toLocaleString()} ICP ×{" "}
                            {fmt(price.priceUSD)}
                          </p>
                        )}
                      </>
                    ) : isAmountLoading ? (
                      <div
                        className="h-9 w-40 bg-muted rounded animate-pulse"
                        data-ocid="portfolio.loading_state"
                      />
                    ) : (
                      <span
                        className="font-mono text-2xl sm:text-3xl font-bold text-muted-foreground tabular-nums block"
                        data-ocid="portfolio.value"
                      >
                        --
                      </span>
                    )}
                  </motion.div>
                </AnimatePresence>
              </motion.div>
            </div>

            {/* Row 2: Investment Tracker — full width (has its own 3-col grid internally) */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.22 }}
            >
              <InvestmentTracker
                icpAmount={parsedAmount}
                livePrice={price?.priceUSD ?? 0}
                priceAvailable={!!price}
                currency={baseCurrency}
                rates={exchangeRates}
                refreshInterval={refreshInterval}
              />
            </motion.div>

            {/* Row 3: Fear & Greed + Social Trending — side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
              <motion.div
                className="h-full"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.22 }}
              >
                <FearGreedGauge data={fearGreed ?? null} />
              </motion.div>
              <motion.div
                className="h-full"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.3 }}
              >
                <SocialTrending refetchInterval={refreshInterval} />
              </motion.div>
            </div>

            {/* Row 4: Price/Volume Chart — full width */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.38 }}
            >
              <PriceVolumeChart
                currency={baseCurrency}
                rates={exchangeRates}
                refreshInterval={refreshInterval}
              />
            </motion.div>

            {/* Countdown */}
            {!isLoading && (
              <div className="px-1" data-ocid="countdown.section">
                <CountdownBar
                  interval={refreshInterval}
                  resetKey={dataUpdatedAt}
                />
              </div>
            )}
          </motion.div>

          {/* Tab 2: Exit Strategy — always mounted so query fires immediately */}
          <div
            className={activeTab !== "exit" ? "hidden" : "max-w-5xl mx-auto"}
            data-ocid="exit.section"
          >
            <ExitStrategy
              icpAmount={parsedAmount}
              currency={baseCurrency}
              rates={exchangeRates}
              refreshInterval={refreshInterval}
            />
          </div>

          {/* Tab 3: Community Chat */}
          <div
            className={activeTab !== "chat" ? "hidden" : "max-w-5xl mx-auto"}
            data-ocid="chat.tab.section"
          >
            <ICPCommunityChat />
          </div>

          {/* Tab 4: ICP News — always mounted so HTTP outcall starts on load */}
          <div
            className={activeTab !== "news" ? "hidden" : "max-w-5xl mx-auto"}
            data-ocid="news.tab.section"
          >
            <ICPNews refreshInterval={refreshInterval} />
          </div>

          {/* Tab 5: Historical Data */}
          <div
            className={activeTab !== "history" ? "hidden" : "max-w-5xl mx-auto"}
            data-ocid="history.section"
          >
            <HistoryTable
              currency={baseCurrency}
              rates={exchangeRates}
              refreshInterval={refreshInterval}
            />
          </div>

          {/* Tab 5: About */}
          <div
            className={activeTab !== "about" ? "hidden" : "max-w-5xl mx-auto"}
            data-ocid="about.tab.section"
          >
            <AboutTab />
          </div>

          {/* Tab 6: Admin — only rendered for admins */}
          {isAdmin && (
            <div
              className={activeTab !== "admin" ? "hidden" : "max-w-5xl mx-auto"}
              data-ocid="admin.tab.section"
            >
              <AdminTab />
            </div>
          )}
        </AnimatePresence>
      </main>

      <Toaster richColors position="top-right" />

      {/* Footer */}
      <footer className="bg-card border-t border-border px-6 py-4">
        <div className="max-w-5xl mx-auto text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()}. Built with love using{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(typeof window !== "undefined" ? window.location.hostname : "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline transition-smooth"
          >
            caffeine.ai
          </a>
        </div>
      </footer>
    </div>
  );
}
