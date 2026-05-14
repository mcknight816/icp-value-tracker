import { type PortfolioRecord, createActor } from "@/backend";
import type {
  Announcement,
  AnnouncementType,
  Backend,
  ExecutionRecord,
  FearGreedResult,
  ICP24hStats,
  MarketDataPoint,
  NewsItem,
  PriceResult,
  PriceTarget,
  PriceVolumePoint,
  SocialTrendingResult,
  UserSettings,
} from "@/backend";
import { setLanguage } from "@/i18n";
import {
  createActorWithConfig,
  useInternetIdentity,
} from "@caffeineai/core-infrastructure";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

export const FALLBACK_DONATION_ADDRESS =
  "b089c3ed099d1c3501c06fd6855c2152fb542b01e858872ac23269bb12c6f2d1";

/**
 * useBackendActor — bypasses useActor/QueryClient caching issues by managing
 * actor creation directly in component state. Calls createActorWithConfig which
 * reads the real canister ID from env.json at runtime (injected by the platform).
 */
export function useBackendActor(): { actor: Backend | null; isReady: boolean } {
  const { identity } = useInternetIdentity();
  const identityKey = identity?.getPrincipal().toString() ?? "anon";
  const [state, setState] = useState<{
    actor: Backend | null;
    isReady: boolean;
  }>({ actor: null, isReady: false });
  const builtForRef = useRef<string | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: identity is captured via identityKey; retries are managed internally
  useEffect(() => {
    if (builtForRef.current === identityKey && state.actor !== null) return;

    let cancelled = false;
    setState((prev) => ({ ...prev, isReady: false }));

    async function tryInit() {
      const maxAttempts = 30;
      let attempts = 0;

      while (attempts < maxAttempts && !cancelled) {
        attempts++;
        try {
          // Fetch env.json fresh each attempt — platform injects canisterId at runtime
          const envRes = await fetch(`/env.json?_=${Date.now()}`);
          const env = (await envRes.json()) as Record<string, string>;
          const canisterId =
            env.backend_canister_id ||
            env.CANISTER_ID_BACKEND ||
            env.canister_id_backend ||
            "";

          if (!canisterId || canisterId === "" || canisterId === "undefined") {
            console.log(
              `[ACTOR INIT] attempt ${attempts}/${maxAttempts}: canisterId empty, retrying in 1s...`,
            );
            await new Promise((r) => setTimeout(r, 1000));
            continue;
          }

          console.log(
            `[ACTOR INIT] attempt ${attempts}: got canisterId ${canisterId}, creating actor...`,
            { identityKey, hasIdentity: !!identity },
          );
          const actorOptions = identity
            ? { agentOptions: { identity } }
            : undefined;
          const newActor = await createActorWithConfig(
            createActor,
            actorOptions,
          );
          console.log("[ACTOR INIT] actor created successfully", {
            actor: !!newActor,
          });
          if (!cancelled) {
            builtForRef.current = identityKey;
            setState({ actor: newActor as unknown as Backend, isReady: true });
          }
          return;
        } catch (err) {
          console.error(`[ACTOR INIT] attempt ${attempts} failed:`, err);
          if (attempts < maxAttempts && !cancelled) {
            await new Promise((r) => setTimeout(r, 1000));
          }
        }
      }

      if (!cancelled) {
        console.error(
          "[ACTOR INIT] exhausted all attempts — actor remains null",
        );
        setState({ actor: null, isReady: true });
      }
    }

    tryInit();
    return () => {
      cancelled = true;
    };
  }, [identityKey]);

  return state;
}
function isCanisterStoppedError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return (
    msg.includes("IC0508") ||
    msg.includes("canister stopped") ||
    msg.includes("reject_code: 5")
  );
}

// Module-level cache so the last successful price survives query errors
let _lastKnownPrice: PriceResult | null = null;

