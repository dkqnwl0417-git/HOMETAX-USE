import { useState, useMemo } from "react";
import { 
  ExternalLink, 
  Eye, 
  Search, 
  RefreshCw, 
  ChevronLeft, 
  ChevronRight, 
  Filter, 
  Trash2, 
  Plus, 
  X, 
  Loader2,
  Link as LinkIcon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TAX_TYPES = ["전체", "부가가치세", "종합소득세", "원천세", "기타"];
const DOC_TYPES = ["전체", "파일설명서", "전산매체 제출요령", "기타"];
const PAGE_SIZE = 20;

function TaxBadge({ type }: { type: string }) {
  const cls = {
    부가가치세: "bg-blue-50 text-blue-700 border-blue-100",
    종합소득세: "bg-emerald-50 text-emerald-700 border-emerald-100",
    원천세: "bg-amber-50 text-amber-700 border-amber-100",
    기타: "bg-gray-100 text-gray-600 border-gray-200",
  }[type] ?? "bg-gray-100 text-gray-600 border-gray-200";
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border", cls)}>
      {type}
    </span>
  );
}

function DocBadge({ type }: { type: string }) {
  const cls = {
    "파일설명서": "bg-pink-50 text-pink-700 border-pink-100",
    "전산매체 제출요령": "bg-violet-50 text-violet-700 border-violet-100",
    "기타": "bg-gray-100 text-gray-600 border-gray-200",
  }[type] ?? "bg-gray-100 text-gray-600 border-gray-200";
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold border", cls)}>
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
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Create form state
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newTaxType, setNewTaxType] = useState("기타");
  const [newDocType, setNewDocType] = useState("기타");

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
  
  const createMutation = trpc.hometax.create.useMutation({
    onSuccess: () => {
      toast.success("성공적으로 등록되었습니다.");
      setShowCreateForm(false);
      setNewTitle("");
      setNewUrl("");
      refetch();
    },
    onError: (err) => toast.error("등록 실패: " + err.message),
  });

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
    if (url && url.startsWith("http")) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      toast.error("유효하지 않은 링크입니다.");
    }
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newUrl.trim()) {
      toast.error("제목과 URL을 모두 입력해주세요.");
      return;
    }
    createMutation.mutate({
      title: newTitle.trim(),
      url: newUrl.trim(),
      taxType: newTaxType,
      docType: newDocType,
    });
  };

  const handleFilterReset = () => {
    setStartDate("");
    setEndDate("");
    setTaxType("전체");
    setDocType("전체");
    setPage(1);
  };

  return (
    <div className="container py-10 max-w-6xl mx-auto px-4">
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
            홈택스 공지사항 자동 수집 및 수기 등록 관리
          </p>
        </div>
        <div className="flex flex-wrap gap-2 self-start sm:self-auto">
          <Button
            size="sm"
            variant="default"
            className="gap-2 shadow-sm"
            onClick={() => setShowCreateForm(!showCreateForm)}
          >
            {showCreateForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showCreateForm ? "닫기" : "수기 등록"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="gap-2 bg-card shadow-sm"
            onClick={() => crawlMutation.mutate()}
            disabled={crawlMutation.isPending}
          >
            <RefreshCw className={cn("w-4 h-4", crawlMutation.isPending && "animate-spin")} />
            {crawlMutation.isPending ? "수집 중..." : "지금 수집"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => {
              if (confirm("모든 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.")) {
                deleteAllMutation.mutate();
              }
            }}
            disabled={deleteAllMutation.isPending}
          >
            <Trash2 className="w-4 h-4" />
            전체 삭제
          </Button>
        </div>
      </div>

      {/* Create Form */}
      {showCreateForm && (
        <div className="bg-card border border-border rounded-xl p-6 mb-8 shadow-md animate-in fade-in slide-in-from-top-4 duration-300">
          <h2 className="font-bold text-lg text-foreground mb-6 flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />
            새 설명서 수기 등록
          </h2>
          <form onSubmit={handleCreateSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">제목 <span className="text-red-500">*</span></label>
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="설명서 제목을 입력하세요"
                  required
                  className="bg-background border-muted-foreground/20 focus:border-primary"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">URL <span className="text-red-500">*</span></label>
                <div className="relative">
                  <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder="https://..."
                    required
                    className="pl-10 bg-background border-muted-foreground/20 focus:border-primary"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">세금 유형</label>
                <Select value={newTaxType} onValueChange={setNewTaxType}>
                  <SelectTrigger className="bg-background border-muted-foreground/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TAX_TYPES.filter(t => t !== "전체").map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">문서 유형</label>
                <Select value={newDocType} onValueChange={setNewDocType}>
                  <SelectTrigger className="bg-background border-muted-foreground/20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOC_TYPES.filter(t => t !== "전체").map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowCreateForm(false)}>취소</Button>
              <Button type="submit" disabled={createMutation.isPending} className="min-w-[100px]">
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "등록하기"}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="bg-card border border-border rounded-xl p-5 mb-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold text-foreground">상세 필터</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">시작일</label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
              className="h-9 text-sm bg-background border-muted-foreground/20"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">종료일</label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
              className="h-9 text-sm bg-background border-muted-foreground/20"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">세금 유형</label>
            <Select value={taxType} onValueChange={(v) => { setTaxType(v); setPage(1); }}>
              <SelectTrigger className="h-9 text-sm bg-background border-muted-foreground/20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TAX_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">문서 유형</label>
            <Select value={docType} onValueChange={(v) => { setDocType(v); setPage(1); }}>
              <SelectTrigger className="h-9 text-sm bg-background border-muted-foreground/20">
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
        <div className="mt-4 flex justify-end">
          <Button variant="ghost" size="sm" onClick={handleFilterReset} className="text-xs text-muted-foreground hover:text-primary">
            필터 초기화
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/10">
          <span className="text-sm text-muted-foreground">
            전체 <strong className="text-foreground">{data?.total ?? 0}</strong>건
          </span>
          <span className="text-xs text-muted-foreground font-medium">최신순 정렬</span>
        </div>

        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
            <p className="text-sm text-muted-foreground">데이터를 불러오는 중입니다...</p>
          </div>
        ) : !data?.items.length ? (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-bold text-foreground">데이터가 없습니다</h3>
            <p className="text-sm text-muted-foreground mt-1">필터를 변경하거나 수집 버튼을 눌러보세요.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted/30 border-b border-border">
                  <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider w-16">No</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">제목</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider w-28 hidden sm:table-cell">세금 유형</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider w-36 hidden md:table-cell">문서 유형</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider w-28 hidden lg:table-cell">등록일</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-muted-foreground uppercase tracking-wider w-20">조회수</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider w-16">관리</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item, idx) => (
                  <tr key={item.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors group">
                    <td className="px-4 py-4 text-xs text-muted-foreground">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                    <td className="px-4 py-4">
                      <button
                        onClick={() => handleTitleClick(item.id, item.url)}
                        className="text-sm text-left font-semibold text-foreground hover:text-primary transition-colors flex items-start gap-2 group/link"
                      >
                        <span className="line-clamp-2">{item.title}</span>
                        <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                      </button>
                      <div className="flex items-center gap-2 mt-1.5 sm:hidden">
                        <TaxBadge type={item.taxType} />
                        <DocBadge type={item.docType} />
                      </div>
                    </td>
                    <td className="px-4 py-4 hidden sm:table-cell"><TaxBadge type={item.taxType} /></td>
                    <td className="px-4 py-4 hidden md:table-cell"><DocBadge type={item.docType} /></td>
                    <td className="px-4 py-4 text-sm text-muted-foreground hidden lg:table-cell">{item.date}</td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                        <Eye className="w-3 h-3" />
                        {item.viewCount.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <button
                        onClick={() => { if (confirm("삭제하시겠습니까?")) deleteMutation.mutate({ id: item.id }); }}
                        className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-all opacity-0 group-hover:opacity-100"
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
        <div className="mt-8 flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="w-9 h-9 rounded-full"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) pageNum = i + 1;
              else if (page <= 3) pageNum = i + 1;
              else if (page >= totalPages - 2) pageNum = totalPages - 4 + i;
              else pageNum = page - 2 + i;
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={cn(
                    "w-9 h-9 text-sm rounded-full transition-all font-medium",
                    page === pageNum ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="w-9 h-9 rounded-full"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
