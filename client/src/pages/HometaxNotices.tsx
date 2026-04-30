import { useState, useMemo } from "react";
import {
  Eye, Search, RefreshCw, ChevronLeft, ChevronRight, Filter, Trash2, Plus, X, Loader2,
  Link as LinkIcon, Calendar as CalendarIcon, FileText, Pencil, Save
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
                {item.attachments ? (
                  <ul className="space-y-1">
                    {item.attachments.split("\n").filter(Boolean).map((f: string, i: number) => (
                      <li key={i} className="text-sm text-foreground flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                        {f.trim()}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground italic">등록된 첨부파일이 없습니다. 수정 버튼을 눌러 입력하세요.</p>
                )}
              </div>
            )}
          </div>

          {/* 원본 URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">원본 URL</label>
            
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary hover:underline break-all"
            >
              {item.url}
            </a>
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

  const createMutation = trpc.hometax.create.useMutation({
    onSuccess: () => {
      toast.success("성공적으로 등록되었습니다.");
      onCreated();
      onClose();
    },
    onError: (err) => toast.error("등록 실패: " + err.message),
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
      attachments: newAttachments,
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
            <textarea
              value={newAttachments}
              onChange={(e) => setNewAttachments(e.target.value)}
              placeholder={"첨부파일명을 줄바꿈으로 구분하여 입력하세요\n예시:\n20260323_부가가치세_파일설명서.doc"}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="flex justify-end gap-3 p-5 border-t border-border">
          <Button variant="outline" onClick={onClose}>취소</Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending} className="min-w-[100px]">
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
  const [showCreateModal, setShowCreateModal] = useState(false
