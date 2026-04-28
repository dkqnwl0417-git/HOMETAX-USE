import { InsertHometaxNotice } from "../drizzle/schema";
import { insertHometaxNotice, insertNotification, urlExists } from "./db";

const HOMETAX_URL = "https://hometax.go.kr";

// 세금 유형 분류
function classifyTaxType(title: string): InsertHometaxNotice["taxType"] {
  // [전자신고]가 포함된 경우에만 세목별 필터링 강화
  if (title.includes("[전자신고]")) {
    if (title.includes("부가가치세")) return "부가가치세";
    if (title.includes("종합소득세")) return "종합소득세";
    if (title.includes("법인세")) return "법인세";
    if (title.includes("원천세")) return "원천세";
    if (title.includes("양도소득세")) return "양도소득세";
    if (title.includes("상속세") || title.includes("증여세")) return "상속/증여세";
    if (title.includes("개별소비세")) return "개별소비세";
  }
  
  // 그 외의 경우나 명시적 세목이 없는 경우
  if (title.includes("부가가치세")) return "부가가치세";
  if (title.includes("종합소득세")) return "종합소득세";
  if (title.includes("원천세")) return "원천세";
  
  return "기타";
}

// 문서 유형 분류
function classifyDocType(title: string): InsertHometaxNotice["docType"] | null {
  if (title.includes("전산매체 제출요령")) return "전산매체 제출요령";
  if (title.includes("파일설명서")) return "파일설명서";
  return null;
}

// 수집 조건 확인
function shouldCollect(title: string): boolean {
  // 1. [전자신고] (괄호 포함) 단어가 있다면 무조건 포함
  if (title.includes("[전자신고]")) {
    return true;
  }

  // 2. [전자신고]가 없는 경우 특정 키워드 포함 시 포함
  const hasKeyword = title.includes("전산매체 제출요령") || title.includes("파일설명서");
  
  return hasKeyword;
}

export interface CrawlResult {
  inserted: number;
  skipped: number;
  errors: number;
}

interface NoticeItem {
  title: string;
  date: string;
  url: string;
}

/**
 * Playwright를 사용하여 홈택스 자료실에서 데이터를 수집합니다.
 */
async function crawlHometaxLibraryWithPlaywright(): Promise<NoticeItem[]> {
  let chromium;
  try {
    const playwright = await import("playwright");
    chromium = playwright.chromium;
  } catch (err) {
    console.error("[Playwright Crawler] Failed to import playwright:", err);
    return [];
  }

  let browser: any = null;
  const results: NoticeItem[] = [];

  try {
    console.log("[Playwright Crawler] Starting browser...");
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const context = await browser.createBrowserContext();
    const page = await context.newPage();

    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(30000);

    console.log("[Playwright Crawler] Navigating to Hometax main page...");
    await page.goto(HOMETAX_URL, { waitUntil: "networkidle" });

    // 1️⃣ 우측 상단 메뉴 버튼(☰) 클릭
    console.log("[Playwright Crawler] Clicking menu button...");
    try {
      const menuSelectors = [
        'button[aria-label*="메뉴"]',
        'button:has-text("전체메뉴")',
        'a:has-text("전체메뉴")',
        '[role="button"]:has-text("전체메뉴")',
        'button[class*="menu"]',
        'a[class*="menu"]',
      ];

      let menuClicked = false;
      for (const selector of menuSelectors) {
        try {
          const element = page.locator(selector).first();
          if (await element.isVisible({ timeout: 2000 })) {
            await element.click({ timeout: 5000 });
            menuClicked = true;
            console.log(`[Playwright Crawler] Menu clicked with selector: ${selector}`);
            await page.waitForTimeout(1500);
            break;
          }
        } catch (e) {}
      }

      if (!menuClicked) {
        await page.keyboard.press("Escape");
        await page.waitForTimeout(500);
      }
    } catch (e) {
      console.warn("[Playwright Crawler] Menu click failed:", e);
    }

    // 2️⃣ 좌측 메뉴에서 "기타" 클릭
    console.log("[Playwright Crawler] Looking for '기타' menu item...");
    try {
      const etcSelectors = ['text="기타"', 'li >> text="기타"', 'div >> text="기타"'];
      let etcClicked = false;
      for (const selector of etcSelectors) {
        try {
          const element = page.locator(selector).first();
          if (await element.isVisible({ timeout: 2000 })) {
            await element.click({ timeout: 5000 });
            etcClicked = true;
            console.log(`[Playwright Crawler] '기타' clicked with selector: ${selector}`);
            await page.waitForTimeout(1000);
            break;
          }
        } catch (e) {}
      }
    } catch (e) {
      console.warn("[Playwright Crawler] Error clicking '기타':", e);
    }

    // 3️⃣ 우측 영역에서 "자료실" 클릭
    console.log("[Playwright Crawler] Looking for '자료실' link...");
    try {
      const librarySelectors = ['text="자료실"', 'a >> text="자료실"', 'li >> text="자료실"'];
      let libraryClicked = false;
      for (const selector of librarySelectors) {
        try {
          const element = page.locator(selector).first();
          if (await element.isVisible({ timeout: 2000 })) {
            await element.click({ timeout: 5000 });
            libraryClicked = true;
            console.log(`[Playwright Crawler] '자료실' clicked with selector: ${selector}`);
            await page.waitForTimeout(2000);
            break;
          }
        } catch (e) {}
      }
    } catch (e) {
      console.warn("[Playwright Crawler] Error clicking '자료실':", e);
    }

    // 4️⃣ 자료실 페이지에서 테이블 데이터 추출
    console.log("[Playwright Crawler] Extracting notice list from table...");
    await page.waitForTimeout(2000);

    const notices = await page.evaluate(() => {
      const items: NoticeItem[] = [];
      const tableRows = document.querySelectorAll("table tbody tr");

      tableRows.forEach((row, idx) => {
        try {
          const cells = row.querySelectorAll("td");
          if (cells.length < 3) return;

          let title = "";
          let date = "";
          let url = "";

          const titleCell = cells[1];
          if (titleCell) {
            const link = titleCell.querySelector("a");
            if (link) {
              title = link.textContent?.trim() || "";
              const onclick = link.getAttribute("onclick") || "";
              if (onclick) {
                // openDetail('UTXPPBAA32', '2026-001') -> menuCd=UTXPPBAA32
                const match = onclick.match(/openDetail\s*\(\s*'([^']+)'/);
                if (match) {
                  url = `https://hometax.go.kr/websquare/websquare.html?w2xPath=/ui/pp/index_pp.xml&menuCd=${match[1]}`;
                }
              }
              if (!url) {
                url = link.getAttribute("href") || "";
              }
            }
          }

          if (cells.length >= 2) {
            const dateCell = cells[cells.length - 2];
            date = dateCell.textContent?.trim() || "";
          }

          if (title && date && url) {
            const normalizedDate = date
              .replace(/(\d{4})\.(\d{1,2})\.(\d{1,2})/, "$1-$2-$3")
              .replace(/(\d{4})\/(\d{1,2})\/(\d{1,2})/, "$1-$2-$3")
              .replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3")
              .substring(0, 10);

            if (normalizedDate.match(/\d{4}-\d{2}-\d{2}/)) {
              items.push({ title, date: normalizedDate, url });
            }
          }
        } catch (e) {}
      });
      return items;
    });

    results.push(...notices);
    await page.close();
    await context.close();
  } catch (err) {
    console.error("[Playwright Crawler] Error:", err);
  } finally {
    if (browser) await browser.close();
  }

  return results;
}

