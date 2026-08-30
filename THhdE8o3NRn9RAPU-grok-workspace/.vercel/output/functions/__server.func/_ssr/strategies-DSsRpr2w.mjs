import { O as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { O as useVoyage, n as Button, t as Badge } from "./badge-BrsarOWB.mjs";
import { a as cn } from "./router-Byr47Ah9.mjs";
import { t as AppShell } from "./app-shell-CO_K8nda.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/strategies-DSsRpr2w.js
var import_jsx_runtime = require_jsx_runtime();
function StrategiesPage() {
	const strategies = useVoyage((s) => s.strategies);
	const instances = useVoyage((s) => s.instances);
	const toggle = useVoyage((s) => s.toggleStrategy);
	const names = Object.fromEntries(strategies.map((s) => [s.id, s.name]));
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppShell, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "grid gap-3 sm:grid-cols-2 xl:grid-cols-3",
			children: strategies.map((s) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
				className: cn("panel flex flex-col p-4", s.status === "coming" && "opacity-55", s.status === "sailing" && "shadow-tone-teal", s.status === "champion" && "shadow-tone-gold"),
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "flex items-start justify-between gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
							className: "text-sm font-medium text-ink",
							children: s.name
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(StatusPill, { status: s.status })]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 flex-1 text-sm text-mist",
						children: s.sentence
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-3 flex items-center justify-between",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Badge, {
								tone: s.risk === "low" ? "teal" : s.risk === "high" ? "coral" : "mist",
								children: [s.risk, " risk"]
							}),
							s.status !== "coming" && s.status !== "champion" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								size: "sm",
								variant: s.status === "sailing" ? "ghost" : "teal",
								onClick: () => toggle(s.id),
								children: s.status === "sailing" ? "Dock" : "Set sail"
							}),
							s.status === "champion" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-2xs text-gold",
								children: "Locked as champion"
							})
						]
					})
				]
			}, s.id))
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-6 mb-2 kicker",
			children: "Running instances"
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("section", {
			className: "panel overflow-x-auto p-4",
			children: instances.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-mist",
				children: "None running. First-day books start with an empty fleet until you set sail."
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("table", {
				className: "w-full min-w-xl text-left text-sm",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("thead", {
					className: "text-xs text-mist",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
						className: "border-b border-line",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "pb-2 font-medium",
								children: "Family"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "pb-2 font-medium",
								children: "Version"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "pb-2 font-medium",
								children: "Status"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("th", {
								className: "pb-2 font-medium",
								children: "Params"
							})
						]
					})
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("tbody", { children: instances.map((i) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("tr", {
					className: "border-b border-line/60",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("td", {
							className: "py-2.5 pr-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-ink",
								children: names[i.strategyId] ?? i.family
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "text-2xs text-mist",
								children: i.family
							})]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "num py-2.5 pr-3 text-mist",
							children: i.version
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "py-2.5 pr-3",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
								tone: i.status === "running" ? "teal" : "mist",
								children: i.status
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("td", {
							className: "py-2.5 text-xs text-mist",
							children: i.params
						})
					]
				}, i.id)) })]
			})
		})
	] });
}
function StatusPill({ status }) {
	if (status === "sailing") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
		tone: "teal",
		children: "sailing"
	});
	if (status === "champion") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
		tone: "gold",
		children: "champion"
	});
	if (status === "coming") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, { children: "coming soon" });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, { children: "docked" });
}
//#endregion
export { StrategiesPage as component };
