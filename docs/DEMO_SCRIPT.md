# 演示视频脚本（当前权威版，取代 ROADMAP §视频脚本草稿）

> 页面对照（Night Ledger v4 IA）：旧"驾驶舱"→ **Track**（`/`）；旧 Research/Lab → **Activity**（`/activity`，实时）与 **System**（`/system`，研究机器）；旧 Journal → **Proof**（`/proof`）；旧 onboarding → **/start** 向导；旧 ribbon → **顶栏 TopBar**。

核心决定：**冷开场 = 闸门拒绝 AI**。别的队展示 AI 赚钱；我们第一镜头展示
"AI 提了一笔交易，被我们自己的风控毙了，理由码在案"。这是五份评审一致认定的
最强记忆点。素材两赛道共用，剪两版。

## 录制前检查清单（周一 21:30 美股开盘后）

- [ ] `scripts\dev.ps1` 双服务在跑；顶栏 KPI（equity / today / plan progress / NY 时钟）数字正常
- [ ] kill switch OFF、autopilot ON（顶栏无红章，Activity 页 Controls 开关为 on）
- [ ] 周五排队的订单已成交 → Track 持仓表有货、Activity Market 蜡烛图有买卖箭头
      （开盘后 5 分钟内对账器会自动补写 fill 事件）
- [ ] AI Analyst 已启用，最近 journal 里有一条 debate（没有就 Activity 页 Run one pass 攒一条；
      dropped_objection 的最佳，weak_objection 次之）——冷开场镜头在 **Proof 页辩论区**
- [ ] Activity 页有货：**Scout report** 表非空（空则点 Scan now 或 `POST /api/scout/run`）、
      上下文条 regime 徽章非 unknown（空则 `POST /api/engine/nightly` 或等夜班）
- [ ] Track 页有货：Today 每日简报（金边 FieldNote）当日叙事、TrajectoryHero 金航迹线可见
- [ ] 屏幕 1080p、浏览器 100% 缩放、夜色底在 OBS 里无摩尔纹（全站深色，检查一页即可）
- [ ] 准备一个终端窗口，预输入 A2A curl 命令（见下）
- [ ] **Cloud Run 控制台页签已登录**（northstar-api / northstar-web 两个服务绿灯），
      `.run.app` URL 能打开——官方要求视频里必须看到项目跑在 Google Cloud 上

## 4 分钟版（Google "All Things Agentic" · The Taskmaster）

> 官方要求 **~4 分钟**（不是 5），且视频**必须出现 Google Cloud 运行证据**
> （Cloud Run 控制台或 `.run.app` URL）。评分 40% 自治实用 / 30% 架构纪律 /
> 30% Demo 与生产就绪——"live, unedited demo" 加分，少剪辑多实录。

