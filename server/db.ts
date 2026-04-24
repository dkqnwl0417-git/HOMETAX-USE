import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "../drizzle/schema";
import { eq, desc, and, gte, lte, like, sql } from "drizzle-orm";

let dbInstance: any = null;

export async function getDb() {
  if (dbInstance) return dbInstance;

  const url = process.env.DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (url && url.startsWith("libsql://")) {
    console.log("[DB] Connecting to Turso Database...");
    const client = createClient({ url, authToken });
    dbInstance = drizzle(client, { schema });
  } else {
    console.log("[DB] Connecting to Local SQLite");
    const client = createClient({ url: "file:local.db" });
    dbInstance = drizzle(client, { schema });
  }

  await initDb();
  return dbInstance;
}

export async function initDb() {
  // getDb()를 호출하면 다시 initDb()가 호출되는 재귀 무한루프 발생 → 직접 인스턴스 사용
  if (!dbInstance) await getDb();
  const db = dbInstance;
  try {
    console.log("[DB] Starting Self-Healing Database Initialization...");
    await db.run(sql`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE, password TEXT, role TEXT DEFAULT 'user', created_at INTEGER)`);
    await db.run(sql`CREATE TABLE IF NOT EXISTS hometax_notices (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, url TEXT, tax_type TEXT, doc_type TEXT, date TEXT, view_count INTEGER DEFAULT 0, created_at INTEGER)`);
    await db.run(sql`CREATE TABLE IF NOT EXISTS manual_files (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, file_url TEXT, file_type TEXT, original_name TEXT DEFAULT '', uploader TEXT, created_at INTEGER)`);
    await db.run(sql`CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, message TEXT, is_read INTEGER DEFAULT 0, created_at INTEGER)`);
    console.log("[DB] Self-Healing Initialization Complete.");
  } catch (err) {
    console.error("[DB] Initialization Error:", err);
  }
}

// ─── 홈택스 전자신고 설명서 ────────────────────────────────────────────────
export async function getHometaxNotices(filters: any) {
  const db = await getDb();
  let conditions = [];
  if (filters.taxType) conditions.push(eq(schema.hometaxNotices.taxType, filters.taxType));
  if (filters.docType) conditions.push(eq(schema.hometaxNotices.docType, filters.docType));
  
  const items = await db.query.hometaxNotices.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: [desc(schema.hometaxNotices.date), desc(schema.hometaxNotices.id)],
    limit: filters.pageSize,
    offset: (filters.page - 1) * filters.pageSize,
  });

  // URL 복원 (Base64 -> Plain)
  const restoredItems = items.map((item: any) => ({
    ...item,
    url: item.url.startsWith('b64:') ? Buffer.from(item.url.substring(4), 'base64').toString('utf8') : item.url
  }));

  return { items: restoredItems, total: 100 };
}

export async function insertHometaxNotice(data: any) {
  const db = await getDb();
  try {
    // URL 인코딩 (변조 방지)
    const encodedUrl = 'b64:' + Buffer.from(data.url).toString('base64');
    
    const existing = await db.query.hometaxNotices.findFirst({
      where: eq(schema.hometaxNotices.url, encodedUrl)
    });
    if (existing) return null;

    const result = await db.insert(schema.hometaxNotices).values({
      ...data,
      url: encodedUrl,
      createdAt: data.createdAt || new Date()
    }).returning();
    return result[0].id;
  } catch (err) {
    console.error("[DB] Error inserting notice:", err);
    return null;
  }
}

export async function urlExists(url: string) {
  const db = await getDb();
  const encodedUrl = 'b64:' + Buffer.from(url).toString('base64');
  const existing = await db.query.hometaxNotices.findFirst({
    where: eq(schema.hometaxNotices.url, encodedUrl)
  });
  return !!existing;
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
  return result.rowsAffected;
}

export async function incrementViewCount(id: number) {
  const db = await getDb();
  await db.update(schema.hometaxNotices)
    .set({ viewCount: sql`view_count + 1` })
    .where(eq(schema.hometaxNotices.id, id));
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

  return { items, total: 100 };
}

export async function insertManualFile(data: any) {
  const db = await getDb();
  try {
    const result = await db.insert(schema.manualFiles).values({
      title: data.title,
      fileUrl: data.fileUrl,
      fileType: data.fileType,
      originalName: data.originalName || data.title,
      uploader: data.uploader,
      createdAt: data.createdAt || new Date()
    }).returning();
    return result[0].id;
  } catch (err) {
    console.error("[DB] Error inserting manual file:", err);
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
  return result[0].count;
}

export async function markAllNotificationsRead() {
  const db = await getDb();
  await db.update(schema.notifications).set({ isRead: 1 });
}

export async function insertNotification(message: string) {
  const db = await getDb();
  await db.insert(schema.notifications).values({
    message,
    isRead: 0,
    createdAt: new Date()
  });
}

// ─── 사용자 (Auth) ────────────────────────────────────────────────────────
export async function findUserByUsername(username: string) {
  const db = await getDb();
  return db.query.users.findFirst({ where: eq(schema.users.username, username) });
}

export async function createUser(data: any) {
  const db = await getDb();
  const result = await db.insert(schema.users).values(data).returning();
  return result[0];
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  return db.query.users.findFirst({ where: eq(schema.users.username, openId) });
}

export async function upsertUser(data: any) {
  const db = await getDb();
  const existing = await findUserByUsername(data.username);
  if (existing) {
    await db.update(schema.users).set(data).where(eq(schema.users.username, data.username));
    return existing;
  }
  const result = await db.insert(schema.users).values(data).returning();
  return result[0];
}