export function useICPPrice(refetchInterval = 60_000) {
  const { actor, isReady } = useBackendActor();
  const { identity } = useInternetIdentity();
  const principal = identity?.getPrincipal().toString() ?? null;
  console.log("[ACTOR] useICPPrice", {
    actor: !!actor,
    isActorFetching: !isReady,
    principal,
  });
  return useQuery<PriceResult | null>({
    queryKey: ["icpPrice"],
    queryFn: async () => {
      console.log("[QUERY START] useICPPrice", { actor: !!actor, principal });
      if (!actor) {
        console.warn("[QUERY SKIP] useICPPrice — actor not ready");
        return _lastKnownPrice;
      }
      // Kick off market data refresh alongside price fetch
      actor.fetchAndStoreMarketData().catch((e: unknown) => {
        console.warn(
          "[QUERY WARN] useICPPrice fetchAndStoreMarketData side-effect failed",
          e,
        );
      });
      try {
        const result = await actor.getICPPrice();
        console.log("[QUERY RAW] useICPPrice raw result", result);
        if (result.__kind__ === "ok" && result.ok != null) {
          console.log("[QUERY SUCCESS] useICPPrice", {
            source: result.ok.source,
            priceUSD: result.ok.priceUSD,
            isStale: result.ok.isStale,
            fetchedAt: result.ok.fetchedAt?.toString(),
          });
          _lastKnownPrice = result.ok;
          return result.ok;
        }
        console.error("[QUERY ERROR] useICPPrice — backend returned err kind", {
          kind: result.__kind__,
        });
        if (_lastKnownPrice) {
          console.warn("[QUERY WARN] useICPPrice — returning last known price");
          return _lastKnownPrice;
        }
        throw new Error("ICP price unavailable");
      } catch (e) {
        if (isCanisterStoppedError(e)) {
          console.warn(
            "[QUERY WARN] useICPPrice — canister stopped, returning last known price",
          );
          return _lastKnownPrice;
        }
        const msg = e instanceof Error ? e.message : String(e);
        if (
          msg.includes("HTTP outcall") ||
          msg.includes("ICP price unavailable")
        ) {
          console.warn(
            "[QUERY WARN] useICPPrice — fetch failed, returning last known price",
          );
          return _lastKnownPrice;
        }
        console.error("[QUERY ERROR] useICPPrice — exception during fetch", {
          error: e,
          message: msg,
        });
        return _lastKnownPrice;
      }
    },
    enabled: isReady && !!actor,
    refetchInterval,
    retryDelay: 15_000,
    staleTime: 50_000,
    retry: 3,
    placeholderData: (previousData) => previousData ?? null,
  });
}

export function useFearGreed(refetchInterval = 60_000) {
  const { actor, isReady } = useBackendActor();
  return useQuery<FearGreedResult | null>({
    queryKey: ["fearGreed"],
    queryFn: async () => {
      console.log("[QUERY START] useFearGreed", {
        actor: !!actor,
        isActorFetching: !isReady,
      });
      if (!actor) {
        console.warn("[QUERY SKIP] useFearGreed — actor not ready");
        return null;
      }
      try {
        const result = await actor.getCurrentFearGreed();
        console.log("[QUERY SUCCESS] useFearGreed", result);
        return result;
      } catch (e) {
        if (isCanisterStoppedError(e)) {
          console.warn(
            "[QUERY WARN] useFearGreed — canister stopped, returning null",
          );
          return null;
        }
        console.error("[QUERY ERROR] useFearGreed", {
          error: e,
          message: e instanceof Error ? e.message : String(e),
        });
        return null;
      }
    },
    enabled: isReady && !!actor,
    refetchInterval,
    staleTime: 20_000,
    retry: 2,
  });
}

export function useMarketChart(days: bigint, refetchInterval = 60_000) {
  const { actor, isReady } = useBackendActor();
  return useQuery<PriceVolumePoint[]>({
    queryKey: ["marketChart", days.toString()],
    queryFn: async () => {
      console.log("[QUERY START] useMarketChart", {
        days: days.toString(),
        actor: !!actor,
      });
      if (!actor) {
        console.warn("[QUERY SKIP] useMarketChart — actor not ready");
        return [];
      }
      try {
        const result = await actor.getMarketChart(days);
        console.log("[QUERY SUCCESS] useMarketChart", {
          count: result.length,
          firstPoint: result[0],
        });
        return result;
      } catch (e) {
        if (isCanisterStoppedError(e)) {
          console.warn(
            "[QUERY WARN] useMarketChart — canister stopped, returning empty",
          );
          return [];
        }
        console.error("[QUERY ERROR] useMarketChart", {
          error: e,
          message: e instanceof Error ? e.message : String(e),
        });
        return [];
      }
    },
    enabled: isReady && !!actor,
    staleTime: 20_000,
    refetchInterval,
    retry: 2,
  });
}

export function useMarketHistory(refetchInterval = 60_000) {
  const { actor, isReady } = useBackendActor();
  return useQuery<MarketDataPoint[]>({
    queryKey: ["marketHistory"],
    queryFn: async () => {
      console.log("[QUERY START] useMarketHistory", { actor: !!actor });
      if (!actor) {
        console.warn("[QUERY SKIP] useMarketHistory — actor not ready");
        return [];
      }
      try {
        const result = await actor.getMarketHistory();
        console.log("[QUERY SUCCESS] useMarketHistory", {
          count: result.length,
        });
        return result;
      } catch (e) {
        if (isCanisterStoppedError(e)) {
          console.warn(
            "[QUERY WARN] useMarketHistory — canister stopped, returning empty",
          );
          return [];
        }
        console.error("[QUERY ERROR] useMarketHistory", {
          error: e,
          message: e instanceof Error ? e.message : String(e),
        });
        return [];
      }
    },
    enabled: isReady && !!actor,
    staleTime: 20_000,
    refetchInterval,
    retry: 2,
  });
}

