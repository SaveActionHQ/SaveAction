'use client';

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/dialog';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableSkeleton,
} from '@/components/shared/data-table';
import { Pagination } from '@/components/shared/pagination';
import { EmptyState } from '@/components/shared/empty-state';
import { useToast } from '@/components/providers/toast-provider';
import { api, type Run, type PaginatedResponse, ApiClientError } from '@/lib/api';
import { formatRelativeTime, formatDuration, truncate } from '@/lib/utils';

// Icons
function EyeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function StopCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <rect width="6" height="6" x="9" y="9" />
    </svg>
  );
}

function RefreshCwIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  );
}

function LoaderIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 2v4" />
      <path d="m16.2 7.8 2.9-2.9" />
      <path d="M18 12h4" />
      <path d="m16.2 16.2 2.9 2.9" />
      <path d="M12 18v4" />
      <path d="m4.9 19.1 2.9-2.9" />
      <path d="M2 12h4" />
      <path d="m4.9 4.9 2.9 2.9" />
    </svg>
  );
}

// Status badge component
function StatusBadge({ status }: { status: Run['status'] }) {
  const variants: Record<Run['status'], 'success-soft' | 'destructive-soft' | 'warning-soft' | 'primary-soft' | 'secondary'> = {
    passed: 'success-soft',
    failed: 'destructive-soft',
    running: 'primary-soft',
    queued: 'warning-soft',
    cancelled: 'secondary',
  };

  const labels: Record<Run['status'], string> = {
    passed: 'Passed',
    failed: 'Failed',
    running: 'Running',
    queued: 'Queued',
    cancelled: 'Cancelled',
  };

  return (
    <Badge variant={variants[status]} className="capitalize">
      {status === 'running' && (
        <LoaderIcon className="h-3 w-3 mr-1 animate-spin" />
      )}
      {labels[status]}
    </Badge>
  );
}

// Browser icon component
function BrowserIcon({ browser, className }: { browser: string; className?: string }) {
  if (browser === 'chromium') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8 0-1.85.63-3.55 1.69-4.9L12 12l4.31-4.31C17.37 8.45 18 10.15 18 12c0 4.41-3.59 8-8 8z"/>
      </svg>
    );
  }
  if (browser === 'firefox') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
      </svg>
    );
  }
  // webkit
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="10"/>
    </svg>
  );
}

interface RunsListProps {
  searchQuery?: string;
  statusFilter?: Run['status'];
  onRefresh?: () => void;
}

const PAGE_SIZE = 10;

