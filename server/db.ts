import { and, desc, eq, gte, like, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import {
  HometaxNotice,
  InsertHometaxNotice,
  InsertManualFile,
  InsertNotification,
  InsertUser,
  ManualFile,
  Notification,
  hometaxNotices,
  manualFiles,
  notifications,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const client = createClient({
        url: process.env.DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN,
      });
      _db = drizzle(client);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const now = new Date();
  const values: InsertUser = { 
    openId: user.openId,
    createdAt: user.createdAt || now,
    updatedAt: user.updatedAt || now,
    lastSignedIn: user.lastSignedIn || now,
  };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  type TextField = (typeof textFields)[number];
  const assignNullable = (field: TextField) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  };
  textFields.forEach(assignNullable);
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  updateSet.updatedAt = new Date();
  
  // SQLite는 INSERT OR REPLACE 사용
  try {
    await db.insert(users).values(values).onConflictDoUpdate({
      target: users.openId,
      set: updateSet,
    });
  } catch (error) {
    console.warn("[Database] Error upserting user:", error);
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── HometaxNotices ───────────────────────────────────────────────────────────

export async function insertHometaxNotice(notice: InsertHometaxNotice): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  try {
    const result = await db.insert(hometaxNotices).values(notice);
    return (result as any).lastInsertRowid ?? null;
  } catch (err: any) {
    // Duplicate URL (unique constraint) → skip silently
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
  if (!db) return { items: [], total: 0 };

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
    db
      .select()
      .from(hometaxNotices)
      .where(where)
      .orderBy(desc(hometaxNotices.date), desc(hometaxNotices.id))
      .limit(params.pageSize)
      .offset(offset),
    db
      .select({ count: sql<number>`COUNT(*)` })
      .from(hometaxNotices)
      .where(where),
  ]);

  return { items, total: Number(countResult[0]?.count ?? 0) };
}

export async function incrementViewCount(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(hometaxNotices)
    .set({ viewCount: sql`${hometaxNotices.viewCount} + 1` })
    .where(eq(hometaxNotices.id, id));
}

export async function urlExists(url: string): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const result = await db
    .select({ id: hometaxNotices.id })
    .from(hometaxNotices)
    .where(eq(hometaxNotices.url, url))
    .limit(1);
  return result.length > 0;
}

// ─── ManualFiles ──────────────────────────────────────────────────────────────

export async function insertManualFile(file: InsertManualFile): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(manualFiles).values(file);
  return (result as any).lastInsertRowid ?? null;
}

export async function getManualFiles(params: {
  keyword?: string;
  page: number;
  pageSize: number;
}): Promise<{ items: ManualFile[]; total: number }> {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const conditions = [];
  if (params.keyword) conditions.push(like(manualFiles.title, `%${params.keyword}%`));
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  const offset = (params.page - 1) * params.pageSize;

  const [items, countResult] = await Promise.all([
    db
      .select()
      .from(manualFiles)
      .where(where)
      .orderBy(desc(manualFiles.createdAt))
      .limit(params.pageSize)
      .offset(offset),
    db.select({ count: sql<number>`COUNT(*)` }).from(manualFiles).where(where),
  ]);

  return { items, total: Number(countResult[0]?.count ?? 0) };
}

// ─── Notifications ────────────────────────────────────────────────────────────

export async function insertNotification(notif: InsertNotification): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(notifications).values(notif);
}

export async function getNotifications(limit = 20): Promise<Notification[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(notifications)
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

export async function getUnreadCount(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(notifications)
    .where(eq(notifications.isRead, 0));
  return Number(result[0]?.count ?? 0);
}

export async function markAllNotificationsRead(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications).set({ isRead: 1 }).where(eq(notifications.isRead, 0));
}

// 홈택스 공지사항 삭제
export async function deleteHometaxNotice(id: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  try {
    // 관련 알림도 함께 삭제
    await db.delete(notifications).where(eq(notifications.noticeId, id));
    // 공지사항 삭제
    await db.delete(hometaxNotices).where(eq(hometaxNotices.id, id));
    return true;
  } catch (err) {
    console.error("[DB] Error deleting hometax notice:", err);
    return false;
  }
}

// 모든 홈택스 공지사항 삭제 (테스트용)
export async function deleteAllHometaxNotices(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  try {
    // 먼저 모든 관련 알림 삭제
    await db.delete(notifications);
    // 모든 공지사항 삭제
    const result = await db.delete(hometaxNotices);
    return (result as any)?.rowsAffected ?? 0;
  } catch (err) {
    console.error("[DB] Error deleting all hometax notices:", err);
    return 0;
  }
}
