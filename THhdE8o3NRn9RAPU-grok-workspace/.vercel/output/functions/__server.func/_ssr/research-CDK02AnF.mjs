import { i as __toESM } from "../_runtime.mjs";
import { b as sampleScouts, h as sampleOptionWatch, i as buildForecast, n as REGIME, r as buildCandles } from "./seed-D7NXUXBT.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { O as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { O as useVoyage, S as pct, b as monteCarloBand, l as arrivalOdds, n as Button, t as Badge } from "./badge-BrsarOWB.mjs";
import { a as cn } from "./router-Byr47Ah9.mjs";
import { n as remainingMonths, r as targetOf, t as AppShell } from "./app-shell-CO_K8nda.mjs";
import { t as MonteCarloChart } from "./monte-carlo-_gYYsC6y.mjs";
import { t as CandleChart } from "./candles-Diatu3FP.mjs";
import { i as Trigger, n as List, r as Root2, t as Content } from "../_libs/radix-ui__react-tabs.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/research-CDK02AnF.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var Tabs = Root2;
function TabsList({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(List, {
		className: cn("inline-flex h-10 items-center gap-1 rounded-lg bg-night p-1 shadow-border", className),
		...props
	});
}
function TabsTrigger({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Trigger, {
		className: cn("inline-flex h-9 min-h-9 items-center justify-center rounded-md px-3 text-sm text-mist", "transition-[color,background-color] duration-150 ease-out", "data-[state=active]:bg-panel data-[state=active]:text-ink", "focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-signal)]", "disabled:opacity-40", className),
		...props
	});
}
function TabsContent({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Content, {
		className: cn("mt-3 focus-visible:outline-none", className),
		...props
	});
}
function IcBars({ rows }) {
	const max = Math.max(.08, ...rows.map((r) => Math.abs(r.ic)));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "flex flex-col gap-2",
		children: rows.map((r) => {
			const mag = Math.abs(r.ic) / max;
			const pos = r.ic >= 0;
			return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-[8.5rem_1fr_3.5rem] items-center gap-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "truncate text-xs text-mist",
						children: r.name
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "relative h-2 rounded-full bg-panel",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "absolute top-0 left-1/2 h-full w-px bg-line" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: cn("absolute top-0 h-2 rounded-full", pos ? "bg-teal left-1/2" : "bg-coral"),
							style: pos ? { width: `${mag * 50}%` } : {
								width: `${mag * 50}%`,
								left: `${50 - mag * 50}%`
							}
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: cn("num text-right text-xs", pos ? "text-teal" : "text-coral"),
						children: [r.ic >= 0 ? "+" : "−", Math.abs(r.ic).toFixed(3)]
					})
				]
			}, r.id);
		})
	});
}
function ResearchWorkbench() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Tabs, {
		defaultValue: "radar",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(TabsList, {
				className: "w-full justify-start overflow-x-auto",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
						value: "radar",
						children: "Radar"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
						value: "compass",
						children: "Compass"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
						value: "evolution",
						children: "Evolution"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsTrigger, {
						value: "mining",
						children: "Mining"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
				value: "radar",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RadarTab, {})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
				value: "compass",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CompassTab, {})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
				value: "evolution",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EvolutionTab, {})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TabsContent, {
				value: "mining",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MiningTab, {})
			})
		]
	});
}
function RadarTab() {
	const scouts = sampleScouts();
	const opts = sampleOptionWatch();
	const log = useVoyage((s) => s.log);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid gap-3 lg:grid-cols-[1.2fr_0.8fr]",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "panel p-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "kicker",
				children: "Scout candidates"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-3 overflow-x-auto",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
					className: "w-full min-w-md text-left text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
						className: "text-xs text-mist",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "border-b border-line",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "pb-2 font-medium",
									children: "Symbol"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "pb-2 font-medium",
									children: "Score"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "pb-2 font-medium",
									children: "Why"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "pb-2 font-medium",
									children: "Flavor"
								})
							]
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: scouts.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
						className: "border-b border-line/60 align-top",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "py-2.5 pr-3 font-medium",
								children: s.symbol
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "num py-2.5 pr-3 text-signal",
								children: s.score
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "py-2.5 pr-3 text-xs text-mist",
								children: s.why
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "py-2.5",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "flex flex-wrap gap-1",
									children: s.flavors.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, { children: f }, f))
								})
							})
						]
					}, s.id)) })]
				})
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-col gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "panel p-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "kicker",
					children: "Options watch · yields"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-3 space-y-3",
					children: opts.map((o) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-baseline justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-sm text-ink",
							children: o.humanName
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "num text-xs text-teal",
							children: pct(o.yield * 100)
						})]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "text-2xs text-mist",
						children: [
							o.dte,
							" DTE · IV ",
							(o.iv * 100).toFixed(0),
							"% · ",
							o.note
						]
					})] }, o.id))
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "panel p-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "kicker",
					children: "Captain's log"
				}), log.sentences.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-ink",
					children: s
				}, s))]
			})]
		})]
	});
}
function CompassTab() {
	const voyage = useVoyage((s) => s.voyage);
	const advice = useVoyage((s) => s.advice);
	const adopt = useVoyage((s) => s.adoptAdvice);
	const dismiss = useVoyage((s) => s.dismissAdvice);
	const [open, setOpen] = (0, import_react.useState)(false);
	const monthsLeft = remainingMonths(voyage.startedAt, voyage.deadlineMonths);
	const target = targetOf(voyage);
	const band = (0, import_react.useMemo)(() => monteCarloBand(voyage.startingCapital, monthsLeft, voyage.temperament), [voyage, monthsLeft]);
	const candles = (0, import_react.useMemo)(() => buildCandles("SPY", 644.2), []);
	const forecast = (0, import_react.useMemo)(() => buildForecast(644.2), []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid gap-3 lg:grid-cols-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "panel p-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex flex-wrap items-center gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
						tone: "teal",
						children: [
							REGIME.direction,
							" × ",
							REGIME.weather
						]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "kicker",
						children: "regime"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
					className: "mt-4 grid grid-cols-3 gap-3 text-sm",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
							k: "streak",
							v: `${REGIME.streak}d`
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
							k: "vol",
							v: `${REGIME.volPct.toFixed(1)}%`
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
							k: "breadth",
							v: pct(REGIME.breadth * 100, 0)
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						className: "text-left",
						onClick: () => setOpen((o) => !o),
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "kicker",
								children: "AI hypothesis"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-sm text-ink",
								children: "Calm-up analog from 2017/2019 still fits. Do not add Friday hedges until Night Watch graduates."
							}),
							!open && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-xs text-signal",
								children: "Expand"
							})
						]
					}), open && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-xs leading-relaxed text-mist",
						children: "Clamped: we do not extrapolate beyond the analog set. Breadth 62% is supportive, not euphoric. Weather score 74. Historical estimate, not a promise."
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-4 space-y-2",
					children: [
						{
							name: "Core Trend",
							sharpe: 1.61,
							note: "Keeps edge in up × calm."
						},
						{
							name: "Drift Harvest",
							sharpe: 1.28,
							note: "IC holds; costs fine."
						},
						{
							name: "Scout Options",
							sharpe: .74,
							note: "IV rank too low. Stay docked."
						},
						{
							name: "Weather Floor",
							sharpe: 1.82,
							note: "Champion in this analog."
						}
					].map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-baseline justify-between rounded-md bg-panel px-3 py-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-sm text-ink",
							children: f.name
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-2xs text-mist",
							children: f.note
						})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "num text-xs text-mist",
							children: ["Sharpe ", f.sharpe.toFixed(2)]
						})]
					}, f.name))
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-col gap-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "panel p-4",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-start justify-between gap-3",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "kicker",
									children: "Helm advice"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mt-1 text-sm font-medium text-ink",
									children: advice.title
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "mt-1 text-xs text-mist",
									children: advice.body
								})
							] }),
							advice.adopted === true && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
								tone: "teal",
								children: "adopted"
							}),
							advice.adopted === false && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, { children: "dismissed" })
						]
					}), advice.adopted == null && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 flex gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							variant: "teal",
							onClick: adopt,
							children: "Adopt"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							variant: "ghost",
							onClick: dismiss,
							children: "Dismiss"
						})]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "panel p-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "kicker",
							children: "TimesFM 5-day fan · SPY"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "mt-2 h-44",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CandleChart, {
								candles,
								forecast
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "mt-2 text-2xs text-mist",
							children: [
								"Historical estimate, not a promise. Odds of voyage arrival",
								" ",
								(arrivalOdds(voyage.startingCapital, target, monthsLeft, voyage.temperament) * 100).toFixed(0),
								"%."
							]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
					className: "panel hidden p-4 lg:block",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "kicker",
						children: "Arrival band (remaining months)"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "h-36",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MonteCarloChart, {
							band,
							target,
							start: voyage.startingCapital
						})
					})]
				})
			]
		})]
	});
}
function EvolutionTab() {
	const promotions = useVoyage((s) => s.promotions);
	const experiments = useVoyage((s) => s.experiments);
	const promote = useVoyage((s) => s.promote);
	const archive = useVoyage((s) => s.archivePromo);
	const live = promotions.filter((p) => p.status === "challenger");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex flex-col gap-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid gap-3 lg:grid-cols-3",
				children: live.map((p) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
					className: "panel p-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-start justify-between gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-sm font-medium text-ink",
								children: p.name
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
								tone: "gold",
								children: "challenger"
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("dl", {
							className: "mt-3 grid grid-cols-3 gap-2 text-xs",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
									k: "OOS Sharpe",
									v: p.oosSharpe.toFixed(2)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
									k: "max DD",
									v: pct(-p.maxDd * 100, 1)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Stat, {
									k: "win",
									v: pct(p.winRate * 100, 0)
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
							className: "mt-3 text-xs text-mist",
							children: p.note
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "mt-3 flex gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								size: "sm",
								variant: "gold",
								onClick: () => promote(p.id),
								children: "Promote"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								size: "sm",
								variant: "ghost",
								onClick: () => archive(p.id),
								children: "Archive"
							})]
						})
					]
				}, p.id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "panel p-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "kicker",
					children: "Weather-floor validation"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-2 text-sm text-ink",
					children: "2018 and 2022 analogs: overlay cut size within 4 sessions of stress above 0.62. Max DD 5.4% vs 11.8% without the floor. Study holds. Champion stays."
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "panel p-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "kicker",
					children: "Shipyard · DSL specs"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
					className: "mt-3 overflow-x-auto rounded-lg bg-void p-3 text-xs text-mist",
					children: `strategy NightWatch v0.4
  when weekday=Fri and time>=14:30ET
    if weather.stress > 0.45: collar beta 1x
    else: stand down
  validate walk_forward 2016-2025
  status shipyard`
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "panel overflow-x-auto p-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "kicker",
					children: "Experiment lineage — including failures"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
					className: "mt-3 w-full min-w-lg text-left text-sm",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
						className: "text-xs text-mist",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
							className: "border-b border-line",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "pb-2 font-medium",
									children: "Name"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "pb-2 font-medium",
									children: "Family"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "pb-2 font-medium",
									children: "Result"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "pb-2 font-medium",
									children: "OOS Sharpe"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
									className: "pb-2 font-medium",
									children: "Note"
								})
							]
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: experiments.map((e) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
						className: "border-b border-line/60",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "py-2 pr-3",
								children: e.name
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "py-2 pr-3 text-mist",
								children: e.family
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "py-2 pr-3",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
									tone: e.result === "promoted" ? "gold" : e.result === "failed" ? "coral" : e.result === "running" ? "signal" : "mist",
									children: e.result
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "num py-2 pr-3",
								children: e.oosSharpe.toFixed(2)
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
								className: "py-2 text-xs text-mist",
								children: e.note
							})
						]
					}, e.id)) })]
				})]
			})
		]
	});
}
function MiningTab() {
	const factors = useVoyage((s) => s.factors);
	const admit = useVoyage((s) => s.admitFactor);
	const dismiss = useVoyage((s) => s.dismissFactor);
	const pending = factors.filter((f) => f.pending);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "grid gap-3 lg:grid-cols-[1.1fr_0.9fr]",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "panel p-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "kicker",
				children: "Factor IC"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "mt-4",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IcBars, { rows: factors })
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex flex-col gap-3",
			children: [pending.map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
				className: "rounded-xl bg-night p-4 shadow-tone-amber",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-center justify-between",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "text-sm font-medium text-ink",
							children: f.name
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
							tone: "amber",
							children: "mine"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-2 text-xs text-mist",
						children: [
							"Raw IC ",
							f.ic.toFixed(3),
							" looks pretty. Deflated IC ",
							f.deflatedIc.toFixed(3),
							" is the number that matters. Multiple-testing tax applied."
						]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 flex gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							variant: "teal",
							onClick: () => admit(f.id),
							children: "Admit"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							size: "sm",
							variant: "ghost",
							onClick: () => dismiss(f.id),
							children: "Dismiss"
						})]
					})
				]
			}, f.id)), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "panel p-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "kicker",
					children: "Admitted library"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
					className: "mt-3 space-y-2",
					children: factors.filter((f) => f.admitted).map((f) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "flex items-center justify-between text-sm",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: f.name }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
							tone: f.decay === "fresh" ? "teal" : f.decay === "aging" ? "amber" : "coral",
							children: f.decay
						})]
					}, f.id))
				})]
			})]
		})]
	});
}
function Stat({ k, v }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "kicker",
		children: k
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("num mt-0.5 text-sm text-ink"),
		children: v
	})] });
}
function ResearchPage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ResearchWorkbench, {}) });
}
//#endregion
export { ResearchPage as component };
