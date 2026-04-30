import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Bell, FileText, BookOpen, Home, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";

export default function NavBar() {
  const [location, setLocation] = useLocation();
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const { data: unreadData, refetch: refetchUnread } = trpc.notifications.unreadCount.useQuery(
    undefined,
    { refetchInterval: 60000 }
  );
  const [page, setPage] = useState(1);

const { data: notifData, isLoading: notifLoading, refetch } =
  trpc.notifications.list.useQuery(
    { page, pageSize: 5 },
    { enabled: notifOpen }
  );
  
  const markAllRead = trpc.notifications.markAllRead.useMutation({
    onSuccess: () => refetchUnread(),
  });

  const unreadCount = unreadData?.count ?? 0;
  
  const utils = trpc.useUtils();

const handleClick = async (notif: any) => {
  if (!notif.noticeId) return;

  const cached = utils.hometax.byId.getData({ id: notif.noticeId });

  let notice: any;

  if (cached) {
    notice = cached;
  } else {
    notice = await utils.client.hometax.byId.query({
      id: notif.noticeId,
    });
  }

  sessionStorage.setItem("pendingNoticeData", JSON.stringify(notice));
  setNotifOpen(false);

  if (location === "/hometax") {
    window.dispatchEvent(
      new CustomEvent("openNoticeData", { detail: notice })
    );
  } else {
    setLocation("/hometax");
  }
};

  const deleteMutation = trpc.notifications.delete.useMutation({
  onSuccess: () => {
    refetch();
    refetchUnread();
  },
});

  // 외부 클릭 시 닫기
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNotifOpen = () => {
    setNotifOpen((prev) => !prev);
    if (!notifOpen && unreadCount > 0) {
      markAllRead.mutate();
    }
  };

  const navItems = [
    { href: "/", label: "홈", icon: Home },
    { href: "/hometax", label: "홈택스 전자신고 설명서", icon: FileText },
    { href: "/manual", label: "내부 메뉴얼 자료실", icon: BookOpen },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur-sm">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link href="/">
          <div className="flex items-center gap-2 cursor-pointer select-none">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <FileText className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-base tracking-tight hidden sm:block text-foreground">
              전자신고 허브
            </span>
          </div>
        </Link>

        {/* Navigation */}
        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="hidden md:block">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Notification Bell */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={handleNotifOpen}
            className="relative w-9 h-9 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
            aria-label="알림"
          >
            <Bell className="w-5 h-5 text-foreground" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {/* Notification Dropdown */}
{notifOpen && (
  <div className="absolute right-0 top-12 w-80 sm:w-96 bg-card border border-border rounded-xl shadow-lg overflow-hidden z-50">
    <div className="flex items-center justify-between px-4 py-3 border-b border-border">
      <h3 className="font-semibold text-sm text-foreground">최근 등록 공지</h3>
      <button
        onClick={() => setNotifOpen(false)}
        className="w-6 h-6 flex items-center justify-center rounded hover:bg-muted transition-colors"
      >
        <X className="w-4 h-4 text-muted-foreground" />
      </button>
    </div>

    <div className="max-h-80 overflow-y-auto">
      {notifLoading ? (
        <div className="px-4 py-6 text-center text-sm text-muted-foreground">
          불러오는 중...
        </div>
      ) : !notifData || notifData.items.length === 0 ? (
        <div className="px-4 py-6 text-center text-sm text-muted-foreground">
          새로운 알림이 없습니다.
        </div>
      ) : (
        notifData.items.map((notif) => (
          <div
            key={notif.id}
            onClick={() => handleClick(notif)}
            className="flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors border-b border-border/50 last:border-0 group cursor-pointer"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                {notif.title}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {new Date(notif.createdAt).toLocaleDateString("ko-KR")}
              </p>
            </div>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                deleteMutation.mutate({ id: notif.id });
              }}
              className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              title="알림 삭제"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))
      )}

      {notifData && notifData.total > 5 && (
        <div className="flex items-center justify-center gap-3 px-4 py-2 border-t border-border bg-muted/10">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="text-xs text-muted-foreground hover:text-primary disabled:opacity-40"
          >
            이전
          </button>

          <span className="text-xs text-muted-foreground">
            {page} / {Math.ceil(notifData.total / 5)}
          </span>

          <button
            type="button"
            onClick={() => setPage((p) => Math.min(Math.ceil(notifData.total / 5), p + 1))}
            disabled={page >= Math.ceil(notifData.total / 5)}
            className="text-xs text-muted-foreground hover:text-primary disabled:opacity-40"
          >
            다음
          </button>
        </div>
      )}
    </div>
  </div>
)}
        </div>
      </div>
    </header>
  );
}
