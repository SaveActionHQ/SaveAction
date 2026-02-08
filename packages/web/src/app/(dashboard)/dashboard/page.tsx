'use client';

import { useEffect, useState } from 'react';
import {
  FileVideo,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  KeyRound,
  ArrowRight,
  AlertCircle,
  Loader2,
  Calendar,
} from 'lucide-react';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { api, type DashboardData } from '@/lib/api';
import { formatDistanceToNow, format } from 'date-fns';

function getStatusBadgeVariant(
  status: string
): 'success-soft' | 'destructive-soft' | 'warning-soft' | 'secondary' {
  switch (status) {
    case 'passed':
      return 'success-soft';
    case 'failed':
      return 'destructive-soft';
    case 'running':
    case 'queued':
      return 'warning-soft';
    default:
      return 'secondary';
  }
}

function formatDuration(ms: number | null): string {
  if (!ms) return '-';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatRelativeTime(dateStr: string): string {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true });
  } catch {
    return dateStr;
  }
}

function formatScheduleTime(dateStr: string | null): string {
  if (!dateStr) return 'Not scheduled';
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 24) {
      return `In ${formatDistanceToNow(date)}`;
    }
    return format(date, 'MMM d, h:mm a');
  } catch {
    return dateStr;
  }
}

// Loading skeleton components
function StatsLoadingSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-5 rounded" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-9 w-16 mb-2" />
            <Skeleton className="h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function RecentRunsLoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-6 w-16" />
        </div>
      ))}
    </div>
  );
}

function SchedulesLoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-6 w-20" />
        </div>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        setLoading(true);
        setError(null);
        const dashboardData = await api.getDashboard();
        setData(dashboardData);
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, []);

  // Build stats array from API data
  const stats = data
    ? [
        {
          title: 'Total Recordings',
          value: data.stats.recordings.total.toString(),
          description: 'Test recordings available',
          icon: FileVideo,
          color: 'text-primary',
        },
        {
          title: 'Total Runs',
          value: data.stats.runs.total.toString(),
          description: `${data.stats.runs.running} running, ${data.stats.runs.queued} queued`,
          icon: Play,
          color: 'text-primary',
        },
        {
          title: 'Pass Rate',
          value: `${data.stats.runs.passRate}%`,
          description: `${data.stats.runs.passed} passed of ${data.stats.runs.passed + data.stats.runs.failed} completed`,
          icon: CheckCircle,
          color: 'text-success',
        },
        {
          title: 'Failed Tests',
          value: data.stats.runs.failed.toString(),
          description: `${data.stats.runs.cancelled} cancelled`,
          icon: XCircle,
          color: 'text-destructive',
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">
            Dashboard
          </h1>
          <p className="text-muted-foreground">
            Overview of your test automation activity
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/recordings">View Recordings</Link>
          </Button>
          <Button asChild>
            <Link href="/runs/new">
              <Play className="mr-2 h-4 w-4" />
              New Run
            </Link>
          </Button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="flex items-center gap-4 pt-6">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <div className="flex-1">
              <h3 className="font-semibold">Failed to load dashboard</h3>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      {loading ? (
        <StatsLoadingSkeleton />
      ) : data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <Icon className={cn('h-5 w-5', stat.color)} />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stat.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stat.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : null}

      {/* Recent Runs & Schedules */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Runs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Runs</CardTitle>
              <CardDescription>Latest test execution results</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/runs">
                View all
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <RecentRunsLoadingSkeleton />
            ) : data && data.recentRuns.length > 0 ? (
              <div className="space-y-4">
                {data.recentRuns.map((run) => (
                  <Link
                    key={run.id}
                    href={`/runs/${run.id}`}
                    className="flex items-center justify-between gap-4 rounded-lg border border-border p-3 transition-colors hover:bg-secondary/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{run.recordingName}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatRelativeTime(run.createdAt)} · {formatDuration(run.durationMs)}
                      </p>
                    </div>
                    <Badge variant={getStatusBadgeVariant(run.status)}>
                      {run.status === 'passed' && (
                        <CheckCircle className="mr-1 h-3 w-3" />
                      )}
                      {run.status === 'failed' && (
                        <XCircle className="mr-1 h-3 w-3" />
                      )}
                      {run.status === 'running' && (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      )}
                      {run.status === 'queued' && (
                        <Clock className="mr-1 h-3 w-3" />
                      )}
                      {run.status}
                    </Badge>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Play className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-sm text-muted-foreground">No runs yet</p>
                <Button variant="outline" size="sm" className="mt-4" asChild>
                  <Link href="/runs/new">Start your first run</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Schedules */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Upcoming Schedules</CardTitle>
              <CardDescription>Next scheduled test runs</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/schedules">
                View all
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <SchedulesLoadingSkeleton />
            ) : data && data.upcomingSchedules.length > 0 ? (
              <div className="space-y-4">
                {data.upcomingSchedules.map((schedule) => (
                  <Link
                    key={schedule.id}
                    href={`/schedules/${schedule.id}`}
                    className="flex items-center justify-between gap-4 rounded-lg border border-border p-3 transition-colors hover:bg-secondary/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">
                        {schedule.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatScheduleTime(schedule.nextRunAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        <Calendar className="mr-1 h-3 w-3" />
                        {schedule.totalRuns > 0
                          ? `${schedule.successfulRuns}/${schedule.totalRuns}`
                          : 'No runs'}
                      </Badge>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Clock className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <p className="text-sm text-muted-foreground">No active schedules</p>
                <Button variant="outline" size="sm" className="mt-4" asChild>
                  <Link href="/schedules/new">Create a schedule</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks and shortcuts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Button variant="outline" className="h-auto flex-col gap-2 p-4" asChild>
              <Link href="/recordings">
                <FileVideo className="h-6 w-6 text-primary" />
                <span>View Recordings</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 p-4" asChild>
              <Link href="/runs/new">
                <Play className="h-6 w-6 text-primary" />
                <span>Run Test</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 p-4" asChild>
              <Link href="/schedules">
                <Clock className="h-6 w-6 text-primary" />
                <span>Manage Schedules</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 p-4" asChild>
              <Link href="/settings?tab=tokens">
                <KeyRound className="h-6 w-6 text-primary" />
                <span>API Tokens</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
