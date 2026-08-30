# 发布清单 — 你需要做的事（按顺序）

> 代码侧已就绪：全部 G1–G6 已实现并验证，G7 的容器/部署脚本/文档已备好。
> 以下是只有你能做的外部动作。北京时间提醒：**Google 截止 9/1（周二）08:00；美股周一 21:30 开盘。**

## 1. Gemini API key（10 分钟，今天就做）

1. 打开 aistudio.google.com → Get API key → 创建。
2. 写入 `.env` 的 `GOOGLE_API_KEY=...`。
3. 重启 API（`scripts\dev.ps1`），Activity 页 Controls 跑一次 pass：journal 里 digest 的 `llm: true` 即生效。
4. 默认模型已升级为 `gemini-3.7-flash`（8/13 GA，"agent 工作马"，已实测本 key 免费档可用），
   降级链自动退 `gemini-3.5-flash`；`gemini-3.1-pro-preview` 免费档配额为 0，已弃用。
   若演示日担心 503（新模型高负载），可给项目挂账单进 Tier 1 并设 Project Spend Cap。

## 2. 两个平台注册（30 分钟）

- Google 赛道：Devpost 注册 + 组队页（如需）。
- Alpaca 赛道：报名表 + **创建比赛专用 paper 账户**（$100k），拿新 key。

### 双账户运行方式（两个 paper key 分赛道）

- 两对 key 同时放 `.env`：默认对 = dev（Google demo），`ALPACA_API_KEY_COMPETITION` 对 = 比赛账户。
- 换赛道 = 只改 `ACCOUNT_ROLE` 一行 → 重启 API。日志/状态按角色隔离在 `data/<role>/`
  （峰值净值、冷却、审批互不串账），历史各自保留。
- 同一时刻本地只跑一个实例；录 Google demo 的半小时里比赛账户停摆无伤大雅。
- Cloud Run 部署天然支持双实例：两个 service 各配各的环境变量即可（容器内无 `.env`，读进程环境）。

## 3. GCP 项目 + gcloud（G7 部署，约 1 小时）

1. console.cloud.google.com 建项目，兑换黑客松 $150 credits。
2. 启用 API：Cloud Run、Cloud Build、Firestore（Native mode 建库）。
3. 安装 gcloud CLI → `gcloud auth login` → `gcloud config set project <id>`。
4. 部署：`.\scripts\deploy.ps1 -ProjectId <id>`（先 API 后 Web，自动接线）。
5. 验证：Web URL 能开 Track 页（顶栏 KPI 有数）；`<api-url>/healthz` 返回 `journal_store: firestore`。

## 4. 周一晚录制窗口（北京时间 21:30 后）

美股开盘后周五排队的 4 笔订单成交 → Track 持仓表与 Activity 蜡烛图出现真实持仓与 fills。
权威录制脚本见 `docs/DEMO_SCRIPT.md`（已按 Night Ledger v4 页面重映射）。镜头顺序建议：
/start 不现实目标红色路径 → 改现实目标开航 → Track 真实成交 → 闸门拒绝镜头（改集中度演示）→
System 进化晋级 + Track 审批 → Proof 账本血缘 → Cloud Run URL + logs。

## 5. 提交

- Google/Devpost：repo 链接（推 GitHub public）、Cloud Run URL、5 分钟视频、架构图（README 有）。
- 推 GitHub 前确认：`git log --all -- docs/apikey.md` 应为空（该文件从未入库）；`.env` 不在任何提交里。
- Alpaca（9/4 前）：write-up（`docs/ALPACA_SUBMISSION.md` 定稿）、3 分钟视频、传播帖。

## 已知待办（代码侧，可选增强）

- ~~价差策略目录补齐~~ 已完成：9 族可跑（wheel/CSP/CC、三种价差 MLEG、动量/RSI/MA 金叉），
  策略页有启用开关，闸门新增期权等级/冻结名单/限速/单笔上限。
- ~~市场气象台 v1~~ 已完成：SPY 波动率百分位 + Alpaca 头条关键词基调 + GDELT 全球基调
  合成 0-100 确定性指数；闸门软规则（低于 `weather_floor` 新开仓转人工，永不拦平仓）；
  驾驶舱气象卡 + 桶位变化写日志 + 每 15 分钟读数沉淀 `weather_history`（供 v2 阈值回测）。
  注意：GDELT 在本机网络不可达（TLS 被断），自动降级标注 offline；Cloud Run 美区应可连通。
