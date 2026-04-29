import { Link } from "wouter";
import { FileText, BookOpen, ArrowRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function Home() {
  const crawlMutation = trpc.hometax.crawl.useMutation({
    onSuccess: (data) => {
      toast.success(`크롤링 완료: 신규 ${data.inserted}건 등록`);
    },
    onError: (err) => {
      toast.error("크롤링 실패: " + err.message);
    },
  });

  return (
    <div className="relative overflow-hidden">
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

      <div className="container relative z-10 py-20 md:py-28">
        {/* Hero */}
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-primary tracking-widest uppercase mb-4">
            Tax Filing Hub
          </p>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-foreground leading-tight mb-4">
            홈택스
            <br />
            <span className="text-primary">전자신고</span> 설명서
          </h1>
          <p className="text-base md:text-lg font-light text-muted-foreground leading-relaxed mb-8 max-w-lg">
            국세청 홈택스 공지사항에서 전자신고 파일설명서와 전산매체 제출요령을 자동으로
            수집하여 제공합니다. 내부 메뉴얼 자료도 손쉽게 관리하세요.
          </p>
          <div className="flex flex-wrap gap-3">
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
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-20">
          <div className="bg-card rounded-2xl p-6 border border-border shadow-sm hover:shadow-md transition-shadow">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <h3 className="font-bold text-base text-foreground mb-2">자동 수집</h3>
            <p className="text-sm font-light text-muted-foreground leading-relaxed">
              홈택스 공지사항에서 전자신고 관련 문서를 매일 자동으로 수집합니다.
              중복 없이 최신 자료를 유지합니다.
            </p>
          </div>
          <div className="bg-card rounded-2xl p-6 border border-border shadow-sm hover:shadow-md transition-shadow">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
              style={{ background: "oklch(0.88 0.07 350 / 0.25)" }}
            >
              <BookOpen className="w-5 h-5" style={{ color: "oklch(0.38 0.1 350)" }} />
            </div>
            <h3 className="font-bold text-base text-foreground mb-2">자료실 관리</h3>
            <p className="text-sm font-light text-muted-foreground leading-relaxed">
              PDF, Word, Excel, 한글 파일을 업로드하고 팀 내에서 공유하세요.
              로그인 없이 누구나 업로드 가능합니다.
            </p>
          </div>
          <div className="bg-card rounded-2xl p-6 border border-border shadow-sm hover:shadow-md transition-shadow">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
              style={{ background: "oklch(0.85 0.08 230 / 0.2)" }}
            >
              <RefreshCw className="w-5 h-5" style={{ color: "oklch(0.38 0.12 230)" }} />
            </div>
            <h3 className="font-bold text-base text-foreground mb-2">실시간 알림</h3>
            <p className="text-sm font-light text-muted-foreground leading-relaxed">
              새로운 전자신고 설명서가 등록되면 우측 상단 알림 아이콘으로 즉시 확인할 수 있습니다.
            </p>
          </div>
        </div>

        {/* Manual Crawl Button */}
        <div className="mt-12 flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            className="gap-2 bg-card"
            onClick={() => crawlMutation.mutate()}
            disabled={crawlMutation.isPending}
          >
            <RefreshCw className={`w-4 h-4 ${crawlMutation.isPending ? "animate-spin" : ""}`} />
            {crawlMutation.isPending ? "수집 중..." : "지금 수집하기"}
          </Button>
          <p className="text-xs text-muted-foreground">
            홈택스 공지사항을 즉시 수집합니다. 자동 수집은 매일 오전 9시에 실행됩니다.
          </p>
        </div>
      </div>
    </div>
  );
}
