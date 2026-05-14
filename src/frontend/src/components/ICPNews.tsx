import { AnnouncementType } from "@/backend";
import type { Announcement } from "@/backend";
import { useICPNews, usePublishedAnnouncements } from "@/hooks/useQueries";
import { ExternalLink, Megaphone, Newspaper, RefreshCw } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";

function timeAgo(publishedAt: string): string {
  const pub = new Date(publishedAt).getTime();
  if (Number.isNaN(pub)) return publishedAt;
  const diffMs = Date.now() - pub;
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${diffDay}d ago`;
}

export function ICPNews({
  refreshInterval = 60_000,
}: { refreshInterval?: number }) {
  const {
    data: news,
    isLoading,
    isError,
    error: newsError,
    refetch,
    isFetching,
    fetchStatus: newsFetchStatus,
  } = useICPNews(refreshInterval);

  const {
    data: announcements = [],
    isLoading: isAnnouncementsLoading,
    isError: isAnnouncementsError,
  } = usePublishedAnnouncements(refreshInterval);

  // Debug log: news state on every render
  const articles = news ?? [];
  console.log("[NEWS] render state", {
    newsCount: articles.length,
    isLoading,
    isFetching,
    newsFetchStatus,
    isError,
    newsError: newsError instanceof Error ? newsError.message : newsError,
    sources: [...new Set(articles.map((a) => a.source))],
    announcementsCount: announcements.length,
    isAnnouncementsLoading,
    isAnnouncementsError,
    combinedTotal: articles.length + announcements.length,
  });
  if (articles.length > 0) {
    console.log(
      "[NEWS] articles preview",
      articles.slice(0, 5).map((a) => ({
        title: a.title?.slice(0, 60),
        source: a.source,
        publishedAt: a.publishedAt,
      })),
    );
  } else {
    console.warn(
      "[NEWS] no articles — feed is empty. Check [QUERY ERROR] useICPNews above for root cause.",
    );
  }
  console.log(
    "[NEWS] announcements",
    announcements.map((a) => ({
      id: a.id?.toString(),
      title: a.title?.slice(0, 60),
    })),
  );

  // After 30 seconds with no articles and no error, stop spinning and prompt retry
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    setTimedOut(false);
    if (isLoading) return;
    if (articles.length > 0 || isError) return;
    // News HTTP outcalls on the IC can take 30+ seconds — give them time
    const id = setTimeout(() => {
      console.warn(
        "[NEWS] timeout — 30s passed with no articles and no error. Prompting user to retry.",
      );
      setTimedOut(true);
    }, 30_000);
    return () => clearTimeout(id);
  }, [isLoading, articles.length, isError]);

  // Colour-code badges per source
  function sourceBadgeClass(source: string): string {
    const s = source.toLowerCase();
    if (s.includes("dfinity"))
      return "bg-violet-500/15 text-violet-400 border-violet-500/25";
    if (s.includes("cryptopanic"))
      return "bg-violet-500/15 text-violet-400 border-violet-500/25";
    if (s.includes("coindesk"))
      return "bg-blue-500/15 text-blue-400 border-blue-500/25";
    if (s.includes("cointelegraph"))
      return "bg-emerald-500/15 text-emerald-400 border-emerald-500/25";
    if (s.includes("caffeine"))
      return "bg-accent/15 text-accent border-accent/25";
    return "bg-muted text-muted-foreground border-border";
  }

  function announcementBadge(type: AnnouncementType): {
    label: string;
    className: string;
  } {
    switch (type) {
      case AnnouncementType.system_notice:
        return {
          label: "System Notice",
          className: "bg-blue-500/15 text-blue-400 border-blue-500/25",
        };
      case AnnouncementType.market_tip:
        return {
          label: "Market Tip",
          className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
        };
      default:
        return {
          label: "General",
          className: "bg-muted text-muted-foreground border-border",
        };
    }
  }

  function annTimeAgo(ns: bigint): string {
    const ms = Number(ns / 1_000_000n);
    const diffMs = Date.now() - ms;
    const diffMin = Math.floor(diffMs / 60_000);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 30) return `${diffDay}d ago`;
    return new Date(ms).toLocaleDateString();
  }

  const hasArticles = articles.length > 0;

  return (
    <div className="space-y-4" data-ocid="icpnews.section">
      {/* ── Announcements section ── */}
      {announcements.length > 0 && (
        <div className="space-y-3" data-ocid="announcements.section">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-primary/20 border border-primary/30 flex items-center justify-center">
              <Megaphone className="w-3.5 h-3.5 text-primary" />
            </div>
            <h3 className="text-sm font-semibold text-foreground tracking-tight">
              Announcements
            </h3>
            <span className="text-xs text-muted-foreground bg-muted border border-border rounded-full px-2 py-0.5">
              {announcements.length}
            </span>
          </div>
          <div className="space-y-2" data-ocid="announcements.list">
            {[...announcements]
              .sort((a, b) => Number(b.createdAt - a.createdAt))
              .map((ann: Announcement, i: number) => {
                const badge = announcementBadge(ann.announcementType);
                return (
                  <div
                    key={ann.id.toString()}
                    className="card-metric space-y-2 border-primary/20 bg-primary/5"
                    data-ocid={`announcements.item.${i + 1}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded-full border text-[10px] font-semibold uppercase tracking-wide ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                        <span className="text-xs text-muted-foreground/60">
                          {annTimeAgo(ann.updatedAt)}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-foreground">
                      {ann.title}
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {ann.body}
                    </p>
                  </div>
                );
              })}
          </div>
          <div className="border-b border-border/50" />
        </div>
      )}

      {/* ── News feed header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-accent/20 border border-accent/30 flex items-center justify-center">
            <Newspaper className="w-4 h-4 text-accent" />
          </div>
          <h2 className="font-display font-semibold text-foreground tracking-tight">
            ICP &amp; Crypto News
          </h2>
          {hasArticles && (
            <span className="text-xs text-muted-foreground bg-muted border border-border rounded-full px-2 py-0.5">
              {articles.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-accent transition-smooth disabled:opacity-50"
          data-ocid="icpnews.refresh_button"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </div>

      {/* Source legend */}
      {hasArticles && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted-foreground">Sources:</span>
          {Array.from(new Set(articles.map((a) => a.source))).map((src) => (
            <span
              key={src}
              className={`inline-flex items-center px-2 py-0.5 rounded-full border font-medium ${sourceBadgeClass(src)}`}
            >
              {src}
            </span>
          ))}
        </div>
      )}

      {/* Error banner — shown above articles if cached data exists */}
      {isError && hasArticles && (
        <div
          className="flex items-center gap-2 text-xs text-amber-500/80 bg-amber-500/8 border border-amber-500/20 rounded-lg px-3 py-2"
          data-ocid="icpnews.error_state"
        >
          <RefreshCw className="w-3 h-3 shrink-0" />
          <span>
            Unable to load latest news. Showing last available articles.
          </span>
        </div>
      )}

      {/* Loading state — skeleton */}
      {isLoading && (
        <div className="space-y-3" data-ocid="icpnews.loading_state">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="card-metric space-y-2 animate-pulse">
              <div className="h-4 w-3/4 bg-muted rounded" />
              <div className="flex items-center gap-2">
                <div className="h-3 w-20 bg-muted/70 rounded-full" />
                <div className="h-3 w-16 bg-muted/50 rounded" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* News list */}
      {!isLoading && hasArticles && (
        <div className="space-y-3" data-ocid="icpnews.list">
          {articles.map((item, i) => (
            <motion.a
              key={`${item.url}-${i}`}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: i * 0.03 }}
              className="card-metric flex items-start justify-between gap-3 hover:border-accent/40 hover:bg-accent/5 transition-smooth group cursor-pointer no-underline block"
              data-ocid={`icpnews.item.${i + 1}`}
            >
              <div className="flex-1 min-w-0 space-y-1.5">
                <p className="text-sm font-medium text-foreground group-hover:text-accent transition-smooth line-clamp-2 leading-snug">
                  {item.title}
                </p>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center px-1.5 py-0.5 rounded-full border text-[10px] font-semibold uppercase tracking-wide ${sourceBadgeClass(item.source)}`}
                  >
                    {item.source}
                  </span>
                  <span className="text-xs text-muted-foreground/60">·</span>
                  <span className="text-xs text-muted-foreground">
                    {timeAgo(item.publishedAt)}
                  </span>
                </div>
              </div>
              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-accent transition-smooth shrink-0 mt-0.5" />
            </motion.a>
          ))}
        </div>
      )}

      {/* Fetching state — spinner while waiting, timeout fallback after 20s */}
      {!isLoading && !hasArticles && !isError && (
        <div
          className="card-metric text-center py-10 space-y-3"
          data-ocid="icpnews.fetching_state"
        >
          {timedOut ? (
            <>
              <Newspaper className="w-8 h-8 text-muted-foreground mx-auto" />
              <p className="text-sm font-medium text-foreground">
                Unable to load news right now.
              </p>
              <p className="text-xs text-muted-foreground/70">
                Check back in a moment — news feeds can take a little longer on
                the first load.
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center justify-center">
                <RefreshCw className="w-7 h-7 text-accent animate-spin" />
              </div>
              <p className="text-sm font-medium text-foreground">
                Fetching the latest ICP news...
              </p>
              <p className="text-xs text-muted-foreground/70">
                News feeds are loading via the Internet Computer — this can take
                up to 30 seconds on first load. Please wait.
              </p>
            </>
          )}
          <button
            type="button"
            onClick={() => {
              setTimedOut(false);
              refetch();
            }}
            className="text-xs text-accent hover:underline transition-smooth"
            data-ocid="icpnews.retry_button"
          >
            Retry now
          </button>
        </div>
      )}

      {/* Error state — no cached articles to show */}
      {!isLoading && !hasArticles && isError && (
        <div
          className="card-metric text-center py-10 space-y-3"
          data-ocid="icpnews.error_state"
        >
          <Newspaper className="w-8 h-8 text-muted-foreground mx-auto" />
          <p className="text-sm text-foreground font-medium">
            News feed temporarily unavailable
          </p>
          <p className="text-xs text-muted-foreground/70">
            Check back shortly — the feed will retry automatically.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="text-xs text-accent hover:underline transition-smooth"
            data-ocid="icpnews.retry_button"
          >
            Retry now
          </button>
        </div>
      )}
    </div>
  );
}
