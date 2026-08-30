import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { O as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { D as scoreTemperament, E as requiredAnnualized, O as useVoyage, S as pct, T as redPathOptions, a as Label, b as monteCarloBand, c as allocationFor, h as feasibilityVerdict, i as HydrateStore, k as verdictCopy, l as arrivalOdds, n as Button, o as NorthStarMark, r as GUARDRAILS, s as PaperBadge, t as Badge, y as money } from "./badge-BrsarOWB.mjs";
import { y as useNavigate } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as cn } from "./router-Byr47Ah9.mjs";
import { t as Input } from "./input-D-VrT6eX.mjs";
import { t as MonteCarloChart } from "./monte-carlo-_gYYsC6y.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/onboarding-DOMmujm1.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var QUESTIONS = [
	{
		q: "A month that is down 10% would make me…",
		opts: [
			{
				label: "Want the fleet paused.",
				value: "conservative"
			},
			{
				label: "Want a review, then decide.",
				value: "balanced"
			},
			{
				label: "Sit through it if the destination still looks reachable.",
				value: "aggressive"
			}
		]
	},
	{
		q: "Options and short-dated trades…",
		opts: [
			{
				label: "Keep them off the book.",
				value: "conservative"
			},
			{
				label: "Small, gated, never more than a slice.",
				value: "balanced"
			},
			{
				label: "Use them when the weather is favorable.",
				value: "aggressive"
			}
		]
	},
	{
		q: "When the risk gate rejects a trade…",
		opts: [
			{
				label: "That's the point of the gate.",
				value: "conservative"
			},
			{
				label: "Show me why. I'll usually agree.",
				value: "balanced"
			},
			{
				label: "I'll override if I see a reason.",
				value: "aggressive"
			}
		]
	}
];
function OnboardingWizard() {
	const navigate = useNavigate();
	const complete = useVoyage((s) => s.completeOnboarding);
	const [step, setStep] = (0, import_react.useState)(0);
	const [capital, setCapital] = (0, import_react.useState)(1e5);
	const [mode, setMode] = (0, import_react.useState)("amount");
	const [target, setTarget] = (0, import_react.useState)(11e4);
	const [income, setIncome] = (0, import_react.useState)(800);
	const [months, setMonths] = (0, import_react.useState)(12);
	const [answers, setAnswers] = (0, import_react.useState)([
		null,
		null,
		null
	]);
	const temperament = scoreTemperament(answers);
	const dest = mode === "amount" ? target : capital + income * months;
	const required = requiredAnnualized(capital, dest, months);
	const odds = arrivalOdds(capital, dest, months, temperament);
	const verdict = feasibilityVerdict(odds, required);
	const band = (0, import_react.useMemo)(() => monteCarloBand(capital, months, temperament), [
		capital,
		months,
		temperament
	]);
	const alloc = allocationFor(temperament);
	const g = GUARDRAILS[temperament];
	const red = redPathOptions(capital, dest, months);
	const answered = answers.every(Boolean);
	const cfg = () => ({
		onboarded: true,
		startingCapital: capital,
		goalMode: mode,
		targetAmount: mode === "amount" ? target : dest,
		monthlyIncome: income,
		deadlineMonths: months,
		temperament,
		startedAt: (/* @__PURE__ */ new Date()).toISOString(),
		firstDay: true
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "starfield min-h-dvh",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HydrateStore, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex items-center justify-between px-5 py-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center gap-2 text-gold",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(NorthStarMark, {}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-sm font-medium text-ink",
						children: "NorthStar"
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PaperBadge, {})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
				className: "mx-auto w-full max-w-3xl px-4 pb-16",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ol", {
						className: "mb-8 flex gap-2",
						children: [
							"Destination",
							"Temperament",
							"Honest plan",
							"Confirm"
						].map((label, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "flex-1",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: cn("h-1 rounded-full", i <= step ? "bg-gold" : "bg-line") }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: cn("mt-2 text-2xs tracking-wide", i === step ? "text-ink" : "text-mist"),
								children: label
							})]
						}, label))
					}),
					step === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						className: "panel p-6",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
								className: "text-2xl font-medium tracking-tight",
								children: "Where is the ship going?"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 text-sm text-mist",
								children: "Practice capital only. This is paper money. Live prices, simulated book. Try $200,000 in 12 months if you want to see the red path."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-6",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									htmlFor: "cap",
									children: "Practice capital"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: "cap",
									type: "number",
									min: 1e3,
									step: 1e3,
									value: capital,
									onChange: (e) => setCapital(Number(e.target.value) || 0),
									className: "mt-1"
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-5 grid grid-cols-2 gap-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: mode === "amount" ? "gold" : "ghost",
									onClick: () => setMode("amount"),
									children: "Reach an amount"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: mode === "income" ? "gold" : "ghost",
									onClick: () => setMode("income"),
									children: "Monthly income"
								})]
							}),
							mode === "amount" ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-5 grid gap-4 sm:grid-cols-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									htmlFor: "tgt",
									children: "Target"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: "tgt",
									type: "number",
									min: capital,
									step: 1e3,
									value: target,
									onChange: (e) => setTarget(Number(e.target.value) || 0),
									className: "mt-1"
								})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									htmlFor: "mo",
									children: "Deadline (months)"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: "mo",
									type: "number",
									min: 1,
									max: 60,
									value: months,
									onChange: (e) => setMonths(Number(e.target.value) || 1),
									className: "mt-1"
								})] })]
							}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-5 grid gap-4 sm:grid-cols-2",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									htmlFor: "inc",
									children: "Monthly draw"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: "inc",
									type: "number",
									min: 0,
									step: 50,
									value: income,
									onChange: (e) => setIncome(Number(e.target.value) || 0),
									className: "mt-1"
								})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, {
									htmlFor: "mo2",
									children: "Horizon (months)"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
									id: "mo2",
									type: "number",
									min: 1,
									max: 60,
									value: months,
									onChange: (e) => setMonths(Number(e.target.value) || 1),
									className: "mt-1"
								})] })]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-6 flex justify-end",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "gold",
									onClick: () => setStep(1),
									disabled: capital < 1e3,
									children: "Next"
								})
							})
						]
					}),
					step === 1 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						className: "panel p-6",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
								className: "text-2xl font-medium tracking-tight",
								children: "How do you take weather?"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 text-sm text-mist",
								children: "Three questions. One temperament. Guardrails follow, not slogans."
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-6 space-y-6",
								children: QUESTIONS.map((q, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("fieldset", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("legend", {
									className: "text-sm text-ink",
									children: q.q
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "mt-2 grid gap-2",
									children: q.opts.map((o) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
										type: "button",
										onClick: () => setAnswers((a) => {
											const n = [...a];
											n[i] = o.value;
											return n;
										}),
										className: cn("rounded-lg px-3 py-2.5 text-left text-sm transition-[box-shadow,background-color] duration-150", answers[i] === o.value ? "bg-panel text-ink shadow-tone-signal" : "bg-void/40 text-mist shadow-border hover:text-ink"),
										children: o.label
									}, o.label))
								})] }, q.q))
							}),
							answered && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-6 rounded-lg bg-panel p-4",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "kicker",
									children: ["Guardrails · ", g.label]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
									className: "mt-2 space-y-1 text-sm text-ink",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: ["Max risk per trade ", pct(g.maxRisk * 100, 1).replace("+", "")] }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: ["Drawdown pause at ", pct(g.drawdownPause * 100, 0).replace("+", "")] }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: ["Options ", g.maxOptions === 0 ? "off the book" : `capped at ${Math.round(g.maxOptions * 100)}% of book`] })
									]
								})]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-6 flex justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "ghost",
									onClick: () => setStep(0),
									children: "Back"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "gold",
									disabled: !answered,
									onClick: () => setStep(2),
									children: "See the honest plan"
								})]
							})
						]
					}),
					step === 2 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						className: "panel p-6",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "kicker",
								children: "The honest plan"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-2 flex flex-wrap items-end gap-3",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "hero-num text-gold",
									children: [(odds * 100).toFixed(0), "%"]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-sm text-ink",
									children: verdictCopy(verdict)
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
									className: "text-2xs text-mist",
									children: "Historical estimate, not a promise."
								})] })]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
								className: "mt-3 text-sm text-mist",
								children: [
									"Needs ",
									pct(required * 100, 0),
									" / year to arrive. Our best historical year was ",
									pct(34, 0),
									"."
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-4 h-52 rounded-lg bg-void/50 p-2",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MonteCarloChart, {
									band,
									target: dest,
									start: capital
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-2 flex gap-3 text-2xs text-mist",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "p10–p90 band" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "white = p50" }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
										className: "text-gold",
										children: "gold = destination"
									})
								]
							}),
							verdict === "unrealistic" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-5 rounded-lg bg-coral-dim p-4 shadow-tone-coral",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
										className: "text-sm font-medium text-coral",
										children: "Red path"
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
										className: "mt-2 text-sm text-ink",
										children: [
											mode === "amount" && dest >= capital * 2 && months <= 12 ? `Doubling in ${months} months needs ${pct(required * 100, 0)} / year.` : `This destination needs ${pct(required * 100, 0)} / year.`,
											" ",
											"Our best historical year was ",
											pct(34, 0),
											". Two honest options:"
										]
									}),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "mt-3 grid gap-2 sm:grid-cols-2",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
											variant: "ghost",
											onClick: () => {
												setMonths(36);
											},
											children: ["Extend to 3 years", /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
												className: "text-mist",
												children: [
													"(",
													pct(red.extendRequired * 100, 0),
													" / yr)"
												]
											})]
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
											variant: "ghost",
											onClick: () => {
												setMode("amount");
												setTarget(red.lowerTarget);
											},
											children: [
												"Lower target to ",
												money(red.lowerTarget),
												/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
													className: "text-mist",
													children: "(+20%)"
												})
											]
										})]
									})
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-6 grid gap-2 sm:grid-cols-2",
								children: alloc.map((a) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
									className: "rounded-lg bg-panel p-3",
									children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
										className: "flex items-baseline justify-between",
										children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-sm text-ink",
											children: a.name
										}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
											className: "num text-xs text-mist",
											children: [a.pct, "%"]
										})]
									}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
										className: "mt-1 text-xs text-mist",
										children: a.reason
									})]
								}, a.name))
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
								className: "mt-4 space-y-1 text-xs text-mist",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: ["Max risk per trade ", pct(g.maxRisk * 100, 1).replace("+", "")] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: ["Drawdown pause ", pct(g.drawdownPause * 100, 0).replace("+", "")] }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Every proposal hits a deterministic gate. Rejections are journaled." })
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-6 flex justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "ghost",
									onClick: () => setStep(1),
									children: "Back"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "gold",
									onClick: () => setStep(3),
									children: "Continue"
								})]
							})
						]
					}),
					step === 3 && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
						className: "panel p-6",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
								className: "text-2xl font-medium tracking-tight",
								children: "Paper, not a promise"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
								className: "mt-4 space-y-3 text-sm leading-relaxed text-ink",
								children: [
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "This account is simulated. Fills are paper. Prices are live." }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "AI can propose. The gate can say no. You can still skip or approve what it pauses." }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "Kill switch docks the fleet instantly. Circuit breakers pause new risk." }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: "The journal is append-only. Rejections stay. Failures stay." }),
									/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", { children: [
										"Odds are a historical estimate, not a promise. Best year in the analog set: ",
										pct(34, 0),
										"."
									] })
								]
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "mt-6 rounded-lg bg-panel p-4 text-sm",
								children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
									className: "flex flex-wrap gap-2",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, { children: [money(capital), " paper"] }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
											tone: "gold",
											children: [money(dest), " destination"]
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, { children: [months, " months"] }),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
											tone: "signal",
											children: g.label
										})
									]
								})
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "mt-6 flex justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "ghost",
									onClick: () => setStep(2),
									children: "Back"
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
									variant: "gold",
									size: "lg",
									onClick: () => {
										complete(cfg());
										navigate({ to: "/" });
									},
									children: "Start the voyage"
								})]
							})
						]
					})
				]
			})
		]
	});
}
function OnboardingPage() {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OnboardingWizard, {});
}
//#endregion
export { OnboardingPage as component };
