import axios from "axios";
import * as cheerio from "cheerio";
import { InsertHometaxNotice } from "../drizzle/schema";
import { insertHometaxNotice, insertNotification, urlExists } from "./db";

// 홈택스 자료실 URL
const HOMETAX_LIBRARY_URL =
  "https://hometax.go.kr/websquare/websquare.html?w2xPath=/ui/pp/index_pp.xml&tmIdx=16&tm2lIdx=1602000000&tm3lIdx=";

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

// 홈택스 자료실 웹 페이지에서 직접 크롤링 - menuCd 정확하게 추출
async function fetchNoticesFromHometaxLibraryWebsite(pageNo: number = 1): Promise<
  Array<{ title: string; date: string; url: string }>
> {
  const results: Array<{ title: string; date: string; url: string }> = [];

  try {
    // 홈택스 자료실 페이지 직접 접근
    const url = `${HOMETAX_LIBRARY_URL}&pageIndex=${pageNo}`;

    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ko-KR,ko;q=0.9",
        Referer: "https://hometax.go.kr/",
      },
      timeout: 15000,
    });

    const $ = cheerio.load(response.data);

    // 자료실 테이블 행 추출
    const rows = $(
      "table tbody tr, .board-list tr, .notice-list tr, tr[data-menu-cd], tr[data-notice-id]"
    );

    rows.each((_, row) => {
      const $row = $(row);
      const cells = $row.find("td");

      if (cells.length < 2) return;

      let title = "";
      let date = "";
      let menuCd = "";

      // 데이터 속성에서 menuCd 추출
      menuCd = $row.attr("data-menu-cd") || $row.attr("data-menucd") || "";

      // 제목과 링크 추출
      const titleLink = $row.find("a").first();
      if (titleLink.length > 0) {
        title = titleLink.text().trim();

        // href에서 menuCd 추출 시도
        const href = titleLink.attr("href") || "";
        if (!menuCd && href) {
          const menuMatch = href.match(/menuCd=([A-Z0-9]+)/);
          if (menuMatch) {
            menuCd = menuMatch[1];
          }
        }

        // onclick 속성에서 menuCd 추출 시도
        const onclick = titleLink.attr("onclick") || "";
        if (!menuCd && onclick) {
          // onclick="openDetail('UTXPPBAA32', '2026-001')" 형식 처리
          const onclickMatch = onclick.match(/openDetail\('([A-Z0-9]+)'/);
          if (onclickMatch) {
            menuCd = onclickMatch[1];
          }
        }
      }

      // 날짜 추출 - 마지막 셀이 보통 날짜
      if (cells.length > 0) {
        date = cells.eq(cells.length - 1).text().trim();
      }

      if (title && date && menuCd) {
        // 날짜 형식 정규화
        const normalizedDate = date
          .replace(/(\d{4})\.(\d{1,2})\.(\d{1,2})/, "$1-$2-$3")
          .replace(/(\d{4})\/(\d{1,2})\/(\d{1,2})/, "$1-$2-$3")
          .replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3")
          .substring(0, 10);

        // 상세 페이지 URL 구성 - menuCd 기반
        const detailUrl = `https://hometax.go.kr/websquare/websquare.html?w2xPath=/ui/pp/index_pp.xml&menuCd=${menuCd}`;

        if (normalizedDate.match(/\d{4}-\d{2}-\d{2}/) && title.length > 0) {
          results.push({ title, date: normalizedDate, url: detailUrl });
        }
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
    // WebSquare 기반 자료실 API 호출
    const response = await axios.post(
      "https://hometax.go.kr/wqAction.do",
      {
        actionId: "ATXPPABA001R01",
        screenId: "UTXPPABA001",
        pageInfoVO: {
          pageIndex: pageNo,
          pageUnit: 50,
          pageSize: 10,
          firstIndex: (pageNo - 1) * 50 + 1,
          lastIndex: pageNo * 50,
          recordCountPerPage: 50,
        },
        inqrClCd: "PM03538",
        searchWord: "",
      },
      {
        headers: {
          "Content-Type": "application/json",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Referer: HOMETAX_LIBRARY_URL,
          "X-Requested-With": "XMLHttpRequest",
        },
        timeout: 15000,
      }
    );

    const data = response.data;
    const list = data?.list || data?.data?.list || [];

    for (const item of list) {
      const title = item.title || item.ntcTtl || item.bbsTtl || item.subject || "";
      const date = item.regDt || item.ntcDt || item.regDate || item.createdAt || "";
      const menuCd = item.menuCd || item.menu_cd || item.contentCd || "";

      if (title && date && menuCd) {
        const formattedDate = String(date)
          .replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3")
          .substring(0, 10);

        // 상세 페이지 URL 구성 - menuCd 기반
        const detailUrl = `https://hometax.go.kr/websquare/websquare.html?w2xPath=/ui/pp/index_pp.xml&menuCd=${menuCd}`;

        results.push({ title, date: formattedDate, url: detailUrl });
      }
    }
  } catch (err) {
    console.error("[Crawler] Hometax Library API fetch error:", err);
  }

  return results;
}

// 홈택스 자료실 REST API 크롤링 (대체 방식)
async function fetchNoticesFromHometaxRestAPI(pageNo: number = 1): Promise<
  Array<{ title: string; date: string; url: string }>
> {
  const results: Array<{ title: string; date: string; url: string }> = [];

  try {
    const response = await axios.get(
      "https://hometax.go.kr/api/notice/list",
      {
        params: {
          pageNo,
          pageSize: 50,
          searchType: "all",
          searchKeyword: "전자신고",
          categoryId: "PM03538",
        },
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/json",
          Referer: HOMETAX_LIBRARY_URL,
        },
        timeout: 15000,
      }
    );

    const data = response.data;
    const list = data?.list || data?.data || data?.items || [];

    for (const item of list) {
      const title = item.title || item.ntcTtl || item.subject || "";
      const date = item.regDt || item.ntcDt || item.regDate || item.createdAt || "";
      const menuCd = item.menuCd || item.menu_cd || item.contentCd || "";

      if (title && date && menuCd) {
        const formattedDate = String(date)
          .replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3")
          .substring(0, 10);

        let detailUrl = "";
        if (menuCd) {
          detailUrl = `https://hometax.go.kr/websquare/websquare.html?w2xPath=/ui/pp/index_pp.xml&menuCd=${menuCd}`;
        }

        if (detailUrl) {
          results.push({ title, date: formattedDate, url: detailUrl });
        }
      }
    }
  } catch (err) {
    console.error("[Crawler] Hometax REST API fetch error:", err);
  }

  return results;
}

// 테스트용 샘플 데이터 (실제 홈택스 자료실 URL 형식)
function getSampleNotices(): Array<{ title: string; date: string; url: string }> {
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

export async function runCrawler(useSampleOnFail = false): Promise<CrawlResult> {
  const result: CrawlResult = { inserted: 0, skipped: 0, errors: 0 };

  let notices: Array<{ title: string; date: string; url: string }> = [];

  // 1차: 홈택스 자료실 웹사이트 크롤링 시도 (menuCd 정확 추출)
  console.log("[Crawler] Trying Hometax Library website crawling...");
  for (let page = 1; page <= 3; page++) {
    const items = await fetchNoticesFromHometaxLibraryWebsite(page);
    notices.push(...items);
    if (items.length < 10) break;
  }

  // 2차: 홈택스 자료실 WebSquare API 시도
  if (notices.length === 0) {
    console.log("[Crawler] Trying Hometax Library WebSquare API...");
    for (let page = 1; page <= 3; page++) {
      const items = await fetchNoticesFromHometaxLibraryAPI(page);
      notices.push(...items);
      if (items.length < 50) break;
    }
  }

  // 3차: 홈택스 REST API 시도
  if (notices.length === 0) {
    console.log("[Crawler] Trying Hometax REST API...");
    for (let page = 1; page <= 3; page++) {
      const items = await fetchNoticesFromHometaxRestAPI(page);
      notices.push(...items);
      if (items.length < 50) break;
    }
  }

  // 크롤링 실패 시 샘플 데이터 사용 (테스트 환경)
  if (notices.length === 0) {
    console.warn(
      "[Crawler] Warning: Could not fetch any notices from Hometax Library. Using sample data for testing."
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
