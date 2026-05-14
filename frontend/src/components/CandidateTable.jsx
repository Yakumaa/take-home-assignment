import React from 'react';
import { Link } from 'react-router-dom';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';

export function CandidateTable({ candidates, loading }) {
  if (loading) {
    return (
      <div className="rounded-md border">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="border-b h-16 flex items-center px-4">
            <div className="h-4 bg-muted rounded w-32 animate-pulse mr-4"></div>
            <div className="h-4 bg-muted rounded w-48 animate-pulse mr-4"></div>
            <div className="h-4 bg-muted rounded w-40 animate-pulse"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!candidates || candidates.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-8 text-center">
        <p className="text-muted-foreground">No candidates found.</p>
      </div>
    );
  }

  const getStatusVariant = (status) => {
    const variants = {
      active: 'default',
      archived: 'secondary',
      rejected: 'destructive',
    };
    return variants[status] || 'outline';
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Position</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Score</TableHead>
            <TableHead className="w-24">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {candidates.map((candidate) => (
            <TableRow key={candidate.id}>
              <TableCell className="font-semibold">{candidate.name}</TableCell>
              <TableCell className="text-sm">{candidate.email}</TableCell>
              <TableCell>{candidate.position || '—'}</TableCell>
              <TableCell>
                <Badge variant={getStatusVariant(candidate.status)}>
                  {candidate.status}
                </Badge>
              </TableCell>
              <TableCell>
                {candidate.overall_score !== null && candidate.overall_score !== undefined ? (
                  <span className="font-semibold">{candidate.overall_score.toFixed(1)}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <Button asChild variant="ghost" size="sm">
                  <Link to={`/candidates/${candidate.id}`}>View</Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
