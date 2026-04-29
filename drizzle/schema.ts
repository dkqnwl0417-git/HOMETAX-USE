import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  openId: text("openId").notNull().unique(),
  name: text("name"),
  email: text("email"),
  loginMethod: text("loginMethod"),
  role: text("role").notNull().default("user"),
  createdAt: integer("createdAt").notNull(),
  updatedAt: integer("updatedAt").notNull(),
  lastSignedIn: integer("lastSignedIn").notNull(),
});

export const hometaxNotices = sqliteTable("hometaxNotices", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  url: text("url").notNull().unique(),
  date: text("date").notNull(), // "YYYY-MM-DD" 형식 문자열 유지
  taxType: text("taxType").notNull().default("기타"),
  docType: text("docType").notNull(),
  viewCount: integer("viewCount").notNull().default(0),
  createdAt: integer("createdAt").notNull(), // 타임스탬프 정수형
});

export const manualFiles = sqliteTable("manualFiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  fileUrl: text("fileUrl").notNull(),
  fileType: text("fileType").notNull(),
  originalName: text("originalName").notNull(), // 원본 파일명 저장
  mimeType: text("mimeType").notNull().default("application/octet-stream"), // MIME 타입
  uploader: text("uploader").notNull(),
  createdAt: integer("createdAt").notNull(), // 타임스탬프 정수형
});

export const notifications = sqliteTable("notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  noticeId: integer("noticeId"),
  title: text("title"),
  url: text("url"),
  message: text("message"),
  isRead: integer("isRead").notNull().default(0),
  createdAt: integer("createdAt").notNull(), // 타임스탬프 정수형
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type HometaxNotice = typeof hometaxNotices.$inferSelect;
export type InsertHometaxNotice = typeof hometaxNotices.$inferInsert;
export type ManualFile = typeof manualFiles.$inferSelect;
export type InsertManualFile = typeof manualFiles.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;
