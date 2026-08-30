import { isNySessionOpen } from "./format";
import type { MarketOverride } from "./types";

export function resolveMarketOpen(override: MarketOverride, now = new Date()) {
  if (override === "open") return true;
  if (override === "closed") return false;
  return isNySessionOpen(now);
}
