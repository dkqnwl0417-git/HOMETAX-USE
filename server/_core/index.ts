import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { registerCloudinaryUpload } from "../cloudinaryUpload";
import { runCrawler } from "../crawler";
import cron from "node-cron";
import { initDb } from "../db";

async function startServer() {
  const app = express();
  const server = createServer(app);
  
  // Configure body parser
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerCloudinaryUpload(app);
    
  // DB 초기화
  await initDb().catch(err => console.error("[DB] Init failed:", err));
  
  // 크롤링 스케줄러
  cron.schedule("0 9 * * *", async () => {
    console.log("[Cron] Running scheduled crawl...");
    try {
      await runCrawler(false);
    } catch (err) {
      console.error("[Cron] Crawl failed:", err);
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Render 환경에서는 반드시 0.0.0.0으로 바인딩해야 포트 감지가 가능합니다.
  const port = parseInt(process.env.PORT || "3000");
  const host = "0.0.0.0"; 

  server.listen(port, host, () => {
    console.log(`Server is strictly listening on ${host}:${port}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

startServer().catch(console.error);
