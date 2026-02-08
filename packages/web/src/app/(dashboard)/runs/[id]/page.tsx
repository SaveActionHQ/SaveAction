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
import { useToast } from '@/components/providers/toast-provider';
import { api, type Run, ApiClientError } from '@/lib/api';
import { formatDate, formatDuration, formatRelativeTime } from '@/lib/utils';
import { RunActionsTable, type RunAction } from '@/components/runs/run-actions-table';
import { VideoPlayer } from '@/components/runs/video-player';
import { ScreenshotGallery } from '@/components/runs/screenshot-gallery';

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

function CheckCircleIcon({ className }: { className?: string }) {
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
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function XCircleIcon({ className }: { className?: string }) {
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
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </svg>
  );
}

function AlertCircleIcon({ className }: { className?: string }) {
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
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
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

// Extended Run type with additional fields from API
interface RunDetails extends Run {
  recordingUrl?: string;
  screenshotEnabled?: boolean;
  timeout?: number;
  timingEnabled?: boolean;
  timingMode?: string;
  speedMultiplier?: number;
}

// Status badge component
function StatusBadge({ status }: { status: Run['status'] }) {
  const variants: Record<
    Run['status'],
    'success-soft' | 'destructive-soft' | 'warning-soft' | 'primary-soft' | 'secondary'
  > = {
    passed: 'success-soft',
    failed: 'destructive-soft',
    running: 'primary-soft',
    queued: 'warning-soft',
    cancelled: 'secondary',
  };

  const icons: Record<Run['status'], React.ReactNode> = {
    passed: <CheckCircleIcon className="h-4 w-4 mr-1" />,
    failed: <XCircleIcon className="h-4 w-4 mr-1" />,
    running: <LoaderIcon className="h-4 w-4 mr-1 animate-spin" />,
    queued: <ClockIcon className="h-4 w-4 mr-1" />,
    cancelled: <AlertCircleIcon className="h-4 w-4 mr-1" />,
  };

  const labels: Record<Run['status'], string> = {
    passed: 'Passed',
    failed: 'Failed',
    running: 'Running',
    queued: 'Queued',
    cancelled: 'Cancelled',
  };

  return (
    <Badge variant={variants[status]} className="capitalize text-sm px-3 py-1">
      {icons[status]}
      {labels[status]}
    </Badge>
  );
}

// Stat card component
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
    success: 'text-success',
    error: 'text-destructive',
    warning: 'text-warning',
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-secondary ${iconColors[variant]}`}>
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

// Loading skeleton
function RunDetailsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-lg" />
    </div>
  );
}

export default function RunDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { success, error: toastError } = useToast();

  const runId = params.id as string;

  const [run, setRun] = useState<RunDetails | null>(null);
  const [actions, setActions] = useState<RunAction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionsLoading, setActionsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Action states
  const [isCancelling, setIsCancelling] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Screenshot gallery state
  const screenshotGalleryRef = React.useRef<HTMLDivElement>(null);
  const [highlightedScreenshotId, setHighlightedScreenshotId] = useState<string | null>(null);

  // Handler for clicking screenshot indicator in actions table
  const handleScreenshotClick = useCallback((actionId: string) => {
    // Scroll to screenshot gallery
    screenshotGalleryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Briefly highlight the section
    setHighlightedScreenshotId(actionId);
    setTimeout(() => setHighlightedScreenshotId(null), 2000);
  }, []);

  // Fetch run details
  useEffect(() => {
    const fetchRun = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const runData = await api.getRun(runId);
        setRun(runData as RunDetails);
      } catch (err) {
        if (err instanceof ApiClientError) {
          setError(err.message);
        } else {
          setError('Failed to load run details');
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchRun();
  }, [runId]);

  // Fetch actions
  useEffect(() => {
    const fetchActions = async () => {
      setActionsLoading(true);

      try {
        const actionsData = await api.getRunActions(runId);
        setActions(actionsData);
      } catch (err) {
        console.error('Failed to load actions:', err);
      } finally {
        setActionsLoading(false);
      }
    };

    if (run) {
      fetchActions();
    }
  }, [runId, run]);

  // Auto-refresh for running/queued runs
  useEffect(() => {
    if (run && (run.status === 'running' || run.status === 'queued')) {
      const interval = setInterval(async () => {
        try {
          const runData = await api.getRun(runId);
          setRun(runData as RunDetails);

          if (runData.status !== 'running' && runData.status !== 'queued') {
            const actionsData = await api.getRunActions(runId);
            setActions(actionsData);
          }
        } catch {
          // Ignore refresh errors
        }
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [run, runId]);

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      const updatedRun = await api.cancelRun(runId);
      setRun(updatedRun as RunDetails);
      success('Run cancelled', 'The test run has been cancelled.');
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'Failed to cancel run';
      toastError('Cancel failed', msg);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      const newRun = await api.retryRun(runId);
      success('Run retried', 'A new test run has been queued.');
      router.push(`/runs/${newRun.id}`);
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'Failed to retry run';
      toastError('Retry failed', msg);
    } finally {
      setIsRetrying(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await api.deleteRun(runId);
      success('Run deleted', 'The test run has been deleted.');
      router.push('/runs');
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'Failed to delete run';
      toastError('Delete failed', msg);
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <RunDetailsSkeleton />
      </div>
    );
  }

  if (error || !run) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <XCircleIcon className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Run Not Found</h2>
        <p className="text-muted-foreground mb-4">{error || 'The run could not be found.'}</p>
        <Button variant="outline" onClick={() => router.push('/runs')}>
          <ArrowLeftIcon className="h-4 w-4 mr-2" />
          Back to Runs
        </Button>
      </div>
    );
  }

  const passedActions = actions.filter((a) => a.status === 'success').length;
  const failedActions = actions.filter((a) => a.status === 'failed').length;
  const skippedActions = actions.filter((a) => a.status === 'skipped').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/runs')}>
            <ArrowLeftIcon className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold tracking-tight">
                {run.recordingName || 'Test Run'}
              </h1>
              <StatusBadge status={run.status} />
            </div>
            <p className="text-muted-foreground">
              Run ID: {run.id.slice(0, 8)}...
              {run.startedAt && (
                <> • Started {formatRelativeTime(run.startedAt)}</>
              )}
            </p>
            {run.scheduleId && (
              <p className="text-sm mt-1">
                <span className="text-muted-foreground">Triggered by schedule: </span>
                <Link 
                  href={`/schedules/${run.scheduleId}`}
                  className="text-primary hover:underline font-medium"
                >
                  #{run.scheduleId.slice(0, 8)} {run.scheduleName || ''}
                </Link>
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {(run.status === 'running' || run.status === 'queued') && (
            <Button variant="outline" onClick={handleCancel} disabled={isCancelling}>
              {isCancelling ? (
                <LoaderIcon className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <StopCircleIcon className="h-4 w-4 mr-2" />
              )}
              Cancel
            </Button>
          )}
          {(run.status === 'failed' || run.status === 'cancelled') && (
            <Button onClick={handleRetry} disabled={isRetrying}>
              {isRetrying ? (
                <LoaderIcon className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCwIcon className="h-4 w-4 mr-2" />
              )}
              Retry
            </Button>
          )}
          {run.status !== 'running' && run.status !== 'queued' && (
            <Button variant="outline" onClick={() => setShowDeleteDialog(true)}>
              <TrashIcon className="h-4 w-4 mr-2" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Duration"
          value={run.durationMs ? formatDuration(run.durationMs) : run.duration ? formatDuration(run.duration) : '-'}
          icon={ClockIcon}
        />
        <StatCard
          title="Passed"
          value={passedActions}
          icon={CheckCircleIcon}
          variant="success"
        />
        <StatCard
          title="Failed"
          value={failedActions}
          icon={XCircleIcon}
          variant={failedActions > 0 ? 'error' : 'default'}
        />
        <StatCard
          title="Skipped"
          value={skippedActions}
          icon={AlertCircleIcon}
          variant={skippedActions > 0 ? 'warning' : 'default'}
        />
      </div>

      {/* Error Message */}
      {run.errorMessage && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <XCircleIcon className="h-5 w-5" />
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

      {/* Run Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Run Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Browser</p>
              <p className="font-medium capitalize">{run.browser}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Headless</p>
              <p className="font-medium">{run.headless ? 'Yes' : 'No'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Video</p>
              <p className="font-medium">{run.videoEnabled ? 'Enabled' : 'Disabled'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Triggered By</p>
              <p className="font-medium capitalize">{run.triggeredBy || 'Manual'}</p>
            </div>
            {run.timeout && (
              <div>
                <p className="text-muted-foreground">Timeout</p>
                <p className="font-medium">{formatDuration(run.timeout)}</p>
              </div>
            )}
            {run.recordingUrl && (
              <div className="col-span-2">
                <p className="text-muted-foreground">URL</p>
                <a
                  href={run.recordingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary hover:underline truncate block"
                >
                  {run.recordingUrl}
                </a>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Video Player */}
      {run.videoPath && (
        <Card>
          <CardHeader>
            <CardTitle>Video Recording</CardTitle>
          </CardHeader>
          <CardContent>
            <VideoPlayer runId={run.id} />
          </CardContent>
        </Card>
      )}

      {/* Screenshot Gallery */}
      {actions.some((a) => a.screenshotPath) && (
        <Card ref={screenshotGalleryRef} className={highlightedScreenshotId ? 'ring-2 ring-primary ring-offset-2 transition-all duration-300' : ''}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CameraIcon className="h-5 w-5" />
              Screenshots
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScreenshotGallery runId={run.id} actions={actions} />
          </CardContent>
        </Card>
      )}

      {/* Actions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Action Results</CardTitle>
        </CardHeader>
        <CardContent>
          <RunActionsTable 
            actions={actions} 
            isLoading={actionsLoading} 
            onScreenshotClick={handleScreenshotClick}
          />
        </CardContent>
      </Card>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
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
