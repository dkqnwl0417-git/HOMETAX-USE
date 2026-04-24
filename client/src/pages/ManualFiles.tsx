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
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export default function ManualFiles() {
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [isUploading, setIsUploading] = useState(false);
  const [uploaderName, setUploaderName] = useState("");
  const { toast } = useToast();

  const utils = trpc.useContext();
  const { data, isLoading } = trpc.manual.list.useQuery({
    keyword,
    page,
    pageSize: 10,
  });

  const uploadMutation = trpc.manual.upload.useMutation({
    onSuccess: () => {
      toast({ title: "등록 성공", description: "파일이 성공적으로 등록되었습니다." });
      utils.manual.list.invalidate();
      setIsUploading(false);
    },
    onError: (err) => {
      toast({
        title: "등록 실패",
        description: err.message || "파일 정보를 DB에 저장하는 데 실패했습니다.",
        variant: "destructive",
      });
      setIsUploading(false);
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

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;
      if (!uploaderName.trim()) {
        toast({
          title: "알림",
          description: "등록자 이름을 먼저 입력해주세요.",
          variant: "destructive",
        });
        return;
      }

      const file = acceptedFiles[0];
      setIsUploading(true);

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

        uploadMutation.mutate({
          title: file.name.replace(/\.[^/.]+$/, ""),
          fileUrl: result.fileUrl,
          fileType: result.fileType,
          originalName: result.originalName, // ★ 서버에서 반환한 원본 파일명 사용
          uploader: uploaderName,
        });
      } catch (err: any) {
        toast({ title: "업로드 실패", description: err.message, variant: "destructive" });
        setIsUploading(false);
      }
    },
    [uploaderName, uploadMutation, toast]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: {
      "application/pdf": [".pdf"],
      "application/msword": [".doc"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/vnd.ms-excel": [".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "application/x-hwp": [".hwp"],
    },
  });

  // ★ 서버 프록시(/api/download)를 통해 원본 파일명·확장자 그대로 다운로드
  const handleDownload = (fileUrl: string, originalName: string, fileType: string) => {
    // originalName이 있으면 그대로, 없으면 title + 확장자로 폴백
    const filename = originalName && originalName.trim() !== ""
      ? originalName
      : `file.${fileType}`;

    const proxyUrl =
      `/api/download?url=${encodeURIComponent(fileUrl)}&filename=${encodeURIComponent(filename)}`;

    const link = document.createElement("a");
    link.href = proxyUrl;
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
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <div className="p-3 bg-primary/10 rounded-full">
                      <Upload className="w-6 h-6 text-primary" />
                    </div>
                    <p className="text-sm font-medium">파일을 드래그하거나 클릭하세요</p>
                    <p className="text-xs text-muted-foreground">PDF, Word, Excel, HWP (최대 50MB)</p>
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
                          // ★ originalName 기반으로 다운로드
                          onClick={() =>
                            handleDownload(file.fileUrl, file.originalName, file.fileType)
                          }
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
                        // ★ originalName 기반으로 다운로드
                        onClick={() =>
                          handleDownload(file.fileUrl, file.originalName, file.fileType)
                        }
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
