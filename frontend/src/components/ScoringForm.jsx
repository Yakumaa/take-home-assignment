import React, { useState, useEffect } from 'react';
import { candidatesAPI } from '../api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Slider } from './ui/slider';
import { Loader2 } from 'lucide-react';

const SCORING_CRITERIA = [
  { key: 'technical_skills', label: 'Technical Skills' },
  { key: 'communication', label: 'Communication' },
  { key: 'problem_solving', label: 'Problem Solving' },
  { key: 'culture_fit', label: 'Culture Fit' },
  { key: 'experience', label: 'Experience' },
];

export function ScoringForm({ candidateId, onSubmitSuccess }) {
  const [scores, setScores] = useState({
    technical_skills: 0,
    communication: 0,
    problem_solving: 0,
    culture_fit: 0,
    experience: 0,
    overall_score: 0,
    comments: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Calculate overall score as average of criteria
  useEffect(() => {
    const criteriaScores = SCORING_CRITERIA.map((c) => scores[c.key] || 0);
    const avg = criteriaScores.reduce((a, b) => a + b, 0) / criteriaScores.length;
    setScores((prev) => ({
      ...prev,
      overall_score: Math.round(avg * 10) / 10,
    }));
  }, [
    scores.technical_skills,
    scores.communication,
    scores.problem_solving,
    scores.culture_fit,
    scores.experience,
  ]);

  const handleCriteriaChange = (key, value) => {
    const numValue = Math.min(10, Math.max(0, parseFloat(value) || 0));
    setScores((prev) => ({
      ...prev,
      [key]: numValue,
    }));
  };

  const handleCommentsChange = (value) => {
    setScores((prev) => ({
      ...prev,
      comments: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await candidatesAPI.submitScore(candidateId, scores);
      setSuccess('Score submitted successfully!');

      // Reset form or call callback
      if (onSubmitSuccess) {
        onSubmitSuccess();
      }

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Failed to submit score.';
      setError(errorMsg);
      console.error('Error submitting score:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scoring Form</CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            <strong>Error:</strong> {error}
          </div>
        )}

        {success && (
          <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">
            <strong>Success!</strong> {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Scoring Criteria */}
          <div className="space-y-4">
            {SCORING_CRITERIA.map((criterion) => (
              <div key={criterion.key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">{criterion.label}</label>
                  <span className="text-sm font-semibold text-primary">
                    {scores[criterion.key].toFixed(1)}/10
                  </span>
                </div>
                <Slider
                  min={0}
                  max={10}
                  step={0.5}
                  value={[scores[criterion.key]]}
                  onValueChange={(value) => handleCriteriaChange(criterion.key, value[0])}
                  disabled={loading}
                  className="w-full"
                />
              </div>
            ))}
          </div>

          {/* Overall Score Display */}
          <div className="rounded-md bg-muted/50 p-4">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-medium text-muted-foreground">Overall Score:</span>
              <span className="text-3xl font-bold text-primary">
                {scores.overall_score.toFixed(1)}
              </span>
              <span className="text-sm text-muted-foreground">/10</span>
            </div>
          </div>

          {/* Comments */}
          <div className="space-y-2">
            <label htmlFor="comments" className="text-sm font-medium">
              Comments (Optional)
            </label>
            <textarea
              id="comments"
              value={scores.comments}
              onChange={(e) => handleCommentsChange(e.target.value)}
              placeholder="Add any additional notes about this candidate..."
              disabled={loading}
              rows={4}
              className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          {/* Submit Button */}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Scores'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
