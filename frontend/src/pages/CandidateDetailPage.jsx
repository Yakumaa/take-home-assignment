import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { candidatesAPI } from '../api';
import { AISummarySection } from '../components/AISummarySection';
import { ScoringForm } from '../components/ScoringForm';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Loader2, ArrowLeft, FileText } from 'lucide-react';

export function CandidateDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [candidate, setCandidate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetchCandidate();
  }, [id, refreshKey]);

  const fetchCandidate = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await candidatesAPI.getDetail(id);
      setCandidate(response.data);
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Failed to fetch candidate details.';
      setError(errorMsg);
      console.error('Error fetching candidate:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleScoringSuccess = () => {
    // Refresh candidate data to show updated scores
    setRefreshKey((prev) => prev + 1);
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="mb-4 h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading candidate details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 space-y-4">
        <Button variant="outline" onClick={() => navigate('/candidates')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Candidates
        </Button>
        <div className="rounded-md bg-destructive/10 p-4 text-destructive">
          <strong>Error:</strong> {error}
        </div>
      </div>
    );
  }

  if (!candidate) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 space-y-4">
        <Button variant="outline" onClick={() => navigate('/candidates')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Candidates
        </Button>
        <div className="rounded-md bg-destructive/10 p-4 text-destructive">
          <strong>Not Found:</strong> Candidate not found.
        </div>
      </div>
    );
  }

  // Determine if current user is the reviewer who submitted a score
  const userScore = candidate.scores?.find((s) => s.reviewer_id === user?.id);

  const getStatusVariant = (status) => {
    const variants = {
      active: 'default',
      archived: 'secondary',
      rejected: 'destructive',
    };
    return variants[status] || 'outline';
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <Button variant="outline" onClick={() => navigate('/candidates')} className="mb-6">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Candidates
      </Button>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">{candidate.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{candidate.email}</p>
        <p className="text-sm text-muted-foreground">{candidate.position || 'N/A'}</p>
        <div className="mt-4 flex items-center gap-3">
          <Badge variant={getStatusVariant(candidate.status)}>
            {candidate.status}
          </Badge>
          {candidate.overall_score !== null && (
            <div className="text-sm font-medium">
              Overall Score: <span className="text-lg font-bold text-primary">{candidate.overall_score.toFixed(1)}/10</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Resume/CV Section */}
          {candidate.resume_url && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Resume
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button asChild>
                  <a
                    href={candidate.resume_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    View Resume
                  </a>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* AI Summary Section */}
          <AISummarySection candidateId={id} />

          {/* Scoring Form - Only visible to reviewers */}
          {(user?.role === 'reviewer' || user?.role === 'admin') && (
            <ScoringForm
              candidateId={id}
              onSubmitSuccess={handleScoringSuccess}
            />
          )}
        </div>

        <div className="space-y-6">
          {/* Reviewer Scores Panel - Hidden from regular reviewers */}
          {user?.role === 'admin' && candidate.scores && candidate.scores.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Reviewer Scores</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {candidate.scores.map((score, idx) => (
                  <div key={idx} className="border-b last:border-0 pb-6 last:pb-0">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="font-semibold">{score.reviewer_name || 'Anonymous'}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(score.submitted_at).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge>{score.overall_score.toFixed(1)}/10</Badge>
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Technical Skills:</span>
                        <span className="font-medium">{score.technical_skills.toFixed(1)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Communication:</span>
                        <span className="font-medium">{score.communication.toFixed(1)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Problem Solving:</span>
                        <span className="font-medium">{score.problem_solving.toFixed(1)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Culture Fit:</span>
                        <span className="font-medium">{score.culture_fit.toFixed(1)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Experience:</span>
                        <span className="font-medium">{score.experience.toFixed(1)}</span>
                      </div>
                    </div>
                    {score.comments && (
                      <div className="mt-4 border-t pt-4">
                        <p className="text-xs font-semibold text-muted-foreground mb-2">Comments:</p>
                        <p className="text-sm">{score.comments}</p>
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Internal Notes Panel - Admin only */}
          {user?.role === 'admin' && (
            <Card>
              <CardHeader>
                <CardTitle>Internal Notes</CardTitle>
              </CardHeader>
              <CardContent>
                {candidate.internal_notes ? (
                  <p className="text-sm">{candidate.internal_notes}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">No internal notes added yet.</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* User Score Display - Show if user is a reviewer */}
          {user?.role === 'reviewer' && userScore && (
            <Card>
              <CardHeader>
                <CardTitle>Your Score</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Technical Skills:</span>
                  <span className="font-semibold">{userScore.technical_skills.toFixed(1)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Communication:</span>
                  <span className="font-semibold">{userScore.communication.toFixed(1)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Problem Solving:</span>
                  <span className="font-semibold">{userScore.problem_solving.toFixed(1)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Culture Fit:</span>
                  <span className="font-semibold">{userScore.culture_fit.toFixed(1)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Experience:</span>
                  <span className="font-semibold">{userScore.experience.toFixed(1)}</span>
                </div>
                <div className="border-t pt-3 mt-3 flex justify-between font-semibold text-lg">
                  <span>Overall:</span>
                  <span className="text-primary">{userScore.overall_score.toFixed(1)}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
