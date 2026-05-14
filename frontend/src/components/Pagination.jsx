import React from 'react';
import { Button } from './ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function Pagination({ offset, limit, total, onPrevious, onNext, onLimitChange }) {
  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);
  const hasNext = offset + limit < total;
  const hasPrevious = offset > 0;

  return (
    <div className="mt-6 flex flex-col gap-4 rounded-md border p-4 md:flex-row md:items-center md:justify-between">
      <div className="text-sm text-muted-foreground">
        Showing {offset + 1} to {Math.min(offset + limit, total)} of {total} candidates
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onPrevious}
          disabled={!hasPrevious}
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Previous
        </Button>

        <span className="px-3 text-sm font-medium">
          Page {currentPage} of {totalPages}
        </span>

        <Button
          variant="outline"
          size="sm"
          onClick={onNext}
          disabled={!hasNext}
        >
          Next
          <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <label htmlFor="limit-select" className="text-sm font-medium">
          Per page:
        </label>
        <select
          id="limit-select"
          value={limit}
          onChange={(e) => onLimitChange(parseInt(e.target.value))}
          className="rounded-md border border-input bg-background px-2 py-1 text-sm"
        >
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
        </select>
      </div>
    </div>
  );
}
