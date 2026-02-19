'use client';

import * as React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Ban,
  Trash2,
  Loader2,
  Timer,
  Camera,
  Monitor,
  Eye,
  Video,
  Settings2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { RunStatusBadge } from '@/components/runs/run-status-badge';
import { RunMatrix, RunMatrixSkeleton } from '@/components/runs/run-matrix';
import { BrowserIcon, browserLabel } from '@/components/runs/browser-result-cell';
import { RunActionsTable, type RunAction } from '@/components/runs/run-actions-table';
import { VideoPlayer } from '@/components/runs/video-player';
import { ScreenshotGallery } from '@/components/runs/screenshot-gallery';
import { SuiteRunDetail } from '@/components/runs/suite-run-detail';
import { useToast } from '@/components/providers/toast-provider';
import {
  api,
  API_BASE_URL,
  type Run,
  type RunBrowserResult,
  ApiClientError,
} from '@/lib/api';
import { formatRelativeTime, formatDuration, cn } from '@/lib/utils';
import { useProjectFromSlug } from '@/lib/hooks';

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

// ─── Config Row ─────────────────────────────────────────────────

function ConfigRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-medium text-sm">{value}</p>
    </div>
  );
}

// ─── Loading Skeleton ───────────────────────────────────────────

function RunDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded-md" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
      <RunMatrixSkeleton />
      <Skeleton className="h-64 rounded-lg" />
    </div>
  );
}

// ─── Page Component ─────────────────────────────────────────────

