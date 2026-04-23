import { useState, useMemo } from "react";
import { ExternalLink, Eye, Search, RefreshCw, ChevronLeft, ChevronRight, Filter, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TAX_TYPES = ["전체", "부가가치세", "종합소득세", "원천세", "기타"];
const DOC_TYPES = ["전체", "파일설명서", "전산매체 제출요령"];
const PAGE_SIZE = 20;

function TaxBadge({ type }: { type: string }) {
  const cls = {
    부가가치세: "bg-blue-50 text-blue-700",
    종합소득세: "bg-emerald-50 text-emerald-700",
    원천세: "bg-amber-50 text-amber-700",
    기타: "bg-gray-100 text-gray-600",
  }[type] ?? "bg-gray-100 text-gray-600";
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium", cls)}>
      {type}
    </span>
  );
}

function DocBadge({ type }: { type: string }) {
  const cls =
    type === "파일설명서"
      ? "bg-pink-50 text-pink-700"
      : "bg-violet-50 text-violet-700";
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-xs font-medium", cls)}>
      {type}
    </span>
  );
}

export default function HometaxNotices() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [taxType, setTaxType] = useState("전체");
  const [docType, setDocType] = useState("전체");
  const [page, setPage] = useState(1);

  const queryInput = useMemo(
    () => ({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      taxType: taxType === "전체" ? undefined : taxType,
      docType: docType === "전체" ? undefined : docType,
      page,
      pageSize: PAGE_SIZE,
    }),
    [startDate, endDate, taxType, docType, page]
  );

  const { data, isLoading, refetch } = trpc.hometax.list.useQuery(queryInput);
  const incrementView = trpc.hometax.incrementView.useMutation();
  const deleteMutation = trpc.hometax.delete.useMutation({
    onSuccess: () => {
      toast.success("삭제되었습니다.");
      refetch();
    },
    onError: (err) => toast.error("삭제 실패: " + err.message),
  });
  const deleteAllMutation = trpc.hometax.deleteAll.useMutation({
    onSuccess: (result) => {
      toast.success(`${result.deleted}건 삭제되었습니다.`);
      refetch();
    },
    onError: (err) => toast.error("삭제 실패: " + err.message),
  });
  const crawlMutation = trpc.hometax.crawl.useMutation({
    onSuccess: (result) => {
      toast.success(`수집 완료: 신규 ${result.inserted}건 등록`);
      refetch();
    },
    onError: (err) => toast.error("수집 실패: " + err.message),
  });

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  const handleTitleClick = (id: number, url: string) => {
    incrementView.mutate({ id });
    // URL이 유효한지 확인
    if (url && url.startsWith("http")) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      console.error("Invalid URL:", url);
      toast.error("유효하지 않은 링크입니다.");
    }
  };

  const handleFilterReset = () => {
    setStartDate("");
    setEndDate("");
    setTaxType("전체");
    setDocType("전체");
    setPage(1);
  };

  return (
    <div className="container py-10">
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-primary tracking-widest uppercase mb-1">
            Hometax
          </p>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">
            전자신고 설명서
          </h1>
          <p className="text-sm font-light text-muted-foreground mt-1">
            홈택스 공지사항에서 자동 수집된 전자신고 파일설명서 및 전산매체 제출요령
          </p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <Button
            size="sm"
            variant="outline"
            className="gap-2 bg-card"
            onClick={() => crawlMutation.mutate()}
            disabled={crawlMutation.isPending}
          >
            <RefreshCw className={cn("w-4 h-4", crawlMutation.isPending && "animate-spin")} />
            {crawlMutation.isPending ? "수집 중..." : "지금 수집"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={() => {
              if (confirm("모든 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) {
                deleteAllMutation.mutate();
              }
            }}
            disabled={deleteAllMutation.isPending}
          >
            <Trash2 className="w-4 h-4" />
            {deleteAllMutation.isPending ? "삭제 중..." : "전체 삭제"}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card border border-border rounded-xl p-4 mb-6 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">필터</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">시작일</label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              className="h-9 text-sm bg-background"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">종료일</label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              className="h-9 text-sm bg-background"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">세금 유형</label>
            <Select value={taxType} onValueChange={(v) => { setTaxType(v); setPage(1); }}>
              <SelectTrigger className="h-9 text-sm bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TAX_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">문서 유형</label>
            <Select value={docType} onValueChange={(v) => { setDocType(v); setPage(1); }}>
              <SelectTrigger className="h-9 text-sm bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOC_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <Button variant="ghost" size="sm" onClick={handleFilterReset} className="text-xs text-muted-foreground">
            필터 초기화
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {/* Table header info */}
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            총 <strong className="text-foreground">{data?.total ?? 0}</strong>건
          </span>
          <span className="text-xs text-muted-foreground">최신순 정렬</span>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-primary/50" />
            불러오는 중...
          </div>
        ) : !data?.items.length ? (
          <div className="py-16 text-center">
            <Search className="w-8 h-8 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">조건에 맞는 데이터가 없습니다.</p>
            <p className="text-xs text-muted-foreground mt-1">
              필터를 변경하거나 수집 버튼을 눌러보세요.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-12">
                    No
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    제목
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-28 hidden sm:table-cell">
                    세금 유형
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-36 hidden md:table-cell">
                    문서 유형
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-28 hidden lg:table-cell">
                    등록일
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider w-20">
                    조회수
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider w-16">
                    삭제
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item, idx) => (
                  <tr
                    key={item.id}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors"
                  >
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {(page - 1) * PAGE_SIZE + idx + 1}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleTitleClick(item.id, item.url)}
                        className="text-sm text-left font-medium text-foreground hover:text-primary transition-colors flex items-start gap-1.5 group"
                      >
                        <span className="line-clamp-2">{item.title}</span>
                        <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-60 transition-opacity" />
                      </button>
                      {/* Mobile badges */}
                      <div className="flex gap-1 mt-1 sm:hidden">
                        <TaxBadge type={item.taxType} />
                        <DocBadge type={item.docType} />
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <TaxBadge type={item.taxType} />
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <DocBadge type={item.docType} />
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground hidden lg:table-cell">
                      {item.date}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Eye className="w-3.5 h-3.5" />
                        {item.viewCount.toLocaleString()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => {
                          if (confirm("정말 삭제하시겠습니까?")) {
                            deleteMutation.mutate({ id: item.id });
                          }
                        }}
                        disabled={deleteMutation.isPending}
                        className="inline-flex items-center justify-center p-1.5 rounded hover:bg-red-50 text-red-600 hover:text-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
