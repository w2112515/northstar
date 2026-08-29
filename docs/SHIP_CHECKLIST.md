# 发布清单 — 你需要做的事（按顺序）

> 代码侧已就绪：全部 G1–G6 已实现并验证，G7 的容器/部署脚本/文档已备好。
> 以下是只有你能做的外部动作。北京时间提醒：**Google 截止 9/1（周二）08:00；美股周一 21:30 开盘。**

## 1. Gemini API key（10 分钟，今天就做）

1. 打开 aistudio.google.com → Get API key → 创建。
2. 写入 `.env` 的 `GOOGLE_API_KEY=...`。
3. 重启 API（`scripts\dev.ps1`），驾驶舱跑一次 pass：journal 里 digest 的 `llm: true` 即生效。
4. 如模型名报错，调整 `.env` 的 `GEMINI_FLASH_MODEL` / `GEMINI_PRO_MODEL`（用 aistudio 上你可用的型号）。

## 2. 两个平台注册（30 分钟）

- Google 赛道：Devpost 注册 + 组队页（如需）。
- Alpaca 赛道：报名表 + **创建比赛专用 paper 账户**（$100k），拿新 key。
  比赛 key 放 `.env` 并把 `ACCOUNT_ROLE=competition`（换 key 时同时换 `ALPACA_API_KEY/SECRET`）。

## 3. GCP 项目 + gcloud（G7 部署，约 1 小时）

1. console.cloud.google.com 建项目，兑换黑客松 $150 credits。
2. 启用 API：Cloud Run、Cloud Build、Firestore（Native mode 建库）。
3. 安装 gcloud CLI → `gcloud auth login` → `gcloud config set project <id>`。
4. 部署：`.\scripts\deploy.ps1 -ProjectId <id>`（先 API 后 Web，自动接线）。
5. 验证：Web URL 能开驾驶舱；`<api-url>/healthz` 返回 `journal_store: firestore`。

## 4. 周一晚录制窗口（北京时间 21:30 后）

美股开盘后周五排队的 4 笔订单成交 → 驾驶舱出现真实持仓与 fills。录制脚本见
`docs/ROADMAP.md` §视频脚本。镜头顺序建议：
不现实目标红色路径 → 改现实目标开航 → 驾驶舱真实成交 → 闸门拒绝镜头（改集中度演示）→
Evolution 晋级审批 → journal 血缘 → Cloud Run URL + logs。

## 5. 提交

- Google/Devpost：repo 链接（推 GitHub public）、Cloud Run URL、5 分钟视频、架构图（README 有）。
- 推 GitHub 前确认：`git log --all -- docs/apikey.md` 应为空（该文件从未入库）；`.env` 不在任何提交里。
- Alpaca（9/4 前）：write-up（`docs/ALPACA_SUBMISSION.md` 定稿）、3 分钟视频、传播帖。

## 已知待办（代码侧，可选增强）

- 价差策略目录补齐（bull put spread 等 8 个，A2）——编译器与闸门已有钩子。
- AI Analyst 策略（Gemini + MCP 只读工具）——`northstar/adkflows/mcp_tools.py` 已就绪，等 key。
- Evolution 包装成第二个 ADK 图（叙事增强）。
- trade_updates websocket 替代轮询确认。
