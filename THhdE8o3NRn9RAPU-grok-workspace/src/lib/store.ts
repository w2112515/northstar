import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  CircuitBreaker,
  ExperimentRow,
  FactorRow,
  HelmAdvice,
  JournalEvent,
  JournalKind,
  MarketOverride,
  PassStep,
  Position,
  PromotionCandidate,
  Proposal,
  QueuedOrder,
  StrategyDef,
  StrategyInstance,
  VoyageConfig,
} from "./types";
import {
  PASS_SCRIPTS,
  firstDayJournal,
  firstDayLog,
  freshVoyage,
  sampleAdvice,
  sampleCash,
  sampleExperiments,
  sampleFactors,
  sampleInstances,
  sampleJournal,
  sampleLog,
  sampleOrders,
  samplePositions,
  samplePromotions,
  sampleProposals,
  sampleStrategies,
  sampleVoyage,
} from "./seed";
import { uid } from "./format";
import type { CaptainsLog } from "./types";

export interface VoyageState {
  hasHydrated: boolean;
  voyage: VoyageConfig;
  cash: number;
  todayPct: number;
  oddsOverride: number | null;
  positions: Position[];
  orders: QueuedOrder[];
  proposals: Proposal[];
  journal: JournalEvent[];
  strategies: StrategyDef[];
  instances: StrategyInstance[];
  promotions: PromotionCandidate[];
  experiments: ExperimentRow[];
  factors: FactorRow[];
  advice: HelmAdvice;
  log: CaptainsLog;
  autopilot: boolean;
  killSwitch: boolean;
  circuitBreaker: CircuitBreaker;
  marketOverride: MarketOverride;
  passRunning: boolean;
  passStep: PassStep;
  passIndex: number;
  loadingDemo: boolean;

  setHasHydrated: (v: boolean) => void;
  completeOnboarding: (cfg: VoyageConfig) => void;
  loadSample: () => void;
  loadFirstDay: () => void;
  setAutopilot: (v: boolean) => void;
  setKillSwitch: (v: boolean) => void;
  setCircuitBreaker: (v: CircuitBreaker) => void;
  setMarketOverride: (v: MarketOverride) => void;
  runPass: () => void;
  finishPass: () => void;
  advancePass: (step: PassStep) => void;
  approveProposal: (id: string) => void;
  skipProposal: (id: string) => void;
  closePosition: (id: string) => void;
  cancelOrder: (id: string) => void;
  toggleStrategy: (id: string) => void;
  promote: (id: string) => void;
  archivePromo: (id: string) => void;
  adoptAdvice: () => void;
  dismissAdvice: () => void;
  admitFactor: (id: string) => void;
  dismissFactor: (id: string) => void;
  setLoadingDemo: (v: boolean) => void;
}

const STEPS: PassStep[] = [
  "perceive",
  "guard",
  "triage",
  "signals",
  "gate",
  "explain",
  "record",
];

let passTimer: ReturnType<typeof setTimeout> | null = null;

function pushJournal(
  journal: JournalEvent[],
  partial: Omit<JournalEvent, "id" | "ts"> & { ts?: string },
): JournalEvent[] {
  const ev: JournalEvent = {
    id: uid("j"),
    ts: partial.ts ?? new Date().toISOString(),
    kind: partial.kind,
    title: partial.title,
    body: partial.body,
    aiNarrated: partial.aiNarrated,
    refs: partial.refs,
    raw: partial.raw,
  };
  return [ev, ...journal];
}

function positionValue(p: Position) {
  return p.qty * p.last * p.multiplier;
}

function positionPnl(p: Position) {
  return (p.last - p.avgCost) * p.qty * p.multiplier;
}

export function bookEquity(cash: number, positions: Position[]) {
  return cash + positions.reduce((s, p) => s + positionValue(p), 0);
}

export { positionValue, positionPnl };

function sampleState() {
  return {
    voyage: sampleVoyage(),
    cash: sampleCash,
    todayPct: 1.2,
    oddsOverride: 0.68,
    positions: samplePositions(),
    orders: sampleOrders(),
    proposals: sampleProposals(),
    journal: sampleJournal(),
    strategies: sampleStrategies(),
    instances: sampleInstances(),
    promotions: samplePromotions(),
    experiments: sampleExperiments(),
    factors: sampleFactors(),
    advice: sampleAdvice(),
    log: sampleLog(),
    autopilot: false,
    killSwitch: false,
    circuitBreaker: "none" as CircuitBreaker,
    marketOverride: "auto" as MarketOverride,
    passRunning: false,
    passStep: "idle" as PassStep,
    passIndex: 0,
    loadingDemo: false,
  };
}

