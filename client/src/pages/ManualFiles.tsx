import { useState, useMemo, useRef } from "react";
import { 
  Search, 
  Upload, 
  FileText, 
  Download, 
  ExternalLink, 
  X, 
  ChevronLeft, 
  ChevronRight,
  File as FileIcon,
  Loader2,
  Plus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 15;

const FileTypeBadge = ({ type }: { type: string }) => {
  const colors: Record<string, string> = {
    pdf: "bg-red-100 text-red-700 border-red-200",
    doc: "bg-blue-100 text-blue-700 border-blue-200",
    docx: "bg-blue-100 text-blue-700 border-blue-200",
    xls: "bg-green-100 text-green-700 border-green-200",
    xlsx: "bg-green-100 text-green-700 border-green-200",
    hwp: "bg-purple-100 text-purple-700 border-purple-200",
  };

  return (
    <Badge 
      variant="outline" 
      className={cn("text-[10px] px-1.5 py-0 font-bold uppercase", colors[type.toLowerCase()] || "bg-gray-100 text-gray-700 border-gray-200")}
    >
      {type}
    </Badge>
  );
};

export default function ManualFiles() {
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
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
    <div className="container py-10 max-w-6xl mx-auto px-4">
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
          className="gap-2 self-start sm:self-auto shadow-sm"
          onClick={() => setShowUploadForm((v) => !v)}
        >
          {showUploadForm ? <X className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
          {showUploadForm ? "닫기" : "파일 업로드"}
        </Button>
      </div>

      {/* Upload Form */}
      {showUploadForm && (
        <div className="bg-card border border-border rounded-xl p-6 mb-8 shadow-md animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-bold text-lg text-foreground flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              새 파일 등록
            </h2>
          </div>
          <form onSubmit={handleUploadSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">
                  제목 <span className="text-xs font-normal text-muted-foreground ml-1">(미입력 시 파일명 사용)</span>
                </label>
                <Input
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="문서 제목을 입력하세요"
                  className="bg-background border-muted-foreground/20 focus:border-primary"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">
                  등록자 <span className="text-red-500">*</span>
                </label>
                <Input
                  value={uploadUploader}
                  onChange={(e) => setUploadUploader(e.target.value)}
                  placeholder="이름을 입력하세요"
                  required
                  className="bg-background border-muted-foreground/20 focus:border-primary"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-foreground">
                파일 첨부 <span className="text-red-500">*</span>
              </label>
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "relative border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center transition-all cursor-pointer group",
                  isDragging 
                    ? "border-primary bg-primary/5 scale-[1.01]" 
                    : "border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/30",
                  selectedFile && "border-primary/30 bg-primary/5"
                )}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.hwp"
                />
                
                {selectedFile ? (
                  <div className="flex flex-col items-center animate-in zoom-in-95 duration-200">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-3">
                      <FileText className="w-8 h-8 text-primary" />
                    </div>
                    <p className="text-sm font-bold text-foreground text-center max-w-xs truncate">
                      {selectedFile.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm" 
                      className="mt-4 text-xs text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                      }}
                    >
                      파일 변경하기
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4 group-hover:bg-primary/10 transition-colors">
                      <Upload className="w-8 h-8 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      클릭하거나 파일을 여기로 드래그하세요
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      PDF, Word, Excel, HWP (최대 50MB)
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowUploadForm(false)}
                disabled={uploading}
              >
                취소
              </Button>
              <Button type="submit" disabled={uploading || !selectedFile} className="min-w-[100px]">
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    업로드 중...
                  </>
                ) : (
                  "등록하기"
                )}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Search & Stats */}
      <div className="bg-card border border-border rounded-xl p-4 mb-6 flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="파일명 또는 제목으로 검색..."
            className="pl-10 bg-background border-muted-foreground/20"
          />
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>전체 <span className="font-bold text-foreground">{data?.total || 0}</span>건</span>
          <div className="w-px h-4 bg-border" />
          <span>페이지 <span className="font-bold text-foreground">{page}</span> / {totalPages}</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
            <p className="text-sm text-muted-foreground">자료를 불러오는 중입니다...</p>
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <FileIcon className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-bold text-foreground">등록된 자료가 없습니다</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {keyword ? "검색 결과가 없습니다. 다른 키워드로 검색해 보세요." : "첫 번째 자료를 업로드해 보세요."}
            </p>
            {keyword && (
              <Button variant="link" onClick={() => {setSearchInput(""); setKeyword("");}} className="mt-2">
                검색 초기화
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-muted/30 border-b border-border">
                  <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider w-16">
                    번호
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    제목
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider w-24 hidden sm:table-cell">
                    형식
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider w-24 hidden md:table-cell">
                    등록자
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase tracking-wider w-28 hidden lg:table-cell">
                    등록일
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-muted-foreground uppercase tracking-wider w-20">
                    관리
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item, idx) => (
                  <tr
                    key={item.id}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors group"
                  >
                    <td className="px-4 py-4 text-xs text-muted-foreground">
                      {(page - 1) * PAGE_SIZE + idx + 1}
                    </td>
                    <td className="px-4 py-4">
                      <a
                        href={item.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm font-semibold text-foreground hover:text-primary transition-colors flex items-start gap-2 group/link"
                      >
                        <span className="line-clamp-1">{item.title}</span>
                        <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 opacity-0 group-hover/link:opacity-100 transition-opacity" />
                      </a>
                      {/* Mobile info */}
                      <div className="flex items-center gap-2 mt-1.5 sm:hidden">
                        <FileTypeBadge type={item.fileType} />
                        <span className="text-[11px] text-muted-foreground">{item.uploader}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 hidden sm:table-cell">
                      <FileTypeBadge type={item.fileType} />
                    </td>
                    <td className="px-4 py-4 text-sm text-muted-foreground hidden md:table-cell">
                      {item.uploader}
                    </td>
                    <td className="px-4 py-4 text-sm text-muted-foreground hidden lg:table-cell">
                      {new Date(item.createdAt).toLocaleDateString("ko-KR")}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <a
                        href={item.fileUrl}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center w-8 h-8 rounded-full hover:bg-primary/10 hover:text-primary transition-all"
                        title="다운로드"
                      >
                        <Download className="w-4 h-4" />
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
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (page <= 3) {
                pageNum = i + 1;
              } else if (page >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = page - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={cn(
                    "w-9 h-9 text-sm rounded-full transition-all font-medium",
                    page === pageNum
                      ? "bg-primary text-primary-foreground shadow-md"
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
