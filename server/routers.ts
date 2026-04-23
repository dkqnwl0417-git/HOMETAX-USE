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
  markAllNotificationsRead,
} from "./db";
import { runCrawler } from "./crawler";

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
        // 제목 미입력 시 파일명(확장자 제거)으로 자동 설정
        const title =
          input.title?.trim() ||
          input.originalName.replace(/\.[^/.]+$/, "");

        const id = await insertManualFile({
          title,
          fileUrl: input.fileUrl,
          fileType: input.fileType,
          uploader: input.uploader,
        });

        if (id === null) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "파일 저장 실패" });
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
