// বাজুসের দাম নিজে থেকে আনার স্ক্রিপ্ট। GitHub Actions প্রতি ২০ মিনিটে চালায়।
// Node 20+, কোনো প্যাকেজ লাগে না।  চালাতে: node scripts/update-bajus.mjs
import { readFile, writeFile, appendFile } from "node:fs/promises";

const DATA = new URL("../assets/data/bajus.json", import.meta.url);
const G_BHORI = 11.664;
const SOURCES = [
  { name: "bajus.org", url: "https://www.bajus.org/gold-price/", official: true },
  { name: "bajus.org (মূল্য কমিটি)", url: "https://bajus.org/index.php/memberinfo/standing-committee/pricing-and-price-monitoring", official: true },
  { name: "goldpricebd.bd", url: "https://goldpricebd.bd/" },
  { name: "gold-bd.com", url: "https://gold-bd.com/" },
  { name: "goldbd.org", url: "https://goldbd.org/gold-price/" },
  { name: "alaminjewellers.com", url: "https://www.alaminjewellers.com/gold-price/" },
  { name: "bdgoldrate.com", url: "https://bdgoldrate.com/" }
];
// বাজুসের চার মানের দামের অনুপাত বছরের পর বছর প্রায় স্থির (২১K≈০.৯৫৫, ১৮K≈০.৮২০, সনাতন≈০.৬৭০)
const RATIOS = { k21: [0.948, 0.962], k18: [0.812, 0.828], trad: [0.660, 0.678] };

const BN = "০১২৩৪৫৬৭৮৯";
const toAscii = s => s.replace(/[০-৯]/g, d => String(BN.indexOf(d)));

export function extract(html) {
  const text = toAscii(html)
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/g, " ");
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

async function get(url, ms = 20000) {
  const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal, redirect: "follow",
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        "accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        "accept-language": "bn-BD,bn;q=0.9,en;q=0.8"
      }
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.text();
  } finally { clearTimeout(t); }
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

export async function main() {
  const data = JSON.parse(await readFile(DATA, "utf8"));
  const cur = data.current.perBhori;

  const results = await Promise.all(SOURCES.map(async s => {
    try { const p = extract(await get(s.url)); console.log(`${s.name}: ${p ? JSON.stringify(p) : "দাম খুঁজে পাওয়া যায়নি"}`); return p && { ...s, p }; }
    catch (e) { console.log(`${s.name}: ব্যর্থ (${e.message})`); return null; }
  }));
  const ok = results.filter(Boolean);

  let chosen = ok.find(r => r.official);
  if (!chosen) {
    const votes = {};
    ok.forEach(r => { (votes[r.p.k22] ||= []).push(r); });
    const best = Object.values(votes).sort((a, b) => b.length - a.length)[0];
    if (best && best.length >= 2) chosen = best[0];
  }
  let changed = false;
  if (!chosen) console.log("কোনো নির্ভরযোগ্য দাম পাওয়া যায়নি; আগের দাম রাখা হলো।");
  else if (!chosen.official && Math.abs(chosen.p.k22 / cur.k22 - 1) > 0.2) console.log("দামের পরিবর্তন অস্বাভাবিক বড়; বাদ দেওয়া হলো।");
  else if (!chosen.official && chosen.p.k22 !== cur.k22 && data.history.slice(-6, -1).some(h => h.k22 === chosen.p.k22))
    console.log("অন্য সাইটগুলো এখনও পুরোনো দাম দেখাচ্ছে; আগের দাম রাখা হলো।");
  else if (["k22", "k21", "k18", "trad"].some(k => chosen.p[k] !== cur[k])) {
    const now = new Date();
    data.current = { date: dhaka(now), updatedAt: now.toISOString(), source: chosen.name, perBhori: chosen.p, ref: await marketRef() };
    data.history = data.history.filter(h => h.date !== data.current.date);
    data.history.push({ date: data.current.date, k22: chosen.p.k22 });
    data.history = data.history.slice(-60);
    await writeFile(DATA, JSON.stringify(data, null, 2) + "\n");
    changed = true;
    console.log(`নতুন দাম সেভ হলো (${chosen.name}): ২২K ${chosen.p.k22}`);
  } else console.log("দাম অপরিবর্তিত।");

  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(e => { console.error(e); process.exit(0); });
