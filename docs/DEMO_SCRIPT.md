# 演示视频脚本（权威版）

> **菜单以线上为准。** Overview `/` · Research `/research` · Strategies `/strategies` · Journal `/journal`。向导 **`/onboarding`**（不是 `/start`）。
>
> Google 片只认 Cloud Run：<https://northstar-web-251608445238.us-central1.run.app>  
> 云上演示账约 **$1M paper**。VPS $100k 不要混进这条片。
>
> **Google 无声素材已拍好**（约 3 分钟，你只配音；镜头之间可以暂停）：  
> 桌面 `C:\Users\w2112\Desktop\northstar-google-broll.webm`  
> 也在 `artifacts/google-demo-broll/northstar-google-broll.webm`

核心决定不变：**冷开场 = 闸门拒绝自己的 AI。** 第一句对着 Journal 里一条红色 verdict。

## 绝对不要

- 向导最后一步的金色 **Start the plan**（会改掉线上 $1.1M 目标）
- **Research → Scan now**（Cloud Run 上会 500：scout 的 `history` 是数组套数组，Firestore 拒存。Radar 表是空的，这是已知问题，不是现场故障）
- 录 localhost、录 VPS `:3000`
- Kill switch 打开后不关（立刻再点 **Release kill switch**）
- 持仓 **Close** 之后点 **Confirm**；只点 **Keep**
- 即兴改口，把 `ORDER_RATE_LIMIT` 说成别的风险

## 配音前（Google）

- [ ] 打开上面的 `.webm`，先静音看一遍，对上下面 9 段
- [ ] 台词英语。卡了就念表里那一句，慢说
- [ ] 官方喜欢一条过。素材偏短，**配音时按句暂停**，总长度可以到约 4 分钟
- [ ] 不要为了 Radar 空表再去点 Scan now 或重新部署

`LOOP_MINUTES` 不要动。

## 4 分钟版（Google "All Things Agentic"）——按已拍素材配音

画面已按这个顺序录好。嘴只对画面，不要找 Radar 上的 scout 表。

| 时间（约） | 画面上有什么 | 你的嘴（英文） |
|---|---|---|
| 开场 | **Journal** → **verdict** → 点开一条拒绝。理由是 **ORDER_RATE_LIMIT**（一天最多 12 笔，第 13 笔被闸门挡下）。鼠标划过 `order_rate_limit` / `12/day` | "Our AI just proposed a trade. Our own risk gate killed it. This is NorthStar — the trading copilot that argues with itself, on the record." |
| 随后 | **`/onboarding`**：默认 $100k → $110k / 12 个月先算出概率。再 **Adjust my destination**：Target `1000000`、Horizon `6`，停在红字 *Honestly unrealistic*。没有点 Start the plan | "You don't pick stocks. You set a destination — it answers with honest odds. Then we ask it to 10x in six months. It refuses — with numbers." |
| 随后 | 先闪一下 **Research**（Radar 是空的，正常）。立刻切 **Journal → scout**，指 *Options watch: AMD 45%/yr…*。再回 **Overview**：左上 Today's brief，中间大金数和蓝锥 | "It hunts for its own opportunities. Every morning a plain-words brief. The system re-targets itself while you sleep." |
| 随后 | Overview 顶栏 **Run one pass**。盯**右边 Agent pipeline** 一节节亮。指 **AI** 和 **CODE** 徽章。市场是 Closed，Live feed 可能出现 *chose to wait*，不要停 | "Every 15 minutes an ADK workflow runs. Nodes signed AI are Gemini — they triage and explain. CODE nodes are deterministic — only code touches money." |
| 随后 | **左边 Market** 蜡烛（虚线是 TimesFM）。**右边 Live feed** | "Every decision lands in an append-only journal with reason codes. The chart shows our own fills, and TimesFM bands — advice, never a trigger." |
| 随后 | **Research → Evolution** 一指。回 Overview 指 **Needs you**（空的也指标题） | "Strategies evolve like science: out-of-sample only, Sharpe deflated by trial count, a human signs off, then a small paper trial." |
| 随后 | 顶栏 **Kill switch** → 立刻 **Release kill switch**。持仓 Close 后点的是 **Keep** | "One switch stops everything. Manual closes still pass the gate. Ignored approvals auto-reject. Safety is the architecture." |
| 随后 | 浏览器打开 A2A 卡片：`/a2a/weather/.well-known/agent-card.json`（`.run.app` 上的 JSON）。**没有**切 Cloud Run 控制台 | "It runs on Cloud Run, state in Firestore. The weather station is an A2A-discoverable agent." |
| 收 | Overview：大金数 + 锥上 ✦ $1,100,000 | "Set the star. We'll get you there — honestly. NorthStar." |

Scout 这一段不要改台词。「hunts for its own opportunities」对着 Journal 里的 Options watch 说就成立：系统在找机会，报告写在账本里。不要解释 Radar 为什么空。

A2A 地址（画面里已经打开过，配音不用再打）：

```
https://northstar-web-251608445238.us-central1.run.app/a2a/weather/.well-known/agent-card.json
```

## 3 分钟版（Alpaca，可后录）

录 **VPS 比赛舱**，不要和 Google 的 $1M Cloud Run 混成一条片。

| 时间 | 你的手指 | 你的嘴 |
|---|---|---|
| 0:00 | Journal → **verdict**（没有再 debate），同一冷开场 | "The rarest thing in AI trading: a no, with receipts." |
| 0:20 | Journal 搜 / 筛 order 或 fill：指一张期权、最好是多腿 | "Defined-risk spreads go out as one atomic multi-leg order — no legging risk, ever." |
| 0:50 | Journal 里止盈 / DTE；Overview 持仓 Close 只演示到 **Keep** | "Exits are mechanical: half the credit captured, or seven days to expiry." |
| 1:20 | Journal 里 P&L 行 | "P&L is exact on our fills, and labeled as an estimate when expiry books it." |
| 1:50 | Journal 里一条 gate 拒绝 | "Every rejection is a journal event with a reason code." |
| 2:10 | 顶栏 wx / REGIME → Research **Compass** → Overview **Needs you** → Research **Mining** 一瞥 | "A deterministic compass classifies the weather. You decide any tilt." |
| 2:35 | Overview 大金数 + 持仓，按当天盈亏念下面绿/红/兜底其中一句 | （见下） |
| 2:55 | 收 | "Paper account, real market, honest ledger. NorthStar on Alpaca." |

## 账户那一句（录当天看顶栏 DAY P/L，只念一句）

**绿（为正）**：We're up today. Click any dollar and the journal shows the proposal, the debate, the gate, and the fill.

**红（为负）**：We're down today — and this is the system working. Losses book, streaks count, and at minus eight percent from peak, new risk stops.

**平 / 闭市排队**：The market is closed. Orders queue. Nothing happens off the books.

## 若你自己重录（不要为 Google 再录，除非素材坏了）

- 不要点 **Scan now**。0:55 用 **Journal → scout**。
- 3:20 用 A2A JSON 页即可，控制台可选。
- Close 只点到 **Keep**。
- 键盘：**Win + Alt + R**。
