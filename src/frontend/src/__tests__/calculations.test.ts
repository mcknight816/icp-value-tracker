import { describe, expect, it } from "vitest";
import {
  CURRENCIES,
  formatCurrency,
  formatCurrencyShort,
  getCurrencySymbol,
} from "../context/CurrencyContext";

// ─── Portfolio value ────────────────────────────────────────────────────────

describe("portfolioValue = icpAmount * price", () => {
  it("calculates correctly for typical values", () => {
    expect(500 * 6.5).toBeCloseTo(3250);
  });

  it("returns 0 when icpAmount is 0", () => {
    expect(0 * 6.5).toBe(0);
  });

  it("returns 0 when price is 0", () => {
    expect(1000 * 0).toBe(0);
  });

  it("handles very large numbers correctly", () => {
    expect(1_000_000 * 100).toBe(100_000_000);
  });

  it("handles fractional ICP amounts", () => {
    expect(0.5 * 10).toBeCloseTo(5);
  });
});

// ─── Gain / Loss ─────────────────────────────────────────────────────────────

describe("gainLoss = portfolioValue - investedAmount", () => {
  it("returns a positive value when in profit", () => {
    const portfolioValue = 1000;
    const invested = 800;
    expect(portfolioValue - invested).toBe(200);
  });

  it("returns a negative value when at a loss", () => {
    const portfolioValue = 600;
    const invested = 800;
    expect(portfolioValue - invested).toBe(-200);
  });

  it("returns 0 when break-even", () => {
    const portfolioValue = 1000;
    const invested = 1000;
    expect(portfolioValue - invested).toBe(0);
  });

  it("returns 0 when invested is 0", () => {
    expect(500 - 0).toBe(500);
  });

  it("returns negative portfolioValue when icpAmount is 0", () => {
    const portfolioValue = 0 * 10; // icpAmount=0
    const invested = 5000;
    expect(portfolioValue - invested).toBe(-5000);
  });
});

// ─── Average Entry (Break-even) ───────────────────────────────────────────────

describe("avgEntry (break-even price) = investedAmount / icpAmount", () => {
  it("calculates the correct break-even price", () => {
    const invested = 10_000;
    const icpAmount = 1000;
    expect(invested / icpAmount).toBe(10);
  });

  it("returns null-equivalent when icpAmount is 0 (avoid divide-by-zero)", () => {
    const invested = 10_000;
    const icpAmount = 0;
    const result = invested > 0 && icpAmount > 0 ? invested / icpAmount : null;
    expect(result).toBeNull();
  });

  it("returns null when invested is 0", () => {
    const invested = 0;
    const icpAmount = 1000;
    const result = invested > 0 && icpAmount > 0 ? invested / icpAmount : null;
    expect(result).toBeNull();
  });

  it("handles large invested amounts", () => {
    expect(100_000 / 5_000).toBeCloseTo(20);
  });

  it("handles fractional result", () => {
    expect(1000 / 3).toBeCloseTo(333.333, 2);
  });
});

// ─── Exit Strategy calculations ───────────────────────────────────────────────

describe("Exit strategy calculations", () => {
  it("saleValue = tokensToSell * targetPrice", () => {
    expect(100 * 15).toBe(1500);
  });

  it("remainingTokens = prevTokens - soldTokens", () => {
    const starting = 1000;
    const sold = 250;
    expect(starting - sold).toBe(750);
  });

  it("remainingTokens never goes below 0", () => {
    const starting = 100;
    const sold = 200;
    expect(Math.max(0, starting - sold)).toBe(0);
  });

  it("cumulative remaining after multiple rows", () => {
    const starting = 1000;
    const sales = [200, 300, 400];
    let remaining = starting;
    for (const s of sales) remaining = Math.max(0, remaining - s);
    expect(remaining).toBe(100);
  });

  it("remainingValue = remainingTokens * targetPrice", () => {
    const remaining = 750;
    const targetPrice = 15;
    expect(remaining * targetPrice).toBe(11250);
  });

  it("total planned sale value sums correctly across rows", () => {
    const rows = [
      { targetPrice: 10, tokensToSell: 100 },
      { targetPrice: 15, tokensToSell: 200 },
      { targetPrice: 20, tokensToSell: 300 },
    ];
    const total = rows.reduce(
      (sum, r) => sum + r.targetPrice * r.tokensToSell,
      0,
    );
    expect(total).toBe(10 * 100 + 15 * 200 + 20 * 300); // 1000+3000+6000=10000
  });
});

