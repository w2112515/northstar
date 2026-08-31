# Alpaca "AI Trading Agents" — 提交材料草稿（9/4 前定稿）

## One-page write-up (draft)

**NorthStar — set the star, we sail the boat.**

Most retail "AI trading" products ask users to pick indicators. NorthStar asks
one question: *where do you want to end up?* ("Grow $100k to $110k in 12
months.") It translates the goal into required return, computes honest odds
from real backtest distributions + Monte Carlo — and if the goal is
unrealistic it says so in red, with alternatives that would actually work.

Then it sails: an agentic loop (Google ADK graph + Gemini) runs
**options-first strategies** on Alpaca —

- **Wheel state machine**: cash-secured puts → assignment → covered calls,
  contracts chosen from the live **option chain** by delta band (0.25±0.10),
  DTE window (21–45), and liquidity filters (two-sided quotes, spread ≤ 30%);
- **Momentum Top-N rotation** as the growth sleeve;
- an **evolution lab** that proposes parameter candidates (Gemini Pro), tests
  them with walk-forward backtests (OOS-only fitness + multiple-testing
  haircut), and promotes only with a human tap — full lineage preserved.

Safety is code, not prompts: a 13-rule deterministic risk gate (max defined
loss, CSP collateral caps, concentration, circuit breakers, naked-call ban,
duplicate/idempotency, liquidity, kill switch) stands between every proposal
and the executor. LLMs read data through the **official alpaca-mcp-server
(V2)** mounted read-only (toolsets: stock-data, options-data, account; all
mutating tools filtered) — the trading toolset is never exposed to a model.

Every decision — including rejections — lands in an append-only Voyage
Journal in plain English: proposal → gate verdict → order → fill → digest.

**Stack**: Alpaca Trading API + options chain (alpaca-py), alpaca-mcp-server V2
(read-only LLM tools), Google ADK 2.x Workflow, Gemini Flash/Pro, FastAPI,
Next.js, Cloud Run + Firestore.

## Checklist（比赛要件）

- [x] 比赛专用 paper 账户 = PA39MXXJL5N1（8/28 窗口开启时恰好 $100k 起始），
      8/31 起由 HostDzire VPS 24/7 驱动（systemd 常驻，笔记本可关机）
- [x] **评委可看的实时只读驾驶舱：<http://160.202.133.144:3000>**
      （比赛账户的实时 journal/持仓/天气；无 token，写操作 401——只能看不能动。
      提交表和视频里都放这个链接）
- [x] Options at the core（wheel/CSP/CC 已运行；价差目录 A2 扩展）
- [x] Trading API 执行 + trade 确认
- [x] MCP Server 接入（只读工具集，29 tools，mutations filtered）
- [ ] P&L 运营窗口（8/28–9/4）：主仓 wheel + 小仓动量，比赛账户上跑真实 P&L
- [ ] 3 分钟视频（重点：目标翻译 → 闸门拦截镜头 → 真实成交 → 进化晋级）
- [x] 传播素材（X/LinkedIn 帖子草稿见下 + `artifacts/story/` 六张截图）

## P&L 运营预案（比赛账户）

- 开盘即挂 INTC CSP（delta 0.25，DTE 30±）+ 动量 Top-3（各 ~10%）。
- 每日收盘后跑一次 evolution round（真实血缘积累）。
- 断路器阈值用 balanced 档；不追求排名冒险——叙事是"敢说不 + 活下来"。

## Story screenshots（`artifacts/story/`，capture-story.mjs 一键重拍）

1. `1-red-light-goal.png` — 0% 红灯 + 一键可采纳的诚实替代方案（系统敢说不）
2. `2-gate-rejection.png` — journal 里真实的闸门拒绝事件（安全是代码不是提示词）
3. `3-spread-positions.png` — 真实 SPY 铁鹰四腿持仓 + 部署风险预算 + 排队订单
4. `4-evolution-lineage.png` — 进化血缘全表（含失败实验），晋级永远等人点头
5. `5-readonly-cockpit.png` — 评委直接打开的公开只读驾驶舱
6. `6-a2a-agent-card.png` — A2A agent card（机器可读的 agent 接口）

## X / Twitter 帖子草稿（英文，提交时配图 1+3）

> Most AI trading demos show you the wins. We built the part that says **no**.
>
> NorthStar turns one sentence — "grow $100k to $110k in a year" — into a
> plan with honest odds (44%, computed, not vibes), then trades options on
> @AlpacaHQ paper with a 13-rule deterministic risk gate between every LLM
> idea and every order.
>
> Red-light goals get told the truth + one-tap realistic alternatives.
> Every rejection is journaled. The agent runs 24/7 on @GoogleADK + Gemini.
>
> Live read-only cockpit (watch it work, can't touch it):
> http://160.202.133.144:3000
>
> Built for the Alpaca AI Trading Agents hackathon. #AITrading #options

## LinkedIn 帖子草稿（英文，提交时配图 1+4）

> **What if a trading agent's best feature was refusing to trade?**
>
> For the Alpaca "AI Trading Agents" hackathon we built NorthStar, an
> autonomous options-income agent with one design rule: *LLMs judge, code
> decides.*
>
> - You state a destination in one sentence; it computes honest odds from
>   walk-forward backtests + Monte Carlo. Unrealistic goals get a red light
>   and one-tap alternatives that would actually work - before a single
>   simulated dollar moves.
> - Gemini (on Google's ADK workflow graph) does triage, narration, and
>   strategy design. It cannot touch an order: a deterministic 13-rule risk
>   gate (defined-risk caps, collateral, concentration, circuit breakers,
>   earnings blackouts, idempotency) sits between every proposal and the
>   broker, and its rejections are first-class journal events.
> - A nightly evolution lab walk-forward-tests parameter challengers
>   (out-of-sample fitness only, multiple-testing haircut) and promotes
>   nothing without a human tap - full experiment lineage kept, failures
>   included.
> - It runs 24/7 against Alpaca's paper API, wheel + defined-risk spreads
>   first, with a public read-only cockpit anyone can audit.
>
> The uncomfortable truth about retail "AI trading": the model is the easy
> part. The moat is the honesty layer - odds you can defend, rejections you
> can read, and an audit trail you didn't have to trust.
