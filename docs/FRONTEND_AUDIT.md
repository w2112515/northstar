# NorthStar 前端攻击性审计报告 · v2

> **v3 指引（2026-08-31）**：本文档的 v2 重构方案（Night Voyage 2.0）已被用户否决——"只是在现有基础上打磨"。经两轮方向稿对照评审，产品前端已按 **EVIDENCE v1**（浅色实验记录簿 + 深色向导室）彻底重构，新契约见 `docs/DESIGN.md` v3。本文以下内容留档，作为"为什么抛光不够"的证据链。
>
> **v3.1 对抗审计轮（2026-08-31）**：EVIDENCE v1 落地后，双子代理对抗审计（UIUX 34 项 + 工程 15 项发现）已收敛。P1 全修：① amber/green 文字对比度 3.6/3.95:1 → token 加深至 #8A5A08/#17724A（均 >5.6:1），ink2 alpha 文字全局禁用；② Track 在 bands 空子字段时白屏 → 前后端双端 None 防护 + 真值守卫；③ Today 简报被 per-pass digest 遮蔽 → limit=10 + narrative 挑选；④ eventStamp 读错 payload 键（verdict 判别字段是 `p.verdict`）→ APPROVED/REJECTED/NEEDS YOU 印章真正生效；⑤ 错误吞咽造假空态 → 各页错误分支条幅化；⑥ topbar 768px 溢出 → ProgressRuler 升至 xl；⑦ Stamp 纸色补丁 → 透明底。P2 全修：锥形 off-by-one（band 行 i=1 个月后）、xyflow 句柄类型错配丢两条边、info tooltip 改内联披露、月收入模式 ProgressRuler 谎言、策略 toggle 吞 ok:false、闸门统计误计 needs_human、ForecastFan 符号 bug、账本 300 条截断加"load older"、向导输入校验、动画违约（xyflow marching dashes 移除）、skip link、hero 图表 aria。残余声明：审批倒计时需后端暴露 timeout 字段（未造）；recharts 混合精度 tooltip 在 v3.10 下行为需真机确认；bands 端点已加按日缓存。lint/build/SSR 全绿。

**审计基础**：`apps/web/src` 全部 20 个文件（约 4,437 行）逐行通读；`docs/DESIGN.md` v1 设计契约逐条对照；v1 审计（2026-08-30 上午版）11 项修复清单一一核验。Mobbin MCP 仍需付费方案，本次仍无法取得截图参照（诚实声明，同 v1）。

---

## 0. 先给结论

v1 的 11 项修复**全部落地且质量在线**：假空态、竞态、翻译防护、导航高亮、字阶 token 化、SWR 数据层、queued orders、OCC 人话化、agent 图重排——这些是真的修好了，不是糊弄的。当前前端已经从"又丑又乱"修成了**"平庸的正确"**。

但"平庸的正确"恰恰是更危险的诊断：纪律病治好了，**身份癌**还在。这个产品叫 NorthStar，设计文档第一章承诺"北极星轨道图"是 Hero、金色"只用于星时刻形成仪式感"、动效"数字入场滚动、feed 滑入"——**这三条灵魂级承诺，当前代码交付率是零**。现在打开驾驶舱，你看到的是一个大数字、一根 2px 高的进度条、和一个 ✦ 字符。把 logo 换成任何一个 dark fintech 模板，这个页面都成立。一个要在两个赛道评委面前放 4 分钟视频的产品，**没有任何一帧画面能让人记住它叫什么**。

所以这次的结论不是"收敛修复"，而是：**视觉身份层彻底重构**——把设计文档承诺但从未交付的轨道隐喻、星时刻、动效真正造出来。骨架（路由、数据层、组件 API）保持健康，不动。

---

## 1. 身份缺席：产品没有签名视觉（P0，最重）

