# NorthStar — 前端设计与视觉概念

> 状态：v4，2026-08-31（**Night Ledger：夜色回归**。保留 v3/EVIDENCE 的全部结构纪律——四页 IA、Section 格线语法、Stamp 印章、FieldNote、六档字阶；作废的只是浅色纸面皮肤。v2 Night Voyage 的夜色身份与金色星时刻回归，全站一套夜色板，`.start-dark` 暗房机制退役）。
> 本文件是交互结构与视觉方向的唯一 owner。审计见 `docs/FRONTEND_AUDIT.md`。
> 平台决定：**Web 桌面优先**，1280px 主设计，平板/手机降级可用不精修。界面语言：**英文**，术语 tooltip 内置人话解释。

## 0. 设计主张

**界面回答一个问题："你能不能到达，凭什么？"** 每个数字可溯源、每个决策有裁决、每个预测被打分。视觉语言 = **夜航账本（Night Ledger）**：深夜蓝纸面、亮墨、格线、盖章，淡星空铺底；产品叙事（把钱送往北极星的夜航）与证据纪律（实验记录簿）同屏成立。

**叙事弧不再靠换房间表达**：全站同一片夜空，`/start` 向导以轨道弧（GoalOrbit）做仪式感开场，主应用用格线账本做证据。产品名的视觉回声 = 金色四角星（目标线端点、ProbStrip 目标刻度、顶栏进度尺填充）。

## 1. 信息架构（按用户的问题组织）

顶栏导航 4 项：

| 路由 | 名称 | 回答的问题 | 内容 |
|---|---|---|---|
| `/start` | 向导 | 我要去哪？ | 四步：目的地（轨道弧）→ 风险三问 → 诚实计划（概率+锥形图+诚实替代方案红路径）→ Begin |
| `/` | **Track** | 我在轨道上吗？ | hero（72px 净值 + ProbStrip 终端分位条 + TrajectoryHero 计划vs现实锥形图）→ Needs you（审批+顾问倾斜，统一决策区）→ Today（daily brief，AI 叙述走 FieldNote）→ Positions + queued orders |
| `/activity` | **Activity** | 它在干什么？ | 上下文条（regime/weather/开盘/autopilot/scout）→ Live run schematic（ADK 工作流 schematic）→ Market（蜡烛图 + 分组 watchlist）→ **Scout report**（Top-K 表 + 人话理由 + 期权观察行 + Scan now，demo 0:55 镜头）→ Event stream（小印章行）→ Controls（autopilot/run/kill） |
| `/proof` | **Proof** | 我凭什么信它？ | 印章账本（按日分组/筛选/搜索/展开 JSON）→ 预测打分（coverage/pinball + 扇形图）→ 闸门拒绝统计 → 辩论记录 |
| `/system` | **System** | 机器怎么运转？ | 策略规格表（非卡片）+ 实例表 → 进化（晋级候选/实验账本）→ 因子挖掘 → 气象验证 → 家族 regime 统计 |

旧路由 `/research` `/strategies` `/journal` `/lab` `/onboarding` 全部 307 redirect。

## 2. 视觉契约

### 色板（语义锁死，违反即 review 打回）

| token | 值 | 唯一语义 |
|---|---|---|
| `paper` | `#0D1420` | 页面底（夜空） |
| `raised` | `#131C2E` | 唯一允许的面板（待审批、浮层、tooltip） |
| `inset` | `#0A101B` | 图表底板、代码块、输入框 |
| `ink` / `ink-2` | `#E8EDF6` / `#9AA7C0` | 主文字 / 次要文字 |
| `hairline` | `#26334C` | 格线——唯一分层手段 |
| `indigo` | `#8AA2FF` | **交互强调**：链接、focus ring、导航/tab 激活态、running、champion 印章 |
| `star` | `#F5C542` | **星时刻，仅三处**（金色三律，见下） |
| `red` | `#E0655F` | 拒绝/亏损/危险——印章形态 |
| `green` | `#4CAF8E` | 成交/盈利/验证通过 |
| `amber` | `#D9A23B` | 等待人类（审批、待决、PAPER 标记) |

**金色三律**（star 只出现在这三处，其余一律 review 打回）：

1. **主 CTA**：Button primary = 金底夜字（每屏至多一个星时刻动作）。
2. **AI 归因**：FieldNote 左边线与洗底（衬线斜体质地保留）。
3. **目标与航迹**：TrajectoryHero 实际净值线、目标虚线与 ✦ 标、ProbStrip 目标星刻度、顶栏 ProgressRuler 填充、/start 轨道弧的星与船标。

hover/焦点/激活态永远归 indigo，不得用金表达交互状态；锥形扇区保持中性墨色。

**AI 归因 = 质地 + 星色**：AI 叙述 = `FieldNote`（淡金洗底 + 衬线斜体 + mono 签名行 "narrated by gemini · … · AI narration, not a decision"）；确定性事实 = 正排 mono。两者永不混淆。

### 排版

