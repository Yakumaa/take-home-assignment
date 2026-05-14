/**
 * pages/CandidateDetailPage.jsx
 *
 * RBAC rules enforced in this component:
 *  - internal_notes panel: rendered only for admin (DOM-absent for reviewer)
 *  - Scores section: admin sees all scores; reviewer sees only their own
 *    (the backend already filters — we just label it correctly)
 *
 * AI Summary:
 *  - Button triggers generateSummary() which takes ~2s (asyncio.sleep(2))
 *  - isSummaryLoading state shows a spinner + "Generating…" text
 *  - NEVER leaves the page blank — the section is always rendered with an
 *    explicit loading, error, empty, or content state.
 *
 * Design: Premium high-density internal tool (Linear / Vercel aesthetic).
 *  - Asymmetric 2-column grid: flexible left info column + fixed 340px sidebar
 *  - Standalone page header (no card wrapping) for strong visual hierarchy
 *  - AI Summary card: violet-tinted border + background = "AI-generated" signal
 *  - Internal Notes card: amber-tinted = "confidential/sensitive" signal
 *  - No <hr> elements — separation is handled by card boundaries + divide-y
 */
import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Sparkles,
  Star,
  FileText,
  ShieldAlert,
  RefreshCw,
  Lock,
  Calendar,
  Mail,
  Briefcase,
  BarChart2,
  Archive,
} from "lucide-react";
import { getCandidate, generateSummary, updateCandidate, deleteCandidate } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { Layout } from "@/components/Layout";
import { StatusBadge } from "@/components/StatusBadge";
import { Spinner } from "@/components/StatusBadge";
import { ScoreForm } from "@/components/ScoreForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, Label, Textarea, Select } from "@/components/ui/primitives";

// ── Score colour map (unchanged from original) ────────────────────────────────
const SCORE_BAR_COLORS = {
  1: "bg-red-400",
  2: "bg-orange-400",
  3: "bg-amber-400",
  4: "bg-lime-500",
  5: "bg-emerald-500",
};

const SCORE_TEXT_COLORS = {
  1: "text-red-600",
  2: "text-orange-500",
  3: "text-amber-500",
  4: "text-lime-600",
  5: "text-emerald-600",
};

const SCORE_BG_COLORS = {
  1: "bg-red-50 border-red-200",
  2: "bg-orange-50 border-orange-200",
  3: "bg-amber-50 border-amber-200",
  4: "bg-lime-50 border-lime-200",
  5: "bg-emerald-50 border-emerald-200",
};

