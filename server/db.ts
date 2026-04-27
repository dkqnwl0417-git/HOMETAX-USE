import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "../drizzle/schema";
import { eq, and, gte, lte, desc, like, sql } from "drizzle-orm";

let _db: any = null;

async function getDb() {
  if (_db) return _db;
  const url = process.env.DATABASE_URL || "file:sqlite.db";
  const authToken = process.env.DATABASE_AUTH_TOKEN;
  const client = createClient({ url, authToken });
  _db = drizzle(client, { schema });
  return _db;
}

export async function initDb() { 
  await getDb(); 
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
    const existing = await db.query.hometaxNotices.findFirst({
      where: eq(schema.hometaxNotices.url, data.url)
    });
    if (existing) return null;

    const result = await db.insert(schema.hometaxNotices).values({
      title: data.title,
      url: data.url,
      date: data.date,
      taxType: data.taxType,
      docType: data.docType,
      viewCount: 0,
      createdAt: new Date()
    }).returning({ id: schema.hometaxNotices.id });

    return result[0]?.id || null;
  } catch (err) {
    console.error("[DB] Error inserting notice:", err);
    return null;
  }
}

export async function urlExists(url: string) {
  const db = await getDb();
  const existing = await db.query.hometaxNotices.findFirst({
    where: eq(schema.hometaxNotices.url, url)
  });
  return !!existing;
}

export async function incrementViewCount(id: number) {
  const db = await getDb();
  await db.update(schema.hometaxNotices)
    .set({ viewCount: sql`viewCount + 1` })
    .where(eq(schema.hometaxNotices.id, id));
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
    const result = await db.insert(schema.manualFiles).values({
      title: data.title,
      fileUrl: data.fileUrl,
      fileType: data.fileType,
      uploader: data.uploader,
      createdAt: new Date()
    }).returning({ id: schema.manualFiles.id });
    
    return result[0]?.id || null;
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
  return Number(result[0]?.count || 0);
}

export async function markAllNotificationsRead() {
  const db = await getDb();
  await db.update(schema.notifications).set({ isRead: 1 });
}

export async function insertNotification(data: any) {
  const db = await getDb();
  await db.insert(schema.notifications).values({
    noticeId: data.noticeId,
    title: data.title,
    url: data.url,
    isRead: data.isRead || 0,
    createdAt: new Date()
  });
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
    await db.update(schema.users).set(data).where(eq(schema.users.openId, data.openId));
    return existing;
  }
  const result = await db.insert(schema.users).values(data).returning();
  return result[0];
}
