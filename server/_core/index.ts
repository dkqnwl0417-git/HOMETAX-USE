import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter, expressRouter } from "../routers";
import { createContext } from "./context";
import { initDb } from "../db";
import path from "path";
import { fileURLToPath } from "url";
import { registerDownloadRoute } from "../cloudinaryUpload";
import { registerHometaxProxy } from "../hometaxProxy";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  // DB 초기화 (자가 치유 로직 포함)
  await initDb();

  const app = express();
  app.use(express.json());

  // Express 전용 라우터 (파일 업로드 등)
  app.use("/api", expressRouter);
  
  // 다운로드 및 프록시 라우트 등록
  registerDownloadRoute(app);
  registerHometaxProxy(app);

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
    // 여러 경로 시도: dist/public → public → ../public
    let publicPath = path.join(__dirname, "../public");
    
    // 현재 경로가 없으면 다른 경로 시도
    if (!fs.existsSync(publicPath)) {
      const altPath1 = path.join(__dirname, "../../dist/public");
      const altPath2 = path.join(__dirname, "../../public");
      const altPath3 = path.join(process.cwd(), "dist/public");
      
      if (fs.existsSync(altPath1)) {
        publicPath = altPath1;
      } else if (fs.existsSync(altPath2)) {
        publicPath = altPath2;
      } else if (fs.existsSync(altPath3)) {
        publicPath = altPath3;
      }
    }

    console.log(`[Server] Serving static files from: ${publicPath}`);
    
    // 정적 파일 서비스
    app.use(express.static(publicPath));
    
    // SPA 라우팅: 모든 요청을 index.html로 리다이렉트
    app.get("*", (req, res) => {
      const indexPath = path.join(publicPath, "index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        console.error(`[Server] index.html not found at ${indexPath}`);
        res.status(404).send("index.html not found");
      }
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
