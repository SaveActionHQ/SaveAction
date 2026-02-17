'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Pencil,
  Play,
  Video,
  Camera,
  Clock,
  RotateCcw,
  Gauge,
  Maximize2,
  FileText,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/providers/toast-provider';
import { api, type Test, type Run } from '@/lib/api';
import { RunStatusBadge } from '@/components/runs/run-status-badge';
import { BrowserIcon, browserLabel } from '@/components/runs/browser-result-cell';
import { formatRelativeTime as formatTime, formatDuration, cn } from '@/lib/utils';

const BROWSER_LABELS: Record<string, string> = {
  chromium: 'Chrome',
  firefox: 'Firefox',
  webkit: 'Safari',
};

function formatRelativeTime(dateStr: string | null | undefined) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function statusBadge(status: string | null | undefined) {
  if (status === 'completed' || status === 'passed') return <Badge variant="success-soft">Passed</Badge>;
  if (status === 'failed') return <Badge variant="destructive-soft">Failed</Badge>;
  if (status === 'running') return <Badge variant="primary-soft">Running</Badge>;
  if (status === 'queued') return <Badge variant="warning-soft">Queued</Badge>;
  return <Badge variant="secondary">No runs</Badge>;
}

interface ActionStep {
  id: string;
  type: string;
  url?: string;
  selector?: Record<string, unknown>;
  value?: string;
  key?: string;
}

