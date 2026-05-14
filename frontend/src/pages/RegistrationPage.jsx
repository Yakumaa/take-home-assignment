/**
 * pages/RegistrationPage.jsx
 *
 * Public registration form. Collects ONLY email + password.
 *
 * SECURITY NOTE: No `role` field exists anywhere in this component —
 * not in state, not in the submission payload. The backend hardcodes
 * role = "reviewer" for every new registration. Accepting role from
 * the client would be a critical security violation.
 *
 * On success: shows a confirmation message then redirects to /login.
 */
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { register } from "@/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/primitives";
import { Spinner } from "@/components/StatusBadge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

export default function RegistrationPage() {
  const navigate = useNavigate();

  // ── Form state ─────────────────────────────────────────────────────────────
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  // ── UI state ───────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    // Client-side confirmation check — keeps UX tight
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);
    try {
      // CRITICAL: Only `email` and `password` are sent.
      // `register()` in api/client.js sends { email, password } — no role.
      await register(email, password);

      setSuccess(true);
      // Give the user a moment to read the success message, then redirect
      setTimeout(() => navigate("/login", { replace: true }), 2000);
    } catch (err) {
      setError(
        err.response?.data?.detail ??
          "Registration failed. The email may already be in use."
      );
    } finally {
      setLoading(false);
    }
  }

  // ── Success state ──────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <div className="rounded-md bg-green-500/10 px-4 py-6 text-sm text-green-700 dark:text-green-400">
            <p className="font-semibold">Account created!</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Redirecting you to sign in…
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm space-y-4">

        {/* Wordmark — matches LoginPage */}
        <div className="text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            TechKraft Inc.
          </p>
          <h1 className="mt-1 text-xl font-semibold">Recruitment Dashboard</h1>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Create an account</CardTitle>
            <CardDescription>
              All new accounts are assigned the{" "}
              <span className="font-medium text-foreground">reviewer</span> role.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Email — only personal data collected */}
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@techkraft.com"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {/* Confirm password — client-side UX guard only */}
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirm password</Label>
                <Input
                  id="confirm"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </div>

              {/* Error banner */}
              {error && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Spinner size={15} /> Creating account…
                  </>
                ) : (
                  "Create account"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Toggle to login */}
        <p className="text-center text-xs text-muted-foreground">
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}