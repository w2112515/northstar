# NorthStar ✦ — set the star, we sail the boat

A goal-first, self-evolving, hard-gated trading copilot for people who think in
**"grow $100k to $110k in a year"**, not in greeks. Built on **Google ADK 2.x +
Gemini** for orchestration and judgment, and **Alpaca** for real (paper) options
& equities execution.

> Paper trading only. Simulated money, live market data. Probabilities are
> historical estimates, never promises. Not investment advice.

## Why it's different

1. **Goal-first, honesty-first.** You state a destination; NorthStar translates
   it into required return, runs real backtest distributions + Monte Carlo, and
   tells you the odds — including a red **"this is unrealistic, here's what
   would actually work"** path. If boring SPY beats us, we say so.
2. **LLMs never touch the money path.** Gemini triages events, explains
   decisions in plain language, and proposes strategy improvements. Orders are
   compiled, risk-gated, and executed by deterministic, unit-tested code.
3. **A risk gate that cannot be sweet-talked.** 13 pure-function checks (max
   loss per trade, concentration, CSP collateral caps, circuit breakers, naked-
   call ban, duplicates, liquidity, kill switch). Every rejection is a
   first-class journal record with a reason code.
4. **Evolution with scientific hygiene.** Gemini Pro (or a labeled grid
   fallback) proposes candidates → walk-forward backtest (OOS only decides,
   with a multiple-testing haircut) → **a human approves every promotion**.
   Full lineage: parent version, hypothesis, experiment, forever.
5. **Everything explains itself.** The Voyage Journal is an append-only lineage
   of proposal → verdict → order → fill → digest, in plain English.

## Architecture

```
Next.js (Night Voyage UI)          FastAPI + ADK 2.x Workflow
 Cockpit / Onboarding / Lab  <-->   TradingLoop graph:
 Journal / Strategies               perceive -> prefilter -> triage(Gemini Flash)
                                    -> signals -> compile -> GATE -> execute
                                    -> explain(Gemini Flash) -> record
                                            |                     |
                                    alpaca-py (paper)      JournalStore
                                    options chain + orders (local JSON | Firestore)
```

- **Strategies (runnable today):** Wheel (CSP→CC state machine), Momentum
  Top-N rotation. Catalog lists 14 classics; unimplemented ones are honestly
  labeled "coming soon", never faked.
- **Goal Planner:** momentum = real 4y walk-forward backtest; wheel = labeled
  volatility-based approximation (Alpaca options history starts Feb 2024);
  bootstrap Monte Carlo → probability, bands, median max drawdown.
- **HITL:** soft breaker / cooldown / evolution promotions create approval
  cards with a timeout-to-reject. The loop never blocks on a human.

## Run it

```powershell
# 1) secrets
Copy-Item .env.example .env   # fill in Alpaca PAPER keys (PK...), optional GOOGLE_API_KEY

# 2) backend (Python 3.12, uv)
cd apps/api; uv sync; cd ../..

# 3) frontend (Node 22)
cd apps/web; npm install; cd ../..

# 4) both dev servers (API :8800, Web :3000)
.\scripts\dev.ps1

# smoke test + one full loop pass
.\scripts\smoke.ps1
# then in the UI: Cockpit -> Helm -> "Run one pass now"
```

Tests: `cd apps/api; uv run pytest` (risk gate, compiler, copy-honesty lint).

Deploy (Cloud Run + Firestore): `.\scripts\deploy.ps1 -ProjectId <gcp-project>`

## Hackathon mapping

- **Google "All Things Agentic"**: ADK 2.x `Workflow` graph orchestrates the
  entire loop; Gemini Flash = triage + plain-speak explainer; Gemini Pro =
  evolution proposer; HITL approval cards; Cloud Run + Firestore deployment.
- **Alpaca "AI Trading Agents"**: options-first strategies (CSP/CC/wheel) with
  delta/DTE/liquidity-aware contract selection via the options chain API,
  real paper orders with confirmations, P&L operated on a dedicated account.

## Honesty ledger (what's real vs approximated)

| Thing | Status |
|---|---|
| Paper orders, fills, positions | Real (Alpaca paper API) |
| Momentum backtest | Real daily bars, 4y, costs modeled, walk-forward OOS |
| Wheel backtest | Labeled approximation (realized-vol premium model) |
| Achievement probability | Bootstrap MC over the above, shown with bands |
| Gemini nodes without a key | Honest fallbacks, journal says `llm: false` |
| Live trading | Refused by construction (`ALPACA_PAPER` must be true) |
