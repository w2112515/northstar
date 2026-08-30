/** Single source of truth for every canvas/chart color and shared chart
 *  styling. recharts, lightweight-charts and @xyflow/react cannot read CSS
 *  variables from their canvas/SVG internals, so they import from here.
 *
 *  SYNC OBLIGATION: CHART mirrors the :root tokens in globals.css;
 *  CHART_DARK mirrors the .start-dark scope (the /start wizard, the only
 *  dark room). Change a token there → change it here in the same commit.
 *  UI components must use the Tailwind token classes instead of this file. */

export const CHART = {
  // the one accent (token --indigo)
  indigo: "#2b4bd8",
  indigoSoft: "rgba(43,75,216,0.45)",
  // Monte Carlo cone: ink at low alpha on paper
  cone: "rgba(22,24,29,0.07)",
  median: "#565d6b",
  // verified / money in (token --green, darkened past AA on paper)
  green: "#17724a",
  greenFill: "rgba(23,114,74,0.28)",
  // rejected / money out (token --red)
  red: "#c63b3b",
  redFill: "rgba(198,59,59,0.24)",
  // waiting on a human (token --amber, darkened past AA on paper)
  amber: "#8a5a08",
  // neutrals
  ink: "#16181d",
  ink2: "#565d6b",
  hairline: "#e4e1d8",
  grid: "rgba(22,24,29,0.07)",
  paper: "#faf9f6",
  raised: "#ffffff",
  inset: "#f3f1ea",
} as const;

/** Dark plate palette - only inside the /start wizard. */
export const CHART_DARK = {
  star: "#f5c542",
  starSoft: "rgba(245,197,66,0.5)",
  ink: "#e8edf6",
  ink2: "#9aa7c0",
  hairline: "#26334c",
  grid: "rgba(232,237,246,0.09)",
  cone: "rgba(232,237,246,0.10)",
  median: "#9aa7c0",
  indigo: "#8aa2ff",
  green: "#4caf8e",
  red: "#e0655f",
  amber: "#d9a23b",
  paper: "#0d1420",
  raised: "#131c2e",
  inset: "#0a101b",
} as const;

/** recharts <Tooltip contentStyle> - one tooltip face per theme.
 *  fontSize 11 = text-micro; the type scale has no 12. */
export const RECHARTS_TOOLTIP = {
  background: CHART.raised,
  border: `1px solid ${CHART.hairline}`,
  borderRadius: 2,
  fontSize: 11,
  color: CHART.ink,
} as const;

export const RECHARTS_TOOLTIP_DARK = {
  background: CHART_DARK.raised,
  border: `1px solid ${CHART_DARK.hairline}`,
  borderRadius: 2,
  fontSize: 11,
  color: CHART_DARK.ink,
} as const;

/** recharts axis tick style (11px = text-micro). */
export const AXIS_TICK = { fontSize: 11, fill: CHART.ink2 } as const;
export const AXIS_TICK_DARK = { fontSize: 11, fill: CHART_DARK.ink2 } as const;