/** Horizontal progress bar + numeric value chip side by side. */
function ScoreBar({ value }) {
  const pct = (value / 5) * 100;
  const roundedVal = Math.round(value);
  const barColor = SCORE_BAR_COLORS[roundedVal] ?? "bg-muted";
  const textColor = SCORE_TEXT_COLORS[roundedVal] ?? "text-muted-foreground";
  const chipColor = SCORE_BG_COLORS[roundedVal] ?? "bg-muted border-border";

  return (
    <div className="flex items-center gap-2.5">
      {/* Coloured score chip */}
      <span
        className={`inline-flex h-6 w-6 items-center justify-center rounded-md border text-[11px] font-bold tabular-nums ${chipColor} ${textColor}`}
      >
        {value}
      </span>
      {/* Progress bar */}
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${barColor} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/** Micro section label — uppercase, wide-tracked, muted. Used throughout. */
function SectionLabel({ children }) {
  return (
    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
      {children}
    </p>
  );
}

/** Single stat block for the profile stats grid. */
function StatCell({ icon: Icon, label, value }) {
  return (
    <div className="flex flex-col gap-0.5">
      <SectionLabel>{label}</SectionLabel>
      <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
        {Icon && <Icon size={13} className="shrink-0 text-muted-foreground" />}
        <span>{value}</span>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CandidateDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  // ── Page data state ───────────────────────────────────────────────────────
  const [candidate, setCandidate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ── AI summary state ──────────────────────────────────────────────────────
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState("");

  // ── Internal notes edit state (admin only) ────────────────────────────────
  const [notes, setNotes] = useState("");
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  // ── Status edit ───────────────────────────────────────────────────────────
  const [statusValue, setStatusValue] = useState("");
  const [isSavingStatus, setIsSavingStatus] = useState(false);

  const fetchCandidate = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await getCandidate(id);
      setCandidate(res.data);
      setNotes(res.data.internal_notes ?? "");
      setStatusValue(res.data.status);
    } catch (err) {
      setError(
        err.response?.status === 404
          ? "Candidate not found."
          : "Failed to load candidate."
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCandidate();
  }, [fetchCandidate]);

  // ── Handlers (all preserved unchanged) ───────────────────────────────────

  async function handleGenerateSummary() {
    setIsSummaryLoading(true);
    setSummaryError("");
    try {
      const res = await generateSummary(id);
      setCandidate((prev) => ({ ...prev, ai_summary: res.data.ai_summary }));
    } catch {
      setSummaryError("Failed to generate summary. Please try again.");
    } finally {
      setIsSummaryLoading(false);
    }
  }

  async function handleSaveNotes() {
    setIsSavingNotes(true);
    try {
      await updateCandidate(id, { internal_notes: notes });
    } finally {
      setIsSavingNotes(false);
    }
  }

  async function handleStatusChange(newStatus) {
    setStatusValue(newStatus);
    setIsSavingStatus(true);
    try {
      const res = await updateCandidate(id, { status: newStatus });
      setCandidate((prev) => ({ ...prev, status: res.data.status }));
    } finally {
      setIsSavingStatus(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Archive this candidate? This action can be reversed by an admin.")) return;
    try {
      await deleteCandidate(id);
      navigate("/");
    } catch {
      alert("Failed to archive candidate.");
    }
  }

  // ── Render: loading / error states ───────────────────────────────────────

  if (loading) {
    return (
      <Layout>
        <div className="flex h-64 items-center justify-center gap-2 text-muted-foreground text-sm">
          <Spinner size={18} /> Loading candidate…
        </div>
      </Layout>
    );
  }

  if (error || !candidate) {
    return (
      <Layout>
        <div className="flex h-64 flex-col items-center justify-center gap-3">
          <p className="text-sm text-destructive">{error || "Candidate not found."}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/")}
            className="gap-1.5"
          >
            <ArrowLeft size={13} /> Back to list
          </Button>
        </div>
      </Layout>
    );
  }

  // ── Derived values ────────────────────────────────────────────────────────

  const avgScore =
    candidate.scores.length > 0
      ? (
          candidate.scores.reduce((s, r) => s + r.score, 0) /
          candidate.scores.length
        ).toFixed(1)
      : null;

  const formattedDate = new Date(candidate.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <Layout>
      {/*
        Subtle page background wrapper. bg-slate-50 provides contrast so white
        cards "lift" off the page. Negative margin bleeds behind Layout's padding
        — adjust -mx / -mt values to match Layout's actual padding if needed.
      */}
      <div className="min-h-screen bg-slate-50 -mx-4 px-4 pb-12 pt-6 md:-mx-6 md:px-6">

        {/* ── Page header ─────────────────────────────────────────────────────
            Standalone — NOT inside a card. Creates clear visual hierarchy.
        ────────────────────────────────────────────────────────────────────── */}
        <div className="mb-6">
          {/* Back breadcrumb */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="-ml-2 mb-3 h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft size={13} />
            Candidates
          </Button>

          {/* Name + status row */}
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              {candidate.name}
            </h1>
            <StatusBadge status={candidate.status} />
            {avgScore && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
                <Star size={11} className="fill-amber-400 text-amber-400" />
                {avgScore} / 5
              </span>
            )}
          </div>

          {/* Subheading: email · role · date */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Mail size={11} />
              {candidate.email}
            </span>
            <span className="text-slate-300">·</span>
            <span className="flex items-center gap-1">
              <Briefcase size={11} />
              {candidate.role_applied}
            </span>
            <span className="text-slate-300">·</span>
            <span className="flex items-center gap-1">
              <Calendar size={11} />
              Added {formattedDate}
            </span>
          </div>
        </div>

        {/* ── Asymmetric 2-column grid ─────────────────────────────────────── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">

          {/* ══════════════ LEFT COLUMN ══════════════ */}
          <div className="space-y-4">

            {/* ── Card 1: Profile details ───────────────────────────────────── */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-100 pb-3 pt-4 px-5">
                <CardTitle className="text-sm font-semibold text-foreground">
                  Profile
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5 px-5 py-4">

                {/* Stats grid: role | scores | added */}
                <div className="grid grid-cols-3 gap-4 rounded-lg border border-slate-100 bg-slate-50 p-4">
                  <StatCell
                    icon={Briefcase}
                    label="Role applied"
                    value={candidate.role_applied}
                  />
                  <StatCell
                    icon={BarChart2}
                    label="Scores submitted"
                    value={candidate.scores.length === 0
                      ? "None yet"
                      : `${candidate.scores.length} score${candidate.scores.length > 1 ? "s" : ""}`
                    }
                  />
                  <StatCell
                    icon={Calendar}
                    label="Added"
                    value={formattedDate}
                  />
                </div>

                {/* Skills pills */}
                {candidate.skills.length > 0 && (
                  <div className="space-y-2">
                    <SectionLabel>Skills</SectionLabel>
                    <div className="flex flex-wrap gap-1.5">
                      {candidate.skills.map((skill) => (
                        <span
                          key={skill}
                          className="inline-flex items-center rounded-md border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Status editor — admin or reviewer can change status */}
                <div className="space-y-2">
                  <SectionLabel>Update status</SectionLabel>
                  <div className="flex items-center gap-2">
                    <Select
                      value={statusValue}
                      onChange={(e) => handleStatusChange(e.target.value)}
                      className="h-8 max-w-[180px] text-xs capitalize"
                      disabled={isSavingStatus}
                    >
                      {["new", "reviewed", "hired", "rejected"].map((s) => (
                        <option key={s} value={s} className="capitalize">
                          {s}
                        </option>
                      ))}
                    </Select>
                    {isSavingStatus && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Spinner size={12} /> Saving…
                      </span>
                    )}
                  </div>
                </div>

                {/* Admin: archive (soft delete) */}
                {isAdmin && (
                  <div className="border-t border-slate-100 pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDelete}
                      className="gap-1.5 text-xs text-destructive border-destructive/25 hover:bg-destructive/5 hover:border-destructive/40"
                    >
                      <Archive size={12} />
                      Archive candidate
                    </Button>
                    <p className="mt-1.5 text-[10px] text-muted-foreground">
                      Sets status to archived. Reversible by an admin.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* ── Card 2: AI Summary ────────────────────────────────────────────
                CRITICAL: This card is ALWAYS rendered. Every state (loading,
                error, empty, content) has explicit UI — never a blank section.
                Distinct violet tint signals "AI-generated" content.
            ──────────────────────────────────────────────────────────────────── */}
            <Card className="border-violet-200 bg-violet-50/40 shadow-sm">
              <CardHeader className="border-b border-violet-100 pb-3 pt-4 px-5">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold text-violet-900">
                    <Sparkles size={14} className="text-violet-500" />
                    AI Summary
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleGenerateSummary}
                    disabled={isSummaryLoading}
                    className="h-7 gap-1.5 border-violet-200 bg-white text-xs text-violet-700 hover:bg-violet-50 hover:border-violet-300 disabled:opacity-60"
                  >
                    {isSummaryLoading ? (
                      <>
                        <Spinner size={12} />
                        Generating…
                      </>
                    ) : candidate.ai_summary ? (
                      <>
                        <RefreshCw size={12} />
                        Regenerate
                      </>
                    ) : (
                      <>
                        <Sparkles size={12} />
                        Generate summary
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="px-5 py-4">

                {/* State 1: Loading — explicit, never blank */}
                {isSummaryLoading && (
                  <div className="flex items-start gap-3 rounded-lg border border-violet-200 bg-white/70 px-4 py-3">
                    <Spinner size={15} className="mt-0.5 shrink-0 text-violet-500" />
                    <div>
                      <p className="text-sm font-medium text-violet-900">
                        Generating summary…
                      </p>
                      <p className="text-xs text-violet-500 mt-0.5">
                        The AI reviewer is analysing this candidate. This takes a few seconds.
                      </p>
                    </div>
                  </div>
                )}

                {/* State 2: Error */}
                {!isSummaryLoading && summaryError && (
                  <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    {summaryError}
                  </p>
                )}

                {/* State 3: Content */}
                {!isSummaryLoading && !summaryError && candidate.ai_summary && (
                  <p className="text-sm leading-relaxed text-foreground">
                    {candidate.ai_summary}
                  </p>
                )}

                {/* State 4: Empty */}
                {!isSummaryLoading && !summaryError && !candidate.ai_summary && (
                  <p className="text-sm text-violet-400 italic">
                    No summary yet — click "Generate summary" to analyse this candidate.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* ── Card 3: Score History ─────────────────────────────────────── */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-100 pb-3 pt-4 px-5">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Star size={14} className="text-amber-400" />
                    {isAdmin ? "All reviewer scores" : "Your scores"}
                  </CardTitle>
                  {candidate.scores.length > 0 && (
                    <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-slate-100 px-1.5 text-[11px] font-semibold text-slate-600">
                      {candidate.scores.length}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="px-5 py-0">
                {candidate.scores.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                    <BarChart2 size={22} className="text-slate-300" />
                    <p className="text-sm text-muted-foreground">
                      {isAdmin
                        ? "No scores have been submitted yet."
                        : "You haven't scored this candidate yet."}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {candidate.scores.map((score) => (
                      <div key={score.id} className="flex items-start justify-between gap-3 py-3.5">
                        <div className="min-w-0 flex-1 space-y-0.5">
                          {/* Category + reviewer (admin only) */}
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-medium text-foreground">
                              {score.category}
                            </p>
                            {isAdmin && (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                                Reviewer #{score.reviewer_id}
                              </span>
                            )}
                          </div>
                          {/* Optional note */}
                          {score.note && (
                            <p className="text-xs text-muted-foreground leading-snug">
                              {score.note}
                            </p>
                          )}
                          {/* Date */}
                          <p className="text-[10px] text-slate-400">
                            {new Date(score.created_at).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                        {/* Score bar — logic unchanged */}
                        <div className="shrink-0 pt-0.5">
                          <ScoreBar value={score.score} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

          </div>
          {/* ══════════════ END LEFT COLUMN ══════════════ */}


          {/* ══════════════ RIGHT COLUMN (sidebar) ══════════════ */}
          <div className="space-y-4">

            {/* ── Card 1: Submit a score ────────────────────────────────────── */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="border-b border-slate-100 pb-3 pt-4 px-5">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <FileText size={14} className="text-slate-500" />
                  Submit a score
                </CardTitle>
              </CardHeader>
              <CardContent className="px-5 py-4">
                {/* ScoreForm is unchanged — it owns its own state + API call */}
                <ScoreForm candidateId={id} onSuccess={fetchCandidate} />
              </CardContent>
            </Card>

            {/* ── Card 2: Internal Notes (admin only) ──────────────────────────
                RBAC: this entire block is absent from the DOM for reviewer role.
                We do NOT render it as hidden/invisible — it does not exist.
                Amber tint visually signals "confidential / sensitive" content.
            ──────────────────────────────────────────────────────────────────── */}
            {isAdmin && (
              <Card className="border-amber-200 bg-amber-50/50 shadow-sm">
                <CardHeader className="border-b border-amber-100 pb-3 pt-4 px-5">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                      <Lock size={13} className="text-amber-600" />
                      Internal notes
                    </CardTitle>
                    {/* Confidential badge */}
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                      <ShieldAlert size={9} />
                      Confidential
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-amber-700/70">
                    Visible to admins only. Not shared with reviewers.
                  </p>
                </CardHeader>
                <CardContent className="space-y-3 px-5 py-4">
                  <Textarea
                    placeholder="Add confidential notes about this candidate…"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={6}
                    className="border-amber-200 bg-white/80 text-sm placeholder:text-amber-300 focus:border-amber-400 focus:ring-amber-200"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSaveNotes}
                    disabled={isSavingNotes}
                    className="w-full gap-1.5 border-amber-300 bg-white text-xs text-amber-800 hover:bg-amber-50"
                  >
                    {isSavingNotes ? (
                      <>
                        <Spinner size={12} /> Saving…
                      </>
                    ) : (
                      "Save notes"
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}

          </div>
          {/* ══════════════ END RIGHT COLUMN ══════════════ */}

        </div>
      </div>
    </Layout>
  );
}