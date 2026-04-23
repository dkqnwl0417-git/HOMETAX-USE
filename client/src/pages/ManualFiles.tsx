import { useState, useRef, useMemo } from "react";
import {
  Upload,
  Search,
  Download,
  ExternalLink,
  FileText,
  File,
  ChevronLeft,
  ChevronRight,
  X,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;

const FILE_TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pdf: { label: "PDF", color: "text-red-700", bg: "bg-red-50" },
  doc: { label: "DOC", color: "text-blue-700", bg: "bg-blue-50" },
  docx: { label: "DOCX", color: "text-blue-700", bg: "bg-blue-50" },
  xls: { label: "XLS", color: "text-emerald-700", bg: "bg-emerald-50" },
  xlsx: { label: "XLSX", color: "text-emerald-700", bg: "bg-emerald-50" },
  hwp: { label: "HWP", color: "text-violet-700", bg: "bg-violet-50" },
};

function FileTypeBadge({ type }: { type: string }) {
  const cfg = FILE_TYPE_CONFIG[type.toLowerCase()] ?? {
    label: type.toUpperCase(),
    color: "text-gray-600",
    bg: "bg-gray-100",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-xs font-bold tracking-wide",
        cfg.color,
        cfg.bg
      )}
    >
      {cfg.label}
    </span>
  );
}

export default function ManualFiles() {
  const [keyword, setKeyword] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);

  // Upload form state
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadUploader, setUploadUploader] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const queryInput = useMemo(
    () => ({ keyword: keyword || undefined, page, pageSize: PAGE_SIZE }),
    [keyword, page]
  );

  const { data, isLoading, refetch } = trpc.manual.list.useQuery(queryInput);
  const uploadMutation = trpc.manual.upload.useMutation({
    onSuccess: () => {
      toast.success("파일이 성공적으로 등록되었습니다.");
      setShowUploadForm(false);
      setUploadTitle("");
      setUploadUploader("");
      setSelectedFile(null);
      refetch();
    },
    onError: (err) => toast.error("등록 실패: " + err.message),
  });

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  const handleSearch = () => {
    setKeyword(searchInput);
    setPage(1);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error("파일을 선택해주세요.");
      return;
    }
    if (!uploadUploader.trim()) {
      toast.error("등록자 이름을 입력해주세요.");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const result = await res.json();

      if (!res.ok || !result.success) {
        throw new Error(result.error || "업로드 실패");
      }

      await uploadMutation.mutateAsync({
        title: uploadTitle.trim() || undefined,
        fileUrl: result.fileUrl,
        fileType: result.fileType,
        originalName: result.originalName,
        uploader: uploadUploader.trim(),
      });
    } catch (err: any) {
      toast.error(err.message || "업로드 중 오류가 발생했습니다.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="container py-10">
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-primary tracking-widest uppercase mb-1">
            Internal Library
          </p>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">
            내부 메뉴얼 자료실
          </h1>
          <p className="text-sm font-light text-muted-foreground mt-1">
            PDF, Word, Excel, 한글 파일을 업로드하고 팀과 공유하세요.
          </p>
        </div>
        <Button
          size="sm"
          className="gap-2 self-start sm:self-auto"
          onClick={() => setShowUploadForm((v) => !v)}
        >
          <Upload className="w-4 h-4" />
          파일 업로드
        </Button>
      </div>

      {/* Upload Form */}
      {showUploadForm && (
        <div className="bg-card border border-border rounded-xl p-5 mb-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-base text-foreground">파일 업로드</h2>
            <button
              onClick={() => setShowUploadForm(false)}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-muted transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          <form onSubmit={handleUploadSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">
                  제목 <span className="text-xs text-muted-foreground">(선택 — 미입력 시 파일명 사용)</span>
                </label>
                <Input
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="문서 제목을 입력하세요"
                  className="bg-background"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-foreground">
                  등록자 <span className="text-red-500">*</span>
                </label>
                <Input
                  value={uploadUploader}
                  onChange={(e) => setUploadUploader(e.target.value)}
                  placeholder="이름을 입력하세요"
                  required
                  className="bg-background"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">
                파일 <span className="text-red-500">*</span>
              </label>
              <div
                className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {selectedFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    <span className="text-sm font-medium text-foreground">{selectedFile.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                  </div>
                ) : (
                  <div>
                    <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">
                      클릭하여 파일을 선택하세요
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      PDF, Word (.doc/.docx), Excel (.xls/.xlsx), 한글 (.hwp) — 최대 50MB
                    </p>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.hwp"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowUploadForm(false)}
                className="bg-card"
              >
                취소
              </Button>
              <Button type="submit" disabled={uploading || !selectedFile} className="gap-2">
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    업로드 중...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    등록
                  </>
                )}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Search */}
      <div className="flex gap-2 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="제목으로 검색..."
            className="pl-9 bg-card"
          />
        </div>
        <Button onClick={handleSearch} variant="outline" className="bg-card gap-2">
          <Search className="w-4 h-4" />
          검색
        </Button>
        {keyword && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setKeyword(""); setSearchInput(""); setPage(1); }}
            className="text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* File List */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            총 <strong className="text-foreground">{data?.total ?? 0}</strong>건
            {keyword && (
              <span className="ml-1">
                — "<strong className="text-foreground">{keyword}</strong>" 검색 결과
              </span>
            )}
          </span>
          <span className="text-xs text-muted-foreground">최신 등록순</span>
        </div>

        {isLoading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-primary/50" />
            불러오는 중...
          </div>
        ) : !data?.items.length ? (
          <div className="py-16 text-center">
            <File className="w-8 h-8 mx-auto mb-3 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {keyword ? "검색 결과가 없습니다." : "등록된 파일이 없습니다."}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              파일 업로드 버튼을 눌러 첫 번째 자료를 등록해보세요.
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
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-20 hidden sm:table-cell">
                    형식
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-24 hidden md:table-cell">
                    등록자
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-28 hidden lg:table-cell">
                    등록일
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider w-20">
                    다운로드
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
                      <a
                        href={item.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-medium text-foreground hover:text-primary transition-colors flex items-start gap-1.5 group"
                      >
                        <span className="line-clamp-2">{item.title}</span>
                        <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-60 transition-opacity" />
                      </a>
                      {/* Mobile info */}
                      <div className="flex gap-1.5 mt-1 sm:hidden">
                        <FileTypeBadge type={item.fileType} />
                        <span className="text-xs text-muted-foreground">{item.uploader}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <FileTypeBadge type={item.fileType} />
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground hidden md:table-cell">
                      {item.uploader}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground hidden lg:table-cell">
                      {new Date(item.createdAt).toLocaleDateString("ko-KR")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <a
                        href={item.fileUrl}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center w-7 h-7 rounded hover:bg-muted transition-colors"
                        title="다운로드"
                      >
                        <Download className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                      </a>
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
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="bg-card"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 7) {
                pageNum = i + 1;
              } else if (page <= 4) {
                pageNum = i + 1;
              } else if (page >= totalPages - 3) {
                pageNum = totalPages - 6 + i;
              } else {
                pageNum = page - 3 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={cn(
                    "w-8 h-8 text-sm rounded-md transition-colors",
                    page === pageNum
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="bg-card"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
