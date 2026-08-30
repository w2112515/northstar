/** Shared domain types for the whole frontend. Pages and components import
 *  from here instead of redeclaring - one shape per API document. */

export type EngineState = {
  clock: { is_open: boolean; next_open?: string };
  account: { equity: number; last_equity: number; cash: number; options_level: number };
  peak_equity: number;
  drawdown_from_peak: number;
  day_pnl_pct: number;
  kill_switch: boolean;
  plan: {
    id: string;
    probability: number;
    feasibility: string;
    guardrails: Record<string, number>;
    status: string;
    created_at?: string;
  } | null;
  goal: {
    capital_base: number;
    target_amount: number | null;
    horizon_months: number | null;
    monthly_target: number | null;
    mode: string;
    risk_level: string;
  } | null;
};

export type BandsDoc = {
  bands: { p10: number[]; p50: number[]; p90: number[] } | null;
  months: number;
  target_amount: number;
  data_note?: string;
  start?: string;
  base?: number;
};

export type Approval = {
  id: string;
  created_at: string;
  status: string;
  order_plan: { human: string; est_max_loss: number };
  proposal: { thesis_human: string; underlying: string };
  verdict: { reason_codes: string[] };
};

export type JEvent = {
  id: string;
  ts: string;
  kind: string;
  human: string;
  payload: Record<string, unknown>;
  refs?: Record<string, string>;
};

export type Position = {
  symbol: string;
  qty: number;
  asset_class: string;
  market_value: number;
  unrealized_pl: number;
};

export type OpenOrder = {
  id: string;
  symbol: string;
  side: string;
  qty: number | null;
  limit_price: number | null;
  status: string;
  created_at: string | null;
};

export type Weather = {
  ts: string;
  score: number | null;
  bucket: "clear" | "choppy" | "storm" | "offline";
  components?: Record<string, { score: number | null; drivers?: string[] } | null>;
  degraded?: string[];
  report: string;
  report_source: string;
} | null;

export type ScoutDoc = {
  ts: string;
  source: string;
  note: string;
  scanned: number;
  passed_floor: number;
  weight_tilt?: string;
  candidates: {
    symbol: string;
    score: number;
    flavor: string;
    reason: string;
    origin: string;
    price: number;
  }[];
};

export type OptionsWatch = {
  ts: string;
  scanned: number;
  ranked: { symbol: string; ann_yield: number; strike: number; dte: number; bid: number; delta: number }[];
} | null;

export type RegimeInfo = {
  label: string;
  streak_days: number;
  realized_vol_20d: number | null;
  breadth_above_50sma: number | null;
};

export type FamilyBucketStats = {
  sharpe?: number | null;
  ann_return?: number | null;
  win_rate?: number | null;
  n_days?: number;
  refused?: string;
};

export type CompassDoc = {
  ts: string;
  regime: RegimeInfo;
  families: Record<string, Record<string, FamilyBucketStats>>;
  hypothesis: string;
  hypothesis_source: string;
};

export type AdvisorProposal = {
  id: string;
  ts: string;
  regime_label: string;
  best_family: string;
  tilts: Record<string, number>;
  evidence: string[];
  status: string;
  decided_ts?: string;
};

export type AdvisorState = {
  proposal?: AdvisorProposal | null;
  history?: AdvisorProposal[];
} | null;

export type Debate = {
  symbol: string;
  direction: string;
  bull: { thesis: string; confidence: number };
  bear: { verdict: string; confidence: number; objection: string };
  outcome: "committed" | "committed_with_caveat" | "dropped_objection" | "dropped_unreviewed";
  headlines?: string[];
};

export type ForecastDoc = {
  ts: string;
  horizon_days: number;
  model: string;
  note: string;
  symbols: Record<
    string,
    {
      last_close: number;
      point: number[];
      q10: number[];
      q50: number[];
      q90: number[];
      exp_5d_pct: number;
      q10_5d_pct: number;
      q90_5d_pct: number;
    }
  >;
};

export type ForecastSkill = {
  coverage_q10_q90?: number;
  n_checks?: number;
  pinball_q50_pct?: number;
  ts?: string;
} | null;

/** The daily brief (nightly digest event payload). */
export type Brief = {
  date: string;
  fills: number;
  realized_total: number;
  realized_by_family: Record<string, number>;
  gate_rejections: number;
  watch_tomorrow: string[];
  narrative: string;
  narrator: string;
};

export type Trace = {
  ts: string;
  reason: string;
  dry_run: boolean;
  nodes: { name: string; ms: number; llm: boolean }[];
  facts: {
    triage_mode: string | null;
    triage_llm: boolean;
    n_proposals: number;
    n_executed: number;
    n_exits: number;
    n_rejected: number;
    n_needs_human: number;
    digest_llm: boolean;
  };
};

export type PassProgress = {
  node: string;
  status: "running" | "done";
  run_id: string;
  reason: string;
  ts: string;
};

export type CatalogEntry = {
  family: string;
  name: string;
  plain: string;
  asset: string;
  risk: string;
  runnable: boolean;
};

export type Instance = {
  id: string;
  family: string;
  version: string;
  status: string;
  enabled: boolean;
  params: Record<string, unknown>;
  lineage: { parent_version: string | null; hypothesis: string };
};

export type BacktestReport = {
  is_sharpe: number | null;
  oos_sharpe: number | null;
  ann_return: number | null;
  max_dd: number | null;
  win_rate: number | null;
  trials_in_family: number;
  data_note: string;
};

export type Experiment = {
  id: string;
  created_at: string;
  family: string;
  parent_version: string;
  hypothesis: string;
  proposed_by: string;
  params_delta: Record<string, number>;
  backtest: BacktestReport | null;
  status: string;
  verdict_reason: string;
};

export type FactorRow = {
  factor: string;
  ic_mean: number | null;
  ic_recent: number | null;
  t_stat: number | null;
  n_days: number;
};

export type FactorDoc = {
  ts: string;
  universe_size?: number;
  window_days?: number;
  fwd_days?: number;
  note?: string;
  refused?: string;
  rows: FactorRow[];
} | null;

export type MinedCandidate = {
  id: string;
  name: string;
  terms: Record<string, number>;
  ic_mean: number | null;
  ic_recent: number | null;
  deflated_ic: number | null;
  n_days: number;
  status: string;
};

export type LibraryFactor = {
  id: string;
  name: string;
  admission_ic: number | null;
  decayed: boolean;
  ic_history: { ts: string; ic_recent: number | null }[];
};

export type MiningState = {
  mining: { tried_total?: number; pending?: MinedCandidate[]; ts?: string } | null;
  library: { factors?: LibraryFactor[] } | null;
};

export type FloorMetrics = { sharpe: number | null; max_dd: number | null; ann_return: number | null };

export type WeatherValidation = {
  ok: boolean;
  error?: string;
  proxy_note?: string;
  window?: { start: string; end: string; is_days: number; oos_days: number };
  in_sample?: { chosen_floor: number; table: (FloorMetrics & { floor: number; days_flat: number })[] };
  oos?: {
    floor: number;
    baseline: FloorMetrics;
    gated: FloorMetrics;
    storm_days: number;
    verdict: string;
  };
  cached?: boolean;
};
