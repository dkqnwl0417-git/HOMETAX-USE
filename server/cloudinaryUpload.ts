import type { Express } from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { Readable } from "stream";

// Cloudinary 설정 (환경변수가 있을 때만 시도)
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
} else {
  console.warn("[Cloudinary] Credentials missing. Upload functionality will be limited.");
}

// 허용 파일 형식
const ALLOWED_MIMETYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/x-hwp",
  "application/haansofthwp",
  "application/vnd.hancom.hwp",
];

const ALLOWED_EXTENSIONS = [".pdf", ".doc", ".docx", ".xls", ".xlsx", ".hwp"];

function getFileType(originalname: string, mimetype: string): string {
  const ext = originalname.toLowerCase().match(/\.[^.]+$/)?.[0] || "";
  if (ext === ".pdf") return "pdf";
  if (ext === ".doc") return "doc";
  if (ext === ".docx") return "docx";
  if (ext === ".xls") return "xls";
  if (ext === ".xlsx") return "xlsx";
  if (ext === ".hwp") return "hwp";
  if (mimetype.includes("pdf")) return "pdf";
  if (mimetype.includes("word")) return "docx";
  if (mimetype.includes("excel") || mimetype.includes("spreadsheet")) return "xlsx";
  return ext.replace(".", "") || "unknown";
}

// multer 메모리 스토리지 사용
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.toLowerCase().match(/\.[^.]+$/)?.[0] || "";
    const allowed =
      ALLOWED_MIMETYPES.includes(file.mimetype) ||
      ALLOWED_EXTENSIONS.includes(ext) ||
      file.mimetype === "application/octet-stream";
    if (allowed) {
      cb(null, true);
    } else {
      cb(new Error(`허용되지 않는 파일 형식입니다. (${ext})`));
    }
  },
});

function uploadToCloudinary(buffer: Buffer, originalname: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const publicId = `manual-files/${Date.now()}-${originalname.replace(/[^a-zA-Z0-9가-힣._-]/g, "_")}`;
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: "raw",
        public_id: publicId,
        use_filename: true,
        unique_filename: false,
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

      // 런타임에 다시 한 번 설정 확인
      const currentCloudName = process.env.CLOUDINARY_CLOUD_NAME;
      const currentApiKey = process.env.CLOUDINARY_API_KEY;
      const currentApiSecret = process.env.CLOUDINARY_API_SECRET;

      if (!currentCloudName || !currentApiKey || !currentApiSecret) {
        return res.status(503).json({ 
          success: false, 
          error: "Cloudinary 설정이 완료되지 않았습니다. Render 환경변수(CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET)를 설정해주세요." 
        });
      }

      const fileUrl = await uploadToCloudinary(req.file.buffer, req.file.originalname);
      const fileType = getFileType(req.file.originalname, req.file.mimetype);

      return res.json({
        success: true,
        fileUrl,
        fileType,
        originalName: req.file.originalname,
      });
    } catch (err: any) {
      console.error("[Upload] Error:", err);
      return res.status(500).json({ error: err.message || "업로드 실패" });
    }
  });
}
