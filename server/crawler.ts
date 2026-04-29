import axios from "axios";
import * as cheerio from "cheerio";
import { InsertHometaxNotice } from "../drizzle/schema";
import { insertHometaxNotice, insertNotification, urlExists } from "./db";

// 홈택스 자료실 URL
const HOMETAX_LIBRARY_URL =
  "https://hometax.go.kr/websquare/websquare.html?w2xPath=/ui/pp/index_pp.xml&tmIdx=16&tm2lIdx=1602000000&tm3lIdx=";

// 세금 유형 분류
function classifyTaxType(title: string): InsertHometaxNotice["taxType"] {
  if (title.includes("[전자신고]")) {
    if (title.includes("부가가치세")) return "부가가치세";
    if (title.includes("종합소득세")) return "종합소득세";
    if (title.includes("법인세")) return "법인세";
    if (title.includes("원천세")) return "원천세";
    if (title.includes("양도소득세")) return "양도소득세";
    if (title.includes("상속세") || title.includes("증여세")) return "상속/증여세";
    if (title.includes("개별소비세")) return "개별소비세";
  }
  
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
  if (title.includes("[전자신고]")) return true;
  return title.includes("전산매체 제출요령") || title.includes("파일설명서");
}

export interface CrawlResult {
  inserted: number;
  skipped: number;
  errors: number;
}

// 홈택스 자료실 웹 페이지에서 직접 크롤링
async function fetchNoticesFromHometaxLibraryWebsite(pageNo: number = 1): Promise<
  Array<{ title: string; date: string; url: string }>
> {
  const results: Array<{ title: string; date: string; url: string }> = [];
  try {
    const url = `${HOMETAX_LIBRARY_URL}&pageIndex=${pageNo}`;
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://hometax.go.kr/",
      },
      timeout: 15000,
    });

    const $ = cheerio.load(response.data);
    const rows = $("table tbody tr");

    rows.each((_, row) => {
      const $row = $(row);
      const cells = $row.find("td");
      if (cells.length < 2) return;

      let title = "";
      let date = "";
      let menuCd = "";

      const titleLink = $row.find("a").first();
      if (titleLink.length > 0) {
        title = titleLink.text().trim();
        const onclick = titleLink.attr("onclick") || "";
        const onclickMatch = onclick.match(/openDetail\s*\(\s*'([^']+)'/);
        if (onclickMatch) {
          menuCd = onclickMatch[1];
        }
      }

      date = cells.eq(cells.length - 2).text().trim();

      if (title && date && menuCd) {
        const normalizedDate = date
          .replace(/(\d{4})\.(\d{1,2})\.(\d{1,2})/, "$1-$2-$3")
          .substring(0, 10);
        const detailUrl = `https://hometax.go.kr/websquare/websquare.html?w2xPath=/ui/pp/index_pp.xml&menuCd=${menuCd}`;
        results.push({ title, date: normalizedDate, url: detailUrl });
      }
    });
  } catch (err) {
    console.error("[Crawler] Hometax Library website fetch error:", err);
  }
  return results;
}

// 홈택스 자료실 WebSquare API를 통한 크롤링
async function fetchNoticesFromHometaxLibraryAPI(pageNo: number = 1): Promise<
  Array<{ title: string; date: string; url: string }>
> {
  const results: Array<{ title: string; date: string; url: string }> = [];
  try {
    const response = await axios.post(
      "https://hometax.go.kr/wqAction.do",
      {
        actionId: "ATXPPABA001R01",
        screenId: "UTXPPABA001",
        pageInfoVO: { pageIndex: pageNo, pageUnit: 50 },
        inqrClCd: "PM03538",
        searchWord: "",
      },
      {
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Referer: HOMETAX_LIBRARY_URL,
        },
        timeout: 15000,
      }
    );

    const list = response.data?.list || [];
    for (const item of list) {
      const title = item.ntcTtl || "";
      const date = item.regDt || "";
      const menuCd = item.menuCd || "";

      if (title && date && menuCd) {
        const formattedDate = String(date).replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3").substring(0, 10);
        const detailUrl = `https://hometax.go.kr/websquare/websquare.html?w2xPath=/ui/pp/index_pp.xml&menuCd=${menuCd}`;
        results.push({ title, date: formattedDate, url: detailUrl });
      }
    }
  } catch (err) {
    console.error("[Crawler] Hometax Library API fetch error:", err);
  }
  return results;
}

export async function runCrawler(useSampleOnFail = false): Promise<CrawlResult> {
  const result: CrawlResult = { inserted: 0, skipped: 0, errors: 0 };
  let notices: Array<{ title: string; date: string; url: string }> = [];

  const items = await fetchNoticesFromHometaxLibraryWebsite(1);
  notices.push(...items);

  if (notices.length === 0) {
    const apiItems = await fetchNoticesFromHometaxLibraryAPI(1);
    notices.push(...apiItems);
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
