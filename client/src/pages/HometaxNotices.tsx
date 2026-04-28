import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Card, CardContent } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select.tsx";
import { 
  Search, 
  ExternalLink, 
  RefreshCw, 
  Trash2,
  Calendar as CalendarIcon,
  Plus
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog.tsx";
import { Calendar } from "@/components/ui/calendar.tsx";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover.tsx";

export default function HometaxNotices() {
  const [taxType, setTaxType] = useState<string>("all");
  const [docType, setDocType] = useState<string>("all");
  const [page, setPage] = useState(1);
  const { toast } = useToast();

  const [newUrl, setNewUrl] = useState("");
  const [newTaxType, setNewTaxType] = useState("기타");
  const [newDocType, setNewDocType] = useState("파일설명서");
  const [newDate, setNewDate] = useState<Date>(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const utils = trpc.useContext();
  const { data, isLoading } = trpc.hometax.list.useQuery({
    taxType: taxType === "all" ? undefined : taxType,
    docType: docType === "all" ? undefined : docType,
    page,
    pageSize: 15,
  });

  const crawlMutation = trpc.hometax.crawl.useMutation({
    onSuccess: (res) => {
      toast({ 
        title: "수집 완료", 
        description: `새로운 자료 ${res.inserted}건이 등록되었습니다.` 
      });
      utils.hometax.list.invalidate();
    },
    onError: () => {
      toast({ title: "수집 실패", description: "홈택스 연결 중 오류가 발생했습니다.", variant: "destructive" });
    }
  });

  const insertMutation = trpc.hometax.insert.useMutation({
    onSuccess: () => {
      toast({ title: "등록 성공", description: "자료가 성공적으로 등록되었습니다." });
      utils.hometax.list.invalidate();
      setIsDialogOpen(false);
      setNewUrl("");
    },
    onError: (err) => {
      toast({ title: "등록 실패", description: err.message, variant: "destructive" });
    }
  });

  const deleteMutation = trpc.hometax.delete.useMutation({
    onSuccess: () => {
      toast({ title: "삭제 성공", description: "자료가 삭제되었습니다." });
      utils.hometax.list.invalidate();
    },
    onError: (err) => {
      toast({ title: "삭제 실패", description: err.message, variant: "destructive" });
    }
  });

  const handleManualInsert = () => {
    if (!newUrl.trim()) {
      toast({ title: "알림", description: "URL을 입력해주세요.", variant: "destructive" });
      return;
    }

    const formattedDate = format(newDate, "yyyy년 M월 d일");
    const autoTitle = `[전자신고]${newTaxType} ${newDocType}(${formattedDate} 공지)`;

    insertMutation.mutate({
      title: autoTitle,
      url: newUrl,
      taxType: newTaxType,
      docType: newDocType,
      date: format(newDate, "yyyy-MM-dd"),
    });
  };

  const handleOpenUrl = (url: string) => {
    const proxyUrl = `/api/hometax-view?url=${encodeURIComponent(url)}`;
    window.open(proxyUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">홈택스 전자신고 설명서</h1>
          <p className="text-muted-foreground mt-1">홈택스 자료실의 최신 전자신고 가이드를 자동으로 수집합니다.</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Plus className="w-4 h-4" />
                수기 등록
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>자료 수기 등록</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">홈택스 상세 URL</label>
                  <Input 
                    placeholder="https://hometax.go.kr/..." 
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">세금 유형</label>
                    <Select value={newTaxType} onValueChange={setNewTaxType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="부가가치세">부가가치세</SelectItem>
                        <SelectItem value="원천세">원천세</SelectItem>
                        <SelectItem value="법인세">법인세</SelectItem>
                        <SelectItem value="종합소득세">종합소득세</SelectItem>
                        <SelectItem value="기타">기타</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">문서 유형</label>
                    <Select value={newDocType} onValueChange={setNewDocType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="파일설명서">파일설명서</SelectItem>
                        <SelectItem value="제출요령">제출요령</SelectItem>
                        <SelectItem value="안내문">안내문</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">공지 날짜</label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(newDate, "yyyy-MM-dd")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={newDate}
                        onSelect={(date) => date && setNewDate(date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleManualInsert} disabled={insertMutation.isPending}>
                  {insertMutation.isPending ? "등록 중..." : "등록하기"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button 
            onClick={() => crawlMutation.mutate({})} 
            disabled={crawlMutation.isPending}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${crawlMutation.isPending ? 'animate-spin' : ''}`} />
            지금 수집
          </Button>
        </div>
      </div>

      <Card className="mb-6">
        <CardContent className="p-4 flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">세금유형:</span>
            <Select value={taxType} onValueChange={setTaxType}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="전체" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="부가가치세">부가가치세</SelectItem>
                <SelectItem value="원천세">원천세</SelectItem>
                <SelectItem value="법인세">법인세</SelectItem>
                <SelectItem value="종합소득세">종합소득세</SelectItem>
                <SelectItem value="기타">기타</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">문서유형:</span>
            <Select value={docType} onValueChange={setDocType}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="전체" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                <SelectItem value="파일설명서">파일설명서</SelectItem>
                <SelectItem value="제출요령">제출요령</SelectItem>
                <SelectItem value="안내문">안내문</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))
        ) : data?.items.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed rounded-2xl bg-muted/5">
            <Search className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-lg font-medium text-muted-foreground">조건에 맞는 자료가 없습니다.</p>
            <p className="text-sm text-muted-foreground/60 mt-1">수집 버튼을 눌러 최신 자료를 가져와보세요.</p>
          </div>
        ) : (
          data?.items.map((item) => (
            <Card key={item.id} className="group hover:border-primary/50 transition-all hover:shadow-sm">
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                      {item.taxType}
                    </Badge>
                    <Badge variant="secondary" className="font-normal">
                      {item.docType}
                    </Badge>
                    <span className="text-xs text-muted-foreground ml-2">
                      {item.date}
                    </span>
                  </div>
                  <h3 
                    className="font-semibold text-lg truncate cursor-pointer hover:text-primary transition-colors"
                    onClick={() => handleOpenUrl(item.url)}
                  >
                    {item.title}
                  </h3>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button 
                    variant="ghost" 
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      if(confirm("이 자료를 삭제하시겠습니까?")) deleteMutation.mutate({ id: item.id });
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="gap-2"
                    onClick={() => handleOpenUrl(item.url)}
                  >
                    <ExternalLink className="w-4 h-4" />
                    열기
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