// ─── Portfolio Record (unified) ─────────────────────────────────────────────

/**
 * usePortfolioRecord — single source of truth for icpAmount, investedAmount, and priceTargets.
 * All three values are fetched and written together as one atomic backend record.
 */
export function usePortfolioRecord(refetchInterval = 60_000) {
  const { actor } = useBackendActor();
  const { identity } = useInternetIdentity();
  const principal = identity?.getPrincipal().toString() ?? null;
  // CRITICAL: enabled ONLY on actor — never gated on price data or any HTTP outcall result
  const enabled = !!actor;
  return useQuery<PortfolioRecord>({
    queryKey: ["portfolioRecord", principal],
    queryFn: async () => {
      if (!actor) throw new Error("actor not ready");
      try {
        const record = await actor.getPortfolioRecord();
        console.log("[PORTFOLIO] load result", {
          icpAmount: record.icpAmount,
          investedAmount: record.investedAmount,
          priceTargetsCount: record.priceTargets.length,
        });
        return record;
      } catch (e) {
        if (isCanisterStoppedError(e)) {
          console.warn("[PORTFOLIO] canister stopped, returning safe defaults");
          return { icpAmount: 0, investedAmount: 0, priceTargets: [] };
        }
        console.error("[PORTFOLIO] load error", {
          error: e,
          message: e instanceof Error ? e.message : String(e),
        });
        return { icpAmount: 0, investedAmount: 0, priceTargets: [] };
      }
    },
    enabled,
    staleTime: 0,
    refetchInterval,
    retry: 3,
    retryDelay: 1000,
    placeholderData: (previousData) =>
      previousData ?? { icpAmount: 0, investedAmount: 0, priceTargets: [] },
  });
}

/**
 * useSavePortfolioRecord — writes all three values atomically to the backend.
 * Always call this with the complete current state (icpAmount + investedAmount + priceTargets).
 */
export function useSavePortfolioRecord() {
  const { actor } = useBackendActor();
  const queryClient = useQueryClient();
  const { identity } = useInternetIdentity();
  const principal = identity?.getPrincipal().toString() ?? null;
  return useMutation({
    mutationFn: ({
      icpAmount,
      investedAmount,
      priceTargets,
    }: {
      icpAmount: number;
      investedAmount: number;
      priceTargets: PriceTarget[];
    }) => {
      if (!actor)
        throw new Error("Backend not ready — please wait and try again");
      return actor.savePortfolioRecord(
        icpAmount,
        investedAmount,
        priceTargets.map((t) => ({
          ...t,
          notifyViaEmail: t.notifyViaEmail ?? false,
          notifyViaPhone: t.notifyViaPhone ?? false,
        })),
      );
    },
    onSuccess: (_, variables) => {
      queryClient.setQueryData(["portfolioRecord", principal], {
        icpAmount: variables.icpAmount,
        investedAmount: variables.investedAmount,
        priceTargets: variables.priceTargets,
      } satisfies PortfolioRecord);
      queryClient.invalidateQueries({
        queryKey: ["portfolioRecord", principal],
      });
    },
    onError: (e) => {
      console.error("[PORTFOLIO SAVE ERROR]", {
        error: e,
        message: e instanceof Error ? e.message : String(e),
      });
    },
  });
}

/**
 * useICPAmount — reads icpAmount from the unified portfolio record.
 */
/**
 * useICPAmount — selector over usePortfolioRecord cache. No extra backend call.
 */
export function useICPAmount(refetchInterval = 60_000) {
  const { data: portfolio } = usePortfolioRecord(refetchInterval);
  return { data: portfolio?.icpAmount ?? 0 };
}

// ─── Backward-compatible thin wrappers ───────────────────────────────────────

/**
 * usePriceTargets — thin wrapper over usePortfolioRecord.
 * Returns only the priceTargets array. Existing components don't need to change.
 */
/**
 * usePriceTargets — selector over usePortfolioRecord cache. No extra backend call.
 */
export function usePriceTargets(refetchInterval = 60_000) {
  const { actor } = useBackendActor();
  const { identity } = useInternetIdentity();
  const principal = identity?.getPrincipal().toString() ?? null;
  const enabled = !!actor;
  console.log("[ACTOR] usePriceTargets", {
    actor: !!actor,
    principal,
    enabled,
  });
  // Re-use the portfolioRecord query — same cache key, no duplicate call
  return useQuery<PriceTarget[]>({
    queryKey: ["portfolioRecord", principal],
    queryFn: async () => {
      if (!actor) return [];
      try {
        const record = await actor.getPortfolioRecord();
        console.log("[PORTFOLIO] usePriceTargets via portfolioRecord", {
          count: record.priceTargets.length,
        });
        return record as unknown as PriceTarget[];
      } catch (e) {
        console.error("[PORTFOLIO] usePriceTargets error", e);
        return [];
      }
    },
    enabled,
    staleTime: 0,
    refetchInterval,
    retry: 3,
    retryDelay: 1000,
    select: (data) => {
      // data may be a PortfolioRecord or a PriceTarget[] depending on which hook populated cache
      if (Array.isArray(data)) return data;
      const rec = data as unknown as PortfolioRecord;
      return rec?.priceTargets ?? [];
    },
    placeholderData: (previousData) =>
      previousData ?? ([] as unknown as PriceTarget[]),
  });
}

