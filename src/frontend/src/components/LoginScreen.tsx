import { Button } from "@/components/ui/button";
import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import { TrendingUp } from "lucide-react";
import { motion } from "motion/react";

export function LoginScreen() {
  const { login, isInitializing, isLoggingIn } = useInternetIdentity();

  return (
    <div
      className="min-h-screen bg-background flex flex-col items-center justify-center px-4"
      data-ocid="login.page"
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-sm space-y-8 text-center"
      >
        {/* Brand mark */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-accent/20 border border-accent/30 flex items-center justify-center shadow-lg">
            <TrendingUp className="w-8 h-8 text-accent" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground tracking-tight">
              ICP Pulse
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Track your ICP portfolio with live prices &amp; market data
            </p>
          </div>
        </div>

        {/* Feature list */}
        <ul className="text-left space-y-2.5 text-sm text-muted-foreground">
          {[
            "Live ICP price with auto-refresh every 30s",
            "Fear & Greed index and market charts",
            "Your ICP amount saved privately to your account",
            "Historical metrics table",
          ].map((feature) => (
            <li key={feature} className="flex items-start gap-2">
              <span className="mt-0.5 w-4 h-4 rounded-full bg-accent/20 border border-accent/30 flex-shrink-0 flex items-center justify-center">
                <span className="w-1.5 h-1.5 rounded-full bg-accent" />
              </span>
              {feature}
            </li>
          ))}
        </ul>

        {/* Login CTA */}
        <div className="space-y-3">
          <Button
            type="button"
            onClick={() => login()}
            disabled={isInitializing || isLoggingIn}
            className="w-full h-11 text-base font-semibold"
            data-ocid="login.submit_button"
          >
            {isInitializing
              ? "Loading…"
              : isLoggingIn
                ? "Opening Internet Identity…"
                : "Sign in with Internet Identity"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Internet Identity is a secure, privacy-preserving authentication
            system on the Internet Computer.
          </p>
        </div>
      </motion.div>

      {/* Footer */}
      <footer className="absolute bottom-4 text-xs text-muted-foreground text-center">
        © {new Date().getFullYear()}. Built with love using{" "}
        <a
          href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(typeof window !== "undefined" ? window.location.hostname : "")}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline"
        >
          caffeine.ai
        </a>
      </footer>
    </div>
  );
}
