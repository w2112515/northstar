export type GoalMode = "amount" | "income";
export type Temperament = "conservative" | "balanced" | "aggressive";
export type CircuitBreaker = "none" | "soft" | "hard";
export type MarketOverride = "auto" | "open" | "closed";
export type StrategyStatus = "sailing" | "docked" | "champion" | "coming";
export type RiskLevel = "low" | "medium" | "high";
export type AgentKind = "code" | "gemini";

export type JournalKind =
  | "proposal"
  | "verdict"
  | "order"
  | "fill"
  | "pnl"
  | "approval"
  | "debate"
  | "digest"
  | "scout"
  | "forecast"
  | "experiment"
  | "trace"
  | "system";

export interface VoyageConfig {
  onboarded: boolean;
  startingCapital: number;
  goalMode: GoalMode;
  targetAmount: number;
  monthlyIncome: number;
  deadlineMonths: number;
  temperament: Temperament;
  startedAt: string;
  firstDay: boolean;
}

export interface Position {
  id: string;
  symbol: string;
  humanName: string;
  qty: number;
  multiplier: number;
  avgCost: number;
  last: number;
  side: "long" | "short";
  openedAt: string;
  family: string;
}

export interface QueuedOrder {
  id: string;
  symbol: string;
  humanName: string;
  side: "buy" | "sell";
  qty: number;
  type: "limit" | "market";
  limit?: number;
  reason: string;
  createdAt: string;
}

export interface Proposal {
  id: string;
  symbol: string;
  humanName: string;
  side: "buy" | "sell";
  qty: number;
  price: number;
  why: string;
  pausedWhy: string;
  worstCase: number;
  family: string;
  createdAt: string;
}

export interface JournalEvent {
  id: string;
  ts: string;
  kind: JournalKind;
  title: string;
  body: string;
  aiNarrated: boolean;
  refs: string[];
  raw: Record<string, unknown>;
}

export interface StrategyDef {
  id: string;
  name: string;
  sentence: string;
  risk: RiskLevel;
  status: StrategyStatus;
  family: string;
  version: string;
  params: string;
}

export interface StrategyInstance {
  id: string;
  strategyId: string;
  family: string;
  version: string;
  status: "running" | "paused" | "docked";
  params: string;
  startedAt: string;
}

export interface ScoutCandidate {
  id: string;
  symbol: string;
  score: number;
  why: string;
  flavors: string[];
}

export interface OptionWatch {
  id: string;
  humanName: string;
  yield: number;
  dte: number;
  iv: number;
  note: string;
}

export interface PromotionCandidate {
  id: string;
  name: string;
  family: string;
  oosSharpe: number;
  maxDd: number;
  winRate: number;
  note: string;
  status: "challenger" | "archived";
}

export interface ExperimentRow {
  id: string;
  name: string;
  family: string;
  result: "promoted" | "failed" | "running" | "archived";
  oosSharpe: number;
  note: string;
  ts: string;
}

export interface FactorRow {
  id: string;
  name: string;
  ic: number;
  deflatedIc: number;
  horizon: string;
  decay: "fresh" | "aging" | "decayed";
  admitted: boolean;
  pending?: boolean;
}

export interface Candle {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  fill?: "buy" | "sell";
}

export interface ForecastPoint {
  t: string;
  mid: number;
  lo: number;
  hi: number;
}

export interface McBand {
  month: number;
  p10: number;
  p50: number;
  p90: number;
}

export interface WatchItem {
  symbol: string;
  last: number;
  change: number;
  group: "holdings" | "scout" | "core";
}

export interface CaptainsLog {
  sentences: string[];
  aiNarrated: boolean;
  ts: string;
}

export interface HelmAdvice {
  id: string;
  title: string;
  body: string;
  adopted: boolean | null;
}

export type PassStep =
  | "idle"
  | "perceive"
  | "guard"
  | "triage"
  | "signals"
  | "gate"
  | "explain"
  | "record";