- ~~P0 盈亏追踪~~ 已完成：`pnl.py` 记账（executor 成交钩子精确记 + 消失仓位对账标注估算），
  `consecutive_losses` 有人写了（亏+1/赚归零），冷却断路器从此真实生效。
- ~~P0 审批超时清扫~~ 已完成：调度器每分钟 `expire_stale_approvals`，超时=自动拒绝并写日志。
- ~~P0 期权退出管理~~ 已完成：`exits.py` 50% 止盈 / DTE≤7 离场；单腿 buy-to-close、
  价差/铁鹰整单 MLEG 反向平仓；闸门 closing 语义（平仓单跳过所有"拦新风险"规则，
  kill switch / 期权白名单 / MLEG 等级保留）；退出阶段在策略提案之前跑（先释放资金）。
- ~~P1 夜间任务~~ 已完成：`nightly.py`（试用期结算 → 进化轮 → 胜率重算 → 气象日报 →
  漂移对照 → 净值点），调度器 UTC 01:00 后每日一次，`POST /api/engine/nightly` 手动触发。
- ~~P1 AI Analyst~~ 已完成：Gemini Pro 事实包提案（方向+论点），代码定尺寸/白名单/上限 0.7
  conviction，无 key 沉默不装 AI；4 小时冷却省配额；目录已翻 runnable。
- ~~P1 Evolution ADK 图~~ 已完成：`evolution_flow.py`（load_champion→propose→backtest→judge），
  与 `run_evolution_round` 共用同一套阶段函数；Lab 手动触发走图，夜间直调函数。
- ~~P2 气象 v2~~ 已完成：`backtest/weather_gate.py` vol 代理 walk-forward（IS 选阈 → OOS 验证，
  诚实标注代理性质）；Lab 卡片 + `/api/lab/weather-validation`（按日缓存）；
  夜间漂移对照（weather_history ≥50 条后自动启动）。首轮真实数据结论：该窗口内
  vol-only 阈值不提升 Sharpe（OOS "does not help"）——诚实呈现，气象层定位为风险偏好而非收益声明。
- ~~P2 进化 paper-trial~~ 已完成：批准 → 3 天小权重试用（TRIAL_WEIGHT=0.1，父版本暂歇）→
  夜间结算：窗口内无 kill/硬断路转正，否则归档并复位父版本；日志全程标注。
- ~~P2 业绩报告~~ 已完成：`report.py` + `scripts/tearsheet.py` → `docs/TEARSHEET.md`
  （Alpaca portfolio history 优先，夜间净值曲线兜底；按族已实现盈亏归因表，估算行明确标注）。
- ~~P2 正式 Deflated Sharpe~~ 已完成：`0.08*sqrt(n)` 占位换成 Bailey/López de Prado
  期望最大 Sharpe 折扣（Lo 标准误 + 正态分位，纯 stdlib），试验越多门槛越高。
- ~~2026 新栈四件套~~ 已完成（8/30）：
  1. **Gemini 3.7 Flash**（8/13 GA）全线接管 + 降级链，死掉的 Pro 通道复活；
  2. **A2A 协议**：气象台成为可发现 agent（`/a2a/weather/.well-known/agent-card.json`，
     JSON-RPC `message/send` 实测通），确定性应答不烧配额；
  3. **牛熊辩论**（FinCom 2026 Disagree-or-Commit）：批评者红队每笔 AI 提案，
     强反对=毙、弱反对=打折进闸门、裁决是代码；日志 kind=debate，驾驶舱有辩论卡；
  4. **TimesFM**（Google 时序基础模型，本月出 3.0）：夜间画全标的 5 日分位带
     （q10/q50/q90），只做决策辅助进分析师事实包 + 驾驶舱扇形图，永不触发订单。
  另：每次 ADK pass 落 kind=trace 节点级耗时（哪些节点真用了 Gemini），
  驾驶舱"Agent graph"卡实时可视化 —— 玻璃盒叙事的核心镜头。
