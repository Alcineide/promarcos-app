import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import ClientForm from "./pages/client-form";
import Veiculos from "./pages/veiculos";
import PesquisaCpf from "./pages/pesquisa-cpf";
import AdminUsuarios from "./pages/admin-usuarios";
import AdminAuditoria from "./pages/admin-auditoria";
import AdminLuana2026 from "./pages/admin-luana2026";
import LoginPage from "./pages/login";
import { Redirect } from "wouter";
import { AuthProvider, useAuth } from "./lib/auth-context";
import { SyncQueueProvider } from "./lib/sync-context";
import { OfflineBanner } from "./components/OfflineBanner";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoutes() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#1c3654]">
        <div className="w-10 h-10 border-4 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const { isAdmin } = useAuth();

  return (
    <Switch>
      <Route path="/">{() => <Redirect to="/novo" />}</Route>
      <Route path="/novo" component={ClientForm} />
      <Route path="/cliente/:id" component={ClientForm} />
      <Route path="/veiculos" component={Veiculos} />
      <Route path="/pesquisa-cpf" component={PesquisaCpf} />
      {isAdmin && <Route path="/admin/usuarios" component={AdminUsuarios} />}
      {isAdmin && <Route path="/admin/auditoria" component={AdminAuditoria} />}
      {isAdmin && <Route path="/admin/luana2026" component={AdminLuana2026} />}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <SyncQueueProvider>
            <OfflineBanner />
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <ProtectedRoutes />
            </WouterRouter>
            <Toaster />
          </SyncQueueProvider>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
