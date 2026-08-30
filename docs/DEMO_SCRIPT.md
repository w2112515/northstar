# 演示视频脚本（当前权威版，取代 ROADMAP §视频脚本草稿）

核心决定：**冷开场 = 闸门拒绝 AI**。别的队展示 AI 赚钱；我们第一镜头展示
"AI 提了一笔交易，被我们自己的风控毙了，理由码在案"。这是五份评审一致认定的
最强记忆点。素材两赛道共用，剪两版。

## 录制前检查清单（周一 21:30 美股开盘后）

- [ ] `scripts\dev.ps1` 双服务在跑；驾驶舱 ribbon 数字正常、无 STALE 横幅
- [ ] kill switch OFF、autopilot ON（ribbon 两个灯都对）
- [ ] 周五排队的订单已成交 → 持仓表有货、K 线图有买卖箭头（开盘后 5 分钟内
      对账器会自动补写 fill 事件）
- [ ] AI Analyst 已启用，最近 journal 里有一条 debate（没有就手动 Run one pass 攒一条；
      dropped_objection 的最佳，weak_objection 次之）
- [ ] Research 页有货：侦察报告卡（空则 `POST /api/scout/run`）、罗盘卡 regime 徽章
      （空则 `POST /api/engine/nightly` 或等夜班）、船长日志卡当日叙事；
      驾驶舱右栏 Overnight research 摘要卡显示对应行
- [ ] 屏幕 1080p、浏览器 100% 缩放、驾驶舱深色底在 OBS 里无摩尔纹
- [ ] 准备一个终端窗口，预输入 A2A curl 命令（见下）
- [ ] **Cloud Run 控制台页签已登录**（northstar-api / northstar-web 两个服务绿灯），
      `.run.app` URL 能打开——官方要求视频里必须看到项目跑在 Google Cloud 上

## 4 分钟版（Google "All Things Agentic" · The Taskmaster）

> 官方要求 **~4 分钟**（不是 5），且视频**必须出现 Google Cloud 运行证据**
> （Cloud Run 控制台或 `.run.app` URL）。评分 40% 自治实用 / 30% 架构纪律 /
> 30% Demo 与生产就绪——"live, unedited demo" 加分，少剪辑多实录。

| 时间 | 画面与操作 | 台词（英文录制） |
|---|---|---|
| 0:00 | 冷开场：辩论卡特写，红色 "Strong objection - dropped"，鼠标划过批评者论点与它看到的头条 | "Our AI just proposed a trade. Our own risk gate killed it. This is NorthStar — the trading copilot that argues with itself, on the record." |
| 0:25 | onboarding 连拍：输入 "grow $100k to $110k in 12 months" → 计划页概率/区间/SPY 对照 → 再输一个离谱目标 → 红色拒绝路径 | "You don't pick stocks. You set a destination — it answers with honest odds. And when the goal is fantasy, it refuses, and shows what would actually work." |
| 0:55 | 切 Research 页：侦察报告卡特写（Top-K 表 + 每条人话理由 + 期权观察行）→ 船长日志卡一瞥 → 回驾驶舱 | "And it hunts for its own opportunities: every night a Scout scans the whole market and files a report — every pick with a reason, every night with a captain's log. The fleet re-targets itself while you sleep." |
| 1:10 | Helm 点 "Run one pass now" → React Flow DAG 节点逐个点亮（指出 scout 节点 + GEMINI 徽章 vs CODE 徽章） | "Every 15 minutes an ADK workflow runs in the background. Gold nodes are Gemini — they triage and explain. Teal nodes are code — only code touches money." |
| 1:50 | pass 落地：Live feed 滚出 proposal → verdict（理由码）→ digest；点开 Market 面板看 TimesFM 分位带 + 成交箭头 | "Every decision lands in an append-only journal with reason codes. The chart shows our own fills, and TimesFM's five-day bands — advice, never a trigger." |
| 2:25 | Research 工作台 Evolution tab：进化实验 → walk-forward → Deflated Sharpe 门槛 → goal-fit "chosen for your goal" 字样 → 审批卡点批准 → 试航标签 | "Strategies evolve like science: out-of-sample only, Sharpe deflated by trial count, a human signs off, then a small paper trial. And with a goal set, evolution optimizes the probability of reaching *your* target — not a leaderboard." |
| 2:55 | 安全快闪：kill switch ON（ribbon 红章）→ 持仓 Close 两步确认 → 审批超时文案特写 | "One switch stops everything. Manual closes still pass the gate. Ignored approvals auto-reject. Safety is not a setting — it's the architecture." |
| 3:20 | **Google Cloud 证据**：Cloud Run 控制台两个服务 → 浏览器开 `.run.app` URL → 终端 curl A2A agent card | "It runs on Cloud Run, state in Firestore. And the weather station is an A2A-discoverable agent — any client can query the exact reading our gate consumes. ADK workflows, Gemini with honest fallbacks, TimesFM." |
| 3:50 | 收尾：ribbon 特写 → 星标 logo | "Set the star. We sail the boat — honestly. NorthStar." |

