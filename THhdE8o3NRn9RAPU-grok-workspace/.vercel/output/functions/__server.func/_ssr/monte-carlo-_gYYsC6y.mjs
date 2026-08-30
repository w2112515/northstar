import { O as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
import { f as compactMoney } from "./badge-BrsarOWB.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/monte-carlo-_gYYsC6y.js
var import_jsx_runtime = require_jsx_runtime();
function MonteCarloChart({ band, target, start }) {
	const w = 640;
	const h = 220;
	const pad = {
		l: 48,
		r: 16,
		t: 12,
		b: 28
	};
	const max = Math.max(target * 1.15, ...band.map((b) => b.p90), start);
	const min = Math.min(start * .85, ...band.map((b) => b.p10));
	const span = max - min;
	const months = Math.max(band[band.length - 1]?.month ?? 1, 1);
	const x = (m) => pad.l + m / months * (w - pad.l - pad.r);
	const y = (v) => pad.t + (max - v) / span * (h - pad.t - pad.b);
	const area = `M ${band.map((b) => `${x(b.month)} ${y(b.p90)}`).join(" L ")} L ${band.slice().reverse().map((b) => `${x(b.month)} ${y(b.p10)}`).join(" L ")} Z`;
	const p50 = `M ${band.map((b) => `${x(b.month)} ${y(b.p50)}`).join(" L ")}`;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		viewBox: `0 0 ${w} ${h}`,
		className: "h-full w-full",
		role: "img",
		"aria-label": "Monte Carlo p10 p50 p90 band",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
				x1: pad.l,
				x2: w - pad.r,
				y1: y(target),
				y2: y(target),
				stroke: "#F5C542",
				strokeDasharray: "4 4",
				strokeWidth: "1"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("text", {
				x: w - pad.r,
				y: y(target) - 6,
				textAnchor: "end",
				fill: "#F5C542",
				fontSize: "10",
				fontFamily: "IBM Plex Mono, monospace",
				children: ["target ", compactMoney(target)]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
				d: area,
				fill: "#5B8DEF",
				opacity: "0.16"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
				d: p50,
				fill: "none",
				stroke: "#E7EEF9",
				strokeWidth: "1.6"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
				x: pad.l - 6,
				y: y(max) + 4,
				textAnchor: "end",
				fill: "#A2B3D1",
				fontSize: "9",
				fontFamily: "IBM Plex Mono, monospace",
				children: compactMoney(max)
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
				x: pad.l - 6,
				y: y(min),
				textAnchor: "end",
				fill: "#A2B3D1",
				fontSize: "9",
				fontFamily: "IBM Plex Mono, monospace",
				children: compactMoney(min)
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
				x: pad.l,
				y: 212,
				fill: "#A2B3D1",
				fontSize: "9",
				children: "now"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("text", {
				x: w - pad.r,
				y: 212,
				textAnchor: "end",
				fill: "#A2B3D1",
				fontSize: "9",
				children: [months, " mo"]
			})
		]
	});
}
//#endregion
export { MonteCarloChart as t };
