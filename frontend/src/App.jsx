/**
 * App.jsx — Router + AuthProvider root.
 *
 * Route structure:
 *   /login              → LoginPage          (public)
 *   /register           → RegistrationPage   (public)
 *   /                   → CandidateListPage  (protected: any authenticated user)
 *   /candidates/:id     → CandidateDetailPage(protected: any authenticated user)
 *   /candidates/new     → NewCandidatePage   (admin only — AdminRoute guard)
 *   *                   → redirect to /
 *
 * AdminRoute is defined here (not a separate file) since it's a single
 * Outlet wrapper — same pattern as ProtectedRoute.
 */
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";

import LoginPage from "@/pages/LoginPage";
import RegistrationPage from "@/pages/RegistrationPage";
import CandidateListPage from "@/pages/CandidateListPage";
import CandidateDetailPage from "@/pages/CandidateDetailPage";
import NewCandidatePage from "@/pages/NewCandidatePage";

/**
 * AdminRoute — layout route that sits inside ProtectedRoute.
 *
 * ProtectedRoute already guarantees a valid JWT exists, so here we only
 * need to check the role. Non-admins are silently redirected to the list
 * page rather than shown an error, which avoids leaking that the route
 * exists at all.
 *
 * role values are lowercase strings set by the backend: "admin" | "reviewer"
 */
function AdminRoute() {
  const { user } = useAuth();

  // ProtectedRoute parent already handles the unauthenticated case,
  // but we guard defensively here too.
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin") return <Navigate to="/" replace />;

  return <Outlet />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>

          {/* ── Public routes ──────────────────────────────────────────── */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegistrationPage />} />

          {/* ── Authenticated routes (any valid JWT) ───────────────────── */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<CandidateListPage />} />
            <Route path="/candidates/:id" element={<CandidateDetailPage />} />

            {/* ── Admin-only routes ─────────────────────────────────────── */}
            <Route element={<AdminRoute />}>
              <Route path="/candidates/new" element={<NewCandidatePage />} />
            </Route>
          </Route>

          {/* ── Catch-all → home ───────────────────────────────────────── */}
          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}