import { text, sqliteTable, integer, index } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  openId: text("openId").notNull().unique(),
  name: text("name"),
  email: text("email"),
  loginMethod: text("loginMethod"),
  role: text("role", { enum: ["user", "admin"] }).default("user").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).notNull(),
  lastSignedIn: integer("lastSignedIn", { mode: "timestamp" }).notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// 홈택스 전자신고 설명서 공지사항
export const hometaxNotices = sqliteTable(
  "hometaxNotices",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    url: text("url").notNull().unique(),
    date: text("date").notNull(), // YYYY-MM-DD
    taxType: text("taxType", { enum: ["부가가치세", "종합소득세", "원천세", "기타"] }).default("기타").notNull(),
    docType: text("docType", { enum: ["파일설명서", "전산매체 제출요령"] }).notNull(),
    viewCount: integer("viewCount").default(0).notNull(),
    createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
  },
  (table) => ({
    dateIdx: index("idx_hometax_date").on(table.date),
    taxTypeIdx: index("idx_hometax_taxType").on(table.taxType),
  })
);

export type HometaxNotice = typeof hometaxNotices.$inferSelect;
export type InsertHometaxNotice = typeof hometaxNotices.$inferInsert;

// 내부 메뉴얼 자료실
export const manualFiles = sqliteTable("manualFiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  fileUrl: text("fileUrl").notNull(),
  fileType: text("fileType").notNull(), // pdf, doc, docx, xls, xlsx, hwp
  uploader: text("uploader").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
});

export type ManualFile = typeof manualFiles.$inferSelect;
export type InsertManualFile = typeof manualFiles.$inferInsert;

// 알림
export const notifications = sqliteTable("notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  noticeId: integer("noticeId").notNull(),
  title: text("title").notNull(),
  url: text("url").notNull(),
  isRead: integer("isRead").default(0).notNull(), // 0: 미읽음, 1: 읽음
  createdAt: integer("createdAt", { mode: "timestamp" }).notNull(),
});

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;
