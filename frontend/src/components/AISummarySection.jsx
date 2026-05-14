import React, { useState } from 'react';
import { candidatesAPI } from '../api';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Loader2, Sparkles } from 'lucide-react';

export function AISummarySection({ candidateId }) {
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);

  const handleGenerateSummary = async () => {
    setLoading(true);
    setError('');
    setSummary('');
    setExpanded(true);

    try {
      const response = await candidatesAPI.getSummary(candidateId);
      setSummary(response.data.summary || '');
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Failed to generate summary.';
      setError(errorMsg);
      console.error('Error generating summary:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          <CardTitle>AI-Powered Summary</CardTitle>
        </div>
        <Button
          size="sm"
          onClick={handleGenerateSummary}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : summary ? (
            'Regenerate'
          ) : (
            'Generate'
          )}
        </Button>
      </CardHeader>

      {error && (
        <CardContent>
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            <strong>Error:</strong> {error}
          </div>
        </CardContent>
      )}

      {expanded && (
        <CardContent>
          {loading ? (
            <div className="flex flex-col items-center justify-center space-y-3 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium">Analyzing candidate profile...</p>
              <p className="text-xs text-muted-foreground">(Simulated 2-second delay)</p>
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">Failed to generate summary. Please try again.</p>
          ) : summary ? (
            <div className="prose prose-sm max-w-none text-sm leading-relaxed">
              {summary}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No summary generated yet.</p>
          )}
        </CardContent>
      )}
    </Card>
  );
}
