import type { SocialTrendingResult } from "@/backend";
import { useSocialTrending } from "@/hooks/useQueries";
import { motion } from "motion/react";

const ZONES = [
  {
    label: "Cold",
    min: 0,
    max: 20,
    color: "oklch(0.6 0.18 240)",
    bg: "oklch(0.6 0.18 240 / 0.15)",
  },
  {
    label: "Cool",
    min: 21,
    max: 40,
    color: "oklch(0.65 0.17 195)",
    bg: "oklch(0.65 0.17 195 / 0.15)",
  },
  {
    label: "Neutral",
    min: 41,
    max: 60,
    color: "oklch(0.58 0.01 250)",
    bg: "oklch(0.58 0.01 250 / 0.12)",
  },
  {
    label: "Warm",
    min: 61,
    max: 80,
    color: "oklch(0.68 0.19 60)",
    bg: "oklch(0.68 0.19 60 / 0.15)",
  },
  {
    label: "Hot",
    min: 81,
    max: 100,
    color: "oklch(0.6 0.22 22)",
    bg: "oklch(0.6 0.22 22 / 0.15)",
  },
];

function getZone(score: number) {
  return ZONES.find((z) => score >= z.min && score <= z.max) ?? ZONES[2];
}

function formatAge(ns: bigint): string {
  const ms = Number(ns / 1_000_000n);
  const diffSec = Math.floor((Date.now() - ms) / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  return `${diffHr}h ago`;
}

function SocialBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const zone = getZone(score);

  return (
    <div
      className="relative h-4 w-full rounded-full overflow-hidden"
      style={{ background: "oklch(0.22 0.01 245 / 0.4)" }}
      role="presentation"
    >
      {/* zone gradient segments */}
      {ZONES.map((z) => (
        <div
          key={z.label}
          className="absolute top-0 h-full opacity-30 rounded-full"
          style={{
            left: `${z.min}%`,
            width: `${z.max - z.min}%`,
            background: z.color,
          }}
        />
      ))}
      {/* filled progress */}
      <motion.div
        className="absolute top-0 left-0 h-full rounded-full"
        initial={{ width: "0%" }}
        animate={{ width: `${pct}%` }}
        transition={{
          type: "spring",
          stiffness: 50,
          damping: 14,
          duration: 0.8,
        }}
        style={{ background: zone.color, opacity: 0.9 }}
      />
      {/* thumb dot */}
      <motion.div
        className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2"
        initial={{ left: "0%" }}
        animate={{ left: `calc(${pct}% - 7px)` }}
        transition={{ type: "spring", stiffness: 50, damping: 14 }}
        style={{
          background: zone.color,
          borderColor: "var(--card)",
          boxShadow: `0 0 6px ${zone.color}`,
        }}
      />
    </div>
  );
}

interface SocialTrendingCardProps {
  data: SocialTrendingResult | null | undefined;
  isLoading?: boolean;
}

export function SocialTrendingCard({
  data,
  isLoading,
}: SocialTrendingCardProps) {
  const score = data?.score ?? null;
  const zone = score !== null ? getZone(score) : null;

  return (
    <div
      className="card-metric h-full flex flex-col gap-3"
      data-ocid="social_trending.card"
    >
      {/* Header */}
      <div className="flex items-center justify-between w-full">
        <span className="text-sm-metric">Social Trending</span>
        {score !== null && zone && (
          <span
            className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full border"
            style={{
              color: zone.color,
              borderColor: zone.color,
              background: zone.bg,
            }}
            data-ocid="social_trending.score_badge"
          >
            {score}
          </span>
        )}
      </div>

      {/* Score display */}
      <div className="flex flex-col items-center gap-1 py-2">
        {isLoading || score === null ? (
          <>
            <div
              className="h-10 w-20 bg-muted rounded animate-pulse"
              data-ocid="social_trending.loading_state"
            />
            <div className="h-4 w-16 bg-muted rounded animate-pulse mt-1" />
          </>
        ) : (
          <motion.div
            className="flex flex-col items-center gap-0.5"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <span
              className="font-mono text-4xl font-bold tabular-nums"
              style={{ color: zone?.color }}
              data-ocid="social_trending.score"
            >
              {score}
            </span>
            <span
              className="text-sm font-semibold"
              style={{ color: zone?.color }}
              data-ocid="social_trending.label"
            >
              {zone?.label}
            </span>
          </motion.div>
        )}
      </div>

      {/* Bar */}
      {score !== null && (
        <div className="px-1">
          <SocialBar score={score} />
          <div className="flex justify-between mt-1">
            <span className="text-[9px] text-muted-foreground/60 font-mono">
              0
            </span>
            <span className="text-[9px] text-muted-foreground/60 font-mono">
              100
            </span>
          </div>
        </div>
      )}

      {/* Zone legend */}
      <div className="flex gap-1.5 flex-wrap justify-center">
        {ZONES.map((z) => (
          <span
            key={z.label}
            className="text-[10px] px-1.5 py-0.5 rounded font-medium"
            style={{ color: z.color, background: z.bg }}
          >
            {z.label}
          </span>
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground/60 mt-auto pt-1 border-t border-border/40">
        <span>Reddit · X · GitHub</span>
        <div className="flex items-center gap-1">
          {data?.isStale && (
            <span className="text-amber-500/80 font-medium uppercase tracking-wide">
              stale
            </span>
          )}
          {data?.fetchedAt !== undefined && (
            <span>{formatAge(data.fetchedAt)}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// Convenience wrapper that fetches its own data
export function SocialTrending({
  refetchInterval = 60_000,
}: { refetchInterval?: number }) {
  const { data, isLoading } = useSocialTrending(refetchInterval);
  return <SocialTrendingCard data={data} isLoading={isLoading} />;
}
