import { CURRENCIES } from "@/context/CurrencyContext";
import {
  useSaveUserSettings,
  useSendTestEmail,
  useUserSettings,
} from "@/hooks/useQueries";
import { type LangCode, useLanguage } from "@/i18n";
import { CheckCircle2, Mail, Moon, Settings, Sun, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const INTERVAL_OPTIONS = [
  { label: "30 seconds", value: 30_000 },
  { label: "1 minute", value: 60_000 },
  { label: "2 minutes", value: 120_000 },
  { label: "5 minutes", value: 300_000 },
];

const LANGUAGE_OPTIONS: { code: LangCode; label: string }[] = [
  { code: "en", label: "English" },
  { code: "es", label: "Espa\u00f1ol" },
  { code: "fr", label: "Fran\u00e7ais" },
  { code: "de", label: "Deutsch" },
  { code: "zh", label: "\u4e2d\u6587" },
  { code: "ja", label: "\u65e5\u672c\u8a9e" },
  { code: "pt", label: "Portugu\u00eas" },
];

export function SettingsPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [refreshInterval, setRefreshInterval] = useState<number>(() => {
    const stored = localStorage.getItem("refreshInterval");
    if (stored) {
      const parsed = Number(stored);
      if (INTERVAL_OPTIONS.some((o) => o.value === parsed)) return parsed;
    }
    return 60_000;
  });
  const [testEmailStatus, setTestEmailStatus] = useState<
    "idle" | "success" | "error"
  >("idle");

  const { data: settings, isLoading } = useUserSettings();
  const { mutate: saveSettings, isPending } = useSaveUserSettings();
  const { mutate: sendTestEmail, isPending: isSendingTestEmail } =
    useSendTestEmail();
  const { lang, setLanguage, t } = useLanguage();

  const currentTheme =
    settings?.theme ??
    (document.documentElement.classList.contains("dark") ? "dark" : "light");

  useEffect(() => {
    if (settings) {
      setEmail(settings.email ?? "");
      setPhone(settings.phone ?? "");
      setCurrency(settings.baseCurrency ?? "USD");
    }
  }, [settings]);

  // Reset test email status when email field changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — run on every render to sync status when email changes
  useEffect(() => {
    setTestEmailStatus("idle");
  }, [email]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleThemeToggle() {
    const next = currentTheme === "dark" ? "light" : "dark";
    if (next === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    saveSettings(
      { theme: next },
      {
        onSuccess: () => {
          toast.success("Theme updated", {
            description: `Switched to ${next} mode.`,
          });
        },
        onError: () => {
          toast.error("Unable to save theme", {
            description:
              "The app is still connecting to the backend. Your preference will be saved automatically once connected \u2014 try again in a moment.",
          });
        },
      },
    );
  }

  function handleLanguageChange(code: LangCode) {
    setLanguage(code);
  }

  function handleCurrencyChange(code: string) {
    setCurrency(code);
    saveSettings(
      { baseCurrency: code },
      {
        onSuccess: () => {
          toast.success("Currency updated", {
            description: `Base currency changed to ${code}.`,
          });
          window.dispatchEvent(
            new CustomEvent("currencyChanged", { detail: { currency: code } }),
          );
        },
        onError: () => {
          toast.error("Failed to save currency", {
            description: "Please try again.",
          });
          setCurrency(settings?.baseCurrency ?? "USD");
        },
      },
    );
  }

  function handleSendTestEmail() {
    if (!email.trim()) return;
    setTestEmailStatus("idle");
    sendTestEmail(email.trim(), {
      onSuccess: () => {
        setTestEmailStatus("success");
      },
      onError: () => {
        setTestEmailStatus("error");
      },
    });
  }

  function handleSave() {
    localStorage.setItem("refreshInterval", String(refreshInterval));
    window.dispatchEvent(new Event("refreshIntervalChanged"));
    saveSettings(
      {
        email: email.trim() !== "" ? email.trim() : null,
        phone: phone.trim() !== "" ? phone.trim() : null,
        language: lang,
      },
      {
        onSuccess: () => {
          toast.success(t("saveSettings"), {
            description: "Your contact details have been updated.",
          });
        },
        onError: () => {
          toast.error("Failed to save settings", {
            description: "Please try again.",
          });
        },
      },
    );
  }

  return (
    <>
      {/* Gear trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center justify-center w-8 h-8 rounded-md border border-border bg-card hover:bg-muted text-muted-foreground hover:text-accent transition-smooth"
        aria-label="Open user settings"
        data-ocid="settings.open_modal_button"
      >
        <Settings className="w-4 h-4" />
      </button>

      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-foreground/30 z-40"
            onClick={() => setIsOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Drawer panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.aside
            key="panel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 260 }}
            className="fixed top-0 right-0 h-full w-80 bg-card border-l border-border shadow-2xl z-50 flex flex-col"
            data-ocid="settings.dialog"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-md bg-accent/20 border border-accent/30 flex items-center justify-center">
                  <Settings className="w-3.5 h-3.5 text-accent" />
                </div>
                <h2 className="font-display font-semibold text-foreground text-sm tracking-tight">
                  {t("userSettings")}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-smooth"
                aria-label="Close settings"
                data-ocid="settings.close_button"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
              {isLoading ? (
                <div className="space-y-4" data-ocid="settings.loading_state">
                  <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                  <div className="h-9 w-full bg-muted rounded animate-pulse" />
                  <div className="h-4 w-24 bg-muted rounded animate-pulse" />
                  <div className="h-9 w-full bg-muted rounded animate-pulse" />
                </div>
              ) : (
                <>
                  {/* Theme Toggle */}
                  <div className="space-y-2">
                    <span className="block text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t("appearance")}
                    </span>
                    <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        {currentTheme === "dark" ? (
                          <Moon className="w-4 h-4 text-accent" />
                        ) : (
                          <Sun className="w-4 h-4 text-accent" />
                        )}
                        <span className="text-sm text-foreground font-medium">
                          {currentTheme === "dark"
                            ? t("darkMode")
                            : t("lightMode")}
                        </span>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={currentTheme === "dark"}
                        onClick={handleThemeToggle}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-smooth focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-card ${
                          currentTheme === "dark" ? "bg-accent" : "bg-border"
                        }`}
                        data-ocid="settings.theme.toggle"
                        aria-label="Toggle dark/light mode"
                      >
                        <span
                          className={`inline-block h-4 w-4 rounded-full bg-card shadow-sm transform transition-smooth ${
                            currentTheme === "dark"
                              ? "translate-x-6"
                              : "translate-x-1"
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Language Selector */}
                  <div className="space-y-2">
                    <span className="block text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t("language")}
                    </span>
                    <select
                      id="settings-language"
                      value={lang}
                      onChange={(e) =>
                        handleLanguageChange(e.target.value as LangCode)
                      }
                      className="input-field"
                      data-ocid="settings.language.select"
                    >
                      {LANGUAGE_OPTIONS.map((opt) => (
                        <option key={opt.code} value={opt.code}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Email Address */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="settings-email"
                      className="block text-xs font-medium text-muted-foreground uppercase tracking-wider"
                    >
                      {t("emailAddress")}
                    </label>
                    <input
                      id="settings-email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="input-field"
                      data-ocid="settings.email.input"
                    />
                    {/* Test Email Button */}
                    {email.trim() !== "" && (
                      <div className="space-y-1.5 pt-1">
                        <button
                          type="button"
                          onClick={handleSendTestEmail}
                          disabled={isSendingTestEmail}
                          className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg border border-accent/40 bg-accent/10 text-accent hover:bg-accent/20 disabled:opacity-50 disabled:cursor-not-allowed transition-smooth w-full justify-center"
                          data-ocid="settings.test_email.button"
                        >
                          {isSendingTestEmail ? (
                            <>
                              <span className="w-3 h-3 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
                              {t("testEmailSending")}
                            </>
                          ) : (
                            <>
                              <Mail className="w-3.5 h-3.5" />
                              {t("testEmail")}
                            </>
                          )}
                        </button>
                        {testEmailStatus === "success" && (
                          <div
                            className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400"
                            data-ocid="settings.test_email.success_state"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            {t("testEmailSuccess")}
                          </div>
                        )}
                        {testEmailStatus === "error" && (
                          <div
                            className="text-xs text-destructive"
                            data-ocid="settings.test_email.error_state"
                          >
                            {t("testEmailError")}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Phone Number */}
                  <div className="space-y-1.5">
                    <label
                      htmlFor="settings-phone"
                      className="block text-xs font-medium text-muted-foreground uppercase tracking-wider"
                    >
                      {t("phoneNumber")}
                    </label>
                    <input
                      id="settings-phone"
                      type="tel"
                      placeholder="+1 555 000 0000"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="input-field"
                      data-ocid="settings.phone.input"
                    />
                  </div>

                  {/* Base Currency */}
                  <div className="space-y-2">
                    <span className="block text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t("baseCurrency")}
                    </span>
                    <select
                      id="settings-currency"
                      value={currency}
                      onChange={(e) => handleCurrencyChange(e.target.value)}
                      className="input-field"
                      data-ocid="settings.currency.select"
                    >
                      {CURRENCIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {t("currencyInfo")}
                    </p>
                  </div>

                  {/* Refresh Interval */}
                  <div className="space-y-2">
                    <span className="block text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {t("refreshInterval")}
                    </span>
                    <select
                      id="settings-refresh-interval"
                      value={refreshInterval}
                      onChange={(e) =>
                        setRefreshInterval(Number(e.target.value))
                      }
                      className="input-field"
                      data-ocid="settings.refresh_interval.select"
                    >
                      {INTERVAL_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {t("refreshInfo")}
                    </p>
                  </div>

                  <div className="pt-1 rounded-lg bg-muted/30 border border-border px-4 py-3 text-xs text-muted-foreground leading-relaxed">
                    {t("notificationInfo")}
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-border">
              <button
                type="button"
                onClick={handleSave}
                disabled={isPending}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-accent-foreground font-semibold text-sm hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-smooth"
                data-ocid="settings.save_button"
              >
                {isPending ? (
                  <>
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-accent-foreground/30 border-t-accent-foreground animate-spin" />
                    {t("saving")}
                  </>
                ) : (
                  t("saveSettings")
                )}
              </button>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
