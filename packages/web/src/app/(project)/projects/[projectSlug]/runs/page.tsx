'use client';

import * as React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Pagination } from '@/components/shared/pagination';
import { EmptyState } from '@/components/shared/empty-state';
import { RunCard, RunCardSkeleton } from '@/components/runs/run-card';
import { useToast } from '@/components/providers/toast-provider';
import { api, type Run, type RunStatus, ApiClientError } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useProjectFromSlug } from '@/lib/hooks';

// ─── Status Filter Tabs ─────────────────────────────────────────

const STATUS_FILTERS: { label: string; value: RunStatus | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Queued', value: 'queued' },
  { label: 'Running', value: 'running' },
  { label: 'Passed', value: 'passed' },
  { label: 'Failed', value: 'failed' },
  { label: 'Cancelled', value: 'cancelled' },
];

// ─── Page Component ─────────────────────────────────────────────

export default function ProjectRunsPage() {
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const { projectSlug, projectId } = useProjectFromSlug();

  // Data state
  const [runs, setRuns] = useState<Run[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const limit = 20;

  // Filters
  const [statusFilter, setStatusFilter] = useState<RunStatus | 'all'>('all');

  // Action states
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Run | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Auto-refresh
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Data Fetching ────────────────────────────────────────────

  const fetchRuns = useCallback(async () => {
    try {
      const response = await api.listRuns({
        projectId,
        page,
        limit,
        status: statusFilter === 'all' ? undefined : statusFilter,
      });

      setRuns(response.data);
      setTotalPages(response.pagination?.totalPages ?? 1);
      setTotalItems(response.pagination?.total ?? response.data.length);
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Failed to load runs');
      }
    } finally {
      setIsLoading(false);
    }
  }, [projectId, page, limit, statusFilter]);

  // Initial load + filter/page changes
  useEffect(() => {
    setIsLoading(true);
    fetchRuns();
  }, [fetchRuns]);

  // Auto-refresh when there are running/queued runs
  useEffect(() => {
    const hasActiveRuns = runs.some(
      (r) => r.status === 'running' || r.status === 'queued'
    );

    if (hasActiveRuns) {
      refreshTimerRef.current = setInterval(() => {
        fetchRuns();
      }, 5000);
    }

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [runs, fetchRuns]);

  // ─── Actions ──────────────────────────────────────────────────

  const handleCancel = async (run: Run) => {
    setCancellingId(run.id);
    try {
      await api.cancelRun(run.id);
      success('Run cancelled', 'The test run has been cancelled.');
      fetchRuns();
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'Failed to cancel run';
      toastError('Cancel failed', msg);
    } finally {
      setCancellingId(null);
    }
  };

  const handleRetry = async (run: Run) => {
    setRetryingId(run.id);
    try {
      const newRun = await api.retryRun(run.id);
      success('Run retried', 'A new test run has been queued.');
      router.push(`/projects/${projectSlug}/runs/${newRun.id}`);
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'Failed to retry run';
      toastError('Retry failed', msg);
    } finally {
      setRetryingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await api.deleteRun(deleteTarget.id);
      success('Run deleted', 'The test run has been deleted.');
      setDeleteTarget(null);
      fetchRuns();
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'Failed to delete run';
      toastError('Delete failed', msg);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleFilterChange = (filter: RunStatus | 'all') => {
    setStatusFilter(filter);
    setPage(1);
  };

  // ─── Render ───────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Run History</h1>
          <p className="text-muted-foreground">
            View all test executions for this project
            {totalItems > 0 && (
              <span className="ml-1">({totalItems} total)</span>
            )}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setIsLoading(true);
            fetchRuns();
          }}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-1 flex-wrap border-b border-border pb-px">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => handleFilterChange(filter.value)}
            className={cn(
              'px-3 py-2 text-sm font-medium border-b-2 transition-colors',
              statusFilter === filter.value
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <RunCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <EmptyState
          variant="error"
          title="Failed to load runs"
          description={error}
          action={{
            label: 'Retry',
            onClick: () => {
              setIsLoading(true);
              fetchRuns();
            },
          }}
        />
      ) : runs.length === 0 ? (
        <EmptyState
          variant={statusFilter === 'all' ? 'empty' : 'no-results'}
          title={
            statusFilter === 'all'
              ? 'No runs yet'
              : `No ${statusFilter} runs`
          }
          description={
            statusFilter === 'all'
              ? 'Run a test or suite to see results here.'
              : `There are no runs with status "${statusFilter}". Try a different filter.`
          }
          action={
            statusFilter !== 'all'
              ? {
                  label: 'Show all runs',
                  onClick: () => handleFilterChange('all'),
                }
              : undefined
          }
        />
      ) : (
        <>
          <div className="space-y-3">
            {runs.map((run) => (
              <RunCard
                key={run.id}
                run={run}
                projectSlug={projectSlug}
                onCancel={handleCancel}
                onRetry={handleRetry}
                onDelete={(r) => setDeleteTarget(r)}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              total={totalItems}
              limit={limit}
              onPageChange={setPage}
            />
          )}
        </>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
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