export default function TestDetailPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const suiteId = params.suiteId as string;
  const testId = params.testId as string;
  const toast = useToast();
  const router = useRouter();

  const [test, setTest] = React.useState<Test | null>(null);
  const [recentRuns, setRecentRuns] = React.useState<Run[]>([]);
  const [runsLoading, setRunsLoading] = React.useState(true);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isRunning, setIsRunning] = React.useState(false);

  const handleRunTest = React.useCallback(async () => {
    if (isRunning || !test) return;
    setIsRunning(true);
    try {
      const run = await api.runTest({
        testId,
        projectId,
        triggeredBy: 'manual',
      });
      toast.success(`Run queued for "${test.name}"`);
      router.push(`/projects/${projectId}/runs/${run.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start run');
    } finally {
      setIsRunning(false);
    }
  }, [isRunning, test, testId, projectId, toast, router]);

  const loadTest = React.useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.getTest(projectId, testId);
      setTest(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load test');
    } finally {
      setIsLoading(false);
    }
  }, [projectId, testId]);

  React.useEffect(() => {
    loadTest();
  }, [loadTest]);

  // Fetch recent runs for this test
  const loadRecentRuns = React.useCallback(async () => {
    try {
      setRunsLoading(true);
      const result = await api.listRuns({
        projectId,
        testId,
        limit: 5,
      });
      setRecentRuns(result.data);
    } catch {
      // Silently fail — section will show empty
      setRecentRuns([]);
    } finally {
      setRunsLoading(false);
    }
  }, [projectId, testId]);

  React.useEffect(() => {
    loadRecentRuns();
  }, [loadRecentRuns]);

  // Extract recording actions for preview
  const actions: ActionStep[] = React.useMemo(() => {
    if (!test?.recordingData) return [];
    const rec = test.recordingData as Record<string, unknown>;
    if (Array.isArray(rec.actions)) {
      return rec.actions.map((a: Record<string, unknown>, i: number) => ({
        id: (a.id as string) || `act_${String(i + 1).padStart(3, '0')}`,
        type: (a.type as string) || 'unknown',
        url: a.url as string | undefined,
        selector: a.selector as Record<string, unknown> | undefined,
        value: a.value as string | undefined,
        key: a.key as string | undefined,
      }));
    }
    return [];
  }, [test]);

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/projects/${projectId}/suites/${suiteId}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Test Details</h1>
        </div>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadTest}
            className="mt-2 text-destructive hover:text-destructive"
          >
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/projects/${projectId}/suites/${suiteId}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            {isLoading ? (
              <>
                <Skeleton className="h-7 w-48" />
                <Skeleton className="h-4 w-32 mt-1" />
              </>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold tracking-tight">{test?.name}</h1>
                  {statusBadge(test?.lastRunStatus)}
                </div>
                <p className="text-muted-foreground">
                  {test?.description || `${test?.actionCount || 0} actions`}
                </p>
              </>
            )}
          </div>
        </div>
        {!isLoading && (
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href={`/projects/${projectId}/suites/${suiteId}/tests/${testId}/edit`}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Link>
            </Button>
            <Button onClick={handleRunTest} disabled={isRunning}>
              <Play className="mr-2 h-4 w-4" />
              {isRunning ? 'Starting...' : 'Run Now'}
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
            <CardContent className="space-y-3">
              {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-4 w-full" />)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><Skeleton className="h-5 w-24" /></CardHeader>
            <CardContent>
              <div className="flex gap-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 w-20 rounded-lg" />)}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : test ? (
        <>
          {/* Config + Browsers row */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Configuration */}
            <Card>
              <CardHeader>
                <CardTitle>Configuration</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <ConfigRow
                    icon={<Video className="h-4 w-4" />}
                    label="Record Video"
                    value={test.config.video ? 'Enabled' : 'Disabled'}
                  />
                  <ConfigRow
                    icon={<Camera className="h-4 w-4" />}
                    label="Screenshots"
                    value={
                      test.config.screenshot === 'on'
                        ? 'Always'
                        : test.config.screenshot === 'off'
                          ? 'Never'
                          : 'On failure'
                    }
                  />
                  <ConfigRow
                    icon={<Clock className="h-4 w-4" />}
                    label="Timeout"
                    value={`${(test.config.timeout / 1000).toFixed(0)}s`}
                  />
                  <ConfigRow
                    icon={<RotateCcw className="h-4 w-4" />}
                    label="Retries"
                    value={String(test.config.retries)}
                  />
                  {test.config.slowMo > 0 && (
                    <ConfigRow
                      icon={<Gauge className="h-4 w-4" />}
                      label="Slow Motion"
                      value={`${test.config.slowMo}ms`}
                    />
                  )}
                  {test.config.viewport && (
                    <ConfigRow
                      icon={<Maximize2 className="h-4 w-4" />}
                      label="Viewport"
                      value={`${test.config.viewport.width}×${test.config.viewport.height}`}
                    />
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Browsers */}
            <Card>
              <CardHeader>
                <CardTitle>Target Browsers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {test.browsers.map((b) => (
                    <div
                      key={b}
                      className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5"
                    >
                      <BrowserIcon browser={b} className="h-4 w-4" />
                      <span className="text-sm font-medium">{BROWSER_LABELS[b] || b}</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Each run executes once per browser ({test.browsers.length} total)
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Test info */}
          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-2xl font-bold">{test.actionCount}</p>
                  <p className="text-xs text-muted-foreground mt-1">Recording Actions</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-2xl font-bold">
                    {test.lastRunAt ? formatRelativeTime(test.lastRunAt) : '—'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Last Run</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recording Preview */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Recording Preview</CardTitle>
              <span className="text-xs text-muted-foreground">
                {actions.length} steps
              </span>
            </CardHeader>
            <CardContent>
              {actions.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-8 text-center">
                  <p className="text-muted-foreground text-sm">No recording data available</p>
                </div>
              ) : (
                <div className="space-y-1 max-h-[400px] overflow-y-auto">
                  {actions.map((action, i) => (
                    <div
                      key={action.id}
                      className="flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                    >
                      <span className="text-xs font-mono text-muted-foreground w-8 shrink-0">
                        {i + 1}
                      </span>
                      <Badge variant="outline" className="shrink-0 text-xs font-mono">
                        {action.type}
                      </Badge>
                      <span className="text-muted-foreground truncate flex-1">
                        {actionDescription(action)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Runs */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Recent Runs</CardTitle>
              <Link
                href={`/projects/${projectId}/runs`}
                className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                View All <ExternalLink className="h-3 w-3" />
              </Link>
            </CardHeader>
            <CardContent>
              {runsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-14 rounded-lg" />
                  ))}
                </div>
              ) : recentRuns.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-8 text-center">
                  <p className="text-muted-foreground text-sm">No recent runs for this test</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={handleRunTest} disabled={isRunning}>
                    <Play className="mr-2 h-3.5 w-3.5" />
                    {isRunning ? 'Starting...' : 'Run Now'}
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {recentRuns.map((run) => (
                    <Link
                      key={run.id}
                      href={`/projects/${projectId}/runs/${run.id}`}
                      className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <RunStatusBadge status={run.status} size="sm" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 text-sm">
                            {(run.browsers && run.browsers.length > 0 ? run.browsers : [run.browser]).map((b) => (
                              <BrowserIcon key={b} browser={b} className="h-3.5 w-3.5 shrink-0" />
                            ))}
                            <span className="font-medium truncate">
                              {run.id.slice(0, 8)}...
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {run.triggeredBy && (
                              <span className="capitalize">{run.triggeredBy}</span>
                            )}
                            {run.startedAt && (
                              <> &middot; {formatTime(run.startedAt)}</>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {run.durationMs != null && run.durationMs > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {formatDuration(run.durationMs)}
                          </span>
                        )}
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}

function ConfigRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function actionDescription(action: ActionStep): string {
  const selector = action.selector;
  const target = selector
    ? (selector.id as string) ||
      (selector.dataTestId as string) ||
      (selector.ariaLabel as string) ||
      (selector.css as string) ||
      ''
    : '';

  switch (action.type) {
    case 'click':
      return target ? `Click on "${target}"` : 'Click';
    case 'input':
      return target
        ? `Type "${action.value?.substring(0, 30) || ''}" into "${target}"`
        : `Type "${action.value?.substring(0, 40) || ''}"`;
    case 'navigation':
      return `Navigate to ${action.url || ''}`;
    case 'select':
      return target ? `Select "${action.value || ''}" in "${target}"` : 'Select option';
    case 'keypress':
      return `Press ${action.key || 'key'}`;
    case 'scroll':
      return 'Scroll page';
    case 'hover':
      return target ? `Hover over "${target}"` : 'Hover';
    case 'submit':
      return target ? `Submit form "${target}"` : 'Submit form';
    default:
      return action.type;
  }
}
