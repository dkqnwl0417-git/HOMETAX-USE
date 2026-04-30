import { useState, useCallback } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const MAX_FILE_SIZE = 50 * 1024 * 1024;

type UploadStatus = "pending" | "uploading" | "saving" | "success" | "error";

interface UploadQueueItem {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: UploadStatus;
  error?: string;
}

interface UploadApiResponse {
  success: boolean;
  fileUrl: string;
  fileType: string;
  originalName: string;
  mimeType?: string;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function getStatusLabel(status: UploadStatus) {
  switch (status) {
    case "pending":
      return "대기 중";
    case "uploading":
      return "업로드 중";
    case "saving":
      return "등록 중";
    case "success":
      return "완료";
    case "error":
      return "실패";
    default:
      return "대기 중";
  }
}

function getStatusVariant(status: UploadStatus): "default" | "secondary" | "destructive" {
  switch (status) {
    case "success":
      return "default";
    case "error":
      return "destructive";
    default:
      return "secondary";
  }
}

function uploadFileWithProgress(
  file: File,
  onProgress: (progress: number) => void,
): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");

    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable) return;
      const progress = Math.min(99, Math.round((event.loaded / event.total) * 100));
      onProgress(progress);
    });

    xhr.addEventListener("load", () => {
      try {
        const responseText = xhr.responseText || "{}";
        const responseJson = JSON.parse(responseText);

        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress(100);
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

    xhr.addEventListener("abort", () => {
      reject(new Error("업로드가 취소되었습니다."));
    });

    xhr.send(formData);
  });
}

