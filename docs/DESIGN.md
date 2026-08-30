# NorthStar — 前端设计与视觉概念

> 状态：v4，2026-08-31（**视觉权威 = Grok 原型**（`THhdE8o3NRn9RAPU-grok-workspace`，深色 Night Voyage 高工艺执行版），逐页以其截图为准做忠实实现；数据全部接真实后端。v3 的 EVIDENCE 浅色账本已退役，git 历史留档）。
> 本文件是交互结构与视觉方向的唯一 owner。审计见 `docs/FRONTEND_AUDIT.md`。
> 平台决定：**Web 桌面优先**，1280px 主设计，平板/手机降级可用不精修。界面语言：**英文**。

## 0. 设计主张

夜航驾驶舱（Night Voyage），以 Grok 原型的工艺水准为准：深空蓝黑 + 北极星金 + 细描边面板（shadow-border 技术）+ 轨道 hero。**文案黑名单继续执行**（v3 确立，不因视觉回摆而松动）：captain / voyage / fleet / helm / sail / dock / on board / waiting on you 不得出现在 UI 字符串；AI 归因永远标注（gold `AI` 徽章）。

## 1. 信息架构（Grok 原型 APEX 迭代一致）

顶栏（sticky）：金色星标 + wordmark + 四项文本导航（活跃项金色下刻度）+ 日期·NY 时钟 + LIVE/Closed + PAPER；**KPI 条**（hairline 分隔：EQUITY · DAY P/L · BUYING POWER · POSITIONS · wx · REGIME）；Overview 页挂 Controls 条（autopilot/run one pass/kill）。导航：**Overview** `/` · **Research** `/research` · **Strategies** `/strategies` · **Journal** `/journal`。向导 `/onboarding` 为无 chrome 的分屏星房间（左步骤轨 + 右内容 + 轨道图）。旧路由（/activity /proof /system /start /lab）全部 307 跳转。

- **Overview**：三栏构图——左：Today's brief（编号条目：最强信号/待决/气象）+ Strategy book（running/trial/paused 计数）；中：大数字 hero（hero-num 金 + 概率行 + 金色进度尺 + days left/pass line；pass 运行或 kill 时切换为轨道态）+ Plan vs reality（蒙特卡洛锥 + 真实净值线 + ProbStrip）；右：Needs you（琥珀环面板）+ Agent pipeline（节点步进列表）+ Live feed（单列）。底部：Market + Positions 双栏。
- **Research**：四 tab——Radar（scout 候选 + options watch + daily brief）/ Compass（regime + AI 假设 + 家族统计 + plan advice 决策 + TimesFM 扇形 + 记分卡）/ Evolution（晋级候选 + 气象验证 + DSL specs + 实验血缘）/ Mining（因子 IC + 挖掘审批 + library）。
- **Strategies**：目录卡网格（Enable/Pause）+ 运行实例表。
- **Journal**：搜索 + kind 筛选 + 按日分组（Today/Yesterday sticky 头）+ 展开 raw JSON + load older。
- **Onboarding**：四步（Destination / Temperament / Honest plan / Confirm），红路径诚实替代方案，真实 preview/commit。

## 2. 视觉契约（以 Grok 原型 styles.css 为准）

- **色板**：void `#0b1220` / night `#121c30` / panel `#1a2740` / line `#24334f` / ink `#e7eef9` / mist `#a2b3d1` / gold `#f5c542` / teal `#35d0ba` / coral `#ff6b6b` / amber `#f0a860` / signal `#5b8def` + dim 变体（gold-dim 等）。
- **语义**：gold = 星时刻（目标/轨道/odds/AI 归因/champion/主 CTA）；teal = 涨/盈利/买入/running；coral = 跌/亏损/危险/拒绝；amber = 等待人类；signal = 外部系统/预测带/focus。
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
- 验收：以 Grok 截图（`screenshots/`）为视觉基准逐页对照；lint + build 绿；五页 SSR 200；五跳转 307。
