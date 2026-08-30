import { i as __toESM } from "../_runtime.mjs";
import { n as REGIME, x as sampleSpark } from "./seed-D7NXUXBT.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { O as require_jsx_runtime, d as DialogClose, f as DialogContent, h as DialogTitle, m as DialogPortal, p as DialogOverlay, u as Dialog } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { O as useVoyage, S as pct, a as Label, g as formatNyClock, i as HydrateStore, l as arrivalOdds, n as Button, o as NorthStarMark, s as PaperBadge, u as bookEquity, v as isNySessionOpen, x as nySessionLabel, y as money } from "./badge-BrsarOWB.mjs";
import { d as useRouterState, v as Link, y as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as Radar, c as Layers, l as Gauge, o as Play, r as Settings, s as OctagonX, t as X, u as BookOpen } from "../_libs/lucide-react.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { a as cn, i as TooltipTrigger, n as Tooltip, r as TooltipContent } from "./router-Byr47Ah9.mjs";
import { n as SwitchThumb, t as Switch$1 } from "../_libs/radix-ui__react-switch.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/app-shell-CO_K8nda.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function resolveMarketOpen(override, now = /* @__PURE__ */ new Date()) {
	if (override === "open") return true;
	if (override === "closed") return false;
	return isNySessionOpen(now);
}
function Sparkline({ data, className }) {
	if (data.length < 2) return null;
	const min = Math.min(...data);
	const max = Math.max(...data);
	const span = Math.max(max - min, 1);
	const d = data.map((v, i) => {
		const x = i / (data.length - 1) * 100;
		const y = 18 - (v - min) / span * 16;
		return `${i === 0 ? "M" : "L"} ${x} ${y}`;
	}).join(" ");
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", {
		viewBox: "0 0 100 20",
		className,
		"aria-hidden": true,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
			d,
			fill: "none",
			stroke: "currentColor",
			strokeWidth: "1.6",
			strokeLinecap: "round"
		})
	});
}
function monthsElapsed(startedAt, now = Date.now()) {
	const start = new Date(startedAt).getTime();
	return Math.max(0, Math.floor((now - start) / 2630016e3));
}
function remainingMonths(startedAt, deadline, now = Date.now()) {
	return Math.max(1, deadline - monthsElapsed(startedAt, now));
}
function targetOf(voyage) {
	if (voyage.goalMode === "income") return voyage.startingCapital + voyage.monthlyIncome * voyage.deadlineMonths;
	return voyage.targetAmount;
}
function Switch({ className, tone = "teal", ...props }) {
	const checked = tone === "gold" ? "data-[state=checked]:bg-gold" : tone === "coral" ? "data-[state=checked]:bg-coral" : tone === "amber" ? "data-[state=checked]:bg-amber" : "data-[state=checked]:bg-teal";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch$1, {
		className: cn("relative h-6 w-10 shrink-0 rounded-full bg-line transition-[background-color] duration-150 ease-out", "focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-void),0_0_0_4px_var(--color-signal)]", "disabled:opacity-40", checked, className),
		...props,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SwitchThumb, { className: "block size-5 translate-x-0.5 rounded-full bg-ink transition-transform duration-150 ease-out data-[state=checked]:translate-x-[18px]" })
	});
}
function Helm() {
	const autopilot = useVoyage((s) => s.autopilot);
	const killSwitch = useVoyage((s) => s.killSwitch);
	const circuitBreaker = useVoyage((s) => s.circuitBreaker);
	const passRunning = useVoyage((s) => s.passRunning);
	const orders = useVoyage((s) => s.orders);
	const setAutopilot = useVoyage((s) => s.setAutopilot);
	const setKillSwitch = useVoyage((s) => s.setKillSwitch);
	const runPass = useVoyage((s) => s.runPass);
	const open = resolveMarketOpen(useVoyage((s) => s.marketOverride));
	const blocked = killSwitch || circuitBreaker === "hard";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "flex items-center gap-2 overflow-x-auto border-t border-line px-3 py-1.5 md:gap-3 md:px-4",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "flex min-h-11 shrink-0 items-center gap-2 text-sm text-ink md:min-h-9",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
					checked: autopilot,
					disabled: blocked,
					onCheckedChange: (v) => {
						setAutopilot(v);
						toast(v ? "Autopilot on. Paused tickets still wait on you." : "Autopilot off.");
					}
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: ["Auto", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "hidden sm:inline",
					children: "pilot"
				})] })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
				size: "sm",
				variant: "signal",
				className: "min-h-11 shrink-0 md:min-h-9",
				disabled: blocked || passRunning,
				onClick: () => {
					runPass();
					toast(open ? "Pass running." : "Pass running against a closed tape. New risk queues.");
				},
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Play, { className: "size-3.5" }), passRunning ? "Passing…" : "Run one pass"]
			}),
			!open && orders.length > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "hidden shrink-0 text-2xs text-signal sm:inline",
				children: [orders.length, " queued"]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "ml-auto shrink-0",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					size: "sm",
					variant: killSwitch ? "quiet" : "danger",
					className: "min-h-11 md:min-h-9",
					onClick: () => {
						setKillSwitch(!killSwitch);
						toast(killSwitch ? "Kill switch cleared." : "Kill switch on. Fleet docked.");
					},
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(OctagonX, { className: "size-3.5" }), killSwitch ? "Restart fleet" : "Kill switch"]
				})
			})
		]
	});
}
var TITLES = {
	"/": "Cockpit",
	"/research": "Research",
	"/strategies": "Strategies",
	"/journal": "Journal"
};
function StatusRibbon({ pathname }) {
	const voyage = useVoyage((s) => s.voyage);
	const cash = useVoyage((s) => s.cash);
	const positions = useVoyage((s) => s.positions);
	const todayPct = useVoyage((s) => s.todayPct);
	const oddsOverride = useVoyage((s) => s.oddsOverride);
	const marketOverride = useVoyage((s) => s.marketOverride);
	const equity = bookEquity(cash, positions);
	const target = targetOf(voyage);
	const odds = oddsOverride ?? arrivalOdds(voyage.startingCapital, target, remainingMonths(voyage.startedAt, voyage.deadlineMonths), voyage.temperament);
	const open = resolveMarketOpen(marketOverride);
	const elapsed = monthsElapsed(voyage.startedAt);
	const [clock, setClock] = (0, import_react.useState)("");
	const title = TITLES[pathname] ?? "NorthStar";
	(0, import_react.useEffect)(() => {
		const tick = () => setClock(formatNyClock());
		tick();
		const id = setInterval(tick, 1e3);
		return () => clearInterval(id);
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "sticky top-0 z-30 border-b border-line bg-night/95 backdrop-blur-sm",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5 md:px-4",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "kicker hidden shrink-0 md:inline",
					children: title
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-2",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "num text-sm text-ink",
									children: money(equity)
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sparkline, {
									data: voyage.firstDay ? [voyage.startingCapital, equity] : sampleSpark,
									className: cn("hidden h-4 w-12 sm:block", todayPct >= 0 ? "text-teal" : "text-coral")
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: cn("num text-xs", todayPct >= 0 ? "text-teal" : "text-coral"),
									children: pct(todayPct)
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "hidden h-3 w-px bg-line sm:block" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-baseline gap-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "kicker",
								children: "odds"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "num text-sm text-gold",
								children: [(odds * 100).toFixed(0), "%"]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "hidden items-baseline gap-1.5 sm:flex",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "kicker",
								children: "voyage"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "num text-sm",
								children: [
									Math.min(elapsed + 1, voyage.deadlineMonths),
									"/",
									voyage.deadlineMonths
								]
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex items-center gap-1.5",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cn("size-1.5 rounded-full", open ? "bg-teal" : "bg-coral") }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-xs text-mist",
								children: nySessionLabel(open)
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "hidden items-baseline gap-1.5 lg:flex",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "kicker",
									children: "wx"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "num text-sm",
									children: REGIME.weatherScore
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "text-xs text-mist",
									children: [
										REGIME.direction,
										"·",
										REGIME.weather
									]
								})
							]
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "ml-auto flex items-center gap-3",
					children: [clock ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "num hidden text-xs text-mist sm:inline",
						children: clock
					}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PaperBadge, { className: "shrink-0" })]
				})
			]
		}), pathname === "/" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Helm, {})]
	});
}
var Sheet = Dialog;
function SheetContent({ title, children, className }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogPortal, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogOverlay, { className: "fixed inset-0 z-50 bg-void-deep/60" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogContent, {
		className: cn("fixed top-0 right-0 z-50 flex h-full w-[min(26rem,100vw)] flex-col bg-night shadow-[0_0_0_1px_var(--color-line)]", className),
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center justify-between border-b border-line px-5 py-4",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DialogTitle, {
				className: "text-sm font-medium text-ink",
				children: title
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(DialogClose, {
				className: "size-10 rounded-md text-mist hover:bg-panel hover:text-ink transition-[background-color,color] duration-150",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "mx-auto size-4" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "sr-only",
					children: "Close"
				})]
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex-1 overflow-y-auto p-5",
			children
		})]
	})] });
}
function Separator({ className, vertical }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		role: "separator",
		className: cn("bg-line", vertical ? "w-px self-stretch" : "h-px w-full", className)
	});
}
function SettingsSheet({ open, onOpenChange }) {
	const navigate = useNavigate();
	const marketOverride = useVoyage((s) => s.marketOverride);
	const circuitBreaker = useVoyage((s) => s.circuitBreaker);
	const killSwitch = useVoyage((s) => s.killSwitch);
	const autopilot = useVoyage((s) => s.autopilot);
	const setMarketOverride = useVoyage((s) => s.setMarketOverride);
	const setCircuitBreaker = useVoyage((s) => s.setCircuitBreaker);
	const setKillSwitch = useVoyage((s) => s.setKillSwitch);
	const setAutopilot = useVoyage((s) => s.setAutopilot);
	const loadSample = useVoyage((s) => s.loadSample);
	const loadFirstDay = useVoyage((s) => s.loadFirstDay);
	const setLoadingDemo = useVoyage((s) => s.setLoadingDemo);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Sheet, {
		open,
		onOpenChange,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(SheetContent, {
			title: "Settings",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-mist",
					children: "Paper book. Tape, breakers, and voyage scenarios for this cockpit."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-6 space-y-5",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
						label: "Autopilot",
						hint: "Passes run on their own. Paused tickets still wait on you.",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
							checked: autopilot,
							onCheckedChange: setAutopilot,
							disabled: killSwitch
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Row, {
						label: "Kill switch",
						hint: "Docks the fleet. Human must restart.",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, {
							tone: "coral",
							checked: killSwitch,
							onCheckedChange: setKillSwitch
						})
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Separator, { className: "my-6" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Tape" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-2 grid grid-cols-3 gap-1.5",
					children: [
						"auto",
						"open",
						"closed"
					].map((k) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						variant: marketOverride === k ? "signal" : "ghost",
						onClick: () => setMarketOverride(k),
						children: k === "auto" ? "NY clock" : k
					}, k))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Separator, { className: "my-6" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Circuit breaker" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "mt-2 grid grid-cols-3 gap-1.5",
					children: [
						"none",
						"soft",
						"hard"
					].map((k) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						variant: circuitBreaker === k ? k === "none" ? "quiet" : k === "soft" ? "amber" : "coral" : "ghost",
						onClick: () => setCircuitBreaker(k),
						children: k
					}, k))
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Separator, { className: "my-6" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: "Voyage scenarios" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-3 flex flex-col gap-2",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "ghost",
							onClick: () => {
								setLoadingDemo(true);
								loadSample();
								setTimeout(() => setLoadingDemo(false), 700);
								onOpenChange(false);
								navigate({ to: "/" });
							},
							children: "Load sample voyage"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "ghost",
							onClick: () => {
								loadFirstDay();
								onOpenChange(false);
								navigate({ to: "/" });
							},
							children: "First-day empty book"
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "gold",
							onClick: () => {
								onOpenChange(false);
								navigate({ to: "/onboarding" });
							},
							children: "Replay onboarding"
						})
					]
				})
			]
		})
	});
}
function Row({ label, hint, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-start justify-between gap-4",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "text-sm text-ink",
			children: label
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-0.5 text-xs text-mist",
			children: hint
		})] }), children]
	});
}
function StateBanners() {
	const killSwitch = useVoyage((s) => s.killSwitch);
	const circuitBreaker = useVoyage((s) => s.circuitBreaker);
	const setCircuitBreaker = useVoyage((s) => s.setCircuitBreaker);
	if (!killSwitch && circuitBreaker === "none") return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "mb-3 flex flex-col gap-2",
		children: [
			killSwitch && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "rounded-lg bg-coral-dim px-3 py-2 text-sm text-coral shadow-tone-coral",
				children: "Kill switch on. Fleet docked. No new risk. Restart from the helm."
			}),
			!killSwitch && circuitBreaker === "hard" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center justify-between gap-3 rounded-lg bg-coral-dim px-3 py-2 text-sm text-coral shadow-tone-coral",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Hard stop. Drawdown pause tripped. Human must restart." }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					size: "sm",
					variant: "ghost",
					onClick: () => setCircuitBreaker("none"),
					children: "Clear breaker"
				})]
			}),
			!killSwitch && circuitBreaker === "soft" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "rounded-lg bg-amber-dim px-3 py-2 text-sm text-amber shadow-tone-amber",
				children: "Soft pause. New risk is gated. Existing positions stay. Reopens below the drawdown floor."
			})
		]
	});
}
var NAV = [
	{
		to: "/",
		label: "Cockpit",
		icon: Gauge
	},
	{
		to: "/research",
		label: "Research",
		icon: Radar
	},
	{
		to: "/strategies",
		label: "Strategies",
		icon: Layers
	},
	{
		to: "/journal",
		label: "Journal",
		icon: BookOpen
	}
];
function AppShell({ children }) {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const [settings, setSettings] = (0, import_react.useState)(false);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex min-h-dvh overflow-x-hidden bg-void text-ink",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HydrateStore, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
				className: "hidden w-14 shrink-0 flex-col items-center border-r border-line bg-night py-3 md:flex",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/",
						"aria-label": "NorthStar cockpit",
						className: "mb-5 text-gold",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(NorthStarMark, { className: "size-5" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
						className: "flex flex-1 flex-col items-center gap-1",
						children: NAV.map((item) => {
							const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
							const Icon = item.icon;
							return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Tooltip, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TooltipTrigger, {
								asChild: true,
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
									to: item.to,
									"aria-label": item.label,
									"aria-current": active ? "page" : void 0,
									className: cn("relative flex size-10 items-center justify-center rounded-md text-mist", "transition-[color,background-color] duration-150 ease-out", active ? "bg-panel text-ink" : "hover:bg-panel/70 hover:text-ink"),
									children: [active && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "absolute left-0 h-4 w-px rounded-full bg-signal" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
										className: "size-4",
										strokeWidth: 1.6
									})]
								})
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TooltipContent, {
								side: "right",
								children: item.label
							})] }, item.to);
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Tooltip, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TooltipTrigger, {
						asChild: true,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							"aria-label": "Settings",
							onClick: () => setSettings(true),
							className: "flex size-10 items-center justify-center rounded-md text-mist hover:bg-panel hover:text-ink transition-[color,background-color] duration-150",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Settings, {
								className: "size-4",
								strokeWidth: 1.6
							})
						})
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TooltipContent, {
						side: "right",
						children: "Settings"
					})] })
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex min-w-0 flex-1 flex-col",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusRibbon, { pathname }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
					className: "min-w-0 flex-1 px-3 py-3 pb-24 md:px-4 md:pb-4",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)(StateBanners, {}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "min-w-0",
							children
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("footer", {
							className: "mt-6 pb-1 text-center text-micro leading-relaxed text-mist/60",
							children: "Paper trading · live prices · historical odds, not a promise"
						})
					]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("nav", {
				className: "fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-night/95 backdrop-blur-sm md:hidden",
				children: [NAV.map((item) => {
					const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
					const Icon = item.icon;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: item.to,
						className: cn("relative flex h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 text-micro tracking-wide", active ? "text-ink" : "text-mist"),
						children: [
							active && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "absolute top-0 h-px w-6 bg-signal" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
								className: "size-4",
								strokeWidth: 1.6
							}),
							item.label
						]
					}, item.to);
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: () => setSettings(true),
					className: "flex h-14 flex-1 flex-col items-center justify-center gap-0.5 text-micro text-mist",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Settings, {
						className: "size-4",
						strokeWidth: 1.6
					}), "Settings"]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SettingsSheet, {
				open: settings,
				onOpenChange: setSettings
			})
		]
	});
}
//#endregion
export { remainingMonths as n, targetOf as r, AppShell as t };