export default function ManualFiles() {
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [isUploading, setIsUploading] = useState(false);
  const [uploaderName, setUploaderName] = useState("");
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [overallProgress, setOverallProgress] = useState(0);
  const { toast } = useToast();

  const utils = trpc.useContext();
  const { data, isLoading } = trpc.manual.list.useQuery({
    keyword,
    page,
    pageSize: 10,
  });

  const uploadMutation = trpc.manual.upload.useMutation();

  const deleteMutation = trpc.manual.delete.useMutation({
    onSuccess: () => {
      toast({ title: "삭제 성공", description: "파일이 삭제되었습니다." });
      utils.manual.list.invalidate();
    },
    onError: (err) => {
      toast({ title: "삭제 실패", description: err.message, variant: "destructive" });
    }
  });

  const updateQueueItem = useCallback((id: string, patch: Partial<UploadQueueItem>) => {
    setUploadQueue((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }, []);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0 || isUploading) return;

    if (!uploaderName.trim()) {
      toast({ title: "알림", description: "등록자 이름을 먼저 입력해주세요.", variant: "destructive" });
      return;
    }

    const queueItems: UploadQueueItem[] = acceptedFiles.map((file, index) => ({
      id: `${file.name}-${file.size}-${index}-${Date.now()}`,
      name: file.name,
      size: file.size,
      progress: 0,
      status: "pending",
    }));

    setUploadQueue(queueItems);
    setOverallProgress(0);
    setIsUploading(true);

    let processedCount = 0;
    let successCount = 0;
    let failedCount = 0;

    const updateOverallProgress = (currentProgress = 0) => {
      const totalFiles = queueItems.length;
      const progressValue = ((processedCount + currentProgress / 100) / totalFiles) * 100;
      setOverallProgress(Math.min(100, Math.round(progressValue)));
    };

    for (let i = 0; i < acceptedFiles.length; i += 1) {
      const file = acceptedFiles[i];
      const queueItem = queueItems[i];

      updateQueueItem(queueItem.id, { status: "uploading", progress: 0, error: undefined });

      try {
        const result = await uploadFileWithProgress(file, (progress) => {
          updateQueueItem(queueItem.id, { status: "uploading", progress });
          updateOverallProgress(progress);
        });

        updateQueueItem(queueItem.id, { status: "saving", progress: 100 });

        await uploadMutation.mutateAsync({
          title: file.name.replace(/\.[^/.]+$/, ""),
          fileUrl: result.fileUrl,
          fileType: result.fileType,
          originalName: result.originalName,
          mimeType: result.mimeType,
          uploader: uploaderName.trim(),
        });

        successCount += 1;
        processedCount += 1;
        updateQueueItem(queueItem.id, { status: "success", progress: 100 });
        updateOverallProgress(0);
      } catch (err: any) {
        failedCount += 1;
        processedCount += 1;
        updateQueueItem(queueItem.id, {
          status: "error",
          progress: 0,
          error: err?.message || "업로드 처리 중 오류가 발생했습니다.",
        });
        updateOverallProgress(0);
      }
    }

    await utils.manual.list.invalidate();
    setIsUploading(false);

    if (successCount > 0 && failedCount === 0) {
      toast({
        title: "등록 완료",
        description: `${successCount}개 파일이 모두 성공적으로 등록되었습니다.`,
      });
      return;
    }

    if (successCount > 0 && failedCount > 0) {
      toast({
        title: "일부 등록 완료",
        description: `${successCount}개 성공 / ${failedCount}개 실패`,
      });
      return;
    }

    toast({
      title: "업로드 실패",
      description: `${failedCount}개 파일 업로드에 실패했습니다.`,
      variant: "destructive",
    });
  }, [isUploading, toast, updateQueueItem, uploadMutation, uploaderName, utils]);

  const onDropRejected = useCallback((fileRejections: FileRejection[]) => {
    if (fileRejections.length === 0) return;

    const tooLargeFiles = fileRejections
      .filter((rejection) => rejection.errors.some((error) => error.code === "file-too-large"))
      .map((rejection) => rejection.file.name);

    const invalidTypeFiles = fileRejections
      .filter((rejection) => rejection.errors.some((error) => error.code === "file-invalid-type"))
      .map((rejection) => rejection.file.name);

    if (tooLargeFiles.length > 0) {
      toast({
        title: "용량 초과",
        description: `${tooLargeFiles.join(", ")} 파일은 50MB를 초과하여 업로드할 수 없습니다.`,
        variant: "destructive",
      });
    }

    if (invalidTypeFiles.length > 0) {
      toast({
        title: "업로드 불가 형식",
        description: `${invalidTypeFiles.join(", ")} 파일 형식은 지원되지 않습니다.`,
        variant: "destructive",
      });
    }
  }, [toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    disabled: isUploading,
    multiple: true,
    maxSize: MAX_FILE_SIZE,
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

  const successCount = uploadQueue.filter((item) => item.status === "success").length;
  const failedCount = uploadQueue.filter((item) => item.status === "error").length;

  return (
    <div className="container mx-auto py-8 px-4 max-w-5xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">내부 메뉴얼 자료실</h1>
          <p className="text-muted-foreground mt-1">업무에 필요한 메뉴얼, 문서, 압축파일, 실행파일을 공유합니다.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Upload className="w-5 h-5" />
                새 자료 등록
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
                  ${isUploading ? "opacity-70 pointer-events-none" : ""}
                `}
              >
                <input {...getInputProps()} />
                {isUploading ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-10 h-10 animate-spin text-primary" />
                    <div className="w-full max-w-xs space-y-2">
                      <p className="text-sm font-medium">여러 파일을 순차 업로드 중입니다.</p>
                      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
                          style={{ width: `${overallProgress}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        전체 진행률 {overallProgress}% · 성공 {successCount}건 · 실패 {failedCount}건
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-3 bg-primary/10 rounded-full">
                      <Upload className="w-6 h-6 text-primary" />
                    </div>
                    <p className="text-sm font-medium">파일을 드래그하거나 클릭하세요</p>
                    <p className="text-xs text-muted-foreground">
                      여러 파일 동시 선택 가능 · 문서 / 압축파일 / 실행파일 등 업로드 가능 · 최대 50MB
                    </p>
                  </div>
                )}
              </div>

              {uploadQueue.length > 0 && (
                <div className="space-y-3 rounded-lg border p-3 bg-muted/20">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium">업로드 진행 현황</p>
                    <Badge variant="secondary">총 {uploadQueue.length}건</Badge>
                  </div>
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {uploadQueue.map((item) => (
                      <div key={item.id} className="rounded-md border bg-background p-3 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{item.name}</p>
                            <p className="text-xs text-muted-foreground">{formatFileSize(item.size)}</p>
                          </div>
                          <Badge variant={getStatusVariant(item.status)}>{getStatusLabel(item.status)}</Badge>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full transition-all ${item.status === "error" ? "bg-destructive" : "bg-primary"}`}
                            style={{ width: `${item.status === "error" ? 100 : item.progress}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground gap-2">
                          <span>{item.status === "error" ? "오류 발생" : `${item.progress}%`}</span>
                          <span className="flex items-center gap-1">
                            {item.status === "success" ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                            ) : item.status === "error" ? (
                              <AlertCircle className="w-3.5 h-3.5 text-destructive" />
                            ) : (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            )}
                            {getStatusLabel(item.status)}
                          </span>
                        </div>
                        {item.error && (
                          <p className="text-xs text-destructive break-words">{item.error}</p>
                        )}
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
              onChange={(e) => setKeyword(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full rounded-xl" />
              ))
            ) : data?.items.length === 0 ? (
              <div className="text-center py-12 border rounded-xl bg-muted/10">
                <FileText className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">등록된 자료가 없습니다.</p>
              </div>
            ) : (
              data?.items.map((file: any) => (
                <Card key={file.id} className="group hover:shadow-md transition-shadow">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4 overflow-hidden">
                      <div className="p-3 bg-muted rounded-lg shrink-0">
                        <FileIcon className="w-6 h-6 text-primary" />
                      </div>
                      <div className="overflow-hidden">
                        <h3
                          className="font-semibold truncate cursor-pointer hover:text-primary transition-colors"
                          onClick={() => handleDownload(file.fileUrl, `${file.title}.${file.fileType}`, file.mimeType || "application/octet-stream")}
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
                        onClick={() => handleDownload(file.fileUrl, `${file.title}.${file.fileType}`, file.mimeType || "application/octet-stream")}
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
        </div>
      </div>
    </div>
  );
}
