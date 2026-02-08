'use client';

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
import { useToast } from '@/components/providers/toast-provider';
import { EditScheduleDialog } from '@/components/schedules/edit-schedule-dialog';
import { api, type Schedule, type Run, ApiClientError } from '@/lib/api';
import { formatDuration, formatRelativeTime, truncate } from '@/lib/utils';

// Icons
function ArrowLeftIcon({ className }: { className?: string }) {
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
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  );
}

function PlayIcon({ className }: { className?: string }) {
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
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  );
}

function PauseIcon({ className }: { className?: string }) {
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
      <rect x="14" y="4" width="4" height="16" rx="1" />
      <rect x="6" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

function EditIcon({ className }: { className?: string }) {
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
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
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

function CalendarIcon({ className }: { className?: string }) {
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
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
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
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function VideoIcon({ className }: { className?: string }) {
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
      <path d="m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5" />
      <rect x="2" y="6" width="14" height="12" rx="2" />
    </svg>
  );
}

function CameraIcon({ className }: { className?: string }) {
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
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
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

// Helper to get status badge variant
function getStatusBadge(status: string) {
  switch (status) {
    case 'active':
      return <Badge variant="success">Active</Badge>;
    case 'paused':
      return <Badge variant="warning">Paused</Badge>;
    case 'disabled':
      return <Badge variant="secondary">Disabled</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

// Helper to get run status badge
function getRunStatusBadge(status: Run['status']) {
  switch (status) {
    case 'passed':
      return <Badge variant="success">Passed</Badge>;
    case 'failed':
      return <Badge variant="destructive">Failed</Badge>;
    case 'running':
      return <Badge variant="default" className="animate-pulse">Running</Badge>;
    case 'queued':
      return <Badge variant="secondary">Queued</Badge>;
    case 'cancelled':
      return <Badge variant="warning">Cancelled</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

// Helper to describe cron expression
function describeCron(cron: string): string {
  const presets: Record<string, string> = {
    '* * * * *': 'Every minute',
    '*/5 * * * *': 'Every 5 minutes',
    '*/15 * * * *': 'Every 15 minutes',
    '*/30 * * * *': 'Every 30 minutes',
    '0 * * * *': 'Every hour',
    '0 */6 * * *': 'Every 6 hours',
    '0 */12 * * *': 'Every 12 hours',
    '0 0 * * *': 'Daily at midnight',
    '0 9 * * *': 'Daily at 9 AM',
    '0 18 * * *': 'Daily at 6 PM',
    '0 9 * * 1-5': 'Weekdays at 9 AM',
    '0 0 * * 1': 'Weekly on Monday',
    '0 0 1 * *': 'Monthly on the 1st',
  };
  return presets[cron] || cron;
}

export default function ScheduleDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const scheduleId = params.id as string;

  const { success, error: toastError } = useToast();

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
  const [showDeleteRunConfirm, setShowDeleteRunConfirm] = useState(false);
  const [runToDelete, setRunToDelete] = useState<Run | null>(null);

  // Fetch schedule
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

  // Fetch runs for this schedule
  const fetchRuns = useCallback(async (page = 1) => {
    try {
      setRunsLoading(true);
      const response = await api.listRuns({
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
  }, [scheduleId, runsPagination.limit]);

  useEffect(() => {
    fetchSchedule();
    fetchRuns();
  }, [fetchSchedule, fetchRuns]);

  // Toggle schedule status
  const handleToggle = async () => {
    if (!schedule) return;

    setIsToggling(true);
    try {
      const updated = await api.toggleSchedule(schedule.id);
      setSchedule({ 
        ...schedule, 
        status: updated.status,
        nextRunAt: updated.nextRunAt ?? undefined
      });
      success(`Schedule ${updated.status === 'active' ? 'resumed' : 'paused'}`);
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

  // Delete schedule
  const handleDelete = async () => {
    if (!schedule) return;

    setIsDeleting(true);
    try {
      await api.deleteSchedule(schedule.id);
      success('Schedule deleted');
      router.push('/schedules');
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

  // Edit success handler
  const handleEditSuccess = (updated: Schedule) => {
    setSchedule(updated);
    setShowEditDialog(false);
  };

  // Delete run
  const handleDeleteRun = async () => {
    if (!runToDelete) return;

    setDeletingRunId(runToDelete.id);
    try {
      await api.deleteRun(runToDelete.id);
      success('Run deleted');
      setRuns(runs.filter((r) => r.id !== runToDelete.id));
      // Refresh schedule stats
      fetchSchedule();
    } catch (err) {
      if (err instanceof ApiClientError) {
        toastError(err.message);
      } else {
        toastError('Failed to delete run');
      }
    } finally {
      setDeletingRunId(null);
      setShowDeleteRunConfirm(false);
      setRunToDelete(null);
    }
  };

  // Confirm delete run
  const confirmDeleteRun = (run: Run) => {
    setRunToDelete(run);
    setShowDeleteRunConfirm(true);
  };

  // Page change handler
  const handlePageChange = (page: number) => {
    fetchRuns(page);
  };

  // Refresh
  const handleRefresh = () => {
    fetchSchedule();
    fetchRuns(runsPagination.page);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        {/* Back button skeleton */}
        <Skeleton className="h-9 w-32" />

        {/* Header skeleton */}
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

        {/* Details card skeleton */}
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-5 w-32" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Runs table skeleton */}
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

  if (error || !schedule) {
    return (
      <div className="container mx-auto py-6">
        <Link href="/schedules">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeftIcon className="h-4 w-4 mr-2" />
            Back to Schedules
          </Button>
        </Link>
        <div className="flex flex-col items-center justify-center py-12">
          <CalendarIcon className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Schedule not found</h2>
          <p className="text-muted-foreground mb-4">{error || 'The schedule you are looking for does not exist.'}</p>
          <Link href="/schedules">
            <Button>View All Schedules</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Back button */}
      <Link href="/schedules">
        <Button variant="ghost" size="sm">
          <ArrowLeftIcon className="h-4 w-4 mr-2" />
          Back to Schedules
        </Button>
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{schedule.name}</h1>
            {getStatusBadge(schedule.status)}
            {schedule.lastRunStatus === 'running' && (
              <Badge variant="default" className="animate-pulse">
                <LoaderIcon className="h-3 w-3 mr-1 animate-spin" />
                Running
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1">
            {describeCron(schedule.cronExpression)} • {schedule.timezone}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
          >
            <RefreshCwIcon className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowEditDialog(true)}
          >
            <EditIcon className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button
            variant={schedule.status === 'active' ? 'outline' : 'default'}
            size="sm"
            onClick={handleToggle}
            disabled={isToggling}
          >
            {isToggling ? (
              <LoaderIcon className="h-4 w-4 mr-2 animate-spin" />
            ) : schedule.status === 'active' ? (
              <PauseIcon className="h-4 w-4 mr-2" />
            ) : (
              <PlayIcon className="h-4 w-4 mr-2" />
            )}
            {schedule.status === 'active' ? 'Pause' : 'Resume'}
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDeleteConfirm(true)}
          >
            <TrashIcon className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Schedule Details Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Schedule Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Schedule</p>
              <p className="font-medium">{describeCron(schedule.cronExpression)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Timezone</p>
              <p className="font-medium">{schedule.timezone}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Browser</p>
              <p className="font-medium capitalize">{schedule.browser || 'chromium'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Next Run</p>
              <p className="font-medium">
                {schedule.nextRunAt
                  ? formatRelativeTime(schedule.nextRunAt, true)
                  : 'Not scheduled'}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <VideoIcon className="h-3.5 w-3.5" />
                Record Video
              </p>
              <p className="font-medium">{schedule.recordVideo ? 'Enabled' : 'Disabled'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <CameraIcon className="h-3.5 w-3.5" />
                Screenshots
              </p>
              <p className="font-medium capitalize">{schedule.screenshotMode || 'on-failure'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Runs</p>
              <p className="font-medium">{schedule.totalRuns}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Success Rate</p>
              <p className="font-medium">
                {schedule.totalRuns > 0
                  ? `${Math.round((schedule.successfulRuns / schedule.totalRuns) * 100)}%`
                  : 'N/A'}
                <span className="text-muted-foreground text-sm ml-1">
                  ({schedule.successfulRuns}/{schedule.totalRuns})
                </span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{schedule.totalRuns}</div>
            <p className="text-sm text-muted-foreground">Total Runs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{schedule.successfulRuns}</div>
            <p className="text-sm text-muted-foreground">Passed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">{schedule.failedRuns}</div>
            <p className="text-sm text-muted-foreground">Failed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">
              {schedule.lastRunAt ? formatRelativeTime(schedule.lastRunAt) : 'Never'}
            </div>
            <p className="text-sm text-muted-foreground">Last Run</p>
          </CardContent>
        </Card>
      </div>

      {/* Runs List */}
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
            <div className="flex flex-col items-center justify-center py-8">
              <ClockIcon className="h-10 w-10 text-muted-foreground mb-3" />
              <h3 className="text-lg font-medium mb-1">No runs yet</h3>
              <p className="text-muted-foreground text-sm">This schedule hasn't executed any test runs yet.</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Recording</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Actions</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell>{getRunStatusBadge(run.status)}</TableCell>
                      <TableCell>
                        <span className="font-medium">{truncate(run.recordingName || 'Unnamed Recording', 30)}</span>
                      </TableCell>
                      <TableCell>
                        {run.durationMs ? formatDuration(run.durationMs) : '-'}
                      </TableCell>
                      <TableCell>
                        {run.actionsExecuted !== null && run.actionsTotal !== null ? (
                          <span className={run.actionsFailed && run.actionsFailed > 0 ? 'text-red-600' : ''}>
                            {run.actionsExecuted}/{run.actionsTotal}
                            {run.actionsFailed && run.actionsFailed > 0 && ` (${run.actionsFailed} failed)`}
                          </span>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>{formatRelativeTime(run.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Link href={`/runs/${run.id}`}>
                            <Button variant="ghost" size="sm">
                              <EyeIcon className="h-4 w-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => confirmDeleteRun(run)}
                            disabled={deletingRunId === run.id}
                          >
                            {deletingRunId === run.id ? (
                              <LoaderIcon className="h-4 w-4 animate-spin" />
                            ) : (
                              <TrashIcon className="h-4 w-4 text-destructive" />
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
                    onPageChange={handlePageChange}
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
        description={`Are you sure you want to delete "${schedule.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
        isLoading={isDeleting}
      />

      {/* Delete Run Confirmation */}
      <ConfirmDialog
        open={showDeleteRunConfirm}
        onClose={() => setShowDeleteRunConfirm(false)}
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
