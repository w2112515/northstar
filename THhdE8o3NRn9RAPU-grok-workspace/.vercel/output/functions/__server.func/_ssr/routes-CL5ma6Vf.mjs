import { i as __toESM } from "../_runtime.mjs";
import { i as buildForecast, r as buildCandles, w as sampleWatchlist } from "./seed-D7NXUXBT.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { O as require_jsx_runtime, a as Overlay2, c as Title2, i as Description2, l as Trigger2, n as Cancel, o as Portal2, r as Content2, s as Root2, t as Action } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { C as positionPnl, O as useVoyage, S as pct, _ as formatNyTime, d as clamp, f as compactMoney, l as arrivalOdds, n as Button, t as Badge, u as bookEquity, w as positionValue, y as money } from "./badge-BrsarOWB.mjs";
import { i as Search } from "../_libs/lucide-react.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { a as cn } from "./router-Byr47Ah9.mjs";
import { n as remainingMonths, r as targetOf, t as AppShell } from "./app-shell-CO_K8nda.mjs";
import { t as CandleChart } from "./candles-Diatu3FP.mjs";
import { n as TSS_SERVER_FUNCTION, r as getServerFnById, t as createServerFn } from "./ssr.mjs";
import { t as UNIVERSE_UNIQ } from "./universe-BwxzbG3s.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-CL5ma6Vf.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function GoalOrbit({ start, equity, target, odds }) {
	const progress = clamp((equity - start) / Math.max(target - start, 1), 0, 1);
	const over = equity > target;
	const geom = (0, import_react.useMemo)(() => {
		const w = 800;
		const h = 280;
		const x0 = 48;
		const y0 = 236;
		const x1 = 748;
		const y1 = 58;
		const cx = 300;
		const cy = 24;
		const d = `M ${x0} ${y0} Q ${cx} ${cy} ${x1} ${y1}`;
		const pointAt = (t) => {
			const u = 1 - t;
			return {
				x: u * u * x0 + 2 * u * t * cx + t * t * x1,
				y: u * u * y0 + 2 * u * t * cy + t * t * y1
			};
		};
		return {
			w,
			h,
			d,
			pointAt,
			x0,
			y0,
			x1,
			y1
		};
	}, []);
	const ship = geom.pointAt(over ? 1 : progress);
	const stars = (0, import_react.useMemo)(() => [
		[
			40,
			40,
			.5,
			2.1
		],
		[
			90,
			90,
			.7,
			3.4
		],
		[
			140,
			30,
			.4,
			1.8
		],
		[
			200,
			110,
			.55,
			4.2
		],
		[
			260,
			70,
			.35,
			2.6
		],
		[
			320,
			150,
			.6,
			3.1
		],
		[
			380,
			40,
			.45,
			1.4
		],
		[
			440,
			120,
			.7,
			2.9
		],
		[
			500,
			60,
			.3,
			4.6
		],
		[
			560,
			170,
			.5,
			2.2
		],
		[
			620,
			90,
			.65,
			3.7
		],
		[
			680,
			200,
			.4,
			1.6
		],
		[
			720,
			130,
			.55,
			2.4
		],
		[
			80,
			200,
			.35,
			3.3
		],
		[
			180,
			180,
			.5,
			4.8
		],
		[
			300,
			220,
			.3,
			2.7
		],
		[
			410,
			210,
			.45,
			1.9
		],
		[
			540,
			230,
			.6,
			3.5
		],
		[
			650,
			250,
			.4,
			2
		],
		[
			760,
			90,
			.7,
			4.1
		]
	], []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "relative h-full min-h-52 overflow-hidden rounded-xl starfield",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
			viewBox: `0 0 ${geom.w} ${geom.h}`,
			className: "h-auto w-full",
			preserveAspectRatio: "xMidYMid meet",
			role: "img",
			"aria-label": `Goal orbit. Equity ${compactMoney(equity)} of ${compactMoney(target)}. Odds ${(odds * 100).toFixed(0)} percent.`,
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("defs", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("linearGradient", {
						id: "orbit-gold",
						x1: "0",
						y1: "1",
						x2: "1",
						y2: "0",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
								offset: "0%",
								stopColor: "#35D0BA"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
								offset: "55%",
								stopColor: "#F5C542"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("stop", {
								offset: "100%",
								stopColor: "#F5C542"
							})
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("filter", {
						id: "orbit-glow",
						x: "-40%",
						y: "-40%",
						width: "180%",
						height: "180%",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("feGaussianBlur", {
							stdDeviation: "3.5",
							result: "b"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("feMerge", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("feMergeNode", { in: "b" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("feMergeNode", { in: "SourceGraphic" })] })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("filter", {
						id: "star-glow",
						x: "-80%",
						y: "-80%",
						width: "260%",
						height: "260%",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("feGaussianBlur", {
							stdDeviation: "2.2",
							result: "b"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("feMerge", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("feMergeNode", { in: "b" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("feMergeNode", { in: "SourceGraphic" })] })]
					})
				] }),
				[
					[
						60,
						80,
						180,
						40
					],
					[
						180,
						40,
						320,
						90
					],
					[
						320,
						90,
						480,
						30
					],
					[
						120,
						160,
						260,
						100
					],
					[
						260,
						100,
						420,
						140
					],
					[
						420,
						140,
						600,
						80
					],
					[
						200,
						220,
						360,
						180
					],
					[
						360,
						180,
						540,
						160
					],
					[
						540,
						160,
						700,
						100
					]
				].map(([x1, y1, x2, y2], i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
					x1,
					y1,
					x2,
					y2,
					stroke: "#24334F",
					strokeWidth: "0.6",
					opacity: "0.55"
				}, i)),
				stars.map(([x, y, r, delay], i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
					cx: x,
					cy: y,
					r,
					fill: "#E7EEF9",
					className: "motion-safe:animate-twinkle",
					style: {
						animationDelay: `${delay}s`,
						animationDuration: `${2.8 + i % 5 * .4}s`
					}
				}, i)),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
					d: geom.d,
					fill: "none",
					stroke: "#24334F",
					strokeWidth: "2",
					strokeLinecap: "round"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
					d: geom.d,
					fill: "none",
					stroke: "#F5C542",
					strokeWidth: "1.4",
					strokeLinecap: "round",
					strokeDasharray: "5 7",
					opacity: "0.7",
					className: "motion-safe:animate-orbit-dash",
					pathLength: 100
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
					d: geom.d,
					fill: "none",
					stroke: "url(#orbit-gold)",
					strokeWidth: "2.4",
					strokeLinecap: "round",
					filter: "url(#orbit-glow)",
					pathLength: 100,
					strokeDasharray: `${progress * 100} 100`
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
					cx: geom.x0,
					cy: geom.y0,
					r: "4.5",
					fill: "#A2B3D1"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
					x: geom.x0 + 12,
					y: geom.y0 + 5,
					fill: "#A2B3D1",
					fontSize: "11",
					fontFamily: "IBM Plex Mono, monospace",
					children: compactMoney(start)
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", {
					transform: `translate(${ship.x}, ${ship.y})`,
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
							r: "10",
							fill: "#F5C542",
							opacity: "0.18",
							className: "motion-safe:animate-breathe"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
							r: "4.2",
							fill: "#F5C542"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
							r: "1.6",
							fill: "#0B1220"
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
					x: ship.x + 12,
					y: ship.y - 10,
					fill: "#F5C542",
					fontSize: "11",
					fontFamily: "IBM Plex Mono, monospace",
					children: compactMoney(equity)
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", {
					transform: `translate(${geom.x1}, ${geom.y1})`,
					filter: "url(#star-glow)",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
						d: "M0 -14 L2.2 -2.4 L14 0 L2.2 2.4 L0 14 L-2.2 2.4 L-14 0 L-2.2 -2.4 Z",
						fill: "#F5C542"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
						r: "2",
						fill: "#0B1220"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
					x: geom.x1 - 86,
					y: geom.y1 + 28,
					fill: "#F5C542",
					fontSize: "11",
					fontFamily: "IBM Plex Mono, monospace",
					children: compactMoney(target)
				})
			]
		})
	});
}
function CockpitHero() {
	const voyage = useVoyage((s) => s.voyage);
	const cash = useVoyage((s) => s.cash);
	const positions = useVoyage((s) => s.positions);
	const oddsOverride = useVoyage((s) => s.oddsOverride);
	const equity = bookEquity(cash, positions);
	const monthsLeft = remainingMonths(voyage.startedAt, voyage.deadlineMonths);
	const odds = oddsOverride ?? arrivalOdds(voyage.startingCapital, targetOf(voyage), monthsLeft, voyage.temperament);
	const target = targetOf(voyage);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "panel grid min-w-0 overflow-hidden lg:grid-cols-[minmax(15rem,0.3fr)_1fr]",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-col justify-between gap-5 p-5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "kicker",
					children: "Destination"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-1.5 text-lg font-medium tracking-tight text-ink",
					children: money(target)
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
					className: "mt-1 text-2xs leading-relaxed text-mist",
					children: [
						money(voyage.startingCapital),
						" → ",
						voyage.deadlineMonths,
						" months. Paper book."
					]
				})
			] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(LogLine, { className: "border-t border-line pt-3" })]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "min-h-48 min-w-0 overflow-hidden p-2 lg:min-h-72",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GoalOrbit, {
				start: voyage.startingCapital,
				equity,
				target,
				odds
			})
		})]
	});
}
function LogLine({ className }) {
	const log = useVoyage((s) => s.log);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center gap-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "kicker",
					children: "Log"
				}),
				log.aiNarrated ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
					tone: "gold",
					children: "fleet"
				}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, { children: "system" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "num ml-auto text-micro text-mist",
					children: formatNyTime(log.ts)
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-1 line-clamp-4 text-2xs leading-relaxed text-mist",
			children: log.sentences.join(" ")
		})]
	});
}
function Approvals() {
	const proposals = useVoyage((s) => s.proposals);
	const approve = useVoyage((s) => s.approveProposal);
	const skip = useVoyage((s) => s.skipProposal);
	const killSwitch = useVoyage((s) => s.killSwitch);
	if (proposals.length === 0) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mb-1.5 flex items-center gap-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
			className: "kicker",
			children: "Waiting on you"
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
			tone: "amber",
			children: [proposals.length, " paused"]
		})]
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
		className: "flex flex-col gap-1.5",
		children: proposals.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
			className: "flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg bg-night px-3 py-2 shadow-tone-amber",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "min-w-0 flex-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-sm text-ink",
						children: [
							p.side === "buy" ? "Buy" : "Sell",
							" ",
							p.qty,
							" ",
							p.humanName
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "truncate text-2xs text-amber",
						children: p.pausedWhy
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "num text-xs text-coral",
					children: ["−", money(p.worstCase)]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex gap-1.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						variant: "ghost",
						className: "min-h-11 md:min-h-9",
						onClick: () => {
							skip(p.id);
							toast("Skipped. Radar keeps the name.");
						},
						children: "Skip"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						variant: "teal",
						className: "min-h-11 min-w-20 md:min-h-9",
						disabled: killSwitch,
						onClick: () => {
							approve(p.id);
							toast("Approved. Queued until the open.");
						},
						children: "Approve"
					})]
				})
			]
		}, p.id))
	})] });
}
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
function yahooSymbol(raw) {
	return raw.trim().toUpperCase().replace(/\./g, "-");
}
function searchUniverse(q, limit = 12) {
	const needle = q.trim().toUpperCase();
	if (!needle) return [];
	const starts = [];
	const named = [];
	for (const row of UNIVERSE_UNIQ) {
		if (row.symbol.startsWith(needle)) starts.push(row);
		else if (row.name.toUpperCase().includes(needle)) named.push(row);
		if (starts.length + named.length >= limit * 2) break;
	}
	return [...starts, ...named].slice(0, limit).map((row) => ({
		symbol: row.symbol,
		name: row.name,
		type: "Equity",
		exchange: ""
	}));
}
function syntheticLast(symbol) {
	const seed = symbol.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
	return Math.round((18 + seed % 520 + seed % 97 / 10) * 100) / 100;
}
function syntheticQuote(symbol, last = syntheticLast(symbol)) {
	const sym = symbol.trim().toUpperCase();
	const named = UNIVERSE_UNIQ.find((r) => r.symbol === sym);
	const candles = buildCandles(sym, last);
	const prev = candles.length > 1 ? candles[candles.length - 2].c : last * .997;
	return {
		symbol: sym,
		name: named?.name ?? sym,
		last,
		prev,
		change: prev ? (last - prev) / prev : 0,
		candles,
		live: false
	};
}
var searchTape = createServerFn({ method: "GET" }).validator((d) => {
	return { q: (typeof d === "object" && d && "q" in d ? String(d.q) : "").trim().slice(0, 40) };
}).handler(createSsrRpc("ea85f041eb176546f6570a7449242accf0013febf7c88a0ff0346777b9014cff"));
var loadTape = createServerFn({ method: "GET" }).validator((d) => {
	return { symbol: yahooSymbol(typeof d === "object" && d && "symbol" in d ? String(d.symbol) : "").slice(0, 16) };
}).handler(createSsrRpc("5bf034e4641cedd73c6ce3c521b09db21af945d1c206af139e07ffc2eb9b655c"));
var GROUPS = [
	{
		id: "holdings",
		label: "Holdings"
	},
	{
		id: "scout",
		label: "Scout"
	},
	{
		id: "core",
		label: "Core"
	}
];
function price(n) {
	return n.toLocaleString("en-US", {
		minimumFractionDigits: 2,
		maximumFractionDigits: 2
	});
}
function asHits(rows) {
	return rows.map((row) => ({
		symbol: row.symbol,
		name: row.name,
		type: "",
		exchange: ""
	}));
}
function MarketPanel() {
	const positions = useVoyage((s) => s.positions);
	const watch = (0, import_react.useMemo)(() => sampleWatchlist(), []);
	const holdings = (0, import_react.useMemo)(() => {
		const seen = /* @__PURE__ */ new Set();
		const rows = [];
		for (const p of positions) {
			if (seen.has(p.symbol)) continue;
			seen.add(p.symbol);
			rows.push({
				symbol: p.symbol,
				last: p.last,
				change: p.avgCost ? (p.last - p.avgCost) / p.avgCost : 0
			});
		}
		return rows;
	}, [positions]);
	const [group, setGroup] = (0, import_react.useState)("holdings");
	const [symbol, setSymbol] = (0, import_react.useState)("SPY");
	const [quote, setQuote] = (0, import_react.useState)(() => syntheticQuote("SPY", 644.2));
	const [loading, setLoading] = (0, import_react.useState)(false);
	const [q, setQ] = (0, import_react.useState)("");
	const [open, setOpen] = (0, import_react.useState)(false);
	const [hits, setHits] = (0, import_react.useState)(() => asHits(UNIVERSE_UNIQ.slice(0, 10)));
	const box = (0, import_react.useRef)(null);
	const req = (0, import_react.useRef)(0);
	const list = group === "holdings" ? holdings : watch.filter((w) => w.group === group).map((w) => ({
		symbol: w.symbol,
		last: w.last,
		change: w.change
	}));
	(0, import_react.useEffect)(() => {
		const id = ++req.current;
		setLoading(true);
		loadTape({ data: { symbol } }).then((row) => {
			if (req.current !== id) return;
			setQuote(row);
		}).catch(() => {
			if (req.current !== id) return;
			setQuote(syntheticQuote(symbol));
		}).finally(() => {
			if (req.current === id) setLoading(false);
		});
	}, [symbol]);
	(0, import_react.useEffect)(() => {
		if (!open) return;
		const needle = q.trim();
		if (needle.length < 1) {
			setHits(asHits(UNIVERSE_UNIQ.slice(0, 10)));
			return;
		}
		const local = searchUniverse(needle, 8);
		setHits(local);
		if (needle.length < 2) return;
		const t = window.setTimeout(() => {
			searchTape({ data: { q: needle } }).then((rows) => {
				if (q.trim() !== needle) return;
				setHits(rows.length ? rows : local);
			});
		}, 180);
		return () => window.clearTimeout(t);
	}, [q, open]);
	(0, import_react.useEffect)(() => {
		const onDoc = (e) => {
			if (!box.current?.contains(e.target)) setOpen(false);
		};
		document.addEventListener("mousedown", onDoc);
		return () => document.removeEventListener("mousedown", onDoc);
	}, []);
	const forecast = (0, import_react.useMemo)(() => buildForecast(quote.last), [quote.last]);
	const pick = (sym) => {
		setSymbol(sym.toUpperCase());
		setQ("");
		setOpen(false);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "panel flex h-full min-h-72 min-w-0 flex-col overflow-hidden p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex min-w-0 items-center gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "kicker",
						children: "Market"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-sm text-ink",
						children: quote.symbol
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: cn("num text-xs", quote.change >= 0 ? "text-teal" : "text-coral"),
						children: [
							price(quote.last),
							" ",
							pct(quote.change * 100)
						]
					}),
					!quote.live && !loading && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-micro text-mist",
						children: "paper path"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-0.5 truncate text-2xs text-mist",
				children: quote.name
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				ref: box,
				className: "relative mt-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Search, { className: "pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-mist" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						value: q,
						onChange: (e) => {
							setQ(e.target.value);
							setOpen(true);
						},
						onFocus: () => setOpen(true),
						onKeyDown: (e) => {
							if (e.key === "Escape") setOpen(false);
							if (e.key === "Enter") {
								e.preventDefault();
								const first = hits[0];
								const typed = q.trim().toUpperCase();
								if (first) pick(first.symbol);
								else if (/^[A-Z][A-Z.\-]{0,7}$/.test(typed)) pick(typed);
							}
						},
						placeholder: "Any name or ticker",
						"aria-label": "Search the tape",
						autoComplete: "off",
						spellCheck: false,
						className: "h-9 w-full rounded-md bg-void px-8 text-sm text-ink shadow-border placeholder:text-mist/60 focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-void),0_0_0_4px_var(--color-signal)]"
					}),
					open && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						role: "listbox",
						className: "absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-md bg-night py-1 hairline shadow-panel",
						children: hits.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
							className: "px-3 py-2 text-2xs text-mist",
							children: "No match. Enter a ticker to load it anyway."
						}) : hits.map((hit) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							role: "option",
							onClick: () => pick(hit.symbol),
							className: "flex w-full items-baseline justify-between gap-2 px-3 py-2 text-left hover:bg-panel",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "num text-sm text-ink",
								children: hit.symbol
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "min-w-0 truncate text-2xs text-mist",
								children: [hit.name, hit.exchange ? ` · ${hit.exchange}` : ""]
							})]
						}) }, hit.symbol))
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: cn("mt-2 h-44 min-h-0 flex-1", loading && "opacity-60"),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CandleChart, {
					candles: quote.candles,
					forecast
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-3 flex gap-0.5 rounded-md bg-void p-0.5",
				children: GROUPS.map((g) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => {
						setGroup(g.id);
						const first = g.id === "holdings" ? holdings[0] : watch.find((w) => w.group === g.id);
						if (first) setSymbol(first.symbol);
					},
					className: cn("h-9 flex-1 rounded-sm px-2 text-xs transition-[color,background-color] duration-150", group === g.id ? "bg-panel text-ink" : "text-mist hover:text-ink"),
					children: g.label
				}, g.id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-1.5 grid grid-cols-2 gap-0.5",
				children: list.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
					className: "col-span-2 px-2 py-2 text-2xs text-mist",
					children: "Nothing in this book yet."
				}) : list.map((w) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => pick(w.symbol),
					className: cn("flex h-9 w-full items-center justify-between rounded-sm px-2 text-left text-xs", "transition-[background-color,color] duration-150", symbol === w.symbol ? "bg-panel text-ink" : "text-mist hover:bg-panel/60 hover:text-ink"),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: w.symbol }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: cn("num", w.change >= 0 ? "text-teal" : "text-coral"),
						children: pct(w.change * 100, 1)
					})]
				}) }, w.symbol))
			})
		]
	});
}
var FLOW = [
	{
		id: "perceive",
		label: "perceive",
		kind: "gemini"
	},
	{
		id: "guard",
		label: "guard",
		kind: "code"
	},
	{
		id: "triage",
		label: "triage",
		kind: "gemini"
	},
	{
		id: "signals",
		label: "signals",
		kind: "gemini"
	},
	{
		id: "gate",
		label: "gate + execute",
		kind: "code"
	},
	{
		id: "explain",
		label: "explain",
		kind: "gemini"
	},
	{
		id: "record",
		label: "record",
		kind: "code"
	}
];
var SATS = [
	{
		id: "scout",
		label: "scout",
		kind: "gemini",
		near: "perceive"
	},
	{
		id: "weather",
		label: "weather",
		kind: "code",
		near: "triage"
	},
	{
		id: "timesfm",
		label: "TimesFM",
		kind: "gemini",
		near: "signals"
	}
];
var COUNCIL = [
	"advocate",
	"critic",
	"judge"
];
var ORDER = FLOW.map((f) => f.id);
function lit(active, id) {
	if (active === "idle") return false;
	return ORDER.indexOf(id) <= ORDER.indexOf(active);
}
function AgentGraph({ active }) {
	const running = active !== "idle";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex h-full min-h-52 flex-col gap-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex flex-wrap gap-1",
				children: SATS.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
					label: s.label,
					kind: s.kind,
					on: running && lit(active, s.near),
					current: active === s.near
				}, s.id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ol", {
				className: "relative flex-1 pl-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "absolute top-1.5 bottom-1.5 left-[5px] w-px bg-line",
					"aria-hidden": true
				}), FLOW.map((n) => {
					const on = running && lit(active, n.id);
					const current = active === n.id;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "relative flex items-center gap-2 py-1",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cn("absolute -left-4 size-2.5 rounded-full", on ? n.kind === "gemini" ? "bg-gold" : "bg-signal" : "bg-line", current && "motion-safe:animate-pulse-node") }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: cn("text-xs", on ? "text-ink" : "text-mist"),
								children: n.label
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: cn("ml-auto text-micro font-medium tracking-wider uppercase", n.kind === "gemini" ? "text-gold" : "text-signal", !on && "opacity-40"),
								children: n.kind === "gemini" ? "AI" : "CODE"
							})
						]
					}, n.id);
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mb-1 kicker",
				children: "Debate council"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex flex-wrap gap-1",
				children: COUNCIL.map((c) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Chip, {
					label: c,
					kind: "gemini",
					on: running && lit(active, "signals"),
					current: active === "signals"
				}, c))
			})] })
		]
	});
}
function Chip({ label, kind, on, current }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn("rounded-sm bg-panel px-1.5 py-0.5 text-micro text-mist", on && kind === "gemini" && "text-gold shadow-tone-gold", on && kind === "code" && "text-signal shadow-tone-signal", current && "motion-safe:animate-pulse-node"),
		children: label
	});
}
function AgentPanel() {
	const step = useVoyage((s) => s.passStep);
	const running = useVoyage((s) => s.passRunning);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "panel flex h-full min-h-72 min-w-0 flex-col overflow-hidden p-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center justify-between gap-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "kicker",
				children: "Agent graph"
			}), running ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
				tone: "gold",
				children: step
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, { children: "idle" })]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-3 min-h-0 flex-1",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AgentGraph, { active: step })
		})]
	});
}
var AlertDialog = Root2;
var AlertDialogTrigger = Trigger2;
function AlertDialogContent({ title, description, confirm, confirmTone = "coral", onConfirm, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Portal2, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Overlay2, { className: "fixed inset-0 z-50 bg-void-deep/70" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Content2, {
		className: cn("fixed top-1/2 left-1/2 z-50 w-[min(28rem,calc(100vw-1.5rem))] -translate-x-1/2 -translate-y-1/2", "rounded-xl bg-night p-5 shadow-[0_0_0_1px_var(--color-line),0_12px_40px_rgb(0_0_0/0.4)]"),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Title2, {
				className: "text-base font-medium text-ink",
				children: title
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Description2, {
				className: "mt-2 text-sm text-mist",
				children: description
			}),
			children,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mt-5 flex justify-end gap-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Cancel, {
					asChild: true,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						children: "Cancel"
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Action, {
					asChild: true,
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: confirmTone,
						onClick: onConfirm,
						children: confirm
					})
				})]
			})
		]
	})] });
}
function OnBoard() {
	const positions = useVoyage((s) => s.positions);
	const orders = useVoyage((s) => s.orders);
	const closePosition = useVoyage((s) => s.closePosition);
	const cancelOrder = useVoyage((s) => s.cancelOrder);
	const [closing, setClosing] = (0, import_react.useState)(null);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "panel flex h-full min-h-72 min-w-0 flex-col overflow-hidden p-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "kicker",
					children: "On board"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "num text-2xs text-mist",
					children: [positions.length, " names"]
				})]
			}),
			positions.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-4 text-sm text-mist",
				children: "Cash only. Nothing has sailed yet."
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-2 min-h-0 flex-1 overflow-auto",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
					className: "w-full min-w-72 text-left text-xs",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
						className: "text-mist",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "border-b border-line",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "pb-1.5 font-medium",
									children: "Name"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "pb-1.5 font-medium",
									children: "Qty"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "pb-1.5 font-medium",
									children: "Value"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "pb-1.5 font-medium",
									children: "P&L"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", { className: "pb-1.5" })
							]
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: positions.map((p) => {
						const pnl = positionPnl(p);
						const val = positionValue(p);
						const pnlPct = (p.last - p.avgCost) / p.avgCost * 100;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "border-b border-line/50",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
									className: "py-1.5 pr-2",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-ink",
										children: p.humanName
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-micro text-mist",
										children: p.family
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "num py-1.5 pr-2 text-mist",
									children: p.qty
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "num py-1.5 pr-2 text-ink",
									children: money(val)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
									className: cn("num py-1.5 pr-2", pnl >= 0 ? "text-teal" : "text-coral"),
									children: [money(pnl, { sign: true }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "ml-1 text-micro opacity-80",
										children: pct(pnlPct)
									})]
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
									className: "py-1.5 text-right",
									children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AlertDialog, {
										open: closing === p.id,
										onOpenChange: (o) => setClosing(o ? p.id : null),
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogTrigger, {
											asChild: true,
											children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
												size: "sm",
												variant: "ghost",
												className: "h-8 px-2 text-2xs",
												children: "Close"
											})
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AlertDialogContent, {
											title: `Close ${p.humanName}?`,
											description: "Market sell, queued until the open. The mark you see is not a fill.",
											confirm: "Queue close",
											confirmTone: "coral",
											onConfirm: () => {
												closePosition(p.id);
												toast("Close queued until the open.");
												setClosing(null);
											}
										})]
									})
								})
							]
						}, p.id);
					}) })]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-3 kicker",
				children: "Queued"
			}),
			orders.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mt-1 text-2xs text-mist",
				children: "None waiting."
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "mt-1 space-y-1",
				children: orders.map((o) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
					className: "flex items-center justify-between gap-2 rounded-sm bg-panel px-2 py-1.5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "min-w-0",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "truncate text-xs text-ink",
							children: [
								o.side.toUpperCase(),
								" ",
								o.qty,
								" ",
								o.humanName,
								o.limit ? ` @ ${o.limit.toFixed(2)}` : " mkt"
							]
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						variant: "ghost",
						className: "h-8 px-2 text-2xs",
						onClick: () => cancelOrder(o.id),
						children: "Pull"
					})]
				}, o.id))
			})
		]
	});
}
var TONE = {
	proposal: "amber",
	verdict: "coral",
	fill: "teal",
	approval: "gold",
	forecast: "signal",
	debate: "gold",
	order: "signal",
	pnl: "teal"
};
function LiveFeed() {
	const items = useVoyage((s) => s.journal).slice(0, 8);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "panel min-w-0 p-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "kicker",
			children: "Live feed"
		}), items.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "mt-3 text-sm text-mist",
			children: "Quiet. The first pass will write here."
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
			className: "mt-3 grid gap-1 sm:grid-cols-2",
			children: items.map((ev, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
				className: "animate-feed-in flex items-center gap-2 rounded-md px-2 py-1.5",
				style: { animationDelay: `${Math.min(i, 6) * 40}ms` },
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
						tone: TONE[ev.kind] ?? "mist",
						children: ev.kind
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "min-w-0 flex-1 truncate text-xs text-ink",
						children: ev.title
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "num shrink-0 text-micro text-mist",
						children: formatNyTime(ev.ts)
					})
				]
			}, ev.id))
		})]
	});
}
function Skeleton({ className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: cn("skel", className) });
}
function CockpitSkeleton() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col gap-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-16 rounded-lg" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "panel grid overflow-hidden lg:grid-cols-[0.3fr_1fr]",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-3 p-5",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-3 w-20" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-6 w-36" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-3 w-44" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "mt-8 h-12 w-full" })
					]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "m-2 min-h-48 rounded-xl lg:min-h-72" })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid gap-3 xl:grid-cols-3",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-64 rounded-xl" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-64 rounded-xl" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Skeleton, { className: "h-64 rounded-xl" })
				]
			})
		]
	});
}
function Home() {
	const loadingDemo = useVoyage((s) => s.loadingDemo);
	const autopilot = useVoyage((s) => s.autopilot);
	const killSwitch = useVoyage((s) => s.killSwitch);
	const circuitBreaker = useVoyage((s) => s.circuitBreaker);
	const passRunning = useVoyage((s) => s.passRunning);
	const runPass = useVoyage((s) => s.runPass);
	(0, import_react.useEffect)(() => {
		if (!autopilot || killSwitch || circuitBreaker === "hard") return;
		if (passRunning) return;
		const id = setInterval(() => {
			if (document.visibilityState !== "visible") return;
			useVoyage.getState().runPass();
		}, 28e3);
		return () => clearInterval(id);
	}, [
		autopilot,
		killSwitch,
		circuitBreaker,
		passRunning,
		runPass
	]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, { children: !!loadingDemo ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CockpitSkeleton, {}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex min-w-0 flex-col gap-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Approvals, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(CockpitHero, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.9fr)_minmax(0,1fr)]",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MarketPanel, {}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AgentPanel, {}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OnBoard, {})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(LiveFeed, {})
		]
	}) });
}
//#endregion
export { Home as component };
