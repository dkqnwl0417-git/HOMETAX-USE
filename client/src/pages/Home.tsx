import { Link } from "wouter";
import { FileText, BookOpen, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { getCurrentUser, requireLogin } from "@/lib/simpleAuth";
import { toast } from "sonner";

export default function Home() {
  const { data: lastCrawlData, refetch: refetchLastCrawl } =
    trpc.hometax.lastCrawl.useQuery();

  const lastCrawledAt = lastCrawlData?.crawledAt
    ? new Date(lastCrawlData.crawledAt).toLocaleString("ko-KR")
    : "아직 수집 이력이 없습니다.";
  
  const crawlMutation = trpc.hometax.crawl.useMutation({
    onSuccess: (data) => {
      toast.success(`크롤링 완료: 신규 ${data.inserted}건 등록`);
      refetchLastCrawl();
    },
    onError: (err) => {
      toast.error("크롤링 실패: " + err.message);
    },
  });

  return (
    <div className="relative min-w-[1200px] overflow-hidden">
      {/* Geometric accent blobs */}
      <div
        className="geo-blob w-96 h-96 -top-20 -right-20 opacity-40"
        style={{ background: "oklch(0.82 0.09 230 / 0.3)" }}
      />
      <div
        className="geo-blob w-64 h-64 top-40 -left-10 opacity-30"
        style={{ background: "oklch(0.88 0.07 350 / 0.3)" }}
      />
      <div
        className="geo-blob w-48 h-48 bottom-20 right-1/4 opacity-20"
        style={{ background: "oklch(0.85 0.08 230 / 0.25)" }}
      />

      <div className="mx-auto w-[1200px] min-w-[1200px] px-8 relative z-10 py-28">
        {/* Hero */}
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-primary tracking-widest uppercase mb-4">
            Tax Filing Hub
          </p>
          <h1 className="text-6xl font-extrabold text-foreground leading-tight mb-4">
            홈택스
            <br />
            <span className="text-primary">전자신고</span> 설명서
          </h1>
          <p className="text-lg font-medium text-foreground/80 leading-8 mb-8 max-w-xl">
            국세청 홈택스 공지사항에서 전자신고 파일설명서와
            전산매체 제출요령을 자동으로 수집하여 제공합니다.
            <br />
            내부 메뉴얼 자료도 손쉽게 관리할 수 있습니다.
          </p>
          <div className="space-y-3">
            <div className="flex gap-3">
              <Link href="/hometax">
                <Button size="lg" className="gap-2 font-semibold">
                  <FileText className="w-4 h-4" />
                  전자신고 설명서 보기
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>

              <Link href="/manual">
                <Button size="lg" variant="outline" className="gap-2 font-semibold bg-card">
                  <BookOpen className="w-4 h-4" />
                  내부 메뉴얼 자료실
                </Button>
              </Link>
            </div>

            <div className="text-xs text-muted-foreground leading-relaxed">
              <p>
                홈택스 공지사항을 자동 수집합니다. 자동 수집은 매일 오전 9시, 오후 3시에 실행됩니다.
              </p>
              <p>
                마지막 수집일시: {lastCrawledAt}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
