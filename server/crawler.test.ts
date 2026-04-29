import { describe, expect, it } from "vitest";

// 테스트를 위해 분류 함수를 직접 인라인으로 정의
function classifyTaxType(title: string): string {
  if (title.includes("부가가치세")) return "부가가치세";
  if (title.includes("종합소득세")) return "종합소득세";
  if (title.includes("원천세")) return "원천세";
  return "기타";
}

function classifyDocType(title: string): string | null {
  if (title.includes("전산매체 제출요령")) return "전산매체 제출요령";
  if (title.includes("파일설명서")) return "파일설명서";
  return null;
}

function shouldCollect(title: string): boolean {
  const hasTitleKeyword =
    title.includes("[전자신고]") || title.includes("전산매체 제출요령");
  const docType = classifyDocType(title);
  return hasTitleKeyword && docType !== null;
}

describe("classifyTaxType", () => {
  it("부가가치세 분류", () => {
    expect(classifyTaxType("[전자신고] 2024년 부가가치세 파일설명서")).toBe("부가가치세");
  });
  it("종합소득세 분류", () => {
    expect(classifyTaxType("[전자신고] 종합소득세 파일설명서")).toBe("종합소득세");
  });
  it("원천세 분류", () => {
    expect(classifyTaxType("[전자신고] 원천세 파일설명서")).toBe("원천세");
  });
  it("기타 분류", () => {
    expect(classifyTaxType("[전자신고] 법인세 파일설명서")).toBe("기타");
  });
});

describe("classifyDocType", () => {
  it("파일설명서 분류", () => {
    expect(classifyDocType("[전자신고] 부가가치세 파일설명서")).toBe("파일설명서");
  });
  it("전산매체 제출요령 분류", () => {
    expect(classifyDocType("부가가치세 전산매체 제출요령")).toBe("전산매체 제출요령");
  });
  it("해당 없음 → null 반환", () => {
    expect(classifyDocType("[전자신고] 일반 공지사항")).toBeNull();
  });
});

describe("shouldCollect", () => {
  it("[전자신고] + 파일설명서 → 수집 대상", () => {
    expect(shouldCollect("[전자신고] 2024년 부가가치세 파일설명서")).toBe(true);
  });
  it("전산매체 제출요령 → 수집 대상", () => {
    expect(shouldCollect("부가가치세 전산매체 제출요령")).toBe(true);
  });
  it("[전자신고] 있지만 파일설명서/전산매체 없음 → 수집 제외", () => {
    expect(shouldCollect("[전자신고] 일반 공지사항")).toBe(false);
  });
  it("파일설명서 있지만 [전자신고]/전산매체 없음 → 수집 제외", () => {
    expect(shouldCollect("파일설명서 안내")).toBe(false);
  });
  it("아무 조건 없음 → 수집 제외", () => {
    expect(shouldCollect("홈택스 서비스 안내")).toBe(false);
  });
  it("[전자신고] + 전산매체 제출요령 → 수집 대상", () => {
    expect(shouldCollect("[전자신고] 전산매체 제출요령 안내")).toBe(true);
  });
});
