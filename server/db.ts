import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "../drizzle/schema";
import { eq, and, gte, lte, desc, like, sql } from "drizzle-orm";

let _db: any = null;

async function getDb() {
  if (_db) return _db;
  const url = process.env.DATABASE_URL || "file:sqlite.db";
  const authToken = process.env.TURSO_AUTH_TOKEN;
  console.log("[DB] Connecting to:", url);
  console.log("TOKEN:", authToken);
  const client = createClient({ url, authToken });
  _db = drizzle(client, { schema });
  return _db;
}

export async function initDb() { 
  try {
    const db = await getDb(); 
    console.log("[DB] Initializing tables if not exist...");
    
    // 테이블 자동 생성 쿼리 (libsql 직접 실행)
    const client = (db as any).$client || createClient({ 
      url: process.env.DATABASE_URL || "file:sqlite.db", 
      authToken: process.env.DATABASE_AUTH_TOKEN 
    });

    await client.execute(`CREATE TABLE IF NOT EXISTS "users" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      "openId" text NOT NULL UNIQUE,
      "name" text,
      "email" text,
      "loginMethod" text,
      "role" text DEFAULT 'user' NOT NULL,
      "createdAt" integer NOT NULL,
      "updatedAt" integer NOT NULL,
      "lastSignedIn" integer NOT NULL
    )`);

    await client.execute(`CREATE TABLE IF NOT EXISTS "hometaxNotices" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      "title" text NOT NULL,
      "url" text NOT NULL UNIQUE,
      "date" text NOT NULL,
      "taxType" text DEFAULT '기타' NOT NULL,
      "docType" text NOT NULL,
      "viewCount" integer DEFAULT 0 NOT NULL,
      "content" text,
      "attachments" text,
      "createdAt" integer NOT NULL
    )`);

    await client.execute(`ALTER TABLE "hometaxNotices" ADD COLUMN "content" text`).catch(() => {});
    await client.execute(`ALTER TABLE "hometaxNotices" ADD COLUMN "attachments" text`).catch(() => {});

    await client.execute(`CREATE TABLE IF NOT EXISTS "manualFiles" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      "title" text NOT NULL,
      "fileUrl" text NOT NULL,
      "fileType" text NOT NULL,
      "originalName" text NOT NULL,
      "mimeType" text DEFAULT 'application/octet-stream' NOT NULL,
      "uploader" text NOT NULL,
      "createdAt" integer NOT NULL
    )`);

    await client.execute(`CREATE TABLE IF NOT EXISTS "notifications" (
      "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
      "noticeId" integer,
      "title" text,
      "url" text,
      "message" text,
      "isRead" integer DEFAULT 0 NOT NULL,
      "createdAt" integer NOT NULL
    )`);

    console.log("[DB] Table initialization complete.");
  } catch (err) {
    console.error("[DB] Initialization failed:", err);
  }
}

// ─── 홈택스 전자신고 설명서 ───────────────────────────────────────────────
export async function getHometaxNotices(filters: any) {
  const db = await getDb();
  let conditions = [];
  if (filters.startDate) conditions.push(gte(schema.hometaxNotices.date, filters.startDate));
  if (filters.endDate) conditions.push(lte(schema.hometaxNotices.date, filters.endDate));
  if (filters.taxType) conditions.push(eq(schema.hometaxNotices.taxType, filters.taxType));
  if (filters.docType) conditions.push(eq(schema.hometaxNotices.docType, filters.docType));

  const items = await db.query.hometaxNotices.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: [desc(schema.hometaxNotices.date), desc(schema.hometaxNotices.id)],
    limit: filters.pageSize,
    offset: (filters.page - 1) * filters.pageSize,
  });

  const countResult = await db.select({ count: sql`count(*)` })
    .from(schema.hometaxNotices)
    .where(conditions.length > 0 ? and(...conditions) : undefined);
  
  return { 
    items, 
    total: Number(countResult[0]?.count || 0) 
  };
}

export async function insertHometaxNotice(data: any) {
  const db = await getDb();
  try {
    console.log("[DB] Attempting to insert notice:", data.url);
    
    const existing = await db.query.hometaxNotices.findFirst({
      where: eq(schema.hometaxNotices.url, data.url)
    });
    
    if (existing) {
      console.warn("[DB] Duplicate URL detected:", data.url);
      return null;
    }

    const values = {
      title: data.title,
      url: data.url,
      date: data.date,
      taxType: data.taxType,
      docType: data.docType,
      viewCount: 0,
      createdAt: new Date().getTime()
    };

    const result = await db.insert(schema.hometaxNotices).values(values).returning({ id: schema.hometaxNotices.id });
    
    if (result && result.length > 0) {
      console.log("[DB] Successfully inserted notice, ID:", result[0].id);
      return result[0].id;
    }
    return null;
  } catch (err: any) {
    console.error("[DB] Error in insertHometaxNotice:", err);
    // 테이블이 없는 경우를 대비해 초기화 재시도
    if (err.message?.includes("no such table")) {
      await initDb();
    }
    return null;
  }
}

