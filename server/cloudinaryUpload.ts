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
    const safeName = Buffer.from(originalname, 'latin1').toString('utf8');
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

export function registerCloudinaryUpload(app: Express) {
  // 업로드 엔드포인트
  app.post("/api/upload", upload.single("file"), async (req: any, res: any) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "파일이 없습니다." });
      }

      const originalName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
      const fileUrl = await uploadToCloudinary(req.file.buffer, req.file.originalname);
      const fileType = getFileType(originalName);

      return res.json({
        success: true,
        fileUrl,
        fileType,
        originalName: originalName,
      });
    } catch (err: any) {
      console.error("[Upload] Error:", err);
      return res.status(500).json({ error: err.message || "업로드 실패" });
    }
  });

  // 다운로드 프록시 엔드포인트 (파일명/확장자 보존 핵심)
  app.get("/api/download", async (req: any, res: any) => {
    const { url, filename } = req.query;
    if (!url || !filename) {
      return res.status(400).send("URL과 파일명이 필요합니다.");
    }

    try {
      const response = await axios({
        method: 'get',
        url: url as string,
        responseType: 'stream'
      });

      // 브라우저에 강제로 파일명과 확장자를 주입하는 헤더 설정
      const decodedFilename = decodeURIComponent(filename as string);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(decodedFilename)}"`);
      res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');

      response.data.pipe(res);
    } catch (err) {
      console.error("[Download Proxy] Error:", err);
      res.status(500).send("파일 다운로드 중 오류가 발생했습니다.");
    }
  });
}
