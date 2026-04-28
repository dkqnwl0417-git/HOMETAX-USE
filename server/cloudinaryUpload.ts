import type { Express } from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";
import axios from "axios";

// Cloudinary 설정
const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

if (cloudName && apiKey && apiSecret) {
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });
  console.log("[Cloudinary] Configured successfully.");
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

function getFileType(originalname: string): string {
  const ext = originalname.toLowerCase().match(/\.[^.]+$/)?.[0] || "";
  return ext.replace(".", "") || "unknown";
}

function uploadToCloudinary(buffer: Buffer, originalname: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const publicId = `manual-files/${Date.now()}`;
    
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "raw",
        public_id: publicId,
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result!.secure_url);
      }
    );
    const readable = Readable.from(buffer);
    readable.pipe(stream);
  });
}

/**
 * 파일명을 RFC 5987 형식으로 인코딩 (한글 지원)
 * 예: "문서.pdf" → "UTF-8''%EB%AC%B8%EC%84%9C.pdf"
 */
function encodeFileNameRFC5987(fileName: string): string {
  try {
    // UTF-8로 인코딩된 파일명 (RFC 5987 형식)
    return `UTF-8''${encodeURIComponent(fileName)}`;
  } catch (e) {
    return `UTF-8''${encodeURIComponent(fileName)}`;
  }
}

/**
 * 파일명을 ASCII 안전 문자열로 변환
 * 한글과 특수문자를 제거하고 안전한 문자만 유지
 * 예: "ERP iU 고과관리 메뉴얼(신).pdf" → "ERP_iU_manual.pdf"
 */
function toASCIISafeFileName(fileName: string): string {
  try {
    // 1. 확장자 분리
    const lastDotIndex = fileName.lastIndexOf('.');
    const name = lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName;
    const ext = lastDotIndex > 0 ? fileName.substring(lastDotIndex) : '';
    
    // 2. 파일명에서 ASCII 문자만 추출 (한글, 특수문자 제거)
    let safeName = name
      .replace(/[^\w\s-]/g, '') // 영문, 숫자, 언더스코어, 하이픈, 공백만 유지
      .replace(/\s+/g, '_')      // 공백을 언더스코어로 변환
      .replace(/_+/g, '_')       // 연속된 언더스코어 제거
      .replace(/^_|_$/g, '');    // 앞뒤 언더스코어 제거
    
    // 3. 너무 짧으면 기본값 사용
    if (!safeName) {
      safeName = 'file';
    }
    
    // 4. 길이 제한 (255자 이내)
    if (safeName.length > 200) {
      safeName = safeName.substring(0, 200);
    }
    
    return safeName + ext;
  } catch (e) {
    return 'file.bin';
  }
}

/**
 * MIME 타입 매핑
 */
function getMimeType(fileType: string, mimeTypeFromDb?: string): string {
  if (mimeTypeFromDb) return mimeTypeFromDb;
  
  const mimeMap: Record<string, string> = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    hwp: "application/x-hwp",
    hwpx: "application/vnd.hancom.hwpx",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    txt: "text/plain",
    csv: "text/csv",
    zip: "application/zip",
    rar: "application/x-rar-compressed",
    "7z": "application/x-7z-compressed",
  };
  
  return mimeMap[fileType.toLowerCase()] || "application/octet-stream";
}

