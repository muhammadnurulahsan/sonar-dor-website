// আসল Chrome ব্রাউজার দিয়ে bajus.org খুলে পেজের লেখা সেভ করে।
// bajus.org-এর Cloudflare সুরক্ষা সাধারণ fetch আটকে দেয়, তাই এই পথ।
// ফলাফল: BAJUS_BROWSER_FILE (ডিফল্ট /tmp/bajus-browser.txt) ফাইলে পেজের লেখা।
import { chromium } from "playwright-core";
import { writeFile, appendFile } from "node:fs/promises";

const OUT = process.env.BAJUS_BROWSER_FILE || "/tmp/bajus-browser.txt";
const SHOT = "/tmp/bajus-browser.png";
const URLS = ["https://bajus.org/gold-price", "https://www.bajus.org/gold-price/"];
const headed = !!process.env.DISPLAY;

const setOutput = async (k, v) => { if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `${k}=${v}\n`); };

const browser = await chromium.launch({
  channel: "chrome",                 // GitHub-এর ubuntu-latest-এ Google Chrome আগে থেকেই ইনস্টল থাকে
  headless: !headed,
  args: ["--disable-blink-features=AutomationControlled", "--no-sandbox", "--lang=bn-BD"]
});
let ok = false;
try {
  const ctx = await browser.newContext({
    locale: "bn-BD", timezoneId: "Asia/Dhaka", viewport: { width: 1366, height: 900 }
  });
  await ctx.addInitScript(() => Object.defineProperty(navigator, "webdriver", { get: () => undefined }));
  const page = await ctx.newPage();

  for (const url of URLS) {
    try {
      console.log(`খোলা হচ্ছে: ${url} (${headed ? "headed" : "headless"})`);
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
      // Cloudflare-এর "Just a moment…" পেজ নিজে থেকে পার হতে ৫-২০ সেকেন্ড লাগে
      for (let i = 0; i < 45; i++) {
        const title = await page.title().catch(() => "");
        const body = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
        if (!/just a moment|attention required/i.test(title) && /karat|ক্যারেট/i.test(body) && /gram|ভরি/i.test(body)) {
          await writeFile(OUT, body);
          console.log(`✔ পেজ পাওয়া গেছে (${body.length} অক্ষর), শিরোনাম: ${title}`);
          ok = true;
          break;
        }
        await page.waitForTimeout(1000);
      }
      if (ok) break;
      console.log(`✘ ${url}: ৪৫ সেকেন্ডেও আসল পেজ আসেনি (শিরোনাম: ${await page.title().catch(() => "?")})`);
    } catch (e) { console.log(`✘ ${url}: ${e.message.split("\n")[0]}`); }
  }
  if (!ok) await page.screenshot({ path: SHOT, fullPage: true }).catch(() => {});
} finally {
  await browser.close();
  await setOutput("ok", ok);
}