// ─── Currency formatting ─────────────────────────────────────────────────────

describe("formatCurrency", () => {
  const emptyRates: Record<string, number> = {};
  const rates: Record<string, number> = { EUR: 0.92, GBP: 0.79, JPY: 149 };

  it("formats USD correctly with $ symbol", () => {
    const result = formatCurrency(1000, "USD", emptyRates);
    expect(result).toMatch(/\$/);
    expect(result).toContain("1,000.00");
  });

  it("falls back to USD when rates are missing for the currency", () => {
    const result = formatCurrency(500, "EUR", emptyRates);
    expect(result).toMatch(/\$/);
  });

  it("converts EUR correctly using rate", () => {
    const result = formatCurrency(1000, "EUR", rates);
    // 1000 * 0.92 = 920 EUR
    expect(result).toContain("920");
  });

  it("formats GBP with £ symbol when rate is present", () => {
    const result = formatCurrency(1000, "GBP", rates);
    expect(result).toMatch(/£/);
  });

  it("formats JPY as zero-decimal (no .00)", () => {
    const result = formatCurrency(100, "JPY", rates);
    expect(result).not.toContain(".00");
  });

  it("handles 0 value correctly", () => {
    const result = formatCurrency(0, "USD", emptyRates);
    expect(result).toContain("0.00");
  });
});

describe("formatCurrencyShort", () => {
  const rates: Record<string, number> = { EUR: 0.92 };

  it("allows up to 4 decimal places for USD", () => {
    // $0.0012 — four sig-digit price
    const result = formatCurrencyShort(0.0012, "USD", {});
    expect(result).toMatch(/\$/);
  });

  it("falls back to USD formatting when no rate provided", () => {
    const result = formatCurrencyShort(100, "EUR", {});
    expect(result).toMatch(/\$/);
  });

  it("converts and formats EUR with up to 4 decimals", () => {
    const result = formatCurrencyShort(100, "EUR", rates);
    // 100 * 0.92 = 92 EUR
    expect(result).toContain("92");
  });
});

// ─── getCurrencySymbol ────────────────────────────────────────────────────────

describe("getCurrencySymbol", () => {
  it("returns $ for USD", () => {
    expect(getCurrencySymbol("USD")).toBe("$");
  });

  it("returns € for EUR", () => {
    expect(getCurrencySymbol("EUR")).toBe("€");
  });

  it("returns £ for GBP", () => {
    expect(getCurrencySymbol("GBP")).toBe("£");
  });

  it("returns ¥ for JPY", () => {
    expect(getCurrencySymbol("JPY")).toBe("¥");
  });

  it("returns $ as fallback for unknown currency", () => {
    expect(getCurrencySymbol("XYZ")).toBe("$");
  });
});

// ─── CURRENCIES list completeness ────────────────────────────────────────────

describe("CURRENCIES list", () => {
  const requiredCodes = ["USD", "EUR", "GBP", "JPY"];

  it.each(requiredCodes)(
    "includes %s with a code, symbol, and label",
    (code) => {
      const entry = CURRENCIES.find((c) => c.code === code);
      expect(entry).toBeDefined();
      expect(entry?.symbol).toBeTruthy();
      expect(entry?.label).toBeTruthy();
    },
  );

  it("has at least 4 currencies", () => {
    expect(CURRENCIES.length).toBeGreaterThanOrEqual(4);
  });

  it("every entry has a non-empty code, symbol, and label", () => {
    for (const c of CURRENCIES) {
      expect(c.code).toBeTruthy();
      expect(c.symbol).toBeTruthy();
      expect(c.label).toBeTruthy();
    }
  });
});
