# ICP Portfolio Value Calculator — Design Brief

**Tone**: Clean, focused, minimal. Data-driven interface for financial clarity. Friendly but professional.
**Differentiation**: Three-metric visual hierarchy — input, live price, total value. Maximum data clarity with zero decoration.
**Primary Font**: General Sans (display & body). Secondary: Geist Mono (numbers & metrics).
**Palette**: Dark mode only. Cool background (L 0.12), cyan/teal accents (L 0.58–0.62, H 250°–280°).
**Shape Language**: Rounded 10px, subtle shadows, minimal borders.

## Palette
| Token | OKLCH | Purpose |
|---|---|---|
| background | 0.12 0.01 250 | Page background, primary dark |
| foreground | 0.94 0.02 260 | Default text |
| card | 0.16 0.01 245 | Metric cards, input container |
| primary | 0.58 0.19 280 | Button CTA, interactive elements |
| accent | 0.62 0.21 250 | Highlights, metric numbers |
| border | 0.25 0.01 240 | Card borders, dividers |
| muted | 0.22 0.01 245 | Secondary text, labels |

## Structural Zones
| Zone | Treatment | Notes |
|---|---|---|
| Header | Subtle text on background | Title + description, no visible container |
| Input Card | bg-card with border, shadow-subtle | Centered, width-constrained (max 480px) |
| Metrics Row | Three cards side-by-side | Equal width, accent-colored number text |
| Footer | Text on background + border-t | Refresh indicator (auto-update every 30s) |

## Component Patterns
- **Input**: Full-width, mono font, focus ring in accent color, smooth transition
- **Metrics**: Large accent-colored numbers (text-accent font-mono), muted labels above
- **Cards**: Uniform border, subtle shadow, rounded corners (10px), padding 4 (1rem)

## Motion
- Transition default: all 0.3s cubic-bezier(0.4, 0, 0.2, 1)
- No animations beyond focus/hover states
- Refresh indicator: subtle pulse or opacity change (optional)

## Constraints
- Single dark mode only (no light theme)
- No decoration, gradients, or illustrations
- Mobile-first responsive layout (stack metrics on small screens)
- Max container width 800px for readability
