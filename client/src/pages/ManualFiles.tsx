import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
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
  Loader2
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

type UploadProgress = {
  total: number;
  current: number;
  currentFileName: string;
};

export default function ManualFiles() {
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [isUploading, setIsUploading] = useState(false);
  const [uploaderName, setUploaderName] = useState("");
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
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

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    if (!uploaderName.trim()) {
      toast({ title: "알림", description: "등록자 이름을 먼저 입력해주세요.", variant: "destructive" });
      return;
    }

    setIsUploading(true);

    let successCount = 0;
    const failedUploads: string[] = [];

    try {
      for (let index = 0; index < acceptedFiles.length; index += 1) {
        const file = acceptedFiles[index];
        setUploadProgress({
          total: acceptedFiles.length,
          current: index + 1,
          currentFileName: file.name,
        });

        try {
          const formData = new FormData();
          formData.append("file", file);

          const response = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });

          if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            throw new Error(errorData?.error || "업로드 실패");
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

          successCount += 1;
        } catch (err: any) {
          failedUploads.push(`${file.name}: ${err?.message || "알 수 없는 오류"}`);
        }
      }

      await utils.manual.list.invalidate();

      if (successCount > 0 && failedUploads.length === 0) {
        toast({
          title: "일괄 업로드 완료",
          description: `${successCount}개 파일이 성공적으로 등록되었습니다.`,
        });
      } else if (successCount > 0) {
        toast({
          title: "일부 업로드 완료",
          description: `${successCount}개 성공 / ${failedUploads.length}개 실패`,
        });
        toast({
          title: "실패 파일 확인",
          description: failedUploads.slice(0, 3).join(" | "),
          variant: "destructive",
        });
      } else {
        toast({
          title: "업로드 실패",
          description: failedUploads[0] || "모든 파일 업로드에 실패했습니다.",
          variant: "destructive",
        });
      }
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
    }
  }, [toast, uploadMutation, uploaderName, utils.manual.list]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
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
    }
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
                {isUploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-10 h-10 animate-spin text-primary" />
                    <p className="text-sm font-medium">업로드 중...</p>
                    {uploadProgress ? (
                      <>
                        <p className="text-xs text-muted-foreground">
                          {uploadProgress.current} / {uploadProgress.total} · {uploadProgress.currentFileName}
                        </p>
                        <p className="text-xs text-muted-foreground">여러 파일을 순차적으로 안전하게 등록하고 있습니다.</p>
                      </>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-3 bg-primary/10 rounded-full">
                      <Upload className="w-6 h-6 text-primary" />
                    </div>
                    <p className="text-sm font-medium">파일을 여러 개 드래그하거나 클릭해서 선택하세요</p>
                    <p className="text-xs text-muted-foreground">등록자 이름 1회 입력 후 일괄 업로드 가능합니다.</p>
                    <p className="text-xs text-muted-foreground">PDF, Word, Excel, HWP/HWPX (파일당 최대 50MB)</p>
                  </div>
                )}
              </div>
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
