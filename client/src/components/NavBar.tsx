import { useState, useRef, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Bell, FileText, BookOpen, Home, X, Trash2, LogIn, LogOut, Users, Settings } from "lucide-react";
import {
  AUTH_CHANGED_EVENT,
  OPEN_LOGIN_EVENT,
  getCurrentUser,
  login,
  logout,
  updatePassword,
  updatePasswordWithCurrent,
  getUserTheme,
  saveUserTheme,
  getUserThemeIntensity,
  saveUserThemeIntensity,
  THEME_OPTIONS,
  type AppUser,
  type AppTheme,
} from "@/lib/simpleAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NavBar() {
  const [location, setLocation] = useLocation();
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const [authUser, setAuthUser] = useState<AppUser | null>(() => getCurrentUser());
  const [loginOpen, setLoginOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<AppTheme>(() => getUserTheme());
  const [themeIntensity, setThemeIntensity] = useState(() => getUserThemeIntensity());
  const [loginId, setLoginId] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordAccordionOpen, setPasswordAccordionOpen] = useState(false);
  const [loginError, setLoginError] = useState("");

  const { data: unreadData, refetch: refetchUnread } =
    trpc.notifications.unreadCount.useQuery(undefined, {
      refetchInterval: 60000,
    });

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

    window.dispatchEvent(
      new CustomEvent("openNoticeData", { detail: notice })
    );

    setLocation("/hometax");
    setNotifOpen(false);
  };

  const deleteMutation = trpc.notifications.delete.useMutation({
    onSuccess: () => {
      refetch();
      refetchUnread();
    },
  });

  const deleteAllMutation = trpc.notifications.deleteAll.useMutation({
    onSuccess: () => {
      refetch();
      refetchUnread();
      setPage(1);
    },
  });

  useEffect(() => {
    const syncAuth = () => setAuthUser(getCurrentUser());
    const openLogin = () => setLoginOpen(true);

    window.addEventListener(AUTH_CHANGED_EVENT, syncAuth);
    window.addEventListener(OPEN_LOGIN_EVENT, openLogin);

    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, syncAuth);
      window.removeEventListener(OPEN_LOGIN_EVENT, openLogin);
    };
  }, []);

  const handleLoginSubmit = async () => {
  const result = await login(
    loginId,
    loginPassword
  );

  if (!result.success) {
    setLoginError(result.message);
    return;
  }

  setAuthUser(result.user || null);
  setLoginOpen(false);
  setLoginError("");
  setLoginPassword("");

  if (result.isInitialPassword) {
    setNewPassword("1");
    setPasswordOpen(true);
  }
};

  const handleThemeChange = (theme: AppTheme) => {
    setSelectedTheme(theme);
    saveUserTheme(theme, authUser?.username);
  };

  const handleThemeIntensityChange = (intensity: number) => {
    setThemeIntensity(intensity);
    saveUserThemeIntensity(intensity, authUser?.username);
  };

  const showTemporaryError = (message: string) => {
    setLoginError(message);

    window.setTimeout(() => {
      setLoginError("");
    }, 3000);
  };

  const handleInitialPasswordSave = async () => {
    if (!authUser) return;

    const result = await updatePassword(authUser.username, newPassword);

    if (!result.success) {
      showTemporaryError("비밀번호 저장 실패");
      return;
    }

    setPasswordOpen(false);
    setNewPassword("");
    setLoginError("");
  };

  const handleSettingsPasswordSave = async () => {
    if (!authUser) return;

    const result = await updatePasswordWithCurrent(
      authUser.username,
      currentPassword,
      newPassword,
      confirmPassword
    );

    if (!result.success) {
      showTemporaryError(result.message || "비밀번호 저장 실패");
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordAccordionOpen(false);

    setLoginError("비밀번호가 변경되었습니다.");

    window.setTimeout(() => {
      setLoginError("");
    }, 3000);
  };

  const handleLogout = () => {
    logout();
    setAuthUser(null);
    setLoginId("");
    setLoginPassword("");
  };

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
    ...(authUser?.role === "admin"
      ? [{ href: "/account-admin", label: "계정관리", icon: Users }]
      : []),
  ];

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur-sm">
        <div className="container flex h-16 items-center justify-between">
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

          <div className="flex items-center gap-4">
            <div className="flex items-center justify-end gap-2 min-w-[150px]">
              {authUser ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTheme(getUserTheme(authUser.username));
                      setThemeIntensity(getUserThemeIntensity(authUser.username));
                      setSettingsOpen(true);
                    }}
                    className="w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="개인 설정"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
            
                  <span className="hidden sm:inline text-sm font-medium text-foreground">
                    {authUser.username}님
                  </span>
            
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <LogOut className="w-4 h-4" />
                    로그아웃
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setLoginOpen(true)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <LogIn className="w-4 h-4" />
                  로그인
                </button>
              )}
            </div>

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

              {notifOpen && (
                <div className="absolute right-0 top-12 w-80 sm:w-96 bg-card border border-border rounded-xl shadow-lg overflow-hidden z-50">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm text-foreground">
                        최근 등록 공지
                      </h3>
                      {notifData && notifData.items.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            if (confirm("모든 알림을 삭제하시겠습니까?")) {
                              deleteAllMutation.mutate();
                            }
                          }}
                          className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          일괄 삭제
                        </button>
                      )}
                    </div>
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
                          onClick={() =>
                            setPage((p) =>
                              Math.min(Math.ceil(notifData.total / 5), p + 1)
                            )
                          }
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
        </div>
      </header>

      {loginOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
          <div className="relative w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-foreground">로그인</h2>
              <button
                type="button"
                onClick={() => setLoginOpen(false)}
                className="p-1 rounded-md hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-sm font-medium">아이디</label>
                <input
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="이름을 입력하세요"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium">비밀번호</label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleLoginSubmit();
                  }}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="초기 비밀번호는 1입니다"
                />
              </div>

              {loginError && (
                <p className="text-xs text-destructive">{loginError}</p>
              )}

              <Button className="w-full" onClick={handleLoginSubmit}>
                로그인
              </Button>
            </div>
          </div>
        </div>
      )}

            {settingsOpen && authUser && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
          <div className="relative w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-foreground">개인 설정</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {authUser.username}님 전용 설정입니다.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="p-1 rounded-md hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-5">
              <div className="rounded-lg border border-border bg-background">
                <button
                  type="button"
                  onClick={() => setPasswordAccordionOpen((prev) => !prev)}
                  className="w-full flex items-center justify-between px-3 py-3 text-left"
                >
                  <span className="text-sm font-semibold text-foreground">
                    비밀번호 변경
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {passwordAccordionOpen ? "접기" : "펼치기"}
                  </span>
                </button>

                {passwordAccordionOpen && (
                  <div className="space-y-3 border-t border-border p-3">
                    <input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="현재 비밀번호"
                    />

                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="새 비밀번호"
                    />

                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="새 비밀번호 확인"
                    />

                    <Button
                      size="sm"
                      onClick={handleSettingsPasswordSave}
                      className="w-full"
                    >
                      비밀번호 저장
                    </Button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground">
                  화면 테마
                </label>
                <div className="rounded-lg border border-border bg-background p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-semibold text-foreground">
                      색감
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {themeIntensity}%
                    </span>
                  </div>

                  <input
                    type="range"
                    min="70"
                    max="150"
                    step="5"
                    value={themeIntensity}
                    onChange={(e) =>
                      handleThemeIntensityChange(Number(e.target.value))
                    }
                    className="w-full accent-primary"
                  />

                  <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                    <span>연하게</span>
                    <span>기본</span>
                    <span>진하게</span>
                  </div>
                </div>                

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {THEME_OPTIONS.map((theme) => (
                    <button
                      key={theme.value}
                      type="button"
                      onClick={() => handleThemeChange(theme.value)}
                      className={cn(
                        "text-left rounded-lg border p-3 transition-colors hover:bg-muted",
                        selectedTheme === theme.value
                          ? "border-primary bg-primary/10"
                          : "border-border bg-background"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-foreground">
                          {theme.label}
                        </span>
                        {selectedTheme === theme.value && (
                          <span className="text-[10px] font-bold text-primary">
                            선택됨
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {theme.description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {loginError && (
                <p className="text-xs text-destructive">{loginError}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {passwordOpen && authUser && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4">
          <div className="relative w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-xl">
            <h2 className="text-lg font-bold text-foreground mb-2">
              비밀번호 설정
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              원하는 비밀번호로 변경할 수 있습니다. 기존처럼 1로 유지해도 됩니다.
            </p>

            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mb-3"
              placeholder="새 비밀번호"
            />

            {loginError && (
              <p className="text-xs text-destructive mb-3">{loginError}</p>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPasswordOpen(false)}>
                나중에
              </Button>
              <Button onClick={handleInitialPasswordSave}>저장</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