export function RunsList({ searchQuery, statusFilter, onRefresh }: RunsListProps) {
  const { success, error: toastError } = useToast();
  const [runs, setRuns] = useState<Run[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Delete confirmation state
  const [deleteRun, setDeleteRun] = useState<Run | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Cancel state
  const [cancellingRunId, setCancellingRunId] = useState<string | null>(null);

  // Retry state
  const [retryingRunId, setRetryingRunId] = useState<string | null>(null);

  const fetchRuns = useCallback(
    async (page: number = 1) => {
      setIsLoading(true);
      setError(null);

      try {
        const response: PaginatedResponse<Run> = await api.listRuns({
          page,
          limit: PAGE_SIZE,
          status: statusFilter,
        });

        // Filter by search query client-side if needed
        let filteredRuns = response.data;
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          filteredRuns = filteredRuns.filter((run) =>
            (run as any).recordingName?.toLowerCase().includes(query) ||
            run.id.toLowerCase().includes(query)
          );
        }

        setRuns(filteredRuns);
        setPagination(response.pagination);
      } catch (err) {
        if (err instanceof ApiClientError) {
          setError(err.message);
        } else {
          setError('Failed to load runs. Please try again.');
        }
      } finally {
        setIsLoading(false);
      }
    },
    [searchQuery, statusFilter]
  );

  useEffect(() => {
    fetchRuns(1);
  }, [fetchRuns]);

  // Auto-refresh for running/queued runs
  useEffect(() => {
    const hasActiveRuns = runs.some(
      (run) => run.status === 'running' || run.status === 'queued'
    );

    if (hasActiveRuns) {
      const interval = setInterval(() => {
        fetchRuns(pagination.page);
      }, 5000); // Refresh every 5 seconds

      return () => clearInterval(interval);
    }
  }, [runs, pagination.page, fetchRuns]);

  const handlePageChange = (page: number) => {
    fetchRuns(page);
  };

  const handleDelete = async () => {
    if (!deleteRun) return;

    setIsDeleting(true);
    try {
      await api.deleteRun(deleteRun.id);
      success('Run deleted', 'The test run has been deleted.');
      setDeleteRun(null);
      fetchRuns(pagination.page);
      onRefresh?.();
    } catch (err) {
      const errorMessage =
        err instanceof ApiClientError
          ? err.message
          : 'Failed to delete run. Please try again.';
      setError(errorMessage);
      toastError('Delete failed', errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancel = async (run: Run) => {
    setCancellingRunId(run.id);
    try {
      await api.cancelRun(run.id);
      success('Run cancelled', 'The test run has been cancelled.');
      fetchRuns(pagination.page);
      onRefresh?.();
    } catch (err) {
      const errorMessage =
        err instanceof ApiClientError
          ? err.message
          : 'Failed to cancel run. Please try again.';
      toastError('Cancel failed', errorMessage);
    } finally {
      setCancellingRunId(null);
    }
  };

  const handleRetry = async (run: Run) => {
    setRetryingRunId(run.id);
    try {
      await api.retryRun(run.id);
      success('Run retried', 'A new test run has been queued.');
      fetchRuns(pagination.page);
      onRefresh?.();
    } catch (err) {
      const errorMessage =
        err instanceof ApiClientError
          ? err.message
          : 'Failed to retry run. Please try again.';
      toastError('Retry failed', errorMessage);
    } finally {
      setRetryingRunId(null);
    }
  };

  // Error state
  if (error && !isLoading && (!runs || runs.length === 0)) {
    return (
      <EmptyState
        variant="error"
        title="Failed to load runs"
        description={error}
        action={{
          label: 'Try Again',
          onClick: () => fetchRuns(pagination.page),
        }}
      />
    );
  }

  // Empty state
  if (!isLoading && (!runs || runs.length === 0)) {
    return (
      <EmptyState
        title="No test runs yet"
        description="Test runs will appear here when you execute a recording. Go to Recordings to run a test."
        action={{
          label: 'Go to Recordings',
          onClick: () => (window.location.href = '/recordings'),
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Recording</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Browser</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Started</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeleton columns={7} rows={5} />
            ) : (
              runs.map((run) => (
                <TableRow key={run.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/runs/${run.id}`}
                      className="hover:text-primary hover:underline"
                    >
                      {truncate((run as any).recordingName || 'Unknown Recording', 40)}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={run.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <BrowserIcon browser={run.browser} className="h-4 w-4" />
                      <span className="capitalize">{run.browser}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {run.actionsExecuted !== undefined && (run as any).actionsTotal !== undefined ? (
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-secondary rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all duration-300"
                            style={{
                              width: `${Math.round(
                                (run.actionsExecuted / ((run as any).actionsTotal || 1)) * 100
                              )}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {run.actionsExecuted}/{(run as any).actionsTotal}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {run.duration ? (
                      formatDuration(run.duration)
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {run.startedAt ? (
                      formatRelativeTime(run.startedAt)
                    ) : run.createdAt ? (
                      formatRelativeTime(run.createdAt)
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon-sm" asChild>
                        <Link href={`/runs/${run.id}`}>
                          <EyeIcon className="h-4 w-4" />
                          <span className="sr-only">View details</span>
                        </Link>
                      </Button>
                      {(run.status === 'running' || run.status === 'queued') && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleCancel(run)}
                          disabled={cancellingRunId === run.id}
                        >
                          {cancellingRunId === run.id ? (
                            <LoaderIcon className="h-4 w-4 animate-spin" />
                          ) : (
                            <StopCircleIcon className="h-4 w-4" />
                          )}
                          <span className="sr-only">Cancel run</span>
                        </Button>
                      )}
                      {(run.status === 'failed' || run.status === 'cancelled') && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => handleRetry(run)}
                          disabled={retryingRunId === run.id}
                        >
                          {retryingRunId === run.id ? (
                            <LoaderIcon className="h-4 w-4 animate-spin" />
                          ) : (
                            <RefreshCwIcon className="h-4 w-4" />
                          )}
                          <span className="sr-only">Retry run</span>
                        </Button>
                      )}
                      {run.status !== 'running' && run.status !== 'queued' && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setDeleteRun(run)}
                        >
                          <TrashIcon className="h-4 w-4" />
                          <span className="sr-only">Delete run</span>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <Pagination
        currentPage={pagination.page}
        totalPages={pagination.totalPages}
        total={pagination.total}
        limit={pagination.limit}
        onPageChange={handlePageChange}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!deleteRun}
        onClose={() => setDeleteRun(null)}
        onConfirm={handleDelete}
        title="Delete Test Run"
        description="Are you sure you want to delete this test run? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        isLoading={isDeleting}
      />
    </div>
  );
}
