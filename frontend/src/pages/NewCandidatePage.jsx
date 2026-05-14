/**
 * pages/NewCandidatePage.jsx
 *
 * Admin-only form to add a new candidate to the system.
 *
 * Fields: name, email, role_applied, skills (comma-separated → string[])
 *
 * Skills input UX: the user types "React, Node.js, Python" and we parse
 * it into ["React", "Node.js", "Python"] before sending to the API.
 * We also render a live tag preview so the user can see how the array
 * will look before submitting.
 *
 * On success: redirect to / (Candidate List).
 * On error: surface the API message inline.
 *
 * Design: Premium high-density internal tool (Linear / Vercel aesthetic).
 *  - Wrapped in Layout component for consistent navbar
 *  - Refined form styling with consistent input borders
 *  - Micro section labels for visual hierarchy
 */
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { createCandidate } from "@/api/client";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/primitives";
import { Textarea } from "@/components/ui/input";
import { Spinner } from "@/components/StatusBadge";

// Common roles — keeps the field consistent without being restrictive
const ROLE_SUGGESTIONS = [
  "Full Stack Engineer",
  "Frontend Engineer",
  "Backend Engineer",
  "DevOps Engineer",
  "Product Manager",
  "Data Scientist",
  "QA Engineer",
  "Design Engineer",
];

/** Micro section label — uppercase, wide-tracked, muted. */
function SectionLabel({ children }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </p>
  );
}

/**
 * Parse a raw comma-separated skills string into a clean string array.
 * "  React , Node.js,  , Python " → ["React", "Node.js", "Python"]
 */
function parseSkills(raw) {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function NewCandidatePage() {
  const navigate = useNavigate();

  // ── Form state ─────────────────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [roleApplied, setRoleApplied] = useState("");
  const [skillsRaw, setSkillsRaw] = useState(""); // raw comma-separated input

  // ── UI state ───────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Derived — live parse for tag preview
  const skillTags = parseSkills(skillsRaw);

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (skillTags.length === 0) {
      setError("Please enter at least one skill.");
      return;
    }

    setLoading(true);
    try {
      await createCandidate({
        name: name.trim(),
        email: email.trim(),
        role_applied: roleApplied.trim(),
        skills: skillTags, // array, not the raw string
      });
      // Success → back to list
      navigate("/", { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.detail ??
          "Failed to create candidate. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Layout>
      <div className="mx-auto max-w-2xl">

        {/* Page header — standalone for strong visual hierarchy */}
        <div className="mb-6">
          <div className="mb-4">
            <Link 
              to="/" 
              className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back to candidates
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Add candidate</h1>
          <SectionLabel className="mt-2">
            New candidates are created with status <span className="text-foreground font-medium">new</span> and can be scored immediately.
          </SectionLabel>
        </div>

        {/* Form card — refined styling */}
        <div className="rounded-lg border border-slate-200 bg-card p-6">
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-sm font-medium">Full name</Label>
              <Input
                id="name"
                type="text"
                placeholder="Jane Smith"
                autoComplete="name"
                className="border-slate-200 focus-visible:ring-indigo-500/20"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="jane@example.com"
                autoComplete="off"
                className="border-slate-200 focus-visible:ring-indigo-500/20"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {/* Role applied — free-text with datalist suggestions */}
            <div className="space-y-1.5">
              <Label htmlFor="role_applied" className="text-sm font-medium">Role applied for</Label>
              <Input
                id="role_applied"
                type="text"
                placeholder="e.g. Full Stack Engineer"
                list="role-suggestions"
                className="border-slate-200 focus-visible:ring-indigo-500/20"
                value={roleApplied}
                onChange={(e) => setRoleApplied(e.target.value)}
                required
              />
              {/* Native datalist — zero-dependency autocomplete */}
              <datalist id="role-suggestions">
                {ROLE_SUGGESTIONS.map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </div>

            {/* Skills — comma-separated with live tag preview */}
            <div className="space-y-1.5">
              <Label htmlFor="skills" className="text-sm font-medium">
                Skills{" "}
                <span className="font-normal text-muted-foreground">
                  (comma-separated)
                </span>
              </Label>
              <Input
                id="skills"
                type="text"
                placeholder="React, Node.js, PostgreSQL, Docker"
                className="border-slate-200 focus-visible:ring-indigo-500/20"
                value={skillsRaw}
                onChange={(e) => setSkillsRaw(e.target.value)}
                required
              />

              {/* Live tag preview */}
              {skillTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {skillTags.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Error banner */}
            {error && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </p>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
              <Button 
                type="submit" 
                disabled={loading} 
                className="flex-1 bg-black hover:bg-slate-900 text-white"
              >
                {loading ? (
                  <>
                    <Spinner size={15} /> Creating…
                  </>
                ) : (
                  "Create candidate"
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/")}
                disabled={loading}
                className="border-slate-200 hover:bg-slate-50"
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  );
}
