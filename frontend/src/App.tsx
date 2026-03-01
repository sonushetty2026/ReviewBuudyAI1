import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import DashboardLayout from "./pages/dashboard/DashboardLayout";
import DashboardHome from "./pages/dashboard/DashboardHome";
import SettingsPage from "./pages/dashboard/SettingsPage";
import ComplaintsPage from "./pages/dashboard/ComplaintsPage";
import WelcomePage from "./pages/flow/WelcomePage";
import SessionPage from "./pages/flow/SessionPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/dashboard" element={<DashboardLayout />}>
        <Route index element={<DashboardHome />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="complaints" element={<ComplaintsPage />} />
      </Route>
      <Route path="/c/:slug" element={<WelcomePage />} />
      <Route path="/c/:slug/session/:sessionId" element={<SessionPage />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