A2A curl（提前贴好）：
`curl [API_URL]/a2a/weather/.well-known/agent-card.json`

## 3 分钟版（Alpaca "AI Trading Agents"）

| 时间 | 画面与操作 | 台词 |
|---|---|---|
| 0:00 | 同一个冷开场（辩论卡拒绝） | "The rarest thing in AI trading: a no, with receipts." |
| 0:20 | Journal 筛 order/fill：iron condor **一张原子 MLEG 单**下单与整结构平仓记录 | "Defined-risk spreads go out as one atomic multi-leg order — no legging risk, ever." |
| 0:50 | 退出管理：50% 止盈 / DTE≤7 的 journal 记录 + 持仓 Close 按钮演示 | "Exits are mechanical: half the credit captured, or seven days to expiry — whichever comes first." |
| 1:20 | P&L 事件特写：exact vs labeled estimate 两种记账 + 连亏冷却计数 | "P&L is exact on our fills, and labeled as an estimate when expiry books it. Loss streaks feed a real cooldown." |
| 1:50 | 风控快闪：17 条 checks 列表滚动 + 一条真实 rejection | "Seventeen pure-function checks. Every rejection is a journal event with a reason code." |
| 2:10 | Research 工作台 Compass tab 特写：regime 徽章 + 各族条件化 Sharpe 表 + Advisor 建议 Adopt/Dismiss；切 Mining tab Factor Radar 一瞥 | "A deterministic compass classifies the regime, and shows how each strategy family actually performed in this weather — refusing conclusions under 120 days of evidence. When the regime is stable, the advisor proposes a bounded tilt. You decide; dismissed advice is still scored." |
| 2:35 | 账户视角：equity 曲线 + 持仓 + 今日 P&L（用当天真实叙事，见下） | （按当天版本讲） |
| 2:55 | 收尾 | "Paper account, real market, honest ledger. NorthStar on Alpaca." |

## 两版 P&L 叙事（按周一实际盘面二选一）

**绿版（账户为正）**：
"We're up $[X] today. But the number isn't the point — click any dollar of it
and the journal shows the proposal, the debate, the gate checks, and the fill
that produced it. Profit with provenance."

**红版（账户为负）**：
"We're down $[X] today — and this is the system working. The loss is booked,
the streak counter ticked, and two more losses would trigger an automatic
cooldown. At -8% from peak, new trades stop entirely. Losing days are exactly
what the architecture is for."

**兜底（订单还在排队/无成交）**：
"Friday's orders queued through the weekend and filled at the open — the
reconciler back-filled every fill event before we finished coffee. Nothing
happens off the books."

## B-roll 清单（各 10-20 秒，剪辑备用）

- DAG 点亮全循环（无旁白纯录屏）
- Market 面板：切换 symbol、TimesFM 带、双击复位
- ribbon 特写：equity sparkline 与天气灯
- 底部 ticker 时钟跳动
- Journal 长滚动（表现"账本厚度"）
- 终端 healthz + A2A curl 输出