- ~~实时工作流图 + 手动强平 + API 并发修复~~ 已完成（8/30，对标 TradingAgents-AShare / frequi）：
  1. **Agent graph 升级为 React Flow 实时 DAG**（与 AShare 同库）：主链 7 节点 + 气象台
     A2A 卫星 + TimesFM 卫星 + 牛/熊/裁决辩论簇；pass 运行中节点逐个点亮
     （`pass_progress` 信标，驾驶舱 3s 轮询），空闲时显示上一 pass 节点耗时与
     GEMINI/TEMPLATE/CODE 徽章。金=Gemini 建议，青=代码决定 —— 赛道叙事一图说清。
  2. **持仓行 Close 按钮**（frequi ForceExit 的诚实版）：股票双向限价平仓；点期权任一腿
     = 整个结构反向平仓（MLEG，绝不留裸腿）；仍走闸门（closing 语义，kill switch 优先）。
     `POST /api/positions/close`，7 个新测试，共 120 绿。
  3. **关键并发修复**：ADK pass 从事件循环挪到工作线程私有 loop——此前 LLM 调用会把
     整个 API 冻住 50+ 秒（驾驶舱假死），现在 pass 期间所有端点毫秒级应答（实测 1s 轮询全通）。
- ~~UI 质感升级（对标 AShare 终端形态）~~ 已完成（8/30 第二波）：
  1. **Market 面板**：lightweight-charts（TradingView 开源库，AShare 同款）真日 K，
     TimesFM q10/q50/q90 分位带虚线画进未来 5 个交易日，我们自己的成交在 K 线上
     打箭头标记（`/api/market/bars|fills`，10 分钟缓存 + symbol 注入守卫）。
     注意：fill 事件当前为空（现有 SPY 铁鹰早于记录钩子），周一开盘成交后箭头自然出现。
  2. **净值 sparkline**：北极星卡内嵌 Alpaca portfolio history 金色面积图（`/api/equity-history`）。
  3. **Lucide 图标语言**：北极星/舵/K线/Agent 图/辩论/预报/审批/日志/持仓 全卡统一图标。
  4. **批评者头条弹药**：牛方提出标的后，抓该标的 48h Alpaca 头条只喂给批评者
     （倡导者看不到），辩论卡显示"批评者看到的新闻"；`ANALYST_NEWS_DISABLED` 测试守卫。
     123 测试绿，前端构建通过。
- ~~前端终端化重构（8/30 第三波，Fincept/frequi 形态落地）~~ 已完成：
  1. **状态 ribbon**（全页面共享，sticky 置顶）：净值+迷你 sparkline、Today、From peak、
     Odds、航程进度条（无目标时变 CTA 芯片）、市场开闭灯、天气读数、Autopilot 灯、
     KILL ON 红章；自取数（state/loop 15s、weather 60s、净值 5min），任何页面滚到哪都在。
  2. **驾驶舱 12 栏重排**：hero 与北极星大卡解散（数字全部上 ribbon）；左主列 =
     Market 面板 → Agent graph → Live feed | 持仓表（xl 双栏）；右栏 360px =
     审批（最优先）→ Helm → 辩论卡 → 预报卡 → 紧凑气象卡。容器 max-w-6xl → 7xl。
  3. **Market 面板加料**：底部 1/5 成交量直方图（红绿同色低透明度）、图高加到 380px、
     标的 >6 个时 xl 显示左侧 watchlist 竖栏（芯片行自动隐藏）。
  4. **底部终端 ticker**（fixed，全页面）：最新 journal 一行 + UTC/纽约双时钟秒跳，
     Fincept 风格终端锚。构建通过，SSR 冒烟含 ribbon/ticker，五端点接口冒烟全绿。
