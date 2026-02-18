'use client';

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Play,
  Pause,
  Pencil,
  Trash2,
  RefreshCw,
  Clock,
  Calendar,
  Globe,
  Video,
  Camera,
  Loader2,
  Eye,
  CheckCircle,
  XCircle,
  BarChart3,
  Timer,
  Layers,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableSkeleton,
} from '@/components/shared/data-table';
import { Pagination } from '@/components/shared/pagination';
import { EmptyState } from '@/components/shared/empty-state';
import { ScheduleStatusBadge } from '@/components/schedules/schedule-status-badge';
import { formatCronExpression } from '@/components/schedules/schedule-card';
import { EditScheduleDialog } from '@/components/schedules/edit-schedule-dialog';
import { RunStatusBadge } from '@/components/runs/run-status-badge';
import { BrowserIcon, browserLabel } from '@/components/runs/browser-result-cell';
import { useToast } from '@/components/providers/toast-provider';
import { api, type Schedule, type Run, ApiClientError } from '@/lib/api';
import { formatRelativeTime, formatDuration, truncate } from '@/lib/utils';

// ─── Page Component ─────────────────────────────────────────────

export default function ScheduleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { success, error: toastError } = useToast();

  const projectId = params.projectId as string;
  const scheduleId = params.scheduleId as string;

  // Schedule state
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Runs state
  const [runs, setRuns] = useState<Run[]>([]);
  const [runsLoading, setRunsLoading] = useState(true);
  const [runsPagination, setRunsPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  // Action states
  const [isToggling, setIsToggling] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);

  // Run action states
  const [deletingRunId, setDeletingRunId] = useState<string | null>(null);
  const [runToDelete, setRunToDelete] = useState<Run | null>(null);

  // ─── Data Fetching ────────────────────────────────────────────

  const fetchSchedule = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.getSchedule(scheduleId);
      setSchedule(data);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Failed to load schedule');
      }
    } finally {
      setIsLoading(false);
    }
  }, [scheduleId]);

  const fetchRuns = useCallback(
    async (page = 1) => {
      try {
        setRunsLoading(true);
        const response = await api.listRuns({
          projectId,
          scheduleId,
          page,
          limit: runsPagination.limit,
        });
        setRuns(response.data);
        setRunsPagination({
          page: response.pagination.page,
          limit: response.pagination.limit,
          total: response.pagination.total,
          totalPages: response.pagination.totalPages,
        });
      } catch (err) {
        console.error('Failed to fetch runs:', err);
      } finally {
        setRunsLoading(false);
      }
    },
    [projectId, scheduleId, runsPagination.limit]
  );

  useEffect(() => {
    fetchSchedule();
    fetchRuns();
  }, [fetchSchedule, fetchRuns]);

  // ─── Actions ──────────────────────────────────────────────────

  const handleToggle = async () => {
    if (!schedule) return;

    setIsToggling(true);
    try {
      const updated = await api.toggleSchedule(schedule.id);
      setSchedule({
        ...schedule,
        status: updated.status,
        nextRunAt: updated.nextRunAt ?? undefined,
      });
      success(
        `Schedule ${updated.status === 'active' ? 'resumed' : 'paused'}`
      );
    } catch (err) {
      if (err instanceof ApiClientError) {
        toastError(err.message);
      } else {
        toastError('Failed to toggle schedule');
      }
    } finally {
      setIsToggling(false);
    }
  };

  const handleDelete = async () => {
    if (!schedule) return;

    setIsDeleting(true);
    try {
      await api.deleteSchedule(schedule.id);
      success('Schedule deleted');
      router.push(`/projects/${projectId}/schedules`);
    } catch (err) {
      if (err instanceof ApiClientError) {
        toastError(err.message);
      } else {
        toastError('Failed to delete schedule');
      }
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleEditSuccess = (updated: Schedule) => {
    setSchedule(updated);
    setShowEditDialog(false);
  };

  const handleDeleteRun = async () => {
    if (!runToDelete) return;

    setDeletingRunId(runToDelete.id);
    try {
      await api.deleteRun(runToDelete.id);
      success('Run deleted');
      setRuns((prev) => prev.filter((r) => r.id !== runToDelete.id));
      fetchSchedule(); // Refresh stats
    } catch (err) {
      if (err instanceof ApiClientError) {
        toastError(err.message);
      } else {
        toastError('Failed to delete run');
      }
    } finally {
      setDeletingRunId(null);
      setRunToDelete(null);
    }
  };

  const handleRefresh = () => {
    fetchSchedule();
    fetchRuns(runsPagination.page);
  };

  // ─── Loading State ────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Back button */}
        <Skeleton className="h-9 w-32" />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-4 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Config card */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-5 w-32" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Runs table */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-24" />
          </CardHeader>
          <CardContent>
            <Table>
              <TableBody>
                <TableSkeleton rows={5} columns={6} />
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Error / Not Found ────────────────────────────────────────

  if (error || !schedule) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/projects/${projectId}/schedules`}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Schedules
          </Link>
        </Button>
        <EmptyState
          variant="error"
          title="Schedule not found"
          description={error || 'The schedule you are looking for does not exist.'}
          action={{
            label: 'View All Schedules',
            onClick: () => router.push(`/projects/${projectId}/schedules`),
          }}
        />
      </div>
    );
  }

  // ─── Success Rate ─────────────────────────────────────────────

  const successRate =
    schedule.totalRuns > 0
      ? Math.round((schedule.successfulRuns / schedule.totalRuns) * 100)
      : null;

  // ─── Render ───────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/projects/${projectId}/schedules`}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Schedules
        </Link>
      </Button>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{schedule.name}</h1>
            <ScheduleStatusBadge status={schedule.status} />
          </div>
          <p className="text-muted-foreground mt-1">
            {formatCronExpression(schedule.cronExpression)} &bull;{' '}
            {schedule.timezone}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowEditDialog(true)}
          >
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button
            variant={schedule.status === 'active' ? 'outline' : 'default'}
            size="sm"
            onClick={handleToggle}
            disabled={isToggling}
          >
            {isToggling ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : schedule.status === 'active' ? (
              <Pause className="h-4 w-4 mr-2" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            {schedule.status === 'active' ? 'Pause' : 'Resume'}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDeleteConfirm(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">{schedule.totalRuns}</div>
            <p className="text-sm text-muted-foreground">Total Runs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle className="h-4 w-4 text-green-500" />
            </div>
            <div className="text-2xl font-bold text-green-600">
              {schedule.successfulRuns}
            </div>
            <p className="text-sm text-muted-foreground">Passed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="h-4 w-4 text-red-500" />
            </div>
            <div className="text-2xl font-bold text-red-600">
              {schedule.failedRuns}
            </div>
            <p className="text-sm text-muted-foreground">Failed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <Timer className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="text-2xl font-bold">
              {schedule.lastRunAt
                ? formatRelativeTime(schedule.lastRunAt)
                : 'Never'}
            </div>
            <p className="text-sm text-muted-foreground">Last Run</p>
          </CardContent>
        </Card>
      </div>

      {/* Schedule Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Schedule Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                {schedule.targetType === 'suite' ? <Layers className="h-3.5 w-3.5" /> : <FileText className="h-3.5 w-3.5" />}
                Target
              </p>
              <p className="font-medium mt-0.5 capitalize">
                {schedule.targetType === 'suite' ? 'Entire Suite' : schedule.targetType === 'test' ? 'Individual Test' : 'Recording'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                Schedule
              </p>
              <p className="font-medium mt-0.5">
                {formatCronExpression(schedule.cronExpression)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Globe className="h-3.5 w-3.5" />
                Timezone
              </p>
              <p className="font-medium mt-0.5">{schedule.timezone}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Browser</p>
              <div className="font-medium mt-0.5 flex items-center gap-2 flex-wrap">
                {(schedule.browsers ?? (schedule.browser ? [schedule.browser] : ['chromium'])).map((b) => (
                  <span key={b} className="flex items-center gap-1">
                    <BrowserIcon browser={b} className="h-4 w-4" />
                    {browserLabel(b)}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                Next Run
              </p>
              <p className="font-medium mt-0.5">
                {schedule.nextRunAt
                  ? formatRelativeTime(schedule.nextRunAt, true)
                  : 'Not scheduled'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Video className="h-3.5 w-3.5" />
                Record Video
              </p>
              <p className="font-medium mt-0.5">
                {schedule.recordVideo ? 'Enabled' : 'Disabled'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Camera className="h-3.5 w-3.5" />
                Screenshots
              </p>
              <p className="font-medium mt-0.5 capitalize">
                {schedule.screenshotMode || 'on-failure'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Runs</p>
              <p className="font-medium mt-0.5">{schedule.totalRuns}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Success Rate</p>
              <p className="font-medium mt-0.5">
                {successRate !== null ? (
                  <>
                    {successRate}%
                    <span className="text-muted-foreground text-sm ml-1">
                      ({schedule.successfulRuns}/{schedule.totalRuns})
                    </span>
                  </>
                ) : (
                  'N/A'
                )}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Run History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Run History</CardTitle>
        </CardHeader>
        <CardContent>
          {runsLoading ? (
            <Table>
              <TableBody>
                <TableSkeleton rows={5} columns={6} />
              </TableBody>
            </Table>
          ) : runs.length === 0 ? (
            <EmptyState
              variant="empty"
              title="No runs yet"
              description="This schedule hasn't executed any test runs yet."
            />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Test</TableHead>
                    <TableHead>Browser</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Actions</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell>
                        <RunStatusBadge status={run.status} size="sm" />
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">
                          {truncate(
                            run.testName || run.recordingName || 'Unnamed',
                            30
                          )}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-2 flex-wrap">
                          {(run.browsers && run.browsers.length > 0
                            ? run.browsers
                            : [run.browser]
                          ).map((b) => (
                            <span key={b} className="flex items-center gap-1">
                              <BrowserIcon browser={b} className="h-4 w-4" />
                              {browserLabel(b)}
                            </span>
                          ))}
                        </span>
                      </TableCell>
                      <TableCell>
                        {run.durationMs ? formatDuration(run.durationMs) : '-'}
                      </TableCell>
                      <TableCell>
                        {run.actionsExecuted != null &&
                        run.actionsTotal != null ? (
                          <span
                            className={
                              run.actionsFailed && run.actionsFailed > 0
                                ? 'text-red-600'
                                : ''
                            }
                          >
                            {run.actionsExecuted}/{run.actionsTotal}
                            {run.actionsFailed && run.actionsFailed > 0
                              ? ` (${run.actionsFailed} failed)`
                              : ''}
                          </span>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {formatRelativeTime(run.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" asChild>
                            <Link
                              href={`/projects/${projectId}/runs/${run.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setRunToDelete(run)}
                            disabled={deletingRunId === run.id}
                          >
                            {deletingRunId === run.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4 text-destructive" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {runsPagination.totalPages > 1 && (
                <div className="mt-4">
                  <Pagination
                    currentPage={runsPagination.page}
                    totalPages={runsPagination.totalPages}
                    total={runsPagination.total}
                    limit={runsPagination.limit}
                    onPageChange={(p) => fetchRuns(p)}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Delete Schedule Confirmation */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Schedule"
        description={`Are you sure you want to delete "${schedule.name}"? This will stop all future scheduled runs. This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
        isLoading={isDeleting}
      />

      {/* Delete Run Confirmation */}
      <ConfirmDialog
        open={!!runToDelete}
        onClose={() => setRunToDelete(null)}
        title="Delete Run"
        description="Are you sure you want to delete this run? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDeleteRun}
        isLoading={!!deletingRunId}
      />

      {/* Edit Schedule Dialog */}
      <EditScheduleDialog
        schedule={schedule}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onSuccess={handleEditSuccess}
      />
    </div>
  );
}
