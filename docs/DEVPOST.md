# Devpost submission — NorthStar ✦

> Copy-paste source for the Devpost form. Keep the first two sentences intact:
> they are the hook judges remember. Fill the [BRACKETS] before submitting.

---

## Tagline (one line)

Set the star, we sail the boat: a goal-first trading copilot whose own risk
gate says **no** to its own AI — and shows you the receipt.

## Elevator

Most trading bots demo the trade that worked. Our demo opens with the trade
that **didn't happen**: Gemini proposed it, a second Gemini red-teamed it, and
our deterministic risk gate killed it — with a machine-readable reason code in
an append-only journal. NorthStar is what an AI trading agent looks like when
honesty is the architecture, not the disclaimer.

## Inspiration

Every "AI trader" pitch has the same silent failure mode: the LLM is judge,
jury, and executioner. The 2026 survey of LLM trading systems
(arXiv:2603.27539) found five evaluation failures pervasive enough to flip
reported returns. We built the opposite: a system where **LLMs propose and
explain, but only unit-tested code can touch money** — and where every claim
in the UI maps to a journaled fact.

## What it does

- **Goal-first onboarding.** You say "grow $100k to $110k in a year." NorthStar
  backtests, runs bootstrap Monte Carlo, and answers with honest odds — including
  a red "this is unrealistic, here's what would work" path. If SPY DCA beats us,
  it says so on the plan.
- **A multi-agent trading loop as a glass box.** A Google ADK 2.x Workflow
  (perceive → prefilter → triage → signals → compile/gate/execute → explain →
  record) runs every 15 minutes on an Alpaca paper account. The cockpit renders
  the DAG live — nodes light up as the pass runs, badged GEMINI vs CODE.
- **Bull-vs-bear debate before any AI trade.** The analyst's proposal is
  red-teamed by a critic Gemini that sees fresh symbol headlines the advocate
  never saw. Strong objection = dropped. The commit/drop judge is deterministic
  code (Disagree-or-Commit, after FinCom 2026).
- **A risk gate that cannot be sweet-talked.** 17 pure-function checks: per-trade
  max loss, concentration, per-family sleeve budgets, CSP collateral, circuit
  breakers, cooldowns, naked-call ban, duplicates, liquidity, order rate limits,
  market-weather floor, kill switch. Every rejection is a first-class journal
  event with reason codes.
- **Options done properly.** CSP / covered call / wheel plus three defined-risk
  spreads submitted as **one atomic multi-leg order** (no legging risk); a
  mechanical exit manager (50% profit take, DTE≤7); manual per-position Close
  buttons that close whole structures and still pass the gate.
- **Self-evolution with scientific hygiene.** Gemini proposes strategy variants →
  walk-forward backtest where only out-of-sample decides → **Deflated Sharpe**
  (Bailey/López de Prado) raises the bar with every trial → human approval →
  3-day small-allocation paper trial → promotion. Full lineage journaled.
- **A2A-discoverable weather agent.** The market-weather station (SPY vol +
  Alpaca headlines + GDELT tone → 0-100 index) is exposed via the A2A protocol:
  any A2A client can fetch the agent card and query the exact reading our gate
  consumes. Deterministic — no LLM burned per query.
- **TimesFM forecasts.** Google's time-series foundation model draws 5-day
  quantile bands for every traded symbol nightly — decision support on the
  cockpit chart and in the analyst's fact sheet, never an order trigger.
- **Self-research: the fleet finds its own opportunities.** A nightly **Scout**
  pulls Alpaca's market-wide screener boards, applies a liquidity floor, scores
  survivors with deterministic factor math, and publishes a Top-K report with a
  plain-English reason per pick. Strategies merge the radar into their trading
  universes (held names stay sellable after they drop off), the AI analyst
  debates its loudest names, an options lens ranks the best delta-band put
  yields for the income crews — and a factor screener grades 13 known factors
  by cross-sectional rank-IC nightly, tilting the scout's score weights within
  ±20% (journaled). Beyond screening: a **Shipyard** designs whole new
  strategies as validated factor-blend specs (restricted DSL, never generated
  code) and a **factor mine** searches restricted expressions under an
  expected-max deflation bar that rises with every lifetime try — both
  human-gated, both walk-forward tested on real bars.
- **Personalization: evolution optimizes YOUR goal, not a leaderboard.** With
  an active plan, candidate selection is goal-conditioned: bootstrap Monte
  Carlo on each candidate's out-of-sample returns estimates the probability of
  reaching *your* required annual return over *your* horizon, minus a
  risk-tier drawdown penalty (conservative 3× / balanced 2× / aggressive 1×).
  The deflated-Sharpe rule stays as a statistical floor. Same candidates,
  different goals → different champions, and the journal says "chosen for
  your goal."
- **Prediction, but honest.** A deterministic **Market Compass** (SPY trend ×
  vol percentile × breadth) classifies the regime and buckets each family's
  walk-forward record by that weather — refusing conclusions under 120
  in-bucket days. A **Helm Advisor** proposes bounded, reversible sleeve tilts
  only after the regime is stable; you adopt or dismiss, and dismissed advice
  is still scored against what actually happened (counterfactual ledger). The
  **forecast scorecard** grades TimesFM's own bands nightly (q10–q90 coverage,
  pinball loss) and prints the grade on the forecast card — especially when
  it's unflattering.

## How we built it

**Stack:** Google ADK 2.x Workflows · Gemini 3.7 Flash (GA 8/13, automatic
fallback chain) · A2A protocol · TimesFM · Alpaca paper trading API (options
chain + MLEG orders + news) · FastAPI · Next.js 16 · lightweight-charts ·
React Flow · Cloud Run + Firestore.

