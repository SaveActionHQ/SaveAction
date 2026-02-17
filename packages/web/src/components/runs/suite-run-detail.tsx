'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Ban,
  CheckCircle,
  XCircle,
  AlertCircle,
  Timer,
  Loader2,
  Trash2,
  ExternalLink,
  Layers,
  FlaskConical,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/dialog';
import { RunStatusBadge, RunStatusDot } from '@/components/runs/run-status-badge';
import { BrowserIcon, browserLabel } from '@/components/runs/browser-result-cell';
import { useToast } from '@/components/providers/toast-provider';
import { api, type Run, ApiClientError } from '@/lib/api';
import { formatRelativeTime, formatDuration, cn } from '@/lib/utils';

// ─── Types ──────────────────────────────────────────────────────

interface SuiteRunDetailProps {
  run: Run;
  projectId: string;
  onRunUpdated: (run: Run) => void;
}

// ─── Stat Card ──────────────────────────────────────────────────

function StatCard({
  title,
  value,
  icon: Icon,
  variant = 'default',
}: {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  variant?: 'default' | 'success' | 'error' | 'warning';
}) {
  const iconColors = {
    default: 'text-muted-foreground',
    success: 'text-emerald-600 dark:text-emerald-400',
    error: 'text-red-600 dark:text-red-400',
    warning: 'text-amber-600 dark:text-amber-400',
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={cn('p-2 rounded-lg bg-secondary', iconColors[variant])}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-xl font-semibold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Test Run Row ───────────────────────────────────────────────

function TestRunRow({
  run,
  projectId,
}: {
  run: Run;
  projectId: string;
}) {
  const browsers = run.browsers ?? [run.browser];
  const isActive = run.status === 'running' || run.status === 'queued';

  return (
    <Link
      href={`/projects/${projectId}/runs/${run.id}`}
      className="flex items-center gap-4 px-4 py-3 hover:bg-muted/50 transition-colors border-b last:border-b-0"
    >
      {/* Test icon */}
      <div className="flex-shrink-0">
        <FlaskConical className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Test name */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {run.testName || run.recordingName || 'Test Run'}
        </p>
        {run.errorMessage && (
          <p className="text-xs text-destructive truncate mt-0.5">
            {run.errorMessage}
          </p>
        )}
      </div>

      {/* Browser icons with status dots */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {browsers.map((browser) => (
          <div key={browser} className="relative">
            <BrowserIcon browser={browser} className="h-5 w-5" />
            <span className="absolute -bottom-0.5 -right-0.5">
              <RunStatusDot status={run.status} />
            </span>
          </div>
        ))}
      </div>

      {/* Duration */}
      <div className="text-sm text-muted-foreground w-16 text-right flex-shrink-0">
        {run.durationMs
          ? formatDuration(run.durationMs)
          : isActive
            ? '...'
            : '-'}
      </div>

      {/* Status badge */}
      <div className="flex-shrink-0">
        <RunStatusBadge status={run.status} size="sm" />
      </div>

      {/* Arrow */}
      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
    </Link>
  );
}

// ─── Main Component ─────────────────────────────────────────────

export function SuiteRunDetail({ run, projectId, onRunUpdated }: SuiteRunDetailProps) {
  const router = useRouter();
  const { success, error: toastError } = useToast();

  const [childRuns, setChildRuns] = React.useState<Run[]>([]);
  const [isLoadingChildren, setIsLoadingChildren] = React.useState(true);
  const [isCancelling, setIsCancelling] = React.useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = React.useState(false);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const isActive = run.status === 'running' || run.status === 'queued';

  // Fetch child test runs
  const fetchChildRuns = React.useCallback(async () => {
    try {
      const result = await api.listRuns({
        projectId,
        parentRunId: run.id,
        runType: 'test',
        limit: 100,
      });
      setChildRuns(result.data);
    } catch {
      // Silently fail
    } finally {
      setIsLoadingChildren(false);
    }
  }, [projectId, run.id]);

  React.useEffect(() => {
    fetchChildRuns();
  }, [fetchChildRuns]);

  // Poll for updates when suite is active
  React.useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(async () => {
      try {
        const [updatedRun] = await Promise.all([
          api.getRun(run.id),
          fetchChildRuns(),
        ]);
        onRunUpdated(updatedRun);
      } catch {
        // Ignore
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isActive, run.id, fetchChildRuns, onRunUpdated]);

  // Cancel suite — cancel all active child runs + the parent
  const handleCancelSuite = async () => {
    setIsCancelling(true);
    try {
      // Cancel parent suite run
      const updatedRun = await api.cancelRun(run.id);
      onRunUpdated(updatedRun);

      // Also cancel all active child runs
      const activeChildren = childRuns.filter(
        (r) => r.status === 'running' || r.status === 'queued'
      );
      await Promise.allSettled(
        activeChildren.map((r) => api.cancelRun(r.id))
      );

      // Refresh child runs
      await fetchChildRuns();

      success('Suite cancelled', 'All test runs have been cancelled.');
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'Failed to cancel suite';
      toastError('Cancel failed', msg);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await api.deleteRun(run.id);
      success('Suite run deleted', 'The suite run has been deleted.');
      router.push(`/projects/${projectId}/runs`);
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'Failed to delete';
      toastError('Delete failed', msg);
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  // Aggregate stats from child runs
  const stats = React.useMemo(() => {
    const total = childRuns.length;
    const passed = childRuns.filter((r) => r.status === 'passed').length;
    const failed = childRuns.filter((r) => r.status === 'failed').length;
    const running = childRuns.filter((r) => r.status === 'running').length;
    const queued = childRuns.filter((r) => r.status === 'queued').length;
    const cancelled = childRuns.filter((r) => r.status === 'cancelled').length;
    const completed = passed + failed + cancelled;
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
    const totalDuration = childRuns.reduce((sum, r) => sum + (r.durationMs ?? 0), 0);

    return { total, passed, failed, running, queued, cancelled, progress, totalDuration };
  }, [childRuns]);

  const title = run.testName || run.recordingName || 'Suite Run';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/projects/${projectId}/runs`}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-muted-foreground" />
                <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
              </div>
              <RunStatusBadge status={run.status} />
            </div>
            <p className="text-muted-foreground text-sm">
              Suite Run &middot; {run.id.slice(0, 8)}...
              {run.startedAt && (
                <> &middot; Started {formatRelativeTime(run.startedAt)}</>
              )}
              {run.triggeredBy && (
                <> &middot; <span className="capitalize">{run.triggeredBy}</span></>
              )}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {isActive && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancelSuite}
              disabled={isCancelling}
            >
              {isCancelling ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Ban className="h-4 w-4 mr-2" />
              )}
              Cancel Suite
            </Button>
          )}
          {!isActive && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {isActive && stats.total > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">
              {stats.passed + stats.failed + stats.cancelled}/{stats.total} tests completed
            </span>
          </div>
          <div className="h-2.5 bg-secondary rounded-full overflow-hidden flex">
            {stats.passed > 0 && (
              <div
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${(stats.passed / stats.total) * 100}%` }}
              />
            )}
            {stats.failed > 0 && (
              <div
                className="h-full bg-red-500 transition-all duration-500"
                style={{ width: `${(stats.failed / stats.total) * 100}%` }}
              />
            )}
            {stats.running > 0 && (
              <div
                className="h-full bg-blue-500 animate-pulse transition-all duration-500"
                style={{ width: `${(stats.running / stats.total) * 100}%` }}
              />
            )}
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Tests"
          value={isLoadingChildren ? '...' : stats.total}
          icon={Layers}
        />
        <StatCard
          title="Passed"
          value={isLoadingChildren ? '...' : stats.passed}
          icon={CheckCircle}
          variant="success"
        />
        <StatCard
          title="Failed"
          value={isLoadingChildren ? '...' : stats.failed}
          icon={XCircle}
          variant={stats.failed > 0 ? 'error' : 'default'}
        />
        <StatCard
          title="Duration"
          value={
            stats.totalDuration > 0
              ? formatDuration(stats.totalDuration)
              : isActive
                ? '...'
                : '-'
          }
          icon={Timer}
        />
      </div>

      {/* Error Message */}
      {run.errorMessage && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-destructive flex items-center gap-2 text-base">
              <XCircle className="h-5 w-5" />
              Error Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-sm text-destructive whitespace-pre-wrap font-mono bg-destructive/10 p-4 rounded-md overflow-x-auto">
              {run.errorMessage}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Test Runs Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <FlaskConical className="h-4 w-4" />
            Test Runs
            {!isLoadingChildren && (
              <span className="text-muted-foreground font-normal">
                ({stats.total})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoadingChildren ? (
            <div className="space-y-0 divide-y">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-3">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-5 w-5 rounded-full" />
                  <Skeleton className="h-4 w-12" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
              ))}
            </div>
          ) : childRuns.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No test runs found</p>
            </div>
          ) : (
            <div>
              {childRuns.map((childRun) => (
                <TestRunRow
                  key={childRun.id}
                  run={childRun}
                  projectId={projectId}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        onConfirm={handleDelete}
        title="Delete Suite Run"
        description="Are you sure you want to delete this suite run? Individual test runs will be preserved."
        confirmLabel="Delete"
        variant="destructive"
        isLoading={isDeleting}
      />
    </div>
  );
}
