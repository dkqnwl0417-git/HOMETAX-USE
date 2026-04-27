import type { Express } from "express";

export function registerHometaxProxy(app: Express) {
  // 홈택스 URL 우회 리다이렉트 엔드포인트
  app.get("/api/hometax-view", (req: any, res: any) => {
    const { url } = req.query;
    if (!url) {
      return res.status(400).send("URL이 필요합니다.");
    }

    const decodedUrl = decodeURIComponent(url as string);
    
    // 홈택스 보안 정책 우회를 위한 HTML 메타 리다이렉트 방식 사용
    // Referer를 제거하거나 조작하여 홈택스 메인으로 튕기는 것을 방지
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="referrer" content="no-referrer">
        <title>홈택스 연결 중...</title>
        <script>
          // Referer 없이 이동하도록 강제
          window.onload = function() {
            const a = document.createElement('a');
            a.href = "${decodedUrl}";
            a.rel = "noreferrer";
            document.body.appendChild(a);
            a.click();
          };
        </script>
      </head>
      <body>
        <p>홈택스로 안전하게 연결 중입니다. 잠시만 기다려주세요...</p>
      </body>
      </html>
    `);
  });
}
