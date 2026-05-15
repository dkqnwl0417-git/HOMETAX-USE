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
import { trpc } from "@/lib/trpc";
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

const LAST_NOTIFIED_CRAWL_KEY = "hometax-last-notified-crawl-at";

function CrawlDesktopNotification() {
  const initializedRef = useRef(false);
  const lastSeenCrawlRef = useRef<string | null>(null);

  const { data } = trpc.hometax.lastCrawl.useQuery(undefined, {
    refetchInterval: 60 * 1000,
    refetchIntervalInBackground: true,
  });

  useEffect(() => {
    const crawledAt = data?.crawledAt;

    if (!crawledAt) return;

    const crawlTime = String(crawledAt);

    if (!initializedRef.current) {
      initializedRef.current = true;
      lastSeenCrawlRef.current = crawlTime;
      localStorage.setItem(LAST_NOTIFIED_CRAWL_KEY, crawlTime);
      return;
    }

    if (lastSeenCrawlRef.current === crawlTime) return;

    const alreadyNotified = localStorage.getItem(LAST_NOTIFIED_CRAWL_KEY);

    lastSeenCrawlRef.current = crawlTime;
    localStorage.setItem(LAST_NOTIFIED_CRAWL_KEY, crawlTime);

    if (alreadyNotified === crawlTime) return;

    const title = "홈택스 자동 수집 완료";
    const body = "새로운 전자신고 자료가 수집되었습니다. 목록을 확인해주세요.";

    if (!("Notification" in window)) {
      toast.success(body);
      return;
    }

    if (Notification.permission === "granted") {
      const notification = new Notification(title, {
        body,
        icon: "/favicons/favicon-blue.svg",
      });

      notification.onclick = () => {
        window.focus();
        window.location.href = "/hometax";
      };

      return;
    }

    if (Notification.permission === "default") {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          new Notification(title, {
            body,
            icon: "/favicons/favicon-blue.svg",
          });
        } else {
          toast.success(body);
        }
      });

      return;
    }

    toast.success(body);
  }, [data?.crawledAt]);

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
