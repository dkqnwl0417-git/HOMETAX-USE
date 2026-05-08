import { useEffect, useState } from "react";
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
import { getCurrentUser, initAuthActivityTracking, requireLogin } from "@/lib/simpleAuth";

function AuthLifecycle() {
  useEffect(() => {
    return initAuthActivityTracking();
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
    <div className="min-h-screen bg-background flex flex-col">
      <NavBar />
      <main className="flex-1">
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
          <Route path="/404" component={NotFound} />
          <Route component={NotFound} />
        </Switch>
      </main>
    </div>
  );
}

<Route path="/account-admin">
  <ProtectedPage>
    <AccountAdmin />
  </ProtectedPage>
</Route>

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <AuthLifecycle />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