- ~~五方评审修复波（8/30 下午，按评审清单全修）~~ 已完成：
  1. **钱路互斥**：pass 全局锁覆盖 tick/调度器/run-once 三入口（并发实测第二个拿到
     honest "skipped"）；审批决定原子翻转（双击/并发只有一个赢，2 个并发测试背书）。
  2. **幂等下单**：所有订单带 `client_order_id`（plan id 派生），Alpaca 侧原生去重，
     重放返回既有订单而非二次下单。
  3. **成交对账器**（`fills.py`）：每 5 分钟扫描 closed orders，补写离线成交的 fill
     事件（周末排队周一开盘成交场景），幂等去重 + 从 order 事件找回血缘 refs。
  4. **sleeve 预算双保险**：动量策略买入按剩余预算裁剪（策略侧），闸门新增第 17 条
     `sleeve_budget` 规则（族敞口 + 新买入 ≤ 权重×净值×1.1）——评审发现的 49% vs 30%
     超配从此结构性堵死。注意：存量超配不会自动减仓，靠轮动消化或手动 Close。
  5. **部署加固**：`NORTHSTAR_ADMIN_TOKEN` 写保护中间件（GET 公开可看，POST 需
     token，web 代理服务端注入，浏览器永远看不到；A2A 只读端点豁免）；API
     max-instances 1（调度器/锁单进程假设显式化）。
  6. **Firestore 语义对齐**：events() 的 kind 过滤改为"limit 按过滤后计数"（超取
     后裁剪，不需要复合索引），云上 order 限速统计与本地一致。
  7. **前端三修**：K 线图按内容（而非引用）比较预报输入——20 秒轮询不再整图重建、
     不再丢用户缩放；act 失败有 amber 横幅（数据可能过期）；ribbon 监听
     `northstar:refresh` 事件，kill/autopilot 翻转即时同步。
  8. **赢面文档**：`docs/DEVPOST.md`（闸门拒 AI 冷开场 + 60 秒评委验证路径）、
     `docs/DEMO_SCRIPT.md`（5min Google 版 + 3min Alpaca 版 + 绿/红/兜底三版 P&L
     叙事 + 录制检查清单）；README 口径统一到 17 条闸门 + 钱路加固段落。
     137 测试绿（+14），前端构建过，API 已重启带新代码。
- ~~研究飞轮三波（8/30 晚，研究层自治完整落地）~~ 已完成：
  **W1 谷歌成色**：
  1. **Scout 机会雷达**（`scout.py`）：Alpaca ScreenerClient 最活跃+涨跌幅榜 →
     流动性地板（价>$5、日均美元额、拆股哨兵）→ 确定性因子打分（动量/RSI/gap/量能）
     → Top-12 报告，每条带人话理由；`state/scout` + kind=scout 事件 + 夜班挂载 +
     `POST /api/scout/run`；screener 不可用诚实降级核心名单。
  2. **侦察榜接线**：`EngineContext.scout_symbols`，momentum/meanrev/macross 并入
     universe（`use_scout` 默认开，持仓保护——掉榜仍可卖出），analyst 辩论侦察榜
     前 3（批评者自动拿对应头条）。
  3. **目标条件化进化**：`goal_fit`（月度 OOS bootstrap MC 达标概率 − 风险档回撤
     惩罚 3×/2×/1×）；DSR 统计地板不丢 + goal_fit 显著更高才换冠军；无 plan 回退
     纯 DSR；journal 写"为你的目标选择"。同批候选保守/进取选出不同冠军（测试背书）。
  4. **船长日志**：夜班 digest 升级——确定性 P&L 归因（按族）+ Gemini 4-6 句叙事
     （战果/拖后腿/明日关注）+ 无 key 模板 fallback；驾驶舱船长日志卡。
  **W2 预测但诚实 + Alpaca 武器**：
  5. **市场罗盘**（`regime.py`）：SPY 200SMA±斜率 × 20d 已实现波动 2 年分位 × 广度
     → 9 种确定性 regime；4 年历史序列；各族冠军 OOS 按 regime 分桶条件化统计
     （桶内 <120 交易日拒答）；Gemini 只写带置信度的市场假设；`state/compass`。
  6. **舵手建议**（`advisor.py`，HITL 独立于钱路）：regime 稳定 ≥3 天 + 距上次 ≥5 天
     才触发；建议 = plan 护栏内 sleeve 有界倾斜（±10%）附三行证据；adopt 改 plan
     allocations / dismiss 记录；反事实记账两边都追踪。
  7. **预报成绩单**：`state/forecast_history` 快照 → 夜班回评 q10-q90 落带率 +
     pinball 分位损失 → 预报卡 skill 行。
  8. **期权机会扫描**：侦察榜∪核心中可期权 ≤12 只按 CSP 权利金年化收益率排名 →
     `state/options_watch`；wheel/spreads 消费。
  9. **因子筛选器 C1**（`factors.py`）：13 已知因子注册表 → 夜间横截面 rank-IC
     （vs 前向 5d，250d 窗）→ `state/factor_ic`；scout 权重按近期 IC 有界 tilt
     （±20%，journal 说明）。明确标注"筛选已知因子，非挖掘"。
  10. **自动日报**：夜班 markdown 日报（净值/成交/P&L/regime/侦察亮点/船长日志）
     → `GET /api/report/daily`（Alpaca 传播素材）。
  11. **W2 前端**：罗盘卡替换天气小卡（regime 徽章+条件化统计+Advisor Adopt/Dismiss）、
     ribbon regime 短标、Factor Radar（现 Research 工作台 Mining tab）、侦察卡期权观察行。
  **W3 王牌（从调参到造策略）**：
  12. **策略 DSL + 船坞**（`dsl.py` + `strategies/dsl_rotation.py`）：StrategySpec v0
     （因子加权信号+SPY 趋势 filter+top_n/rebalance_days，schema 校验+钳制，受限
     语法非任意代码）；通用 rotation 回测走 `walk_forward_eval`（family=dsl_rotation）；
     live 适配器复刻 momentum 提案机制使 DSL 候选真实可试航——同一条 DSR + goal-fit
     + 人批 + 试航管线；Gemini 每晚提 spec（模板 fallback）；船坞卡（现 Research 工作台 Evolution tab）。
  13. **因子挖掘 lite C2**（`mining.py`）：受限表达式搜索（注册表因子加权组合，
     随机+LLM 引导）→ rank-IC 按**终身尝试次数**折减（B&LdP 期望最大值）→ 人批
     准入 `state/factor_library`（Research 工作台 Mining tab 按钮）→ 入库因子对船坞可见 + 衰减追踪
     （衰减自动打旗，绝不静默）。
  全部回路共用诚实管线（walk-forward + DSR/折减 IC + 最小样本拒答 + 人批 + 试航），
  全部有 `*_DISABLED` 开关与诚实降级路径（见 `.env.example`）；scheduler 每日夜班
  串起 scout → options → factors → compass → advisor → forecast 回评 → 进化 →
  船坞 → 挖矿 → 船长日志 → 日报。测试 300+ 绿，前端构建过。
