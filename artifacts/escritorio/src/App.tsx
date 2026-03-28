import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import ClientForm from "./pages/client-form";
import Veiculos from "./pages/veiculos";
import PesquisaCpf from "./pages/pesquisa-cpf";
import { Redirect } from "wouter";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/">{() => <Redirect to="/novo" />}</Route>
      <Route path="/novo" component={ClientForm} />
      <Route path="/cliente/:id" component={ClientForm} />
      <Route path="/veiculos" component={Veiculos} />
      <Route path="/pesquisa-cpf" component={PesquisaCpf} />
      <Route component={NotFound} />
    </Switch>
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
