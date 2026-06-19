import { Switch, Route, Router as WouterRouter, Link, useLocation } from "wouter";
import { QueryClient, QueryClientProvider, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import WorkflowsPage from "@/pages/workflows";
import DashboardPage from "@/pages/dashboard";
import SalesPage from "@/pages/sales";
import MarketingPage from "@/pages/marketing";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import ForgotPasswordPage from "@/pages/forgot-password";
import BillingPage from "@/pages/billing";
import SettingsPage from "@/pages/settings";
import OnboardingPage from "@/pages/onboarding";
import MarketplacePage from "@/pages/marketplace";
import LandingHome from "@/pages/landing-home";
import LandingFeatures from "@/pages/landing-features";
import LandingPricing from "@/pages/landing-pricing";
import LandingDemo from "@/pages/landing-demo";
import LandingContact from "@/pages/landing-contact";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api";
import {
  GitMerge, Map, LayoutDashboard, Zap, Megaphone, LogOut, User,
  CreditCard, Settings, Bell, X, Check, Store
} from "lucide-react";
import { useState, useRef, useEffect } from "react";

const queryClient = new QueryClient();

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const { data } = useQuery<{ notifications: Notification[]; unreadCount: number }>({
    queryKey: ["notifications"],
    queryFn: () => apiFetch("/api/notifications?limit=20"),
    refetchInterval: 30000,
  });

  const readMutation = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/notifications/${id}/read`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const readAllMutation = useMutation({
    mutationFn: () => apiFetch("/api/notifications/read-all", { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const unread = data?.unreadCount ?? 0;
  const notifications = data?.notifications ?? [];

  const typeIcon: Record<string, string> = {
    workflow_completed: "✅",
    task_failed: "❌",
    quota_warning: "⚠️",
    system: "ℹ️",
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative flex items-center justify-center w-7 h-7 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
      >
        <Bell className="w-3.5 h-3.5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-amber-500 rounded-full text-[9px] flex items-center justify-center text-black font-bold">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-8 w-80 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <span className="text-sm font-semibold text-white">Thông báo</span>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  onClick={() => readAllMutation.mutate()}
                  className="text-xs text-amber-400 hover:text-amber-300"
                >
                  Đọc tất cả
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-300">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-6 text-center text-slate-500 text-sm">Không có thông báo</div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`px-4 py-3 border-b border-white/5 flex gap-3 ${!n.isRead ? "bg-white/5" : ""}`}
                >
                  <span className="text-base flex-shrink-0 mt-0.5">{typeIcon[n.type] ?? "🔔"}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${!n.isRead ? "text-white font-medium" : "text-slate-300"}`}>{n.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">{n.message}</p>
                    <p className="text-xs text-slate-600 mt-1">{new Date(n.createdAt).toLocaleString("vi-VN")}</p>
                  </div>
                  {!n.isRead && (
                    <button
                      onClick={() => readMutation.mutate(n.id)}
                      className="text-slate-600 hover:text-emerald-400 flex-shrink-0"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AppNav() {
  const [location] = useLocation();
  const { user, organization, logout } = useAuth();

  const links = [
    { href: "/roadmap", label: "Roadmap", Icon: Map },
    { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
    { href: "/workflows", label: "Workflows", Icon: GitMerge },
    { href: "/sales", label: "AI SDR", Icon: Zap },
    { href: "/marketing", label: "Marketing", Icon: Megaphone },
    { href: "/marketplace", label: "Marketplace", Icon: Store },
    { href: "/billing", label: "Billing", Icon: CreditCard },
    { href: "/settings", label: "Settings", Icon: Settings },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center gap-1 px-4 py-2 bg-black/90 border-b border-white/10 backdrop-blur-sm">
      <div className="flex items-center gap-1 flex-1 overflow-x-auto scrollbar-hide">
        {links.map(({ href, label, Icon }) => {
          const active = location === href || location.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                active
                  ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                  : "text-slate-500 hover:text-slate-300 hover:bg-white/5"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </Link>
          );
        })}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {organization && (
          <span className="text-xs text-slate-500 border border-white/10 rounded-md px-2 py-1 hidden sm:block">
            {organization.name}
          </span>
        )}
        {user && (
          <div className="items-center gap-1.5 text-xs text-slate-400 hidden lg:flex">
            <User className="w-3.5 h-3.5" />
            {user.name ?? user.email}
          </div>
        )}
        <NotificationBell />
        <button
          onClick={() => logout()}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
          title="Sign out"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    </nav>
  );
}

function AppRouter() {
  return (
    <Switch>
      {/* Public landing pages — no auth required */}
      <Route path="/" component={LandingHome} />
      <Route path="/features" component={LandingFeatures} />
      <Route path="/pricing" component={LandingPricing} />
      <Route path="/demo" component={LandingDemo} />
      <Route path="/contact" component={LandingContact} />

      {/* Auth pages */}
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/onboarding" component={OnboardingPage} />

      {/* Protected app pages */}
      <Route>
        <ProtectedRoute>
          <AppNav />
          <div className="pt-12">
            <Switch>
              <Route path="/roadmap" component={Home} />
              <Route path="/dashboard" component={DashboardPage} />
              <Route path="/workflows" component={WorkflowsPage} />
              <Route path="/sales" component={SalesPage} />
              <Route path="/marketing" component={MarketingPage} />
              <Route path="/marketplace" component={MarketplacePage} />
              <Route path="/billing" component={BillingPage} />
              <Route path="/settings" component={SettingsPage} />
              <Route component={NotFound} />
            </Switch>
          </div>
        </ProtectedRoute>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <AppRouter />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