/**
 * useSavePriceTargets — thin wrapper over useSavePortfolioRecord.
 * Reads the current icpAmount and investedAmount from cache to keep all three in sync.
 */
/**
 * useSavePriceTargets — writes targets atomically with current icpAmount + investedAmount.
 */
export function useSavePriceTargets() {
  const { actor } = useBackendActor();
  const queryClient = useQueryClient();
  const { identity } = useInternetIdentity();
  const principal = identity?.getPrincipal().toString() ?? null;
  return useMutation({
    mutationFn: (targets: PriceTarget[]) => {
      if (!actor)
        throw new Error("Backend not ready — please wait and try again");
      const cached =
        queryClient.getQueryData<PortfolioRecord>([
          "portfolioRecord",
          principal,
        ]) ??
        queryClient.getQueryData<PortfolioRecord>(["portfolioRecord", null]);
      const icpAmount = cached?.icpAmount ?? 0;
      const investedAmount = cached?.investedAmount ?? 0;
      return actor.savePortfolioRecord(
        icpAmount,
        investedAmount,
        targets.map((t) => ({
          ...t,
          notifyViaEmail: t.notifyViaEmail ?? false,
          notifyViaPhone: t.notifyViaPhone ?? false,
        })),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["portfolioRecord", principal],
      });
    },
    onError: (e) => {
      console.error("[PORTFOLIO SAVE ERROR] useSavePriceTargets", {
        error: e,
        message: e instanceof Error ? e.message : String(e),
      });
    },
  });
}

export function useUserSettings(refetchInterval = 60_000) {
  const { actor } = useBackendActor();
  const { identity } = useInternetIdentity();
  const principal = identity?.getPrincipal().toString() ?? null;
  // CRITICAL: enabled ONLY on actor — never gated on isAuthenticated or any HTTP result
  const enabled = !!actor;
  console.log("[ACTOR] useUserSettings", {
    actor: !!actor,
    principal,
    enabled,
  });

  const DEFAULT_SETTINGS: UserSettings & {
    baseCurrency: string;
    language: string;
  } = {
    email: undefined,
    phone: undefined,
    theme: "dark",
    baseCurrency: "USD",
    language: "en",
  };

  return useQuery<UserSettings & { baseCurrency?: string; language?: string }>({
    queryKey: ["userSettings", principal],
    queryFn: async () => {
      if (!actor) return DEFAULT_SETTINGS;
      try {
        const settings = await actor.getUserSettings();
        console.log("[SETTINGS] load result", {
          email: settings.email ? "[set]" : "[empty]",
          phone: settings.phone ? "[set]" : "[empty]",
          theme: settings.theme,
          baseCurrency: (settings as UserSettings & { baseCurrency?: string })
            .baseCurrency,
          language: (settings as UserSettings & { language?: string }).language,
        });
        const result = settings as UserSettings & {
          baseCurrency?: string;
          language?: string;
        };
        // Sync UI language with saved preference
        if (result.language) {
          setLanguage(result.language as import("@/i18n").LangCode);
        }
        return result;
      } catch (e) {
        if (isCanisterStoppedError(e)) {
          console.warn("[SETTINGS] canister stopped, returning defaults");
          return DEFAULT_SETTINGS;
        }
        console.error("[SETTINGS] load error", {
          error: e,
          message: e instanceof Error ? e.message : String(e),
        });
        return DEFAULT_SETTINGS;
      }
    },
    enabled,
    staleTime: 0,
    refetchInterval,
    retry: 3,
    retryDelay: 1000,
    placeholderData: (previousData) => previousData ?? DEFAULT_SETTINGS,
  });
}

export function useExchangeRates(currency: string) {
  return useQuery<Record<string, number>>({
    queryKey: ["exchangeRates", currency],
    queryFn: async () => {
      console.log("[QUERY START] useExchangeRates", { currency });
      if (!currency || currency === "USD") {
        console.log(
          "[QUERY SKIP] useExchangeRates — base currency is USD, no fetch needed",
        );
        return {};
      }
      try {
        const res = await fetch(
          "https://api.exchangerate-api.com/v4/latest/USD",
        );
        if (!res.ok) {
          console.error("[QUERY ERROR] useExchangeRates — HTTP error", {
            status: res.status,
            statusText: res.statusText,
          });
          return {};
        }
        const data = (await res.json()) as { rates?: Record<string, number> };
        const rate = data.rates?.[currency];
        console.log("[QUERY SUCCESS] useExchangeRates", {
          currency,
          rate,
          totalRates: Object.keys(data.rates ?? {}).length,
        });
        return data.rates ?? {};
      } catch (e) {
        console.error("[QUERY ERROR] useExchangeRates — exception", {
          error: e,
          message: e instanceof Error ? e.message : String(e),
        });
        return {};
      }
    },
    staleTime: 60_000,
    retry: 1,
    enabled: true,
  });
}