### 1.1 "Night Voyage" 名不副实
- 全部"夜航"氛围 = `body` 上 **5 个硬编码 1px 径向渐变点**（`globals.css:57-64`）。没有星座、没有刻度、没有结构——这不是星图，是噪点。
- DESIGN.md 承诺的"目标进度=轨道环"（`DESIGN.md:40,66,74`）交付物是：一根 `h-2` 线性进度条，右上方漂着一个 `✦` 文本字符（`page.tsx:382-395`）。**轨道、船位、北极星，三个意象一个都没有。**
- Hero 卡（`page.tsx:354-410`）是"大数字 + 横条 + 右侧百分比"的标准 SaaS 仪表盘构图。它不难看，但它可以是任何产品。

### 1.2 页面没有标题，没有 h1
- 全站唯一的 `<h1>` 藏在空目标 CTA 里（`page.tsx:416`）。Research 页以一排 tab 开场（`research/page.tsx:118`），Strategies/Journal 以 15px 灰色大写卡片标题开场（`strategies/page.tsx:74`、`journal/page.tsx:64`）。**页面自己不声明自己是谁**，导航高亮是唯一的位置线索。
- 字阶有 5 档（11/13/15/22/40），但缺"页面标题"档，且 hero 40px 低于契约承诺的 48–64px（`DESIGN.md:73`）。onboarding 第三步的目标金额用 22px——计划提案是"demo 高光屏"（`DESIGN.md:24`），数字还没有 ribbon 里的 equity 显眼。

### 1.3 金色仍然没有成为仪式
v1 把金色从 10 种职责砍到 4 种，但破口还在：
- **Compass 卡在 advisor proposal 待决时整卡金边**（`compass.tsx:112`）——"等你决策"是 amber 语义，不是星时刻。同一个语义在审批卡是 amber（`page.tsx:241`）、在这里是 gold，规则自己打自己。
- 两个"Scan now / Refresh"幽灵按钮 `hover:text-gold`（`agentic.tsx:559`、`research.tsx:73`）——hover 不是星时刻。
- 反过来，真正的星时刻反而没有金色：**voyage 进度条是页面唯一的目标可视化，却细得需要眯眼找**。

---

## 2. 纪律仍漏：图表层继续走私，嵌套语法三种并存（P1）

### 2.1 四个平行色板
UI 层 token 收敛了，图表层照旧各自为政：

| 位置 | 私货 |
|---|---|
| `market.tsx:27-32` | 本地 `UP/DOWN/GOLD/MUTED/GRID` 五个常量 |
| `agentic.tsx:316,350-352,364` | 边色 `grey`/`gold`/`rgba(94,205,171,…)`/`rgba(122,165,247,…)`/`rgba(230,112,109,…)` 就地定义 |
| `ribbon.tsx:109,116` | 硬编码 `#e8c268` ×2 |
| `onboarding/page.tsx:325-341` | JSX 内联 `#24334f`/`#93a4c3`/`#121c30`/`#35d0ba`/`#e8c268` |

token 改一个字，四个图表宇宙集体漂移。v1 审计说"图表和 UI 是两套色彩宇宙"——**现在还是**。

### 2.2 嵌套容器三种语法并存
- 无边框填色：`page.tsx:251` `rounded-xl bg-surface2`（审批子卡）
- 有边框有色：`agentic.tsx:463` `border border-teal/30 bg-teal/5`（辩论双方）
- 有边框中性：`agentic.tsx:476` `border border-line/70 bg-surface2/50`（headlines）

同一张卡里三种嵌套规则。去容器检验：审批子卡、shipyard 列表项（`evolution.tsx:281`）去掉边框后关系依然清楚——边框是习惯不是结构。

### 2.3 EmptyState 仍是框中框
`EmptyState` 自带虚线框（`ui.tsx:168-174`），而它所有的使用场景都在 Card 内（`research.tsx:80`、`compass.tsx:126`、`page.tsx:463`…）。虚线框套实线框，全站最廉价的视觉噪音。

### 2.4 对比度仍不达 AA
`--muted: #93a4c3` 的 `/70` 透明度变体（约 20 处：ribbon 标签、feed 时间戳、页脚注）在 `#121c30` 上有效对比约 **3.5:1**，11px 小字要求 4.5:1。`muted/50` 还有残留（`ticker.tsx:51`）。**最小的字配最低的对比，v1 原话，现在依然成立。**

---

