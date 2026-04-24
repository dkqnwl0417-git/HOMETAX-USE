import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "../drizzle/schema";
import { eq, desc, and, like, sql } from "drizzle-orm";

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

  // ★ initDb는 getDb() 완료 후 dbInstance를 직접 사용 — 재귀 방지
  await _initTables(dbInstance);
  return dbInstance;
}

// index.ts 에서 직접 호출하는 용도 (서버 시작 시)
export async function initDb() {
  await getDb(); // 이미 초기화됐으면 재사용
}

async function _initTables(db: any) {
  try {
    console.log("[DB] Initializing tables...");

    await db.run(sql`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE,
        password TEXT,
        role TEXT DEFAULT 'user',
        created_at INTEGER
      )
    `);

    await db.run(sql`
      CREATE TABLE IF NOT EXISTS hometax_notices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        url TEXT NOT NULL UNIQUE,
        tax_type TEXT NOT NULL DEFAULT '기타',
        doc_type TEXT NOT NULL DEFAULT '파일설명서',
        date TEXT NOT NULL,
        view_count INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL
      )
    `);

    // ★ original_name 컬럼 포함
    await db.run(sql`
      CREATE TABLE IF NOT EXISTS manual_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        file_url TEXT NOT NULL,
        file_type TEXT NOT NULL,
        original_name TEXT NOT NULL DEFAULT '',
        uploader TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);

    // ★ 기존 DB에 original_name 컬럼이 없을 경우 추가 (마이그레이션)
    try {
      await db.run(sql`ALTER TABLE manual_files ADD COLUMN original_name TEXT NOT NULL DEFAULT ''`);
      console.log("[DB] Migrated: added original_name to manual_files");
    } catch {
      // 이미 존재하면 무시
    }

    await db.run(sql`
      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        message TEXT,
        is_read INTEGER DEFAULT 0,
        created_at INTEGER
      )
    `);

    console.log("[DB] Initialization complete.");
  } catch (err) {
    console.error("[DB] Initialization error:", err);
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

  // ★ URL 복원 (Base64 → 원문)
  const restoredItems = items.map((item: any) => ({
    ...item,
    url: item.url.startsWith("b64:")
      ? Buffer.from(item.url.substring(4), "base64").toString("utf8")
      : item.url,
  }));

  return { items: restoredItems, total: 100 };
}

export async function insertHometaxNotice(data: any) {
  const db = await getDb();
  try {
    // ★ URL을 Base64로 저장 (UNIQUE 제약과 궁합)
    const encodedUrl = "b64:" + Buffer.from(data.url, "utf8").toString("base64");

    const existing = await db.query.hometaxNotices.findFirst({
      where: eq(schema.hometaxNotices.url, encodedUrl),
    });
    if (existing) return null; // 중복

    const result = await db
      .insert(schema.hometaxNotices)
      .values({
        title: data.title,
        url: encodedUrl,
        taxType: data.taxType,
        docType: data.docType,
        date: data.date,
        viewCount: data.viewCount ?? 0,
        createdAt: data.createdAt ?? new Date(),
      })
      .returning();

    return result[0].id;
  } catch (err) {
    console.error("[DB] insertHometaxNotice error:", err);
    return null;
  }
}

export async function deleteHometaxNotice(id: number) {
  const db = await getDb();
  try {
    await db.delete(schema.hometaxNotices).where(eq(schema.hometaxNotices.id, id));
    return true;
  } catch {
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
  await db
    .update(schema.hometaxNotices)
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
    const result = await db
      .insert(schema.manualFiles)
      .values({
        title: data.title,
        fileUrl: data.fileUrl,
        fileType: data.fileType,
        originalName: data.originalName || data.title, // ★ 원본 파일명 저장
        uploader: data.uploader,
        createdAt: data.createdAt ?? new Date(),
      })
      .returning();

    return result[0].id;
  } catch (err) {
    console.error("[DB] insertManualFile error:", err);
    return null;
  }
}

export async function deleteManualFile(id: number) {
  const db = await getDb();
  try {
    await db.delete(schema.manualFiles).where(eq(schema.manualFiles.id, id));
    return true;
  } catch {
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
  const result = await db
    .select({ count: sql`count(*)` })
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
    createdAt: new Date(),
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
