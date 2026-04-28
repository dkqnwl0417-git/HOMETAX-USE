import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../routers";
import { initDb } from "../db";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// ─── 다운로드 프록시 (파일명 보존) ────────────────────────────────────────
app.get("/api/download", async (req, res) => {
  const { url, filename } = req.query;
  if (!url) return res.status(400).send("URL is required");

  try {
    const response = await axios({
      method: "get",
      url: url as string,
      responseType: "stream",
    });

    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename as string)}"`);
    res.setHeader("Content-Type", response.headers["content-type"]);
    response.data.pipe(res);
  } catch (err) {
    res.status(500).send("Download failed");
  }
});

// ─── 홈택스 뷰 프록시 (Referer 우회) ──────────────────────────────────────
app.get("/api/hometax-view", (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).send("URL is required");

  // Referer 없이 새 창에서 열리도록 HTML 응답
  res.send(`
    <html>
      <head>
        <meta name="referrer" content="no-referrer">
        <script>
          window.location.href = "${url}";
        </script>
      </head>
      <body>연결 중...</body>
    </html>
  `);
});

// ─── 파일 업로드 (Cloudinary) ───────────────────────────────────────────
import { uploadToCloudinary } from "../cloudinaryUpload";
import multer from "multer";
const upload = multer({ storage: multer.memoryStorage() });

app.post("/api/upload", upload.single("file"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  
  try {
    const result = await uploadToCloudinary(req.file.buffer, req.file.originalname);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── tRPC ──────────────────────────────────────────────────────────────
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext: () => ({}),
  })
);

// ─── 정적 파일 서빙 ──────────────────────────────────────────────────────
const publicPath = path.join(__dirname, "../../dist/public");
app.use(express.static(publicPath));

app.get("*", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

// ─── 서버 시작 ──────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT) || 10000;

async function start() {
  await initDb();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Running on http://0.0.0.0:${PORT}`);
  });
}

start();
