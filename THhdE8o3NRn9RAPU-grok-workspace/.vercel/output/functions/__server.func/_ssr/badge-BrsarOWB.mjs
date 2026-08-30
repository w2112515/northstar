import { i as __toESM } from "../_runtime.mjs";
import { t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { C as sampleVoyage, S as sampleStrategies, _ as samplePositions, a as firstDayJournal, c as sampleAdvice, d as sampleFactors, f as sampleInstances, g as sampleOrders, l as sampleCash, m as sampleLog, o as firstDayLog, p as sampleJournal, s as freshVoyage, t as PASS_SCRIPTS, u as sampleExperiments, v as samplePromotions, y as sampleProposals } from "./seed-D7NXUXBT.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { O as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { n as create, t as persist } from "../_libs/zustand.mjs";
import { a as cn } from "./router-Byr47Ah9.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/badge-BrsarOWB.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function NorthStarMark({ className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
		viewBox: "0 0 24 24",
		className: cn("size-5", className),
		"aria-hidden": true,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
			d: "M12 1.4 L13.35 9.4 L21.6 12 L13.35 14.6 L12 22.6 L10.65 14.6 L2.4 12 L10.65 9.4 Z",
			fill: "currentColor"
		})
	});
}
function PaperBadge({ className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		title: "Practice money. No account is real.",
		className: cn("inline-flex items-center rounded-full bg-amber-dim px-2 py-0.5 text-micro font-semibold tracking-[0.14em] text-amber uppercase", className),
		children: "PAPER"
	});
}
var nyDate = new Intl.DateTimeFormat("en-US", {
	timeZone: "America/New_York",
	month: "short",
	day: "numeric",
	year: "numeric"
});
var nyTime = new Intl.DateTimeFormat("en-US", {
	timeZone: "America/New_York",
	hour: "numeric",
	minute: "2-digit",
	hour12: true
});
var nyClock = new Intl.DateTimeFormat("en-US", {
	timeZone: "America/New_York",
	hour: "numeric",
	minute: "2-digit",
	second: "2-digit",
	hour12: true
});
new Intl.DateTimeFormat("en-US", {
	timeZone: "America/New_York",
	weekday: "short"
});
var nyParts = new Intl.DateTimeFormat("en-US", {
	timeZone: "America/New_York",
	weekday: "short",
	hour: "numeric",
	minute: "numeric",
	hourCycle: "h23"
});
function money(n, opts) {
	const digits = opts?.digits ?? (Math.abs(n) >= 1e3 ? 0 : 2);
	const abs = Math.abs(n).toLocaleString("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: digits,
		maximumFractionDigits: digits
	});
	if (opts?.sign) {
		if (n > 0) return `+${abs}`;
		if (n < 0) return `−${abs}`;
		return abs;
	}
	return n < 0 ? `−${abs}` : abs;
}
function compactMoney(n) {
	const abs = Math.abs(n);
	const sign = n < 0 ? "−" : "";
	if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(2)}M`;
	if (abs >= 1e4) return `${sign}$${Math.round(abs).toLocaleString("en-US")}`;
	return money(n);
}
function pct(n, digits = 1) {
	const body = `${Math.abs(n).toFixed(digits)}%`;
	if (n > 0) return `+${body}`;
	if (n < 0) return `−${body}`;
	return body;
}
function formatNyTime(iso) {
	return nyTime.format(typeof iso === "string" ? new Date(iso) : iso);
}
function formatNyClock(d = /* @__PURE__ */ new Date()) {
	return `${nyClock.format(d)} ET`;
}
function isNySessionOpen(d = /* @__PURE__ */ new Date()) {
	const parts = nyParts.formatToParts(d);
	const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
	const weekday = get("weekday");
	if (weekday === "Sat" || weekday === "Sun") return false;
	const hour = Number(get("hour"));
	const minute = Number(get("minute"));
	const mins = hour * 60 + minute;
	return mins >= 570 && mins < 960;
}
function nySessionLabel(open) {
	return open ? "Open" : "Closed";
}
function uid(prefix = "id") {
	return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
}
function dayKey(iso) {
	const d = new Date(iso);
	return new Intl.DateTimeFormat("en-CA", {
		timeZone: "America/New_York",
		year: "numeric",
		month: "2-digit",
		day: "2-digit"
	}).format(d);
}
function dayHeading(iso) {
	const d = new Date(iso);
	const today = dayKey((/* @__PURE__ */ new Date()).toISOString());
	const key = dayKey(iso);
	const yest = /* @__PURE__ */ new Date();
	yest.setDate(yest.getDate() - 1);
	if (key === today) return "Today";
	if (key === dayKey(yest.toISOString())) return "Yesterday";
	return nyDate.format(d);
}
function clamp(n, a, b) {
	return Math.min(b, Math.max(a, n));
}
var STEPS = [
	"perceive",
	"guard",
	"triage",
	"signals",
	"gate",
	"explain",
	"record"
];
var passTimer = null;
function pushJournal(journal, partial) {
	return [{
		id: uid("j"),
		ts: partial.ts ?? (/* @__PURE__ */ new Date()).toISOString(),
		kind: partial.kind,
		title: partial.title,
		body: partial.body,
		aiNarrated: partial.aiNarrated,
		refs: partial.refs,
		raw: partial.raw
	}, ...journal];
}
function positionValue(p) {
	return p.qty * p.last * p.multiplier;
}
function positionPnl(p) {
	return (p.last - p.avgCost) * p.qty * p.multiplier;
}
function bookEquity(cash, positions) {
	return cash + positions.reduce((s, p) => s + positionValue(p), 0);
}
function sampleState() {
	return {
		voyage: sampleVoyage(),
		cash: sampleCash,
		todayPct: 1.2,
		oddsOverride: .68,
		positions: samplePositions(),
		orders: sampleOrders(),
		proposals: sampleProposals(),
		journal: sampleJournal(),
		strategies: sampleStrategies(),
		instances: sampleInstances(),
		promotions: samplePromotions(),
		experiments: sampleExperiments(),
		factors: sampleFactors(),
		advice: sampleAdvice(),
		log: sampleLog(),
		autopilot: false,
		killSwitch: false,
		circuitBreaker: "none",
		marketOverride: "auto",
		passRunning: false,
		passStep: "idle",
		passIndex: 0,
		loadingDemo: false
	};
}
var useVoyage = create()(persist((set, get) => ({
	hasHydrated: true,
	...sampleState(),
	setHasHydrated: (v) => set({ hasHydrated: v }),
	completeOnboarding: (cfg) => set({
		...sampleState(),
		voyage: {
			...cfg,
			onboarded: true,
			firstDay: true
		},
		cash: cfg.startingCapital,
		todayPct: 0,
		oddsOverride: null,
		positions: [],
		orders: [],
		proposals: [],
		journal: firstDayJournal(cfg),
		instances: [],
		log: firstDayLog(),
		promotions: samplePromotions(),
		strategies: sampleStrategies().map((s) => s.status === "coming" ? s : {
			...s,
			status: s.id === "st-weather" ? "champion" : s.status === "champion" ? "sailing" : s.status
		})
	}),
	loadSample: () => set({ ...sampleState() }),
	loadFirstDay: () => {
		const cfg = freshVoyage({});
		get().completeOnboarding(cfg);
	},
	setAutopilot: (v) => {
		const { killSwitch, circuitBreaker } = get();
		if (v && (killSwitch || circuitBreaker === "hard")) return;
		set({ autopilot: v });
		if (v) {
			get().journal;
			set((s) => ({ journal: pushJournal(s.journal, {
				kind: "system",
				title: "Autopilot on",
				body: "Passes will run on their own. Anything the gate pauses still waits on you.",
				aiNarrated: false,
				refs: ["helm"],
				raw: { autopilot: true }
			}) }));
		}
	},
	setKillSwitch: (v) => {
		set({
			killSwitch: v,
			autopilot: v ? false : get().autopilot,
			circuitBreaker: v ? "hard" : get().circuitBreaker === "hard" ? "none" : get().circuitBreaker
		});
		set((s) => ({ journal: pushJournal(s.journal, {
			kind: "system",
			title: v ? "Kill switch on" : "Kill switch cleared",
			body: v ? "Fleet docked. No new risk. Existing marks still live. Human must restart." : "Fleet may sail again. Gate is awake.",
			aiNarrated: false,
			refs: ["helm"],
			raw: { killSwitch: v }
		}) }));
	},
	setCircuitBreaker: (v) => set({
		circuitBreaker: v,
		autopilot: v === "hard" ? false : get().autopilot
	}),
	setMarketOverride: (v) => set({ marketOverride: v }),
	runPass: () => {
		const s = get();
		if (s.passRunning) return;
		if (s.killSwitch || s.circuitBreaker === "hard") return;
		if (passTimer) clearTimeout(passTimer);
		set({
			passRunning: true,
			passStep: "perceive"
		});
		let i = 0;
		const tick = () => {
			i += 1;
			if (i >= STEPS.length) {
				get().finishPass();
				return;
			}
			set({ passStep: STEPS[i] });
			passTimer = setTimeout(tick, 420);
		};
		passTimer = setTimeout(tick, 420);
	},
	advancePass: (step) => set({ passStep: step }),
	finishPass: () => {
		const s = get();
		const script = PASS_SCRIPTS[s.passIndex % PASS_SCRIPTS.length];
		let journal = s.journal;
		for (const ev of script.events) journal = pushJournal(journal, {
			kind: ev.kind,
			title: ev.title,
			body: ev.body,
			aiNarrated: true,
			refs: ["pass"],
			raw: { passIndex: s.passIndex }
		});
		journal = pushJournal(journal, {
			kind: "trace",
			title: `Pass ${s.passIndex + 1} recorded`,
			body: "perceive → guard → triage → signals → gate → explain → record. All deterministic stages green.",
			aiNarrated: false,
			refs: ["pass"],
			raw: { passIndex: s.passIndex }
		});
		set({
			passRunning: false,
			passStep: "idle",
			passIndex: s.passIndex + 1,
			journal,
			log: {
				sentences: script.sentences,
				aiNarrated: script.aiNarrated,
				ts: (/* @__PURE__ */ new Date()).toISOString()
			}
		});
	},
	approveProposal: (id) => {
		const s = get();
		const pr = s.proposals.find((p) => p.id === id);
		if (!pr) return;
		const existing = s.positions.find((p) => p.humanName === pr.humanName);
		let positions = s.positions;
		let cash = s.cash;
		const notional = pr.qty * pr.price;
		if (pr.side === "buy") {
			cash -= notional;
			if (existing) {
				const totalQty = existing.qty + pr.qty;
				const avg = (existing.avgCost * existing.qty + pr.price * pr.qty) / totalQty;
				positions = positions.map((p) => p.id === existing.id ? {
					...p,
					qty: totalQty,
					avgCost: avg,
					last: pr.price
				} : p);
			} else positions = [...positions, {
				id: uid("pos"),
				symbol: pr.symbol,
				humanName: pr.humanName,
				qty: pr.qty,
				multiplier: 1,
				avgCost: pr.price,
				last: pr.price,
				side: "long",
				openedAt: (/* @__PURE__ */ new Date()).toISOString(),
				family: pr.family
			}];
		} else if (existing) {
			const qty = Math.min(existing.qty, pr.qty);
			cash += qty * pr.price;
			if (existing.qty <= qty) positions = positions.filter((p) => p.id !== existing.id);
			else positions = positions.map((p) => p.id === existing.id ? {
				...p,
				qty: p.qty - qty
			} : p);
		}
		const orders = [{
			id: uid("ord"),
			symbol: pr.symbol,
			humanName: pr.humanName,
			side: pr.side,
			qty: pr.qty,
			type: "limit",
			limit: pr.price,
			reason: "Approved. Queued until the open.",
			createdAt: (/* @__PURE__ */ new Date()).toISOString()
		}, ...s.orders];
		set({
			proposals: s.proposals.filter((p) => p.id !== id),
			positions,
			cash,
			orders,
			journal: pushJournal(s.journal, {
				kind: "approval",
				title: `You approved ${pr.side} ${pr.qty} ${pr.humanName}`,
				body: `Limit ${pr.price.toFixed(2)}. Worst-case ${pr.worstCase}. Queued until the open.`,
				aiNarrated: false,
				refs: [pr.id],
				raw: { ...pr }
			})
		});
	},
	skipProposal: (id) => {
		const s = get();
		const pr = s.proposals.find((p) => p.id === id);
		if (!pr) return;
		set({
			proposals: s.proposals.filter((p) => p.id !== id),
			journal: pushJournal(s.journal, {
				kind: "approval",
				title: `You skipped ${pr.humanName}`,
				body: "No order. The radar will keep the name if the score holds.",
				aiNarrated: false,
				refs: [pr.id],
				raw: {
					skipped: true,
					symbol: pr.symbol
				}
			})
		});
	},
	closePosition: (id) => {
		const s = get();
		const pos = s.positions.find((p) => p.id === id);
		if (!pos) return;
		const value = positionValue(pos);
		const pnl = positionPnl(pos);
		set({
			positions: s.positions.filter((p) => p.id !== id),
			cash: s.cash + value,
			orders: [{
				id: uid("ord"),
				symbol: pos.symbol,
				humanName: pos.humanName,
				side: "sell",
				qty: pos.qty,
				type: "market",
				reason: "Close requested. Queued until the open.",
				createdAt: (/* @__PURE__ */ new Date()).toISOString()
			}, ...s.orders],
			journal: pushJournal(s.journal, {
				kind: "order",
				title: `Close ${pos.humanName} queued`,
				body: `Market sell ${pos.qty}. Mark-to-market ${pnl >= 0 ? "+" : "−"}$${Math.abs(Math.round(pnl)).toLocaleString("en-US")}. Waits for open.`,
				aiNarrated: false,
				refs: [pos.id],
				raw: {
					id,
					pnl,
					value
				}
			})
		});
	},
	cancelOrder: (id) => set((s) => ({
		orders: s.orders.filter((o) => o.id !== id),
		journal: pushJournal(s.journal, {
			kind: "order",
			title: "Order cancelled",
			body: "Pulled before the open.",
			aiNarrated: false,
			refs: [id],
			raw: { cancelled: id }
		})
	})),
	toggleStrategy: (id) => set((s) => {
		const st = s.strategies.find((x) => x.id === id);
		if (!st || st.status === "coming") return s;
		const next = st.status === "docked" ? "sailing" : st.status === "sailing" ? "docked" : st.status;
		if (next === st.status) return s;
		const strategies = s.strategies.map((x) => x.id === id ? {
			...x,
			status: next
		} : x);
		let instances = s.instances;
		if (next === "sailing") {
			if (!instances.some((i) => i.strategyId === id)) instances = [...instances, {
				id: uid("in"),
				strategyId: id,
				family: st.family,
				version: st.version,
				status: "running",
				params: st.params,
				startedAt: (/* @__PURE__ */ new Date()).toISOString()
			}];
			else instances = instances.map((i) => i.strategyId === id ? {
				...i,
				status: "running"
			} : i);
		} else if (next === "docked") instances = instances.map((i) => i.strategyId === id ? {
			...i,
			status: "docked"
		} : i);
		return {
			strategies,
			instances,
			journal: pushJournal(s.journal, {
				kind: "system",
				title: next === "sailing" ? `Set sail: ${st.name}` : `Docked: ${st.name}`,
				body: st.sentence,
				aiNarrated: false,
				refs: [id],
				raw: { status: next }
			})
		};
	}),
	promote: (id) => set((s) => {
		const p = s.promotions.find((x) => x.id === id);
		if (!p) return s;
		return {
			promotions: s.promotions.map((x) => x.id === id ? {
				...x,
				status: "archived"
			} : x),
			experiments: [{
				id: uid("ex"),
				name: p.name,
				family: p.family,
				result: "promoted",
				oosSharpe: p.oosSharpe,
				note: "Promoted from the challenger dock.",
				ts: (/* @__PURE__ */ new Date()).toISOString()
			}, ...s.experiments],
			journal: pushJournal(s.journal, {
				kind: "experiment",
				title: `Promoted ${p.name}`,
				body: `OOS Sharpe ${p.oosSharpe.toFixed(2)} · max DD ${(p.maxDd * 100).toFixed(1)}%. Champion badge pending the next walk-forward.`,
				aiNarrated: false,
				refs: [id],
				raw: { ...p }
			})
		};
	}),
	archivePromo: (id) => set((s) => ({
		promotions: s.promotions.map((x) => x.id === id ? {
			...x,
			status: "archived"
		} : x),
		journal: pushJournal(s.journal, {
			kind: "experiment",
			title: "Challenger archived",
			body: "Not deleted. Lineage keeps the failure.",
			aiNarrated: false,
			refs: [id],
			raw: { archived: id }
		})
	})),
	adoptAdvice: () => set((s) => ({
		advice: {
			...s.advice,
			adopted: true
		},
		journal: pushJournal(s.journal, {
			kind: "system",
			title: "Helm advice adopted",
			body: s.advice.body,
			aiNarrated: true,
			refs: [s.advice.id],
			raw: { adopted: true }
		})
	})),
	dismissAdvice: () => set((s) => ({
		advice: {
			...s.advice,
			adopted: false
		},
		journal: pushJournal(s.journal, {
			kind: "system",
			title: "Helm advice dismissed",
			body: "Noted. The compass will not nag this analog again.",
			aiNarrated: false,
			refs: [s.advice.id],
			raw: { adopted: false }
		})
	})),
	admitFactor: (id) => set((s) => ({
		factors: s.factors.map((f) => f.id === id ? {
			...f,
			admitted: true,
			pending: false
		} : f),
		journal: pushJournal(s.journal, {
			kind: "experiment",
			title: "Factor admitted",
			body: "Deflated IC cleared the floor. On the library, decay watch starts now.",
			aiNarrated: false,
			refs: [id],
			raw: { admitted: id }
		})
	})),
	dismissFactor: (id) => set((s) => ({ factors: s.factors.map((f) => f.id === id ? {
		...f,
		pending: false,
		admitted: false
	} : f) })),
	setLoadingDemo: (v) => set({ loadingDemo: v })
}), {
	name: "northstar-v1",
	skipHydration: true,
	partialize: (s) => {
		const { hasHydrated, passRunning, passStep, loadingDemo, ...rest } = s;
		return rest;
	},
	onRehydrateStorage: () => (state) => {
		state?.setHasHydrated(true);
	}
}));
var BEST_HISTORICAL_YEAR = .34;
var GUARDRAILS = {
	conservative: {
		maxRisk: .005,
		drawdownPause: .06,
		maxOptions: 0,
		label: "Conservative"
	},
	balanced: {
		maxRisk: .01,
		drawdownPause: .1,
		maxOptions: .15,
		label: "Balanced"
	},
	aggressive: {
		maxRisk: .02,
		drawdownPause: .16,
		maxOptions: .3,
		label: "Aggressive"
	}
};
var EXPECTED = {
	conservative: .07,
	balanced: .11,
	aggressive: .15
};
var VOL = {
	conservative: .08,
	balanced: .13,
	aggressive: .2
};
function erf(x) {
	const s = x < 0 ? -1 : 1;
	const a = Math.abs(x);
	const t = 1 / (1 + .3275911 * a);
	return s * (1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - .284496736) * t + .254829592) * t * Math.exp(-a * a));
}
function normalCdf(z) {
	return .5 * (1 + erf(z / Math.SQRT2));
}
function requiredAnnualized(start, target, months) {
	if (start <= 0 || months <= 0 || target <= 0) return 0;
	return Math.pow(target / start, 12 / months) - 1;
}
function arrivalOdds(start, target, months, temperament) {
	const T = Math.max(months, 1) / 12;
	const expected = EXPECTED[temperament];
	const vol = VOL[temperament];
	const meanLog = (Math.log(1 + expected) - .5 * vol * vol) * T;
	const sdLog = vol * Math.sqrt(T);
	if (sdLog <= 0) return target <= start ? .99 : .01;
	return clamp(1 - normalCdf((Math.log(target / start) - meanLog) / sdLog), .02, .97);
}
function terminalQuantile(start, months, temperament, q) {
	const T = Math.max(months, 1) / 12;
	const expected = EXPECTED[temperament];
	const vol = VOL[temperament];
	const meanLog = (Math.log(1 + expected) - .5 * vol * vol) * T;
	const sdLog = vol * Math.sqrt(T);
	const z = invNorm(q);
	return start * Math.exp(meanLog + sdLog * z);
}
function invNorm(p) {
	const a = [
		-39.69683028665376,
		220.9460984245205,
		-275.9285104469687,
		138.3577509590705,
		-30.66479806614716,
		2.506628277459239
	];
	const b = [
		-54.47609879822406,
		161.5858368580409,
		-155.6989798598866,
		66.80131188771972,
		-13.28068071618818
	];
	const c = [
		-.007784894002430293,
		-.3223964580411365,
		-2.400758277161838,
		-2.549732539343734,
		4.374664141464968,
		2.938163982698783
	];
	const d = [
		.007784695709041462,
		.3224671290700398,
		2.445134137142996,
		3.754408661907416
	];
	const plow = .02425;
	const phigh = .97575;
	if (p < plow) {
		const q = Math.sqrt(-2 * Math.log(p));
		return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
	}
	if (p > phigh) {
		const q = Math.sqrt(-2 * Math.log(1 - p));
		return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
	}
	const q = p - .5;
	const r = q * q;
	return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}
function monteCarloBand(start, months, temperament) {
	const out = [{
		month: 0,
		p10: start,
		p50: start,
		p90: start
	}];
	for (let m = 1; m <= months; m++) out.push({
		month: m,
		p10: terminalQuantile(start, m, temperament, .1),
		p50: terminalQuantile(start, m, temperament, .5),
		p90: terminalQuantile(start, m, temperament, .9)
	});
	return out;
}
function feasibilityVerdict(odds, required) {
	if (required > .34) return "unrealistic";
	if (odds >= .6) return "reachable";
	if (odds >= .35) return "possible";
	return "thin";
}
function verdictCopy(v) {
	switch (v) {
		case "reachable": return "Reachable in this weather";
		case "possible": return "Possible, not comfortable";
		case "thin": return "Thin odds with this fleet";
		case "unrealistic": return "Unrealistic with this fleet";
	}
}
function redPathOptions(start, target, months) {
	const required = requiredAnnualized(start, target, months);
	const extendYears = 3;
	const extendMonths = 36;
	const extendRequired = requiredAnnualized(start, target, extendMonths);
	const lowerTarget = Math.round(start * 1.2);
	return {
		required,
		best: BEST_HISTORICAL_YEAR,
		extendYears,
		extendMonths,
		extendRequired,
		lowerTarget,
		lowerRequired: requiredAnnualized(start, lowerTarget, months)
	};
}
function allocationFor(temperament) {
	if (temperament === "conservative") return [
		{
			name: "Core Trend",
			pct: 40,
			reason: "Index beta is the keel; we don't fight the regime."
		},
		{
			name: "Weather Floor",
			pct: 25,
			reason: "Cuts sail when the station says stressed."
		},
		{
			name: "Drift Harvest",
			pct: 15,
			reason: "Small factor tilts. Costs matter more than alpha here."
		},
		{
			name: "Cash buffer",
			pct: 20,
			reason: "Dry powder. The gate likes room."
		}
	];
	if (temperament === "aggressive") return [
		{
			name: "Core Trend",
			pct: 35,
			reason: "Still the keel — aggression lives in size, not in abandoning beta."
		},
		{
			name: "Drift Harvest",
			pct: 25,
			reason: "Wider factor book, still capped per name."
		},
		{
			name: "Scout Options",
			pct: 20,
			reason: "Premium only when IV clears the weather floor."
		},
		{
			name: "Weather Floor",
			pct: 10,
			reason: "Keeps the hard stop honest."
		},
		{
			name: "Cash buffer",
			pct: 10,
			reason: "Thinner reserve, still enough to open the gate."
		}
	];
	return [
		{
			name: "Core Trend",
			pct: 45,
			reason: "Index beta is the keel; we don't fight the regime."
		},
		{
			name: "Drift Harvest",
			pct: 25,
			reason: "Small factor tilts, never a concentrated bet."
		},
		{
			name: "Weather Floor",
			pct: 20,
			reason: "Cuts sail when the station says stressed."
		},
		{
			name: "Cash buffer",
			pct: 10,
			reason: "Dry powder for the gate."
		}
	];
}
function scoreTemperament(answers) {
	const counts = {
		conservative: 0,
		balanced: 0,
		aggressive: 0
	};
	for (const a of answers) if (a) counts[a] += 1;
	if (counts.conservative >= 2) return "conservative";
	if (counts.aggressive >= 2) return "aggressive";
	return "balanced";
}
var buttonVariants = cva("inline-flex items-center justify-center gap-2 font-medium select-none whitespace-nowrap rounded-md text-sm transition-[color,background-color,box-shadow,transform,opacity] duration-150 ease-out active:not-disabled:scale-[0.96] disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-void),0_0_0_4px_var(--color-signal)]", {
	variants: {
		variant: {
			gold: "bg-gold text-void hover:bg-gold/90 shadow-tone-gold",
			teal: "bg-teal text-void hover:bg-teal/90",
			coral: "bg-coral text-void hover:bg-coral/90",
			amber: "bg-amber text-void hover:bg-amber/90",
			signal: "bg-signal text-ink hover:bg-signal/90",
			ghost: "bg-transparent text-ink hover:bg-panel shadow-border",
			quiet: "bg-panel text-ink hover:bg-panel/80 shadow-border",
			danger: "bg-coral-dim text-coral hover:bg-coral/20 shadow-tone-coral"
		},
		size: {
			sm: "h-9 px-3 text-xs rounded-sm",
			md: "h-10 px-3.5",
			lg: "h-11 px-5 rounded-lg",
			icon: "size-10 rounded-md",
			"icon-sm": "size-8 rounded-sm"
		}
	},
	defaultVariants: {
		variant: "quiet",
		size: "md"
	}
});
var Button = (0, import_react.forwardRef)(({ className, variant, size, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
	ref,
	className: cn(buttonVariants({
		variant,
		size
	}), className),
	...props
}));
Button.displayName = "Button";
function Label({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
		className: cn("kicker", className),
		...props
	});
}
function HydrateStore() {
	(0, import_react.useEffect)(() => {
		const done = () => useVoyage.getState().setHasHydrated(true);
		const unsub = useVoyage.persist.onFinishHydration(done);
		useVoyage.persist.rehydrate();
		if (useVoyage.persist.hasHydrated()) done();
		const fallback = setTimeout(done, 1200);
		return () => {
			unsub();
			clearTimeout(fallback);
		};
	}, []);
	return null;
}
var tones = {
	mist: "text-mist bg-panel",
	gold: "text-gold bg-gold-dim",
	teal: "text-teal bg-teal-dim",
	coral: "text-coral bg-coral-dim",
	amber: "text-amber bg-amber-dim",
	signal: "text-signal bg-signal-dim",
	ink: "text-ink bg-panel"
};
function Badge({ tone = "mist", className, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-medium tracking-wide", tones[tone], className),
		children
	});
}
//#endregion
export { positionPnl as C, scoreTemperament as D, requiredAnnualized as E, useVoyage as O, pct as S, redPathOptions as T, formatNyTime as _, Label as a, monteCarloBand as b, allocationFor as c, clamp as d, compactMoney as f, formatNyClock as g, feasibilityVerdict as h, HydrateStore as i, verdictCopy as k, arrivalOdds as l, dayKey as m, Button as n, NorthStarMark as o, dayHeading as p, GUARDRAILS as r, PaperBadge as s, Badge as t, bookEquity as u, isNySessionOpen as v, positionValue as w, nySessionLabel as x, money as y };