| 时间 | 画面与操作 | 台词（英文录制） |
|---|---|---|
| 0:00 | 冷开场：Proof 页辩论区特写，红色 "Strong objection - dropped"，鼠标划过批评者论点与它看到的头条 | "Our AI just proposed a trade. Our own risk gate killed it. This is NorthStar — the trading copilot that argues with itself, on the record." |
| 0:25 | /start 向导连拍：输入 "grow $100k to $110k in 12 months" → 计划步概率/区间/SPY 对照 → 再输一个离谱目标 → 红色拒绝路径 | "You don't pick stocks. You set a destination — it answers with honest odds. And when the goal is fantasy, it refuses, and shows what would actually work." |
| 0:55 | 切 Activity 页：**Scout report** 表特写（Top-K 行 + 每条人话理由 + 期权观察脚注行）→ 切 Track 页 Today 简报（金边 FieldNote）一瞥 | "And it hunts for its own opportunities: every night a scout scans the whole market and files a report — every pick with a reason, every morning a plain-words brief. The system re-targets itself while you sleep." |
| 1:10 | Activity 页 Controls 点 "Run one pass now" → Live run schematic 节点逐个点亮（指出 scout 卫星节点 + 衬线 Ai 签 vs CODE 签） | "Every 15 minutes an ADK workflow runs in the background. Nodes signed Ai are Gemini — they triage and explain. CODE nodes are deterministic — only code touches money." |
| 1:50 | pass 落地：Event stream 滚出 proposal → verdict（理由码印章）→ digest；上滑 Market 面板看 TimesFM 分位带 + 成交箭头 | "Every decision lands in an append-only journal with reason codes. The chart shows our own fills, and TimesFM's five-day bands — advice, never a trigger." |
| 2:25 | System 页 Evolution 区：进化实验 → walk-forward → Deflated Sharpe 门槛 → goal-fit "chosen for your goal" 字样 → 切 Track "Needs you" 批准 → 试航（trial）印章 | "Strategies evolve like science: out-of-sample only, Sharpe deflated by trial count, a human signs off, then a small paper trial. And with a goal set, evolution optimizes the probability of reaching *your* target — not a leaderboard." |
| 2:55 | 安全快闪：Activity 页 kill switch ON（顶栏红章亮起）→ Track 持仓 Close 两步确认 → 审批超时文案特写 | "One switch stops everything. Manual closes still pass the gate. Ignored approvals auto-reject. Safety is not a setting — it's the architecture." |
| 3:20 | **Google Cloud 证据**：Cloud Run 控制台两个服务 → 浏览器开 `.run.app` URL → 终端 curl A2A agent card | "It runs on Cloud Run, state in Firestore. And the weather station is an A2A-discoverable agent — any client can query the exact reading our gate consumes. ADK workflows, Gemini with honest fallbacks, TimesFM." |
| 3:50 | 收尾：Track hero 特写（金航迹线爬向 ✦ 目标线）→ 顶栏金色进度尺 | "Set the star. We'll get you there — honestly. NorthStar." |

A2A curl（提前贴好）：
`curl [API_URL]/a2a/weather/.well-known/agent-card.json`

## 3 分钟版（Alpaca "AI Trading Agents"）

| 时间 | 画面与操作 | 台词 |
|---|---|---|
| 0:00 | 同一个冷开场（Proof 页辩论卡拒绝） | "The rarest thing in AI trading: a no, with receipts." |
| 0:20 | Proof 页 ledger 筛 order/fill：iron condor **一张原子 MLEG 单**下单与整结构平仓记录 | "Defined-risk spreads go out as one atomic multi-leg order — no legging risk, ever." |
| 0:50 | 退出管理：50% 止盈 / DTE≤7 的 ledger 记录 + Track 持仓 Close 按钮演示 | "Exits are mechanical: half the credit captured, or seven days to expiry — whichever comes first." |
| 1:20 | P&L 事件特写：exact vs labeled estimate 两种记账 + 连亏冷却计数 | "P&L is exact on our fills, and labeled as an estimate when expiry books it. Loss streaks feed a real cooldown." |
| 1:50 | 风控快闪：Proof 页闸门拒绝统计（17 条 checks）+ 一条真实 rejection 印章 | "Seventeen pure-function checks. Every rejection is a journal event with a reason code." |
| 2:10 | Activity 上下文条 regime 徽章特写 → System 页家族 regime 统计表（各族条件化 Sharpe，<120d 显示 insufficient）→ Track "Needs you" 里的 Advisor 倾斜建议 Adopt/Dismiss → System Factor mining 雷达一瞥 | "A deterministic compass classifies the regime, and shows how each strategy family actually performed in this weather — refusing conclusions under 120 days of evidence. When the regime is stable, the advisor proposes a bounded tilt. You decide; dismissed advice is still scored." |
| 2:35 | 账户视角：Track hero（equity + 今日 P&L + 金航迹线）+ 持仓（用当天真实叙事，见下） | （按当天版本讲） |
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

- Activity Live run schematic 点亮全循环（无旁白纯录屏）
- Activity Market 面板：切换 watchlist 分组与 symbol、TimesFM 带、双击复位
- Track hero：金航迹线 + ProbStrip 三刻度 + ✦ 目标星特写
- 顶栏特写：equity/today KPI、金色进度尺、NY 时钟、PAPER 章
- Proof ledger 长滚动（表现"账本厚度"，印章列齐整）
- 终端 healthz + A2A curl 输出
