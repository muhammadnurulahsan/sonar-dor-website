// বাজুসের দাম নিজে থেকে আনার স্ক্রিপ্ট। GitHub Actions প্রতি ২০ মিনিটে চালায়।
// Node 20+, কোনো প্যাকেজ লাগে না।  চালাতে: node scripts/update-bajus.mjs
// হাতে দাম বসাতে: MANUAL_K22=... MANUAL_K21=... MANUAL_K18=... MANUAL_TRAD=... node scripts/update-bajus.mjs
import { readFile, writeFile, appendFile } from "node:fs/promises";
import { existsSync } from "node:fs";

const DATA = new URL("../assets/data/bajus.json", import.meta.url);
const G_BHORI = 11.664;
const BAJUS_PAGES = [
  "https://bajus.org/gold-price",
  "https://www.bajus.org/gold-price/",
  "https://bajus.org/index.php/memberinfo/standing-committee/pricing-and-price-monitoring"
];
// bajus.org সাধারণ fetch-কে Cloudflare দিয়ে আটকায়; আসল পথ হলো ব্রাউজার (scripts/bajus-browser.mjs)।
const SOURCES = [
  ...BAJUS_PAGES.map(url => ({ name: "bajus.org", url, official: true })),
  { name: "goldpricebd.bd", url: "https://goldpricebd.bd/" },
  { name: "gold-bd.com", url: "https://gold-bd.com/" },
  { name: "goldbd.org", url: "https://goldbd.org/gold-price/" },
  { name: "alaminjewellers.com", url: "https://www.alaminjewellers.com/gold-price/" },
  { name: "bdgoldrate.com", url: "https://bdgoldrate.com/" },
  { name: "sonardaam.com", url: "https://sonardaam.com/" },
  { name: "goldr.org", url: "https://www.goldr.org/" }
];
// বাজুসের চার মানের দামের অনুপাত প্রায় স্থির (২১K≈০.৯৫৫, ১৮K≈০.৮২০, সনাতন≈০.৬৭০)
const RATIOS = { k21: [0.948, 0.962], k18: [0.812, 0.828], trad: [0.655, 0.680] };
const KEYS = ["k22", "k21", "k18", "trad"];

const BN = "০১২৩৪৫৬৭৮৯";
const toAscii = s => s.replace(/[০-৯]/g, d => String(BN.indexOf(d)));
const plain = html => toAscii(html)
  .replace(/<script[\s\S]*?<\/script>/gi, " ")
  .replace(/<style[\s\S]*?<\/style>/gi, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;|&#160;/g, " ")
  .replace(/\s+/g, " ");

export function valid(p) {
  if (!p || KEYS.some(k => !(p[k] > 0))) return false;
  if (p.k22 < 60000 || p.k22 > 700000) return false;
  return KEYS.slice(1).every(k => p[k] / p.k22 >= RATIOS[k][0] && p[k] / p.k22 <= RATIOS[k][1]);
}

export function extract(html) {
  const text = plain(html);
  const nums = [];
  const re = /\d{1,3}(?:,\d{2,3})+(?:\.\d+)?|\d{4,6}(?:\.\d+)?/g;
  let m;
  while ((m = re.exec(text))) nums.push({ v: parseFloat(m[0].replace(/,/g, "")), i: m.index });
  const within = (v, a, [lo, hi]) => v / a >= lo && v / a <= hi;
  for (const scale of [{ min: 60000, max: 700000, f: 1 }, { min: 5000, max: 60000, f: G_BHORI }]) {
    for (let k = 0; k < nums.length; k++) {
      const a = nums[k];
      if (a.v < scale.min || a.v > scale.max) continue;
      const win = nums.filter(n => n.i > a.i && n.i - a.i < 2500 && n.v >= scale.min * 0.5 && n.v <= scale.max);
      const pick = (key, after) => after && win.find(n => n.i > after.i && within(n.v, a.v, RATIOS[key]));
      const b = pick("k21", a), c = pick("k18", b), d = pick("trad", c);
      if (b && c && d) {
        const r = v => Math.round(v * scale.f);
        return { k22: r(a.v), k21: r(b.v), k18: r(c.v), trad: r(d.v) };
      }
    }
  }
  return null;
}

async function get(url, ms = 25000) {
  let last;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), ms);
    try {
      const r = await fetch(url, {
        signal: ctrl.signal, redirect: "follow",
        headers: {
          "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
          "accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
          "accept-language": "bn-BD,bn;q=0.9,en;q=0.8",
          "cache-control": "no-cache"
        }
      });
      if (!r.ok) throw new Error("HTTP " + r.status);
      return await r.text();
    } catch (e) {
      last = e;
      if (attempt === 1) await new Promise(res => setTimeout(res, 3000));
    } finally { clearTimeout(t); }
  }
  throw last;
}

