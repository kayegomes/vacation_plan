import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FileSpreadsheet } from "lucide-react";
import { Route, Switch } from "wouter";
import DashboardLayout from "./components/DashboardLayout";
import AccessPage from "./pages/AccessPage";
import RestrictionsPage from "./pages/RestrictionsPage";
import CalendarPage from "./pages/CalendarPage";
import AlertsPage from "./pages/AlertsPage";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import FeaturePlaceholder from "./pages/FeaturePlaceholder";
import Home from "./pages/Home";
import ImportPage from "./pages/ImportPage";
import NotFound from "./pages/NotFound";
import PlanningPage from "./pages/PlanningPage";
import TeamPage from "./pages/TeamPage";
import EmailNotificationsPage from "./pages/EmailNotificationsPage";
import ReconciliationPage from "./pages/ReconciliationPage";
import GuidePage from "./pages/GuidePage";
import InternalLoginPage from "./pages/InternalLoginPage";
import ActivateInternalAccountPage from "./pages/ActivateInternalAccountPage";
import PasswordResetRequestPage from "./pages/PasswordResetRequestPage";
import AccountSecurityPage from "./pages/AccountSecurityPage";

function Router() {
  return (
    <Switch>
      <Route path="/entrar" component={InternalLoginPage} />
      <Route path="/ativar-conta" component={ActivateInternalAccountPage} />
      <Route path="/redefinir-senha" component={PasswordResetRequestPage} />
      <Route path="/minha-conta" component={AccountSecurityPage} />
      <Route>
      <DashboardLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/planejamento" component={PlanningPage} />
        <Route path="/calendario" component={CalendarPage} />
        <Route path="/equipe" component={TeamPage} />
        <Route path="/acessos" component={AccessPage} />
        <Route path="/restricoes" component={RestrictionsPage} />
        <Route path="/alertas" component={AlertsPage} />
        <Route path="/notificacoes-email" component={EmailNotificationsPage} />
        <Route path="/reconciliacao" component={ReconciliationPage} />
        <Route path="/guia" component={GuidePage} />
        <Route path="/importacao" component={ImportPage} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
      </DashboardLayout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