Geist Sans（UI）+ Geist Mono（全部数字/标签/印章，tabular-nums）+ 系统衬线（Georgia italic，仅 FieldNote 与 schematic 的 `Ai` 签）。六档 token，禁用任意值：`micro 11` / `body 13` / `section 15` / `page 20` / `display 32` / `hero clamp(44px, 9vw, 72px)`。

### 布局语法

- 页面 = 纸面上的横格线分区（`Section`：hairline 顶线 + micro mono 大写节标 + 内容直接坐在纸上）。只有真正独立的内容（待审批）才配 `raised` 白面板。
- 账本行签名版式：`[Stamp 96px | 内容 1fr | 时间戳 mono 右对齐]`，展开见原始 JSON。
- 顶栏单行：wordmark · 4 项导航 · 净值+今日Δ · ProgressRuler 细进度尺 · 琥珀 "N need you" · kill 印章 · NY 时钟 · PAPER 标记。sticky。
- 容器 `max-w-6xl`。

### 签名元素

1. **TrajectoryHero**：真实净值曲线（**金航迹线**）叠蒙特卡洛锥（p10–p90 墨色扇 + p50 虚线），金色目标虚线直尺 + 端点 ✦。计划 vs 现实同屏。
2. **Stamp**：描边大写 mono 印章——`REJECTED` 红 / `FILLED` 绿 / `NEEDS YOU` 琥珀 / `PROMOTED`/`CHAMPION` 靛。`eventStamp()` 把 journal 事件映射成印章。
3. **ProbStrip**：终端分位横条（rough/median/lucky 三刻度 + 金色目标星标 + "estimate, not a promise" 脚注）。标签余量自包含在 h-24 容器内，不得溢出压调用方内容。
4. **FieldNote**：AI 归因块（见上）。
5. **ProgressRuler**：顶栏细进度尺，金色填充。

### 动效

近乎零。仅：新账条 `flash` 600ms 高亮、印章 `stamp-in` 180ms、schematic 节点 150ms 切换。星空为静态定位星点（无 hydration 漂移）；`twinkle` 与 `pulse-slow` 仅限星时刻元素（目标 ✦、/start 船标）。全部 `prefers-reduced-motion` 关闭。

### 可访问性

夜底亮墨对比充裕（ink/paper ≈ 15:1，ink-2/paper ≈ 7:1，star/paper ≈ 10:1，金底夜字 CTA ≈ 10:1，全部过 AA）；focus = 全局 2px indigo ring；印章是文字不是颜色；涨跌带 +/− 符号；`<html translate="no">` 防自动翻译。

## 3. 文案原则

- 人话优先，术语必带 tooltip；动作句式统一：做了什么 + 为什么 + 影响。
- **禁词表**：保证、稳赚、必胜、无风险、躺赚。
- **隐喻黑名单**（v3 起执行，v4 维持）：captain / voyage / fleet / helm / sail / dock / on board / waiting on you。替换：Daily brief / Plan progress / the system / Controls / Enable / Pause / Positions / Needs you。夜色回归的是**视觉身份**（星空、金星、夜蓝），不解禁文案里的航海隐喻词。
- 概率与收益永远带"基于历史估计"脚注；数字 tabular-nums；涨跌带 +/−。

## 4. 组件与实现注记

- 栈：Next.js 16 + Tailwind 4 + SWR + recharts + lightweight-charts + @xyflow/react + lucide（仅必要时）。
- 组件层：`ui.tsx`（Section/Stamp/FieldNote/Ledger 行/Button/EmptyState/Skeleton/PaperTag/PageHeader）、`trajectory.tsx`（TrajectoryHero/ProbStrip）、`schematic.tsx`（RunSchematic/DebatePanel/ForecastFan）、`systems.tsx`（System 页四区）、`orbit.tsx`（仅 /start）、`topbar.tsx`/`chrome.tsx`。
- 图表主题单一来源：`lib/theme.ts`（单一夜色 `CHART` + `RECHARTS_TOOLTIP` + `AXIS_TICK`），与 globals.css `:root` 同步义务成对修改；图表层禁止就地定义色值。
- 领域类型单一来源：`lib/types.ts`。
- 数据层：`lib/data.ts`（SWR 单飞轮询 + northstar:refresh 桥）。
- 星空：`.starfield` 挂在 `<body>`（layout.tsx），星点用 color-mix 引 token，换色板自动跟随。
- 验收：1280/768 两宽五页截图；needs-you / kill-ON / 红路径 / 空账 四态留证；lint + build 绿；旧路由 redirect 生效。

## 5. 参考来源说明（诚实声明）

Mobbin MCP 需付费方案，两轮均未能取得截图参照。方向判断参照已核验的产品模式与类目惯例，只借鉴模式不复制表面：Linear（克制与一个强调色）、Vercel（工程美学）、FT/WSJ 印刷图表（金融图表传统）、Bloomberg（密度即信任）、Stripe（金融严肃感+编辑级打磨）、实验记录簿/示波器（印章与 schematic 语法）。两张 AI 生成方向稿（深色星图 vs 浅色账本）由用户生图产出；v3 曾选浅色账本，v4 经用户对照实机截图后裁定：**结构取账本，身份取夜航**——即本版 Night Ledger。