## 3. 体验债：产品故事被排版顺序出卖（P1）

### 3.1 驾驶舱 IA 与产品故事倒置
DESIGN.md S2 规定的顺序是：**轨道 → 今日舰队日报 → 待决策 → 持仓 → feed**。当前实际顺序：市场图 → agent 图 → feed/持仓，而"船长日志"——产品灵魂"三句人话"——被 `line-clamp-2` 压在右栏最底部一张卡的角落里（`research.tsx:288-290`）。评委要看 30 秒才能找到"这个 AI 到底替我做了什么"的答案。

### 3.2 ticker：永久占屏的重复信息
底部 fixed ticker（`ticker.tsx:39-63`）永久吃掉 32px 视口高度，内容（最新 journal 事件）与驾驶舱 feed 完全重复；双时钟与 ribbon 的 market open 状态分离两处。1080p 录像里它占 3% 的每一帧，提供 0% 的增量信息。

### 3.3 ribbon 与 hero 重复
equity 在 ribbon（15px，`ribbon.tsx:102`）和 hero（40px，`page.tsx:363`）同屏 200px 内出现两次，today% 同样两次。ribbon 是跨页状态条该保留，但驾驶舱内需要差异化分工（见方案）。

### 3.4 Journal 没有"日期"这个日志最基本的结构
300 条事件一堵墙（`journal/page.tsx:113-138`），自称"航海日志"却没有日期分组。查"前天下午发生了什么"要肉眼扫描 300 行时间戳。

### 3.5 Agent 图移动端不可读
图跨度 960px（`agentic.tsx:123-136`），在 ~350px 宽手机上 fitView 缩放 ≈0.36，13px 标签渲染成约 4.7px；`panOnDrag={false}`（`agentic.tsx:407`）意味着捏合放大后**拖不动**，放大了也白搭。

### 3.6 动效为零
DESIGN.md:75 承诺"数字入场滚动、feed 滑入、审批卡轻脉冲"。全站实际动效清单：`animate-pulse` ×5 + `transition-colors` ×N。**一个自称 live terminal 的产品，看起来像静态截图。** 新事件进 feed 无滑入、hero 数字入场无 settle、星不闪烁。

### 3.7 onboarding 细节
- 输入框 `outline-none` 杀默认焦点环，只换 1px 边框色（`onboarding/page.tsx:172,199,209,…`），与全站 skyblue focus ring 不一致——键盘用户在表单里失明。
- 步骤圆圈纯展示但长可点的样子，已完成的步骤不能点击回退（`:144-152`）。

### 3.8 Settings 缺席（声明，不在本轮范围）
DESIGN.md 导航第 5 项 Settings（目标与护栏、kill switch、账户）不存在；目标设定后全站没有修改目标/查看护栏的入口，只能手动输 `/onboarding` URL。本轮是视觉与体验收敛，不新增页面，但记录在案——**这是下一轮的产品债，不是视觉债。**

---

## 4. 工程债（P2，可忍但记账）

- `page.tsx` 603 行：hero/approvals/helm/watchlist 全内联。组件 API 健康，但 hero 逻辑必须独立成 `GoalOrbit`（本轮做）。
- 图表三库（recharts / lightweight-charts / xyflow）无统一主题注入点（本轮做 `lib/theme.ts`）。
- 其余（SWR 单飞轮询、请求令牌、错误处理）v1 已修，健康。

---

## 5. 重构方案：Night Voyage 2.0

**一句话：把"北极星轨道"从文案变成界面骨架，让设计文档的三条灵魂承诺（轨道、星时刻、动效）真正交付。**

### 5.1 签名视觉：GoalOrbit
Hero 卡中央是一幅真实轨道图（SVG，无新依赖）：起点（本金）→ 弧线 → 船位（当前净值，呼吸光晕）→ 北极星（✦ 矢量星形，慢闪烁）。已航行段金色实线发光，未航行段虚线。星场用确定性坐标（避免 hydration 漂移）。**这是评委记住这个产品的那个镜头。**