export const useVoyage = create<VoyageState>()(
  persist(
    (set, get) => ({
      hasHydrated: true,
      ...sampleState(),

      setHasHydrated: (v) => set({ hasHydrated: v }),

      completeOnboarding: (cfg) =>
        set({
          ...sampleState(),
          voyage: { ...cfg, onboarded: true, firstDay: true },
          cash: cfg.startingCapital,
          todayPct: 0,
          oddsOverride: null,
          positions: [],
          orders: [],
          proposals: [],
          journal: firstDayJournal(cfg),
          instances: [],
          log: firstDayLog(),
          promotions: samplePromotions(),
          strategies: sampleStrategies().map((s) =>
            s.status === "coming" ? s : { ...s, status: s.id === "st-weather" ? "champion" : s.status === "champion" ? "sailing" : s.status },
          ),
        }),

      loadSample: () => set({ ...sampleState() }),

      loadFirstDay: () => {
        const cfg = freshVoyage({});
        get().completeOnboarding(cfg);
      },

      setAutopilot: (v) => {
        const { killSwitch, circuitBreaker } = get();
        if (v && (killSwitch || circuitBreaker === "hard")) return;
        set({ autopilot: v });
        if (v) {
          get().journal;
          set((s) => ({
            journal: pushJournal(s.journal, {
              kind: "system",
              title: "Autopilot on",
              body: "Passes will run on their own. Anything the gate pauses still waits on you.",
              aiNarrated: false,
              refs: ["helm"],
              raw: { autopilot: true },
            }),
          }));
        }
      },

      setKillSwitch: (v) => {
        set({
          killSwitch: v,
          autopilot: v ? false : get().autopilot,
          circuitBreaker: v ? "hard" : get().circuitBreaker === "hard" ? "none" : get().circuitBreaker,
        });
        set((s) => ({
          journal: pushJournal(s.journal, {
            kind: "system",
            title: v ? "Kill switch on" : "Kill switch cleared",
            body: v
              ? "Fleet docked. No new risk. Existing marks still live. Human must restart."
              : "Fleet may sail again. Gate is awake.",
            aiNarrated: false,
            refs: ["helm"],
            raw: { killSwitch: v },
          }),
        }));
      },

      setCircuitBreaker: (v) => set({ circuitBreaker: v, autopilot: v === "hard" ? false : get().autopilot }),

      setMarketOverride: (v) => set({ marketOverride: v }),

      runPass: () => {
        const s = get();
        if (s.passRunning) return;
        if (s.killSwitch || s.circuitBreaker === "hard") return;
        if (passTimer) clearTimeout(passTimer);
        set({ passRunning: true, passStep: "perceive" });
        let i = 0;
        const tick = () => {
          i += 1;
          if (i >= STEPS.length) {
            get().finishPass();
            return;
          }
          set({ passStep: STEPS[i] });
          passTimer = setTimeout(tick, 420);
        };
        passTimer = setTimeout(tick, 420);
      },

      advancePass: (step) => set({ passStep: step }),

      finishPass: () => {
        const s = get();
        const script = PASS_SCRIPTS[s.passIndex % PASS_SCRIPTS.length]!;
        let journal = s.journal;
        for (const ev of script.events) {
          journal = pushJournal(journal, {
            kind: ev.kind as JournalKind,
            title: ev.title,
            body: ev.body,
            aiNarrated: true,
            refs: ["pass"],
            raw: { passIndex: s.passIndex },
          });
        }
        journal = pushJournal(journal, {
          kind: "trace",
          title: `Pass ${s.passIndex + 1} recorded`,
          body: "perceive → guard → triage → signals → gate → explain → record. All deterministic stages green.",
          aiNarrated: false,
          refs: ["pass"],
          raw: { passIndex: s.passIndex },
        });
        set({
          passRunning: false,
          passStep: "idle",
          passIndex: s.passIndex + 1,
          journal,
          log: {
            sentences: script.sentences,
            aiNarrated: script.aiNarrated,
            ts: new Date().toISOString(),
          },
        });
      },

      approveProposal: (id) => {
        const s = get();
        const pr = s.proposals.find((p) => p.id === id);
        if (!pr) return;
        const existing = s.positions.find((p) => p.humanName === pr.humanName);
        let positions = s.positions;
        let cash = s.cash;
        const notional = pr.qty * pr.price;
        if (pr.side === "buy") {
          cash -= notional;
          if (existing) {
            const totalQty = existing.qty + pr.qty;
            const avg =
              (existing.avgCost * existing.qty + pr.price * pr.qty) / totalQty;
            positions = positions.map((p) =>
              p.id === existing.id ? { ...p, qty: totalQty, avgCost: avg, last: pr.price } : p,
            );
          } else {
            positions = [
              ...positions,
              {
                id: uid("pos"),
                symbol: pr.symbol,
                humanName: pr.humanName,
                qty: pr.qty,
                multiplier: 1,
                avgCost: pr.price,
                last: pr.price,
                side: "long",
                openedAt: new Date().toISOString(),
                family: pr.family,
              },
            ];
          }
        } else if (existing) {
          const qty = Math.min(existing.qty, pr.qty);
          cash += qty * pr.price;
          if (existing.qty <= qty) {
            positions = positions.filter((p) => p.id !== existing.id);
          } else {
            positions = positions.map((p) =>
              p.id === existing.id ? { ...p, qty: p.qty - qty } : p,
            );
          }
        }
        const orders: QueuedOrder[] = [
          {
            id: uid("ord"),
            symbol: pr.symbol,
            humanName: pr.humanName,
            side: pr.side,
            qty: pr.qty,
            type: "limit",
            limit: pr.price,
            reason: "Approved. Queued until the open.",
            createdAt: new Date().toISOString(),
          },
          ...s.orders,
        ];
        set({
          proposals: s.proposals.filter((p) => p.id !== id),
          positions,
          cash,
          orders,
          journal: pushJournal(s.journal, {
            kind: "approval",
            title: `You approved ${pr.side} ${pr.qty} ${pr.humanName}`,
            body: `Limit ${pr.price.toFixed(2)}. Worst-case ${pr.worstCase}. Queued until the open.`,
            aiNarrated: false,
            refs: [pr.id],
            raw: { ...pr },
          }),
        });
      },

      skipProposal: (id) => {
        const s = get();
        const pr = s.proposals.find((p) => p.id === id);
        if (!pr) return;
        set({
          proposals: s.proposals.filter((p) => p.id !== id),
          journal: pushJournal(s.journal, {
            kind: "approval",
            title: `You skipped ${pr.humanName}`,
            body: "No order. The radar will keep the name if the score holds.",
            aiNarrated: false,
            refs: [pr.id],
            raw: { skipped: true, symbol: pr.symbol },
          }),
        });
      },

      closePosition: (id) => {
        const s = get();
        const pos = s.positions.find((p) => p.id === id);
        if (!pos) return;
        const value = positionValue(pos);
        const pnl = positionPnl(pos);
        set({
          positions: s.positions.filter((p) => p.id !== id),
          cash: s.cash + value,
          orders: [
            {
              id: uid("ord"),
              symbol: pos.symbol,
              humanName: pos.humanName,
              side: "sell",
              qty: pos.qty,
              type: "market",
              reason: "Close requested. Queued until the open.",
              createdAt: new Date().toISOString(),
            },
            ...s.orders,
          ],
          journal: pushJournal(s.journal, {
            kind: "order",
            title: `Close ${pos.humanName} queued`,
            body: `Market sell ${pos.qty}. Mark-to-market ${pnl >= 0 ? "+" : "−"}$${Math.abs(Math.round(pnl)).toLocaleString("en-US")}. Waits for open.`,
            aiNarrated: false,
            refs: [pos.id],
            raw: { id, pnl, value },
          }),
        });
      },

      cancelOrder: (id) =>
        set((s) => ({
          orders: s.orders.filter((o) => o.id !== id),
          journal: pushJournal(s.journal, {
            kind: "order",
            title: "Order cancelled",
            body: "Pulled before the open.",
            aiNarrated: false,
            refs: [id],
            raw: { cancelled: id },
          }),
        })),

      toggleStrategy: (id) =>
        set((s) => {
          const st = s.strategies.find((x) => x.id === id);
          if (!st || st.status === "coming") return s;
          const next: StrategyDef["status"] =
            st.status === "docked" ? "sailing" : st.status === "sailing" ? "docked" : st.status;
          if (next === st.status) return s;
          const strategies = s.strategies.map((x) => (x.id === id ? { ...x, status: next } : x));
          let instances = s.instances;
          if (next === "sailing") {
            if (!instances.some((i) => i.strategyId === id)) {
              instances = [
                ...instances,
                {
                  id: uid("in"),
                  strategyId: id,
                  family: st.family,
                  version: st.version,
                  status: "running",
                  params: st.params,
                  startedAt: new Date().toISOString(),
                },
              ];
            } else {
              instances = instances.map((i) =>
                i.strategyId === id ? { ...i, status: "running" } : i,
              );
            }
          } else if (next === "docked") {
            instances = instances.map((i) =>
              i.strategyId === id ? { ...i, status: "docked" } : i,
            );
          }
          return {
            strategies,
            instances,
            journal: pushJournal(s.journal, {
              kind: "system",
              title: next === "sailing" ? `Set sail: ${st.name}` : `Docked: ${st.name}`,
              body: st.sentence,
              aiNarrated: false,
              refs: [id],
              raw: { status: next },
            }),
          };
        }),

      promote: (id) =>
        set((s) => {
          const p = s.promotions.find((x) => x.id === id);
          if (!p) return s;
          return {
            promotions: s.promotions.map((x) =>
              x.id === id ? { ...x, status: "archived" } : x,
            ),
            experiments: [
              {
                id: uid("ex"),
                name: p.name,
                family: p.family,
                result: "promoted",
                oosSharpe: p.oosSharpe,
                note: "Promoted from the challenger dock.",
                ts: new Date().toISOString(),
              },
              ...s.experiments,
            ],
            journal: pushJournal(s.journal, {
              kind: "experiment",
              title: `Promoted ${p.name}`,
              body: `OOS Sharpe ${p.oosSharpe.toFixed(2)} · max DD ${(p.maxDd * 100).toFixed(1)}%. Champion badge pending the next walk-forward.`,
              aiNarrated: false,
              refs: [id],
              raw: { ...p },
            }),
          };
        }),

      archivePromo: (id) =>
        set((s) => ({
          promotions: s.promotions.map((x) =>
            x.id === id ? { ...x, status: "archived" } : x,
          ),
          journal: pushJournal(s.journal, {
            kind: "experiment",
            title: "Challenger archived",
            body: "Not deleted. Lineage keeps the failure.",
            aiNarrated: false,
            refs: [id],
            raw: { archived: id },
          }),
        })),

      adoptAdvice: () =>
        set((s) => ({
          advice: { ...s.advice, adopted: true },
          journal: pushJournal(s.journal, {
            kind: "system",
            title: "Helm advice adopted",
            body: s.advice.body,
            aiNarrated: true,
            refs: [s.advice.id],
            raw: { adopted: true },
          }),
        })),

      dismissAdvice: () =>
        set((s) => ({
          advice: { ...s.advice, adopted: false },
          journal: pushJournal(s.journal, {
            kind: "system",
            title: "Helm advice dismissed",
            body: "Noted. The compass will not nag this analog again.",
            aiNarrated: false,
            refs: [s.advice.id],
            raw: { adopted: false },
          }),
        })),

      admitFactor: (id) =>
        set((s) => ({
          factors: s.factors.map((f) =>
            f.id === id ? { ...f, admitted: true, pending: false } : f,
          ),
          journal: pushJournal(s.journal, {
            kind: "experiment",
            title: "Factor admitted",
            body: "Deflated IC cleared the floor. On the library, decay watch starts now.",
            aiNarrated: false,
            refs: [id],
            raw: { admitted: id },
          }),
        })),

      dismissFactor: (id) =>
        set((s) => ({
          factors: s.factors.map((f) =>
            f.id === id ? { ...f, pending: false, admitted: false } : f,
          ),
        })),

      setLoadingDemo: (v) => set({ loadingDemo: v }),
    }),
    {
      name: "northstar-v1",
      skipHydration: true,
      partialize: (s) => {
        const { hasHydrated, passRunning, passStep, loadingDemo, ...rest } = s;
        void hasHydrated;
        void passRunning;
        void passStep;
        void loadingDemo;
        return rest;
      },
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);

export function useHydrated() {
  return useVoyage((s) => s.hasHydrated);
}
