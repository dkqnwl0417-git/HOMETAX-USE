import type { Express } from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";

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
    // 한글 파일명 깨짐 방지를 위해 public_id에서 한글을 제외하거나 안전하게 변환
    const safeName = Buffer.from(originalname, 'latin1').toString('utf8');
    const publicId = `manual-files/${Date.now()}`;
    
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "raw",
        public_id: publicId,
        // 원본 파일명을 보존하기 위해 content_disposition 설정
        content_disposition: `attachment; filename="${encodeURIComponent(safeName)}"`,
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
  app.post("/api/upload", upload.single("file"), async (req: any, res: any) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "파일이 없습니다." });
      }

      // 한글 파일명 복구 (multer latin1 -> utf8)
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
}
