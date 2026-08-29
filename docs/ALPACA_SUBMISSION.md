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

- [ ] 比赛专用 paper 账户（$100k 起始）创建，key 切换 `ACCOUNT_ROLE=competition`
- [x] Options at the core（wheel/CSP/CC 已运行；价差目录 A2 扩展）
- [x] Trading API 执行 + trade 确认
- [x] MCP Server 接入（只读工具集，29 tools，mutations filtered）
- [ ] P&L 运营窗口（8/28–9/4）：主仓 wheel + 小仓动量，比赛账户上跑真实 P&L
- [ ] 3 分钟视频（重点：目标翻译 → 闸门拦截镜头 → 真实成交 → 进化晋级）
- [ ] 传播素材（X/LinkedIn 帖子草稿 + 截图）

## P&L 运营预案（比赛账户）

- 开盘即挂 INTC CSP（delta 0.25，DTE 30±）+ 动量 Top-3（各 ~10%）。
- 每日收盘后跑一次 evolution round（真实血缘积累）。
- 断路器阈值用 balanced 档；不追求排名冒险——叙事是"敢说不 + 活下来"。
