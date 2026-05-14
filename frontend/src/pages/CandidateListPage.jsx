/**
 * pages/CandidateListPage.jsx
 *
 * Features:
 *  - Filter bar: status, role_applied, skill, keyword
 *  - Offset-based pagination (page + page_size, default 20, max 50)
 *  - Click a row → navigate to /candidates/:id
 *  - Admin sees "New Candidate" button
 */
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ChevronLeft, ChevronRight, Plus, RefreshCw } from "lucide-react";
import { listCandidates } from "@/api/client";
import { useAuth } from "@/context/AuthContext";
import { Layout } from "@/components/Layout";
import { StatusBadge } from "@/components/StatusBadge";
import { Spinner } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/primitives";

const PAGE_SIZE = 20;

const STATUS_OPTIONS = ["", "new", "reviewed", "hired", "rejected"];

export default function CandidateListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";

  // ── Filter state ──────────────────────────────────────────────────────────
  const [filters, setFilters] = useState({
    status: "",
    role_applied: "",
    skill: "",
    keyword: "",
  });
  const [debouncedKeyword, setDebouncedKeyword] = useState("");

  // ── Pagination ────────────────────────────────────────────────────────────
  const [page, setPage] = useState(1);

  // ── Data state ────────────────────────────────────────────────────────────
  const [data, setData] = useState(null);   // { total, page, page_size, items }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Debounce keyword input — avoid firing on every keystroke
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedKeyword(filters.keyword);
      setPage(1); // reset to page 1 on new search
    }, 350);
    return () => clearTimeout(timer);
  }, [filters.keyword]);

  // Reset page when any filter (except keyword, handled by debounce) changes
  function handleFilterChange(field, value) {
    setFilters((prev) => ({ ...prev, [field]: value }));
    if (field !== "keyword") setPage(1);
  }

  const fetchCandidates = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {
        page,
        page_size: PAGE_SIZE,
        ...(filters.status && { status: filters.status }),
        ...(filters.role_applied && { role_applied: filters.role_applied }),
        ...(filters.skill && { skill: filters.skill }),
        ...(debouncedKeyword && { keyword: debouncedKeyword }),
      };
      const res = await listCandidates(params);
      setData(res.data);
    } catch {
      setError("Failed to load candidates. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [page, filters.status, filters.role_applied, filters.skill, debouncedKeyword]);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <Layout>
      {/* ── Page header ── */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Candidates</h1>
          {data && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {data.total} total
            </p>
          )}
        </div>
        {isAdmin && (
          <Button size="sm" onClick={() => navigate("/candidates/new")} className="gap-1.5">
            <Plus size={14} /> New Candidate
          </Button>
        )}
      </div>

      {/* ── Filter bar ── */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {/* Keyword search */}
        <div className="relative sm:col-span-2">
          <Search size={14} className="absolute left-2.5 top-2.5 text-muted-foreground" />
          <Input
            placeholder="Search name, email, role…"
            className="pl-8"
            value={filters.keyword}
            onChange={(e) => handleFilterChange("keyword", e.target.value)}
          />
        </div>

        {/* Status filter */}
        <Select
          value={filters.status}
          onChange={(e) => handleFilterChange("status", e.target.value)}
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.filter(Boolean).map((s) => (
            <option key={s} value={s} className="capitalize">{s}</option>
          ))}
        </Select>

        {/* Skill filter */}
        <Input
          placeholder="Filter by skill…"
          value={filters.skill}
          onChange={(e) => handleFilterChange("skill", e.target.value)}
        />
      </div>

      {/* ── Table ── */}
      <div className="rounded-lg border bg-card">
        {loading ? (
          <div className="flex h-48 items-center justify-center gap-2 text-muted-foreground text-sm">
            <Spinner size={18} /> Loading candidates…
          </div>
        ) : error ? (
          <div className="flex h-48 flex-col items-center justify-center gap-3">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchCandidates} className="gap-1.5">
              <RefreshCw size={13} /> Retry
            </Button>
          </div>
        ) : data?.items.length === 0 ? (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            No candidates match your filters.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Name</th>
                <th className="hidden px-4 py-2.5 text-left text-xs font-medium text-muted-foreground sm:table-cell">Role applied</th>
                <th className="hidden px-4 py-2.5 text-left text-xs font-medium text-muted-foreground md:table-cell">Skills</th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Status</th>
                <th className="hidden px-4 py-2.5 text-left text-xs font-medium text-muted-foreground lg:table-cell">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.items.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => navigate(`/candidates/${c.id}`)}
                  className="cursor-pointer transition-colors hover:bg-muted/30"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.email}</p>
                  </td>
                  <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                    {c.role_applied}
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {c.skills.slice(0, 3).map((s) => (
                        <span key={s} className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                          {s}
                        </span>
                      ))}
                      {c.skills.length > 3 && (
                        <span className="text-xs text-muted-foreground">+{c.skills.length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="hidden px-4 py-3 text-xs text-muted-foreground lg:table-cell">
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Pagination ── */}
      {data && totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {page} of {totalPages} — {data.total} candidates
          </p>
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
              className="h-8 gap-1"
            >
              <ChevronLeft size={14} /> Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || loading}
              className="h-8 gap-1"
            >
              Next <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </Layout>
  );
}