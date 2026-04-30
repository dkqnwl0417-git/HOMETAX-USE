import { useState, useMemo, useCallback, useEffect } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import {
  Eye, Search, RefreshCw, ChevronLeft, ChevronRight, Filter, Trash2, Plus, X, Loader2,
  Link as LinkIcon, Calendar as CalendarIcon, FileText, Pencil, Save,
  Upload, CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TAX_TYPES = ["전체", "부가가치세", "종합소득세", "법인세", "원천세", "기타"];
const DOC_TYPES = ["전체", "파일설명서", "전산매체 제출요령", "기타"];
const PAGE_SIZE = 20;

const MAX_FILE_SIZE = 50 * 1024 * 1024;

interface UploadedAttachment {
  name: string;
  url: string;
  fileType: string;
  mimeType?: string;
}

interface UploadApiResponse {
  success: boolean;
  fileUrl: string;
  fileType: string;
  originalName: string;
  mimeType?: string;
}

function uploadFileWithProgress(file: File): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");

    xhr.addEventListener("load", () => {
      try {
        const responseJson = JSON.parse(xhr.responseText || "{}");

        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(responseJson);
          return;
        }

        reject(new Error(responseJson.error || "업로드에 실패했습니다."));
      } catch {
        reject(new Error("업로드 응답 처리에 실패했습니다."));
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error("네트워크 오류로 업로드에 실패했습니다."));
    });

    xhr.send(formData);
  });
}

