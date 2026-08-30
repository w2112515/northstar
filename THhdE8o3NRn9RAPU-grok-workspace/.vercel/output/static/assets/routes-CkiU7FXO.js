import{n as e}from"./rolldown-runtime-CbXtAM7H.js";import{o as t,s as n,t as r}from"./cn-jTTeq6jU.js";import{b as i,n as a,v as o,x as s,y as c}from"./dist-3stWVxZs.js";import{a as l,c as u,d,f,i as p,l as m,n as h,o as g,r as _,s as v,t as y,u as b}from"./app-shell-BlJfz5Nj.js";import{a as x,i as S,n as ee,r as te,t as C}from"./index-DLI00WiZ.js";import{A as ne,E as w,F as re,O as T,_ as ie,b as E,c as ae,g as oe,h as D,i as O,j as se,t as k,v as A,w as j,y as M}from"./badge-DGkt98GN.js";import{t as ce}from"./candles-DstTdow1.js";function N(e){if(Array.isArray(e))return e.flatMap(e=>N(e));if(typeof e!=`string`)return[];let t=[],n=0,r,i,a,o,s,c=()=>{for(;n<e.length&&/\s/.test(e.charAt(n));)n+=1;return n<e.length},l=()=>(i=e.charAt(n),i!==`=`&&i!==`;`&&i!==`,`);for(;n<e.length;){for(r=n,s=!1;c();)if(i=e.charAt(n),i===`,`){for(a=n,n+=1,c(),o=n;n<e.length&&l();)n+=1;n<e.length&&e.charAt(n)===`=`?(s=!0,n=o,t.push(e.slice(r,a)),r=n):n=a+1}else n+=1;(!s||n>=e.length)&&t.push(e.slice(r))}return t}function le(e){return e instanceof Headers?e:Array.isArray(e)||typeof e==`object`?new Headers(e):null}function ue(...e){return e.reduce((e,t)=>{let n=le(t);if(!n)return e;for(let[t,r]of n.entries())t===`set-cookie`?N(r).forEach(t=>e.append(`set-cookie`,t)):e.set(t,r);return e},new Headers)}var de=s(`search`,[[`path`,{d:`m21 21-4.34-4.34`,key:`14j7rj`}],[`circle`,{cx:`11`,cy:`11`,r:`8`,key:`4ej97u`}]]),P=e(n(),1),F=t();function fe({start:e,equity:t,target:n,odds:r}){let i=M((t-e)/Math.max(n-e,1),0,1),a=t>n,o=(0,P.useMemo)(()=>({w:800,h:280,d:`M 48 236 Q 300 24 748 58`,pointAt:e=>{let t=1-e;return{x:t*t*48+2*t*e*300+e*e*748,y:t*t*236+2*t*e*24+e*e*58}},x0:48,y0:236,x1:748,y1:58}),[]),s=o.pointAt(a?1:i),c=(0,P.useMemo)(()=>[[40,40,.5,2.1],[90,90,.7,3.4],[140,30,.4,1.8],[200,110,.55,4.2],[260,70,.35,2.6],[320,150,.6,3.1],[380,40,.45,1.4],[440,120,.7,2.9],[500,60,.3,4.6],[560,170,.5,2.2],[620,90,.65,3.7],[680,200,.4,1.6],[720,130,.55,2.4],[80,200,.35,3.3],[180,180,.5,4.8],[300,220,.3,2.7],[410,210,.45,1.9],[540,230,.6,3.5],[650,250,.4,2],[760,90,.7,4.1]],[]);return(0,F.jsx)(`div`,{className:`relative h-full min-h-52 overflow-hidden rounded-xl starfield`,children:(0,F.jsxs)(`svg`,{viewBox:`0 0 ${o.w} ${o.h}`,className:`h-auto w-full`,preserveAspectRatio:`xMidYMid meet`,role:`img`,"aria-label":`Goal orbit. Equity ${E(t)} of ${E(n)}. Odds ${(r*100).toFixed(0)} percent.`,children:[(0,F.jsxs)(`defs`,{children:[(0,F.jsxs)(`linearGradient`,{id:`orbit-gold`,x1:`0`,y1:`1`,x2:`1`,y2:`0`,children:[(0,F.jsx)(`stop`,{offset:`0%`,stopColor:`#35D0BA`}),(0,F.jsx)(`stop`,{offset:`55%`,stopColor:`#F5C542`}),(0,F.jsx)(`stop`,{offset:`100%`,stopColor:`#F5C542`})]}),(0,F.jsxs)(`filter`,{id:`orbit-glow`,x:`-40%`,y:`-40%`,width:`180%`,height:`180%`,children:[(0,F.jsx)(`feGaussianBlur`,{stdDeviation:`3.5`,result:`b`}),(0,F.jsxs)(`feMerge`,{children:[(0,F.jsx)(`feMergeNode`,{in:`b`}),(0,F.jsx)(`feMergeNode`,{in:`SourceGraphic`})]})]}),(0,F.jsxs)(`filter`,{id:`star-glow`,x:`-80%`,y:`-80%`,width:`260%`,height:`260%`,children:[(0,F.jsx)(`feGaussianBlur`,{stdDeviation:`2.2`,result:`b`}),(0,F.jsxs)(`feMerge`,{children:[(0,F.jsx)(`feMergeNode`,{in:`b`}),(0,F.jsx)(`feMergeNode`,{in:`SourceGraphic`})]})]})]}),[[60,80,180,40],[180,40,320,90],[320,90,480,30],[120,160,260,100],[260,100,420,140],[420,140,600,80],[200,220,360,180],[360,180,540,160],[540,160,700,100]].map(([e,t,n,r],i)=>(0,F.jsx)(`line`,{x1:e,y1:t,x2:n,y2:r,stroke:`#24334F`,strokeWidth:`0.6`,opacity:`0.55`},i)),c.map(([e,t,n,r],i)=>(0,F.jsx)(`circle`,{cx:e,cy:t,r:n,fill:`#E7EEF9`,className:`motion-safe:animate-twinkle`,style:{animationDelay:`${r}s`,animationDuration:`${2.8+i%5*.4}s`}},i)),(0,F.jsx)(`path`,{d:o.d,fill:`none`,stroke:`#24334F`,strokeWidth:`2`,strokeLinecap:`round`}),(0,F.jsx)(`path`,{d:o.d,fill:`none`,stroke:`#F5C542`,strokeWidth:`1.4`,strokeLinecap:`round`,strokeDasharray:`5 7`,opacity:`0.7`,className:`motion-safe:animate-orbit-dash`,pathLength:100}),(0,F.jsx)(`path`,{d:o.d,fill:`none`,stroke:`url(#orbit-gold)`,strokeWidth:`2.4`,strokeLinecap:`round`,filter:`url(#orbit-glow)`,pathLength:100,strokeDasharray:`${i*100} 100`}),(0,F.jsx)(`circle`,{cx:o.x0,cy:o.y0,r:`4.5`,fill:`#A2B3D1`}),(0,F.jsx)(`text`,{x:o.x0+12,y:o.y0+5,fill:`#A2B3D1`,fontSize:`11`,fontFamily:`IBM Plex Mono, monospace`,children:E(e)}),(0,F.jsxs)(`g`,{transform:`translate(${s.x}, ${s.y})`,children:[(0,F.jsx)(`circle`,{r:`10`,fill:`#F5C542`,opacity:`0.18`,className:`motion-safe:animate-breathe`}),(0,F.jsx)(`circle`,{r:`4.2`,fill:`#F5C542`}),(0,F.jsx)(`circle`,{r:`1.6`,fill:`#0B1220`})]}),(0,F.jsx)(`text`,{x:s.x+12,y:s.y-10,fill:`#F5C542`,fontSize:`11`,fontFamily:`IBM Plex Mono, monospace`,children:E(t)}),(0,F.jsxs)(`g`,{transform:`translate(${o.x1}, ${o.y1})`,filter:`url(#star-glow)`,children:[(0,F.jsx)(`path`,{d:`M0 -14 L2.2 -2.4 L14 0 L2.2 2.4 L0 14 L-2.2 2.4 L-14 0 L-2.2 -2.4 Z`,fill:`#F5C542`}),(0,F.jsx)(`circle`,{r:`2`,fill:`#0B1220`})]}),(0,F.jsx)(`text`,{x:o.x1-86,y:o.y1+28,fill:`#F5C542`,fontSize:`11`,fontFamily:`IBM Plex Mono, monospace`,children:E(n)})]})})}function pe(){let e=A(e=>e.voyage),t=A(e=>e.cash),n=A(e=>e.positions),r=A(e=>e.oddsOverride),i=D(t,n),a=d(e.startedAt,e.deadlineMonths),o=r??ae(e.startingCapital,f(e),a,e.temperament),s=f(e);return(0,F.jsxs)(`section`,{className:`panel grid min-w-0 overflow-hidden lg:grid-cols-[minmax(15rem,0.3fr)_1fr]`,children:[(0,F.jsxs)(`div`,{className:`flex flex-col justify-between gap-5 p-5`,children:[(0,F.jsxs)(`div`,{children:[(0,F.jsx)(`div`,{className:`kicker`,children:`Destination`}),(0,F.jsx)(`div`,{className:`mt-1.5 text-lg font-medium tracking-tight text-ink`,children:w(s)}),(0,F.jsxs)(`p`,{className:`mt-1 text-2xs leading-relaxed text-mist`,children:[w(e.startingCapital),` → `,e.deadlineMonths,` months. Paper book.`]})]}),(0,F.jsx)(me,{className:`border-t border-line pt-3`})]}),(0,F.jsx)(`div`,{className:`min-h-48 min-w-0 overflow-hidden p-2 lg:min-h-72`,children:(0,F.jsx)(fe,{start:e.startingCapital,equity:i,target:s,odds:o})})]})}function me({className:e}){let t=A(e=>e.log);return(0,F.jsxs)(`div`,{className:e,children:[(0,F.jsxs)(`div`,{className:`flex items-center gap-2`,children:[(0,F.jsx)(`span`,{className:`kicker`,children:`Log`}),t.aiNarrated?(0,F.jsx)(k,{tone:`gold`,children:`fleet`}):(0,F.jsx)(k,{children:`system`}),(0,F.jsx)(`span`,{className:`num ml-auto text-micro text-mist`,children:j(t.ts)})]}),(0,F.jsx)(`p`,{className:`mt-1 line-clamp-4 text-2xs leading-relaxed text-mist`,children:t.sentences.join(` `)})]})}function he(){let e=A(e=>e.proposals),t=A(e=>e.approveProposal),n=A(e=>e.skipProposal),r=A(e=>e.killSwitch);return e.length===0?null:(0,F.jsxs)(`section`,{children:[(0,F.jsxs)(`div`,{className:`mb-1.5 flex items-center gap-2`,children:[(0,F.jsx)(`span`,{className:`kicker`,children:`Waiting on you`}),(0,F.jsxs)(k,{tone:`amber`,children:[e.length,` paused`]})]}),(0,F.jsx)(`ul`,{className:`flex flex-col gap-1.5`,children:e.map(e=>(0,F.jsxs)(`li`,{className:`flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1.5 rounded-lg bg-night px-3 py-2 shadow-tone-amber`,children:[(0,F.jsxs)(`div`,{className:`min-w-0 flex-1`,children:[(0,F.jsxs)(`div`,{className:`text-sm text-ink`,children:[e.side===`buy`?`Buy`:`Sell`,` `,e.qty,` `,e.humanName]}),(0,F.jsx)(`div`,{className:`truncate text-2xs text-amber`,children:e.pausedWhy})]}),(0,F.jsxs)(`span`,{className:`num text-xs text-coral`,children:[`−`,w(e.worstCase)]}),(0,F.jsxs)(`div`,{className:`flex gap-1.5`,children:[(0,F.jsx)(O,{size:`sm`,variant:`ghost`,className:`min-h-11 md:min-h-9`,onClick:()=>{n(e.id),a(`Skipped. Radar keeps the name.`)},children:`Skip`}),(0,F.jsx)(O,{size:`sm`,variant:`teal`,className:`min-h-11 min-w-20 md:min-h-9`,disabled:r,onClick:()=>{t(e.id),a(`Approved. Queued until the open.`)},children:`Approve`})]})]},e.id))})]})}function I(e){return e!==`__proto__`&&e!==`constructor`&&e!==`prototype`}function L(e,t){let n=Object.create(null);if(e)for(let t of Object.keys(e))I(t)&&(n[t]=e[t]);if(t&&typeof t==`object`)for(let e of Object.keys(t))I(e)&&(n[e]=t[e]);return n}function R(e){if(!e)return Object.create(null);let t=Object.create(null);for(let n of Object.keys(e))I(n)&&(t[n]=e[n]);return t}var z=()=>{throw Error(`createServerOnlyFn() functions can only be called on the server!`)},B=(e,t)=>{let n=t||e||{};n.method===void 0&&(n.method=`GET`);let r=e=>B(void 0,{...n,validator:e,inputValidator:e});return Object.assign(e=>B(void 0,{...n,...e}),{options:n,middleware:e=>{let t=[...n.middleware||[]];e.map(e=>{x in e?e.options.middleware&&t.push(...e.options.middleware):t.push(e)});let r=B(void 0,{...n,middleware:t});return r[x]=!0,r},validator:r,inputValidator:r,handler:(...e)=>{let[t,r]=e,i={...n,extractedFn:t,serverFn:r},a=[...i.middleware||[],ve(i)];return t.method=n.method,Object.assign(async e=>{let n=await V(a,`client`,{...t,...i,data:e?.data,headers:e?.headers,signal:e?.signal,fetch:e?.fetch,context:R()}),r=te(n.error);if(r)throw r;if(n.error)throw n.error;return n.result},{...t,method:n.method,__executeServer:async e=>{let n=z(),r=n.contextAfterGlobalMiddlewares;return await V(a,`server`,{...t,...e,serverFnMeta:t.serverFnMeta,context:L(e.context,r),request:n.request}).then(e=>({result:e.result,error:e.error,context:e.sendContext}))}})}})};async function V(e,t,n){let r=ge([...S()?.functionMiddleware||[],...e]);if(t===`server`){let e=z({throwIfNotFound:!1});e?.executedRequestMiddlewares&&(r=r.filter(t=>!e.executedRequestMiddlewares.has(t)))}let i=async e=>{let n=r.shift();if(!n)return e;try{let r=`validator`in n.options?n.options.validator:void 0;!r&&`inputValidator`in n.options&&(r=n.options.inputValidator),r&&t===`server`&&(e.data=await _e(r,e.data));let a;if(t===`client`?`client`in n.options&&(a=n.options.client):`server`in n.options&&(a=n.options.server),a){let t=async(t={})=>{let n=await i({...e,...t,context:L(e.context,t.context),sendContext:L(e.sendContext,t.sendContext),headers:ue(e.headers,t.headers),_callSiteFetch:e._callSiteFetch,fetch:e._callSiteFetch??t.fetch??e.fetch,result:t.result===void 0?t instanceof Response?t:e.result:t.result,error:t.error??e.error});if(n.error)throw n.error;return n},n=await a({...e,next:t});if(ee(n))return{...e,error:n};if(n instanceof Response)return{...e,result:n};if(!n)throw Error(`User middleware returned undefined. You must call next() or return a result in your middlewares.`);return n}return i(e)}catch(t){return{...e,error:t}}};return i({...n,headers:n.headers||{},sendContext:n.sendContext||{},context:n.context||R(),_callSiteFetch:n.fetch})}function ge(e,t=100){let n=new Set,r=[],i=(e,a)=>{if(a>t)throw Error(`Middleware nesting depth exceeded maximum of ${t}. Check for circular references.`);e.forEach(e=>{e.options.middleware&&i(e.options.middleware,a+1),n.has(e)||(n.add(e),r.push(e))})};return i(e,0),r}async function _e(e,t){if(e==null)return{};if(`~standard`in e){let n=await e[`~standard`].validate(t);if(n.issues)throw Error(JSON.stringify(n.issues,void 0,2));return n.value}if(`parse`in e)return e.parse(t);if(typeof e==`function`)return e(t);throw Error(`Invalid validator type!`)}function ve(e){return{"~types":void 0,options:{inputValidator:e.validator??e.inputValidator,client:async({next:t,sendContext:n,fetch:r,...i})=>{let a={...i,context:n,fetch:r};return t(await e.extractedFn?.(a))},server:async({next:t,...n})=>{let r=await e.serverFn?.(n);return t({...n,result:r})}}}}var ye=`SPY	SPDR S&P 500
QQQ	Invesco QQQ
IWM	iShares Russell 2000
DIA	SPDR Dow Jones
VOO	Vanguard S&P 500
VTI	Vanguard Total Stock
TLT	iShares 20+ Year Treasury
GLD	SPDR Gold
SLV	iShares Silver
HYG	iShares High Yield
LQD	iShares IG Corporate
EEM	iShares Emerging Markets
EFA	iShares EAFE
XLE	Energy Select
XLF	Financial Select
XLK	Technology Select
XLV	Health Care Select
XLI	Industrial Select
XLY	Consumer Discretionary
XLP	Consumer Staples
XLU	Utilities Select
XLB	Materials Select
XLRE	Real Estate Select
SMH	VanEck Semiconductor
SOXX	iShares Semiconductor
ARKK	ARK Innovation
IBIT	iShares Bitcoin
IYR	iShares US Real Estate
UNG	US Natural Gas
USO	US Oil
AAPL	Apple
MSFT	Microsoft
NVDA	NVIDIA
AMZN	Amazon
GOOGL	Alphabet Class A
GOOG	Alphabet Class C
META	Meta Platforms
TSLA	Tesla
AVGO	Broadcom
BRK.B	Berkshire Hathaway B
BRK.A	Berkshire Hathaway A
JPM	JPMorgan Chase
V	Visa
MA	Mastercard
UNH	UnitedHealth
XOM	Exxon Mobil
LLY	Eli Lilly
JNJ	Johnson & Johnson
WMT	Walmart
PG	Procter & Gamble
HD	Home Depot
COST	Costco
ORCL	Oracle
NFLX	Netflix
AMD	Advanced Micro Devices
CRM	Salesforce
CSCO	Cisco
KO	Coca-Cola
PEP	PepsiCo
ABBV	AbbVie
BAC	Bank of America
MRK	Merck
CVX	Chevron
ADBE	Adobe
TMO	Thermo Fisher
ACN	Accenture
LIN	Linde
MCD	McDonald's
ABT	Abbott
GE	GE Aerospace
CAT	Caterpillar
NOW	ServiceNow
DHR	Danaher
ISRG	Intuitive Surgical
AMAT	Applied Materials
TXN	Texas Instruments
INTU	Intuit
QCOM	Qualcomm
AMGN	Amgen
HON	Honeywell
UNP	Union Pacific
RTX	RTX
SPGI	S&P Global
PGR	Progressive
BKNG	Booking
BLK	BlackRock
SYK	Stryker
ADP	ADP
LOW	Lowe's
TJX	TJX
GILD	Gilead
MMC	Marsh McLennan
VRTX	Vertex
ETN	Eaton
MDT	Medtronic
PLD	Prologis
CB	Chubb
C	Citigroup
AMT	American Tower
SBUX	Starbucks
MO	Altria
SO	Southern
FI	Fiserv
ICE	Intercontinental Exchange
CME	CME Group
DUK	Duke Energy
BSX	Boston Scientific
SHW	Sherwin-Williams
LRCX	Lam Research
KLAC	KLA
CDNS	Cadence
SNPS	Synopsys
MCK	McKesson
ADI	Analog Devices
AXP	American Express
WELL	Welltower
WM	Waste Management
TT	Trane
ITW	Illinois Tool Works
PH	Parker Hannifin
EQIX	Equinix
AON	Aon
PNC	PNC
USB	U.S. Bancorp
T	AT&T
VZ	Verizon
CMCSA	Comcast
DIS	Disney
NKE	Nike
TGT	Target
F	Ford
GM	General Motors
RIVN	Rivian
SNOW	Snowflake
PLTR	Palantir
UBER	Uber
ABNB	Airbnb
SHOP	Shopify
COIN	Coinbase
HOOD	Robinhood
SMCI	Super Micro
ARM	Arm Holdings
APP	AppLovin
MSTR	MicroStrategy
DELL	Dell
HPE	Hewlett Packard Enterprise
IBM	IBM
INTC	Intel
MU	Micron
MRVL	Marvell
PANW	Palo Alto Networks
CRWD	CrowdStrike
NET	Cloudflare
DDOG	Datadog
MELI	MercadoLibre
SE	Sea Limited
BABA	Alibaba
PDD	PDD Holdings
JD	JD.com
NIO	Nio
PFE	Pfizer
BMY	Bristol Myers
CVS	CVS Health
WFC	Wells Fargo
GS	Goldman Sachs
MS	Morgan Stanley
SCHW	Charles Schwab
BA	Boeing
LMT	Lockheed Martin
NOC	Northrop Grumman
DE	Deere
NEE	NextEra Energy
COP	ConocoPhillips
SLB	Schlumberger
OXY	Occidental
FCX	Freeport-McMoRan
NEM	Newmont
PYPL	PayPal
SQ	Block
ROKU	Roku
ZM	Zoom
DOCU	Docusign
OKTA	Okta
ZS	Zscaler
TEAM	Atlassian
WDAY	Workday
ADSK	Autodesk
ANET	Arista
AVGO	Broadcom
TSM	TSMC
ASML	ASML
SAP	SAP
SONY	Sony
TM	Toyota
HMC	Honda
NVO	Novo Nordisk
AZN	AstraZeneca
UL	Unilever
BP	BP
SHEL	Shell
BHP	BHP
RIO	Rio Tinto
VALE	Vale
SPOT	Spotify
DASH	DoorDash
CART	Instacart
DKNG	DraftKings
RBLX	Roblox
U	Unity
PATH	UiPath
AI	C3.ai
BILL	BILL
TOST	Toast
CELH	Celsius
HIMS	Hims & Hers
DUOL	Duolingo
TTD	Trade Desk
ZG	Zillow
ETSY	Etsy
EBAY	eBay
BK	Bank of New York Mellon
MET	MetLife
AIG	AIG
PRU	Prudential
ALL	Allstate
TRV	Travelers
AFL	Aflac
MAR	Marriott
HLT	Hilton
CCL	Carnival
NCLH	Norwegian Cruise
RCL	Royal Caribbean
UAL	United Airlines
DAL	Delta
AAL	American Airlines
LUV	Southwest
CSX	CSX
NSC	Norfolk Southern
FDX	FedEx
UPS	UPS
ODFL	Old Dominion
CMI	Cummins
EMR	Emerson
ROK	Rockwell
CARR	Carrier
OTIS	Otis
JCI	Johnson Controls
PCAR	PACCAR
URI	United Rentals
VLO	Valero
PSX	Phillips 66
MPC	Marathon Petroleum
HES	Hess
KMI	Kinder Morgan
WMB	Williams
OKE	ONEOK
LNG	Cheniere
FSLR	First Solar
ENPH	Enphase
SEDG	SolarEdge
RUN	Sunrun
CHPT	ChargePoint
LCID	Lucid
NKE	Nike
LULU	Lululemon
TPR	Tapestry
RL	Ralph Lauren
EL	Estee Lauder
CL	Colgate
KMB	Kimberly-Clark
GIS	General Mills
K	Kellanova
MDLZ	Mondelez
HSY	Hershey
STZ	Constellation Brands
BF.B	Brown-Forman
KR	Kroger
SYY	Sysco
DG	Dollar General
DLTR	Dollar Tree
ROST	Ross Stores
BBY	Best Buy
EBAY	eBay`.split(`
`).map(e=>{let[t,n]=e.split(`	`);return{symbol:t.trim(),name:(n??t).trim()}}),H=new Set,U=ye.filter(e=>!H.has(e.symbol)&&(H.add(e.symbol),!0));function be(e,t=12){let n=e.trim().toUpperCase();if(!n)return[];let r=[],i=[];for(let e of U)if(e.symbol.startsWith(n)?r.push(e):e.name.toUpperCase().includes(n)&&i.push(e),r.length+i.length>=t*2)break;return[...r,...i].slice(0,t).map(e=>({symbol:e.symbol,name:e.name,type:`Equity`,exchange:``}))}function xe(e){let t=e.split(``).reduce((e,t)=>e+t.charCodeAt(0),0);return Math.round((18+t%520+t%97/10)*100)/100}function W(e,t=xe(e)){let n=e.trim().toUpperCase(),r=U.find(e=>e.symbol===n),i=ne(n,t),a=i.length>1?i[i.length-2].c:t*.997;return{symbol:n,name:r?.name??n,last:t,prev:a,change:a?(t-a)/a:0,candles:i,live:!1}}var Se=B({method:`GET`}).handler(C(`ea85f041eb176546f6570a7449242accf0013febf7c88a0ff0346777b9014cff`)),Ce=B({method:`GET`}).handler(C(`5bf034e4641cedd73c6ce3c521b09db21af945d1c206af139e07ffc2eb9b655c`)),we=[{id:`holdings`,label:`Holdings`},{id:`scout`,label:`Scout`},{id:`core`,label:`Core`}];function Te(e){return e.toLocaleString(`en-US`,{minimumFractionDigits:2,maximumFractionDigits:2})}function G(e){return e.map(e=>({symbol:e.symbol,name:e.name,type:``,exchange:``}))}function Ee(){let e=A(e=>e.positions),t=(0,P.useMemo)(()=>re(),[]),n=(0,P.useMemo)(()=>{let t=new Set,n=[];for(let r of e)t.has(r.symbol)||(t.add(r.symbol),n.push({symbol:r.symbol,last:r.last,change:r.avgCost?(r.last-r.avgCost)/r.avgCost:0}));return n},[e]),[i,a]=(0,P.useState)(`holdings`),[o,s]=(0,P.useState)(`SPY`),[c,l]=(0,P.useState)(()=>W(`SPY`,644.2)),[u,d]=(0,P.useState)(!1),[f,p]=(0,P.useState)(``),[m,h]=(0,P.useState)(!1),[g,_]=(0,P.useState)(()=>G(U.slice(0,10))),v=(0,P.useRef)(null),y=(0,P.useRef)(0),b=i===`holdings`?n:t.filter(e=>e.group===i).map(e=>({symbol:e.symbol,last:e.last,change:e.change}));(0,P.useEffect)(()=>{let e=++y.current;d(!0),Ce({data:{symbol:o}}).then(t=>{y.current===e&&l(t)}).catch(()=>{y.current===e&&l(W(o))}).finally(()=>{y.current===e&&d(!1)})},[o]),(0,P.useEffect)(()=>{if(!m)return;let e=f.trim();if(e.length<1){_(G(U.slice(0,10)));return}let t=be(e,8);if(_(t),e.length<2)return;let n=window.setTimeout(()=>{Se({data:{q:e}}).then(n=>{f.trim()===e&&_(n.length?n:t)})},180);return()=>window.clearTimeout(n)},[f,m]),(0,P.useEffect)(()=>{let e=e=>{v.current?.contains(e.target)||h(!1)};return document.addEventListener(`mousedown`,e),()=>document.removeEventListener(`mousedown`,e)},[]);let x=(0,P.useMemo)(()=>se(c.last),[c.last]),S=e=>{s(e.toUpperCase()),p(``),h(!1)};return(0,F.jsxs)(`section`,{className:`panel flex h-full min-h-72 min-w-0 flex-col overflow-hidden p-4`,children:[(0,F.jsxs)(`div`,{className:`flex min-w-0 items-center gap-2`,children:[(0,F.jsx)(`span`,{className:`kicker`,children:`Market`}),(0,F.jsx)(`span`,{className:`text-sm text-ink`,children:c.symbol}),(0,F.jsxs)(`span`,{className:r(`num text-xs`,c.change>=0?`text-teal`:`text-coral`),children:[Te(c.last),` `,T(c.change*100)]}),!c.live&&!u&&(0,F.jsx)(`span`,{className:`text-micro text-mist`,children:`paper path`})]}),(0,F.jsx)(`p`,{className:`mt-0.5 truncate text-2xs text-mist`,children:c.name}),(0,F.jsxs)(`div`,{ref:v,className:`relative mt-2`,children:[(0,F.jsx)(de,{className:`pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-mist`}),(0,F.jsx)(`input`,{value:f,onChange:e=>{p(e.target.value),h(!0)},onFocus:()=>h(!0),onKeyDown:e=>{if(e.key===`Escape`&&h(!1),e.key===`Enter`){e.preventDefault();let t=g[0],n=f.trim().toUpperCase();t?S(t.symbol):/^[A-Z][A-Z.\-]{0,7}$/.test(n)&&S(n)}},placeholder:`Any name or ticker`,"aria-label":`Search the tape`,autoComplete:`off`,spellCheck:!1,className:`h-9 w-full rounded-md bg-void px-8 text-sm text-ink shadow-border placeholder:text-mist/60 focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-void),0_0_0_4px_var(--color-signal)]`}),m&&(0,F.jsx)(`ul`,{role:`listbox`,className:`absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-md bg-night py-1 hairline shadow-panel`,children:g.length===0?(0,F.jsx)(`li`,{className:`px-3 py-2 text-2xs text-mist`,children:`No match. Enter a ticker to load it anyway.`}):g.map(e=>(0,F.jsx)(`li`,{children:(0,F.jsxs)(`button`,{type:`button`,role:`option`,onClick:()=>S(e.symbol),className:`flex w-full items-baseline justify-between gap-2 px-3 py-2 text-left hover:bg-panel`,children:[(0,F.jsx)(`span`,{className:`num text-sm text-ink`,children:e.symbol}),(0,F.jsxs)(`span`,{className:`min-w-0 truncate text-2xs text-mist`,children:[e.name,e.exchange?` · ${e.exchange}`:``]})]})},e.symbol))})]}),(0,F.jsx)(`div`,{className:r(`mt-2 h-44 min-h-0 flex-1`,u&&`opacity-60`),children:(0,F.jsx)(ce,{candles:c.candles,forecast:x})}),(0,F.jsx)(`div`,{className:`mt-3 flex gap-0.5 rounded-md bg-void p-0.5`,children:we.map(e=>(0,F.jsx)(`button`,{type:`button`,onClick:()=>{a(e.id);let r=e.id===`holdings`?n[0]:t.find(t=>t.group===e.id);r&&s(r.symbol)},className:r(`h-9 flex-1 rounded-sm px-2 text-xs transition-[color,background-color] duration-150`,i===e.id?`bg-panel text-ink`:`text-mist hover:text-ink`),children:e.label},e.id))}),(0,F.jsx)(`ul`,{className:`mt-1.5 grid grid-cols-2 gap-0.5`,children:b.length===0?(0,F.jsx)(`li`,{className:`col-span-2 px-2 py-2 text-2xs text-mist`,children:`Nothing in this book yet.`}):b.map(e=>(0,F.jsx)(`li`,{children:(0,F.jsxs)(`button`,{type:`button`,onClick:()=>S(e.symbol),className:r(`flex h-9 w-full items-center justify-between rounded-sm px-2 text-left text-xs`,`transition-[background-color,color] duration-150`,o===e.symbol?`bg-panel text-ink`:`text-mist hover:bg-panel/60 hover:text-ink`),children:[(0,F.jsx)(`span`,{children:e.symbol}),(0,F.jsx)(`span`,{className:r(`num`,e.change>=0?`text-teal`:`text-coral`),children:T(e.change*100,1)})]})},e.symbol))})]})}var K=[{id:`perceive`,label:`perceive`,kind:`gemini`},{id:`guard`,label:`guard`,kind:`code`},{id:`triage`,label:`triage`,kind:`gemini`},{id:`signals`,label:`signals`,kind:`gemini`},{id:`gate`,label:`gate + execute`,kind:`code`},{id:`explain`,label:`explain`,kind:`gemini`},{id:`record`,label:`record`,kind:`code`}],De=[{id:`scout`,label:`scout`,kind:`gemini`,near:`perceive`},{id:`weather`,label:`weather`,kind:`code`,near:`triage`},{id:`timesfm`,label:`TimesFM`,kind:`gemini`,near:`signals`}],Oe=[`advocate`,`critic`,`judge`],q=K.map(e=>e.id);function J(e,t){return e!==`idle`&&q.indexOf(t)<=q.indexOf(e)}function ke({active:e}){let t=e!==`idle`;return(0,F.jsxs)(`div`,{className:`flex h-full min-h-52 flex-col gap-3`,children:[(0,F.jsx)(`div`,{className:`flex flex-wrap gap-1`,children:De.map(n=>(0,F.jsx)(Y,{label:n.label,kind:n.kind,on:t&&J(e,n.near),current:e===n.near},n.id))}),(0,F.jsxs)(`ol`,{className:`relative flex-1 pl-4`,children:[(0,F.jsx)(`span`,{className:`absolute top-1.5 bottom-1.5 left-[5px] w-px bg-line`,"aria-hidden":!0}),K.map(n=>{let i=t&&J(e,n.id),a=e===n.id;return(0,F.jsxs)(`li`,{className:`relative flex items-center gap-2 py-1`,children:[(0,F.jsx)(`span`,{className:r(`absolute -left-4 size-2.5 rounded-full`,i?n.kind===`gemini`?`bg-gold`:`bg-signal`:`bg-line`,a&&`motion-safe:animate-pulse-node`)}),(0,F.jsx)(`span`,{className:r(`text-xs`,i?`text-ink`:`text-mist`),children:n.label}),(0,F.jsx)(`span`,{className:r(`ml-auto text-micro font-medium tracking-wider uppercase`,n.kind===`gemini`?`text-gold`:`text-signal`,!i&&`opacity-40`),children:n.kind===`gemini`?`AI`:`CODE`})]},n.id)})]}),(0,F.jsxs)(`div`,{children:[(0,F.jsx)(`div`,{className:`mb-1 kicker`,children:`Debate council`}),(0,F.jsx)(`div`,{className:`flex flex-wrap gap-1`,children:Oe.map(n=>(0,F.jsx)(Y,{label:n,kind:`gemini`,on:t&&J(e,`signals`),current:e===`signals`},n))})]})]})}function Y({label:e,kind:t,on:n,current:i}){return(0,F.jsx)(`span`,{className:r(`rounded-sm bg-panel px-1.5 py-0.5 text-micro text-mist`,n&&t===`gemini`&&`text-gold shadow-tone-gold`,n&&t===`code`&&`text-signal shadow-tone-signal`,i&&`motion-safe:animate-pulse-node`),children:e})}function Ae(){let e=A(e=>e.passStep),t=A(e=>e.passRunning);return(0,F.jsxs)(`section`,{className:`panel flex h-full min-h-72 min-w-0 flex-col overflow-hidden p-4`,children:[(0,F.jsxs)(`div`,{className:`flex items-center justify-between gap-2`,children:[(0,F.jsx)(`span`,{className:`kicker`,children:`Agent graph`}),t?(0,F.jsx)(k,{tone:`gold`,children:e}):(0,F.jsx)(k,{children:`idle`})]}),(0,F.jsx)(`div`,{className:`mt-3 min-h-0 flex-1`,children:(0,F.jsx)(ke,{active:e})})]})}var je=Object.defineProperty,X=(e,t)=>je(e,`name`,{value:t,configurable:!0}),[Me,Ne]=o(`AlertDialog`,[b]),Z=b(),Pe=X(e=>{let{__scopeAlertDialog:t,...n}=e,r=Z(t);return(0,F.jsx)(h,{...r,...n,modal:!0})},`AlertDialog`),Fe=P.forwardRef(X(function(e,t){let{__scopeAlertDialog:n,...r}=e,i=Z(n);return(0,F.jsx)(m,{...i,...r,ref:t})},`AlertDialogTrigger`)),Ie=X(e=>{let{__scopeAlertDialog:t,...n}=e,r=Z(t);return(0,F.jsx)(v,{...r,...n})},`AlertDialogPortal`),Le=P.forwardRef(X(function(e,t){let{__scopeAlertDialog:n,...r}=e,i=Z(n);return(0,F.jsx)(g,{...i,...r,ref:t})},`AlertDialogOverlay`)),[Re,ze]=Me(`AlertDialogContent`),Be=P.forwardRef(X(function(e,t){let{__scopeAlertDialog:n,children:r,...a}=e,o=Z(n),s=P.useRef(null),l=c(t,s),u=P.useRef(null);return(0,F.jsx)(Re,{scope:n,cancelRef:u,children:(0,F.jsx)(p,{role:`alertdialog`,...o,...a,ref:l,onOpenAutoFocus:i(a.onOpenAutoFocus,e=>{e.preventDefault(),u.current?.focus({preventScroll:!0})}),onPointerDownOutside:e=>e.preventDefault(),onInteractOutside:e=>e.preventDefault(),children:r})})},`AlertDialogContent`)),Ve=P.forwardRef(X(function(e,t){let{__scopeAlertDialog:n,...r}=e,i=Z(n);return(0,F.jsx)(u,{...i,...r,ref:t})},`AlertDialogTitle`)),He=P.forwardRef(X(function(e,t){let{__scopeAlertDialog:n,...r}=e,i=Z(n);return(0,F.jsx)(l,{...i,...r,ref:t})},`AlertDialogDescription`)),Ue=P.forwardRef(X(function(e,t){let{__scopeAlertDialog:n,...r}=e,i=Z(n);return(0,F.jsx)(_,{...i,...r,ref:t})},`AlertDialogAction`)),We=`AlertDialogCancel`,Ge=P.forwardRef(X(function(e,t){let{__scopeAlertDialog:n,...r}=e,{cancelRef:i}=ze(We,n),a=Z(n),o=c(t,i);return(0,F.jsx)(_,{...a,...r,ref:o})},`AlertDialogCancel`)),Ke=Pe,qe=Fe,Je=Ie,Ye=Le,Xe=Be,Ze=Ue,Qe=Ge,$e=Ve,et=He,tt=Ke,nt=qe;function Q({title:e,description:t,confirm:n,confirmTone:i=`coral`,onConfirm:a,children:o}){return(0,F.jsxs)(Je,{children:[(0,F.jsx)(Ye,{className:`fixed inset-0 z-50 bg-void-deep/70`}),(0,F.jsxs)(Xe,{className:r(`fixed top-1/2 left-1/2 z-50 w-[min(28rem,calc(100vw-1.5rem))] -translate-x-1/2 -translate-y-1/2`,`rounded-xl bg-night p-5 shadow-[0_0_0_1px_var(--color-line),0_12px_40px_rgb(0_0_0/0.4)]`),children:[(0,F.jsx)($e,{className:`text-base font-medium text-ink`,children:e}),(0,F.jsx)(et,{className:`mt-2 text-sm text-mist`,children:t}),o,(0,F.jsxs)(`div`,{className:`mt-5 flex justify-end gap-2`,children:[(0,F.jsx)(Qe,{asChild:!0,children:(0,F.jsx)(O,{variant:`ghost`,children:`Cancel`})}),(0,F.jsx)(Ze,{asChild:!0,children:(0,F.jsx)(O,{variant:i,onClick:a,children:n})})]})]})]})}function rt(){let e=A(e=>e.positions),t=A(e=>e.orders),n=A(e=>e.closePosition),i=A(e=>e.cancelOrder),[o,s]=(0,P.useState)(null);return(0,F.jsxs)(`section`,{className:`panel flex h-full min-h-72 min-w-0 flex-col overflow-hidden p-4`,children:[(0,F.jsxs)(`div`,{className:`flex items-center justify-between`,children:[(0,F.jsx)(`span`,{className:`kicker`,children:`On board`}),(0,F.jsxs)(`span`,{className:`num text-2xs text-mist`,children:[e.length,` names`]})]}),e.length===0?(0,F.jsx)(`p`,{className:`mt-4 text-sm text-mist`,children:`Cash only. Nothing has sailed yet.`}):(0,F.jsx)(`div`,{className:`mt-2 min-h-0 flex-1 overflow-auto`,children:(0,F.jsxs)(`table`,{className:`w-full min-w-72 text-left text-xs`,children:[(0,F.jsx)(`thead`,{className:`text-mist`,children:(0,F.jsxs)(`tr`,{className:`border-b border-line`,children:[(0,F.jsx)(`th`,{className:`pb-1.5 font-medium`,children:`Name`}),(0,F.jsx)(`th`,{className:`pb-1.5 font-medium`,children:`Qty`}),(0,F.jsx)(`th`,{className:`pb-1.5 font-medium`,children:`Value`}),(0,F.jsx)(`th`,{className:`pb-1.5 font-medium`,children:`P&L`}),(0,F.jsx)(`th`,{className:`pb-1.5`})]})}),(0,F.jsx)(`tbody`,{children:e.map(e=>{let t=oe(e),i=ie(e),c=(e.last-e.avgCost)/e.avgCost*100;return(0,F.jsxs)(`tr`,{className:`border-b border-line/50`,children:[(0,F.jsxs)(`td`,{className:`py-1.5 pr-2`,children:[(0,F.jsx)(`div`,{className:`text-ink`,children:e.humanName}),(0,F.jsx)(`div`,{className:`text-micro text-mist`,children:e.family})]}),(0,F.jsx)(`td`,{className:`num py-1.5 pr-2 text-mist`,children:e.qty}),(0,F.jsx)(`td`,{className:`num py-1.5 pr-2 text-ink`,children:w(i)}),(0,F.jsxs)(`td`,{className:r(`num py-1.5 pr-2`,t>=0?`text-teal`:`text-coral`),children:[w(t,{sign:!0}),(0,F.jsx)(`span`,{className:`ml-1 text-micro opacity-80`,children:T(c)})]}),(0,F.jsx)(`td`,{className:`py-1.5 text-right`,children:(0,F.jsxs)(tt,{open:o===e.id,onOpenChange:t=>s(t?e.id:null),children:[(0,F.jsx)(nt,{asChild:!0,children:(0,F.jsx)(O,{size:`sm`,variant:`ghost`,className:`h-8 px-2 text-2xs`,children:`Close`})}),(0,F.jsx)(Q,{title:`Close ${e.humanName}?`,description:`Market sell, queued until the open. The mark you see is not a fill.`,confirm:`Queue close`,confirmTone:`coral`,onConfirm:()=>{n(e.id),a(`Close queued until the open.`),s(null)}})]})})]},e.id)})})]})}),(0,F.jsx)(`div`,{className:`mt-3 kicker`,children:`Queued`}),t.length===0?(0,F.jsx)(`p`,{className:`mt-1 text-2xs text-mist`,children:`None waiting.`}):(0,F.jsx)(`ul`,{className:`mt-1 space-y-1`,children:t.map(e=>(0,F.jsxs)(`li`,{className:`flex items-center justify-between gap-2 rounded-sm bg-panel px-2 py-1.5`,children:[(0,F.jsx)(`div`,{className:`min-w-0`,children:(0,F.jsxs)(`div`,{className:`truncate text-xs text-ink`,children:[e.side.toUpperCase(),` `,e.qty,` `,e.humanName,e.limit?` @ ${e.limit.toFixed(2)}`:` mkt`]})}),(0,F.jsx)(O,{size:`sm`,variant:`ghost`,className:`h-8 px-2 text-2xs`,onClick:()=>i(e.id),children:`Pull`})]},e.id))})]})}var it={proposal:`amber`,verdict:`coral`,fill:`teal`,approval:`gold`,forecast:`signal`,debate:`gold`,order:`signal`,pnl:`teal`};function at(){let e=A(e=>e.journal).slice(0,8);return(0,F.jsxs)(`section`,{className:`panel min-w-0 p-4`,children:[(0,F.jsx)(`div`,{className:`kicker`,children:`Live feed`}),e.length===0?(0,F.jsx)(`p`,{className:`mt-3 text-sm text-mist`,children:`Quiet. The first pass will write here.`}):(0,F.jsx)(`ul`,{className:`mt-3 grid gap-1 sm:grid-cols-2`,children:e.map((e,t)=>(0,F.jsxs)(`li`,{className:`animate-feed-in flex items-center gap-2 rounded-md px-2 py-1.5`,style:{animationDelay:`${Math.min(t,6)*40}ms`},children:[(0,F.jsx)(k,{tone:it[e.kind]??`mist`,children:e.kind}),(0,F.jsx)(`span`,{className:`min-w-0 flex-1 truncate text-xs text-ink`,children:e.title}),(0,F.jsx)(`span`,{className:`num shrink-0 text-micro text-mist`,children:j(e.ts)})]},e.id))})]})}function $({className:e}){return(0,F.jsx)(`div`,{className:r(`skel`,e)})}function ot(){return(0,F.jsxs)(`div`,{className:`flex flex-col gap-3`,children:[(0,F.jsx)($,{className:`h-16 rounded-lg`}),(0,F.jsxs)(`div`,{className:`panel grid overflow-hidden lg:grid-cols-[0.3fr_1fr]`,children:[(0,F.jsxs)(`div`,{className:`space-y-3 p-5`,children:[(0,F.jsx)($,{className:`h-3 w-20`}),(0,F.jsx)($,{className:`h-6 w-36`}),(0,F.jsx)($,{className:`h-3 w-44`}),(0,F.jsx)($,{className:`mt-8 h-12 w-full`})]}),(0,F.jsx)($,{className:`m-2 min-h-48 rounded-xl lg:min-h-72`})]}),(0,F.jsxs)(`div`,{className:`grid gap-3 xl:grid-cols-3`,children:[(0,F.jsx)($,{className:`h-64 rounded-xl`}),(0,F.jsx)($,{className:`h-64 rounded-xl`}),(0,F.jsx)($,{className:`h-64 rounded-xl`})]})]})}function st(){let e=A(e=>e.loadingDemo),t=A(e=>e.autopilot),n=A(e=>e.killSwitch),r=A(e=>e.circuitBreaker),i=A(e=>e.passRunning),a=A(e=>e.runPass);return(0,P.useEffect)(()=>{if(!t||n||r===`hard`||i)return;let e=setInterval(()=>{document.visibilityState===`visible`&&A.getState().runPass()},28e3);return()=>clearInterval(e)},[t,n,r,i,a]),(0,F.jsx)(y,{children:e?(0,F.jsx)(ot,{}):(0,F.jsxs)(`div`,{className:`flex min-w-0 flex-col gap-3`,children:[(0,F.jsx)(he,{}),(0,F.jsx)(pe,{}),(0,F.jsxs)(`div`,{className:`grid min-w-0 gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.9fr)_minmax(0,1fr)]`,children:[(0,F.jsx)(Ee,{}),(0,F.jsx)(Ae,{}),(0,F.jsx)(rt,{})]}),(0,F.jsx)(at,{})]})})}export{st as component};