### 5.2 色彩：语义锁死 + 金归契约
- `--gold` 从 `#e8c268` 提亮到契约值 **`#F5C542`**（`DESIGN.md:71`），全局 token 一改全改。
- `--muted` 从 `#93a4c3` 调到 `#a2b3d1`：`muted/70` 在 surface 上对比 3.5→**4.5:1**，过 AA。
- 语义锁死表（写进 DESIGN.md v2，违反即 review 打回）：

| 色 | 唯一语义 |
|---|---|
| gold | 星时刻：轨道/目标、GEMINI 归因、冠军与晋级、主 CTA |
| teal | 钱流入：涨、盈利、买入、sailing |
| coral | 钱流出/危险：跌、亏损、kill、destructive |
| amber | 等待人类：审批、待决、PAPER 徽章 |
| skyblue | 外部系统与交互：A2A/TimesFM、focus ring、链接 |

- 破口修复：Compass proposal 卡 gold→amber；两个幽灵按钮 hover gold→中性。

### 5.3 字阶：六档，页面有标题
`label 11 / body 13 / title 15 / page 20 / display 28 / hero 56`（hero 落入契约 48–64 区间）。新增 `PageHeader` 组件，Research/Strategies/Journal 三页获得 h1 + 一行上下文。

### 5.4 深度语言：一种，三档
night → surface → surface2 亮度递进 + hairline 边框为唯一分层手段；嵌套元素统一 `bg-surface2 rounded-xl` **无边框**（语义着色的辩论卡除外，那是内容不是容器）；EmptyState 去虚线框。

### 5.5 动效：服务状态，reduced-motion 兜底
- `rise`：hero 数字与页面主元素入场 settle（0.3s，一次）
- `slide-in`：feed/journal 新项入场（key 稳定，只有真新项动）
- `pulse-slow`：轨道船位呼吸（4s）
- `twinkle`：北极星与星场错相位闪烁（3–5s）
- 全部 `@media (prefers-reduced-motion: reduce)` 关闭。
- 契约更新：轮询环境下数字 count-up 每次刷新都跳是噪音，"数字滚动"改为"入场 settle"——DESIGN.md v2 如实修订。

### 5.6 Chrome 收敛
- **删 ticker**：32px 还给内容；NY 时钟并入 ribbon 右端（UTC 进 title）。
- ribbon 保持跨页状态条分工：紧凑 equity + sparkline + 状态灯；hero 是驾驶舱专属仪式版。重复可接受，分工明确即可。
- onboarding 输入框 focus 统一 skyblue ring；已完成步骤圈可点击回退。

### 5.7 驾驶舱 IA 归位（按 DESIGN.md S2）
轨道 Hero → **船长日志条**（blockquote 式左边框引用，narrator=gemini 时金边=AI 归因，template 时灰边）→ 待决策 → 市场/agent 图 → 持仓/feed。产品灵魂从右栏角落回到第二眼位置。

### 5.8 工程
- `lib/theme.ts`：三个图表库的唯一色彩来源（含 recharts tooltip 样式、xyflow 边色、lightweight-charts 配置），注释声明与 globals.css 的同步义务。
- `components/orbit.tsx`：GoalOrbit 独立组件。
- Journal 按 NY 日期分组，sticky 日期头。
- Agent 图小屏横向滚动容器（min-w 880px），不再缩成蚂蚁。

### 5.9 明确不做
- 不新增 Settings 页（产品债，另立项）；不改路由结构；不换图表库；不动数据层；不做亮主题。

---

## 6. 验收清单（落地后逐条核验）

- [ ] 驾驶舱第一眼：56px equity + 轨道图 + 28px odds，金色只出现在星时刻
- [ ] 眯眼测试：每页不读字能分出主次；每页有 h1
- [ ] 图表层零硬编码 hex（grep `#` 在 market/agentic/ribbon/onboarding 应只剩 theme 引用）
- [ ] `muted/70` 对比 ≥4.5:1；无 `muted/50` 残留
- [ ] feed 新项滑入、船位呼吸、星闪烁；开 reduced-motion 全停
- [ ] Journal 按日分组；小屏 agent 图可横滚；onboarding 键盘焦点可见
- [ ] `npm run build` 与 `npm run lint` 全绿
