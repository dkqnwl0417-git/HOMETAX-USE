import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "../drizzle/schema";
import { eq, desc } from "drizzle-orm";

const url = process.env.DATABASE_URL || "file:test.db";
const authToken = process.env.TURSO_AUTH_TOKEN;

const client = createClient({ url, authToken });
export const db = drizzle(client, { schema });

// URL 인코딩/디코딩 유틸리티
const encodeUrl = (url: string) => Buffer.from(url).toString('base64');
const decodeUrl = (encoded: string) => Buffer.from(encoded, 'base64').toString('utf-8');

export async function initDb() {
  console.log(`[DB] Connecting to ${url.startsWith("file:") ? "Local SQLite" : "Turso Database"}...`);
  try {
    // 테이블 자동 생성 (Self-Healing)
    await client.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        openId TEXT NOT NULL UNIQUE,
        name TEXT,
        email TEXT,
        loginMethod TEXT,
        role TEXT NOT NULL DEFAULT 'user',
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL,
        lastSignedIn INTEGER NOT NULL
      )
    `);
    await client.execute(`
      CREATE TABLE IF NOT EXISTS hometaxNotices (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        url TEXT NOT NULL UNIQUE,
        date TEXT NOT NULL,
        taxType TEXT NOT NULL DEFAULT '기타',
        docType TEXT NOT NULL,
        viewCount INTEGER NOT NULL DEFAULT 0,
        createdAt INTEGER NOT NULL
      )
    `);
    await client.execute(`
      CREATE TABLE IF NOT EXISTS manualFiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        fileUrl TEXT NOT NULL,
        fileType TEXT NOT NULL,
        originalName TEXT NOT NULL,
        mimeType TEXT NOT NULL DEFAULT 'application/octet-stream',
        uploader TEXT NOT NULL,
        createdAt INTEGER NOT NULL
      )
    `);
    console.log("[DB] Self-Healing Initialization Complete.");
  } catch (err) {
    console.error("[DB] Initialization Error:", err);
  }
}

// 전자신고 공지사항 관련
export async function insertHometaxNotice(data: any) {
  const encodedUrl = encodeUrl(data.url);
  // 중복 체크
  const existing = await db.select().from(schema.hometaxNotices).where(eq(schema.hometaxNotices.url, encodedUrl));
  if (existing.length > 0) return existing[0];

  const result = await db.insert(schema.hometaxNotices).values({
    title: data.title,
    url: encodedUrl,
    taxType: data.taxType,
    docType: data.docType,
    date: data.date,
    createdAt: Date.now(),
  }).returning();
  return result[0];
}

export async function listHometaxNotices() {
  const results = await db.select().from(schema.hometaxNotices).orderBy(desc(schema.hometaxNotices.createdAt));
  return results.map(item => ({ ...item, url: decodeUrl(item.url) }));
}

export async function deleteHometaxNotice(id: number) {
  return await db.delete(schema.hometaxNotices).where(eq(schema.hometaxNotices.id, id));
}

// 내부 메뉴얼 파일 관련
export async function insertManualFile(data: any) {
  const result = await db.insert(schema.manualFiles).values({
    title: data.title,
    fileUrl: data.fileUrl,
    fileType: data.fileType,
    originalName: data.originalName,
    mimeType: data.mimeType || "application/octet-stream",
    uploader: data.uploader || "system",
    createdAt: Date.now(),
  }).returning();
  return result[0];
}

export async function listManualFiles() {
  return await db.select().from(schema.manualFiles).orderBy(desc(schema.manualFiles.createdAt));
}

export async function deleteManualFile(id: number) {
  return await db.delete(schema.manualFiles).where(eq(schema.manualFiles.id, id));
}

// User 관련 (OAuth 연동용)
export async function getUserByOpenId(openId: string) {
  const result = await db.select().from(schema.users).where(eq(schema.users.openId, openId));
  return result[0];
}

export async function upsertUser(data: any) {
  const existing = await getUserByOpenId(data.openId);
  const now = Date.now();
  if (existing) {
    return await db.update(schema.users).set({
      ...data,
      updatedAt: now,
      lastSignedIn: data.lastSignedIn || now
    }).where(eq(schema.users.openId, data.openId)).returning();
  }
  return await db.insert(schema.users).values({
    ...data,
    role: data.role || 'user',
    createdAt: now,
    updatedAt: now,
    lastSignedIn: data.lastSignedIn || now
  }).returning();
}
