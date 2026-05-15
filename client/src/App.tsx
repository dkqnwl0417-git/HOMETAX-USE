import { useEffect, useRef, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import HometaxNotices from "./pages/HometaxNotices";
import ManualFiles from "./pages/ManualFiles";
import AccountAdmin from "./pages/AccountAdmin";
import NavBar from "./components/NavBar";
import { toast } from "sonner";
import {
  getCurrentUser,
  initAuthActivityTracking,
  requireLogin,
  applyCurrentUserTheme,
} from "@/lib/simpleAuth";

function AuthLifecycle() {
  useEffect(() => {
    applyCurrentUserTheme();
    return initAuthActivityTracking();
  }, []);

  return null;
}

const LAST_SEEN_CRAWL_FINISHED_KEY = "hometax-last-seen-crawl-finished-at";

function CrawlDesktopNotification() {
  const initializedRef = useRef(false);
  const lastFinishedAtRef = useRef<string | null>(null);

  useEffect(() => {
    const showDesktopNotification = async (inserted: number) => {
      const title = "홈택스 신규 자료 수집 완료";
      const body = `새로운 전자신고 자료 ${inserted}건이 등록되었습니다.`;

      if (!("Notification" in window)) {
        toast.success(body);
        return;
      }

      const showNotification = () => {
        const notification = new Notification(title, {
          body,
          icon: "/favicons/favicon-blue.svg",
        });

        notification.onclick = () => {
          window.focus();
          window.location.href = "/hometax";
        };
      };

      if (Notification.permission === "granted") {
        showNotification();
        return;
      }

      if (Notification.permission === "default") {
        const permission = await Notification.requestPermission();

        if (permission === "granted") {
          showNotification();
          return;
        }
      }

      toast.success(body);
    };

    const checkCrawlStatus = async () => {
      try {
        const response = await fetch("/api/crawl-status", {
          cache: "no-store",
        });

        const result = await response.json();

        if (!result?.ok) return;
        if (result.running) return;
        if (!result.finishedAt) return;

        const finishedAt = String(result.finishedAt);
        const inserted = Number(result.inserted || 0);

        if (!initializedRef.current) {
          initializedRef.current = true;
          lastFinishedAtRef.current = finishedAt;
          localStorage.setItem(LAST_SEEN_CRAWL_FINISHED_KEY, finishedAt);
          return;
        }

        const lastSeen =
          lastFinishedAtRef.current ||
          localStorage.getItem(LAST_SEEN_CRAWL_FINISHED_KEY);

        if (lastSeen === finishedAt) return;

        lastFinishedAtRef.current = finishedAt;
        localStorage.setItem(LAST_SEEN_CRAWL_FINISHED_KEY, finishedAt);

        if (inserted > 0) {
          showDesktopNotification(inserted);
        }
      } catch (error) {
        console.error("수집 상태 확인 실패", error);
      }
    };

    checkCrawlStatus();

    const timer = window.setInterval(checkCrawlStatus, 60 * 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  return null;
}

function ProtectedPage({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState(() => getCurrentUser());

  useEffect(() => {
    const syncUser = () => {
      setUser(getCurrentUser());
    };

    window.addEventListener("hometax-auth-changed", syncUser);

    if (!getCurrentUser()) {
      requireLogin();
    }

    return () => {
      window.removeEventListener("hometax-auth-changed", syncUser);
    };
  }, []);

  if (!user) {
    return (
      <div className="container py-24 text-center">
        <p className="text-sm text-muted-foreground">
          로그인 후 이용할 수 있습니다.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

function Router() {
  return (
    <div className="min-h-screen bg-background overflow-x-auto">
      <div className="w-full min-w-[1200px] min-h-screen flex flex-col">
        <NavBar />

        <main className="flex-1 w-full">
          <Switch>
            <Route path="/" component={Home} />

            <Route path="/hometax">
              <ProtectedPage>
                <HometaxNotices />
              </ProtectedPage>
            </Route>

            <Route path="/manual">
              <ProtectedPage>
                <ManualFiles />
              </ProtectedPage>
            </Route>

            <Route path="/account-admin">
              <ProtectedPage>
                <AccountAdmin />
              </ProtectedPage>
            </Route>

            <Route path="/404" component={NotFound} />
            <Route component={NotFound} />
          </Switch>
        </main>
      </div>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <AuthLifecycle />
          <CrawlDesktopNotification />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
