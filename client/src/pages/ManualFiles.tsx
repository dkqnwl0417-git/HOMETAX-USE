import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Upload, FileText, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useDropzone } from "react-dropzone";

export default function ManualFiles() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);

  const { data: files, isLoading } = useQuery({
    queryKey: ["manual-files"],
    queryFn: () => trpc.manual.list.query(),
  });

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch("/api/manual/upload", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("업로드 실패");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manual-files"] });
      toast({ title: "성공", description: "파일이 업로드되었습니다." });
    },
    onError: (error) => {
      toast({ title: "오류", description: error.message, variant: "destructive" });
    },
    onSettled: () => setIsUploading(false),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => trpc.manual.delete.mutate({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manual-files"] });
      toast({ title: "성공", description: "파일이 삭제되었습니다." });
    },
  });

  const onDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    
    setIsUploading(true);
    const formData = new FormData();
    acceptedFiles.forEach((file) => {
      formData.append("files", file);
    });

    uploadMutation.mutate(formData);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
  });

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">내부 메뉴얼 자료실</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>파일 업로드</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-12 text-center cursor-pointer transition-colors ${
              isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25"
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            {isUploading ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>업로드 중...</span>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-lg font-medium">
                  {isDragActive ? "파일을 여기에 놓으세요" : "파일을 드래그하거나 클릭하여 선택하세요"}
                </p>
                <p className="text-sm text-muted-foreground">여러 파일을 한 번에 올릴 수 있습니다.</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))
        ) : files?.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            등록된 파일이 없습니다.
          </div>
        ) : (
          files?.map((file) => (
            <Card key={file.id} className="group relative">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="flex items-center gap-2 overflow-hidden">
                  <FileText className="h-5 w-5 text-blue-500 shrink-0" />
                  <a
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold hover:underline truncate"
                    title={file.title}
                  >
                    {file.title}
                  </a>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                  onClick={() => {
                    if (confirm("정말 삭제하시겠습니까?")) {
                      deleteMutation.mutate(file.id);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center text-sm text-muted-foreground">
                  <span>{new Date(file.createdAt).toLocaleDateString()}</span>
                  <Badge variant="secondary">
                    {file.url.split(".").pop()?.toUpperCase() || "FILE"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
