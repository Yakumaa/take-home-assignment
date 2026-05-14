import React, { useState, useEffect } from 'react';
import { CandidateTable } from '../components/CandidateTable';
import { Pagination } from '../components/Pagination';
import { candidatesAPI } from '../api';

const DEFAULT_LIMIT = 20;

export function CandidateListPage() {
  const [candidates, setCandidates] = useState([]);
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Fetch candidates whenever offset or limit changes
  useEffect(() => {
    fetchCandidates();
  }, [offset, limit]);

  const fetchCandidates = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await candidatesAPI.getList(offset, limit);
      const data = response.data;

      setCandidates(data.candidates || []);
      setTotal(data.total || 0);
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Failed to fetch candidates.';
      setError(errorMsg);
      console.error('Error fetching candidates:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrevious = () => {
    const newOffset = Math.max(0, offset - limit);
    setOffset(newOffset);
  };

  const handleNext = () => {
    if (offset + limit < total) {
      setOffset(offset + limit);
    }
  };

  const handleLimitChange = (newLimit) => {
    setLimit(newLimit);
    setOffset(0); // Reset to first page when changing page size
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Candidates</h1>
        <p className="mt-2 text-sm text-muted-foreground">Review and score all candidates</p>
      </div>

      {error && (
        <div className="mb-6 rounded-md bg-destructive/10 p-4 text-sm text-destructive">
          <strong>Error:</strong> {error}
        </div>
      )}

      <CandidateTable candidates={candidates} loading={loading} />

      <Pagination
        offset={offset}
        limit={limit}
        total={total}
        onPrevious={handlePrevious}
        onNext={handleNext}
        onLimitChange={handleLimitChange}
      />
    </div>
  );
}
