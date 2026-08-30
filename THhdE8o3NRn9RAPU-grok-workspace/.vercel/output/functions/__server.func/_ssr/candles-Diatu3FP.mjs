import { O as require_jsx_runtime } from "../_libs/@radix-ui/react-alert-dialog+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/candles-Diatu3FP.js
var import_jsx_runtime = require_jsx_runtime();
function CandleChart({ candles, forecast, height = 220 }) {
	const padL = 36;
	const padT = 12;
	const padB = 22;
	const w = 560;
	const h = height;
	const histN = candles.length;
	const n = histN + forecast.length;
	const allLows = [...candles.map((c) => c.l), ...forecast.map((f) => f.lo)];
	const allHighs = [...candles.map((c) => c.h), ...forecast.map((f) => f.hi)];
	const min = Math.min(...allLows);
	const max = Math.max(...allHighs);
	const span = Math.max(max - min, 1);
	const plotW = 512;
	const plotH = h - padT - padB;
	const x = (i) => padL + (i + .5) / n * plotW;
	const y = (v) => padT + (max - v) / span * plotH;
	const cw = Math.max(3, plotW / n * .55);
	const last = candles[candles.length - 1];
	const fan = last ? [{
		x: x(histN - 1),
		mid: last.c,
		lo: last.c,
		hi: last.c
	}, ...forecast.map((f, i) => ({
		x: x(histN + i),
		...f
	}))] : [];
	const hiPath = fan.length ? `M ${fan.map((p) => `${p.x} ${y(p.hi)}`).join(" L ")} L ${fan.slice().reverse().map((p) => `${p.x} ${y(p.lo)}`).join(" L ")} Z` : "";
	const midPath = fan.length ? `M ${fan.map((p) => `${p.x} ${y(p.mid)}`).join(" L ")}` : "";
	const ticks = 4;
	const yTicks = Array.from({ length: 5 }, (_, i) => min + span * i / ticks);
	const xLabels = [
		0,
		Math.floor(histN / 3),
		Math.floor(2 * histN / 3),
		histN - 1
	].filter((i, idx, arr) => candles[i] && arr.indexOf(i) === idx).map((i) => {
		const d = new Date(candles[i].t);
		return {
			i,
			label: `${d.getMonth() + 1}/${d.getDate()}`
		};
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		viewBox: `0 0 ${w} ${h}`,
		className: "h-full w-full",
		role: "img",
		"aria-label": "Price candles with five-day forecast band",
		children: [
			yTicks.map((v) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
				x1: padL,
				x2: 548,
				y1: y(v),
				y2: y(v),
				stroke: "#24334F",
				strokeWidth: "1"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
				x: 30,
				y: y(v) + 3,
				textAnchor: "end",
				fill: "#A2B3D1",
				fontSize: "9",
				fontFamily: "IBM Plex Mono, monospace",
				children: v.toFixed(0)
			})] }, v)),
			hiPath && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
				d: hiPath,
				fill: "#5B8DEF",
				opacity: "0.12"
			}),
			midPath && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
				d: midPath,
				fill: "none",
				stroke: "#5B8DEF",
				strokeWidth: "1.2",
				strokeDasharray: "4 4"
			}),
			candles.map((c, i) => {
				const color = c.c >= c.o ? "#35D0BA" : "#FF6B6B";
				const cx = x(i);
				return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("g", { children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("line", {
						x1: cx,
						x2: cx,
						y1: y(c.h),
						y2: y(c.l),
						stroke: color,
						strokeWidth: "1"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("rect", {
						x: cx - cw / 2,
						y: y(Math.max(c.o, c.c)),
						width: cw,
						height: Math.max(1, Math.abs(y(c.o) - y(c.c))),
						fill: color,
						rx: "0.5"
					}),
					c.fill && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("polygon", {
						points: c.fill === "buy" ? `${cx},${y(c.l) + 8} ${cx - 4},${y(c.l) + 2} ${cx + 4},${y(c.l) + 2}` : `${cx},${y(c.h) - 8} ${cx - 4},${y(c.h) - 2} ${cx + 4},${y(c.h) - 2}`,
						fill: c.fill === "buy" ? "#35D0BA" : "#FF6B6B"
					})
				] }, c.t);
			}),
			xLabels.map(({ i, label }) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("text", {
				x: x(i),
				y: h - 6,
				textAnchor: "middle",
				fill: "#A2B3D1",
				fontSize: "9",
				fontFamily: "IBM Plex Mono, monospace",
				children: label
			}, i))
		]
	});
}
//#endregion
export { CandleChart as t };