/**
 * 테스트용 샘플 데이터
 */
function getSampleNotices(): NoticeItem[] {
  return [
    {
      title: "[전자신고]부가가치세 전자신고 파일설명서(2026년 3월 23일 공지)",
      date: "2026-03-23",
      url: "https://hometax.go.kr/websquare/websquare.html?w2xPath=/ui/pp/index_pp.xml&menuCd=UTXPPBAA32",
    },
    {
      title: "[부가가치세] 첨부서류 전산매체작성 엑셀 프로그램(v.2.05)",
      date: "2026-04-20",
      url: "https://hometax.go.kr/websquare/websquare.html?w2xPath=/ui/pp/index_pp.xml&menuCd=UTXPPBAA33",
    },
    {
      title: "법인세 전산매체 제출요령 안내",
      date: "2026-03-10",
      url: "https://hometax.go.kr/websquare/websquare.html?w2xPath=/ui/pp/index_pp.xml&menuCd=UTXPPBAA34",
    },
  ];
}

/**
 * 홈택스 크롤러 실행
 */
export async function runHometaxCrawler(useSampleOnFail = false): Promise<CrawlResult> {
  const result: CrawlResult = { inserted: 0, skipped: 0, errors: 0 };
  let notices: NoticeItem[] = [];

  console.log("[Crawler] Trying Playwright-based crawling...");
  try {
    notices = await crawlHometaxLibraryWithPlaywright();
  } catch (err) {
    console.error("[Crawler] Playwright crawling failed:", err);
  }

  if (notices.length === 0 && useSampleOnFail) {
    console.warn("[Crawler] Using sample data for testing.");
    notices = getSampleNotices();
  }

  const uniqueNotices = Array.from(new Map(notices.map((n) => [n.url, n])).values());

  for (const item of uniqueNotices) {
    if (!shouldCollect(item.title)) {
      result.skipped++;
      continue;
    }

    try {
      if (await urlExists(item.url)) {
        result.skipped++;
        continue;
      }

      const docType = classifyDocType(item.title) || "기타";
      const taxType = classifyTaxType(item.title);

      const insertId = await insertHometaxNotice({
        title: item.title,
        url: item.url,
        date: item.date,
        taxType,
        docType,
        viewCount: 0,
        createdAt: new Date(),
      });

      if (insertId !== null) {
        result.inserted++;
        await insertNotification({
          noticeId: insertId,
          title: item.title,
          url: item.url,
          isRead: 0,
          createdAt: new Date(),
        });
      } else {
        result.skipped++;
      }
    } catch (err) {
      console.error("[Crawler] Error processing notice:", item.title, err);
      result.errors++;
    }
  }

  return result;
}