export async function urlExists(url: string) {
  try {
    const db = await getDb();
    const existing = await db.query.hometaxNotices.findFirst({
      where: eq(schema.hometaxNotices.url, url)
    });
    return !!existing;
  } catch (err) {
    return false;
  }
}

export async function incrementViewCount(id: number) {
  const db = await getDb();
  await db.update(schema.hometaxNotices)
    .set({ viewCount: sql`viewCount + 1` })
    .where(eq(schema.hometaxNotices.id, id));
}

export async function updateHometaxNotice(id: number, data: any) {
  const db = await getDb();
  try {
    await db.update(schema.hometaxNotices)
      .set({
        title: data.title,
        taxType: data.taxType,
        docType: data.docType,
        date: data.date,
        content: data.content || null,
        attachments: data.attachments || null,
      })
      .where(eq(schema.hometaxNotices.id, id));
    return true;
  } catch (err) {
    console.error("[DB] Error in updateHometaxNotice:", err);
    return false;
  }
}

export async function deleteHometaxNotice(id: number) {
  const db = await getDb();
  try {
    await db.delete(schema.hometaxNotices).where(eq(schema.hometaxNotices.id, id));
    return true;
  } catch (err) {
    return false;
  }
}

export async function deleteAllHometaxNotices() {
  const db = await getDb();
  const result = await db.delete(schema.hometaxNotices);
  return Number(result.rowsAffected || 0);
}

// ─── 내부 메뉴얼 자료실 ───────────────────────────────────────────────────
export async function getManualFiles(filters: any) {
  const db = await getDb();
  let conditions = [];
  if (filters.keyword) conditions.push(like(schema.manualFiles.title, `%${filters.keyword}%`));
  
  const items = await db.query.manualFiles.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: [desc(schema.manualFiles.createdAt)],
    limit: filters.pageSize,
    offset: (filters.page - 1) * filters.pageSize,
  });

  const countResult = await db.select({ count: sql`count(*)` })
    .from(schema.manualFiles)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  return { 
    items, 
    total: Number(countResult[0]?.count || 0) 
  };
}

export async function insertManualFile(data: any) {
  const db = await getDb();
  try {
    console.log("[DB] insertManualFile data received:", JSON.stringify(data));
    const values = {
      title: data.title,
      fileUrl: data.fileUrl,
      fileType: data.fileType,
      originalName: data.originalName,
      mimeType: data.mimeType || "application/octet-stream",
      uploader: data.uploader,
      createdAt: new Date().getTime()
    };
    console.log("[DB] insertManualFile values:", JSON.stringify(values));
    const result = await db.insert(schema.manualFiles).values(values).returning({ id: schema.manualFiles.id });
    if (result && result.length > 0) return result[0].id;
    return null;
  } catch (err: any) {
    console.error("[DB] Error in insertManualFile:", err);
    if (err.message?.includes("no such table")) await initDb();
    return null;
  }
}

export async function deleteManualFile(id: number) {
  const db = await getDb();
  try {
    await db.delete(schema.manualFiles).where(eq(schema.manualFiles.id, id));
    return true;
  } catch (err) {
    return false;
  }
}

// ─── 알림 ─────────────────────────────────────────────────────────────────
export async function getNotifications(limit: number) {
  const db = await getDb();
  return db.query.notifications.findMany({
    orderBy: [desc(schema.notifications.createdAt)],
    limit,
  });
}

export async function getUnreadCount() {
  const db = await getDb();
  const result = await db.select({ count: sql`count(*)` })
    .from(schema.notifications)
    .where(eq(schema.notifications.isRead, 0));
  return Number(result[0]?.count || 0);
}

export async function markAllNotificationsRead() {
  const db = await getDb();
  await db.update(schema.notifications).set({ isRead: 1 });
}

export async function insertNotification(data: any) {
  try {
    const db = await getDb();
    await db.insert(schema.notifications).values({
      noticeId: data.noticeId,
      title: data.title,
      url: data.url,
      isRead: data.isRead || 0,
      createdAt: new Date().getTime()
    });
  } catch (err) {
    console.error("[DB] Error in insertNotification:", err);
  }
}

// ─── 사용자 (Auth) ────────────────────────────────────────────────────────
export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  return db.query.users.findFirst({ where: eq(schema.users.openId, openId) });
}

export async function upsertUser(data: any) {
  const db = await getDb();
  const existing = await getUserByOpenId(data.openId);
  if (existing) {
    await db.update(schema.users).set({
      ...data,
      updatedAt: new Date().getTime(),
      lastSignedIn: new Date().getTime()
    }).where(eq(schema.users.openId, data.openId));
    return existing;
  }
  const result = await db.insert(schema.users).values({
    ...data,
    createdAt: new Date().getTime(),
    updatedAt: new Date().getTime(),
    lastSignedIn: new Date().getTime()
  }).returning();
  return result[0];
}
