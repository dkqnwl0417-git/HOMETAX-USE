import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "../drizzle/schema";
import { eq, and, gte, lte, desc, like, sql } from "drizzle-orm";

const { hometaxNotices, manualFiles, notifications } = schema;

let _db: any = null;

async function getDb() {
  if (_db) return _db;
  
  const url = process.env.DATABASE_URL || "file:sqlite.db";
  const authToken = process.env.DATABASE_AUTH_TOKEN;
  
  console.log(`[DB] Connecting to ${url.startsWith("libsql") ? "Turso" : "Local SQLite"}`);
  
  const client = createClient({ url, authToken });
  _db = drizzle(client, { schema });
  return _db;
}

export type HometaxNotice = schema.HometaxNotice;
export type InsertHometaxNotice = schema.InsertHometaxNotice;
export type ManualFile = schema.ManualFile;
export type InsertManualFile = schema.InsertManualFile;
export type Notification = schema.Notification;
export type InsertNotification = schema.InsertNotification;

// ─── HometaxNotices ───────────────────────────────────────────────────────────

export async function insertHometaxNotice(notice: any): Promise<number | null> {
  const db = await getDb();
  try {
    const existing = await db.select().from(hometaxNotices).where(eq(hometaxNotices.url, notice.url)).limit(1);
    if (existing.length > 0) {
      console.warn("[DB] Duplicate URL found:", notice.url);
      return null;
    }
    const data = {
      ...notice,
      createdAt: notice.createdAt || new Date(),
      viewCount: notice.viewCount || 0,
    };
    const result = await db.insert(hometaxNotices).values(data);
    return Number(result.lastInsertRowid) || 1;
  } catch (err: any) {
    console.error("[DB] Error inserting hometax notice:", err);
    if (err?.message?.includes("UNIQUE constraint failed")) return null;
    throw err;
  }
}

export async function getHometaxNotices(params: {
  startDate?: string;
  endDate?: string;
  taxType?: string;
  docType?: string;
  page: number;
  pageSize: number;
}): Promise<{ items: HometaxNotice[]; total: number }> {
  const db = await getDb();
  const conditions = [];
  if (params.startDate) conditions.push(gte(hometaxNotices.date, params.startDate));
  if (params.endDate) conditions.push(lte(hometaxNotices.date, params.endDate));
  if (params.taxType && params.taxType !== "전체") {
    conditions.push(eq(hometaxNotices.taxType, params.taxType as any));
  }
  if (params.docType && params.docType !== "전체") {
    conditions.push(eq(hometaxNotices.docType, params.docType as any));
  }
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const offset = (params.page - 1) * params.pageSize;
  
  const [items, countResult] = await Promise.all([
    db.select().from(hometaxNotices).where(where).orderBy(desc(hometaxNotices.date), desc(hometaxNotices.id)).limit(params.pageSize).offset(offset),
    db.select({ count: sql<number>`COUNT(*)` }).from(hometaxNotices).where(where),
  ]);
  
  return { items, total: Number(countResult[0]?.count ?? 0) };
}

export async function incrementViewCount(id: number): Promise<void> {
  const db = await getDb();
  await db.update(hometaxNotices).set({ viewCount: sql`${hometaxNotices.viewCount} + 1` }).where(eq(hometaxNotices.id, id));
}

export async function urlExists(url: string): Promise<boolean> {
  const db = await getDb();
  const result = await db.select({ id: hometaxNotices.id }).from(hometaxNotices).where(eq(hometaxNotices.url, url)).limit(1);
  return result.length > 0;
}

// ─── ManualFiles ──────────────────────────────────────────────────────────────

export async function insertManualFile(file: any): Promise<number | null> {
  const db = await getDb();
  try {
    const data = {
      title: file.title,
      fileUrl: file.fileUrl,
      fileType: file.fileType,
      uploader: file.uploader,
      createdAt: file.createdAt || new Date(),
    };
    
    console.log("[DB] Inserting manual file:", data);
    const result = await db.insert(manualFiles).values(data);
    return Number(result.lastInsertRowid) || 1;
  } catch (err: any) {
    console.error("[DB] Error inserting manual file:", err);
    throw err;
  }
}

export async function getManualFiles(params: {
  keyword?: string;
  page: number;
  pageSize: number;
}): Promise<{ items: ManualFile[]; total: number }> {
  const db = await getDb();
  const conditions = [];
  if (params.keyword) conditions.push(like(manualFiles.title, `%${params.keyword}%`));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const offset = (params.page - 1) * params.pageSize;
  
  const [items, countResult] = await Promise.all([
    db.select().from(manualFiles).where(where).orderBy(desc(manualFiles.createdAt)).limit(params.pageSize).offset(offset),
    db.select({ count: sql<number>`COUNT(*)` }).from(manualFiles).where(where),
  ]);
  
  return { items, total: Number(countResult[0]?.count ?? 0) };
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function insertNotification(notif: any): Promise<void> {
  const db = await getDb();
  await db.insert(notifications).values({
    ...notif,
    createdAt: notif.createdAt || new Date(),
  });
}

export async function getNotifications(limit = 20): Promise<Notification[]> {
  const db = await getDb();
  return db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(limit);
}

export async function getUnreadCount(): Promise<number> {
  const db = await getDb();
  const result = await db.select({ count: sql<number>`COUNT(*)` }).from(notifications).where(eq(notifications.isRead, 0));
  return Number(result[0]?.count ?? 0);
}

export async function markAllNotificationsRead(): Promise<void> {
  const db = await getDb();
  await db.update(notifications).set({ isRead: 1 }).where(eq(notifications.isRead, 0));
}

export async function deleteHometaxNotice(id: number): Promise<boolean> {
  const db = await getDb();
  try {
    await db.delete(notifications).where(eq(notifications.noticeId, id));
    await db.delete(hometaxNotices).where(eq(hometaxNotices.id, id));
    return true;
  } catch (err) {
    console.error("[DB] Error deleting hometax notice:", err);
    return false;
  }
}

export async function deleteAllHometaxNotices(): Promise<number> {
  const db = await getDb();
  try {
    await db.delete(notifications);
    const result = await db.delete(hometaxNotices);
    return Number((result as any)?.rowsAffected) || 0;
  } catch (err) {
    console.error("[DB] Error deleting all hometax notices:", err);
    return 0;
  }
}

// ─── Users ───────────────────────────────────────────────────────────────────

export async function getUserByOpenId(openId: string): Promise<schema.User | null> {
  const db = await getDb();
  const result = await db.select().from(schema.users).where(eq(schema.users.openId, openId)).limit(1);
  return result[0] || null;
}

export async function upsertUser(user: any): Promise<void> {
  const db = await getDb();
  const existing = await getUserByOpenId(user.openId);
  if (existing) {
    await db.update(schema.users).set({
      ...user,
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    }).where(eq(schema.users.openId, user.openId));
  } else {
    await db.insert(schema.users).values({
      ...user,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    });
  }
}
