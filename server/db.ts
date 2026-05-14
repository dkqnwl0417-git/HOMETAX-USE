import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "../drizzle/schema";
import { eq, and, gte, lte, lt, desc, like, sql } from "drizzle-orm";

let _db: any = null;

async function getDb() {
  if (_db) return _db;

  const url = process.env.DATABASE_URL || "file:sqlite.db";
  const authToken = process.env.TURSO_AUTH_TOKEN;

  console.log("[DB] Connecting to:", url);

  const client = createClient({
    url,
    authToken
  });

  _db = drizzle(client, { schema });

  return _db;
}

export async function initDb() {
  try {
    const db = await getDb();

    console.log("[DB] Initializing tables if not exist...");

    const client =
      (db as any).$client ||
      createClient({
        url: process.env.DATABASE_URL || "file:sqlite.db",
        authToken: process.env.TURSO_AUTH_TOKEN
      });

    await client.execute(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "openId" text NOT NULL UNIQUE,
        "name" text,
        "email" text,
        "loginMethod" text,
        "role" text DEFAULT 'user' NOT NULL,
        "createdAt" integer NOT NULL,
        "updatedAt" integer NOT NULL,
        "lastSignedIn" integer NOT NULL
      )
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS "hometaxNotices" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "title" text NOT NULL,
        "url" text NOT NULL,
        "date" text NOT NULL,
        "taxType" text DEFAULT '기타' NOT NULL,
        "docType" text NOT NULL,
        "viewCount" integer DEFAULT 0 NOT NULL,
        "content" text,
        "attachments" text,
        "sourceType" text DEFAULT 'manual' NOT NULL,
        "createdAt" integer NOT NULL
      )
    `);

    await client
      .execute(`ALTER TABLE "hometaxNotices" ADD COLUMN "content" text`)
      .catch(() => {});

    await client
      .execute(`ALTER TABLE "hometaxNotices" ADD COLUMN "attachments" text`)
      .catch(() => {});

    await client
      .execute(
        `ALTER TABLE "hometaxNotices" ADD COLUMN "sourceType" text DEFAULT 'manual' NOT NULL`
      )
      .catch(() => {});

    await client.execute(`
      CREATE TABLE IF NOT EXISTS "manualFiles" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "title" text NOT NULL,
        "fileUrl" text NOT NULL,
        "fileType" text NOT NULL,
        "originalName" text NOT NULL,
        "mimeType" text DEFAULT 'application/octet-stream' NOT NULL,
        "uploader" text NOT NULL,
        "createdAt" integer NOT NULL
      )
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS "notifications" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "noticeId" integer,
        "title" text,
        "url" text,
        "message" text,
        "isRead" integer DEFAULT 0 NOT NULL,
        "createdAt" integer NOT NULL
      )
    `);

    await client.execute(`
      CREATE TABLE IF NOT EXISTS "loginUsers" (
        "id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
        "username" text NOT NULL UNIQUE,
        "password" text NOT NULL,
        "passwordSetupDone" integer DEFAULT 0 NOT NULL,
        "role" text DEFAULT 'user' NOT NULL,
        "createdAt" integer NOT NULL,
        "updatedAt" integer NOT NULL
      )
    `);

    await client
      .execute(`ALTER TABLE "loginUsers" ADD COLUMN "role" text DEFAULT 'user' NOT NULL`)
      .catch(() => {});
    
    await client
  .execute(`ALTER TABLE "loginUsers" ADD COLUMN "role" text DEFAULT 'user' NOT NULL`)
  .catch(() => {});

const initialLoginUsers = [
  "김지웅",
  "이영철",
  "전열",
  "하해인",
  "이영수",
  "강우영",
  "김용휘",
  "이건희",
  "정성희",
  "김지현",
  "김도연",
  "권은진",
  "문영숙",
  "빈나리",
  "이성봉",
  "조은진",
  "장혜연",
  "이은수",
  "지동근",
  "이태호",
  "김명순",
  "우가영",
  "이하연",
  "이준원",
  "장지훈",
  "노동현",
  "박현욱",
  "이지수",
  "강주은",
  "이수빈",
];

for (const username of initialLoginUsers) {
  await client.execute({
    sql: `
      INSERT INTO "loginUsers" (
        "username",
        "password",
        "passwordSetupDone",
        "role",
        "createdAt",
        "updatedAt"
      )
      SELECT
        ?,
        '1',
        0,
        'user',
        strftime('%s','now') * 1000,
        strftime('%s','now') * 1000
      WHERE NOT EXISTS (
        SELECT 1 FROM "loginUsers" WHERE "username" = ?
      )
    `,
    args: [username, username],
  });
}

await client.execute(`
  INSERT INTO "loginUsers" (
    "username",
    "password",
    "passwordSetupDone",
    "role",
    "createdAt",
    "updatedAt"
  )
  SELECT
    'admin',
    'adminaicc',
    1,
    'admin',
    strftime('%s','now') * 1000,
    strftime('%s','now') * 1000
  WHERE NOT EXISTS (
    SELECT 1 FROM "loginUsers" WHERE "username" = 'admin'
  )
