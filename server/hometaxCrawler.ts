import { chromium, Browser, Page } from "playwright";
import { InsertHometaxNotice } from "../drizzle/schema";
import { insertHometaxNotice, insertNotification, urlExists } from "./db";

const HOMETAX_URL = "https://hometax.go.kr";

// 세금 유형 분류
function classifyTaxType(title: string): InsertHometaxNotice["taxType"] {
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
  const hasTitleKeyword =
    title.includes("[전자신고]") || title.includes("전산매체 제출요령");
  const docType = classifyDocType(title);
  return hasTitleKeyword && docType !== null;
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
 * 사진 기반 클릭 시나리오:
 * 1. 홈택스 메인 페이지 접속
 * 2. 우측 상단 메뉴 버튼(☰) 클릭
 * 3. 좌측 메뉴에서 "기타" 클릭
 * 4. 우측 영역에서 "자료실" 클릭
 * 5. 테이블에서 데이터 추출
 */
async function crawlHometaxLibraryWithPlaywright(): Promise<NoticeItem[]> {
  let browser: Browser | null = null;
  const results: NoticeItem[] = [];

  try {
    console.log("[Playwright Crawler] Starting browser...");
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const context = await browser.createBrowserContext();
    const page = await context.newPage();

    // 타임아웃 설정
    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(30000);

    console.log("[Playwright Crawler] Navigating to Hometax main page...");
    await page.goto(HOMETAX_URL, { waitUntil: "networkidle" });

    // 1️⃣ 우측 상단 메뉴 버튼(☰) 클릭
    console.log("[Playwright Crawler] Clicking menu button...");
    try {
      // 메뉴 버튼 선택자 시도 (여러 가능성)
      const menuSelectors = [
        'button[aria-label*="메뉴"]',
        'button[class*="menu"]',
        'a[class*="menu"]',
        'button:has-text("전체메뉴")',
        'a:has-text("전체메뉴")',
        '[role="button"]:has-text("전체메뉴")',
        // 일반적인 햄버거 메뉴 선택자
        'button[class*="hamburger"]',
        'button[class*="toggle"]',
      ];

      let menuClicked = false;
      for (const selector of menuSelectors) {
        try {
          const element = page.locator(selector).first();
          if (await element.isVisible({ timeout: 2000 })) {
            await element.click({ timeout: 5000 });
            menuClicked = true;
            console.log(
              `[Playwright Crawler] Menu clicked with selector: ${selector}`
            );
            await page.waitForTimeout(1500);
            break;
          }
        } catch (e) {
          // 계속 시도
        }
      }

      if (!menuClicked) {
        console.warn(
          "[Playwright Crawler] Could not find menu button, trying keyboard shortcut..."
        );
        // 대체: 키보드 단축키 시도
        await page.keyboard.press("Escape");
        await page.waitForTimeout(500);
      }
    } catch (e) {
      console.warn("[Playwright Crawler] Menu click failed:", e);
    }

    // 2️⃣ 좌측 메뉴에서 "기타" 클릭
    console.log("[Playwright Crawler] Looking for '기타' menu item...");
    try {
      const etcSelectors = [
        'text="기타"',
        '[class*="menu"] >> text="기타"',
        'li >> text="기타"',
        'div >> text="기타"',
      ];

      let etcClicked = false;
      for (const selector of etcSelectors) {
        try {
          const element = page.locator(selector).first();
          if (await element.isVisible({ timeout: 2000 })) {
            await element.click({ timeout: 5000 });
            etcClicked = true;
            console.log(
              `[Playwright Crawler] '기타' clicked with selector: ${selector}`
            );
            await page.waitForTimeout(1000);
            break;
          }
        } catch (e) {
          // 계속 시도
        }
      }

      if (!etcClicked) {
        console.warn("[Playwright Crawler] Could not click '기타' menu");
      }
    } catch (e) {
      console.warn("[Playwright Crawler] Error clicking '기타':", e);
    }

    // 3️⃣ 우측 영역에서 "자료실" 클릭
    console.log("[Playwright Crawler] Looking for '자료실' link...");
    try {
      const librarySelectors = [
        'text="자료실"',
        'a >> text="자료실"',
        '[class*="menu"] >> text="자료실"',
        'li >> text="자료실"',
        'div >> text="자료실"',
      ];

      let libraryClicked = false;
      for (const selector of librarySelectors) {
        try {
          const element = page.locator(selector).first();
          if (await element.isVisible({ timeout: 2000 })) {
            await element.click({ timeout: 5000 });
            libraryClicked = true;
            console.log(
              `[Playwright Crawler] '자료실' clicked with selector: ${selector}`
            );
            await page.waitForTimeout(2000);
            break;
          }
        } catch (e) {
          // 계속 시도
        }
      }

      if (!libraryClicked) {
        console.warn("[Playwright Crawler] Could not click '자료실' link");
      }
    } catch (e) {
      console.warn("[Playwright Crawler] Error clicking '자료실':", e);
    }

    // 4️⃣ 자료실 페이지에서 테이블 데이터 추출
    console.log("[Playwright Crawler] Extracting notice list from table...");
    await page.waitForTimeout(2000);

    // 테이블 행 추출
    const notices = await page.evaluate(() => {
      const items: NoticeItem[] = [];

      // 테이블 행 선택자 (사진 기반)
      const tableRows = document.querySelectorAll("table tbody tr");

      if (tableRows.length === 0) {
        console.warn("[Evaluate] No table rows found");
        return items;
      }

      console.log(`[Evaluate] Found ${tableRows.length} table rows`);

      tableRows.forEach((row, idx) => {
        try {
          const cells = row.querySelectorAll("td");
          if (cells.length < 3) return;

          let title = "";
          let date = "";
          let url = "";

          // 셀 구조 분석 (사진 기반):
          // 0: 번호
          // 1: 제목 (링크)
          // 2~3: 기타 정보
          // 마지막-1: 등록일
          // 마지막: 조회수

          // 제목 추출 (2번째 셀)
          const titleCell = cells[1];
          if (titleCell) {
            const link = titleCell.querySelector("a");
            if (link) {
              title = link.textContent?.trim() || "";
              url = link.getAttribute("href") || "";

              // href가 없으면 onclick 속성에서 추출
              if (!url) {
                const onclick = link.getAttribute("onclick") || "";
                if (onclick) {
                  // onclick="openDetail('UTXPPBAA32', '2026-001')" 형식
                  const match = onclick.match(/openDetail\('([^']+)'/);
                  if (match) {
                    const menuCd = match[1];
                    url = `https://hometax.go.kr/websquare/websquare.html?w2xPath=/ui/pp/index_pp.xml&menuCd=${menuCd}`;
                  }
                }
              }
            }
          }

          // 등록일 추출 (마지막에서 2번째 셀)
          if (cells.length >= 2) {
            const dateCell = cells[cells.length - 2];
            if (dateCell) {
              date = dateCell.textContent?.trim() || "";
            }
          }

          // 데이터 검증 및 저장
          if (title && date && url) {
            // 날짜 형식 정규화
            const normalizedDate = date
              .replace(/(\d{4})\.(\d{1,2})\.(\d{1,2})/, "$1-$2-$3")
              .replace(/(\d{4})\/(\d{1,2})\/(\d{1,2})/, "$1-$2-$3")
              .replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3")
              .substring(0, 10);

            if (normalizedDate.match(/\d{4}-\d{2}-\d{2}/) && title.length > 0) {
              items.push({ title, date: normalizedDate, url });
              console.log(`[Evaluate] Row ${idx}: ${title} (${normalizedDate})`);
            }
          }
        } catch (e) {
          console.warn(`[Evaluate] Error parsing row ${idx}:`, e);
        }
      });

      return items;
    });

    results.push(...notices);
    console.log(`[Playwright Crawler] Extracted ${notices.length} notices`);

    // 페이지 정리
    await page.close();
    await context.close();
  } catch (err) {
    console.error("[Playwright Crawler] Error:", err);
  } finally {
    if (browser) {
      await browser.close();
    }
  }

  return results;
}

/**
 * 테스트용 샘플 데이터
 */
function getSampleNotices(): NoticeItem[] {
  return [
    {
      title: "[전자신고] 2026년 부가가치세 파일설명서",
      date: "2026-04-20",
      url: "https://hometax.go.kr/websquare/websquare.html?w2xPath=/ui/pp/index_pp.xml&menuCd=UTXPPBAA32",
    },
    {
      title: "[전자신고] 2026년 종합소득세 파일설명서",
      date: "2026-04-15",
      url: "https://hometax.go.kr/websquare/websquare.html?w2xPath=/ui/pp/index_pp.xml&menuCd=UTXPPBAA33",
    },
    {
      title: "[전자신고] 2026년 원천세 파일설명서",
      date: "2026-04-10",
      url: "https://hometax.go.kr/websquare/websquare.html?w2xPath=/ui/pp/index_pp.xml&menuCd=UTXPPBAA34",
    },
    {
      title: "부가가치세 전산매체 제출요령",
      date: "2026-04-05",
      url: "https://hometax.go.kr/websquare/websquare.html?w2xPath=/ui/pp/index_pp.xml&menuCd=UTXPPBAA35",
    },
  ];
}

/**
 * 홈택스 크롤러 실행
 */
export async function runHometaxCrawler(useSampleOnFail = false): Promise<CrawlResult> {
  const result: CrawlResult = { inserted: 0, skipped: 0, errors: 0 };

  let notices: NoticeItem[] = [];

  // 1차: Playwright 크롤러 시도
  console.log("[Crawler] Trying Playwright-based crawling...");
  try {
    notices = await crawlHometaxLibraryWithPlaywright();
  } catch (err) {
    console.error("[Crawler] Playwright crawling failed:", err);
  }

  // 크롤링 실패 시 샘플 데이터 사용 (테스트 환경)
  if (notices.length === 0) {
    console.warn(
      "[Crawler] Warning: Could not fetch any notices from Hometax. Using sample data for testing."
    );
    if (useSampleOnFail) {
      notices = getSampleNotices();
    }
  }

  console.log(`[Crawler] Found ${notices.length} notices to process`);

  // 중복 제거 (URL 기준)
  const uniqueNotices = Array.from(
    new Map(notices.map((n) => [n.url, n])).values()
  );

  for (const item of uniqueNotices) {
    if (!shouldCollect(item.title)) {
      result.skipped++;
      continue;
    }

    try {
      const exists = await urlExists(item.url);
      if (exists) {
        result.skipped++;
        continue;
      }

      const docType = classifyDocType(item.title);
      if (!docType) {
        result.skipped++;
        continue;
      }

      const insertId = await insertHometaxNotice({
        title: item.title,
        url: item.url,
        date: item.date,
        taxType: classifyTaxType(item.title),
        docType,
        viewCount: 0,
      });

      if (insertId !== null) {
        result.inserted++;
        // 알림 생성
        await insertNotification({
          noticeId: insertId,
          title: item.title,
          url: item.url,
          isRead: 0,
        });
      } else {
        result.skipped++;
      }
    } catch (err) {
      console.error("[Crawler] Error processing notice:", item.title, err);
      result.errors++;
    }
  }

  console.log(
    `[Crawler] Done: inserted=${result.inserted}, skipped=${result.skipped}, errors=${result.errors}`
  );
  return result;
}
