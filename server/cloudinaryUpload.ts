import type { Express } from "express";
import multer from "multer";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";

const MAX_UPLOAD_SIZE = 50 * 1024 * 1024;

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_SIZE },
});

function getFileType(originalname: string): string {
  const ext = originalname.toLowerCase().match(/\.[^.]+$/)?.[0] || "";
  return ext.replace(".", "") || "unknown";
}

async function uploadToSupabase(buffer: Buffer, originalname: string): Promise<string> {
  const fileName = `${Date.now()}-${Math.round(Math.random() * 1_000_000)}-${originalname}`;

  const { error } = await supabase.storage
    .from("manual-files")
    .upload(fileName, buffer, {
      contentType: "application/octet-stream",
      upsert: false,
    });

  if (error) throw new Error(error.message);

  const { data } = supabase.storage
    .from("manual-files")
    .getPublicUrl(fileName);

  return data.publicUrl;
}

function encodeFileNameRFC5987(fileName: string): string {
  return `UTF-8''${encodeURIComponent(fileName)}`;
}

function toASCIISafeFileName(fileName: string): string {
  const lastDotIndex = fileName.lastIndexOf(".");
  const name = lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName;
  const ext = lastDotIndex > 0 ? fileName.substring(lastDotIndex) : "";
  let safeName = name
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return (safeName || "file") + ext;
}

function getMimeType(fileType: string, mimeTypeFromDb?: string): string {
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
    rar: "application/vnd.rar",
    "7z": "application/x-7z-compressed",
    exe: "application/vnd.microsoft.portable-executable",
    bat: "application/x-bat",
    sh: "application/x-sh",
  };

  const normalizedMimeType = mimeTypeFromDb?.toLowerCase();
  const genericMimeTypes = new Set(["application/octet-stream", "binary/octet-stream", ""]);

  if (normalizedMimeType && !genericMimeTypes.has(normalizedMimeType)) {
    return mimeTypeFromDb!;
  }

  return mimeMap[fileType.toLowerCase()] || "application/octet-stream";
}

export function registerCloudinaryUpload(app: Express) {
  app.post("/api/upload", (req: any, res: any) => {
    upload.single("file")(req, res, async (uploadErr: any) => {
      if (uploadErr instanceof multer.MulterError) {
        if (uploadErr.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({ error: "파일 크기는 최대 100MB까지 업로드할 수 있습니다." });
        }
        return res.status(400).json({ error: uploadErr.message || "업로드 요청 처리에 실패했습니다." });
      }

      if (uploadErr) {
        return res.status(500).json({ error: uploadErr.message || "업로드 처리 중 오류가 발생했습니다." });
      }

      try {
        if (!req.file) return res.status(400).json({ error: "파일이 없습니다." });
        const originalName = Buffer.from(req.file.originalname, "latin1").toString("utf8");
        const fileBuffer = req.file.buffer;
        const fileUrl = await uploadToSupabase(fileBuffer, originalName);
        const fileType = getFileType(originalName);
        const mimeType = getMimeType(fileType, req.file.mimetype);
        return res.json({ success: true, fileUrl, fileType, originalName, mimeType });
      } catch (err: any) {
        return res.status(500).json({ error: err.message || "업로드 실패" });
      }
    });
  });

  app.get("/api/download", async (req: any, res: any) => {
    const { url, filename, mimeType } = req.query;
    if (!url || !filename) return res.status(400).json({ error: "URL과 파일명이 필요합니다." });
    try {
      const decodedFilename = decodeURIComponent(filename as string);
      const response = await axios({
        method: "get",
        url: url as string,
        responseType: "stream",
        timeout: 60000,
      });
      res.setHeader("Content-Type", mimeType || "application/octet-stream");
      const rfc5987FileName = encodeFileNameRFC5987(decodedFilename);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${toASCIISafeFileName(decodedFilename)}"; filename*=${rfc5987FileName}`
      );
      response.data.pipe(res);
    } catch (err: any) {
      if (!res.headersSent) res.status(500).json({ error: err.message || "다운로드 실패" });
    }
  });

  app.get("/api/hometax-view", (req: any, res: any) => {
    const { url } = req.query;
    if (!url) return res.status(400).send("URL이 필요합니다.");
    const decodedUrl = decodeURIComponent(url as string);
    res.setHeader("Content-Security-Policy", "referrer no-referrer");
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="referrer" content="no-referrer">
        <title>홈택스 연결 중...</title>
        <script>
          window.onload = function() {
            const meta = document.createElement('meta');
            meta.httpEquiv = "refresh";
            meta.content = "0;url=${decodedUrl}";
            document.getElementsByTagName('head')[0].appendChild(meta);
            setTimeout(function() {
              window.location.replace("${decodedUrl}");
            }, 100);
          };
        </script>
      </head>
      <body>
        <p>홈택스로 안전하게 연결 중입니다. 잠시만 기다려주세요...</p>
        <p style="font-size: 0.8em; color: #666;">자동으로 연결되지 않으면 <a href="${decodedUrl}" rel="noreferrer">여기</a>를 클릭하세요.</p>
      </body>
      </html>
    `);
  });
}