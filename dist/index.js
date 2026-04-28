var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/_core/index.ts
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// server/routers.ts
import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";

// server/db.ts
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";

// drizzle/schema.ts
var schema_exports = {};
__export(schema_exports, {
  hometaxNotices: () => hometaxNotices,
  manualFiles: () => manualFiles,
  notifications: () => notifications,
  users: () => users
});
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
var users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  openId: text("openId").notNull().unique(),
  name: text("name"),
  email: text("email"),
  loginMethod: text("loginMethod"),
  role: text("role").notNull().default("user"),
  createdAt: integer("createdAt").notNull(),
  updatedAt: integer("updatedAt").notNull(),
  lastSignedIn: integer("lastSignedIn").notNull()
});
var hometaxNotices = sqliteTable("hometaxNotices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  url: text("url").notNull().unique(),
  date: text("date").notNull(),
  // "YYYY-MM-DD" 형식 문자열 유지
  taxType: text("taxType").notNull().default("\uAE30\uD0C0"),
  docType: text("docType").notNull(),
  viewCount: integer("viewCount").notNull().default(0),
  createdAt: integer("createdAt").notNull()
  // 타임스탬프 정수형
});
var manualFiles = sqliteTable("manualFiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  fileUrl: text("fileUrl").notNull(),
  fileType: text("fileType").notNull(),
  originalName: text("originalName").notNull(),
  // 원본 파일명 저장
  mimeType: text("mimeType").notNull().default("application/octet-stream"),
  // MIME 타입
  uploader: text("uploader").notNull(),
  createdAt: integer("createdAt").notNull()
  // 타임스탬프 정수형
});
var notifications = sqliteTable("notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  noticeId: integer("noticeId"),
  title: text("title"),
  url: text("url"),
  message: text("message"),
  isRead: integer("isRead").notNull().default(0),
  createdAt: integer("createdAt").notNull()
  // 타임스탬프 정수형
});

// server/db.ts
import { eq, desc, and, like, sql } from "drizzle-orm";
var dbInstance = null;
async function getDb() {
  if (dbInstance)
    return dbInstance;
  const url = process.env.DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (url && url.startsWith("libsql://")) {
    console.log("[DB] Connecting to Turso Database...");
    const client = createClient({ url, authToken });
    dbInstance = drizzle(client, { schema: schema_exports });
  } else {
    console.log("[DB] Connecting to Local SQLite (Data may be lost on redeploy)");
    const client = createClient({ url: "file:local.db" });
    dbInstance = drizzle(client, { schema: schema_exports });
  }
  await initDb();
  return dbInstance;
}
async function initDb() {
  const db = await getDb();
  try {
    console.log("[DB] Starting Self-Healing Database Initialization...");
    await db.run(sql`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, open_id TEXT UNIQUE, username TEXT, avatar_url TEXT, role TEXT DEFAULT 'user', created_at INTEGER, updated_at INTEGER, last_signed_in INTEGER)`);
    await db.run(sql`CREATE TABLE IF NOT EXISTS hometax_notices (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, url TEXT UNIQUE, tax_type TEXT, doc_type TEXT, date TEXT, view_count INTEGER DEFAULT 0, created_at INTEGER)`);
    await db.run(sql`CREATE TABLE IF NOT EXISTS manual_files (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, file_url TEXT, file_type TEXT, original_name TEXT, mime_type TEXT, uploader TEXT, created_at INTEGER)`);
    await db.run(sql`CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, notice_id INTEGER, title TEXT, url TEXT, is_read INTEGER DEFAULT 0, created_at INTEGER)`);
    console.log("[DB] Self-Healing Initialization Complete.");
  } catch (err) {
    console.error("[DB] Initialization Error:", err);
  }
}
async function getHometaxNotices(filters) {
  const db = await getDb();
  let conditions = [];
  if (filters.taxType)
    conditions.push(eq(hometaxNotices.taxType, filters.taxType));
  if (filters.docType)
    conditions.push(eq(hometaxNotices.docType, filters.docType));
  const items = await db.query.hometaxNotices.findMany({
    where: conditions.length > 0 ? and(...conditions) : void 0,
    orderBy: [desc(hometaxNotices.date), desc(hometaxNotices.id)],
    limit: filters.pageSize,
    offset: (filters.page - 1) * filters.pageSize
  });
  const restoredItems = items.map((item) => ({
    ...item,
    url: item.url.startsWith("b64:") ? Buffer.from(item.url.substring(4), "base64").toString("utf8") : item.url
  }));
  return { items: restoredItems, total: 100 };
}
async function insertHometaxNotice(data) {
  const db = await getDb();
  try {
    const encodedUrl = "b64:" + Buffer.from(data.url).toString("base64");
    const existing = await db.query.hometaxNotices.findFirst({
      where: eq(hometaxNotices.url, encodedUrl)
    });
    if (existing)
      return null;
    const result = await db.insert(hometaxNotices).values({
      ...data,
      url: encodedUrl,
      createdAt: data.createdAt ? data.createdAt.getTime() : (/* @__PURE__ */ new Date()).getTime()
    }).returning();
    return result[0].id;
  } catch (err) {
    console.error("[DB] Error inserting notice:", err);
    return null;
  }
}
async function deleteHometaxNotice(id) {
  const db = await getDb();
  try {
    await db.delete(hometaxNotices).where(eq(hometaxNotices.id, id));
    return true;
  } catch (err) {
    return false;
  }
}
async function getManualFiles(filters) {
  const db = await getDb();
  let conditions = [];
  if (filters.keyword)
    conditions.push(like(manualFiles.title, `%${filters.keyword}%`));
  const items = await db.query.manualFiles.findMany({
    where: conditions.length > 0 ? and(...conditions) : void 0,
    orderBy: [desc(manualFiles.createdAt)],
    limit: filters.pageSize,
    offset: (filters.page - 1) * filters.pageSize
  });
  return { items, total: 100 };
}
async function insertManualFile(data) {
  const db = await getDb();
  try {
    const result = await db.insert(manualFiles).values({
      ...data,
      createdAt: data.createdAt ? data.createdAt.getTime() : (/* @__PURE__ */ new Date()).getTime()
    }).returning();
    return result[0].id;
  } catch (err) {
    console.error("[DB] Error inserting manual file:", err);
    return null;
  }
}
async function deleteManualFile(id) {
  const db = await getDb();
  try {
    await db.delete(manualFiles).where(eq(manualFiles.id, id));
    return true;
  } catch (err) {
    return false;
  }
}
async function getNotifications(limit) {
  const db = await getDb();
  return db.query.notifications.findMany({
    orderBy: [desc(notifications.createdAt)],
    limit
  });
}
async function getUnreadCount() {
  const db = await getDb();
  const result = await db.select({ count: sql`count(*)` }).from(notifications).where(eq(notifications.isRead, 0));
  return Number(result[0]?.count || 0);
}
async function markAllNotificationsRead() {
  const db = await getDb();
  await db.update(notifications).set({ isRead: 1 });
}

