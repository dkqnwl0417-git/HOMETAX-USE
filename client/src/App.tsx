import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import HometaxNotices from "./pages/HometaxNotices";
import ManualFiles from "./pages/ManualFiles";
import NavBar from "./components/NavBar";
import { initAuthActivityTracking } from "@/lib/simpleAuth";

function AuthLifecycle() {
  useEffect(() => {
    return initAuthActivityTracking();
  }, []);

  return null;
}

function Router() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <NavBar />
      <main className="flex-1">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/hometax" component={HometaxNotices} />
          <Route path="/manual" component={ManualFiles} />
          <Route path="/404" component={NotFound} />
          <Route component={NotFound} />
        </Switch>
      </main>
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
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