- ~~Night Ledger v4：前端夜色回归（8/31）~~ 已完成：
  1. **IA 定稿四页**（承接 8/31 EVIDENCE 重构）：`/` Track（我在轨道上吗）、`/activity`
     Activity（它在干什么）、`/proof` Proof（凭什么信）、`/system` System（机器怎么运转）
     + `/start` 向导；旧 /research /strategies /journal /lab /onboarding 全部重定向。
     上文历史条目中的"驾驶舱/Research 工作台/Lab/Journal"按此对照阅读。
  2. **皮肤换夜**：EVIDENCE 的浅色纸面否决（与夜航品牌/demo 叙事冲突），全站回归夜色
     token（globals.css `:root` 夜蓝 + 全局 starfield），结构纪律全保留（Section 格线/
     Stamp/FieldNote/六档字阶）；`theme.ts` 收敛单一夜色 CHART；金色三律：主 CTA、
     FieldNote AI 归因、目标与航迹（金航迹线/✦/顶栏进度尺），交互态仍归 indigo。
  3. **侦察报告卡恢复**（EVIDENCE 重构时唯一丢失的 Wave 界面，demo 0:55 镜头）：
     Activity 页 Scout report Section——Top-K 表（symbol/price/score/flavor 章/人话理由）
     + 期权观察脚注行 + scanned/floor/source 脚注 + Scan now；空态/加载态/错误态齐备。
  4. **ProbStrip 标签碰撞修复**：标签余量自包含（h-24 容器内定位，上排标签不再溢出
     压住调用方内容）。
  5. **文档同步**：DESIGN.md v4（夜色色板表+金色三律）、DEMO_SCRIPT.md 页面全量重映射、
     README/TECH/本清单操作项改新页面名。
- 剩余可选：AI Analyst MCP 工具链（`AI_ANALYST_MCP=true` 路径）、trade_updates websocket 替代轮询、
  Alpaca 周加菜：指数期权气象对冲（XSP 现金交割 put spread，用上 7/23 新功能）。

## 提交前最后一步（生成业绩报告）

```powershell
cd "d:\Work\hks 30\apps\api"; uv run python scripts/tearsheet.py   # 刷新 docs/TEARSHEET.md
```
