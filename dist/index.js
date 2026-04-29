var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/_core/index.ts
import express2 from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// server/routers.ts
import { z } from "zod";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// server/_core/trpc.ts
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

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
import { eq, desc } from "drizzle-orm";
var url = process.env.DATABASE_URL || "file:test.db";
var authToken = process.env.TURSO_AUTH_TOKEN;
var client = createClient({ url, authToken });
var db = drizzle(client, { schema: schema_exports });
var encodeUrl = (url2) => Buffer.from(url2).toString("base64");
var decodeUrl = (encoded) => Buffer.from(encoded, "base64").toString("utf-8");
async function initDb() {
  console.log(`[DB] Connecting to ${url.startsWith("file:") ? "Local SQLite" : "Turso Database"}...`);
  try {
    await client.execute(`
      CREATE TABLE IF NOT EXISTS hometax_notices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        tax_type TEXT NOT NULL,
        doc_type TEXT NOT NULL,
        date TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);
    await client.execute(`
      CREATE TABLE IF NOT EXISTS manual_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);
    console.log("[DB] Self-Healing Initialization Complete.");
  } catch (err) {
    console.error("[DB] Initialization Error:", err);
  }
}
async function insertHometaxNotice(data) {
  const encodedUrl = encodeUrl(data.url);
  const existing = await db.select().from(hometaxNotices).where(eq(hometaxNotices.url, encodedUrl));
  if (existing.length > 0)
    return existing[0];
  const result = await db.insert(hometaxNotices).values({
    title: data.title,
    url: encodedUrl,
    taxType: data.taxType,
    docType: data.docType,
    date: data.date,
    createdAt: Date.now()
  }).returning();
  return result[0];
}
async function listHometaxNotices() {
  const results = await db.select().from(hometaxNotices).orderBy(desc(hometaxNotices.createdAt));
  return results.map((item) => ({ ...item, url: decodeUrl(item.url) }));
}
async function deleteHometaxNotice(id) {
  return await db.delete(hometaxNotices).where(eq(hometaxNotices.id, id));
}
async function insertManualFile(data) {
  const result = await db.insert(manualFiles).values({
    title: data.title,
    url: data.url,
    createdAt: Date.now()
  }).returning();
  return result[0];
}
async function listManualFiles() {
  return await db.select().from(manualFiles).orderBy(desc(manualFiles.createdAt));
}
async function deleteManualFile(id) {
  return await db.delete(manualFiles).where(eq(manualFiles.id, id));
}
async function getUserByOpenId(openId) {
  const result = await db.select().from(users).where(eq(users.openId, openId));
  return result[0];
}
async function upsertUser(data) {
  const existing = await getUserByOpenId(data.openId);
  if (existing) {
    return await db.update(users).set(data).where(eq(users.openId, data.openId)).returning();
  }
  return await db.insert(users).values(data).returning();
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
            const url2 = "https://hometax.go.kr/websquare/websquare.html?w2xPath=/ui/pp/index_pp.xml&menuCd=UTXPPBAA32";
            allResults.push({ title, url: url2, taxType, docType, date });
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

// server/cloudinaryUpload.ts
import { v2 as cloudinary } from "cloudinary";
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});
async function uploadToCloudinary(fileBuffer, fileName) {
  return new Promise((resolve, reject) => {
    const publicId = fileName.split(".").slice(0, -1).join(".");
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: "auto",
        folder: "hometax_manual",
        public_id: publicId,
        use_filename: true,
        unique_filename: true
      },
      (error, result) => {
        if (error)
          return reject(error);
        resolve(result);
      }
    );
    uploadStream.end(fileBuffer);
  });
}

// server/routers.ts
import express from "express";
import multer from "multer";
var upload = multer({ storage: multer.memoryStorage() });
var appRouter = router({
  hometax: {
    list: publicProcedure.query(async () => {
      return await listHometaxNotices();
    }),
    crawl: publicProcedure.mutation(async () => {
      const results = await crawlHometax();
      for (const item of results) {
        await insertHometaxNotice(item);
      }
      return { success: true, count: results.length };
    }),
    add: publicProcedure.input(z.object({
      title: z.string(),
      url: z.string(),
      taxType: z.string(),
      docType: z.string(),
      date: z.string()
    })).mutation(async ({ input }) => {
      return await insertHometaxNotice(input);
    }),
    delete: publicProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      return await deleteHometaxNotice(input.id);
    })
  },
  manual: {
    list: publicProcedure.query(async () => {
      return await listManualFiles();
    }),
    delete: publicProcedure.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
      return await deleteManualFile(input.id);
    })
  }
});
var expressRouter = express.Router();
expressRouter.post("/manual/upload", upload.array("files"), async (req, res) => {
  try {
    const files = req.files;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "\uD30C\uC77C\uC774 \uC5C6\uC2B5\uB2C8\uB2E4." });
    }
    const results = [];
    for (const file of files) {
      const uploadResult = await uploadToCloudinary(file.buffer, file.originalname);
      const dbResult = await insertManualFile({
        title: file.originalname,
        url: uploadResult.secure_url
      });
      results.push(dbResult);
    }
    res.json({ success: true, results });
  } catch (error) {
    console.error("[Upload Error]", error);
    res.status(500).json({ error: error.message });
  }
});

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  databaseAuthToken: process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN || "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? ""
};

// server/_core/sdk.ts
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client2) {
    this.client = client2;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: OAUTH_SERVER_URL is not configured! Set OAUTH_SERVER_URL environment variable."
      );
    }
  }
  decodeState(state) {
    const redirectUri = atob(state);
    return redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client2 = createOAuthHttpClient()) {
    this.client = client2;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0)
      return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0)
      return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL"))
      return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE"))
      return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE"))
      return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB"))
      return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionCookie ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var sdk = new SDKServer();

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/index.ts
import path from "path";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
async function startServer() {
  await initDb();
  const app = express2();
  app.use(express2.json());
  app.use("/api", expressRouter);
  app.use(
    "/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  if (process.env.NODE_ENV === "production") {
    const publicPath = path.join(__dirname, "../public");
    app.use(express2.static(publicPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(publicPath, "index.html"));
    });
  }
  const port = process.env.PORT || 1e4;
  app.listen(port, "0.0.0.0", () => {
    console.log(`[Server] Running on http://0.0.0.0:${port}`);
    console.log(`[Auth] Initialized with baseURL: ${process.env.MANUS_OAUTH_BASE_URL || "https://api.manus.im"}`);
  });
}
startServer().catch((err) => {
  console.error("[Server] Failed to start:", err);
  process.exit(1);
});