async function marketRef() {
  try {
    const [g, f] = await Promise.all([
      get("https://api.gold-api.com/price/XAU").then(JSON.parse),
      get("https://open.er-api.com/v6/latest/USD").then(JSON.parse)
    ]);
    if (g.price > 0 && f.rates?.BDT > 0) return { usd: +g.price, fx: +f.rates.BDT };
  } catch (e) { console.log("বিশ্ববাজারের রেফারেন্স আনা যায়নি:", e.message); }
  return null;
}

const dhaka = d => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

function manualInput() {
  const p = {};
  for (const k of KEYS) p[k] = Math.round(Number(String(process.env["MANUAL_" + k.toUpperCase()] || "").replace(/[,\s]/g, "")));
  if (KEYS.every(k => !p[k])) return null;
  if (!valid(p)) { console.log("হাতে দেওয়া দাম অসম্পূর্ণ বা অনুপাত মিলছে না; বাতিল:", JSON.stringify(p)); return null; }
  return { name: "বাজুস (হাতে হালনাগাদ)", official: true, p };
}

async function fromBrowser() {
  const f = process.env.BAJUS_BROWSER_FILE;
  if (!f || !existsSync(f)) { console.log("✘ bajus.org (ব্রাউজার): পেজ পাওয়া যায়নি"); return null; }
  const p = extract(await readFile(f, "utf8"));
  if (p && valid(p)) { console.log(`✔ bajus.org (ব্রাউজার): ${JSON.stringify(p)}`); return { name: "bajus.org", official: true, p }; }
  console.log("✘ bajus.org (ব্রাউজার): পেজ খুলেছে কিন্তু দাম বের করা যায়নি");
  return null;
}

async function scrape() {
  const browser = await fromBrowser();
  if (browser) return { chosen: browser };
  const results = await Promise.all(SOURCES.map(async s => {
    try {
      const html = await get(s.url);
      const p = extract(html);
      if (p && valid(p)) { console.log(`✔ ${s.name}: ${JSON.stringify(p)}`); return { ...s, p }; }
      const t = plain(html), i = t.search(/ক্যারেট|karat|carat/i);
      console.log(`✘ ${s.name}: দাম খুঁজে পাওয়া যায়নি (${html.length} bytes) … ${i >= 0 ? t.slice(Math.max(0, i - 80), i + 220) : t.slice(0, 200)}`);
    } catch (e) { console.log(`✘ ${s.name}: ব্যর্থ (${e.message})`); }
    return null;
  }));
  const ok = results.filter(Boolean);

  // ১) বাজুসের নিজের সাইট (সরাসরি বা রিডার দিয়ে) — সবচেয়ে নির্ভরযোগ্য
  const official = ok.find(r => r.official);
  if (official) return { chosen: official };

  // ২) বাজুস না পেলে: অন্তত ২টি সাইটে হুবহু একই দাম থাকতে হবে
  const votes = {};
  ok.forEach(r => { (votes[KEYS.map(k => r.p[k]).join("|")] ||= []).push(r); });
  const best = Object.values(votes).sort((a, b) => b.length - a.length)[0];
  if (best && best.length >= 2) return { chosen: { ...best[0], name: best.map(r => r.name).join(" + ") }, votes: best.length };
  return {};
}

export async function main() {
  const data = JSON.parse(await readFile(DATA, "utf8"));
  const cur = data.current.perBhori;

  let chosen = manualInput(), votes = 0;
  if (chosen) console.log("হাতে দেওয়া দাম ব্যবহার হচ্ছে:", JSON.stringify(chosen.p));
  else ({ chosen, votes = 0 } = await scrape());

  let changed = false;
  if (!chosen) console.log("কোনো নির্ভরযোগ্য দাম পাওয়া যায়নি; আগের দাম রাখা হলো।");
  else if (!chosen.official && Math.abs(chosen.p.k22 / cur.k22 - 1) > 0.2) console.log("দামের পরিবর্তন অস্বাভাবিক বড়; বাদ দেওয়া হলো।");
  else if (!chosen.official && votes < 3 && data.history.length >= 2 && data.history[data.history.length - 2].k22 === chosen.p.k22)
    console.log("মাত্র ২টি সাইট আগের দিনের দাম দেখাচ্ছে (সম্ভবত পুরোনো); আগের দাম রাখা হলো।");
  else if (KEYS.some(k => chosen.p[k] !== cur[k])) {
    const now = new Date();
    data.current = { date: dhaka(now), updatedAt: now.toISOString(), source: chosen.name, perBhori: chosen.p, ref: await marketRef() };
    data.history = data.history.filter(h => h.date !== data.current.date);
    data.history.push({ date: data.current.date, k22: chosen.p.k22 });
    data.history = data.history.slice(-60);
    await writeFile(DATA, JSON.stringify(data, null, 2) + "\n");
    changed = true;
    console.log(`নতুন দাম সেভ হলো (${chosen.name}): ২২K ${cur.k22} → ${chosen.p.k22}`);
  } else console.log(`দাম অপরিবর্তিত (২২K ${cur.k22}, উৎস: ${chosen.name})।`);

  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(e => { console.error(e); process.exit(0); });