export function useSaveUserSettings() {
  const { actor } = useBackendActor();
  const queryClient = useQueryClient();
  const { identity } = useInternetIdentity();
  const principal = identity?.getPrincipal().toString() ?? null;
  return useMutation({
    mutationFn: ({
      email,
      phone,
      theme,
      baseCurrency,
      language,
    }: {
      email?: string | null;
      phone?: string | null;
      theme?: string | null;
      baseCurrency?: string | null;
      language?: string | null;
    }) => {
      if (!actor)
        throw new Error("Backend not ready — please wait and try again");
      const cached = queryClient.getQueryData<
        UserSettings & { baseCurrency?: string; language?: string }
      >(["userSettings", principal]);
      const resolvedEmail: string | null =
        email !== undefined ? (email ?? null) : (cached?.email ?? null);
      const resolvedPhone: string | null =
        phone !== undefined ? (phone ?? null) : (cached?.phone ?? null);
      const resolvedTheme: string | null =
        theme !== undefined ? (theme ?? null) : (cached?.theme ?? null);
      const resolvedCurrency: string | null =
        baseCurrency !== undefined
          ? (baseCurrency ?? null)
          : (cached?.baseCurrency ?? null);
      const resolvedLanguage: string | null =
        language !== undefined
          ? (language ?? null)
          : (cached?.language ?? null);
      return actor.saveUserSettings(
        resolvedEmail,
        resolvedPhone,
        resolvedTheme,
        resolvedCurrency,
        resolvedLanguage,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userSettings", principal] });
    },
    onError: (e) => {
      console.error("[SETTINGS SAVE ERROR]", {
        error: e,
        message: e instanceof Error ? e.message : String(e),
      });
    },
  });
}

export function useICP24hStats(refetchInterval = 60_000) {
  const { actor, isReady } = useBackendActor();
  return useQuery<ICP24hStats | null>({
    queryKey: ["icp24hStats"],
    queryFn: async () => {
      console.log("[QUERY START] useICP24hStats", { actor: !!actor });
      if (!actor) {
        console.warn("[QUERY SKIP] useICP24hStats — actor not ready");
        return null;
      }
      try {
        const result = await actor.getICP24hStats();
        console.log("[QUERY SUCCESS] useICP24hStats", result);
        return result;
      } catch (e) {
        if (isCanisterStoppedError(e)) {
          console.warn(
            "[QUERY WARN] useICP24hStats — canister stopped, returning null",
          );
          return null;
        }
        console.error("[QUERY ERROR] useICP24hStats", {
          error: e,
          message: e instanceof Error ? e.message : String(e),
        });
        return null;
      }
    },
    enabled: isReady && !!actor,
    refetchInterval,
    staleTime: 50_000,
    retry: 2,
    placeholderData: (previousData) => previousData ?? null,
  });
}

export function useSocialTrending(refetchInterval = 60_000) {
  const { actor, isReady } = useBackendActor();
  return useQuery<SocialTrendingResult | null>({
    queryKey: ["socialTrending"],
    queryFn: async () => {
      console.log("[QUERY START] useSocialTrending", { actor: !!actor });
      if (!actor) {
        console.warn("[QUERY SKIP] useSocialTrending — actor not ready");
        return null;
      }
      try {
        const result = await actor.getSocialTrending();
        console.log("[QUERY SUCCESS] useSocialTrending", result);
        return result;
      } catch (e) {
        if (isCanisterStoppedError(e)) {
          console.warn(
            "[QUERY WARN] useSocialTrending — canister stopped, returning null",
          );
          return null;
        }
        console.error("[QUERY ERROR] useSocialTrending", {
          error: e,
          message: e instanceof Error ? e.message : String(e),
        });
        return null;
      }
    },
    enabled: isReady && !!actor,
    refetchInterval,
    staleTime: 50_000,
    retry: 2,
    placeholderData: (previousData) => previousData ?? null,
  });
}

/**
 * useInvestedAmount — thin wrapper over usePortfolioRecord.
 * Returns only the investedAmount. Existing components don't need to change.
 */
/**
 * useInvestedAmount — selector over usePortfolioRecord cache. No extra backend call.
 */
export function useInvestedAmount(refetchInterval = 60_000) {
  const {
    data: portfolio,
    isLoading,
    isFetching,
  } = usePortfolioRecord(refetchInterval);
  return {
    data: portfolio?.investedAmount ?? 0,
    isLoading,
    isFetching,
  };
}

/**
 * useSaveInvestedAmount — thin wrapper over useSavePortfolioRecord.
 * Reads the current icpAmount and priceTargets from cache to keep all three in sync.
 */
/**
 * useSaveInvestedAmount — thin wrapper over useSavePortfolioRecord.
 * Reads the current icpAmount and priceTargets from cache to keep all three in sync.
 */
export function useSaveInvestedAmount() {
  const { actor } = useBackendActor();
  const queryClient = useQueryClient();
  const { identity } = useInternetIdentity();
  const principal = identity?.getPrincipal().toString() ?? null;
  return useMutation({
    mutationFn: (amount: number) => {
      if (!actor)
        throw new Error("Backend not ready — please wait and try again");
      const cached =
        queryClient.getQueryData<PortfolioRecord>([
          "portfolioRecord",
          principal,
        ]) ??
        queryClient.getQueryData<PortfolioRecord>(["portfolioRecord", null]);
      const icpAmount = cached?.icpAmount ?? 0;
      const priceTargets = cached?.priceTargets ?? [];
      return actor.savePortfolioRecord(
        icpAmount,
        amount,
        priceTargets.map((t: PriceTarget) => ({
          ...t,
          notifyViaEmail: t.notifyViaEmail ?? false,
          notifyViaPhone: t.notifyViaPhone ?? false,
        })),
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["portfolioRecord", principal],
      });
    },
    onError: (e) => {
      console.error("[PORTFOLIO SAVE ERROR] useSaveInvestedAmount", {
        error: e,
        message: e instanceof Error ? e.message : String(e),
      });
    },
  });
}
// ─── Delete hooks ────────────────────────────────────────────────────────────