// server/hometaxCrawler.ts
import { chromium } from "playwright";
async function crawlHometax() {
  console.log("[Crawler] Starting Hometax crawl...");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
  });
  const page = await context.newPage();
  try {
    await page.goto("https://hometax.go.kr/websquare/websquare.html?w2xPath=/ui/pp/index_pp.xml&menuCd=UTXPPBAA32", { waitUntil: "networkidle" });
    await page.waitForTimeout(3e3);
    const allResults = [];
    for (let p = 1; p <= 5; p++) {
      console.log(`[Crawler] Scraping page ${p}...`);
      if (p > 1) {
        const pageButton = await page.$(`text="${p}"`);
        if (pageButton) {
          await pageButton.click();
          await page.waitForTimeout(2e3);
        } else {
          break;
        }
      }
      const rows = await page.$$("table.w2grid_body_table tr");
      for (const row of rows) {
        const titleElement = await row.$("td:nth-child(2)");
        const dateElement = await row.$("td:nth-child(5)");
        if (titleElement && dateElement) {
          const title = (await titleElement.innerText()).trim();
          const date = (await dateElement.innerText()).trim();
          const hasElectronic = title.includes("[\uC804\uC790\uC2E0\uACE0]");
          const hasKeywords = ["\uD30C\uC77C\uC124\uBA85\uC11C", "\uC804\uC0B0\uB9E4\uCCB4 \uC81C\uCD9C\uC694\uB839", "\uC81C\uCD9C\uC694\uB839"].some((k) => title.includes(k));
          if (hasElectronic || hasKeywords) {
            let taxType = "\uAE30\uD0C0";
            if (title.includes("\uBD80\uAC00\uAC00\uCE58\uC138"))
              taxType = "\uBD80\uAC00\uAC00\uCE58\uC138";
            else if (title.includes("\uC6D0\uCC9C\uC138"))
              taxType = "\uC6D0\uCC9C\uC138";
            else if (title.includes("\uBC95\uC778\uC138"))
              taxType = "\uBC95\uC778\uC138";
            else if (title.includes("\uC885\uD569\uC18C\uB4DD\uC138"))
              taxType = "\uC885\uD569\uC18C\uB4DD\uC138";
            let docType = "\uAE30\uD0C0";
            if (title.includes("\uD30C\uC77C\uC124\uBA85\uC11C"))
              docType = "\uD30C\uC77C\uC124\uBA85\uC11C";
            else if (title.includes("\uC81C\uCD9C\uC694\uB839"))
              docType = "\uC804\uC0B0\uB9E4\uCCB4 \uC81C\uCD9C\uC694\uB839";
            const url = "https://hometax.go.kr/websquare/websquare.html?w2xPath=/ui/pp/index_pp.xml&menuCd=UTXPPBAA32";
            allResults.push({ title, url, taxType, docType, date });
          }
        }
      }
    }
    return allResults;
  } catch (err) {
    console.error("[Crawler] Error:", err);
    throw err;
  } finally {
    await browser.close();
  }
}

