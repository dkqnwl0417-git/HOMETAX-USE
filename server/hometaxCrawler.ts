import { InsertHometaxNotice } from "../drizzle/schema";
import { insertHometaxNotice, insertNotification } from "./db";

const HOMETAX_URL = "https://hometax.go.kr";
const HOMETAX_LIBRARY_URL =
  "https://hometax.go.kr/websquare/websquare.html?w2xPath=/ui/pp/index_pp.xml&tmIdx=16&tm2lIdx=1602000000&tm3lIdx=";

function classifyTaxType(title: string): InsertHometaxNotice["taxType"] {
  if (title.includes("부가가치세")) return "부가가치세";
  if (title.includes("종합소득세")) return "종합소득세";
  if (title.includes("법인세")) return "법인세";
  if (title.includes("원천세")) return "원천세";
  return "기타";
}

function classifyDocType(title: string): InsertHometaxNotice["docType"] | null {
  if (title.includes("전산매체 제출요령")) return "전산매체 제출요령";
  if (title.includes("전산매체")) return "전산매체 제출요령";
  if (title.includes("파일설명서")) return "파일설명서";
  return null;
}

function shouldCollect(title: string): boolean {
  return (
    title.includes("[전자신고]") ||
    title.includes("전산매체 제출요령") ||
    title.includes("전산매체") ||
    title.includes("파일설명서")
  );
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

function normalizeDate(dateText: string): string {
  const raw = dateText.trim();

  const patterns = [
    /(\d{4})\.(\d{1,2})\.(\d{1,2})/,
    /(\d{4})-(\d{1,2})-(\d{1,2})/,
    /(\d{4})\/(\d{1,2})\/(\d{1,2})/,
    /(\d{4})(\d{2})(\d{2})/,
  ];

  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match) {
      const [, y, m, d] = match;
      return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
    }
  }

  return "";
}

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
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    page.setDefaultTimeout(30000);
    page.setDefaultNavigationTimeout(30000);

    console.log("[Playwright Crawler] Navigating to Hometax...");
    await page.goto(HOMETAX_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await page.waitForTimeout(3000);

    const menuSelectors = [
      'button[aria-label*="메뉴"]',
      'button:has-text("전체메뉴")',
      'a:has-text("전체메뉴")',
      '[role="button"]:has-text("전체메뉴")',
      'button[class*="menu"]',
      'a[class*="menu"]',
    ];

    for (const selector of menuSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 2000 })) {
          await element.click({ timeout: 5000 });
          await page.waitForTimeout(1500);
          break;
        }
      } catch {}
    }

    const etcSelectors = ['text="기타"', 'li >> text="기타"', 'div >> text="기타"'];

    for (const selector of etcSelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 2000 })) {
          await element.click({ timeout: 5000 });
          await page.waitForTimeout(1000);
          break;
        }
      } catch {}
    }

    const librarySelectors = ['text="자료실"', 'a >> text="자료실"', 'li >> text="자료실"'];

    for (const selector of librarySelectors) {
      try {
        const element = page.locator(selector).first();
        if (await element.isVisible({ timeout: 2000 })) {
          await element.click({ timeout: 5000 });
          await page.waitForTimeout(3000);
          break;
        }
      } catch {}
    }

    for (let pageNo = 1; pageNo <= 3; pageNo++) {
      console.log(`[Playwright Crawler] Collecting page ${pageNo}...`);
      await page.waitForTimeout(2000);

      const notices = await page.evaluate((libraryUrl) => {
        const items: NoticeItem[] = [];
        const text = document.body.innerText || "";
        const lines = text
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];

          const isTarget =
            line.includes("[전자신고]") ||
            line.includes("파일설명서") ||
            line.includes("전산매체 제출요령") ||
            line.includes("전산매체");

          if (!isTarget) continue;

          const nearby = lines.slice(i, i + 8).join(" ");
          const dateMatch =
            nearby.match(/\d{4}[.-/]\d{1,2}[.-/]\d{1,2}/) ||
            nearby.match(/\d{8}/);

          if (!dateMatch) continue;

          items.push({
            title: line,
            date: dateMatch[0],
            url: libraryUrl,
          });
        }

        return items;
      }, HOMETAX_LIBRARY_URL);

      const normalized = notices
        .map((item) => ({
          ...item,
          date: normalizeDate(item.date),
        }))
        .filter((item) => item.title && item.date);

      console.log(`[Playwright Crawler] Page ${pageNo} collected ${normalized.length} items.`);
      results.push(...normalized);

      if (pageNo < 3) {
        try {
          const nextPageText = String(pageNo + 1);
          const nextPageButton = page
            .locator(
              `a:has-text("${nextPageText}"), button:has-text("${nextPageText}"), span:has-text("${nextPageText}")`
            )
            .last();

          if ((await nextPageButton.count()) > 0) {
            await nextPageButton.click({ timeout: 5000 });
            await page.waitForTimeout(2500);
          } else {
            console.warn(`[Playwright Crawler] Page ${nextPageText} button not found.`);
            break;
          }
        } catch (err) {
          console.warn(`[Playwright Crawler] Failed to move to page ${pageNo + 1}:`, err);
          break;
        }
      }
    }

    await page.close();
    await context.close();
  } catch (err) {
    console.error("[Playwright Crawler] Error:", err);
  } finally {
    if (browser) await browser.close();
  }

  return results;
}

function getSampleNotices(): NoticeItem[] {
  return [
    {
      title: "[전자신고]부가가치세 전자신고 파일설명서(2026년 3월 23일 공지)",
      date: "2026-03-23",
      url: HOMETAX_LIBRARY_URL,
    },
  ];
}

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

  const uniqueByTitleDate = Array.from(
    new Map(notices.map((notice) => [`${notice.title}__${notice.date}`, notice])).values()
  );

  for (const item of uniqueByTitleDate) {
    if (!shouldCollect(item.title)) {
      result.skipped++;
      continue;
    }

    try {
      const docType = classifyDocType(item.title) || "기타";
      const taxType = classifyTaxType(item.title);

      const insertId = await insertHometaxNotice({
        title: item.title,
        url: item.url,
        date: item.date,
        taxType,
        docType,
        content: null,
        attachments: null,
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
