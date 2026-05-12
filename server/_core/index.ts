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
import { initDb, saveLastCrawledAt } from "../db";

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.get("/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "hometax-use",
    time: new Date().toISOString(),
  });
});

app.get("/api/cron/hometax-crawl", async (req, res) => {
  const secret = String(req.query.secret || req.headers["x-cron-secret"] || "");

  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({
      ok: false,
      message: "Unauthorized",
    });
  }

  try {
    const response = await fetch(process.env.CRAWLER_API_URL!, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-crawler-secret": process.env.CRAWLER_SECRET!,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();

      return res.status(500).json({
        ok: false,
        message: "크롤러 API 호출 실패",
        status: response.status,
        error: errorText,
      });
    }

    const result = await response.json();
    const crawledAt = Date.now();

    await saveLastCrawledAt(crawledAt);

    return res.status(200).json({
      ...result,
      crawledAt,
    });
  } catch (err: any) {
    return res.status(500).json({
      ok: false,
      message: err?.message || "자동 수집 실패",
    });
  }
});
  
  // Configure body parser
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  registerCloudinaryUpload(app);
    
  // DB 초기화
  await initDb().catch(err => console.error("[DB] Init failed:", err));

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
