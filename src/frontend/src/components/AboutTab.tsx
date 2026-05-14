import {
  FALLBACK_DONATION_ADDRESS,
  useGetDonationAddress,
} from "@/hooks/useQueries";
import { Check, Copy, Heart, Info, Wallet } from "lucide-react";
import { useState } from "react";

export function AboutTab() {
  const { data: donationAddress } = useGetDonationAddress();
  const [copied, setCopied] = useState(false);

  // Show the fallback immediately; update to backend value when it resolves
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

  return (
    <div className="space-y-6" data-ocid="about.section">
      {/* App Info */}
      <div className="bg-card border border-border rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center shrink-0">
            <Info className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h2 className="font-display font-semibold text-lg text-foreground">
              ICP Value Tracker
            </h2>
            <p className="text-sm text-muted-foreground">
              Your personal Internet Computer portfolio dashboard
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Features</h3>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {[
                "Live ICP price with 24h high/low",
                "Portfolio value & investment tracking",
                "Fear & greed meter + social trending",
                "Exit strategy planner with price targets",
                "ICP & ecosystem news aggregator",
                "Historical data & execution log",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-accent mt-0.5">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">About</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Built on the Internet Computer blockchain, your data is stored
              securely on-chain and tied to your Internet Identity — no
              passwords, no central servers.
            </p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Prices refresh automatically and pull from multiple sources
              (CoinGecko, Binance, Coinbase) with graceful fallback to cached
              values when feeds are temporarily unavailable.
            </p>
          </div>
        </div>
      </div>

      {/* Donation Section */}
      <div
        className="bg-card border border-border rounded-xl p-6 space-y-5"
        data-ocid="about.donation.card"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center shrink-0">
            <Heart className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h2 className="font-display font-semibold text-lg text-foreground">
              Support This Project
            </h2>
            <p className="text-sm text-muted-foreground">
              Help keep the tracker running and improving
            </p>
          </div>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">
          This tracker runs on the Internet Computer and is free to use. If you
          find it useful, consider sending a small ICP donation to help cover
          compute cycles and ongoing development. Every contribution is
          appreciated!
        </p>

        {address ? (
          <div className="space-y-5">
            {/* Wallet address */}
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

            {/* QR code */}
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
