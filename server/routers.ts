import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import {
  deleteAllHometaxNotices,
  deleteHometaxNotice,
  getHometaxNotices,
  getManualFiles,
  getNotifications,
  getUnreadCount,
  incrementViewCount,
  insertManualFile,
  insertHometaxNotice,
  markAllNotificationsRead,
} from "./db";
import { runCrawler } from "./crawler";
import axios from "axios";
import * as cheerio from "cheerio";

async function fetchTitleFromUrl(url: string): Promise<string> {
  try {
    const response = await axios.get(url, { 
      timeout: 5000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    const $ = cheerio.load(response.data);
    let title = $('title').text() || $('meta[property="og:title"]').attr('content') || "";
    
    // 홈택스 특정 제목 정제 (예: "국세청 홈택스 - 공지사항 상세")
    title = title.replace(/국세청\s*홈택스\s*-\s*/, "").trim();
    
    return title || "제목 없음";
  } catch (error) {
    console.error("[URL Fetch] Error fetching title:", error);
    return "제목 없음";
  }
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  // ─── 홈택스 전자신고 설명서 ────────────────────────────────────────────────
  hometax: router({
    list: publicProcedure
      .input(
        z.object({
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          taxType: z.string().optional(),
          docType: z.string().optional(),
          page: z.number().min(1).default(1),
          pageSize: z.number().min(1).max(100).default(20),
        })
      )
      .query(async ({ input }) => {
        return getHometaxNotices(input);
      }),
    incrementView: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await incrementViewCount(input.id);
        return { success: true };
      }),
    crawl: publicProcedure.mutation(async () => {
      const result = await runCrawler(true);
      return result;
    }),
    fetchTitle: publicProcedure
      .input(z.object({ url: z.string().url() }))
      .query(async ({ input }) => {
        const title = await fetchTitleFromUrl(input.url);
        return { title };
      }),
    create: publicProcedure
      .input(
        z.object({
          title: z.string().optional(),
          url: z.string().url("올바른 URL 형식이 아닙니다."),
          taxType: z.string().default("기타"),
          docType: z.string().default("파일설명서"),
          date: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        let finalTitle = input.title?.trim();
        if (!finalTitle) {
          finalTitle = await fetchTitleFromUrl(input.url);
        }

        const id = await insertHometaxNotice({
          title: finalTitle,
          url: input.url,
          taxType: input.taxType as any,
          docType: input.docType as any,
          date: input.date || new Date().toISOString().split("T")[0],
          viewCount: 0,
          createdAt: new Date(),
        });
        
        if (id === null) {
          throw new TRPCError({ 
            code: "CONFLICT", 
            message: "이미 존재하는 URL이거나 저장에 실패했습니다. (중복 등록 확인 필요)" 
          });
        }
        return { success: true, id };
      }),
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const success = await deleteHometaxNotice(input.id);
        if (!success) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "삭제 실패" });
        }
        return { success: true };
      }),
    deleteAll: publicProcedure.mutation(async () => {
      const count = await deleteAllHometaxNotices();
      return { success: true, deleted: count };
    })
  }),
  // ─── 내부 메뉴얼 자료실 ───────────────────────────────────────────────────
  manual: router({
    list: publicProcedure
      .input(
        z.object({
          keyword: z.string().optional(),
          page: z.number().min(1).default(1),
          pageSize: z.number().min(1).max(50).default(20),
        })
      )
      .query(async ({ input }) => {
        return getManualFiles(input);
      }),
    upload: publicProcedure
      .input(
        z.object({
          title: z.string().optional(),
          fileUrl: z.string().min(1),
          fileType: z.string().min(1),
          originalName: z.string().min(1),
          uploader: z.string().min(1, "등록자 이름은 필수입니다."),
        })
      )
      .mutation(async ({ input }) => {
        const title = input.title?.trim() || input.originalName.replace(/\.[^/.]+$/, "");
        const id = await insertManualFile({
          title,
          fileUrl: input.fileUrl,
          fileType: input.fileType,
          uploader: input.uploader,
          createdAt: new Date(),
        });
        if (id === null) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "파일 정보를 DB에 저장하는 데 실패했습니다." });
        }
        return { success: true, id };
      }),
  }),
  // ─── 알림 ─────────────────────────────────────────────────────────────────
  notifications: router({
    list: publicProcedure
      .input(z.object({ limit: z.number().min(1).max(50).default(20) }))
      .query(async ({ input }) => {
        return getNotifications(input.limit);
      }),
    unreadCount: publicProcedure.query(async () => {
      const count = await getUnreadCount();
      return { count };
    }),
    markAllRead: publicProcedure.mutation(async () => {
      await markAllNotificationsRead();
      return { success: true };
    }),
  }),
});

export type AppRouter = typeof appRouter;
