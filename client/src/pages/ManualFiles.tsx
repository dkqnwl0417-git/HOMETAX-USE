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
  AlertCircle
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export default function ManualFiles() {
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [isUploading, setIsUploading] = useState(false);
  const [uploaderName, setUploaderName] = useState("");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<{ name: string; status: 'pending' | 'success' | 'error' }[]>([]);
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
    }
  });

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
    setUploadProgress(0);
    const initialStatus = acceptedFiles.map(f => ({ name: f.name, status: 'pending' as const }));
    setUploadStatus(initialStatus);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < acceptedFiles.length; i++) {
      const file = acceptedFiles[i];
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
          uploader: uploaderName,
        });

        setUploadStatus(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'success' } : s));
        successCount++;
      } catch (err: any) {
        console.error(`파일 업로드 실패 (${file.name}):`, err);
        setUploadStatus(prev => prev.map((s, idx) => idx === i ? { ...s, status: 'error' } : s));
        failCount++;
      }
      
      setUploadProgress(Math.round(((i + 1) / acceptedFiles.length) * 100));
    }

    setIsUploading(false);
    toast({ 
      title: "업로드 완료", 
      description: `성공: ${successCount}건, 실패: ${failCount}건`,
      variant: failCount > 0 ? "destructive" : "default"
    });
    
    // 3초 후 상태 초기화
    setTimeout(() => {
      if (!isUploading) {
        setUploadStatus([]);
        setUploadProgress(0);
      }
    }, 3000);

  }, [uploaderName, uploadMutation, toast, isUploading]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    multiple: true,
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/x-hwp': ['.hwp'],
    }
  });

  const handleDownload = (url: string, filename: string, mimeType?: string) => {
    const downloadUrl = `/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}${mimeType ? `&mimeType=${encodeURIComponent(mimeType)}` : ''}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', filename);
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
                  ${isDragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25 hover:border-primary/50'}
                  ${isUploading ? 'opacity-50 pointer-events-none' : ''}
                `}
              >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center gap-2">
                  <div className="p-3 bg-primary/10 rounded-full">
                    <Upload className="w-6 h-6 text-primary" />
                  </div>
                  <p className="text-sm font-medium">파일들을 드래그하거나 클릭하세요</p>
                  <p className="text-xs text-muted-foreground">여러 파일 선택 가능 (최대 50MB/개)</p>
                </div>
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
                      <div key={i} className="flex items-center justify-between text-[11px] py-1 border-b border-border last:border-0">
                        <span className="truncate max-w-[150px]">{file.name}</span>
                        {file.status === 'pending' && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                        {file.status === 'success' && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                        {file.status === 'error' && <AlertCircle className="w-3 h-3 text-destructive" />}
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
