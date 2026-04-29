import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter, expressRouter } from "../routers";
import { createContext } from "./context";
import { initDb } from "../db";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  // DB 초기화 (자가 치유 로직 포함)
  await initDb();

  const app = express();
  app.use(express.json());

  // Express 전용 라우터 (파일 업로드 등)
  app.use("/api", expressRouter);

  // tRPC 미들웨어
  app.use(
    "/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  // 정적 파일 서비스 (Production)
  if (process.env.NODE_ENV === "production") {
    const publicPath = path.join(__dirname, "../public");
    app.use(express.static(publicPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(publicPath, "index.html"));
    });
  }

  const port = process.env.PORT || 10000;
  app.listen(port, "0.0.0.0", () => {
    console.log(`[Server] Running on http://0.0.0.0:${port}`);
    console.log(`[Auth] Initialized with baseURL: ${process.env.MANUS_OAUTH_BASE_URL || "https://api.manus.im"}`);
  });
}

startServer().catch((err) => {
  console.error("[Server] Failed to start:", err);
  process.exit(1);
});
