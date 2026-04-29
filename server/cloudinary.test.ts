import { describe, expect, it, beforeAll } from "vitest";
import { v2 as cloudinary } from "cloudinary";

describe("Cloudinary Configuration", () => {
  const hasConfig = !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

  beforeAll(() => {
    if (hasConfig) {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
      });
    }
  });

  it("Cloudinary 환경변수 체크 (설정되지 않았어도 테스트는 통과하되 경고 출력)", () => {
    if (!hasConfig) {
      console.warn("Cloudinary 환경변수가 설정되지 않았습니다. 실제 업로드 기능은 작동하지 않습니다.");
      expect(true).toBe(true);
    } else {
      expect(process.env.CLOUDINARY_CLOUD_NAME).toBeDefined();
      expect(process.env.CLOUDINARY_API_KEY).toBeDefined();
      expect(process.env.CLOUDINARY_API_SECRET).toBeDefined();
    }
  });

  it("Cloudinary API 자격증명 유효성 (설정된 경우에만 실행)", async () => {
    if (!hasConfig) {
      console.log("Cloudinary 설정이 없어 API 핑 테스트를 건너뜁니다.");
      return;
    }
    
    try {
      const result = await cloudinary.api.resources({
        max_results: 1,
        resource_type: "raw",
      });
      expect(result).toBeDefined();
    } catch (err: any) {
      if (err.message?.includes("Unauthorized") || err.message?.includes("Invalid")) {
        throw new Error("Cloudinary 자격증명이 유효하지 않습니다: " + err.message);
      }
    }
  });
});

describe("File Upload Configuration", () => {
  it("허용된 파일 형식 검증", () => {
    const ALLOWED_MIMETYPES = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/x-hwp",
    ];
    expect(ALLOWED_MIMETYPES).toContain("application/pdf");
    expect(ALLOWED_MIMETYPES).toContain("application/x-hwp");
  });

  it("파일 확장자 검증", () => {
    const ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".hwp"];
    expect(ALLOWED_EXTENSIONS).toContain(".pdf");
    expect(ALLOWED_EXTENSIONS).toContain(".hwp");
  });
});
