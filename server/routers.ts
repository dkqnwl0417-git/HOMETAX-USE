import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import * as db from "./db";
import { crawlHometax } from "./hometaxCrawler";

const t = initTRPC.create();

export const appRouter = t.router({
  hometax: t.router({
    list: t.procedure
      .input(z.object({
        taxType: z.string().optional(),
        docType: z.string().optional(),
        page: z.number().default(1),
        pageSize: z.number().default(15),
      }))
      .query(async ({ input }) => {
        return await db.getHometaxNotices(input);
      }),
    
    crawl: t.procedure
      .input(z.object({}))
      .mutation(async () => {
        try {
          const results = await crawlHometax();
          let inserted = 0;
          for (const item of results) {
            const id = await db.insertHometaxNotice(item);
            if (id) inserted++;
          }
          return { inserted };
        } catch (err) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "크롤링 중 오류가 발생했습니다.",
          });
        }
      }),

    insert: t.procedure
      .input(z.object({
        title: z.string(),
        url: z.string(),
        taxType: z.string(),
        docType: z.string(),
        date: z.string(),
      }))
      .mutation(async ({ input }) => {
        const id = await db.insertHometaxNotice(input);
        if (!id) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "이미 존재하는 URL이거나 저장에 실패했습니다.",
          });
        }
        return { id };
      }),

    delete: t.procedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const success = await db.deleteHometaxNotice(input.id);
        if (!success) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "삭제에 실패했습니다.",
          });
        }
        return { success: true };
      }),
  }),

  manual: t.router({
    list: t.procedure
      .input(z.object({
        keyword: z.string().optional(),
        page: z.number().default(1),
        pageSize: z.number().default(10),
      }))
      .query(async ({ input }) => {
        return await db.getManualFiles(input);
      }),

    upload: t.procedure
      .input(z.object({
        title: z.string(),
        fileUrl: z.string(),
        fileType: z.string(),
        originalName: z.string(),
        uploader: z.string(),
      }))
      .mutation(async ({ input }) => {
        const id = await db.insertManualFile(input);
        if (!id) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "파일 정보를 DB에 저장하는 데 실패했습니다.",
          });
        }
        return { id };
      }),

    delete: t.procedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const success = await db.deleteManualFile(input.id);
        if (!success) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "삭제에 실패했습니다.",
          });
        }
        return { success: true };
      }),
  }),

  notification: t.router({
    list: t.procedure
      .input(z.object({ limit: z.number().default(5) }))
      .query(async ({ input }) => {
        return await db.getNotifications(input.limit);
      }),
    
    unreadCount: t.procedure.query(async () => {
      return await db.getUnreadCount();
    }),

    markAllRead: t.procedure.mutation(async () => {
      await db.markAllNotificationsRead();
      return { success: true };
    }),
  }),
});

export type AppRouter = typeof appRouter;
