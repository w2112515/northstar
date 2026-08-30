//#region node_modules/.nitro/vite/services/ssr/assets/seed-D7NXUXBT.js
var SAMPLE_STARTED = "2026-06-30T09:30:00-04:00";
var sampleVoyage = () => ({
	onboarded: true,
	startingCapital: 1e5,
	goalMode: "amount",
	targetAmount: 11e4,
	monthlyIncome: 800,
	deadlineMonths: 12,
	temperament: "balanced",
	startedAt: SAMPLE_STARTED,
	firstDay: false
});
var freshVoyage = (partial) => ({
	onboarded: true,
	startingCapital: 1e5,
	goalMode: "amount",
	targetAmount: 11e4,
	monthlyIncome: 800,
	deadlineMonths: 12,
	temperament: "balanced",
	startedAt: (/* @__PURE__ */ new Date()).toISOString(),
	firstDay: true,
	...partial
});
var samplePositions = () => [
	{
		id: "pos-spy",
		symbol: "SPY",
		humanName: "SPY",
		qty: 40,
		multiplier: 1,
		avgCost: 628,
		last: 644.2,
		side: "long",
		openedAt: "2026-07-02T10:14:00-04:00",
		family: "Core Trend"
	},
	{
		id: "pos-nvda",
		symbol: "NVDA",
		humanName: "NVDA",
		qty: 36,
		multiplier: 1,
		avgCost: 162.5,
		last: 178.4,
		side: "long",
		openedAt: "2026-07-11T11:02:00-04:00",
		family: "Drift Harvest"
	},
	{
		id: "pos-aapl",
		symbol: "AAPL",
		humanName: "AAPL",
		qty: 48,
		multiplier: 1,
		avgCost: 229.4,
		last: 241.1,
		side: "long",
		openedAt: "2026-07-08T09:41:00-04:00",
		family: "Core Trend"
	},
	{
		id: "pos-msft",
		symbol: "MSFT",
		humanName: "MSFT",
		qty: 18,
		multiplier: 1,
		avgCost: 411,
		last: 428.6,
		side: "long",
		openedAt: "2026-07-16T14:22:00-04:00",
		family: "Core Trend"
	},
	{
		id: "pos-qqq",
		symbol: "QQQ",
		humanName: "QQQ",
		qty: 24,
		multiplier: 1,
		avgCost: 498.5,
		last: 512.8,
		side: "long",
		openedAt: "2026-07-02T10:14:00-04:00",
		family: "Core Trend"
	},
	{
		id: "pos-amzn",
		symbol: "AMZN",
		humanName: "AMZN",
		qty: 28,
		multiplier: 1,
		avgCost: 186,
		last: 198.2,
		side: "long",
		openedAt: "2026-08-04T10:08:00-04:00",
		family: "Drift Harvest"
	},
	{
		id: "pos-meta",
		symbol: "META",
		humanName: "META",
		qty: 10,
		multiplier: 1,
		avgCost: 544,
		last: 562.3,
		side: "long",
		openedAt: "2026-08-12T13:19:00-04:00",
		family: "Scout Radar"
	},
	{
		id: "pos-nvda-c",
		symbol: "NVDA",
		humanName: "NVDA 19 Sep 180 C",
		qty: 3,
		multiplier: 100,
		avgCost: 5.8,
		last: 7.2,
		side: "long",
		openedAt: "2026-08-21T10:44:00-04:00",
		family: "Scout Options"
	}
];
var sampleCash = 25362;
var sampleOrders = () => [{
	id: "ord-spy",
	symbol: "SPY",
	humanName: "SPY",
	side: "buy",
	qty: 8,
	type: "limit",
	limit: 643.5,
	reason: "Drift Harvest, keel top-up. Waits for open.",
	createdAt: "2026-08-29T15:58:00-04:00"
}, {
	id: "ord-nvda-c",
	symbol: "NVDA",
	humanName: "NVDA 19 Sep 180 C",
	side: "sell",
	qty: 1,
	type: "limit",
	limit: 7.4,
	reason: "Trim premium into the weekend. Waits for open.",
	createdAt: "2026-08-29T15:51:00-04:00"
}];
var sampleProposals = () => [{
	id: "pr-nvda",
	symbol: "NVDA",
	humanName: "NVDA",
	side: "buy",
	qty: 12,
	price: 178.4,
	why: "Drift Harvest wants a 0.4-vol add while the regime is calm-up. TimesFM 5-day mid is +1.8%.",
	pausedWhy: "Size is 1.1% of book — balanced cap is 1.0%. Gate paused for you.",
	worstCase: 842,
	family: "Drift Harvest",
	createdAt: "2026-08-29T15:47:00-04:00"
}, {
	id: "pr-avgo",
	symbol: "AVGO",
	humanName: "AVGO",
	side: "buy",
	qty: 6,
	price: 181.2,
	why: "Scout Radar score 78. Semiconductor breadth held Friday's bounce.",
	pausedWhy: "New name. Autopilot will not open a first ticket without you.",
	worstCase: 612,
	family: "Scout Radar",
	createdAt: "2026-08-29T15:44:00-04:00"
}];
var sampleLog = () => ({
	sentences: [
		"Weather station called the tape calm-up into the close Friday.",
		"Drift Harvest added 8 SPY at 643.10 after the gate cleared a 0.4% risk.",
		"Scout Radar parked CRWD — critic won the debate on valuation."
	],
	aiNarrated: true,
	ts: "2026-08-29T16:02:00-04:00"
});
var sampleJournal = () => [
	{
		id: "j-sys-1",
		ts: "2026-08-29T16:02:12-04:00",
		kind: "digest",
		title: "Friday close digest",
		body: "Equity $102,480 · +1.2% on the day · odds of arrival 68%. Two tickets queued for Monday's open.",
		aiNarrated: true,
		refs: ["pass-0829-c"],
		raw: {
			equity: 102480,
			todayPct: 1.2,
			odds: .68
		}
	},
	{
		id: "j-ord-2",
		ts: "2026-08-29T15:58:04-04:00",
		kind: "order",
		title: "Queued buy 8 SPY @ 643.50",
		body: "Waits for open. Drift Harvest keel top-up. Risk 0.37% of book.",
		aiNarrated: false,
		refs: ["ord-spy", "Core Trend"],
		raw: {
			symbol: "SPY",
			qty: 8,
			limit: 643.5,
			riskPct: .0037
		}
	},
	{
		id: "j-pr-1",
		ts: "2026-08-29T15:47:21-04:00",
		kind: "proposal",
		title: "Paused: buy 12 NVDA @ 178.40",
		body: "Size is 1.1% of book — balanced cap is 1.0%. Waiting on you.",
		aiNarrated: false,
		refs: ["pr-nvda", "gate"],
		raw: {
			symbol: "NVDA",
			qty: 12,
			riskPct: .011,
			cap: .01
		}
	},
	{
		id: "j-ver-1",
		ts: "2026-08-29T15:46:02-04:00",
		kind: "verdict",
		title: "Gate said no ×3 — TSLA",
		body: "Proposed 18 shares. Risk 2.1% vs 1.0% cap. Advocate argued momentum; judge sided with the cap.",
		aiNarrated: false,
		refs: ["gate", "debate-0829-a"],
		raw: {
			symbol: "TSLA",
			attempts: 3,
			riskPct: .021,
			cap: .01
		}
	},
	{
		id: "j-deb-1",
		ts: "2026-08-29T15:41:18-04:00",
		kind: "debate",
		title: "Council on CRWD",
		body: "Advocate: breadth + relative strength. Critic: valuation after the squeeze, weather floor already tight. Judge: park it. Scout Radar will watch, not chase.",
		aiNarrated: true,
		refs: ["scout-crwd"],
		raw: {
			symbol: "CRWD",
			winner: "critic"
		}
	},
	{
		id: "j-fill-1",
		ts: "2026-08-29T15:12:44-04:00",
		kind: "fill",
		title: "Filled buy 8 SPY @ 643.10",
		body: "Core Trend. Slippage −2¢ vs mid. Risk 0.36% of book.",
		aiNarrated: false,
		refs: ["pos-spy"],
		raw: {
			symbol: "SPY",
			qty: 8,
			price: 643.1
		}
	},
	{
		id: "j-fc-1",
		ts: "2026-08-29T14:05:00-04:00",
		kind: "forecast",
		title: "TimesFM 5-day fan — SPY",
		body: "Mid +0.9%. Band −1.4% / +2.6%. Not a promise — a historical estimate from the last calm-up analog.",
		aiNarrated: true,
		refs: ["timesfm-spy"],
		raw: {
			symbol: "SPY",
			mid: .009,
			lo: -.014,
			hi: .026
		}
	},
	{
		id: "j-scout-1",
		ts: "2026-08-29T11:22:00-04:00",
		kind: "scout",
		title: "Scout Radar: AVGO 78, LLY 71, CRWD 64",
		body: "Three names cleared the weather floor. Only AVGO is queued for a human look.",
		aiNarrated: true,
		refs: ["radar-0829"],
		raw: { symbols: [
			"AVGO",
			"LLY",
			"CRWD"
		] }
	},
	{
		id: "j-appr-1",
		ts: "2026-08-28T10:18:33-04:00",
		kind: "approval",
		title: "You approved AMZN add",
		body: "Buy 12 AMZN @ 197.40. Worst-case at the time −$480. Gate passed on second look after size cut.",
		aiNarrated: false,
		refs: ["pos-amzn"],
		raw: {
			symbol: "AMZN",
			qty: 12,
			price: 197.4
		}
	},
	{
		id: "j-pnl-1",
		ts: "2026-08-28T16:00:02-04:00",
		kind: "pnl",
		title: "Thursday P&L +$640",
		body: "Book +0.63%. NVDA option mark did the work. No new risk overnight.",
		aiNarrated: false,
		refs: ["session-0828"],
		raw: {
			pnl: 640,
			pct: .0063
		}
	},
	{
		id: "j-tr-1",
		ts: "2026-08-28T13:44:09-04:00",
		kind: "trace",
		title: "Pass 14b trace",
		body: "perceive 80ms · guard 12ms · triage 40ms · signals 210ms · gate 8ms · explain 1.4s · record 6ms. All deterministic stages green.",
		aiNarrated: false,
		refs: ["pass-0828-b"],
		raw: {
			pass: "14b",
			timingsMs: [
				80,
				12,
				40,
				210,
				8,
				1400,
				6
			]
		}
	},
	{
		id: "j-exp-1",
		ts: "2026-08-27T09:12:00-04:00",
		kind: "experiment",
		title: "Shipyard failed: Friday-hedge v2",
		body: "OOS Sharpe 0.41 after costs. Weather-floor validation did not hold in 2022 analog. Archived, not deleted.",
		aiNarrated: false,
		refs: ["exp-friday-v2"],
		raw: {
			oosSharpe: .41,
			result: "failed"
		}
	},
	{
		id: "j-sys-0",
		ts: "2026-06-30T09:31:00-04:00",
		kind: "system",
		title: "Voyage started",
		body: "Paper book $100,000. Destination $110,000 in 12 months. Temperament balanced. Guardrails: 1.0% risk / 10% pause.",
		aiNarrated: false,
		refs: ["voyage"],
		raw: {
			startingCapital: 1e5,
			target: 11e4,
			months: 12
		}
	}
];
var firstDayJournal = (cfg) => [{
	id: "j-start",
	ts: cfg.startedAt,
	kind: "system",
	title: "Voyage started",
	body: `Paper book ${cfg.startingCapital.toLocaleString("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0
	})}. Destination ${cfg.goalMode === "amount" ? `${cfg.targetAmount.toLocaleString("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0
	})} in ${cfg.deadlineMonths} months` : `${cfg.monthlyIncome.toLocaleString("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0
	})} / month`}. Temperament ${cfg.temperament}. Nothing has sailed yet.`,
	aiNarrated: false,
	refs: ["voyage"],
	raw: { ...cfg }
}];
var firstDayLog = () => ({
	sentences: ["Fleet is assembled. Nothing has sailed yet.", "We wait for the open. The gate is awake; the book is cash."],
	aiNarrated: false,
	ts: (/* @__PURE__ */ new Date()).toISOString()
});
var sampleStrategies = () => [
	{
		id: "st-core",
		name: "Core Trend",
		sentence: "Ride the calm up-regime in index beta. The keel of the book.",
		risk: "medium",
		status: "sailing",
		family: "trend",
		version: "v4.2",
		params: "lookback 63d · vol target 8% · no shorts"
	},
	{
		id: "st-weather",
		name: "Weather Floor",
		sentence: "Cut risk when the station says stressed. Champion of the last walk-forward.",
		risk: "low",
		status: "champion",
		family: "overlay",
		version: "v2.1",
		params: "stress > 0.62 → half size · hard stop at 10% DD"
	},
	{
		id: "st-drift",
		name: "Drift Harvest",
		sentence: "Small factor tilts, never a concentrated bet.",
		risk: "medium",
		status: "sailing",
		family: "factors",
		version: "v3.0",
		params: "IC floor 0.03 · 8 names · 1% cap"
	},
	{
		id: "st-opt",
		name: "Scout Options",
		sentence: "Sell rich premium only when IV clears our floor.",
		risk: "high",
		status: "docked",
		family: "options",
		version: "v1.6",
		params: "DTE 14–45 · IV rank > 40 · defined risk"
	},
	{
		id: "st-debate",
		name: "Debate Overlay",
		sentence: "Only size up when advocate and critic agree.",
		risk: "low",
		status: "sailing",
		family: "overlay",
		version: "v1.2",
		params: "unanimous to add · 2-of-3 to hold"
	},
	{
		id: "st-night",
		name: "Night Watch",
		sentence: "Hedge the book into the close on Friday. Still in the shipyard.",
		risk: "low",
		status: "coming",
		family: "hedge",
		version: "v0.4",
		params: "Friday 14:30 ET · collars on beta"
	}
];
var sampleInstances = () => [
	{
		id: "in-core",
		strategyId: "st-core",
		family: "trend",
		version: "v4.2",
		status: "running",
		params: "lookback 63d · vol target 8% · no shorts",
		startedAt: "2026-06-30T09:31:00-04:00"
	},
	{
		id: "in-weather",
		strategyId: "st-weather",
		family: "overlay",
		version: "v2.1",
		status: "running",
		params: "stress > 0.62 → half size · hard stop at 10% DD",
		startedAt: "2026-06-30T09:31:00-04:00"
	},
	{
		id: "in-drift",
		strategyId: "st-drift",
		family: "factors",
		version: "v3.0",
		status: "running",
		params: "IC floor 0.03 · 8 names · 1% cap",
		startedAt: "2026-07-14T09:32:00-04:00"
	},
	{
		id: "in-debate",
		strategyId: "st-debate",
		family: "overlay",
		version: "v1.2",
		status: "running",
		params: "unanimous to add · 2-of-3 to hold",
		startedAt: "2026-08-01T09:30:00-04:00"
	}
];
var sampleScouts = () => [
	{
		id: "sc-avgo",
		symbol: "AVGO",
		score: 78,
		why: "Breadth held, relative strength vs SOX, IV not stretched.",
		flavors: ["momentum", "quality"]
	},
	{
		id: "sc-lly",
		symbol: "LLY",
		score: 71,
		why: "Quiet grind, low residual vs XLV, weather-floor friendly.",
		flavors: ["low-vol", "quality"]
	},
	{
		id: "sc-crwd",
		symbol: "CRWD",
		score: 64,
		why: "Passed radar, lost the debate on valuation. Watching, not chasing.",
		flavors: ["momentum"]
	},
	{
		id: "sc-cost",
		symbol: "COST",
		score: 61,
		why: "Defensive drift in a calm-up tape. Slow, not exciting.",
		flavors: ["quality", "low-vol"]
	},
	{
		id: "sc-jpm",
		symbol: "JPM",
		score: 58,
		why: "Yield curve analog is friendly. Size would be tiny.",
		flavors: ["value"]
	}
];
var sampleOptionWatch = () => [
	{
		id: "ow-1",
		humanName: "NVDA 19 Sep 180 C",
		yield: .084,
		dte: 20,
		iv: .41,
		note: "Already on the book. Trim queued."
	},
	{
		id: "ow-2",
		humanName: "SPY 18 Sep 650 C",
		yield: .031,
		dte: 19,
		iv: .14,
		note: "Too cheap. Gate would say no on edge."
	},
	{
		id: "ow-3",
		humanName: "AAPL 19 Sep 245 C",
		yield: .052,
		dte: 20,
		iv: .22,
		note: "Borderline. Weather floor says wait."
	}
];
var samplePromotions = () => [
	{
		id: "pm-1",
		name: "Drift-aware momentum v3",
		family: "factors",
		oosSharpe: 1.42,
		maxDd: .071,
		winRate: .54,
		note: "Holds up in calm-up. Weak in 2022 analog — weather floor required.",
		status: "challenger"
	},
	{
		id: "pm-2",
		name: "Mean-rev weather-floor",
		family: "overlay",
		oosSharpe: 1.18,
		maxDd: .054,
		winRate: .57,
		note: "Validation study passed. Candidate to replace Night Watch slot.",
		status: "challenger"
	},
	{
		id: "pm-3",
		name: "Single-name gap fade",
		family: "tactical",
		oosSharpe: .62,
		maxDd: .121,
		winRate: .49,
		note: "Costs eat it. Archive unless we get a better borrow.",
		status: "challenger"
	}
];
var sampleExperiments = () => [
	{
		id: "ex-1",
		name: "Weather Floor v2.1",
		family: "overlay",
		result: "promoted",
		oosSharpe: 1.67,
		note: "Champion. Live since June.",
		ts: "2026-06-28T12:00:00-04:00"
	},
	{
		id: "ex-2",
		name: "Drift Harvest v3.0",
		family: "factors",
		result: "promoted",
		oosSharpe: 1.31,
		note: "Replaced v2.4 after IC decay.",
		ts: "2026-07-12T12:00:00-04:00"
	},
	{
		id: "ex-3",
		name: "Friday-hedge v2",
		family: "hedge",
		result: "failed",
		oosSharpe: .41,
		note: "Did not hold in 2022 analog.",
		ts: "2026-08-27T09:12:00-04:00"
	},
	{
		id: "ex-4",
		name: "Gap fade v1",
		family: "tactical",
		result: "failed",
		oosSharpe: .22,
		note: "Spread tax. Archived.",
		ts: "2026-08-04T16:40:00-04:00"
	},
	{
		id: "ex-5",
		name: "Night Watch v0.4",
		family: "hedge",
		result: "running",
		oosSharpe: .88,
		note: "Shipyard. Not live.",
		ts: "2026-08-20T11:00:00-04:00"
	},
	{
		id: "ex-6",
		name: "Debate Overlay v1.2",
		family: "overlay",
		result: "promoted",
		oosSharpe: 1.05,
		note: "Low turnover, high trust.",
		ts: "2026-07-30T10:00:00-04:00"
	}
];
var sampleFactors = () => [
	{
		id: "fa-1",
		name: "12-1 momentum",
		ic: .046,
		deflatedIc: .031,
		horizon: "21d",
		decay: "fresh",
		admitted: true
	},
	{
		id: "fa-2",
		name: "5d reversal",
		ic: -.022,
		deflatedIc: -.009,
		horizon: "5d",
		decay: "aging",
		admitted: true
	},
	{
		id: "fa-3",
		name: "Earnings surprise",
		ic: .061,
		deflatedIc: .038,
		horizon: "10d",
		decay: "fresh",
		admitted: true
	},
	{
		id: "fa-4",
		name: "IV residual",
		ic: .028,
		deflatedIc: .011,
		horizon: "10d",
		decay: "aging",
		admitted: true
	},
	{
		id: "fa-5",
		name: "Breadth thrust",
		ic: .019,
		deflatedIc: .004,
		horizon: "5d",
		decay: "decayed",
		admitted: false
	},
	{
		id: "fa-6",
		name: "Quality minus junk",
		ic: .033,
		deflatedIc: .021,
		horizon: "63d",
		decay: "fresh",
		admitted: true
	},
	{
		id: "fa-7",
		name: "Skip-week seasonality",
		ic: .072,
		deflatedIc: .014,
		horizon: "5d",
		decay: "fresh",
		admitted: false,
		pending: true
	}
];
var sampleAdvice = () => ({
	id: "adv-1",
	title: "Stay with calm-up sizing",
	body: "Regime is up × calm. Walk-forward says Core Trend and Drift Harvest both keep their edge here. Do not add the Friday hedge until Night Watch graduates.",
	adopted: null
});
var sampleWatchlist = () => [
	{
		symbol: "SPY",
		last: 644.2,
		change: .007,
		group: "holdings"
	},
	{
		symbol: "NVDA",
		last: 178.4,
		change: .018,
		group: "holdings"
	},
	{
		symbol: "AAPL",
		last: 241.1,
		change: .006,
		group: "holdings"
	},
	{
		symbol: "MSFT",
		last: 428.6,
		change: .004,
		group: "holdings"
	},
	{
		symbol: "AVGO",
		last: 181.2,
		change: .012,
		group: "scout"
	},
	{
		symbol: "LLY",
		last: 794.5,
		change: .003,
		group: "scout"
	},
	{
		symbol: "CRWD",
		last: 412.8,
		change: -.011,
		group: "scout"
	},
	{
		symbol: "QQQ",
		last: 512.8,
		change: .008,
		group: "core"
	},
	{
		symbol: "IWM",
		last: 228.4,
		change: -.002,
		group: "core"
	},
	{
		symbol: "TLT",
		last: 91.6,
		change: -.004,
		group: "core"
	}
];
function mulberry32(a) {
	return function() {
		a |= 0;
		a = a + 1831565813 | 0;
		let t = Math.imul(a ^ a >>> 15, 1 | a);
		t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
		return ((t ^ t >>> 14) >>> 0) / 4294967296;
	};
}
function buildCandles(symbol, last, n = 42) {
	const rand = mulberry32(symbol.split("").reduce((s, c) => s + c.charCodeAt(0), 0) * 997 + Math.round(last * 10));
	const out = [];
	let p = last * .93;
	const start = /* @__PURE__ */ new Date("2026-07-01T16:00:00-04:00");
	let day = 0;
	while (out.length < n) {
		const d = new Date(start);
		d.setDate(start.getDate() + day);
		day += 1;
		const wd = d.getDay();
		if (wd === 0 || wd === 6) continue;
		const drift = (last - p) / (n - out.length + 1);
		const shock = (rand() - .48) * last * .012;
		const o = p;
		const c = Math.max(.5, o + drift + shock);
		const h = Math.max(o, c) + rand() * last * .006;
		const l = Math.min(o, c) - rand() * last * .006;
		out.push({
			t: d.toISOString(),
			o: round2(o),
			h: round2(h),
			l: round2(l),
			c: round2(c)
		});
		p = c;
	}
	out[out.length - 1].c = last;
	out[out.length - 1].h = Math.max(out[out.length - 1].h, last);
	out[out.length - 1].l = Math.min(out[out.length - 1].l, last);
	if (symbol === "SPY") {
		out[out.length - 3].fill = "buy";
		out[out.length - 8].fill = "buy";
	}
	return out;
}
function buildForecast(last) {
	const out = [];
	const start = /* @__PURE__ */ new Date("2026-08-31T16:00:00-04:00");
	let mid = last;
	for (let i = 0; i < 5; i++) {
		const d = new Date(start);
		d.setDate(start.getDate() + i);
		mid = mid * 1.0018;
		const w = last * (.006 + i * .004);
		out.push({
			t: d.toISOString(),
			mid: round2(mid),
			lo: round2(mid - w),
			hi: round2(mid + w * 1.15)
		});
	}
	return out;
}
var sampleSpark = [
	1e5,
	100240,
	99880,
	100410,
	100905,
	101120,
	100760,
	101340,
	101580,
	101210,
	101770,
	102040,
	101890,
	102260,
	102480
];
var REGIME = {
	direction: "up",
	weather: "calm",
	streak: 6,
	volPct: 11.4,
	breadth: .62,
	weatherScore: 74
};
function round2(n) {
	return Math.round(n * 100) / 100;
}
var PASS_SCRIPTS = [
	{
		sentences: [
			"Pass ran against a closed tape. Gate stayed conservative.",
			"TimesFM still likes SPY over the next five sessions, mid +0.9%.",
			"No new risk. Two tickets remain queued until the open."
		],
		aiNarrated: true,
		events: [{
			kind: "trace",
			title: "Pass complete — market closed",
			body: "perceive → guard → triage → signals → gate. Gate: no live orders. Forecast refreshed. Recorded."
		}, {
			kind: "forecast",
			title: "TimesFM fan refreshed — SPY",
			body: "Mid still +0.9%. Band a touch tighter than Friday. Historical estimate, not a promise."
		}],
		proposal: null
	},
	{
		sentences: [
			"Scout Radar re-scored LLY at 73. Advocate wanted a starter.",
			"Gate said no — new name, closed tape, 1.2% proposed vs 1.0% cap.",
			"I wrote it down. Nothing sailed."
		],
		aiNarrated: true,
		events: [{
			kind: "verdict",
			title: "Gate said no — LLY starter",
			body: "Proposed 4 shares. New name + closed session + 1.2% risk. Cap is 1.0%. Parked on Radar."
		}, {
			kind: "scout",
			title: "LLY score 73",
			body: "Quiet grind, low residual vs XLV. Watching, not chasing."
		}],
		proposal: null
	},
	{
		sentences: [
			"Debate council split on AVGO size, then agreed to keep the pause.",
			"Worst-case on the open ticket is still −$612.",
			"Your approval is the only thing that moves it."
		],
		aiNarrated: true,
		events: [{
			kind: "debate",
			title: "Council on AVGO size",
			body: "Advocate: 6 shares. Critic: 3, or none until the open prints. Judge: leave the human card as-is."
		}],
		proposal: null
	}
];
//#endregion
export { sampleVoyage as C, sampleStrategies as S, samplePositions as _, firstDayJournal as a, sampleScouts as b, sampleAdvice as c, sampleFactors as d, sampleInstances as f, sampleOrders as g, sampleOptionWatch as h, buildForecast as i, sampleCash as l, sampleLog as m, REGIME as n, firstDayLog as o, sampleJournal as p, buildCandles as r, freshVoyage as s, PASS_SCRIPTS as t, sampleExperiments as u, samplePromotions as v, sampleWatchlist as w, sampleSpark as x, sampleProposals as y };
