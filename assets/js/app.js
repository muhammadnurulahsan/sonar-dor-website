(() => {
"use strict";
const C = window.GOLD_CONFIG;
let BJ = C.fallback;
const G_OZ = 31.1034768, G_BHORI = 11.664, G_ANA = G_BHORI / 16;
const KARATS = [["k22", "২২ ক্যারেট"], ["k21", "২১ ক্যারেট"], ["k18", "১৮ ক্যারেট"], ["trad", "সনাতন পদ্ধতি"]];
const $ = id => document.getElementById(id);
const nf = (d) => new Intl.NumberFormat("bn-BD", { minimumFractionDigits: d, maximumFractionDigits: d });
const bn = (n, d = 0) => nf(d).format(n);
const taka = n => "৳" + bn(Math.round(n));
const usd = (n, d = 2) => "$" + bn(n, d);
const pct = (n, d = 2) => (n > 0 ? "+" : n < 0 ? "−" : "") + bn(Math.abs(n) * 100, d) + "%";
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const tFmt = new Intl.DateTimeFormat("bn-BD", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const tsFmt = new Intl.DateTimeFormat("bn-BD", { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
const dFmt = new Intl.DateTimeFormat("bn-BD", { day: "numeric", month: "long", year: "numeric" });
const dShort = new Intl.DateTimeFormat("bn-BD", { day: "numeric", month: "short" });
const day = s => new Date(s + "T00:00:00");
const isoDay = ms => new Date(ms).toISOString().slice(0, 10);
const dir = v => (v > 0.0005 ? "up" : v < -0.0005 ? "down" : "flat");

const ICON = {
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17l6-6 4 4 6-7"/><path d="M15 8h5v5"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7l6 6 4-4 6 7"/><path d="M15 16h5v-5"/></svg>',
  flat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 12h16"/><path d="M16 8l4 4-4 4"/></svg>'
};

const store = {
  get(k, f) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : f; } catch (e) { return f; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
};

/* ---------- data sources (free, keyless) ---------- */
async function getJSON(url, ms = 10000) {
  const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}
async function getAny(urls) { let e; for (const u of urls) { try { return await getJSON(u); } catch (x) { e = x; } } throw e; }
const capi = (tag, file) => [
  `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${tag}/v1/currencies/${file}.json`,
  `https://${tag}.currency-api.pages.dev/v1/currencies/${file}.json`
];
async function fetchSpot() {
  try {
    const d = await getJSON("https://api.gold-api.com/price/XAU");
    if (d && +d.price > 0) return { usd: +d.price, live: true };
  } catch (e) {}
  const d = await getAny(capi("latest", "xau"));
  return { usd: d.xau.usd, live: false };
}
async function fetchFx() {
  try { const d = await getJSON("https://open.er-api.com/v6/latest/USD"); if (d && d.rates && d.rates.BDT) return d.rates.BDT; } catch (e) {}
  const d = await getAny(capi("latest", "usd")); return d.usd.bdt;
}
async function fetchHistory() {
  const today = isoDay(Date.now()), cached = store.get("sd_hist", null);
  if (cached && cached.day === today && cached.rows.length > 10) return cached.rows;
  const dates = [];
  for (let i = 0; i <= C.historyDays; i++) dates.push(isoDay(Date.now() - i * 864e5));
  const rows = (await Promise.all(dates.map(dt => getAny(capi(dt, "xau"))
    .then(d => ({ date: d.date || dt, usd: d.xau.usd, bdt: d.xau.bdt })).catch(() => null)))).filter(Boolean);
  const m = new Map(); rows.forEach(r => m.set(r.date, r));
  const out = [...m.values()].sort((a, b) => a.date.localeCompare(b.date));
  if (out.length) store.set("sd_hist", { day: today, rows: out });
  return out;
}

/* ---------- state ---------- */
const params = new URLSearchParams(location.search);
const S = {
  spot: null, fx: null, hist: [], ticks: store.get("sd_ticks", []), updated: null, nextAt: 0, loading: false, failed: false,
  range: ["7d", "30d", "today"].includes(params.get("range")) ? params.get("range") : "30d"
};
function addTick() {
  const now = Date.now();
  S.ticks = S.ticks.filter(t => now - t.t < 864e5);
  const last = S.ticks[S.ticks.length - 1];
  if (!last || now - last.t > 50e3) S.ticks.push({ t: now, usd: S.spot.usd });
  store.set("sd_ticks", S.ticks);
}

/* ---------- maths ---------- */
function refRow() {
  let ref = null;
  for (const r of S.hist) if (r.date <= BJ.current.date) ref = r;
  return ref || S.hist[0] || null;
}
function ratio() {
  if (!S.spot || !S.fx) return null;
  const ref = BJ.current.ref;
  if (ref && ref.usd > 0 && ref.fx > 0) return (S.spot.usd * S.fx) / (ref.usd * ref.fx);
  const r = refRow();
  return r ? (S.spot.usd * S.fx) / r.bdt : null;
}
const sma = (a, n) => a.slice(-n).reduce((s, v) => s + v, 0) / Math.min(n, a.length);
function rsi(a, n = 14) {
  if (a.length < n + 1) return null;
  let g = 0, l = 0;
  for (let i = a.length - n; i < a.length; i++) { const d = a[i] - a[i - 1]; d > 0 ? (g += d) : (l -= d); }
  return l === 0 ? 100 : 100 - 100 / (1 + g / l);
}
function closes() {
  const today = isoDay(Date.now());
  const c = S.hist.filter(h => h.date < today).map(h => h.usd);
  if (S.spot) c.push(S.spot.usd);
  return c;
}
function predict() {
  const c = closes(), f = [];
  if (c.length >= 21) {
    const a = sma(c, 7), b = sma(c, 21), d = (a - b) / b;
    f.push({ n: "সাম্প্রতিক প্রবণতা", w: .35, s: clamp(d / .03, -1, 1), x: `গত ৭ দিনের গড় দাম ২১ দিনের গড়ের চেয়ে ${bn(Math.abs(d) * 100, 1)}% ${d >= 0 ? "বেশি" : "কম"}।` });
  }
  if (c.length >= 6) {
    const m = c[c.length - 1] / c[c.length - 6] - 1;
    f.push({ n: "৫ দিনের গতি", w: .25, s: clamp(m / .04, -1, 1), x: `৫ দিন আগের তুলনায় দাম ${bn(Math.abs(m) * 100, 1)}% ${m >= 0 ? "বেড়েছে" : "কমেছে"}।` });
  }
  const r = rsi(c);
  if (r !== null) {
    let s = 0, x = `আরএসআই ${bn(r)}, স্বাভাবিক সীমার মধ্যে; এদিক থেকে কোনো চাপ নেই।`;
    if (r >= 70) { s = -(r - 70) / 30; x = `আরএসআই ${bn(r)}: অল্প সময়ে অনেক বেড়েছে, কিছুটা নামার ঝুঁকি আছে।`; }
    else if (r <= 30) { s = (30 - r) / 30; x = `আরএসআই ${bn(r)}: অল্প সময়ে অনেক কমেছে, ঘুরে দাঁড়াতে পারে।`; }
    f.push({ n: "অতিরিক্ত কেনা-বেচা", w: .2, s: clamp(s, -1, 1), x });
  }
  const rec = S.ticks.filter(t => Date.now() - t.t < 2 * 3600e3);
  if (rec.length >= 3) {
    const m = rec[rec.length - 1].usd / rec[0].usd - 1, mins = Math.round((rec[rec.length - 1].t - rec[0].t) / 60e3);
    f.push({ n: "আজকের ওঠানামা", w: .2, s: clamp(m / .005, -1, 1), x: `শেষ ${bn(mins)} মিনিটে দাম ${bn(Math.abs(m) * 100, 2)}% ${m >= 0 ? "বেড়েছে" : "কমেছে"}।` });
  }
  if (!f.length) return null;
  const tw = f.reduce((s, v) => s + v.w, 0);
  return { score: f.reduce((s, v) => s + v.s * v.w, 0) / tw, f };
}

/* ---------- render ---------- */
/* ---------- helpers for display ---------- */
const CARET = {
  up: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 2l4.5 7h-9z" fill="currentColor"/></svg>',
  down: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 10L1.5 3h9z" fill="currentColor"/></svg>'
};
const signed = (d, f) => (d > 0 ? "+" : d < 0 ? "−" : "") + f(Math.abs(d));
const wkFmt = new Intl.DateTimeFormat("bn-BD", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
function prevBajus() {
  const h = BJ.history || [];
  for (let i = h.length - 1; i >= 0; i--) if (h[i].k22 !== BJ.current.perBhori.k22) return h[i];
  return null;
}

/* ---------- render ---------- */
function renderBD() {
  const cur = BJ.current, p = cur.perBhori;
  $("todayDate").textContent = wkFmt.format(new Date());
  $("bd22").textContent = taka(p.k22);
  $("tk22").textContent = taka(p.k22);
  $("q21").textContent = taka(p.k21); $("q18").textContent = taka(p.k18); $("qtr").textContent = taka(p.trad);
  $("bajusMeta").textContent = `${dFmt.format(day(cur.date))} থেকে কার্যকর। সূত্র: বাংলাদেশ জুয়েলার্স সমিতি (বাজুস)`;
  $("footUpdated").textContent = `বাজুসের দাম সর্বশেষ বদলেছে ${dFmt.format(day(cur.date))}`;
  const pv = prevBajus(), b = $("bd22chg");
  if (pv) {
    const d = p.k22 - pv.k22, c = d > 0 ? "up" : "down";
    b.className = "badge " + c;
    b.innerHTML = `${CARET[c]}${taka(Math.abs(d))} <span class="sr-only">${c === "up" ? "বেড়েছে" : "কমেছে"}</span>আগের দরের তুলনায়`;
  } else { b.className = "badge flat"; b.textContent = ""; }
  const rt = ratio(), est = $("estimate");
  if (rt) {
    const e = p.k22 * rt, c = dir(rt - 1);
    est.innerHTML = c === "flat" ? "বিশ্ববাজার এখনও বাজুসের দরের কাছাকাছি আছে।"
      : `বিশ্ববাজার অনুযায়ী এখন হওয়া উচিত প্রায় <b>${taka(e)}</b> <span class="${c}">(${pct(rt - 1, 1)})</span>`;
  } else est.textContent = "";
}

function renderMarket(prev) {
  if (!S.spot) return;
  const s = S.spot.usd, el = $("spot");
  el.textContent = usd(s); $("tkSpot").textContent = usd(s);
  if (prev && prev !== s) { el.classList.remove("tick-up", "tick-down"); void el.offsetWidth; el.classList.add(s > prev ? "tick-up" : "tick-down"); }
  $("spotGram").textContent = usd(s / G_OZ);
  if (S.fx) { $("spotBhori").textContent = taka(s / G_OZ * G_BHORI * S.fx); $("fx").textContent = "৳" + bn(S.fx, 2); $("tkFx").textContent = "৳" + bn(S.fx, 2); }
  const today = isoDay(Date.now()), y = [...S.hist].reverse().find(h => h.date < today);
  if (y) {
    const d = s - y.usd, p = d / y.usd, c = dir(p);
    $("spotChg").className = "chg num " + c;
    $("spotChg").textContent = `${signed(d, v => usd(v))} (${pct(p)}) আগের দিনের তুলনায়`;
    $("tkChg").className = c; $("tkChg").textContent = pct(p);
  }
}

function renderTable() {
  const rt = ratio();
  $("rows").innerHTML = KARATS.map(([k, name]) => {
    const v = BJ.current.perBhori[k];
    let est = "<td>–</td>";
    if (rt) {
      const e = v * rt, d = e - v, c = dir(rt - 1);
      est = `<td>${taka(e)}<small class="${c}">${c === "flat" ? "প্রায় সমান" : signed(d, taka)}</small></td>`;
    }
    return `<tr><th scope="row">${name}</th><td class="strong">${taka(v)}</td><td>${taka(v / G_BHORI)}</td><td>${taka(v / 16)}</td><td>${taka(v / 96)}</td>${est}</tr>`;
  }).join("");
  $("tableSource").textContent = `সূত্র: বাজুস, ${dFmt.format(day(BJ.current.date))} থেকে কার্যকর। দামে ৫% ভ্যাট ধরা আছে; মজুরি আলাদা, বাজুসের নিয়মে ন্যূনতম ৬%।`;
}

function renderSignal() {
  const p = predict();
  const bars = [...$("scale").children];
  if (!p) {
    $("verdictText").textContent = S.loading ? "হিসাব চলছে…" : "যথেষ্ট তথ্য নেই";
    $("verdictSub").textContent = S.loading ? "দামের ইতিহাস আসার অপেক্ষা" : "দামের ইতিহাস পাওয়া গেলে সংকেত দেখাবে। একটু পরে রিফ্রেশ করুন।";
    bars.forEach(b => (b.className = ""));
    return;
  }
  const s = p.score, c = s > .15 ? "up" : s < -.15 ? "down" : "flat";
  const str = Math.abs(s) > .55 ? "জোরালো" : Math.abs(s) > .3 ? "মাঝারি" : "দুর্বল";
  const t = $("verdictText"); t.className = c;
  t.textContent = c === "up" ? "বাড়ার দিকে" : c === "down" ? "কমার দিকে" : "স্থিতিশীল";
  $("verdictSub").textContent = `সংকেতের জোর ${str}। ${p.f.length}টি সূচকের সম্মিলিত হিসাব।`;
  const idx = clamp(Math.round((s + 1) / 2 * 4), 0, 4);
  bars.forEach((b, i) => (b.className = i === idx ? "on " + c : ""));
  $("sigRows").innerHTML = p.f.map(x => {
    const fc = x.s > .1 ? "up" : x.s < -.1 ? "down" : "flat";
    return `<tr><th scope="row">${x.n}</th><td class="desc">${x.x}</td><td class="${fc}">${fc === "up" ? "বাড়ার দিকে" : fc === "down" ? "কমার দিকে" : "নিরপেক্ষ"}</td></tr>`;
  }).join("");
  const rt = ratio();
  if (rt) {
    const ch = rt - 1, est = BJ.current.perBhori.k22 * rt;
    let h, b;
    if (ch <= -.01) { h = "দাম কমানোর সম্ভাবনা আছে"; b = `শেষ ঘোষণার পর টাকার হিসাবে বিশ্ববাজার ${bn(Math.abs(ch) * 100, 1)}% কমেছে। এই অবস্থায় থাকলে ২২ ক্যারেট প্রতি ভরি প্রায় ${taka(est)} হতে পারে।`; }
    else if (ch >= .01) { h = "দাম বাড়ানোর সম্ভাবনা আছে"; b = `শেষ ঘোষণার পর টাকার হিসাবে বিশ্ববাজার ${bn(ch * 100, 1)}% বেড়েছে। এই অবস্থায় থাকলে ২২ ক্যারেট প্রতি ভরি প্রায় ${taka(est)} হতে পারে।`; }
    else { h = "এখনই বড় পরিবর্তনের সম্ভাবনা কম"; b = `শেষ ঘোষণার পর বিশ্ববাজার মাত্র ${pct(ch, 1)} বদলেছে।`; }
    $("nextMove").innerHTML = `<b>বাজুসের পরের সমন্বয়: ${h}</b><p>${b}</p>`;
  }
}

function renderHistory() {
  const h = (BJ.history || []).slice(-9);
  const rows = h.map((r, i) => {
    const prev = i ? h[i - 1].k22 : null, d = prev ? r.k22 - prev : 0, c = d > 0 ? "up" : d < 0 ? "down" : "flat";
    return `<tr><th scope="row">${dFmt.format(day(r.date))}</th><td class="strong">${taka(r.k22)}</td><td class="${c}">${prev ? signed(d, taka) : "–"}</td></tr>`;
  }).reverse();
  $("histRows").innerHTML = rows.slice(0, 8).join("");
}

/* ---------- chart ---------- */
function chartPts() {
  if (S.range === "today") return S.ticks.map(t => ({ y: t.usd, lab: tFmt.format(new Date(t.t)) }));
  const today = isoDay(Date.now());
  let pts = S.hist.filter(h => h.date < today).map(h => ({ y: h.usd, lab: dShort.format(day(h.date)) }));
  if (S.range === "7d") pts = pts.slice(-7);
  if (S.spot) pts.push({ y: S.spot.usd, lab: "এখন" });
  return pts;
}
function drawChart() {
  const el = $("chartEl"), pts = chartPts();
  const setStats = (hi, lo, ch) => { $("stHi").textContent = hi; $("stLo").textContent = lo; const c = $("stChg"); c.innerHTML = ch; };
  if (pts.length < 2) {
    el.innerHTML = `<p class="empty">${S.range === "today" ? "পাতা খোলা রাখলে প্রতি মিনিটের দাম এখানে যোগ হতে থাকবে।" : S.loading ? "চার্ট তৈরি হচ্ছে…" : "দামের ইতিহাস আনা যায়নি। ইন্টারনেট সংযোগ দেখে রিফ্রেশ করুন।"}</p>`;
    setStats("–", "–", "–"); return;
  }
  const W = Math.max(300, el.clientWidth), H = 300, P = { l: 64, r: 8, t: 12, b: 32 };
  const ys = pts.map(p => p.y);
  let mn = Math.min(...ys), mx = Math.max(...ys);
  const ch = ys[ys.length - 1] - ys[0], c = dir(ch / ys[0]);
  setStats(usd(mx), usd(mn), `<span class="${c}">${signed(ch, v => usd(v))} (${pct(ch / ys[0])})</span>`);
  const pad = (mx - mn) * .12 || 5; mn -= pad; mx += pad;
  const X = i => P.l + i * (W - P.l - P.r) / (pts.length - 1), Y = v => P.t + (mx - v) / (mx - mn) * (H - P.t - P.b);
  const line = pts.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(p.y).toFixed(1)}`).join("");
  let g = "";
  for (let i = 0; i <= 4; i++) { const v = mn + (mx - mn) * i / 4, y = Y(v); g += `<line class="grid" x1="${P.l}" x2="${W - P.r}" y1="${y}" y2="${y}"/><text class="axis" x="${P.l - 10}" y="${y + 4}" text-anchor="end">$${bn(v)}</text>`; }
  const n = pts.length, step = Math.max(1, Math.ceil(n / (W < 520 ? 3 : 6)));
  let xl = "";
  for (let i = 0; i < n - step * 0.7; i += step) xl += `<text class="axis" x="${X(i)}" y="${H - 8}" text-anchor="${i === 0 ? "start" : "middle"}">${pts[i].lab}</text>`;
  xl += `<text class="axis" x="${X(n - 1)}" y="${H - 8}" text-anchor="end">${pts[n - 1].lab}</text>`;
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${pts[0].lab} থেকে ${pts[n - 1].lab}: ${usd(pts[0].y)} থেকে ${usd(pts[n - 1].y)}">${g}<path class="area" d="${line}L${X(n - 1)},${H - P.b}L${X(0)},${H - P.b}Z"/><path class="line" d="${line}"/>${xl}<line class="cursor" y1="${P.t}" y2="${H - P.b}" visibility="hidden"/><circle class="pt" r="4.5" visibility="hidden"/><rect x="${P.l}" y="0" width="${W - P.l - P.r}" height="${H}" fill="transparent"/></svg><div class="tip"></div>`;
  const svg = el.querySelector("svg"), hit = el.querySelector("rect"), cur = el.querySelector(".cursor"), cp = el.querySelector(".pt"), tip = el.querySelector(".tip");
  const show = e => {
    const r = svg.getBoundingClientRect(), sx = (e.clientX - r.left) * W / r.width;
    const i = clamp(Math.round((sx - P.l) / ((W - P.l - P.r) / (n - 1))), 0, n - 1), x = X(i), y = Y(pts[i].y);
    cur.setAttribute("x1", x); cur.setAttribute("x2", x); cur.setAttribute("visibility", "visible");
    cp.setAttribute("cx", x); cp.setAttribute("cy", y); cp.setAttribute("visibility", "visible");
    tip.innerHTML = `<b>${pts[i].lab}</b> ${usd(pts[i].y)}${S.fx ? `<br>খাঁটি সোনা ${taka(pts[i].y / G_OZ * G_BHORI * S.fx)} / ভরি` : ""}`;
    tip.style.left = clamp(x * r.width / W, 100, r.width - 100) + "px"; tip.style.top = (y * r.height / H) + "px"; tip.classList.add("on");
  };
  const hide = () => { cur.setAttribute("visibility", "hidden"); cp.setAttribute("visibility", "hidden"); tip.classList.remove("on"); };
  hit.addEventListener("pointermove", show); hit.addEventListener("pointerdown", show); hit.addEventListener("pointerleave", hide);
}

/* ---------- calculator ---------- */
function calc() {
  const v = id => Math.max(0, parseFloat($(id).value) || 0);
  const bh = v("cBhori") + v("cAna") / 16 + v("cRati") / 96;
  const gold = BJ.current.perBhori[$("cKarat").value] * bh, mk = gold * v("cMake") / 100;
  $("rWv").textContent = `${bn(bh * G_BHORI, 2)} গ্রাম`;
  $("rGold").textContent = taka(gold); $("rMake").textContent = taka(mk); $("rTotal").textContent = taka(gold + mk);
}

/* ---------- status & loop ---------- */
function status() {
  const st = S.loading ? "loading" : !S.updated || S.failed ? "error" : "live";
  $("live").dataset.state = st; $("tk").dataset.state = st;
  if (S.loading && !S.updated) { $("liveText").textContent = "দাম আনা হচ্ছে…"; $("tkStatus").textContent = "দাম আনা হচ্ছে…"; return; }
  if (!S.updated) { $("liveText").textContent = "সংযোগ নেই"; $("tkStatus").textContent = "সংযোগ নেই"; return; }
  const label = S.failed ? "শেষ জানা দাম" : S.spot.live ? "লাইভ" : "দৈনিক দাম";
  $("liveText").textContent = `${label}, ${tsFmt.format(S.updated)}`;
  $("tkStatus").textContent = `${label} ${tFmt.format(S.updated)}`;
  const left = Math.max(0, Math.ceil((S.nextAt - Date.now()) / 1e3));
  $("nextUp").textContent = `পরের আপডেট ${bn(left)} সেকেন্ডে`;
}
function busy(on) {
  S.loading = on;
  const b = $("refreshBtn"); b.disabled = on; b.setAttribute("aria-busy", String(on));
  $("refreshIco").hidden = on; $("refreshSpin").hidden = !on;
  $("refreshLabel").textContent = on ? "আনা হচ্ছে…" : "রিফ্রেশ";
  status();
}
function renderAll(prev) { renderBD(); renderMarket(prev); renderTable(); renderSignal(); renderHistory(); drawChart(); calc(); }

async function loadBajus() {
  try {
    const d = await getJSON(C.dataUrl + "?t=" + Date.now(), 8000);
    if (d && d.current && d.current.perBhori && d.current.perBhori.k22 > 0) {
      const changed = d.current.perBhori.k22 !== BJ.current.perBhori.k22 || d.current.date !== BJ.current.date;
      BJ = d;
      if (changed) renderAll();
    }
  } catch (e) {}
  S.bajusAt = Date.now();
}
async function update() {
  if (S.loading) return;
  const prev = S.spot && S.spot.usd;
  busy(true);
  try {
    const needFx = !S.fx || Date.now() - (S.fxAt || 0) > C.fxMinutes * 60e3;
    const [spot, fx, hist] = await Promise.all([
      fetchSpot(),
      needFx ? fetchFx().then(v => { S.fxAt = Date.now(); return v; }).catch(() => S.fx) : S.fx,
      S.hist.length ? S.hist : fetchHistory().catch(() => [])
    ]);
    S.spot = spot; S.fx = fx; S.hist = hist; S.updated = new Date(); S.failed = false;
    store.set("sd_last", { spot, fx, t: S.updated.getTime() });
    addTick(); $("alert").classList.remove("show");
  } catch (e) {
    const last = store.get("sd_last", null);
    if (last && !S.spot) { S.spot = last.spot; S.fx = last.fx; S.updated = new Date(last.t); }
    S.failed = true;
    const a = $("alert"); a.textContent = "বিশ্ববাজারের দাম আনা যায়নি। ইন্টারনেট সংযোগ দেখে রিফ্রেশ চাপুন। বাংলাদেশের দাম ঠিক আছে।"; a.classList.add("show");
  }
  S.nextAt = Date.now() + C.spotSeconds * 1e3;
  busy(false);
  renderAll(prev);
  if (Date.now() - (S.bajusAt || 0) > C.bajusMinutes * 60e3) loadBajus();
}

/* ---------- events ---------- */
$("refreshBtn").addEventListener("click", update);
function setRange(r, push) {
  S.range = r;
  document.querySelectorAll("[data-range]").forEach(b => b.setAttribute("aria-selected", String(b.dataset.range === r)));
  $("chartSub").textContent = r === "today" ? "আজ পাতা খোলা থাকার সময় প্রতি মিনিটের দাম, ডলার প্রতি আউন্স।" : "ডলার প্রতি আউন্স। চার্টে আঙুল বা মাউস রাখলে টাকায় ভরির দামও দেখা যাবে।";
  if (push) { const u = new URL(location.href); u.searchParams.set("range", r); history.replaceState(null, "", u); }
  drawChart();
}
document.querySelectorAll("[data-range]").forEach(b => b.addEventListener("click", () => setRange(b.dataset.range, true)));
document.querySelector('[role="tablist"]').addEventListener("keydown", e => {
  if (!["ArrowLeft", "ArrowRight"].includes(e.key)) return;
  const tabs = [...document.querySelectorAll("[data-range]")], i = tabs.findIndex(t => t.dataset.range === S.range);
  const n = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length]; n.focus(); setRange(n.dataset.range, true);
});
["cBhori", "cAna", "cRati", "cMake", "cKarat"].forEach(id => $(id).addEventListener("input", calc));
const menuBtn = $("menuBtn"), nav = $("nav");
menuBtn.addEventListener("click", () => { const o = nav.classList.toggle("open"); menuBtn.setAttribute("aria-expanded", String(o)); });
nav.addEventListener("click", e => { if (e.target.closest("a")) { nav.classList.remove("open"); menuBtn.setAttribute("aria-expanded", "false"); } });
const pageUrl = encodeURIComponent(location.href.split("?")[0]);
$("shareFb").href = "https://www.facebook.com/sharer/sharer.php?u=" + pageUrl;
$("shareWa").href = "https://wa.me/?text=" + encodeURIComponent("আজকের সোনার দাম: ") + pageUrl;
$("copyLink").addEventListener("click", async e => {
  const b = e.currentTarget;
  try { await navigator.clipboard.writeText(location.href.split("?")[0]); b.textContent = "লিংক কপি হয়েছে"; }
  catch (x) { b.textContent = "কপি করা যায়নি"; }
  setTimeout(() => (b.textContent = "লিংক কপি করুন"), 2500);
});
$("copyright").textContent = `© ${bn(new Date().getFullYear()).replace(/,/g, "")} সোনার দর`;
let rz; new ResizeObserver(() => { clearTimeout(rz); rz = setTimeout(drawChart, 120); }).observe($("chartEl"));
setInterval(() => { if (!document.hidden && !S.loading && S.nextAt && Date.now() >= S.nextAt) update(); else status(); }, 1000);
document.addEventListener("visibilitychange", () => { if (!document.hidden && S.nextAt && Date.now() >= S.nextAt) update(); });

renderAll(); setRange(S.range, false);
loadBajus().then(update);
})();
