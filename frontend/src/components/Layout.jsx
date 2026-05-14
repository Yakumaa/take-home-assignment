/**
 * components/Layout.jsx
 * Top navigation bar + page shell. Shown on all authenticated pages.
 */
import { Link, useNavigate } from "react-router-dom";
import { LogOut, Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";

export function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ── Top nav ── */}
      <header className="sticky top-0 z-10 border-b bg-background">
        <div className="mx-auto flex h-12 max-w-7xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Users size={16} className="text-muted-foreground" />
            TechKraft Recruitment
          </Link>

          <div className="flex items-center gap-3">
            {user && (
              <>
                <span className="hidden text-xs text-muted-foreground sm:block">
                  {user.role === "admin" ? "Admin" : "Reviewer"}
                </span>
                <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                  {user.role}
                </Badge>
              </>
            )}
            <Button variant="ghost" size="sm" onClick={handleLogout} className="h-8 gap-1.5 text-xs">
              <LogOut size={13} />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      {/* ── Page content ── */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {children}
      </main>
    </div>
  );
}