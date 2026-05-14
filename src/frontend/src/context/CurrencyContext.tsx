import { createContext, useContext } from "react";

export const CURRENCIES: { code: string; symbol: string; label: string }[] = [
  { code: "USD", symbol: "$", label: "USD — $" },
  { code: "EUR", symbol: "€", label: "EUR — €" },
  { code: "GBP", symbol: "£", label: "GBP — £" },
  { code: "JPY", symbol: "¥", label: "JPY — ¥" },
  { code: "CAD", symbol: "CA$", label: "CAD — CA$" },
  { code: "AUD", symbol: "A$", label: "AUD — A$" },
  { code: "CHF", symbol: "Fr", label: "CHF — Fr" },
  { code: "CNY", symbol: "¥", label: "CNY — ¥" },
  { code: "KRW", symbol: "₩", label: "KRW — ₩" },
  { code: "SGD", symbol: "S$", label: "SGD — S$" },
  { code: "MXN", symbol: "MX$", label: "MXN — MX$" },
  { code: "BRL", symbol: "R$", label: "BRL — R$" },
  { code: "INR", symbol: "₹", label: "INR — ₹" },
];

/** Zero-decimal currencies that should not show .00 */
const ZERO_DECIMAL = new Set(["JPY", "KRW"]);

export function formatCurrency(
  value: number,
  currencyCode: string,
  rates: Record<string, number>,
): string {
  if (!currencyCode || currencyCode === "USD" || !rates[currencyCode]) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }
  const converted = value * rates[currencyCode];
  const decimals = ZERO_DECIMAL.has(currencyCode) ? 0 : 2;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(converted);
}

export function formatCurrencyShort(
  value: number,
  currencyCode: string,
  rates: Record<string, number>,
): string {
  if (!currencyCode || currencyCode === "USD" || !rates[currencyCode]) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(value);
  }
  const converted = value * rates[currencyCode];
  const decimals = ZERO_DECIMAL.has(currencyCode) ? 0 : 4;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: ZERO_DECIMAL.has(currencyCode) ? 0 : 2,
    maximumFractionDigits: decimals,
  }).format(converted);
}

export function formatVolumeInCurrency(
  v: number,
  currencyCode: string,
  rates: Record<string, number>,
): string {
  const sym = CURRENCIES.find((c) => c.code === currencyCode)?.symbol ?? "$";
  const rate =
    !currencyCode || currencyCode === "USD" || !rates[currencyCode]
      ? 1
      : rates[currencyCode];
  const val = v * rate;
  if (val >= 1_000_000_000) return `${sym}${(val / 1_000_000_000).toFixed(2)}B`;
  if (val >= 1_000_000) return `${sym}${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `${sym}${(val / 1_000).toFixed(1)}K`;
  return `${sym}${val.toFixed(0)}`;
}

export function getCurrencySymbol(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? "$";
}

export interface CurrencyContextValue {
  currency: string;
  rates: Record<string, number>;
  ratesLoading: boolean;
  formatCurrency: (value: number) => string;
  formatCurrencyShort: (value: number) => string;
  formatVolume: (value: number) => string;
  symbol: string;
}

export const CurrencyContext = createContext<CurrencyContextValue>({
  currency: "USD",
  rates: {},
  ratesLoading: false,
  formatCurrency: (v) => formatCurrency(v, "USD", {}),
  formatCurrencyShort: (v) => formatCurrencyShort(v, "USD", {}),
  formatVolume: (v) => formatVolumeInCurrency(v, "USD", {}),
  symbol: "$",
});

export function useCurrency() {
  return useContext(CurrencyContext);
}
