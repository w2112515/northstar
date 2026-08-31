# NorthStar — 前端设计与视觉概念

> 状态：v4.4，2026-09-01（v4 = **视觉权威 = Grok 原型**。**v4.4 = 左栏空槽收口**：Brief + Book + 固定高度 Market rail；三栏 `items-start`，禁止用视口高度把 K 线拉成长条。Positions 坐在锥下方。仍不对调 Market 与 Plan vs reality）。
> 本文件是交互结构与视觉方向的唯一 owner。审计见 `docs/FRONTEND_AUDIT.md`。
> 平台决定：**Web 桌面优先**，1280px 主设计，平板/手机降级可用不精修。界面语言：**英文**。

## 0. 设计主张

夜航驾驶舱（Night Voyage），以 Grok 原型的工艺水准为准：深空蓝黑 + 北极星金 + 细描边面板（shadow-border 技术）+ 轨道 hero。**文案黑名单继续执行**（v3 确立，不因视觉回摆而松动）：captain / voyage / fleet / helm / sail / dock / on board / waiting on you 不得出现在 UI 字符串；AI 归因永远标注（gold `AI` 徽章）。

## 1. 信息架构（Grok 原型 APEX 迭代一致）

顶栏（sticky）：金色星标 + wordmark + 四项文本导航（活跃项金色下刻度）+ 日期·NY 时钟 + LIVE/Closed + PAPER；**KPI 条**（hairline 分隔：EQUITY · DAY P/L · BUYING POWER · POSITIONS · wx · REGIME）；Overview 页挂 Controls 条（autopilot/run one pass/kill）。导航：**Overview** `/` · **Research** `/research` · **Strategies** `/strategies` · **Journal** `/journal`。向导 `/onboarding` 为无 chrome 的分屏星房间（左步骤轨 + 右内容 + 轨道图）。旧路由（/activity /proof /system /start /lab）全部 307 跳转。

- **Overview**：三栏构图，`items-start`（栏高跟内容，不互拉）。左栏 rail：Today's brief + Strategy book + Market（窄栏上下叠：K 线固定 `h-64`，watchlist `max-h-52` 滚动；禁止把图做成视口高的竖条）；中：一张 Plan vs reality 卡（hero-num 净值 + 概率行 + 金色进度尺压在收紧 Y 轴的蒙特卡洛锥上；真实净值金线 + ProbStrip；pass/kill 时在数字下插入紧凑 GoalOrbit）+ 其下 Positions；右：Needs you + Agent pipeline + Live feed。Market 是只读终端，不与 Plan vs reality 对调——目标航迹是产品身份，K 线是证据窗。宽栏终端惯例（v4.2）仍用于无目标时的底栏：左大图 + 右 watchlist；rail 变体只改容器，不改数据与交互（滚轮缩放、拖拽平移、双击复位、十字线、1M/3M/6M/1Y、Last/Chg%、locale 锁 en-US）。
- **Research**：四 tab——Radar（scout 候选 + options watch + daily brief）/ Compass（regime + AI 假设 + 家族统计 + plan advice 决策 + TimesFM 扇形 + 记分卡）/ Evolution（晋级候选 + 气象验证 + DSL specs + 实验血缘）/ Mining（因子 IC + 挖掘审批 + library）。
- **Strategies**：分组目录（In the plan / Available / Soon）+ 计划内与**赢过现任**的 champion 卡的证据条（袖套权重、今日体制数字若 Compass 有桶、证据等级）+ 运行实例表。金边 champion 只留给有父代/实验血统的晋级实例；第一次 Enable 的现任显示 running/paused。非计划卡保持定性；不按策略拆仓、不给期权贴 Sharpe。
- **Journal**：搜索 + kind 筛选 + 按日分组（Today/Yesterday sticky 头）+ 展开 raw JSON + load older。
- **Onboarding**：四步（Destination / Temperament / Honest plan / Confirm），红路径诚实替代方案，真实 preview/commit。

## 2. 视觉契约（以 Grok 原型 styles.css 为准）

- **色板**：void `#0b1220` / night `#121c30` / panel `#1a2740` / line `#24334f` / ink `#e7eef9` / mist `#a2b3d1` / gold `#f5c542` / teal `#35d0ba` / coral `#ff6b6b` / amber `#f0a860` / signal `#5b8def` + dim 变体（gold-dim 等）。
- **语义**：gold = 星时刻（目标/轨道/odds/AI 归因/champion/主 CTA）；teal = 涨/盈利/买入/running；coral = 跌/亏损/危险/拒绝；amber = 等待人类；signal = 外部系统/预测带/focus。**v4.1 裁决**：odds 数字默认 gold，仅红档（feasibility=red）降 coral，amber 永不用于 odds；预测线（TimesFM 等模型输出）穿 signal 不穿 gold；medium risk、stressed regime、queued（等市场）用 mist——amber 只留给"等待人类决定"。
- **分层**：shadow-border（0 0 0 1px white/7%）替代生硬 border；panel(night) 坐于 void 之上，panel-inset(panel) 嵌套；tone 阴影环表达状态。
- **字体**：Outfit（UI）+ IBM Plex Mono（数字/标签，tabular-nums）。组件类：`kicker`（11px 大写 mist）、`num`、`hero-num`（clamp 36→56）。
- **动效**：twinkle / breathe / feed-in / pulse-node / orbit-dash / skel shimmer，全部 `prefers-reduced-motion` 关闭。
- **签名视觉**：`GoalOrbit`（星座 mesh + 闪烁星场 + 虚线轨道动画 + teal→gold 发光已航段 + 呼吸船位 + 发光北极星）；`TrajectoryHero`（计划 vs 现实锥形图，真实净值金线）。
- **图表主题单一来源**：`lib/theme.ts`（与 globals.css 同步义务）。
- **可访问性**：focus = signal 双环；印章/徽章是文字不是颜色；涨跌带符号；`translate="no"`；skip link 由 shell 结构保证（图标轨有 aria-label/title）。

## 3. 工程注记

- 栈：Next.js 16 + Tailwind 4 + SWR + recharts + lightweight-charts + lucide-react。xyflow 已弃用（pipeline 改节点步进列表，更可读更稳）。
- 数据层：`lib/data.ts`（SWR + northstar:refresh 桥）；类型：`lib/types.ts`；格式化：`lib/api.ts`。
- 后端新增 `GET /api/goal/bands`（按日缓存，空子字段归一 None）。
- 对抗审计修复全部保留：错误分支条幅化（不造假空态）、竞态守卫、输入校验、eventTone verdict 判别、闸门统计口径、load-older、aria。
- 验收：以 Grok 截图（`screenshots/`）为视觉基准逐页对照；lint + build 绿（lint 含 `scripts/check-copy.mjs` 文案黑名单扫描）；五页 SSR 200；五跳转 307；复截图核销用 `scripts/capture-ui.mjs`。
