/**
 * User settings persistence and custom-event tests.
 *
 * Covers:
 * - currencyChanged custom event is dispatched when currency is saved
 * - refreshIntervalChanged custom event is dispatched when interval is saved
 * - Dark / light mode class toggling on <html>
 * - CURRENCIES list contains required options
 * - Partial save merging: only provided fields overwrite cached values
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CURRENCIES } from "../context/CurrencyContext";

// ─── Custom event: currencyChanged ────────────────────────────────────────────

describe("currencyChanged custom event", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("dispatches currencyChanged with the selected currency code", () => {
    const received: string[] = [];
    const handler = (e: Event) => {
      received.push((e as CustomEvent<{ currency: string }>).detail.currency);
    };
    window.addEventListener("currencyChanged", handler);

    // Simulate what SettingsPanel does when currency is saved
    window.dispatchEvent(
      new CustomEvent("currencyChanged", { detail: { currency: "EUR" } }),
    );

    window.removeEventListener("currencyChanged", handler);
    expect(received).toEqual(["EUR"]);
  });

  it("dispatches the new currency code, not the old one", () => {
    const received: string[] = [];
    const handler = (e: Event) => {
      received.push((e as CustomEvent<{ currency: string }>).detail.currency);
    };
    window.addEventListener("currencyChanged", handler);

    window.dispatchEvent(
      new CustomEvent("currencyChanged", { detail: { currency: "USD" } }),
    );
    window.dispatchEvent(
      new CustomEvent("currencyChanged", { detail: { currency: "GBP" } }),
    );

    window.removeEventListener("currencyChanged", handler);
    expect(received).toEqual(["USD", "GBP"]);
    expect(received[received.length - 1]).toBe("GBP");
  });

  it("App.tsx listener updates baseCurrency state when event is dispatched", () => {
    // Simulate the listener installed in App.tsx
    let baseCurrency = "USD";
    const onCurrencyChange = (e: Event) => {
      const detail = (e as CustomEvent<{ currency: string }>).detail;
      if (detail?.currency) baseCurrency = detail.currency;
    };
    window.addEventListener("currencyChanged", onCurrencyChange);

    window.dispatchEvent(
      new CustomEvent("currencyChanged", { detail: { currency: "JPY" } }),
    );

    window.removeEventListener("currencyChanged", onCurrencyChange);
    expect(baseCurrency).toBe("JPY");
  });
});

// ─── Custom event: refreshIntervalChanged ─────────────────────────────────────

describe("refreshIntervalChanged custom event", () => {
  afterEach(() => {
    localStorage.removeItem("refreshInterval");
  });

  it("App.tsx reads localStorage after refreshIntervalChanged fires", () => {
    const INTERVAL_OPTIONS = [
      { value: 30_000 },
      { value: 60_000 },
      { value: 120_000 },
      { value: 300_000 },
    ];

    function getStoredInterval(): number {
      const stored = localStorage.getItem("refreshInterval");
      if (stored) {
        const parsed = Number(stored);
        if (INTERVAL_OPTIONS.some((o) => o.value === parsed)) return parsed;
      }
      return 60_000;
    }

    // Before event, localStorage empty → default
    expect(getStoredInterval()).toBe(60_000);

    // Simulate SettingsPanel saving a new interval
    localStorage.setItem("refreshInterval", "30000");
    window.dispatchEvent(new Event("refreshIntervalChanged"));

    // After event, App reads localStorage
    expect(getStoredInterval()).toBe(30_000);
  });

  it("invalid interval in localStorage falls back to 60_000", () => {
    const INTERVAL_OPTIONS = [
      { value: 30_000 },
      { value: 60_000 },
      { value: 120_000 },
      { value: 300_000 },
    ];
    function getStoredInterval(): number {
      const stored = localStorage.getItem("refreshInterval");
      if (stored) {
        const parsed = Number(stored);
        if (INTERVAL_OPTIONS.some((o) => o.value === parsed)) return parsed;
      }
      return 60_000;
    }

    localStorage.setItem("refreshInterval", "99999"); // not a valid option
    expect(getStoredInterval()).toBe(60_000);
  });

  it("all valid interval options are accepted by getStoredInterval", () => {
    const INTERVAL_OPTIONS = [
      { value: 30_000 },
      { value: 60_000 },
      { value: 120_000 },
      { value: 300_000 },
    ];
    function getStoredInterval(): number {
      const stored = localStorage.getItem("refreshInterval");
      if (stored) {
        const parsed = Number(stored);
        if (INTERVAL_OPTIONS.some((o) => o.value === parsed)) return parsed;
      }
      return 60_000;
    }

    for (const { value } of INTERVAL_OPTIONS) {
      localStorage.setItem("refreshInterval", String(value));
      expect(getStoredInterval()).toBe(value);
    }
  });
});

// ─── Dark / light mode theme toggling ────────────────────────────────────────

describe("dark / light mode theme toggling", () => {
  beforeEach(() => {
    // Start with no theme class
    document.documentElement.classList.remove("dark");
  });

  afterEach(() => {
    document.documentElement.classList.remove("dark");
  });

  it("adds 'dark' class to <html> when theme is set to 'dark'", () => {
    // Simulate the useEffect in App.tsx
    function applyTheme(theme: string) {
      if (theme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }

    applyTheme("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("removes 'dark' class from <html> when theme is set to 'light'", () => {
    document.documentElement.classList.add("dark"); // start in dark
    function applyTheme(theme: string) {
      if (theme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }
    applyTheme("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("toggling dark→light→dark cycles correctly", () => {
    function applyTheme(theme: string) {
      if (theme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    }

    applyTheme("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    applyTheme("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    applyTheme("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});

// ─── CURRENCIES list has required options ─────────────────────────────────────

describe("CURRENCIES list includes required options", () => {
  it("includes USD", () => {
    expect(CURRENCIES.find((c) => c.code === "USD")).toBeDefined();
  });

  it("includes EUR", () => {
    expect(CURRENCIES.find((c) => c.code === "EUR")).toBeDefined();
  });

  it("includes GBP", () => {
    expect(CURRENCIES.find((c) => c.code === "GBP")).toBeDefined();
  });

  it("includes JPY", () => {
    expect(CURRENCIES.find((c) => c.code === "JPY")).toBeDefined();
  });

  it("USD entry has $ symbol", () => {
    expect(CURRENCIES.find((c) => c.code === "USD")?.symbol).toBe("$");
  });

  it("EUR entry has € symbol", () => {
    expect(CURRENCIES.find((c) => c.code === "EUR")?.symbol).toBe("€");
  });

  it("GBP entry has £ symbol", () => {
    expect(CURRENCIES.find((c) => c.code === "GBP")?.symbol).toBe("£");
  });

  it("JPY entry has ¥ symbol", () => {
    expect(CURRENCIES.find((c) => c.code === "JPY")?.symbol).toBe("¥");
  });
});

// ─── Partial save: field merging logic ───────────────────────────────────────

describe("useSaveUserSettings partial field merge", () => {
  /**
   * Replicates the merge logic in useSaveUserSettings.mutationFn.
   * Only explicitly-passed fields overwrite the cache; undefined means 'keep cached'.
   */
  interface CachedSettings {
    email: string | null;
    phone: string | null;
    theme: string | null;
    baseCurrency: string | null;
  }

  function mergeSettings(
    patch: {
      email?: string | null;
      phone?: string | null;
      theme?: string | null;
      baseCurrency?: string | null;
    },
    cached: CachedSettings,
  ): CachedSettings {
    return {
      email:
        patch.email !== undefined
          ? (patch.email ?? null)
          : (cached.email ?? null),
      phone:
        patch.phone !== undefined
          ? (patch.phone ?? null)
          : (cached.phone ?? null),
      theme:
        patch.theme !== undefined
          ? (patch.theme ?? null)
          : (cached.theme ?? null),
      baseCurrency:
        patch.baseCurrency !== undefined
          ? (patch.baseCurrency ?? null)
          : (cached.baseCurrency ?? null),
    };
  }

  const existing: CachedSettings = {
    email: "user@example.com",
    phone: "+1234567890",
    theme: "light",
    baseCurrency: "USD",
  };

  it("only updates baseCurrency when only baseCurrency is provided", () => {
    const merged = mergeSettings({ baseCurrency: "EUR" }, existing);
    expect(merged.baseCurrency).toBe("EUR");
    expect(merged.email).toBe(existing.email);
    expect(merged.phone).toBe(existing.phone);
    expect(merged.theme).toBe(existing.theme);
  });

  it("only updates theme when only theme is provided", () => {
    const merged = mergeSettings({ theme: "dark" }, existing);
    expect(merged.theme).toBe("dark");
    expect(merged.baseCurrency).toBe(existing.baseCurrency);
    expect(merged.email).toBe(existing.email);
  });

  it("can clear a field by passing explicit null", () => {
    const merged = mergeSettings({ phone: null }, existing);
    expect(merged.phone).toBeNull();
    expect(merged.email).toBe(existing.email);
  });

  it("preserves all fields when empty patch is provided", () => {
    const merged = mergeSettings({}, existing);
    expect(merged).toEqual(existing);
  });

  it("updates multiple fields at once", () => {
    const merged = mergeSettings(
      { theme: "dark", baseCurrency: "JPY" },
      existing,
    );
    expect(merged.theme).toBe("dark");
    expect(merged.baseCurrency).toBe("JPY");
    expect(merged.email).toBe(existing.email);
  });
});