export default function RunDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { success, error: toastError } = useToast();
  const { projectSlug, projectId } = useProjectFromSlug();

  const runId = params.runId as string;

  // Data
  const [run, setRun] = useState<Run | null>(null);
  const [actions, setActions] = useState<RunAction[]>([]);
  const [browserResults, setBrowserResults] = useState<RunBrowserResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionsLoading, setActionsLoading] = useState(true);
  const [browserResultsLoading, setBrowserResultsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Action states
  const [isCancelling, setIsCancelling] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState('actions');

  // Selected browser for video playback
  const [selectedVideoBrowser, setSelectedVideoBrowser] = useState<string | undefined>(undefined);

  // Selected browser for screenshots
  const [selectedScreenshotBrowser, setSelectedScreenshotBrowser] = useState<string | undefined>(undefined);

  // Screenshot gallery
  const screenshotGalleryRef = useRef<HTMLDivElement>(null);
  const [highlightedScreenshotId, setHighlightedScreenshotId] = useState<string | null>(null);

  const handleScreenshotClick = useCallback((actionId: string) => {
    screenshotGalleryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setHighlightedScreenshotId(actionId);
    setTimeout(() => setHighlightedScreenshotId(null), 2000);
  }, []);

  // ─── Data Fetching ────────────────────────────────────────────

  const fetchRun = useCallback(async () => {
    try {
      const runData = await api.getRun(runId);
      setRun(runData);
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Failed to load run details');
      }
    } finally {
      setIsLoading(false);
    }
  }, [runId]);

  const fetchActions = useCallback(async () => {
    setActionsLoading(true);
    try {
      const data = await api.getRunActions(runId);
      // Merge DB actions with any SSE-delivered actions already in state.
      // DB actions are authoritative for completed actions; SSE may have
      // newer in-progress actions not yet in DB.
      setActions((prev) => {
        if (prev.length === 0) return data;
        if (data.length === 0) return prev;

        // Build a map of DB actions keyed by actionId+browser
        const dbMap = new Map<string, RunAction>();
        for (const a of data) {
          const key = `${a.actionId}:${a.browser ?? ''}`;
          dbMap.set(key, a);
        }

        // Build a map of SSE actions keyed by actionId+browser
        const sseMap = new Map<string, RunAction>();
        for (const a of prev) {
          const key = `${a.actionId}:${a.browser ?? ''}`;
          sseMap.set(key, a);
        }

        // Merge: prefer DB data (more complete), add SSE-only entries
        const merged = new Map<string, RunAction>();
        for (const [key, a] of dbMap) {
          merged.set(key, a);
        }
        for (const [key, a] of sseMap) {
          if (!merged.has(key)) {
            // SSE action not yet in DB (currently executing or pending)
            merged.set(key, a);
          }
        }

        // Sort by actionIndex then browser
        return Array.from(merged.values()).sort((a, b) => {
          const idxDiff = (a.actionIndex ?? 0) - (b.actionIndex ?? 0);
          if (idxDiff !== 0) return idxDiff;
          return (a.browser ?? '').localeCompare(b.browser ?? '');
        });
      });
    } catch {
      // Silently fail — actions table will show empty
    } finally {
      setActionsLoading(false);
    }
  }, [runId]);

  const fetchBrowserResults = useCallback(async () => {
    setBrowserResultsLoading(true);
    try {
      const data = await api.getRunBrowserResults(runId);
      setBrowserResults(data);
    } catch {
      // May not have browser results (single-browser run)
      setBrowserResults([]);
    } finally {
      setBrowserResultsLoading(false);
    }
  }, [runId]);

  // Initial load
  useEffect(() => {
    fetchRun();
  }, [fetchRun]);

  // Fetch actions + browser results when run is loaded
  useEffect(() => {
    if (run) {
      fetchActions();
      fetchBrowserResults();
    }
  }, [run, fetchActions, fetchBrowserResults]);

  // SSE connection for real-time progress updates
  const sseActiveRef = useRef(false);

  useEffect(() => {
    if (!run || (run.status !== 'running' && run.status !== 'queued')) {
      sseActiveRef.current = false;
      return;
    }

    const controller = new AbortController();
    let isCleanedUp = false;

    const connectSSE = async () => {
      const token = api.getAccessToken();
      if (!token) return;

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/v1/runs/${runId}/progress/stream`,
          {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          }
        );

        if (!response.ok || !response.body) return;
        sseActiveRef.current = true;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (!isCleanedUp) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const chunks = buffer.split('\n\n');
          buffer = chunks.pop() || '';

          for (const chunk of chunks) {
            const lines = chunk.split('\n');
            let eventType = '';
            let eventData = '';

            for (const line of lines) {
              if (line.startsWith('event: ')) eventType = line.slice(7);
              else if (line.startsWith('data: ')) eventData = line.slice(6);
            }

            if (!eventType || !eventData) continue;

            try {
              const data = JSON.parse(eventData);

              if (eventType === 'run:started') {
                // Populate all actions as 'pending' for this browser
                if (data.actions && Array.isArray(data.actions)) {
                  const browser = data.browser as string | undefined;
                  setActions((prev) => {
                    const pendingActions: RunAction[] = data.actions.map(
                      (a: { id: string; type: string }, i: number) => ({
                        id: browser ? `${a.id}-${browser}` : a.id,
                        actionId: a.id,
                        actionType: a.type,
                        actionIndex: i,
                        status: 'pending' as const,
                        browser,
                      })
                    );
                    // Only add actions that don't already exist
                    const newActions = pendingActions.filter(
                      (pa) => !prev.some((a) => a.actionId === pa.actionId && a.browser === pa.browser)
                    );
                    return [...prev, ...newActions];
                  });
                }
              } else if (eventType === 'action:started') {
                const browser = data.browser as string | undefined;
                setActions((prev) => {
                  const exists = prev.find(
                    (a) => a.actionId === data.actionId && a.browser === browser
                  );
                  if (exists) {
                    return prev.map((a) =>
                      a.actionId === data.actionId && a.browser === browser
                        ? { ...a, status: 'running' as const }
                        : a
                    );
                  }
                  return [
                    ...prev,
                    {
                      id: browser ? `${data.actionId}-${browser}` : data.actionId,
                      actionId: data.actionId,
                      actionType: data.actionType,
                      actionIndex: data.actionIndex,
                      status: 'running' as const,
                      browser,
                    },
                  ];
                });
              } else if (eventType === 'action:success') {
                const browser = data.browser as string | undefined;
                setActions((prev) => {
                  const exists = prev.find(
                    (a) => a.actionId === data.actionId && a.browser === browser
                  );
                  const action: RunAction = {
                    id: browser ? `${data.actionId}-${browser}` : data.actionId,
                    actionId: data.actionId,
                    actionType: data.actionType,
                    actionIndex: data.actionIndex,
                    status: 'success',
                    durationMs: data.durationMs,
                    selectorUsed: data.selectorUsed,
                    browser,
                  };
                  if (exists) {
                    return prev.map((a) =>
                      a.actionId === data.actionId && a.browser === browser ? action : a
                    );
                  }
                  return [...prev, action];
                });
              } else if (eventType === 'action:failed') {
                const browser = data.browser as string | undefined;
                setActions((prev) => {
                  const exists = prev.find(
                    (a) => a.actionId === data.actionId && a.browser === browser
                  );
                  const action: RunAction = {
                    id: browser ? `${data.actionId}-${browser}` : data.actionId,
                    actionId: data.actionId,
                    actionType: data.actionType,
                    actionIndex: data.actionIndex,
                    status: 'failed',
                    durationMs: data.durationMs,
                    errorMessage: data.errorMessage,
                    browser,
                  };
                  if (exists) {
                    return prev.map((a) =>
                      a.actionId === data.actionId && a.browser === browser ? action : a
                    );
                  }
                  return [...prev, action];
                });
              } else if (eventType === 'action:skipped') {
                const browser = data.browser as string | undefined;
                setActions((prev) => {
                  const exists = prev.find(
                    (a) => a.actionId === data.actionId && a.browser === browser
                  );
                  const action: RunAction = {
                    id: browser ? `${data.actionId}-${browser}` : data.actionId,
                    actionId: data.actionId,
                    actionType: data.actionType,
                    actionIndex: data.actionIndex,
                    status: 'skipped',
                    errorMessage: data.reason,
                    browser,
                  };
                  if (exists) {
                    return prev.map((a) =>
                      a.actionId === data.actionId && a.browser === browser ? action : a
                    );
                  }
                  return [...prev, action];
                });
              } else if (
                eventType === 'run:completed' ||
                eventType === 'run:error'
              ) {
                // Refresh all data when run finishes
                fetchRun();
                fetchActions();
                fetchBrowserResults();
              }
            } catch {
              // Ignore individual event parse errors
            }
          }
        }
      } catch {
        // SSE failed — fallback polling will handle it
        sseActiveRef.current = false;
      }
    };

    connectSSE();

    return () => {
      isCleanedUp = true;
      sseActiveRef.current = false;
      controller.abort();
    };
  }, [run?.status, runId, fetchRun, fetchActions, fetchBrowserResults]);

  // Fallback polling for running/queued runs (if SSE is not active)
  useEffect(() => {
    if (!run || (run.status !== 'running' && run.status !== 'queued')) return;

    const interval = setInterval(async () => {
      // Skip polling if SSE is active and working
      if (sseActiveRef.current) return;

      try {
        const runData = await api.getRun(runId);
        setRun(runData);

        // Always refresh actions during active runs to show progress
        fetchActions();

        // When finished, also refresh browser results
        if (runData.status !== 'running' && runData.status !== 'queued') {
          fetchBrowserResults();
        }
      } catch {
        // Ignore refresh errors
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [run, runId, fetchActions, fetchBrowserResults]);

  // ─── Actions ──────────────────────────────────────────────────

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      const updatedRun = await api.cancelRun(runId);
      setRun(updatedRun);
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
      router.push(`/projects/${projectSlug}/runs/${newRun.id}`);
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
      router.push(`/projects/${projectSlug}/runs`);
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'Failed to delete run';
      toastError('Delete failed', msg);
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  // Derived data (must be before early returns for Rules of Hooks)
  // Derive browsers with screenshots from browserResults (works for both old and new runs)
  const browsersWithScreenshots = React.useMemo(() => {
    return browserResults.filter((r) => r.screenshotPath).map((r) => r.browser);
  }, [browserResults]);
  // Check if actions have per-browser data (new runs have browser field populated)
  const actionsHaveBrowserData = React.useMemo(() => {
    return actions.some((a) => a.browser);
  }, [actions]);
  const screenshotActions = React.useMemo(() => {
    // For old runs without per-action browser data, show all actions regardless of tab
    if (!actionsHaveBrowserData || browsersWithScreenshots.length <= 1) return actions;
    const activeBrowser = selectedScreenshotBrowser || browsersWithScreenshots[0];
    return actions.filter((a) => a.browser === activeBrowser);
  }, [actions, selectedScreenshotBrowser, browsersWithScreenshots, actionsHaveBrowserData]);

  // ─── Render ───────────────────────────────────────────────────

  if (isLoading) {
    return <RunDetailSkeleton />;
  }

  if (error || !run) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <XCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Run Not Found</h2>
        <p className="text-muted-foreground mb-4">{error || 'The run could not be found.'}</p>
        <Button variant="outline" asChild>
          <Link href={`/projects/${projectSlug}/runs`}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Runs
          </Link>
        </Button>
      </div>
    );
  }

  // Suite runs get a completely different layout
  if (run.runType === 'suite') {
    return (
      <SuiteRunDetail
        run={run}
        projectSlug={projectSlug}
        projectId={projectId}
        onRunUpdated={setRun}
      />
    );
  }

  const isActive = run.status === 'running' || run.status === 'queued';
  const passedActions = actions.filter((a) => a.status === 'success').length;
  const failedActions = actions.filter((a) => a.status === 'failed').length;
  const skippedActions = actions.filter((a) => a.status === 'skipped').length;
  const hasScreenshots = actions.some((a) => a.screenshotPath);
  // Video is available if the parent run or any browser result has a videoPath
  const hasVideo = !!run.videoPath || browserResults.some((r) => r.videoPath);
  // Browsers that have videos
  const browsersWithVideo = browserResults.filter((r) => r.videoPath);
  const title = run.testName || run.recordingName || 'Test Run';

  // Progress for active runs
  const progress = (() => {
    const total = run.actionsTotal ?? 0;
    if (total === 0) return 0;
    const done = (run.actionsExecuted ?? 0) + (run.actionsFailed ?? 0) + (run.actionsSkipped ?? 0);
    return Math.round((done / total) * 100);
  })();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/projects/${projectSlug}/runs`}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
              <RunStatusBadge status={run.status} />
            </div>
            <p className="text-muted-foreground text-sm">
              Run ID: {run.id.slice(0, 8)}...
              {run.startedAt && (
                <> &middot; Started {formatRelativeTime(run.startedAt)}</>
              )}
              {run.triggeredBy && (
                <> &middot; <span className="capitalize">{run.triggeredBy}</span></>
              )}
            </p>
            {run.scheduleId && (
              <p className="text-sm mt-1">
                <span className="text-muted-foreground">Triggered by schedule </span>
                <span className="text-primary font-medium">
                  #{run.scheduleId.slice(0, 8)}
                </span>
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {isActive && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={isCancelling}
            >
              {isCancelling ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Ban className="h-4 w-4 mr-2" />
              )}
              Cancel
            </Button>
          )}
          {(run.status === 'failed' || run.status === 'cancelled') && (
            <Button size="sm" onClick={handleRetry} disabled={isRetrying}>
              {isRetrying ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Retry
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

      {/* Progress bar for active runs */}
      {isActive && run.actionsTotal != null && run.actionsTotal > 0 && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">
              {(run.actionsExecuted ?? 0) + (run.actionsFailed ?? 0)}/{run.actionsTotal} actions
            </span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Duration"
          value={
            run.durationMs
              ? formatDuration(run.durationMs)
              : run.duration
                ? formatDuration(run.duration)
                : isActive
                  ? '...'
                  : '-'
          }
          icon={Timer}
        />
        <StatCard
          title="Passed"
          value={passedActions}
          icon={CheckCircle}
          variant="success"
        />
        <StatCard
          title="Failed"
          value={failedActions}
          icon={XCircle}
          variant={failedActions > 0 ? 'error' : 'default'}
        />
        <StatCard
          title="Skipped"
          value={skippedActions}
          icon={AlertCircle}
          variant={skippedActions > 0 ? 'warning' : 'default'}
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

      {/* Browser Results Matrix */}
      {browserResultsLoading ? (
        <RunMatrixSkeleton />
      ) : (
        <RunMatrix
          run={run}
          browserResults={browserResults}
        />
      )}

      {/* Run Configuration */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Run Configuration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <ConfigRow
              label="Browser"
              value={
                browserResults.length > 1 ? (
                  <span className="flex items-center gap-2 flex-wrap">
                    {browserResults.map((br) => (
                      <span key={br.browser} className="flex items-center gap-1">
                        <BrowserIcon browser={br.browser} className="h-4 w-4" />
                        {browserLabel(br.browser)}
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <BrowserIcon browser={run.browser} className="h-4 w-4" />
                    {browserLabel(run.browser)}
                  </span>
                )
              }
            />
            <ConfigRow
              label="Video"
              value={run.videoEnabled ? 'Enabled' : 'Disabled'}
            />
            <ConfigRow
              label="Triggered By"
              value={
                <span className="capitalize">{run.triggeredBy || 'Manual'}</span>
              }
            />
            {run.recordingUrl && (
              <div className="col-span-2">
                <p className="text-sm text-muted-foreground">URL</p>
                <a
                  href={run.recordingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-sm text-primary hover:underline truncate block"
                >
                  {run.recordingUrl}
                </a>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tabbed Content: Actions / Video / Screenshots */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="actions">
            Action Results
          </TabsTrigger>
          {hasVideo && (
            <TabsTrigger value="video">
              Video
            </TabsTrigger>
          )}
          {hasScreenshots && (
            <TabsTrigger value="screenshots">
              Screenshots
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="actions">
          <Card>
            <CardContent className="p-4">
              <RunActionsTable
                actions={actions}
                isLoading={actionsLoading}
                runId={runId}
                onScreenshotClick={
                  hasScreenshots
                    ? (actionId) => {
                        setActiveTab('screenshots');
                        setTimeout(() => handleScreenshotClick(actionId), 100);
                      }
                    : undefined
                }
              />
            </CardContent>
          </Card>
        </TabsContent>

        {hasVideo && (
          <TabsContent value="video">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <Video className="h-4 w-4" />
                    Video Recording
                  </CardTitle>
                  {/* Browser selector for multi-browser runs */}
                  {browsersWithVideo.length > 1 && (
                    <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
                      {browsersWithVideo.map((br) => (
                        <button
                          key={br.browser}
                          onClick={() => setSelectedVideoBrowser(br.browser)}
                          className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                            (selectedVideoBrowser === br.browser || (!selectedVideoBrowser && br.browser === browsersWithVideo[0]?.browser))
                              ? 'bg-background text-foreground shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          <BrowserIcon browser={br.browser} className="h-3.5 w-3.5" />
                          {browserLabel(br.browser)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <VideoPlayer
                  runId={run.id}
                  browser={
                    browsersWithVideo.length > 1
                      ? (selectedVideoBrowser || browsersWithVideo[0]?.browser)
                      : undefined
                  }
                />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {hasScreenshots && (
          <TabsContent value="screenshots">
            <Card
              ref={screenshotGalleryRef}
              className={cn(
                highlightedScreenshotId &&
                  'ring-2 ring-primary ring-offset-2 transition-all duration-300'
              )}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-medium flex items-center gap-2">
                    <Camera className="h-4 w-4" />
                    Screenshots
                  </CardTitle>
                  {/* Browser selector for multi-browser runs */}
                  {browsersWithScreenshots.length > 1 && (
                    <div className="flex items-center gap-1 bg-secondary rounded-lg p-1">
                      {browsersWithScreenshots.map((browser) => (
                        <button
                          key={browser}
                          onClick={() => setSelectedScreenshotBrowser(browser)}
                          className={cn(
                            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                            (selectedScreenshotBrowser === browser || (!selectedScreenshotBrowser && browser === browsersWithScreenshots[0]))
                              ? 'bg-background text-foreground shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          )}
                        >
                          <BrowserIcon browser={browser} className="h-3.5 w-3.5" />
                          {browserLabel(browser)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <ScreenshotGallery
                  runId={run.id}
                  actions={screenshotActions}
                  browser={
                    browsersWithScreenshots.length > 1 && actionsHaveBrowserData
                      ? (selectedScreenshotBrowser || browsersWithScreenshots[0])
                      : undefined
                  }
                />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

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
