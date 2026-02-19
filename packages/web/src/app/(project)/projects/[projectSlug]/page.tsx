'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  FolderOpen,
  TestTube2,
  TrendingUp,
  Plus,
  ArrowRight,
  Clock,
  Calendar,
  CheckCircle2,
  XCircle,
  Play,
  Timer,
  Layers,
  FileText,
  Activity,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useProjects } from '@/components/providers/project-provider';
import { useProjectFromSlug } from '@/lib/hooks';
import {
  api,
  DashboardData,
  DashboardRecentRun,
  DashboardUpcomingSchedule,
  DashboardRunTrendEntry,
} from '@/lib/api';

// ─── Helpers ────────────────────────────────────────────────

function formatRelativeTime(dateStr: string) {
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

function formatDuration(ms: number | null) {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  const secs = ms / 1000;
  if (secs < 60) return `${secs.toFixed(1)}s`;
  const mins = Math.floor(secs / 60);
  const remainingSecs = Math.round(secs % 60);
  return `${mins}m ${remainingSecs}s`;
}

function statusColor(status: string) {
  switch (status) {
    case 'passed':
      return 'success-soft' as const;
    case 'failed':
      return 'destructive-soft' as const;
    case 'running':
      return 'warning-soft' as const;
    default:
      return 'secondary' as const;
  }
}

function runDisplayName(run: DashboardRecentRun) {
  if (run.testName) return run.testName;
  if (run.recordingName) return run.recordingName;
  return run.id.slice(0, 8);
}

function runTypeIcon(run: DashboardRecentRun) {
  switch (run.runType) {
    case 'suite':
      return <Layers className="h-4 w-4 text-primary shrink-0" />;
    case 'test':
      return <TestTube2 className="h-4 w-4 text-primary shrink-0" />;
    default:
      return <FileText className="h-4 w-4 text-primary shrink-0" />;
  }
}

// ─── Mini Bar Chart (SVG) ───────────────────────────────────

function RunTrendChart({ data }: { data: DashboardRunTrendEntry[] }) {
  if (!data.length) return null;

  const maxTotal = Math.max(...data.map((d) => d.total), 1);
  const barWidth = 100 / data.length;
  const chartHeight = 120;
  const chartWidth = 100; // percentage-based viewBox

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${data.length * 24} ${chartHeight + 20}`}
        className="w-full h-32"
        preserveAspectRatio="none"
      >
        {data.map((entry, i) => {
          const passedH = (entry.passed / maxTotal) * chartHeight;
          const failedH = (entry.failed / maxTotal) * chartHeight;
          const otherH = ((entry.total - entry.passed - entry.failed) / maxTotal) * chartHeight;
          const x = i * 24 + 4;
          const barW = 16;

          // Stack: passed (bottom), failed (middle), other (top)
          const passedY = chartHeight - passedH;
          const failedY = passedY - failedH;
          const otherY = failedY - otherH;

          const isToday = i === data.length - 1;

          return (
            <g key={i}>
              {/* Background bar (subtle) */}
              <rect
                x={x}
                y={0}
                width={barW}
                height={chartHeight}
                rx={3}
                className="fill-muted/30"
              />
              {/* Passed */}
              {entry.passed > 0 && (
                <rect
                  x={x}
                  y={passedY}
                  width={barW}
                  height={passedH}
                  rx={entry.failed === 0 && entry.total === entry.passed ? 3 : 0}
                  className="fill-emerald-500 dark:fill-emerald-400"
                  opacity={isToday ? 1 : 0.8}
                />
              )}
              {/* Failed */}
              {entry.failed > 0 && (
                <rect
                  x={x}
                  y={failedY}
                  width={barW}
                  height={failedH}
                  className="fill-red-500 dark:fill-red-400"
                  opacity={isToday ? 1 : 0.8}
                />
              )}
              {/* Other (queued/running/cancelled) */}
              {entry.total - entry.passed - entry.failed > 0 && (
                <rect
                  x={x}
                  y={otherY}
                  width={barW}
                  height={otherH}
                  className="fill-amber-400 dark:fill-amber-300"
                  opacity={isToday ? 1 : 0.6}
                />
              )}
              {/* Date label (every 3rd + first + last) */}
              {(i === 0 || i === data.length - 1 || i % 3 === 0) && (
                <text
                  x={x + barW / 2}
                  y={chartHeight + 14}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[7px]"
                >
                  {new Date(entry.date).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {/* Legend */}
      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground mt-1">
        <div className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" />
          Passed
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-500" />
          Failed
        </div>
        <div className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-400" />
          Other
        </div>
      </div>
    </div>
  );
}

// ─── Pass Rate Ring (SVG) ───────────────────────────────────

function PassRateRing({ rate }: { rate: number }) {
  const radius = 36;
  const stroke = 6;
  const circumference = 2 * Math.PI * radius;
  const progress = (rate / 100) * circumference;
  const color =
    rate >= 80 ? 'text-emerald-500' : rate >= 50 ? 'text-amber-500' : 'text-red-500';

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={90} height={90} className="-rotate-90">
        <circle
          cx={45}
          cy={45}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted"
        />
        <circle
          cx={45}
          cy={45}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          strokeLinecap="round"
          className={`${color} stroke-current transition-all duration-700`}
        />
      </svg>
      <span className="absolute text-lg font-bold">{Math.round(rate)}%</span>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────────

export default function ProjectOverviewPage() {
  const { projectSlug, projectId, project } = useProjectFromSlug();
  const [dashboard, setDashboard] = React.useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setIsLoading(true);
        const data = await api.getDashboard(projectId);
        if (!cancelled) setDashboard(data);
      } catch {
        // Silently handle
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const stats = dashboard?.stats;
  const recentRuns = dashboard?.recentRuns ?? [];
  const upcomingSchedules = dashboard?.upcomingSchedules ?? [];
  const runTrend = dashboard?.runTrend ?? [];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {project?.name || 'Project Overview'}
          </h1>
          <p className="text-muted-foreground">
            {project?.description || 'Project dashboard and quick stats'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href={`/projects/${projectSlug}/suites/new`}>
              <Plus className="mr-2 h-4 w-4" />
              New Suite
            </Link>
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Runs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Runs</CardTitle>
            <Play className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <div className="text-2xl font-bold">{stats?.runs.total ?? 0}</div>
            )}
            <p className="text-xs text-muted-foreground">
              {isLoading
                ? ''
                : `${stats?.runs.passed ?? 0} passed · ${stats?.runs.failed ?? 0} failed`}
            </p>
          </CardContent>
        </Card>

        {/* Pass Rate */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pass Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : stats && stats.runs.total > 0 ? (
              <div className="text-2xl font-bold">{stats.runs.passRate}%</div>
            ) : (
              <div className="text-2xl font-bold text-muted-foreground">—</div>
            )}
            <p className="text-xs text-muted-foreground">Overall success rate</p>
          </CardContent>
        </Card>

        {/* Recordings */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recordings</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <div className="text-2xl font-bold">{stats?.recordings.total ?? 0}</div>
            )}
            <p className="text-xs text-muted-foreground">In recording library</p>
          </CardContent>
        </Card>

        {/* Schedules */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Schedules</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <div className="text-2xl font-bold">{stats?.schedules.total ?? 0}</div>
            )}
            <p className="text-xs text-muted-foreground">
              {isLoading
                ? ''
                : `${stats?.schedules.active ?? 0} active · ${stats?.schedules.paused ?? 0} paused`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Run Trend + Pass Rate Ring */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Run trend chart (2 cols) */}
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Run Trend (14 days)
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/projects/${projectSlug}/runs`}>
                View all
                <ArrowRight className="ml-1 h-3 w-3" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-32 w-full rounded-lg" />
            ) : runTrend.every((d) => d.total === 0) ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center">
                <Activity className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No runs in the last 14 days</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Run tests to see trend data here
                </p>
              </div>
            ) : (
              <RunTrendChart data={runTrend} />
            )}
          </CardContent>
        </Card>

        {/* Pass Rate Ring (1 col) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Pass Rate
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center gap-4">
            {isLoading ? (
              <Skeleton className="h-[90px] w-[90px] rounded-full" />
            ) : stats && stats.runs.total > 0 ? (
              <>
                <PassRateRing rate={stats.runs.passRate} />
                <div className="grid grid-cols-2 gap-4 text-center w-full">
                  <div>
                    <div className="flex items-center justify-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span className="text-lg font-semibold">{stats.runs.passed}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Passed</p>
                  </div>
                  <div>
                    <div className="flex items-center justify-center gap-1 text-red-600 dark:text-red-400">
                      <XCircle className="h-3.5 w-3.5" />
                      <span className="text-lg font-semibold">{stats.runs.failed}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Failed</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-muted-foreground">No completed runs yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Recent Runs + Upcoming Schedules */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Runs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Recent Runs
            </CardTitle>
            {recentRuns.length > 0 && (
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/projects/${projectSlug}/runs`}>
                  View all
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            ) : recentRuns.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center">
                <Play className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No runs yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Execute a test to see results here
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentRuns.map((run) => (
                  <Link
                    key={run.id}
                    href={`/projects/${projectSlug}/runs/${run.id}`}
                    className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {runTypeIcon(run)}
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{runDisplayName(run)}</p>
                        <p className="text-xs text-muted-foreground">
                          {run.triggeredBy === 'schedule' ? 'Scheduled' : 'Manual'} ·{' '}
                          {formatRelativeTime(run.createdAt)} ·{' '}
                          {formatDuration(run.durationMs)}
                        </p>
                      </div>
                    </div>
                    <Badge variant={statusColor(run.status)}>{run.status}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Schedules */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Upcoming Schedules
            </CardTitle>
            {upcomingSchedules.length > 0 && (
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/projects/${projectSlug}/schedules`}>
                  View all
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-14 w-full rounded-lg" />
                ))}
              </div>
            ) : upcomingSchedules.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center">
                <Calendar className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No upcoming schedules</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Create a schedule to automate test runs
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {upcomingSchedules.map((sched) => (
                  <Link
                    key={sched.id}
                    href={`/projects/${projectSlug}/schedules/${sched.id}`}
                    className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-muted transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{sched.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {sched.targetType} · {sched.cronExpression}
                        {sched.nextRunAt && (
                          <> · next {formatRelativeTime(sched.nextRunAt)}</>
                        )}
                      </p>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className="text-xs font-medium">
                        {sched.totalRuns} runs
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {sched.successfulRuns}
                        <span className="text-emerald-600 dark:text-emerald-400"> ✓</span>
                        {' '}{sched.failedRuns}
                        <span className="text-red-600 dark:text-red-400"> ✗</span>
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              href={`/projects/${projectSlug}/suites`}
              className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-muted transition-colors group"
            >
              <div className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">Test Suites</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </Link>
            <Link
              href={`/projects/${projectSlug}/runs`}
              className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-muted transition-colors group"
            >
              <div className="flex items-center gap-2">
                <Play className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">Run History</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </Link>
            <Link
              href={`/projects/${projectSlug}/schedules`}
              className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-muted transition-colors group"
            >
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">Schedules</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </Link>
            <Link
              href={`/projects/${projectSlug}/library`}
              className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-muted transition-colors group"
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">Recording Library</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