export function useDeletePortfolioRecord() {
  const { actor } = useBackendActor();
  const queryClient = useQueryClient();
  const { identity } = useInternetIdentity();
  const principal = identity?.getPrincipal().toString() ?? null;
  return useMutation({
    mutationFn: () => {
      if (!actor)
        throw new Error("Backend not ready — please wait and try again");
      return (
        actor as unknown as { deletePortfolioRecord: () => Promise<void> }
      ).deletePortfolioRecord();
    },
    onSuccess: () => {
      queryClient.setQueryData(["portfolioRecord", principal], {
        icpAmount: 0,
        investedAmount: 0,
        priceTargets: [],
      } satisfies PortfolioRecord);
      queryClient.invalidateQueries({
        queryKey: ["portfolioRecord", principal],
      });
    },
    onError: (e) => {
      console.error("[PORTFOLIO DELETE ERROR]", {
        error: e,
        message: e instanceof Error ? e.message : String(e),
      });
    },
  });
}

export function useDeleteUserSettings() {
  const { actor } = useBackendActor();
  const queryClient = useQueryClient();
  const { identity } = useInternetIdentity();
  const principal = identity?.getPrincipal().toString() ?? null;
  return useMutation({
    mutationFn: () => {
      if (!actor)
        throw new Error("Backend not ready — please wait and try again");
      return (
        actor as unknown as { deleteUserSettings: () => Promise<void> }
      ).deleteUserSettings();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userSettings", principal] });
    },
    onError: (e) => {
      console.error("[SETTINGS DELETE ERROR]", {
        error: e,
        message: e instanceof Error ? e.message : String(e),
      });
    },
  });
}

export function useICPNews(refetchInterval = 60_000) {
  const { actor, isReady } = useBackendActor();
  console.log("[ACTOR] useICPNews", {
    actor: !!actor,
    isActorFetching: !isReady,
  });
  return useQuery<NewsItem[]>({
    queryKey: ["icpNews"],
    queryFn: async () => {
      console.log("[QUERY START] useICPNews", { actor: !!actor });
      if (!actor) {
        console.warn(
          "[QUERY SKIP] useICPNews — actor not ready yet, returning empty",
        );
        return [];
      }
      try {
        console.log("[QUERY FETCH] useICPNews — calling actor.getICPNews()...");
        const items = await actor.getICPNews();
        console.log("[QUERY RAW] useICPNews — raw items from backend", {
          count: items.length,
          isEmpty: items.length === 0,
          preview: items.slice(0, 3).map((i) => ({
            title: i.title?.slice(0, 60),
            source: i.source,
            url: i.url?.slice(0, 60),
          })),
        });
        if (items.length === 0) {
          console.warn(
            "[QUERY WARN] useICPNews — backend returned empty array. HTTP outcalls may have all failed.",
          );
        }
        const mapped = items.map((item) => ({
          url: item.url ?? "",
          title: item.title ?? "",
          source: item.source ?? "Unknown",
          publishedAt: item.publishedAt ?? "",
        }));
        console.log("[QUERY SUCCESS] useICPNews", {
          totalArticles: mapped.length,
          sources: [...new Set(mapped.map((i) => i.source))],
        });
        return mapped;
      } catch (e) {
        if (isCanisterStoppedError(e)) {
          console.warn(
            "[QUERY WARN] useICPNews — canister stopped, returning empty array",
          );
          return [];
        }
        console.error("[QUERY ERROR] useICPNews — exception during fetch.", {
          error: e,
          message: e instanceof Error ? e.message : String(e),
          stack: e instanceof Error ? e.stack : undefined,
        });
        return [];
      }
    },
    // News is a public call — enable as soon as actor is available, no auth gate
    enabled: isReady && !!actor,
    refetchInterval,
    staleTime: 50_000,
    retry: 2,
    retryDelay: 15_000,
    placeholderData: (previousData) => previousData,
  });
}

