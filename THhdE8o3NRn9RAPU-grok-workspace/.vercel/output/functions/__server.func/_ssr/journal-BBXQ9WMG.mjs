import { i as __toESM } from "../_runtime.mjs";
import { u as require_react } from "../_libs/@floating-ui/react-dom+[...].mjs";
import { O as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { O as useVoyage, _ as formatNyTime, m as dayKey, p as dayHeading, t as Badge } from "./badge-BrsarOWB.mjs";
import { a as cn } from "./router-Byr47Ah9.mjs";
import { t as AppShell } from "./app-shell-CO_K8nda.mjs";
import { t as Input } from "./input-D-VrT6eX.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/journal-BBXQ9WMG.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var KINDS = [
	"proposal",
	"verdict",
	"order",
	"fill",
	"pnl",
	"approval",
	"debate",
	"digest",
	"scout",
	"forecast",
	"experiment",
	"trace",
	"system"
];
var TONE = {
	proposal: "amber",
	verdict: "coral",
	fill: "teal",
	approval: "gold",
	forecast: "signal",
	debate: "gold",
	order: "signal",
	pnl: "teal",
	experiment: "mist",
	digest: "gold"
};
function JournalPage() {
	const journal = useVoyage((s) => s.journal);
	const [kind, setKind] = (0, import_react.useState)("all");
	const [q, setQ] = (0, import_react.useState)("");
	const [open, setOpen] = (0, import_react.useState)(null);
	const filtered = (0, import_react.useMemo)(() => {
		const needle = q.trim().toLowerCase();
		return journal.filter((e) => {
			if (kind !== "all" && e.kind !== kind) return false;
			if (!needle) return true;
			return e.title.toLowerCase().includes(needle) || e.body.toLowerCase().includes(needle) || e.kind.includes(needle);
		});
	}, [
		journal,
		kind,
		q
	]);
	const groups = (0, import_react.useMemo)(() => {
		const map = /* @__PURE__ */ new Map();
		for (const e of filtered) {
			const k = dayKey(e.ts);
			const arr = map.get(k) ?? [];
			arr.push(e);
			map.set(k, arr);
		}
		return [...map.entries()];
	}, [filtered]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppShell, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mb-3",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
				value: q,
				onChange: (e) => setQ(e.target.value),
				placeholder: "Search the log",
				"aria-label": "Search the log"
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "mb-5 flex flex-wrap gap-1.5",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilterChip, {
				active: kind === "all",
				onClick: () => setKind("all"),
				children: "all"
			}), KINDS.map((k) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(FilterChip, {
				active: kind === k,
				onClick: () => setKind(k),
				children: k
			}, k))]
		}),
		groups.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
			className: "panel px-5 py-12 text-center",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "kicker",
				children: "Day one"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mx-auto mt-3 max-w-md text-sm text-mist",
				children: "Nothing in the log yet besides what you just filtered out — or the book is cash and waiting for the open. Run a pass from the helm. Every proposal, verdict, and no from the gate will land here in plain English."
			})]
		}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex flex-col gap-6",
			children: groups.map(([k, rows]) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "sticky top-14 z-10 mb-2 bg-void/90 py-1.5 backdrop-blur-sm",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "text-sm font-medium text-ink",
					children: dayHeading(rows[0].ts)
				})
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "flex flex-col gap-2",
				children: rows.map((e) => {
					const expanded = open === e.id;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
						className: "panel overflow-hidden",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							className: "flex w-full items-start gap-3 px-4 py-3 text-left",
							onClick: () => setOpen(expanded ? null : e.id),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "num mt-0.5 w-16 shrink-0 text-2xs text-mist",
								children: formatNyTime(e.ts)
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "min-w-0 flex-1",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "flex flex-wrap items-center gap-2",
									children: [
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
											tone: TONE[e.kind] ?? "mist",
											children: e.kind
										}),
										e.aiNarrated && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
											tone: "gold",
											children: "AI"
										}),
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "text-sm text-ink",
											children: e.title
										})
									]
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "mt-1 block text-xs leading-relaxed text-mist",
									children: e.body
								})]
							})]
						}), expanded && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "border-t border-line bg-void/40 px-4 py-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
								className: "kicker",
								children: "Raw + lineage"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
								className: "mt-2 overflow-x-auto text-2xs leading-relaxed text-mist",
								children: JSON.stringify({
									refs: e.refs,
									raw: e.raw,
									id: e.id,
									ts: e.ts
								}, null, 2)
							})]
						})]
					}, e.id);
				})
			})] }, k))
		})
	] });
}
function FilterChip({ active, onClick, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		onClick,
		className: cn("h-9 rounded-full px-3 text-xs transition-[color,background-color,box-shadow] duration-150 shadow-border", active ? "bg-panel text-ink" : "bg-night text-mist hover:text-ink"),
		children
	});
}
//#endregion
export { JournalPage as component };
