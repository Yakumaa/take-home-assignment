import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import { useAuth } from './hooks/useAuth';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { CandidateListPage } from './pages/CandidateListPage';
import { CandidateDetailPage } from './pages/CandidateDetailPage';

// Protected Route Component
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ width: '2rem', height: '2rem', marginBottom: '1rem' }}></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Layout>{children}</Layout>;
}

// Main App Component
function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      {/* Login Route */}
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to="/candidates" replace /> : <LoginPage />}
      />

      {/* Protected Routes */}
      <Route
        path="/candidates"
        element={
          <ProtectedRoute>
            <CandidateListPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/candidates/:id"
        element={
          <ProtectedRoute>
            <CandidateDetailPage />
          </ProtectedRoute>
        }
      />

      {/* Fallback */}
      <Route path="/" element={<Navigate to="/candidates" replace />} />
      <Route path="*" element={<Navigate to="/candidates" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}
