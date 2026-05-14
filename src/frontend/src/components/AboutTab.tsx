import {
  FALLBACK_DONATION_ADDRESS,
  useGetDonationAddress,
} from "@/hooks/useQueries";
import { Check, Copy, Heart, Info, Wallet } from "lucide-react";
import { useState } from "react";

export function AboutTab() {
  const { data: donationAddress } = useGetDonationAddress();
  const [copied, setCopied] = useState(false);

  const address =
    donationAddress && donationAddress.trim().length > 0
      ? donationAddress
      : FALLBACK_DONATION_ADDRESS;
  const qrUrl = address
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(address)}&bgcolor=ffffff&color=1a1a1a&margin=10`
    : null;

  function copyAddress() {
    if (!address) return;
    navigator.clipboard.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  const featureCategories = [
    {
      label: "Price & Market",
      icon: "📈",
      features: [
        "Live ICP price from CoinGecko, Binance & Coinbase with automatic fallback",
        "24h High / Low display synced to your refresh interval",
        "Fear & Greed Index — live ICP market sentiment meter",
        "Social Trending — ICP social media trending rating",
        "7-day Price Chart with volume bars",
      ],
    },
    {
      label: "Portfolio & Strategy",
      icon: "💼",
      features: [
        "Portfolio Value Calculator — ICP amount, invested USD, current value",
        "Gain / Loss tracker with Avg. Entry (break-even) price",
        "Exit Strategy Planner — set price targets with token amounts to sell",
        "Execute trades directly — records each completed sale to Historical Data",
        "Email alerts when ICP hits your target prices",
      ],
    },
    {
      label: "Community & News",
      icon: "🌐",
      features: [
        "Community Chat — real-time ICP discussion with threaded replies",
        "Like / Dislike, Shill & FUD reactions with automatic sub-tab sorting",
        "Image uploads and YouTube link previews in chat",
        "ICP News Feed — DFINITY Forum, CoinGecko & community sources",
        "Admin announcements pinned to the top of the news feed",
      ],
    },
    {
      label: "Personalization & Security",
      icon: "🔒",
      features: [
        "Internet Identity login — decentralized, no passwords",
        "All data (portfolio, settings, exit plan) tied to your identity on-chain",
        "Multi-currency support — choose your base currency; values shown in both",
        "Dark / Light mode saved to your account",
        "7 languages: English, Español, Français, Deutsch, 中文, 日本語, Português",
      ],
    },
  ];

  return (
    <div className="space-y-6" data-ocid="about.section">
      {/* App Header */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-accent/20 border border-accent/30 flex items-center justify-center shrink-0 text-2xl">
            ⚡
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display font-bold text-2xl text-foreground tracking-tight">
                ICP Pulse
              </h1>
              <span className="inline-flex items-center rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white shadow-sm">
                beta
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              Your all-in-one Internet Computer portfolio dashboard — live
              prices, exit strategy planning, community chat, and market
              intelligence, all secured on-chain via Internet Identity.
            </p>
          </div>
        </div>

        <div className="mt-5 pt-5 border-t border-border">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Built on the{" "}
            <span className="text-foreground font-medium">
              Internet Computer
            </span>{" "}
            blockchain (developed by DFINITY Foundation), ICP Pulse stores your
            data securely on-chain — no central servers, no passwords. Prices
            refresh automatically from multiple sources with graceful fallback
            to cached values, and your personal settings are always tied to your
            unique Internet Identity.
          </p>
        </div>
      </div>

      {/* Features Grid */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center shrink-0">
            <Info className="w-4.5 h-4.5 text-accent" />
          </div>
          <div>
            <h2 className="font-display font-semibold text-base text-foreground">
              What's included in beta
            </h2>
            <p className="text-xs text-muted-foreground">
              15 features across 4 categories
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {featureCategories.map((cat) => (
            <div
              key={cat.label}
              className="rounded-lg bg-muted/40 border border-border p-4 space-y-2.5"
            >
              <div className="flex items-center gap-2">
                <span className="text-base leading-none">{cat.icon}</span>
                <h3 className="text-sm font-semibold text-foreground">
                  {cat.label}
                </h3>
              </div>
              <ul className="space-y-1.5">
                {cat.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed"
                  >
                    <span className="text-accent mt-0.5 shrink-0">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Donation Section */}
      <div
        className="bg-card border border-border rounded-xl p-6 space-y-5"
        data-ocid="about.donation.card"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center shrink-0">
            <Heart className="w-4.5 h-4.5 text-accent" />
          </div>
          <div>
            <h2 className="font-display font-semibold text-base text-foreground">
              Support ICP Pulse
            </h2>
            <p className="text-xs text-muted-foreground">
              Help keep the app running and growing
            </p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">
          ICP Pulse is free to use and runs entirely on the Internet Computer.
          If it's been useful to your ICP journey, consider sending a small ICP
          donation to help cover on-chain compute cycles and future development.
          Every contribution is genuinely appreciated!
        </p>

        {address ? (
          <div className="space-y-5">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Wallet className="w-3.5 h-3.5" />
                ICP Wallet Address
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 font-mono text-xs bg-muted border border-border rounded-lg px-3 py-2.5 text-foreground break-all select-all min-w-0">
                  {address}
                </div>
                <button
                  type="button"
                  onClick={copyAddress}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-2.5 rounded-lg border text-xs font-medium transition-smooth ${
                    copied
                      ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400"
                      : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                  data-ocid="about.copy_address_button"
                  aria-label="Copy wallet address"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>

            {qrUrl && (
              <div className="flex flex-col items-center gap-3">
                <p className="text-xs text-muted-foreground">
                  Or scan to donate with your ICP wallet
                </p>
                <div className="p-3 bg-card border-2 border-border rounded-xl inline-block shadow-subtle">
                  <img
                    src={qrUrl}
                    alt="ICP donation wallet QR code"
                    width={180}
                    height={180}
                    className="rounded-md block"
                    data-ocid="about.donation.qr_code"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground/70 text-center max-w-xs">
                  Send ICP to the address above. Donations go directly to
                  funding compute cycles and future feature development.
                </p>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