export function registerCloudinaryUpload(app: Express) {
  // ─── 파일 업로드 엔드포인트 ──────────────────────────────────────────
  app.post("/api/upload", upload.single("file"), async (req: any, res: any) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "파일이 없습니다." });
      }
      
      // 파일명 인코딩 문제 해결 (한글 깨짐 방지)
      const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
      
      // 바이너리 데이터 그대로 사용 (절대 문자열로 변환하지 말 것)
      const fileBuffer = req.file.buffer;
      
      if (!Buffer.isBuffer(fileBuffer)) {
        return res.status(400).json({ error: "파일 데이터가 손상되었습니다." });
      }
      
      console.log(`[Upload] Starting upload for file: ${originalName} (${fileBuffer.length} bytes)`);
      
      const fileUrl = await uploadToCloudinary(fileBuffer, req.file.originalname);
      const fileType = getFileType(originalName);
      
      // MIME 타입 결정
      const mimeType = getMimeType(fileType, req.file.mimetype);
      
      console.log(`[Upload] Success: ${originalName} → ${fileUrl}`);
      
      return res.json({
        success: true,
        fileUrl,
        fileType,
        originalName: originalName,
        mimeType: mimeType,
      });
    } catch (err: any) {
      console.error("[Upload] Error:", err);
      return res.status(500).json({ error: err.message || "업로드 실패" });
    }
  });

  // ─── 파일 다운로드 프록시 엔드포인트 (핵심) ──────────────────────────
  /**
   * 사용법:
   * /api/download?url=<cloudinary_url>&filename=<파일명>&mimeType=<MIME타입>
   * 
   * 예시:
   * /api/download?url=https://res.cloudinary.com/...&filename=ERP%20iU%20%EA%B3%A0%EA%B3%BC%EA%B4%80%EB%A6%AC%20%EB%A9%94%EB%89%B4%EC%96%BC.pdf&mimeType=application/pdf
   */
  app.get("/api/download", async (req: any, res: any) => {
    const { url, filename, mimeType } = req.query;
    
    if (!url || !filename) {
      return res.status(400).json({ error: "URL과 파일명이 필요합니다." });
    }

    try {
      const decodedFilename = decodeURIComponent(filename as string);
      const finalMimeType = mimeType || "application/octet-stream";
      
      console.log(`[Download] Downloading: ${decodedFilename} (${finalMimeType})`);
      
      // Cloudinary URL에서 파일 다운로드
      const response = await axios({
        method: "get",
        url: url as string,
        responseType: "stream",
        timeout: 30000,
      });

      // 응답 헤더 설정 (핵심!)
      // 1. Content-Type: 파일 형식 인식
      res.setHeader("Content-Type", finalMimeType);
      
      // 2. Content-Disposition: 파일명 보존
      // RFC 5987 표준을 사용하여 한글 파일명 완벽 지원
      // 브라우저 호환성을 위해 ASCII 안전 파일명과 원본 파일명을 모두 제공
      const asciiFileName = toASCIISafeFileName(decodedFilename);
      const rfc5987FileName = encodeFileNameRFC5987(decodedFilename);
      
      // 헤더 값이 ASCII 범위 내에 있는지 확인
      const contentDisposition = `attachment; filename="${asciiFileName}"; filename*=${rfc5987FileName}`;
      
      // 헤더 값 검증 (모든 문자가 ASCII 범위 내인지 확인)
      let isValidASCII = true;
      for (let i = 0; i < contentDisposition.length; i++) {
        if (contentDisposition.charCodeAt(i) > 127) {
          isValidASCII = false;
          break;
        }
      }
      
      if (!isValidASCII) {
        console.warn(`[Download] Header contains non-ASCII characters, using RFC 5987 only`);
        res.setHeader("Content-Disposition", `attachment; filename*=${rfc5987FileName}`);
      } else {
        res.setHeader("Content-Disposition", contentDisposition);
      }
      
      // 3. Content-Length: 파일 크기
      if (response.headers["content-length"]) {
        res.setHeader("Content-Length", response.headers["content-length"]);
      }
      
      // 4. 캐시 제어
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      
      console.log(`[Download] Headers set successfully for: ${decodedFilename}`);
      
      // 스트림 파이프
      response.data.pipe(res);
      
      // 에러 처리
      response.data.on("error", (err: any) => {
        console.error("[Download] Stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "파일 다운로드 중 오류가 발생했습니다." });
        }
      });
      
      res.on("error", (err: any) => {
        console.error("[Download] Response error:", err);
      });
      
    } catch (err: any) {
      console.error("[Download] Error:", err);
      if (!res.headersSent) {
        res.status(500).json({
          error: err.message || "파일 다운로드 중 오류가 발생했습니다.",
        });
      }
    }
  });

  // ─── 홈택스 URL 우회 리다이렉트 엔드포인트 ────────────────────────────
  app.get("/api/hometax-view", (req: any, res: any) => {
    const { url } = req.query;
    if (!url) return res.status(400).send("URL이 필요합니다.");
    const decodedUrl = decodeURIComponent(url as string);
    
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="referrer" content="no-referrer">
        <title>홈택스 연결 중...</title>
        <script>
          window.onload = function() {
            const a = document.createElement('a');
            a.href = "${decodedUrl}";
            a.rel = "noreferrer";
            document.body.appendChild(a);
            a.click();
          };
        </script>
      </head>
      <body>
        <p>홈택스로 안전하게 연결 중입니다. 잠시만 기다려주세요...</p>
      </body>
      </html>
    `);
  });
}