export function useExecutionHistory(refetchInterval = 60_000) {
  const { actor, isReady } = useBackendActor();
  const { identity } = useInternetIdentity();
  const principal = identity?.getPrincipal().toString() ?? null;
  return useQuery<ExecutionRecord[]>({
    queryKey: ["executionHistory", principal],
    queryFn: async () => {
      console.log("[QUERY START] useExecutionHistory", {
        actor: !!actor,
        principal,
      });
      if (!actor) {
        console.error("[QUERY ERROR] useExecutionHistory — actor is null");
        throw new Error("actor not ready");
      }
      try {
        const result = await actor.getExecutionHistory();
        console.log("[QUERY SUCCESS] useExecutionHistory", {
          count: result.length,
        });
        return result;
      } catch (e) {
        console.error("[QUERY ERROR] useExecutionHistory", {
          error: e,
          message: e instanceof Error ? e.message : String(e),
        });
        throw e;
      }
    },
    enabled: isReady && !!actor,
    staleTime: 0,
    refetchInterval,
    placeholderData: (previousData) => previousData ?? [],
  });
}

export function useSaveExecutionRecord() {
  const { actor } = useBackendActor();
  const queryClient = useQueryClient();
  const { identity } = useInternetIdentity();
  const principal = identity?.getPrincipal().toString() ?? null;
  return useMutation({
    mutationFn: (record: ExecutionRecord) => {
      if (!actor)
        throw new Error("Backend not ready — please wait and try again");
      return actor.saveExecutionRecord(record);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["executionHistory", principal],
      });
    },
  });
}
export function useGetDonationAddress() {
  const { actor } = useBackendActor();
  return useQuery<string>({
    queryKey: ["donationAddress"],
    queryFn: async () => {
      if (!actor) {
        // Actor not available — return fallback immediately instead of throwing
        return FALLBACK_DONATION_ADDRESS;
      }
      try {
        const a = actor as unknown as Record<string, unknown>;
        if (typeof a.getDonationAddress !== "function") {
          return FALLBACK_DONATION_ADDRESS;
        }
        const result = await (a.getDonationAddress as () => Promise<string>)();
        const trimmed = (result ?? "").trim();
        return trimmed || FALLBACK_DONATION_ADDRESS;
      } catch {
        return FALLBACK_DONATION_ADDRESS;
      }
    },
    enabled: true, // always enabled — returns fallback immediately if actor not ready
    initialData: FALLBACK_DONATION_ADDRESS,
    staleTime: 300_000,
    retry: 2,
    retryDelay: 2000,
  });
}

// ─── Admin / Announcements ────────────────────────────────────────────────

export function useIsAdmin() {
  const { actor, isReady } = useBackendActor();
  const { identity } = useInternetIdentity();
  const principal = identity?.getPrincipal().toString() ?? null;
  return useQuery<boolean>({
    queryKey: ["isAdmin", principal],
    queryFn: async () => {
      if (!actor) return false;
      return actor.isCallerAdmin();
    },
    enabled: isReady && !!actor,
    staleTime: 300_000,
    retry: 1,
  });
}

export function useAllAnnouncements() {
  const { actor, isReady } = useBackendActor();
  const { identity } = useInternetIdentity();
  const principal = identity?.getPrincipal().toString() ?? null;
  const { data: isAdmin } = useIsAdmin();
  return useQuery<Announcement[]>({
    queryKey: ["allAnnouncements", principal],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllAnnouncements();
    },
    enabled: isReady && !!actor && !!isAdmin,
    staleTime: 10_000,
    retry: 1,
  });
}

