import { z } from "zod";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { 
  insertHometaxNotice, 
  listHometaxNotices, 
  deleteHometaxNotice,
  insertManualFile,
  listManualFiles,
  deleteManualFile
} from "./db";
import { crawlHometax } from "./hometaxCrawler";
import { uploadToCloudinary } from "./cloudinaryUpload";
import express from "express";
import multer from "multer";
import { COOKIE_NAME } from "../shared/const";

const upload = multer({ storage: multer.memoryStorage() });

export const appRouter = router({
  // 인증 관련 라우터
  auth: router({
    me: publicProcedure.query(({ ctx }) => {
      return ctx.user || null;
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(COOKIE_NAME, {
        maxAge: -1,
        secure: true,
        sameSite: "none",
        httpOnly: true,
        path: "/",
      });
      return { success: true };
    }),
  }),

  // 홈택스 관련 라우터
  hometax: router({
    list: publicProcedure.query(async () => {
      return await listHometaxNotices();
    }),
    crawl: publicProcedure.mutation(async () => {
      const results = await crawlHometax();
      for (const item of results) {
        await insertHometaxNotice(item);
      }
      return { success: true, count: results.length };
    }),
    add: publicProcedure
      .input(z.object({
        title: z.string(),
        url: z.string(),
        taxType: z.string(),
        docType: z.string(),
        date: z.string()
      }))
      .mutation(async ({ input }) => {
        return await insertHometaxNotice(input);
      }),
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await deleteHometaxNotice(input.id);
      }),
  }),

  // 매뉴얼 관련 라우터
  manual: router({
    list: publicProcedure.query(async () => {
      return await listManualFiles();
    }),
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        return await deleteManualFile(input.id);
      }),
  })
});

export type AppRouter = typeof appRouter;

// Express 전용 라우터 (파일 업로드용)
export const expressRouter = express.Router();

expressRouter.post("/manual/upload", upload.array("files"), async (req, res) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "파일이 없습니다." });
    }

    const results = [];
    for (const file of files) {
      // Cloudinary 업로드
      const uploadResult = await uploadToCloudinary(file.buffer, file.originalname);
      
      // DB 저장 (schema.ts 구조에 맞게 수정)
      const dbResult = await insertManualFile({
        title: file.originalname,
        fileUrl: uploadResult.secure_url,
        fileType: file.originalname.split('.').pop() || 'unknown',
        originalName: file.originalname,
        mimeType: file.mimetype,
        uploader: "system", // 기본값
      });
      results.push(dbResult);
    }

    res.json({ success: true, results });
  } catch (error: any) {
    console.error("[Upload Error]", error);
    res.status(500).json({ error: error.message });
  }
});
