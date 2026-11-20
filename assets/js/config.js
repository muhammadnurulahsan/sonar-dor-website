/* সেটিংস। বাজুসের দাম এখানে বদলাতে হয় না:
   GitHub Actions প্রতি ২০ মিনিটে নিজে থেকে assets/data/bajus.json হালনাগাদ করে।
   নিচের "fallback" শুধু তখনই ব্যবহার হয় যদি ওই ফাইলটি কোনো কারণে লোড না হয়। */
window.GOLD_CONFIG = {
  spotSeconds: 60,          // বিশ্ববাজারের দাম কত সেকেন্ড পরপর আসবে
  fxMinutes: 15,            // ডলারের রেট কত মিনিট পরপর
  bajusMinutes: 10,         // বাজুস ডেটা ফাইল কত মিনিট পরপর আবার পড়বে
  historyDays: 30,
  dataUrl: "assets/data/bajus.json",
  fallback: {
    current: { date: "2026-11-20", perBhori: { k22: 201146, k21: 192106, k18: 164987, trad: 134836 }, ref: null },
    history: [{ date: "2026-11-19", k22: 212110 }, { date: "2026-11-20", k22: 201146 }]
  }
};