**Money-path engineering** (the part demos usually skip):

- One global pass mutex across manual / scheduled / fallback entries — two
  passes can never interleave orders.
- Approval decisions flip atomically under a lock; a double click cannot
  execute twice. Orders carry idempotent `client_order_id`s so even a replay
  at the broker dedupes.
- A fill reconciler back-fills orders that filled outside a live pass
  (weekend-queued orders filling at Monday's open) so P&L and chart markers
  never lie by omission.
- Per-family sleeve budgets are enforced twice: strategies size within their
  allocation, and the gate rejects any buy that would push a sleeve past
  plan weight × drift slack.
- 300+ unit tests, including a copy-honesty lint that fails the build if UI
  text promises returns.

**Research-flywheel engineering** (the part that makes it self-improving):

- Every research loop shares one honesty pipeline: walk-forward evaluation,
  deflated Sharpe / deflated IC, minimum-sample refusals, human approval,
  3-day paper trials. LLMs write hypotheses and narration; they never emit a
  number that decides anything.
- Every loop has a kill switch (`*_DISABLED` flags) and an honest degradation
  path — screener down means the scout journals "fell back to core list", not
  a silent empty report.
- The factor mine deflates by **lifetime tries** (Bailey/López de Prado
  expected-max mathematics), so the bar rises the longer we search. Approved
  factors get decay tracking; a factor that stops working gets flagged in the
  library, visibly.

## Challenges we ran into

- **Gemini free-tier reality.** Pro-preview quota = 0, Flash threw launch-week
  503s. We built a model fallback chain with retries, and honest template
  fallbacks that journal `llm: false` — the system degrades visibly, never
  silently.
- **Sync LLM calls froze the event loop.** A pass could freeze every cockpit
  endpoint for 50+ seconds. Each ADK pass now runs on a private event loop in
  a worker thread; the API answers in milliseconds mid-pass.
- **Honest P&L is harder than P&L.** Expiry and assignment produce no fill to
  book from. We book those as **labeled estimates**, and exact numbers
  everywhere we have our own fills.

## Accomplishments we're proud of

- A negative result, published: our weather-floor walk-forward study concluded
  the vol-only threshold **does not** improve Sharpe on the tested window —
  the Lab shows it, labeled. We kept the layer as a risk-preference control.
- The debate log where the critic's fresh-headline objection killed an AI
  trade — the exact moment "honesty-first" became observable.
- 137 green tests on the money path.

## What we learned

Agentic UX is not chat. It's a live workflow graph, a debate you can replay,
reason codes on every no, and an append-only journal — trust through audit,
not through vibes.

## The business (why this is a product, not a demo)

**Who pays.** The 10M+ retail options traders stuck between two bad options:
"AI signal" Discords that hide their misses, and DIY bots that need a quant
degree. NorthStar's buyer is the person who wants autonomy *with receipts*.

**Freemium wedge.**

- **Free — the honest mirror.** Connect a paper account, state a goal, get the
  odds verdict, watch the agent trade paper with full journal access. The
  red-light moment ("your goal needs 1900%/yr — here's what would work") is
  the shareable hook; honesty is the acquisition loop.
- **Subscription ($29–49/mo) — the autonomous crew.** 24/7 driving of your
  own brokerage account, evolution lab tuned to *your* goal, Telegram nudges
  on approvals, slippage-aware tearsheets. Costs stay near-zero per user:
  LLMs only narrate and hypothesize (cheap Flash calls), while every
  correctness-critical path is deterministic code.
- **Later — B2B.** The gate + journal is a compliance artifact: white-label
  "explainable agent infrastructure" for fintechs that need to prove to a
  regulator why their AI did (or refused) each trade.

**Compliance route, three deliberate steps.**

1. **Now (hackathon → beta):** paper-only. No real money, no advice claims —
   the copy-honesty lint literally fails the build on promised returns.
2. **Next:** execute through the user's own brokerage keys (Alpaca Broker
   API / Connect), user retains custody and final approval; we operate as
   software, not adviser — same pattern as tax software.
3. **Then:** register or partner as RIA for the full-autonomy tier, where our
   journal/gate architecture becomes the audit trail regulators ask for.

**Moat.** Not the model (everyone has Gemini). It's the honesty dataset:
every proposal, rejection, debate, and counterfactual we journal is training
signal for calibration that competitors who only log wins can never rebuild.

## What's next

Multi-tenancy is architecturally staged (role-prefixed store collections,
driver-lease single-writer election, per-account guardrails already in) —
post-hackathon we add Clerk auth + per-user roles; the route is written up in
`docs/TECH.md`. Real-money readiness follows the compliance route above.
The honest-copilot pattern (LLM proposes, code disposes, journal remembers)
generalizes beyond trading.

## Links

- Live demo (Cloud Run): https://northstar-web-251608445238.us-central1.run.app
- A2A agent card: https://northstar-web-251608445238.us-central1.run.app/a2a/weather/.well-known/agent-card.json
- Repo: [GITHUB_URL]
- Video: [YOUTUBE_URL]

## 60-second judge verification path

1. Open https://northstar-web-251608445238.us-central1.run.app → cockpit loads
   with live paper equity in the status ribbon.
2. Helm → "Run one pass now" → watch the agent graph light up node by node.
3. When the pass lands: Live feed shows proposal → verdict (reason codes) →
   digest in plain English. If the AI proposed anything, the Debate card shows
   the bull case, the bear case, and who won.
4. `curl https://northstar-web-251608445238.us-central1.run.app/a2a/weather/.well-known/agent-card.json`
   — a second agent discovering our weather station over A2A.
