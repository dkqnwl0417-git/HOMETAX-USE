import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Search,
  Upload,
  FileText,
  Download,
  Trash2,
  FileIcon,
  Loader2,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

type UploadState = {
  name: string;
  status: "pending" | "success" | "error";
};

export default function ManualFiles() {
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [isUploading, setIsUploading] = useState(false);
  const [uploaderName, setUploaderName] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<UploadState[]>([]);
  const { toast } = useToast();

  const utils = trpc.useContext();
  const { data, isLoading } = trpc.manual.list.useQuery({
    keyword,
    page,
    pageSize: 10,
  });

  const uploadMutation = trpc.manual.upload.useMutation({
    onSuccess: () => {
      utils.manual.list.invalidate();
    },
    onError: (err) => {
      console.error("DB 저장 실패:", err);
    },
  });

  const deleteMutation = trpc.manual.delete.useMutation({
    onSuccess: () => {
      toast({ title: "삭제 성공", description: "파일이 삭제되었습니다." });
      utils.manual.list.invalidate();
    },
    onError: (err) => {
      toast({ title: "삭제 실패", description: err.message, variant: "destructive" });
    },
  });

  const queueFiles = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      setSelectedFiles((prev) => {
        const existingKeys = new Set(prev.map((file) => `${file.name}-${file.size}-${file.lastModified}`));
        const nextFiles = acceptedFiles.filter(
          (file) => !existingKeys.has(`${file.name}-${file.size}-${file.lastModified}`),
        );

        if (nextFiles.length !== acceptedFiles.length) {
          toast({
            title: "중복 파일 제외",
            description: "이미 선택된 파일은 목록에 다시 추가하지 않았습니다.",
          });
        }

        return [...prev, ...nextFiles];
      });
    },
    [toast],
  );

  const handleBatchUpload = useCallback(async () => {
    if (!uploaderName.trim()) {
      toast({ title: "알림", description: "등록자 이름을 먼저 입력해주세요.", variant: "destructive" });
      return;
    }

    if (selectedFiles.length === 0) {
      toast({ title: "알림", description: "업로드할 파일을 먼저 선택해주세요.", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus(selectedFiles.map((file) => ({ name: file.name, status: "pending" as const })));

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "업로드 실패");
        }

        const result = await response.json();

        await uploadMutation.mutateAsync({
          title: file.name.replace(/\.[^/.]+$/, ""),
          fileUrl: result.fileUrl,
          fileType: result.fileType,
          originalName: result.originalName,
          mimeType: result.mimeType,
          uploader: uploaderName.trim(),
        });

        setUploadStatus((prev) =>
          prev.map((item, idx) => (idx === i ? { ...item, status: "success" } : item)),
        );
        successCount++;
      } catch (err: any) {
        console.error(`파일 업로드 실패 (${file.name}):`, err);
        setUploadStatus((prev) =>
          prev.map((item, idx) => (idx === i ? { ...item, status: "error" } : item)),
        );
        failCount++;
      }

      setUploadProgress(Math.round(((i + 1) / selectedFiles.length) * 100));
    }

    setIsUploading(false);
    if (failCount === 0) {
      setSelectedFiles([]);
    }

    toast({
      title: "업로드 완료",
      description: `성공: ${successCount}건, 실패: ${failCount}건`,
      variant: failCount > 0 ? "destructive" : "default",
    });
  }, [selectedFiles, uploaderName, uploadMutation, toast]);

  const removeSelectedFile = useCallback((targetIndex: number) => {
    setSelectedFiles((prev) => prev.filter((_, index) => index !== targetIndex));
  }, []);

  const clearSelectedFiles = useCallback(() => {
    if (isUploading) return;
    setSelectedFiles([]);
    setUploadStatus([]);
    setUploadProgress(0);
  }, [isUploading]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: queueFiles,
    multiple: true,
    disabled: isUploading,
    accept: {
      "application/pdf": [".pdf"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/vnd.ms-excel": [".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/x-hwp": [".hwp"],
      "application/vnd.hancom.hwpx": [".hwpx"],
      "application/vnd.ms-powerpoint": [".ppt"],
      "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
    },
  });

  const handleDownload = (url: string, filename: string, mimeType?: string) => {
    const downloadUrl = `/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}${mimeType ? `&mimeType=${encodeURIComponent(mimeType)}` : ""}`;
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDelete = (id: number, title: string) => {
    if (confirm(`'${title}' 파일을 삭제하시겠습니까?`)) {
      deleteMutation.mutate({ id });
    }
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / 10)) : 1;

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">내부 메뉴얼 자료실</h1>
          <p className="text-muted-foreground mt-1">업무에 필요한 메뉴얼과 가이드를 공유합니다.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Upload className="w-5 h-5" />
                자료 일괄 등록
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">등록자 성함</label>
                <Input
                  placeholder="이름을 입력하세요"
                  value={uploaderName}
                  onChange={(e) => setUploaderName(e.target.value)}
                  disabled={isUploading}
                />
              </div>

              <div
                {...getRootProps()}
                className={`
                  border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                  ${isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"}
                  ${isUploading ? "opacity-50 pointer-events-none" : ""}
                `}
              >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center gap-2">
                  <div className="p-3 bg-primary/10 rounded-full">
                    {isUploading ? <Loader2 className="w-6 h-6 text-primary animate-spin" /> : <Upload className="w-6 h-6 text-primary" />}
                  </div>
                  <p className="text-sm font-medium">파일들을 드래그하거나 클릭해 여러 개 선택하세요</p>
                  <p className="text-xs text-muted-foreground">선택 후 아래의 일괄 업로드 버튼으로 한 번에 등록됩니다.</p>
                </div>
              </div>

              <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold">선택된 파일</p>
                    <p className="text-xs text-muted-foreground">총 {selectedFiles.length}건</p>
                  </div>
                  <Button type="button" variant="ghost" size="sm" onClick={clearSelectedFiles} disabled={isUploading || selectedFiles.length === 0}>
                    선택 초기화
                  </Button>
                </div>

                {selectedFiles.length === 0 ? (
                  <div className="text-xs text-muted-foreground border rounded-md bg-background px-3 py-4 text-center">
                    아직 선택된 파일이 없습니다.
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-1 pr-1">
                    {selectedFiles.map((file, index) => (
                      <div key={`${file.name}-${file.size}-${file.lastModified}`} className="flex items-center justify-between gap-2 border rounded-md bg-background px-2 py-2 text-xs">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{file.name}</p>
                          <p className="text-muted-foreground">{Math.max(1, Math.round(file.size / 1024))} KB</p>
                        </div>
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => removeSelectedFile(index)} disabled={isUploading}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <Button type="button" className="w-full gap-2" onClick={handleBatchUpload} disabled={isUploading || selectedFiles.length === 0 || !uploaderName.trim()}>
                  {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {isUploading ? "업로드 진행 중" : `${selectedFiles.length}개 파일 일괄 업로드`}
                </Button>
              </div>

              {uploadStatus.length > 0 && (
                <div className="space-y-3 mt-4">
                  <div className="flex justify-between text-xs font-medium">
                    <span>업로드 진행률</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} className="h-2" />
                  <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                    {uploadStatus.map((file, i) => (
                      <div key={`${file.name}-${i}`} className="flex items-center justify-between text-[11px] py-1 border-b border-border last:border-0">
                        <span className="truncate max-w-[150px]">{file.name}</span>
                        {file.status === "pending" && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                        {file.status === "success" && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                        {file.status === "error" && <AlertCircle className="w-3 h-3 text-destructive" />}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="자료 제목으로 검색..."
              className="pl-10"
              value={keyword}
              onChange={(e) => {
                setKeyword(e.target.value);
                setPage(1);
              }}
            />
          </div>

          <div className="space-y-3">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)
            ) : data?.items.length === 0 ? (
              <div className="text-center py-12 border rounded-xl bg-muted/10">
                <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">등록된 자료가 없습니다.</p>
              </div>
            ) : (
              data?.items.map((file) => (
                <Card key={file.id} className="group hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4 overflow-hidden">
                      <div className="p-3 bg-muted rounded-lg shrink-0">
                        <FileIcon className="w-6 h-6 text-primary" />
                      </div>
                      <div className="overflow-hidden">
                        <h3
                          className="font-semibold truncate cursor-pointer hover:text-primary transition-colors"
                          onClick={() => handleDownload(file.fileUrl, file.originalName || `${file.title}.${file.fileType}`, file.mimeType || "application/octet-stream")}
                        >
                          {file.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <Badge variant="secondary" className="uppercase text-[10px] px-1.5 py-0">
                            {file.fileType}
                          </Badge>
                          <span>•</span>
                          <span>{file.uploader}</span>
                          <span>•</span>
                          <span>{format(new Date(file.createdAt), "yyyy-MM-dd")}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleDelete(file.id, file.title)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => handleDownload(file.fileUrl, file.originalName || `${file.title}.${file.fileType}`, file.mimeType || "application/octet-stream")}
                      >
                        <Download className="w-4 h-4" />
                        다운로드
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {data && totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page <= 1}>
                이전
              </Button>
              <span className="text-sm text-muted-foreground">
                {page} / {totalPages}
              </span>
              <Button type="button" variant="outline" size="sm" onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={page >= totalPages}>
                다음
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
