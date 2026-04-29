import { v2 as cloudinary } from "cloudinary";
import type { Express } from "express";
import axios from "axios";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function uploadToCloudinary(fileBuffer: Buffer, fileName: string): Promise<any> {
  return new Promise((resolve, reject) => {
    // 파일명에서 확장자 제거 (Cloudinary public_id용)
    const publicId = `manual-files/${Date.now()}`;
    
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: "raw",
        public_id: publicId,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    uploadStream.end(fileBuffer);
  });
}

/**
 * 파일명을 RFC 5987 형식으로 인코딩 (한글 지원)
 */
function encodeFileNameRFC5987(fileName: string): string {
  return `UTF-8''${encodeURIComponent(fileName)}`;
}

/**
 * 파일명을 ASCII 안전 문자열로 변환
 */
function toASCIISafeFileName(fileName: string): string {
  try {
    const lastDotIndex = fileName.lastIndexOf('.');
    const name = lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName;
    const ext = lastDotIndex > 0 ? fileName.substring(lastDotIndex) : '';
    
    let safeName = name
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    
    if (!safeName) safeName = 'file';
    if (safeName.length > 200) safeName = safeName.substring(0, 200);
    
    return safeName + ext;
  } catch (e) {
    return 'file.bin';
  }
}

export function registerDownloadRoute(app: Express) {
  app.get("/api/download", async (req: any, res: any) => {
    const { url, filename, mimeType } = req.query;
    
    if (!url || !filename) {
      return res.status(400).json({ error: "URL과 파일명이 필요합니다." });
    }

    try {
      const decodedFilename = decodeURIComponent(filename as string);
      const finalMimeType = mimeType || "application/octet-stream";
      
      console.log(`[Download] Downloading: ${decodedFilename} (${finalMimeType})`);
      
      const response = await axios({
        method: "get",
        url: url as string,
        responseType: "stream",
        timeout: 30000,
      });

      res.setHeader("Content-Type", finalMimeType);
      
      const asciiFileName = toASCIISafeFileName(decodedFilename);
      const rfc5987FileName = encodeFileNameRFC5987(decodedFilename);
      
      const contentDisposition = `attachment; filename="${asciiFileName}"; filename*=${rfc5987FileName}`;
      
      // 헤더 값 검증
      let isValidASCII = true;
      for (let i = 0; i < contentDisposition.length; i++) {
        if (contentDisposition.charCodeAt(i) > 127) {
          isValidASCII = false;
          break;
        }
      }
      
      if (!isValidASCII) {
        res.setHeader("Content-Disposition", `attachment; filename*=${rfc5987FileName}`);
      } else {
        res.setHeader("Content-Disposition", contentDisposition);
      }
      
      if (response.headers["content-length"]) {
        res.setHeader("Content-Length", response.headers["content-length"]);
      }
      
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      
      response.data.pipe(res);
      
      response.data.on("error", (err: any) => {
        console.error("[Download] Stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "파일 다운로드 중 오류가 발생했습니다." });
        }
      });
    } catch (err: any) {
      console.error("[Download] Error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message || "파일 다운로드 중 오류가 발생했습니다." });
      }
    }
  });
}
