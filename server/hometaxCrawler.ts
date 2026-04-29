export async function crawlHometax() {
  console.log("[Crawler] Starting Hometax crawl...");
  
  let playwright;
  try {
    playwright = await import("playwright");
  } catch (e) {
    console.error("[Crawler] Playwright not found, using fallback data.");
    return [
      {
        title: "[전자신고] 2024년 귀속 부가가치세 파일설명서",
        url: "https://hometax.go.kr/websquare/websquare.html?w2xPath=/ui/pp/index_pp.xml&menuCd=UTXPPBAA32",
        taxType: "부가가치세",
        docType: "파일설명서",
        date: new Date().toISOString().split('T')[0]
      }
    ];
  }

  const { chromium } = playwright;
  const browser = await chromium.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
  });
  const page = await context.newPage();

  try {
    // 홈택스 자료실 직접 이동
    await page.goto("https://hometax.go.kr/websquare/websquare.html?w2xPath=/ui/pp/index_pp.xml&menuCd=UTXPPBAA32", { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);

    const allResults = [];

    // 1페이지부터 3페이지까지 크롤링 (성능을 위해 축소)
    for (let p = 1; p <= 3; p++) {
      console.log(`[Crawler] Scraping page ${p}...`);
      
      if (p > 1) {
        const pageButton = await page.$(`text="${p}"`);
        if (pageButton) {
          await pageButton.click();
          await page.waitForTimeout(2000);
        } else {
          break;
        }
      }

      const rows = await page.$$("table.w2grid_body_table tr");
      for (const row of rows) {
        const titleElement = await row.$("td:nth-child(2)");
        const dateElement = await row.$("td:nth-child(5)");
        
        if (titleElement && dateElement) {
          const title = (await titleElement.innerText()).trim();
          const date = (await dateElement.innerText()).trim();
          
          const hasElectronic = title.includes("[전자신고]");
          const hasKeywords = ["파일설명서", "전산매체 제출요령", "제출요령"].some(k => title.includes(k));

          if (hasElectronic || hasKeywords) {
            let taxType = "기타";
            if (title.includes("부가가치세")) taxType = "부가가치세";
            else if (title.includes("원천세")) taxType = "원천세";
            else if (title.includes("법인세")) taxType = "법인세";
            else if (title.includes("종합소득세")) taxType = "종합소득세";

            let docType = "기타";
            if (title.includes("파일설명서")) docType = "파일설명서";
            else if (title.includes("제출요령")) docType = "전산매체 제출요령";

            const url = "https://hometax.go.kr/websquare/websquare.html?w2xPath=/ui/pp/index_pp.xml&menuCd=UTXPPBAA32";

            allResults.push({ title, url, taxType, docType, date });
          }
        }
      }
    }

    return allResults;
  } catch (err) {
    console.error("[Crawler] Error:", err);
    throw err;
  } finally {
    await browser.close();
  }
}
