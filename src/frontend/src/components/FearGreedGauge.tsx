import type { FearGreedResult } from "@/backend";
import { motion } from "motion/react";

function scoreColor(score: number): string {
  if (score <= 25) return "oklch(0.6 0.2 22)";
  if (score <= 45) return "oklch(0.65 0.19 50)";
  if (score <= 55) return "oklch(0.7 0.18 90)";
  if (score <= 75) return "oklch(0.68 0.2 145)";
  return "oklch(0.65 0.22 165)";
}

function scoreLabel(score: number): string {
  if (score <= 25) return "Extreme Fear";
  if (score <= 45) return "Fear";
  if (score <= 55) return "Neutral";
  if (score <= 75) return "Greed";
  return "Extreme Greed";
}

const ZONES = [
  { label: "Extreme Fear", color: "oklch(0.6 0.2 22)", pct: 0.25 },
  { label: "Fear", color: "oklch(0.65 0.19 50)", pct: 0.2 },
  { label: "Neutral", color: "oklch(0.7 0.18 90)", pct: 0.1 },
  { label: "Greed", color: "oklch(0.68 0.2 145)", pct: 0.2 },
  { label: "Extreme Greed", color: "oklch(0.65 0.22 165)", pct: 0.25 },
];

// SVG semicircle arc helpers
const CX = 120;
const CY = 110;
const R = 88;

function polarToXY(angleDeg: number) {
  const rad = ((angleDeg - 180) * Math.PI) / 180;
  return {
    x: CX + R * Math.cos(rad),
    y: CY + R * Math.sin(rad),
  };
}

function arcPath(startDeg: number, endDeg: number): string {
  const start = polarToXY(startDeg);
  const end = polarToXY(endDeg);
  const largeArc = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${R} ${R} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

export function FearGreedGauge({ data }: { data: FearGreedResult | null }) {
  const score = data ? Number(data.score) : null;
  const label = data?.labelText ?? (score !== null ? scoreLabel(score) : "—");

  // Needle: 0 = leftmost (0°), 100 = rightmost (180°) mapped to SVG 0°..180°
  const needleDeg = score !== null ? (score / 100) * 180 : 0;

  // Build arc segments
  let cursor = 0;
  const segments = ZONES.map((z) => {
    const startDeg = cursor * 180;
    const endDeg = (cursor + z.pct) * 180;
    cursor += z.pct;
    return { ...z, startDeg, endDeg };
  });

  return (
    <div
      className="card-metric h-full flex flex-col items-center gap-3"
      data-ocid="fear_greed.card"
    >
      <div className="flex items-center justify-between w-full">
        <span className="text-sm-metric">Fear &amp; Greed Index</span>
        {score !== null && (
          <span
            className="text-xs font-mono font-semibold px-2 py-0.5 rounded-full border"
            style={{
              color: scoreColor(score),
              borderColor: scoreColor(score),
              backgroundColor:
                `${scoreColor(score).slice(0, -1)} / 0.12)`.replace(
                  "oklch(",
                  "oklch(",
                ),
            }}
          >
            {score}
          </span>
        )}
      </div>

      <div className="relative" style={{ width: 240, height: 130 }}>
        <svg
          viewBox="0 0 240 120"
          width={240}
          height={120}
          role="img"
          aria-label={`Fear and greed score: ${score ?? "loading"}`}
        >
          <title>{`Fear and greed score: ${score ?? "loading"}`}</title>
          {/* Background track */}
          <path
            d={arcPath(0, 180)}
            fill="none"
            stroke="oklch(0.22 0.01 245)"
            strokeWidth={14}
            strokeLinecap="round"
          />
          {/* Colored zone arcs */}
          {segments.map((seg) => (
            <path
              key={seg.label}
              d={arcPath(seg.startDeg, seg.endDeg)}
              fill="none"
              stroke={seg.color}
              strokeWidth={14}
              strokeLinecap="butt"
              opacity={0.75}
            />
          ))}
          {/* Needle */}
          {score !== null && (
            <motion.g
              initial={{ rotate: -90 }}
              animate={{ rotate: needleDeg - 90 }}
              transition={
                window.matchMedia("(prefers-reduced-motion: reduce)").matches
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 60, damping: 14 }
              }
              style={{ originX: `${CX}px`, originY: `${CY}px` }}
            >
              <line
                x1={CX}
                y1={CY}
                x2={CX}
                y2={CY - R + 10}
                stroke="oklch(0.94 0.02 260)"
                strokeWidth={2.5}
                strokeLinecap="round"
              />
              <circle cx={CX} cy={CY} r={5} fill="oklch(0.94 0.02 260)" />
            </motion.g>
          )}
          {/* Skeleton if loading */}
          {score === null && (
            <rect
              x={60}
              y={50}
              width={120}
              height={16}
              rx={8}
              fill="oklch(0.22 0.01 245)"
              className="animate-pulse"
            />
          )}
        </svg>
      </div>

      {/* Score and label */}
      <div className="flex flex-col items-center gap-0.5 -mt-4">
        {score !== null ? (
          <>
            <span
              className="font-mono text-3xl font-bold tabular-nums"
              style={{ color: scoreColor(score) }}
              data-ocid="fear_greed.score"
            >
              {score}
            </span>
            <span
              className="text-sm font-medium"
              style={{ color: scoreColor(score) }}
              data-ocid="fear_greed.label"
            >
              {label}
            </span>
          </>
        ) : (
          <>
            <div
              className="h-8 w-16 bg-muted rounded animate-pulse"
              data-ocid="fear_greed.loading_state"
            />
            <div className="h-4 w-20 bg-muted rounded animate-pulse mt-1" />
          </>
        )}
      </div>

      {/* Zone legend */}
      <div className="flex gap-2 flex-wrap justify-center">
        {ZONES.map((z) => (
          <span
            key={z.label}
            className="text-[10px] px-1.5 py-0.5 rounded font-medium"
            style={{
              color: z.color,
              background: `${z.color.slice(0, -1)} / 0.12)`,
            }}
          >
            {z.label}
          </span>
        ))}
      </div>
    </div>
  );
}
