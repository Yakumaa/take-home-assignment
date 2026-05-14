/**
 * components/ScoreForm.jsx
 * Form to submit a score (category + 1-5 + optional note).
 * Calls onSuccess() after a successful submission.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label, Textarea, Select } from "@/components/ui/primitives";
import { Spinner } from "@/components/StatusBadge";
import { submitScore } from "@/api/client";

const CATEGORIES = [
  "Technical",
  "Communication",
  "Problem Solving",
  "Culture Fit",
  "Leadership",
  "Domain Knowledge",
];

export function ScoreForm({ candidateId, onSuccess }) {
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [score, setScore] = useState("3");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await submitScore(candidateId, {
        category,
        score: Number(score),
        note: note.trim() || null,
      });
      setNote("");
      setScore("3");
      onSuccess?.();
    } catch (err) {
      setError(err.response?.data?.detail ?? "Failed to submit score.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Category */}
      <div className="space-y-1.5">
        <Label htmlFor="category">Category</Label>
        <Select
          id="category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>
      </div>

      {/* Score 1-5 */}
      <div className="space-y-1.5">
        <Label htmlFor="score">
          Score — <span className="font-normal text-muted-foreground">{score} / 5</span>
        </Label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setScore(String(n))}
              className={`h-9 w-9 rounded-md border text-sm font-medium transition-colors ${
                String(n) === score
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background hover:bg-accent"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Note */}
      <div className="space-y-1.5">
        <Label htmlFor="note">Note <span className="text-muted-foreground font-normal">(optional)</span></Label>
        <Textarea
          id="note"
          placeholder="Add context for this score…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
        />
      </div>

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      <Button type="submit" size="sm" disabled={loading} className="w-full">
        {loading ? <><Spinner size={14} /> Submitting…</> : "Submit Score"}
      </Button>
    </form>
  );
}