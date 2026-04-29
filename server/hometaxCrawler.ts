import { chromium } from "playwright";

export async function crawlHometax() {
  console.log("[Crawler] Starting Hometax crawl...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
  });
  const page = await context.newPage();

  try {
    // 홈택스 자료실 직접 이동
    await page.goto("https://hometax.go.kr/websquare/websquare.html?w2xPath=/ui/pp/index_pp.xml&menuCd=UTXPPBAA32", { waitUntil: "networkidle" });
    await page.waitForTimeout(3000);

    const allResults = [];

    // 1페이지부터 5페이지까지 크롤링
    for (let p = 1; p <= 5; p++) {
      console.log(`[Crawler] Scraping page ${p}...`);
      
      // 페이지 번호 클릭 (1페이지는 이미 로드됨)
      if (p > 1) {
        const pageButton = await page.$(`text="${p}"`);
        if (pageButton) {
          await pageButton.click();
          await page.waitForTimeout(2000);
        } else {
          break;
        }
      }

      // 테이블 행 추출
      const rows = await page.$$("table.w2grid_body_table tr");
      for (const row of rows) {
        const titleElement = await row.$("td:nth-child(2)");
        const dateElement = await row.$("td:nth-child(5)");
        
        if (titleElement && dateElement) {
          const title = (await titleElement.innerText()).trim();
          const date = (await dateElement.innerText()).trim();
          
          // 키워드 필터링
          const hasElectronic = title.includes("[전자신고]");
          const hasKeywords = ["파일설명서", "전산매체 제출요령", "제출요령"].some(k => title.includes(k));

          if (hasElectronic || hasKeywords) {
            // 세무 유형 분류
            let taxType = "기타";
            if (title.includes("부가가치세")) taxType = "부가가치세";
            else if (title.includes("원천세")) taxType = "원천세";
            else if (title.includes("법인세")) taxType = "법인세";
            else if (title.includes("종합소득세")) taxType = "종합소득세";

            // 문서 유형 분류
            let docType = "기타";
            if (title.includes("파일설명서")) docType = "파일설명서";
            else if (title.includes("제출요령")) docType = "전산매체 제출요령";

            // 상세 페이지 URL (홈택스 특성상 클릭 이벤트가 복잡하므로 뷰 프록시 활용)
            // 실제 상세 URL을 따기 어려우므로 목록 페이지 URL을 기본으로 하되, 
            // 제목을 포함한 검색 결과 페이지 등으로 유도하는 로직이 필요할 수 있음.
            // 여기서는 일단 목록 페이지 URL을 보존함.
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
