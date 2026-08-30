import type { McBand, Temperament } from "./types";
import { clamp } from "./format";

export const BEST_HISTORICAL_YEAR = 0.34;

export const GUARDRAILS: Record<
  Temperament,
  { maxRisk: number; drawdownPause: number; maxOptions: number; label: string }
> = {
  conservative: {
    maxRisk: 0.005,
    drawdownPause: 0.06,
    maxOptions: 0,
    label: "Conservative",
  },
  balanced: {
    maxRisk: 0.01,
    drawdownPause: 0.1,
    maxOptions: 0.15,
    label: "Balanced",
  },
  aggressive: {
    maxRisk: 0.02,
    drawdownPause: 0.16,
    maxOptions: 0.3,
    label: "Aggressive",
  },
};

const EXPECTED: Record<Temperament, number> = {
  conservative: 0.07,
  balanced: 0.11,
  aggressive: 0.15,
};

const VOL: Record<Temperament, number> = {
  conservative: 0.08,
  balanced: 0.13,
  aggressive: 0.2,
};

function erf(x: number) {
  const s = x < 0 ? -1 : 1;
  const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-a * a);
  return s * y;
}

function normalCdf(z: number) {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

export function requiredAnnualized(start: number, target: number, months: number) {
  if (start <= 0 || months <= 0 || target <= 0) return 0;
  return Math.pow(target / start, 12 / months) - 1;
}

export function arrivalOdds(
  start: number,
  target: number,
  months: number,
  temperament: Temperament,
) {
  const T = Math.max(months, 1) / 12;
  const expected = EXPECTED[temperament];
  const vol = VOL[temperament];
  const mu = Math.log(1 + expected) - 0.5 * vol * vol;
  const meanLog = mu * T;
  const sdLog = vol * Math.sqrt(T);
  if (sdLog <= 0) return target <= start ? 0.99 : 0.01;
  const z = (Math.log(target / start) - meanLog) / sdLog;
  return clamp(1 - normalCdf(z), 0.02, 0.97);
}

export function terminalQuantile(
  start: number,
  months: number,
  temperament: Temperament,
  q: number,
) {
  const T = Math.max(months, 1) / 12;
  const expected = EXPECTED[temperament];
  const vol = VOL[temperament];
  const mu = Math.log(1 + expected) - 0.5 * vol * vol;
  const meanLog = mu * T;
  const sdLog = vol * Math.sqrt(T);
  const z = invNorm(q);
  return start * Math.exp(meanLog + sdLog * z);
}

function invNorm(p: number) {
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.383577509590705e2, -3.066479806614716e1, 2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068071618818e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
    -2.549732539343734, 4.374664141464968, 2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
    3.754408661907416,
  ];
  const plow = 0.02425;
  const phigh = 1 - plow;
  if (p < plow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  if (p > phigh) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return (
      -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }
  const q = p - 0.5;
  const r = q * q;
  return (
    ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
    (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  );
}

export function monteCarloBand(
  start: number,
  months: number,
  temperament: Temperament,
): McBand[] {
  const out: McBand[] = [{ month: 0, p10: start, p50: start, p90: start }];
  for (let m = 1; m <= months; m++) {
    out.push({
      month: m,
      p10: terminalQuantile(start, m, temperament, 0.1),
      p50: terminalQuantile(start, m, temperament, 0.5),
      p90: terminalQuantile(start, m, temperament, 0.9),
    });
  }
  return out;
}

export function feasibilityVerdict(odds: number, required: number) {
  if (required > BEST_HISTORICAL_YEAR) return "unrealistic" as const;
  if (odds >= 0.6) return "reachable" as const;
  if (odds >= 0.35) return "possible" as const;
  return "thin" as const;
}

export function verdictCopy(v: ReturnType<typeof feasibilityVerdict>) {
  switch (v) {
    case "reachable":
      return "Reachable in this weather";
    case "possible":
      return "Possible, not comfortable";
    case "thin":
      return "Thin odds with this fleet";
    case "unrealistic":
      return "Unrealistic with this fleet";
  }
}

export function redPathOptions(start: number, target: number, months: number) {
  const required = requiredAnnualized(start, target, months);
  const extendYears = 3;
  const extendMonths = extendYears * 12;
  const extendRequired = requiredAnnualized(start, target, extendMonths);
  const lowerTarget = Math.round(start * 1.2);
  const lowerRequired = requiredAnnualized(start, lowerTarget, months);
  return {
    required,
    best: BEST_HISTORICAL_YEAR,
    extendYears,
    extendMonths,
    extendRequired,
    lowerTarget,
    lowerRequired,
  };
}

export function allocationFor(temperament: Temperament) {
  if (temperament === "conservative") {
    return [
      { name: "Core Trend", pct: 40, reason: "Index beta is the keel; we don't fight the regime." },
      { name: "Weather Floor", pct: 25, reason: "Cuts sail when the station says stressed." },
      { name: "Drift Harvest", pct: 15, reason: "Small factor tilts. Costs matter more than alpha here." },
      { name: "Cash buffer", pct: 20, reason: "Dry powder. The gate likes room." },
    ];
  }
  if (temperament === "aggressive") {
    return [
      { name: "Core Trend", pct: 35, reason: "Still the keel — aggression lives in size, not in abandoning beta." },
      { name: "Drift Harvest", pct: 25, reason: "Wider factor book, still capped per name." },
      { name: "Scout Options", pct: 20, reason: "Premium only when IV clears the weather floor." },
      { name: "Weather Floor", pct: 10, reason: "Keeps the hard stop honest." },
      { name: "Cash buffer", pct: 10, reason: "Thinner reserve, still enough to open the gate." },
    ];
  }
  return [
    { name: "Core Trend", pct: 45, reason: "Index beta is the keel; we don't fight the regime." },
    { name: "Drift Harvest", pct: 25, reason: "Small factor tilts, never a concentrated bet." },
    { name: "Weather Floor", pct: 20, reason: "Cuts sail when the station says stressed." },
    { name: "Cash buffer", pct: 10, reason: "Dry powder for the gate." },
  ];
}

export function scoreTemperament(answers: Array<Temperament | null>): Temperament {
  const counts = { conservative: 0, balanced: 0, aggressive: 0 };
  for (const a of answers) {
    if (a) counts[a] += 1;
  }
  if (counts.conservative >= 2) return "conservative";
  if (counts.aggressive >= 2) return "aggressive";
  return "balanced";
}
