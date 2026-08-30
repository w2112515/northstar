import { r as buildCandles } from "./seed-D7NXUXBT.mjs";
import { n as TSS_SERVER_FUNCTION, t as createServerFn } from "./ssr.mjs";
import { t as UNIVERSE_UNIQ } from "./universe-BwxzbG3s.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/tape-D-U-j-xi.js
var createServerRpc = (serverFnMeta, splitImportFn) => {
	const url = "/_serverFn/" + serverFnMeta.id;
	return Object.assign(splitImportFn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var YAHOO_UA = "Mozilla/5.0 (compatible; NorthStar/1.0; paper-trading copilot)";
function yahooSymbol(raw) {
	return raw.trim().toUpperCase().replace(/\./g, "-");
}
function displaySymbol(yahoo) {
	return yahoo.replace(/-/g, ".");
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
async function yahooJson(url) {
	const res = await fetch(url, {
		headers: {
			"User-Agent": YAHOO_UA,
			Accept: "application/json"
		},
		signal: AbortSignal.timeout(8e3)
	});
	if (!res.ok) throw new Error(`tape ${res.status}`);
	return res.json();
}
function mergeHits(local, remote, limit) {
	const seen = /* @__PURE__ */ new Set();
	const out = [];
	for (const hit of [...local, ...remote]) {
		const key = hit.symbol.toUpperCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(hit);
		if (out.length >= limit) break;
	}
	return out;
}
var searchTape_createServerFn_handler = createServerRpc({
	id: "ea85f041eb176546f6570a7449242accf0013febf7c88a0ff0346777b9014cff",
	name: "searchTape",
	filename: "src/lib/tape.ts"
}, (opts) => searchTape.__executeServer(opts));
var searchTape = createServerFn({ method: "GET" }).validator((d) => {
	return { q: (typeof d === "object" && d && "q" in d ? String(d.q) : "").trim().slice(0, 40) };
}).handler(searchTape_createServerFn_handler, async ({ data }) => {
	const q = data.q;
	const local = searchUniverse(q, 8);
	if (q.length < 1) return local;
	try {
		return mergeHits(local, ((await yahooJson(`https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=12&newsCount=0&listsCount=0`)).quotes ?? []).filter((row) => {
			const kind = (row.quoteType ?? row.typeDisp ?? "").toUpperCase();
			if (kind !== "EQUITY" && kind !== "ETF" && kind !== "INDEX") return false;
			const disp = displaySymbol(row.symbol ?? "");
			if (!disp) return false;
			if (disp.includes(".") && !/^[A-Z]{1,5}\.[A-Z]$/.test(disp)) return false;
			const ex = `${row.exchDisp ?? ""} ${row.exchange ?? ""}`;
			if (ex.trim() && !/NASDAQ|NYSE|NYQ|NMS|NGM|PCX|ASE|Cboe|ARCA|NYSEArca|BTS/i.test(ex)) return false;
			return true;
		}).map((row) => ({
			symbol: displaySymbol(row.symbol ?? ""),
			name: row.shortname || row.longname || row.symbol || "",
			type: row.typeDisp || row.quoteType || "",
			exchange: row.exchDisp || row.exchange || ""
		})).filter((row) => row.symbol), 12);
	} catch {
		return local;
	}
});
var loadTape_createServerFn_handler = createServerRpc({
	id: "5bf034e4641cedd73c6ce3c521b09db21af945d1c206af139e07ffc2eb9b655c",
	name: "loadTape",
	filename: "src/lib/tape.ts"
}, (opts) => loadTape.__executeServer(opts));
var loadTape = createServerFn({ method: "GET" }).validator((d) => {
	return { symbol: yahooSymbol(typeof d === "object" && d && "symbol" in d ? String(d.symbol) : "").slice(0, 16) };
}).handler(loadTape_createServerFn_handler, async ({ data }) => {
	const symbol = data.symbol;
	if (!symbol) return syntheticQuote("SPY");
	try {
		const result = (await yahooJson(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=3mo`)).chart?.result?.[0];
		const quote = result?.indicators?.quote?.[0];
		const ts = result?.timestamp ?? [];
		if (!result || !quote || ts.length < 8) throw new Error("empty tape");
		const candles = [];
		for (let i = 0; i < ts.length; i++) {
			const o = quote.open?.[i];
			const h = quote.high?.[i];
			const l = quote.low?.[i];
			const c = quote.close?.[i];
			if (o == null || h == null || l == null || c == null) continue;
			candles.push({
				t: (/* @__PURE__ */ new Date(ts[i] * 1e3)).toISOString(),
				o,
				h,
				l,
				c
			});
		}
		if (candles.length < 8) throw new Error("thin tape");
		const last = result.meta?.regularMarketPrice ?? candles[candles.length - 1].c;
		const prev = result.meta?.chartPreviousClose ?? result.meta?.previousClose ?? candles[Math.max(0, candles.length - 2)].c;
		candles[candles.length - 1].c = last;
		candles[candles.length - 1].h = Math.max(candles[candles.length - 1].h, last);
		candles[candles.length - 1].l = Math.min(candles[candles.length - 1].l, last);
		return {
			symbol: displaySymbol(result.meta?.symbol ?? symbol),
			name: result.meta?.shortName || result.meta?.longName || displaySymbol(symbol),
			last,
			prev,
			change: prev ? (last - prev) / prev : 0,
			candles,
			live: true
		};
	} catch {
		return syntheticQuote(displaySymbol(symbol));
	}
});
//#endregion
export { loadTape_createServerFn_handler, searchTape_createServerFn_handler };
