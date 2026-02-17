'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  FolderOpen,
  TestTube2,
  Play,
  TrendingUp,
  Plus,
  ArrowRight,
  Clock,
  Calendar,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useProjects } from '@/components/providers/project-provider';
import { api, TestSuiteWithStats } from '@/lib/api';

export default function ProjectOverviewPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const { projects } = useProjects();
  const [suites, setSuites] = React.useState<TestSuiteWithStats[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const project = projects.find((p) => p.id === projectId);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setIsLoading(true);
        const data = await api.listAllSuites(projectId);
        if (!cancelled) setSuites(data);
      } catch {
        // Silently handle - stats will show as 0
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [projectId]);

  const totalTests = suites.reduce((sum, s) => sum + (s.testCount || 0), 0);
  const suitesWithRuns = suites.filter((s) => s.passRate != null);
  const avgPassRate =
    suitesWithRuns.length > 0
      ? Math.round(
          suitesWithRuns.reduce((sum, s) => sum + (s.passRate ?? 0), 0) /
            suitesWithRuns.length
        )
      : null;

  const recentSuites = [...suites]
    .filter((s) => s.lastRunAt)
    .sort((a, b) => new Date(b.lastRunAt!).getTime() - new Date(a.lastRunAt!).getTime())
    .slice(0, 5);

  const formatRelativeTime = (dateStr: string) => {
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
  };

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
            <Link href={`/projects/${projectId}/suites/new`}>
              <Plus className="mr-2 h-4 w-4" />
              New Suite
            </Link>
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Test Suites</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <div className="text-2xl font-bold">{suites.length}</div>
            )}
            <p className="text-xs text-muted-foreground">Organized test groups</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tests</CardTitle>
            <TestTube2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <div className="text-2xl font-bold">{totalTests}</div>
            )}
            <p className="text-xs text-muted-foreground">Individual test cases</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pass Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-12" />
            ) : (
              <div className="text-2xl font-bold">
                {avgPassRate != null ? `${avgPassRate}%` : '—'}
              </div>
            )}
            <p className="text-xs text-muted-foreground">Overall success rate</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <div className="text-2xl font-bold">
                {recentSuites.length > 0
                  ? formatRelativeTime(recentSuites[0].lastRunAt!)
                  : '—'}
              </div>
            )}
            <p className="text-xs text-muted-foreground">Last test run</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link
              href={`/projects/${projectId}/suites`}
              className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-muted transition-colors group"
            >
              <div>
                <p className="font-medium">Test Suites</p>
                <p className="text-sm text-muted-foreground">
                  {isLoading ? 'Loading...' : `${suites.length} suites · ${totalTests} tests`}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </Link>
            <Link
              href={`/projects/${projectId}/runs`}
              className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-muted transition-colors group"
            >
              <div>
                <p className="font-medium">Run History</p>
                <p className="text-sm text-muted-foreground">View past test executions</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </Link>
            <Link
              href={`/projects/${projectId}/schedules`}
              className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-muted transition-colors group"
            >
              <div>
                <p className="font-medium">Schedules</p>
                <p className="text-sm text-muted-foreground">Automate test runs</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </Link>
            <Link
              href={`/projects/${projectId}/library`}
              className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-muted transition-colors group"
            >
              <div>
                <p className="font-medium">Recording Library</p>
                <p className="text-sm text-muted-foreground">Browse uploaded recordings</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </Link>
          </CardContent>
        </Card>

        {/* Recent suite activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Suite Activity</CardTitle>
            {suites.length > 0 && (
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/projects/${projectId}/suites`}>
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
            ) : recentSuites.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center">
                <Calendar className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-muted-foreground">No recent activity</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Run a test suite to see results here
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentSuites.map((suite) => (
                  <Link
                    key={suite.id}
                    href={`/projects/${projectId}/suites/${suite.id}`}
                    className="flex items-center justify-between rounded-lg border border-border p-3 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FolderOpen className="h-4 w-4 text-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{suite.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {suite.testCount} tests · {formatRelativeTime(suite.lastRunAt!)}
                        </p>
                      </div>
                    </div>
                    {suite.passRate != null && (
                      <Badge
                        variant={
                          suite.passRate >= 90
                            ? 'success-soft'
                            : suite.passRate >= 50
                            ? 'warning-soft'
                            : 'destructive-soft'
                        }
                      >
                        {Math.round(suite.passRate)}%
                      </Badge>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