`);
    await client.execute(`
      UPDATE "loginUsers"
      SET "role" = 'user'
      WHERE "username" = '김지웅'
    `);
    
    await client.execute(`
      UPDATE "loginUsers"
      SET "role" = 'admin'
      WHERE "username" = 'admin'
    `);
    
    await client.execute(`
      CREATE TABLE IF NOT EXISTS "appSettings" (
        "key" text PRIMARY KEY NOT NULL,
        "value" text NOT NULL,
        "updatedAt" integer NOT NULL
      )
    `);

    console.log("[DB] Table initialization complete.");
  } catch (err) {
    console.error("[DB] Initialization failed:", err);
  }
}

export async function loginWithPassword(username: string, password: string) {
  const db = await getDb();

  const user = await db.query.loginUsers.findFirst({
    where: eq(schema.loginUsers.username, username),
  });

  if (!user) {
    return {
      success: false,
      message: "등록되지 않은 아이디입니다.",
    };
  }

  if (user.password !== password) {
    return {
      success: false,
      message: "비밀번호가 일치하지 않습니다.",
    };
  }

  return {
    success: true,
    user: {
      username: user.username,
      role: user.role || "user",
    },
    isInitialPassword: user.password === "1" && user.passwordSetupDone === 0,
  };
}

export async function updateLoginPasswordWithCurrent(
  username: string,
  currentPassword: string,
  newPassword: string
) {
  const db = await getDb();

  const user = await db.query.loginUsers.findFirst({
    where: eq(schema.loginUsers.username, username),
  });

  if (!user) {
    return {
      success: false,
      message: "사용자 정보를 찾을 수 없습니다.",
    };
  }

  if (user.password !== currentPassword) {
    return {
      success: false,
      message: "현재 비밀번호가 일치하지 않습니다.",
    };
  }

  if (!newPassword.trim()) {
    return {
      success: false,
      message: "새 비밀번호를 입력해주세요.",
    };
  }

  await db
    .update(schema.loginUsers)
    .set({
      password: newPassword.trim(),
      passwordSetupDone: 1,
      updatedAt: new Date().getTime(),
    })
    .where(eq(schema.loginUsers.username, username));

  return {
    success: true,
    message: "비밀번호가 변경되었습니다.",
  };
}

export async function updateLoginPassword(username: string, password: string) {
  const db = await getDb();

  await db
    .update(schema.loginUsers)
    .set({
      password,
      passwordSetupDone: 1,
      updatedAt: new Date().getTime(),
    })
    .where(eq(schema.loginUsers.username, username));

  return true;
}

export async function getLoginUsers() {
  const db = await getDb();

  return db.query.loginUsers.findMany({
    orderBy: [desc(schema.loginUsers.id)],
  });
}

export async function createLoginUser(username: string) {
  const db = await getDb();
  const now = new Date().getTime();

  const existing = await db.query.loginUsers.findFirst({
    where: eq(schema.loginUsers.username, username),
  });

  if (existing) {
    return {
      success: false,
      message: "이미 존재하는 사용자입니다.",
    };
  }

  await db.insert(schema.loginUsers).values({
    username,
    password: "1",
    passwordSetupDone: 0,
    role: "user",
    createdAt: now,
    updatedAt: now,
  });

  return { success: true };
}

export async function deleteLoginUser(username: string) {
  if (username === "admin") {
    return {
      success: false,
      message: "관리자 계정은 삭제할 수 없습니다.",
    };
  }

  const db = await getDb();

  await db
    .delete(schema.loginUsers)
    .where(eq(schema.loginUsers.username, username));

  return { success: true };
}

export async function resetLoginPassword(username: string) {
  const db = await getDb();

  await db
    .update(schema.loginUsers)
    .set({
      password: "1",
      passwordSetupDone: 0,
      updatedAt: new Date().getTime(),
    })
    .where(eq(schema.loginUsers.username, username));

  return { success: true };
}

export async function saveLastCrawledAt(crawledAt: number) {
  const db = await getDb();

  await db
    .insert(schema.appSettings)
    .values({
      key: "lastCrawledAt",
      value: String(crawledAt),
      updatedAt: crawledAt,
    })
    .onConflictDoUpdate({
      target: schema.appSettings.key,
      set: {
        value: String(crawledAt),
        updatedAt: crawledAt,
      },
    });
}

export async function getLastCrawledAt() {
  const db = await getDb();

  const result = await db.query.appSettings.findFirst({
    where: eq(schema.appSettings.key, "lastCrawledAt"),
  });

  return result ? Number(result.value) : null;
}

export async function getHometaxNotices(filters: any) {
  const db = await getDb();

  

  const conditions = [];

  if (filters.startDate) {
    conditions.push(
      gte(schema.hometaxNotices.date, filters.startDate)
    );
  }

  if (filters.endDate) {
    conditions.push(
      lte(schema.hometaxNotices.date, filters.endDate)
    );
  }

  if (filters.taxType) {
    conditions.push(
      eq(schema.hometaxNotices.taxType, filters.taxType)
    );
  }

  if (filters.docType) {
    conditions.push(
      eq(schema.hometaxNotices.docType, filters.docType)
    );
  }

  if (filters.keyword) {
    conditions.push(
      like(schema.hometaxNotices.title, `%${filters.keyword}%`)
    );
  }

  const items = await db.query.hometaxNotices.findMany({
    where: conditions.length > 0
      ? and(...conditions)
      : undefined,

    orderBy: [
      desc(schema.hometaxNotices.date),
      desc(schema.hometaxNotices.id)
    ],

    limit: filters.pageSize,

    offset:
      (filters.page - 1) * filters.pageSize,
  });

  const countResult = await db
    .select({
      count: sql`count(*)`
    })
    .from(schema.hometaxNotices)
    .where(
      conditions.length > 0
        ? and(...conditions)
        : undefined
    );

  return {
    items,
    total: Number(countResult[0]?.count || 0)
  };
}

export async function insertHometaxNotice(data: any) {
  const db = await getDb();

  try {
    console.log(
      "[DB] Attempting to insert notice:",
      data.url
    );

    const existing =
      await db.query.hometaxNotices.findFirst({
        where: and(
          eq(schema.hometaxNotices.title, data.title),
          eq(schema.hometaxNotices.date, data.date)
        )
      });

    if (existing) {
      console.warn(
        "[DB] Duplicate title/date detected:",
        data.title,
        data.date
      );

      return null;
    }

    const values = {
      title: data.title,
      url: data.url,
      date: data.date,
      taxType: data.taxType,
      docType: data.docType,
      content: data.content || null,
      attachments: data.attachments || null,
      sourceType: data.sourceType || "manual",
      viewCount: 0,
      createdAt: new Date().getTime()
    };

    const result = await db
      .insert(schema.hometaxNotices)
      .values(values)
      .returning({
        id: schema.hometaxNotices.id
      });

    if (result && result.length > 0) {
      console.log(
        "[DB] Successfully inserted notice, ID:",
        result[0].id
      );

      return result[0].id;
    }

    return null;
  } catch (err: any) {
    console.error(
      "[DB] Error in insertHometaxNotice:",
      err
    );

    if (err.message?.includes("no such table")) {
      await initDb();
    }

    return null;
  }
}

export async function urlExists(url: string) {
  try {
    const db = await getDb();

    const existing =
      await db.query.hometaxNotices.findFirst({
        where: eq(schema.hometaxNotices.url, url)
      });

    return !!existing;
  } catch {
    return false;
  }
}

export async function incrementViewCount(id: number) {
  const db = await getDb();

  await db
    .update(schema.hometaxNotices)
    .set({
      viewCount: sql`viewCount + 1`
    })
    .where(
      eq(schema.hometaxNotices.id, id)
    );
}

export async function getHometaxNoticeById(id: number) {
  const db = await getDb();

  return db.query.hometaxNotices.findFirst({
    where: eq(schema.hometaxNotices.id, id),
  });
}

export async function updateHometaxNotice(id: number, data: any) {
  const db = await getDb();

  try {
    await db
      .update(schema.hometaxNotices)
      .set({
        title: data.title,
        url: data.url,
        taxType: data.taxType,
        docType: data.docType,
        date: data.date,
        content: data.content || null,
        attachments: data.attachments || null,
        sourceType: data.sourceType || "manual",
      })
      .where(
        eq(schema.hometaxNotices.id, id)
      );

    return true;
  } catch (err) {
    console.error(
      "[DB] Error in updateHometaxNotice:",
      err
    );

    return false;
  }
}
export async function deleteAllNotifications() {
  const db = await getDb();

  const result = await db.delete(schema.notifications);

  return Number(result.rowsAffected || 0);
}

export async function deleteHometaxNotice(id: number) {
  const db = await getDb();

  try {
    await db
      .delete(schema.notifications)
      .where(eq(schema.notifications.noticeId, id));

    await db
      .delete(schema.hometaxNotices)
      .where(eq(schema.hometaxNotices.id, id));

    return true;
  } catch {
    return false;
  }
}

export async function deleteAllHometaxNotices() {
  const db = await getDb();

  await db.delete(schema.notifications);

  const result = await db.delete(schema.hometaxNotices);

  return Number(result.rowsAffected || 0);
}

export async function getManualFiles(filters: any) {
  const db = await getDb();

  const conditions = [];

  if (filters.keyword) {
    conditions.push(
      like(schema.manualFiles.title, `%${filters.keyword}%`)
    );
  }

  const items =
    await db.query.manualFiles.findMany({
      where:
        conditions.length > 0
          ? and(...conditions)
          : undefined,

      orderBy: [
        desc(schema.manualFiles.createdAt)
      ],

      limit: filters.pageSize,

      offset:
        (filters.page - 1) * filters.pageSize,
    });

  const countResult = await db
    .select({
      count: sql`count(*)`
    })
    .from(schema.manualFiles)
    .where(
      conditions.length > 0
        ? and(...conditions)
        : undefined
    );

  return {
    items,
    total: Number(countResult[0]?.count || 0)
  };
}

export async function insertManualFile(data: any) {
  const db = await getDb();

  try {
    const values = {
      title: data.title,
      fileUrl: data.fileUrl,
      fileType: data.fileType,
      originalName: data.originalName,
      mimeType:
        data.mimeType ||
        "application/octet-stream",

      uploader: data.uploader,

      createdAt: new Date().getTime()
    };

    const result = await db
      .insert(schema.manualFiles)
      .values(values)
      .returning({
        id: schema.manualFiles.id
      });

    if (result && result.length > 0) {
      return result[0].id;
    }

    return null;
  } catch (err: any) {
    console.error(
      "[DB] Error in insertManualFile:",
      err
    );

    if (err.message?.includes("no such table")) {
      await initDb();
    }

    return null;
  }
}

export async function deleteManualFile(id: number) {
  const db = await getDb();

  try {
    await db
      .delete(schema.manualFiles)
      .where(
        eq(schema.manualFiles.id, id)
      );

    return true;
  } catch {
    return false;
  }
}

export async function deleteExpiredNotifications() {
  const db = await getDb();

  const sevenDaysAgo =
    new Date().getTime() -
    7 * 24 * 60 * 60 * 1000;

  await db
    .delete(schema.notifications)
    .where(
      lt(
        schema.notifications.createdAt,
        sevenDaysAgo
      )
    );
}

export async function getNotifications(
  page = 1,
  pageSize = 5
) {
  const db = await getDb();

  await deleteExpiredNotifications();

  const items =
    await db.query.notifications.findMany({
      orderBy: [
        desc(schema.notifications.createdAt)
      ],

      limit: pageSize,

      offset:
        (page - 1) * pageSize,
    });

  const countResult = await db
    .select({
      count: sql`count(*)`
    })
    .from(schema.notifications);

  return {
    items,
    total: Number(countResult[0]?.count || 0),
    page,
    pageSize,
  };
}

export async function deleteNotification(id: number) {
  const db = await getDb();

  await db
    .delete(schema.notifications)
    .where(
      eq(schema.notifications.id, id)
    );

  return true;
}

export async function getUnreadCount() {
  const db = await getDb();

  const result = await db
    .select({
      count: sql`count(*)`
    })
    .from(schema.notifications)
    .where(
      eq(schema.notifications.isRead, 0)
    );

  return Number(result[0]?.count || 0);
}

export async function markAllNotificationsRead() {
  const db = await getDb();

  await db
    .update(schema.notifications)
    .set({
      isRead: 1
    });
}

export async function insertNotification(data: any) {
  try {
    const db = await getDb();

    await db
      .insert(schema.notifications)
      .values({
        noticeId: data.noticeId,
        title: data.title,
        url: data.url,
        isRead: data.isRead || 0,
        createdAt: new Date().getTime()
      });
  } catch (err) {
    console.error(
      "[DB] Error in insertNotification:",
      err
    );
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();

  return db.query.users.findFirst({
    where: eq(schema.users.openId, openId)
  });
}

export async function upsertUser(data: any) {
  const db = await getDb();

  const existing =
    await getUserByOpenId(data.openId);

  if (existing) {
    await db
      .update(schema.users)
      .set({
        ...data,
        updatedAt: new Date().getTime(),
        lastSignedIn: new Date().getTime()
      })
      .where(
        eq(schema.users.openId, data.openId)
      );

    return existing;
  }

  const result = await db
    .insert(schema.users)
    .values({
      ...data,
      createdAt: new Date().getTime(),
      updatedAt: new Date().getTime(),
      lastSignedIn: new Date().getTime()
    })
    .returning();

  return result[0];
}
