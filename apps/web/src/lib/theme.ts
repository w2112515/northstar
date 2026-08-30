/** Single source of truth for every canvas/chart color and shared chart
 *  styling. recharts and lightweight-charts cannot read CSS variables from
 *  their canvas/SVG internals, so they import from here.
 *
 *  SYNC OBLIGATION: these values mirror the @theme tokens in globals.css
 *  (Grok-prototype Night Voyage palette). Change a token there → change it
 *  here in the same commit. UI components must use the Tailwind token
 *  classes instead of importing this file. */

export const CHART = {
  // star-moment gold (token --gold): destination, sailed path, champion
  gold: "#f5c542",
  goldSoft: "rgba(245,197,66,0.55)",
  // money in (token --teal)
  teal: "#35d0ba",
  tealFill: "rgba(53,208,186,0.26)",
  // money out / danger (token --coral)
  coral: "#ff6b6b",
  coralFill: "rgba(255,107,107,0.22)",
  // external systems / forecast bands (token --signal)
  signal: "#5b8def",
  signalSoft: "rgba(91,141,239,0.5)",
  // waiting on a human (token --amber)
  amber: "#f0a860",
  // neutrals
  ink: "#e7eef9",
  mist: "#a2b3d1",
  line: "#24334f",
  grid: "rgba(36,51,79,0.5)",
  void: "#0b1220",
  night: "#121c30",
  panel: "#1a2740",
} as const;

/** recharts <Tooltip contentStyle> - one tooltip face for the whole app. */
export const RECHARTS_TOOLTIP = {
  background: CHART.panel,
  border: `1px solid ${CHART.line}`,
  borderRadius: 12,
  fontSize: 11,
  color: CHART.ink,
} as const;

/** recharts axis tick style (11px = text-2xs). */
export const AXIS_TICK = { fontSize: 11, fill: CHART.mist } as const;
