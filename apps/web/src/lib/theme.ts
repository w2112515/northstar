/** Single source of truth for every canvas/chart color and shared chart
 *  styling. recharts, lightweight-charts and @xyflow/react cannot read CSS
 *  variables from their canvas/SVG internals, so they import from here.
 *
 *  SYNC OBLIGATION: CHART mirrors the :root tokens in globals.css (Night
 *  Ledger v4 - one night palette for the whole app). Change a token there
 *  → change it here in the same commit. UI components must use the
 *  Tailwind token classes instead of this file. */

export const CHART = {
  // the one interactive accent (token --indigo, prototype "signal")
  indigo: "#5b8def",
  indigoSoft: "rgba(91,141,239,0.45)",
  // star moments only: the target, the voyage line, AI narration (token --star)
  star: "#f5c542",
  starSoft: "rgba(245,197,66,0.5)",
  // deterministic code / CODE tags (token --teal)
  teal: "#35d0ba",
  // Monte Carlo cone: ink at low alpha on the night plate
  cone: "rgba(231,238,249,0.10)",
  median: "#a2b3d1",
  // verified / money in (token --green)
  green: "#4caf8e",
  greenFill: "rgba(76,175,142,0.28)",
  // rejected / money out (token --red, prototype "coral")
  red: "#ff6b6b",
  redFill: "rgba(255,107,107,0.22)",
  // waiting on a human (token --amber)
  amber: "#f0a860",
  // neutrals
  ink: "#e7eef9",
  ink2: "#a2b3d1",
  hairline: "#24334f",
  grid: "rgba(231,238,249,0.09)",
  paper: "#0b1220",
  raised: "#121c30",
  inset: "#1a2740",
} as const;

/** recharts <Tooltip contentStyle> - one tooltip face for the whole app.
 *  fontSize 11 = text-micro; the type scale has no 12. */
export const RECHARTS_TOOLTIP = {
  background: CHART.raised,
  border: `1px solid ${CHART.hairline}`,
  borderRadius: 2,
  fontSize: 11,
  color: CHART.ink,
} as const;

/** recharts axis tick style (11px = text-micro). */
export const AXIS_TICK = { fontSize: 11, fill: CHART.ink2 } as const;
