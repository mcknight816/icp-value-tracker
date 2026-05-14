/**
 * Price fallback and error-handling tests.
 *
 * We test the queryFn logic that drives the ICP price display:
 * - When the backend returns a stale=false price → value is returned as-is
 * - When the backend returns a stale=true price → isStale flag is preserved
 * - When the backend throws → the queryFn throws (React Query keeps last cache)
 * - When no price is available → portfolio value shows '--', not skeleton
 */
import { describe, expect, it, vi } from "vitest";

// ─── Minimal type mirrors ──────────────────────────────────────────────────────

interface PriceResult {
  priceUSD: number;
  fetchedAt: bigint;
  isStale: boolean;
  source: string;
}

type BackendPriceResponse =
  | { __kind__: "ok"; ok: PriceResult }
  | { __kind__: "err"; err: string };

// ─── Simulated queryFn (mirrors useICPPrice in useQueries.ts) ─────────────────

async function icpPriceQueryFn(
  actor: { getICPPrice: () => Promise<BackendPriceResponse> } | null,
): Promise<PriceResult | null> {
  if (!actor) return null;
  // Fire-and-forget market data refresh (mirroring production)
  Promise.resolve().catch(() => {});
  const result = await actor.getICPPrice();
  if (result.__kind__ === "ok" && result.ok != null) return result.ok;
  // Backend returned #err — throw so React Query keeps last cache value
  throw new Error("ICP price unavailable");
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("icpPriceQueryFn", () => {
  it("returns the price when backend returns ok with isStale=false", async () => {
    const priceData: PriceResult = {
      priceUSD: 8.5,
      fetchedAt: BigInt(Date.now() * 1_000_000),
      isStale: false,
      source: "coingecko",
    };
    const actor = {
      getICPPrice: vi.fn().mockResolvedValue({ __kind__: "ok", ok: priceData }),
    };
    const result = await icpPriceQueryFn(actor);
    expect(result).toEqual(priceData);
    expect(result?.isStale).toBe(false);
  });

  it("returns the price with isStale=true when backend returns a stale cached price", async () => {
    const stalePrice: PriceResult = {
      priceUSD: 7.2,
      fetchedAt: BigInt((Date.now() - 600_000) * 1_000_000), // 10 min old
      isStale: true,
      source: "cached",
    };
    const actor = {
      getICPPrice: vi
        .fn()
        .mockResolvedValue({ __kind__: "ok", ok: stalePrice }),
    };
    const result = await icpPriceQueryFn(actor);
    expect(result).toEqual(stalePrice);
    expect(result?.isStale).toBe(true);
    expect(result?.source).toBe("cached");
  });

  it("throws when backend returns #err so React Query keeps the last cache value", async () => {
    const actor = {
      getICPPrice: vi
        .fn()
        .mockResolvedValue({ __kind__: "err", err: "HTTP outcall failed" }),
    };
    await expect(icpPriceQueryFn(actor)).rejects.toThrow(
      "ICP price unavailable",
    );
  });

  it("throws when actor.getICPPrice itself throws a network error", async () => {
    const actor = {
      getICPPrice: vi.fn().mockRejectedValue(new Error("network timeout")),
    };
    await expect(icpPriceQueryFn(actor)).rejects.toThrow("network timeout");
  });

  it("returns null when actor is null (disabled query state)", async () => {
    const result = await icpPriceQueryFn(null);
    expect(result).toBeNull();
  });
});

// ─── Portfolio value shows '--' when price is unavailable ─────────────────────

describe("portfolio value display when price is unavailable", () => {
  /**
   * In App.tsx: portfolioValue = price ? parsedAmount * price.priceUSD : null
   * When portfolioValue is null and NOT loading → render '--' not a skeleton.
   */
  function computePortfolioDisplay({
    price,
    isAmountLoading,
    parsedAmount,
  }: {
    price: PriceResult | null | undefined;
    isAmountLoading: boolean;
    parsedAmount: number;
  }): string {
    const portfolioValue = price ? parsedAmount * price.priceUSD : null;
    if (portfolioValue !== null) return `$${portfolioValue.toFixed(2)}`;
    if (isAmountLoading) return "SKELETON";
    return "--";
  }

  it("shows -- when price is null and amount is not loading", () => {
    const display = computePortfolioDisplay({
      price: null,
      isAmountLoading: false,
      parsedAmount: 100,
    });
    expect(display).toBe("--");
  });

  it("shows SKELETON only when isAmountLoading is true", () => {
    const display = computePortfolioDisplay({
      price: null,
      isAmountLoading: true,
      parsedAmount: 100,
    });
    expect(display).toBe("SKELETON");
  });

  it("shows the numeric value when price is available", () => {
    const display = computePortfolioDisplay({
      price: {
        priceUSD: 10,
        fetchedAt: BigInt(0),
        isStale: false,
        source: "coingecko",
      },
      isAmountLoading: false,
      parsedAmount: 500,
    });
    expect(display).toBe("$5000.00");
  });

  it("shows -- when parsedAmount is 0 and price is null", () => {
    const display = computePortfolioDisplay({
      price: null,
      isAmountLoading: false,
      parsedAmount: 0,
    });
    expect(display).toBe("--");
  });

  it("shows 0.00 value when price is available but parsedAmount is 0", () => {
    const display = computePortfolioDisplay({
      price: {
        priceUSD: 8.5,
        fetchedAt: BigInt(0),
        isStale: false,
        source: "coingecko",
      },
      isAmountLoading: false,
      parsedAmount: 0,
    });
    // 0 * 8.5 = 0, portfolioValue is 0 (not null) so shows formatted value
    expect(display).toBe("$0.00");
  });
});

// ─── Stale price display logic ────────────────────────────────────────────────

describe("stale price indicator logic", () => {
  /** Mirrors the status label logic in App.tsx header */
  function getPriceStatusLabel({
    isLoading,
    isFetching,
    isError,
    price,
  }: {
    isLoading: boolean;
    isFetching: boolean;
    isError: boolean;
    price: PriceResult | null | undefined;
  }): string {
    if (isLoading || isFetching) return "Fetching";
    if (isError && price) return "Last Known";
    if (isError) return "Unavailable";
    if (price?.isStale) return "Stale";
    return "Live";
  }

  it('returns "Live" when price is fresh and no error', () => {
    expect(
      getPriceStatusLabel({
        isLoading: false,
        isFetching: false,
        isError: false,
        price: {
          priceUSD: 8,
          fetchedAt: BigInt(0),
          isStale: false,
          source: "coingecko",
        },
      }),
    ).toBe("Live");
  });

  it('returns "Stale" when price.isStale is true', () => {
    expect(
      getPriceStatusLabel({
        isLoading: false,
        isFetching: false,
        isError: false,
        price: {
          priceUSD: 7,
          fetchedAt: BigInt(0),
          isStale: true,
          source: "cached",
        },
      }),
    ).toBe("Stale");
  });

  it('returns "Last Known" when error but price is still in cache', () => {
    expect(
      getPriceStatusLabel({
        isLoading: false,
        isFetching: false,
        isError: true,
        price: {
          priceUSD: 7,
          fetchedAt: BigInt(0),
          isStale: false,
          source: "cached",
        },
      }),
    ).toBe("Last Known");
  });

  it('returns "Unavailable" when error and no cached price', () => {
    expect(
      getPriceStatusLabel({
        isLoading: false,
        isFetching: false,
        isError: true,
        price: null,
      }),
    ).toBe("Unavailable");
  });

  it('returns "Fetching" when loading', () => {
    expect(
      getPriceStatusLabel({
        isLoading: true,
        isFetching: false,
        isError: false,
        price: null,
      }),
    ).toBe("Fetching");
  });
});
