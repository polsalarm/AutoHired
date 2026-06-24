import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { TopAppBar } from "./components/TopAppBar";
import { BottomNavBar } from "./components/BottomNavBar";
import { DemoBanner, Loading } from "./components/states";
import { PWAStatus } from "./components/PWAStatus";
import { HomePage } from "./pages/HomePage";
import { TasksPage } from "./pages/TasksPage";
import { VaultPage } from "./pages/VaultPage";
import { SchedulePage } from "./pages/SchedulePage";
import { ProfilePage } from "./pages/ProfilePage";
import { ApplicationDetailPage } from "./pages/ApplicationDetailPage";
import { NewApplicationPage } from "./pages/NewApplicationPage";
import { LoginPage } from "./pages/LoginPage";

function Shell() {
  const { pathname } = useLocation();
  const { demoMode } = useAuth();
  // Detail + new-application screens render their own back-button header
  const showTopBar =
    !pathname.startsWith("/applications/") && pathname !== "/applications/new";

  return (
    <div className="min-h-screen pb-20 pt-safe">
      <PWAStatus />
      {demoMode && <DemoBanner />}
      {showTopBar && <TopAppBar />}
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/vault" element={<VaultPage />} />
        <Route path="/schedule" element={<SchedulePage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/applications/new" element={<NewApplicationPage />} />
        <Route path="/applications/:id" element={<ApplicationDetailPage />} />
      </Routes>
      <BottomNavBar />
    </div>
  );
}

function Gate() {
  const { loading, user, demoMode } = useAuth();
  if (loading) return <Loading label="Starting AutoHired…" />;
  // Demo mode (no Supabase) skips the auth gate so the UI is explorable.
  if (!user && !demoMode) return <LoginPage />;
  return <Shell />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Gate />
      </BrowserRouter>
    </AuthProvider>
  );
}