// server/routers.ts
var t = initTRPC.create();
var appRouter = t.router({
  hometax: t.router({
    list: t.procedure.input(z.object({
      taxType: z.string().optional(),
      docType: z.string().optional(),
      page: z.number().default(1),
      pageSize: z.number().default(15)
    })).query(async ({ input }) => {
      return await getHometaxNotices(input);
    }),
    crawl: t.procedure.input(z.object({})).mutation(async () => {
      try {
        const results = await crawlHometax();
        let inserted = 0;
        for (const item of results) {
          const id = await insertHometaxNotice(item);
          if (id)
            inserted++;
        }
        return { inserted };
      } catch (err) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "\uD06C\uB864\uB9C1 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4."
        });
      }
    }),
    insert: t.procedure.input(z.object({
      title: z.string(),
      url: z.string(),
      taxType: z.string(),
      docType: z.string(),
      date: z.string()
    })).mutation(async ({ input }) => {
      const id = await insertHometaxNotice(input);
      if (!id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "\uC774\uBBF8 \uC874\uC7AC\uD558\uB294 URL\uC774\uAC70\uB098 \uC800\uC7A5\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4."
        });
      }
      return { id };
    }),
    delete: t.procedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      const success = await deleteHometaxNotice(input.id);
      if (!success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "\uC0AD\uC81C\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4."
        });
      }
      return { success: true };
    })
  }),
  manual: t.router({
    list: t.procedure.input(z.object({
      keyword: z.string().optional(),
      page: z.number().default(1),
      pageSize: z.number().default(10)
    })).query(async ({ input }) => {
      return await getManualFiles(input);
    }),
    upload: t.procedure.input(z.object({
      title: z.string(),
      fileUrl: z.string(),
      fileType: z.string(),
      originalName: z.string(),
      uploader: z.string()
    })).mutation(async ({ input }) => {
      const id = await insertManualFile(input);
      if (!id) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "\uD30C\uC77C \uC815\uBCF4\uB97C DB\uC5D0 \uC800\uC7A5\uD558\uB294 \uB370 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4."
        });
      }
      return { id };
    }),
    delete: t.procedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      const success = await deleteManualFile(input.id);
      if (!success) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "\uC0AD\uC81C\uC5D0 \uC2E4\uD328\uD588\uC2B5\uB2C8\uB2E4."
        });
      }
      return { success: true };
    })
  }),
  notification: t.router({
    list: t.procedure.input(z.object({ limit: z.number().default(5) })).query(async ({ input }) => {
      return await getNotifications(input.limit);
    }),
    unreadCount: t.procedure.query(async () => {
      return await getUnreadCount();
    }),
    markAllRead: t.procedure.mutation(async () => {
      await markAllNotificationsRead();
      return { success: true };
    })
  })
});

// server/_core/index.ts
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";

// server/cloudinaryUpload.ts
import { v2 as cloudinary } from "cloudinary";
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});
async function uploadToCloudinary(fileBuffer, originalName) {
  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    throw new Error("Cloudinary \uC124\uC815\uC774 \uC644\uB8CC\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4.");
  }
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: "auto",
        folder: "hometax_manual",
        // 한글 파일명 보존을 위해 public_id 설정 (특수문자 제거)
        public_id: `file_${Date.now()}`
      },
      (error, result) => {
        if (error)
          return reject(error);
        if (!result)
          return reject(new Error("Upload failed"));
        resolve({
          fileUrl: result.secure_url,
          fileType: result.format || originalName.split(".").pop() || "file",
          originalName
        });
      }
    );
    uploadStream.end(fileBuffer);
  });
}

// server/_core/index.ts
import multer from "multer";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var app = express();
app.use(express.json());
app.get("/api/download", async (req, res) => {
  const { url, filename } = req.query;
  if (!url)
    return res.status(400).send("URL is required");
  try {
    const response = await axios({
      method: "get",
      url,
      responseType: "stream"
    });
    res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(filename)}"`);
    res.setHeader("Content-Type", response.headers["content-type"]);
    response.data.pipe(res);
  } catch (err) {
    res.status(500).send("Download failed");
  }
});
app.get("/api/hometax-view", (req, res) => {
  const { url } = req.query;
  if (!url)
    return res.status(400).send("URL is required");
  res.send(`
    <html>
      <head>
        <meta name="referrer" content="no-referrer">
        <script>
          window.location.href = "${url}";
        </script>
      </head>
      <body>\uC5F0\uACB0 \uC911...</body>
    </html>
  `);
});
var upload = multer({ storage: multer.memoryStorage() });
app.post("/api/upload", upload.single("file"), async (req, res) => {
  if (!req.file)
    return res.status(400).json({ error: "No file uploaded" });
  try {
    const result = await uploadToCloudinary(req.file.buffer, req.file.originalname);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext: () => ({})
  })
);
var publicPath = path.join(__dirname, "../../dist/public");
app.use(express.static(publicPath));
app.get("*", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});
var PORT = Number(process.env.PORT) || 1e4;
async function start() {
  await initDb();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Running on http://0.0.0.0:${PORT}`);
  });
}
start();