export function usePublishedAnnouncements(refetchInterval = 60_000) {
  const { actor, isReady } = useBackendActor();
  const { isAuthenticated } = useInternetIdentity();
  return useQuery<Announcement[]>({
    queryKey: ["publishedAnnouncements"],
    queryFn: async () => {
      console.log("[QUERY START] usePublishedAnnouncements", {
        actor: !!actor,
        isAuthenticated,
      });
      if (!actor) {
        console.warn(
          "[QUERY SKIP] usePublishedAnnouncements — actor not ready",
        );
        return [];
      }
      try {
        const result = await actor.getPublishedAnnouncements();
        console.log("[QUERY SUCCESS] usePublishedAnnouncements", {
          count: result.length,
        });
        return result;
      } catch (e) {
        if (isCanisterStoppedError(e)) {
          console.warn(
            "[QUERY WARN] usePublishedAnnouncements — canister stopped, returning empty",
          );
          return [];
        }
        console.error("[QUERY ERROR] usePublishedAnnouncements", {
          error: e,
          message: e instanceof Error ? e.message : String(e),
        });
        return [];
      }
    },
    enabled: isReady && !!actor,
    staleTime: 30_000,
    refetchInterval,
    retry: 1,
    placeholderData: (prev) => prev ?? [],
  });
}

export function useCreateAnnouncement() {
  const { actor } = useBackendActor();
  const queryClient = useQueryClient();
  const { identity } = useInternetIdentity();
  const principal = identity?.getPrincipal().toString() ?? null;
  return useMutation({
    mutationFn: ({
      title,
      body,
      announcementType,
    }: {
      title: string;
      body: string;
      announcementType: AnnouncementType;
    }) => {
      if (!actor)
        throw new Error("Backend not ready — please wait and try again");
      return actor.createAnnouncement(title, body, announcementType);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["allAnnouncements", principal],
      });
      queryClient.invalidateQueries({
        queryKey: ["publishedAnnouncements", principal],
      });
    },
  });
}

export function useUpdateAnnouncement() {
  const { actor } = useBackendActor();
  const queryClient = useQueryClient();
  const { identity } = useInternetIdentity();
  const principal = identity?.getPrincipal().toString() ?? null;
  return useMutation({
    mutationFn: ({
      id,
      title,
      body,
      announcementType,
    }: {
      id: bigint;
      title: string;
      body: string;
      announcementType: AnnouncementType;
    }) => {
      if (!actor)
        throw new Error("Backend not ready — please wait and try again");
      return actor.updateAnnouncement(id, title, body, announcementType);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["allAnnouncements", principal],
      });
      queryClient.invalidateQueries({
        queryKey: ["publishedAnnouncements", principal],
      });
    },
  });
}

export function useDeleteAnnouncement() {
  const { actor } = useBackendActor();
  const queryClient = useQueryClient();
  const { identity } = useInternetIdentity();
  const principal = identity?.getPrincipal().toString() ?? null;
  return useMutation({
    mutationFn: (id: bigint) => {
      if (!actor)
        throw new Error("Backend not ready — please wait and try again");
      return actor.deleteAnnouncement(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["allAnnouncements", principal],
      });
      queryClient.invalidateQueries({
        queryKey: ["publishedAnnouncements", principal],
      });
    },
  });
}

export function useToggleAnnouncementPublished() {
  const { actor } = useBackendActor();
  const queryClient = useQueryClient();
  const { identity } = useInternetIdentity();
  const principal = identity?.getPrincipal().toString() ?? null;
  return useMutation({
    mutationFn: (id: bigint) => {
      if (!actor)
        throw new Error("Backend not ready — please wait and try again");
      return actor.toggleAnnouncementPublished(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["allAnnouncements", principal],
      });
      queryClient.invalidateQueries({
        queryKey: ["publishedAnnouncements", principal],
      });
    },
  });
}

export function useAdminICPBalance() {
  const { actor, isReady } = useBackendActor();
  const { identity } = useInternetIdentity();
  const principal = identity?.getPrincipal().toString() ?? null;
  return useQuery<string>({
    queryKey: ["adminICPBalance", principal],
    queryFn: async () => {
      if (!actor) return "0.0000";
      try {
        const a = actor as unknown as Record<string, unknown>;
        if (typeof a.getAdminICPBalance !== "function") return "0.0000";
        const result = await (a.getAdminICPBalance as () => Promise<string>)();
        return (result ?? "0.0000").trim();
      } catch (e) {
        console.error("[QUERY ERROR] useAdminICPBalance", e);
        return "0.0000";
      }
    },
    enabled: isReady && !!actor,
    staleTime: 60_000,
    retry: 1,
    placeholderData: (prev) => prev ?? "0.0000",
  });
}

export function useSendTestEmail() {
  const { actor } = useBackendActor();
  return useMutation({
    mutationFn: async (email: string): Promise<string> => {
      if (!actor)
        throw new Error("Backend not ready — please wait and try again");
      const a = actor as unknown as Record<string, unknown>;
      if (typeof a.sendTestEmail !== "function") {
        throw new Error("sendTestEmail not available on backend");
      }
      const result = await (
        a.sendTestEmail as (
          email: string,
        ) => Promise<
          { __kind__: "ok"; ok: string } | { __kind__: "err"; err: string }
        >
      )(email);
      if (result.__kind__ === "err") throw new Error(result.err);
      return result.ok;
    },
  });
}

export type { AnnouncementType, Announcement };