function TaxBadge({ type }: { type: string }) {
  const cls = {
    부가가치세: "bg-blue-50 text-blue-700 border-blue-100",
    종합소득세: "bg-emerald-50 text-emerald-700 border-emerald-100",
    법인세: "bg-purple-50 text-purple-700 border-purple-100",
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

// ─── 상세/수정 모달 ───────────────────────────────────────────────────────
function DetailModal({ item, onClose, onSaved }: { item: any; onClose: () => void; onSaved: () => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(item.title);
  const [editTaxType, setEditTaxType] = useState(item.taxType);
  const [editDocType, setEditDocType] = useState(item.docType);
  const [editDate, setEditDate] = useState(item.date);
  const [editContent, setEditContent] = useState(item.content || "");
  const [editAttachments, setEditAttachments] = useState(item.attachments || "");
  const [editUrl, setEditUrl] = useState(item.url || "");

  const updateMutation = trpc.hometax.update.useMutation({
    onSuccess: () => {
      toast.success("수정되었습니다.");
      setIsEditing(false);
      onSaved();
    },
    onError: (err) => toast.error("수정 실패: " + err.message),
  });

  const handleSave = () => {
    if (!editTitle.trim()) { toast.error("제목을 입력해주세요."); return; }
    updateMutation.mutate({
      id: item.id,
      title: editTitle.trim(),
      url: editUrl.trim(),
      taxType: editTaxType,
      docType: editDocType,
      date: editDate,
      content: editContent,
      attachments: editAttachments,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* 모달 헤더 */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-bold text-lg text-foreground flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            {isEditing ? "내용 수정" : "상세 내용"}
          </h2>
          <div className="flex items-center gap-2">
            {!isEditing ? (
              <Button size="sm" variant="outline" onClick={() => setIsEditing(true)} className="gap-2">
                <Pencil className="w-4 h-4" /> 수정
              </Button>
            ) : (
              <>
                <Button size="sm" variant="ghost" onClick={() => setIsEditing(false)}>취소</Button>
                <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending} className="gap-2">
                  {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  저장
                </Button>
              </>
            )}
            <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors">
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* 모달 내용 */}
        <div className="p-5 space-y-5">
          {/* 제목 */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">제목</label>
            {isEditing ? (
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="bg-background" />
            ) : (
              <p className="text-sm font-semibold text-foreground">{item.title}</p>
            )}
          </div>

          {/* 세금유형 / 문서유형 / 날짜 */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">세금 유형</label>
              {isEditing ? (
                <Select value={editTaxType} onValueChange={setEditTaxType}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TAX_TYPES.filter(t => t !== "전체").map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <TaxBadge type={item.taxType} />
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">문서 유형</label>
              {isEditing ? (
                <Select value={editDocType} onValueChange={setEditDocType}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DOC_TYPES.filter(t => t !== "전체").map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <DocBadge type={item.docType} />
              )}
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">공지 날짜</label>
              {isEditing ? (
                <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="h-9 text-sm bg-background" />
              ) : (
                <p className="text-sm text-foreground">{item.date}</p>
              )}
            </div>
          </div>

          {/* 내용 */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">내용</label>
            {isEditing ? (
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="홈택스 자료실의 본문 내용을 입력하세요"
                rows={6}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
            ) : (
              <div className="rounded-lg bg-muted/30 border border-border p-4 min-h-[100px]">
                {item.content ? (
                  <p className="text-sm text-foreground whitespace-pre-wrap">{item.content}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">등록된 내용이 없습니다. 수정 버튼을 눌러 내용을 입력하세요.</p>
                )}
              </div>
            )}
          </div>

                    {/* 첨부파일 */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">첨부파일</label>
            {isEditing ? (
              <textarea
                value={editAttachments}
                onChange={(e) => setEditAttachments(e.target.value)}
                placeholder={"첨부파일 정보를 입력하세요\n예시:\n20260323_부가가치세_파일설명서.doc\n20260323_부가가치세_파일설명서.pdf"}
                rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
            ) : (
              <div className="rounded-lg bg-muted/30 border border-border p-4 min-h-[60px]">
                {item.attachments ? (() => {
                  try {
                    const parsed = JSON.parse(item.attachments);

                    if (Array.isArray(parsed)) {
                      return (
                        <ul className="space-y-1">
                          {parsed.map((file: any, i: number) => (
                            <li key={i} className="text-sm text-foreground flex items-center gap-2">
                              <FileText className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                              <a
                                href={file.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary hover:underline break-all"
                              >
                                {file.name}
                              </a>
                            </li>
                          ))}
                        </ul>
                      );
                    }
                  } catch {
                    // 기존 텍스트 첨부파일 처리
                  }

                  return (
                    <ul className="space-y-1">
                      {item.attachments.split("\n").filter(Boolean).map((f: string, i: number) => (
                        <li key={i} className="text-sm text-foreground flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                          {f.trim()}
                        </li>
                      ))}
                    </ul>
                  );
                })() : (
                  <p className="text-sm text-muted-foreground italic">등록된 첨부파일이 없습니다. 수정 버튼을 눌러 입력하세요.</p>
                )}
              </div>
            )}
          </div>

          {/* 원본 URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">원본 URL</label>

            {isEditing ? (
              <Input
                value={editUrl}
                onChange={(e) => setEditUrl(e.target.value)}
                placeholder="https://..."
                className="bg-background"
              />
            ) : (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary hover:underline break-all"
              >
                {item.url}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 수기 등록 모달 ───────────────────────────────────────────────────────
function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newTaxType, setNewTaxType] = useState("부가가치세");
  const [newDocType, setNewDocType] = useState("파일설명서");
  const [newDate, setNewDate] = useState(new Date().toISOString().split("T")[0]);
  const [newContent, setNewContent] = useState("");
  const [newAttachments, setNewAttachments] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState<UploadedAttachment[]>([]);
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  const createMutation = trpc.hometax.create.useMutation({
    onSuccess: () => {
      toast.success("성공적으로 등록되었습니다.");
      onCreated();
      onClose();
    },
    onError: (err) => toast.error("등록 실패: " + err.message),
  });
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0 || isUploadingFile) return;

    setIsUploadingFile(true);

    try {
      const uploaded: UploadedAttachment[] = [];

      for (const file of acceptedFiles) {
        const result = await uploadFileWithProgress(file);

        uploaded.push({
          name: result.originalName,
          url: result.fileUrl,
          fileType: result.fileType,
          mimeType: result.mimeType,
        });
      }

      setUploadedFiles((prev) => [...prev, ...uploaded]);
      toast.success(`${uploaded.length}개 파일이 업로드되었습니다.`);
    } catch (err: any) {
      toast.error(err?.message || "파일 업로드에 실패했습니다.");
    } finally {
      setIsUploadingFile(false);
    }
  }, [isUploadingFile]);

  const onDropRejected = useCallback((fileRejections: FileRejection[]) => {
    if (fileRejections.length === 0) return;

    toast.error("업로드할 수 없는 파일입니다. 파일 용량 또는 확장자를 확인해주세요.");
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    disabled: isUploadingFile,
    multiple: true,
    maxSize: MAX_FILE_SIZE,
  });
  
  const handleSubmit = () => {
    if (!newUrl.trim()) { toast.error("URL을 입력해주세요."); return; }
    if (!newDate) { toast.error("공지 날짜를 선택해주세요."); return; }
    createMutation.mutate({
  title: newTitle.trim() || undefined,
  url: newUrl.trim(),
  taxType: newTaxType,
  docType: newDocType,
  date: newDate,
  content: newContent,
  attachments: uploadedFiles.length > 0
    ? JSON.stringify(uploadedFiles)
    : newAttachments,
});
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-bold text-lg text-foreground flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />
            새 설명서 수기 등록
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* 폼 */}
        <div className="p-5 space-y-5">
          {/* URL */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground">URL <span className="text-red-500">*</span></label>
            <div className="relative">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="홈택스 공지사항 URL (https://...)"
                className="pl-10 bg-background"
              />
            </div>
          </div>

          {/* 날짜 / 세금유형 / 문서유형 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-foreground">공지 날짜 <span className="text-red-500">*</span></label>
              <div className="relative">
                <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="pl-10 bg-background" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-foreground">세금 유형</label>
              <Select value={newTaxType} onValueChange={setNewTaxType}>
                <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TAX_TYPES.filter(t => t !== "전체").map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-foreground">문서 유형</label>
              <Select value={newDocType} onValueChange={setNewDocType}>
                <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.filter(t => t !== "전체").map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 제목 */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground">
              제목 <span className="text-xs font-normal text-muted-foreground ml-1">(미입력 시 자동 생성)</span>
            </label>
            <Input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="미입력 시 [전자신고]유형(날짜 공지) 형식으로 자동 생성됩니다"
              className="bg-background"
            />
            <p className="text-xs text-muted-foreground">
              자동 생성 예시: [전자신고]{newTaxType} {newDocType}({newDate ? new Date(newDate).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" }) : "날짜"} 공지)
            </p>
          </div>

          {/* 내용 */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground">내용</label>
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="홈택스 자료실의 본문 내용을 입력하세요"
              rows={5}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

                    {/* 첨부파일 */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-foreground">첨부파일</label>

            <div
              {...getRootProps()}
              className={cn(
                "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
                isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50",
                isUploadingFile && "opacity-70 pointer-events-none"
              )}
            >
              <input {...getInputProps()} />

              {isUploadingFile ? (
                <div className="flex flex-col items-center gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <p className="text-sm font-medium">파일 업로드 중입니다...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-8 h-8 text-primary" />
                  <p className="text-sm font-medium">파일을 드래그하거나 클릭해서 업로드하세요</p>
                  <p className="text-xs text-muted-foreground">
                    내부 메뉴얼 자료실과 동일한 업로드 방식 · 최대 50MB
                  </p>
                </div>
              )}
            </div>

            {uploadedFiles.length > 0 && (
              <div className="space-y-2 rounded-lg border bg-muted/20 p-3">
                {uploadedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between gap-2 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                      <span className="truncate">{file.name}</span>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
                      }}
                    >
                      삭제
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="flex justify-end gap-3 p-5 border-t border-border">
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending || isUploadingFile} className="min-w-[100px]">
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "등록하기"}
          </Button>
        </div>
      </div>
    </div>
  );
}
// ─── 메인 페이지 ──────────────────────────────────────────────────────────
export default function HometaxNotices() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [taxType, setTaxType] = useState("전체");
  const [docType, setDocType] = useState("전체");
  const [page, setPage] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);

  useEffect(() => {
    const stored = sessionStorage.getItem("pendingNoticeData");
    if (!stored) return;

    try {
      const notice = JSON.parse(stored);
      setSelectedItem(notice);
      sessionStorage.removeItem("pendingNoticeData");
    } catch (e) {
      console.error("알림 데이터 파싱 실패", e);
      toast.error("알림에 연결된 공지를 불러오지 못했습니다.");
    }
  }, []);
  
  
  

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
    onSuccess: () => { toast.success("삭제되었습니다."); refetch(); },
    onError: (err) => toast.error("삭제 실패: " + err.message),
  });

  const deleteAllMutation = trpc.hometax.deleteAll.useMutation({
    onSuccess: (result) => { toast.success(`${result.deleted}건 삭제되었습니다.`); refetch(); },
    onError: (err) => toast.error("삭제 실패: " + err.message),
  });

  const crawlMutation = trpc.hometax.crawl.useMutation({
    onSuccess: (result) => { toast.success(`수집 완료: 신규 ${result.inserted}건 등록`); refetch(); },
    onError: (err) => toast.error("수집 실패: " + err.message),
  });

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  const handleTitleClick = (item: any) => {
    incrementView.mutate({ id: item.id });
    setSelectedItem(item);
  };

  const handleFilterReset = () => {
    setStartDate(""); setEndDate(""); setTaxType("전체"); setDocType("전체"); setPage(1);
  };

  return (
    <div className="container py-10 max-w-6xl mx-auto px-4">
      {/* 모달 */}
      {showCreateModal && (
        <CreateModal onClose={() => setShowCreateModal(false)} onCreated={refetch} />
      )}
      {selectedItem && (
        <DetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onSaved={() => { refetch(); setSelectedItem(null); }}
        />
      )}

      {/* 헤더 */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-primary tracking-widest uppercase mb-1">Hometax</p>
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">전자신고 설명서</h1>
          <p className="text-sm font-light text-muted-foreground mt-1">홈택스 공지사항 자동 수집 및 수기 등록 관리</p>
        </div>
        <div className="flex flex-wrap gap-2 self-start sm:self-auto">
          <Button size="sm" variant="default" className="gap-2 shadow-sm" onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4" /> 수기 등록
          </Button>
          <Button
            size="sm" variant="outline" className="gap-2 bg-card shadow-sm"
            onClick={() => crawlMutation.mutate()} disabled={crawlMutation.isPending}
          >
            <RefreshCw className={cn("w-4 h-4", crawlMutation.isPending && "animate-spin")} />
            {crawlMutation.isPending ? "수집 중..." : "지금 수집"}
          </Button>
          <Button
            size="sm" variant="ghost" className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => { if (confirm("모든 데이터를 삭제하시겠습니까?")) deleteAllMutation.mutate(); }}
            disabled={deleteAllMutation.isPending}
          >
            <Trash2 className="w-4 h-4" /> 전체 삭제
          </Button>
        </div>
      </div>

      {/* 필터 */}
      <div className="bg-card border border-border rounded-xl p-5 mb-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-primary" />
          <span className="text-sm font-bold text-foreground">상세 필터</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">시작일</label>
            <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} className="h-9 text-sm bg-background border-muted-foreground/20" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">종료일</label>
            <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} className="h-9 text-sm bg-background border-muted-foreground/20" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">세금 유형</label>
            <Select value={taxType} onValueChange={(v) => { setTaxType(v); setPage(1); }}>
              <SelectTrigger className="h-9 text-sm bg-background border-muted-foreground/20"><SelectValue /></SelectTrigger>
              <SelectContent>{TAX_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">문서 유형</label>
            <Select value={docType} onValueChange={(v) => { setDocType(v); setPage(1); }}>
              <SelectTrigger className="h-9 text-sm bg-background border-muted-foreground/20"><SelectValue /></SelectTrigger>
              <SelectContent>{DOC_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button variant="ghost" size="sm" onClick={handleFilterReset} className="text-xs text-muted-foreground hover:text-primary">필터 초기화</Button>
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/10">
          <span className="text-sm text-muted-foreground">전체 <strong className="text-foreground">{data?.total ?? 0}</strong>건</span>
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
            <p className="text-sm text-muted-foreground mt-1">필터를 변경하거나 수기 등록 버튼을 눌러보세요.</p>
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
                        onClick={() => handleTitleClick(item)}
                        className="text-sm text-left font-semibold text-foreground hover:text-primary transition-colors"
                      >
                        <span className="line-clamp-2">{item.title}</span>
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
                        <Eye className="w-3 h-3" />{item.viewCount.toLocaleString()}
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

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="w-9 h-9 rounded-full">
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
                  className={cn("w-9 h-9 text-sm rounded-full transition-all font-medium", page === pageNum ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:bg-muted")}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
          <Button variant="outline" size="icon" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="w-9 h-9 rounded-full">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
