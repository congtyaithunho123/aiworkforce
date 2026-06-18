import { Switch, Route, Router as WouterRouter, Link, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import WorkflowsPage from "@/pages/workflows";
import DashboardPage from "@/pages/dashboard";
import SalesPage from "@/pages/sales";
import MarketingPage from "@/pages/marketing";
import { GitMerge, Map, LayoutDashboard, Zap, Megaphone } from "lucide-react";

const queryClient = new QueryClient();

function Nav() {
  const [location] = useLocation();

  const links = [
    { href: "/", label: "Roadmap", Icon: Map },
    { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
    { href: "/workflows", label: "Workflows", Icon: GitMerge },
    { href: "/sales", label: "AI SDR", Icon: Zap },
    { href: "/marketing", label: "AI Marketing", Icon: Megaphone },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center gap-1 px-4 py-2 bg-black/90 border-b border-white/10 backdrop-blur-sm">
      {links.map(({ href, label, Icon }) => {
        const active = href === "/" ? location === "/" : location.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
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
    </nav>
  );
}

function Router() {
  return (
    <>
      <Nav />
      <div className="pt-12">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/dashboard" component={DashboardPage} />
          <Route path="/workflows" component={WorkflowsPage} />
          <Route path="/sales" component={SalesPage} />
          <Route path="/marketing" component={MarketingPage} />
          <Route component={NotFound} />
        </Switch>
      </div>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
