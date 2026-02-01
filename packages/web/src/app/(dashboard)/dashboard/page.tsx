import { Metadata } from 'next';
import {
  FileVideo,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  ArrowRight,
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
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Dashboard',
};

// Mock data for demonstration
const stats = [
  {
    title: 'Total Recordings',
    value: '24',
    change: '+3 this week',
    icon: FileVideo,
    trend: 'up',
  },
  {
    title: 'Total Runs',
    value: '156',
    change: '+12 this week',
    icon: Play,
    trend: 'up',
  },
  {
    title: 'Pass Rate',
    value: '94.2%',
    change: '+2.1% from last week',
    icon: CheckCircle,
    trend: 'up',
  },
  {
    title: 'Failed Tests',
    value: '9',
    change: '-3 from last week',
    icon: XCircle,
    trend: 'down',
  },
];

const recentRuns = [
  {
    id: 'run_001',
    recordingName: 'Login Flow Test',
    status: 'passed',
    duration: '12.4s',
    timestamp: '2 minutes ago',
  },
  {
    id: 'run_002',
    recordingName: 'Checkout Process',
    status: 'failed',
    duration: '45.2s',
    timestamp: '15 minutes ago',
  },
  {
    id: 'run_003',
    recordingName: 'User Registration',
    status: 'passed',
    duration: '8.1s',
    timestamp: '1 hour ago',
  },
  {
    id: 'run_004',
    recordingName: 'Search Functionality',
    status: 'passed',
    duration: '5.6s',
    timestamp: '2 hours ago',
  },
  {
    id: 'run_005',
    recordingName: 'Profile Update',
    status: 'running',
    duration: '-',
    timestamp: 'Just now',
  },
];

const upcomingSchedules = [
  {
    id: 'sched_001',
    recordingName: 'Daily Smoke Test',
    nextRun: 'Tomorrow at 6:00 AM',
    frequency: 'Daily',
  },
  {
    id: 'sched_002',
    recordingName: 'Weekly Regression',
    nextRun: 'Sunday at 12:00 AM',
    frequency: 'Weekly',
  },
  {
    id: 'sched_003',
    recordingName: 'E2E Full Suite',
    nextRun: 'In 3 hours',
    frequency: 'Every 6 hours',
  },
];

function getStatusBadgeVariant(
  status: string
): 'success-soft' | 'destructive-soft' | 'warning-soft' | 'secondary' {
  switch (status) {
    case 'passed':
      return 'success-soft';
    case 'failed':
      return 'destructive-soft';
    case 'running':
      return 'warning-soft';
    default:
      return 'secondary';
  }
}

export default function DashboardPage() {
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

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <Icon
                  className={cn(
                    'h-5 w-5',
                    stat.title === 'Pass Rate' && 'text-success',
                    stat.title === 'Failed Tests' && 'text-destructive'
                  )}
                />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{stat.value}</div>
                <p
                  className={cn(
                    'text-xs mt-1',
                    stat.trend === 'up' ? 'text-success' : 'text-muted-foreground'
                  )}
                >
                  <TrendingUp
                    className={cn(
                      'inline h-3 w-3 mr-1',
                      stat.trend === 'down' && 'rotate-180'
                    )}
                  />
                  {stat.change}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

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
            <div className="space-y-4">
              {recentRuns.map((run) => (
                <div
                  key={run.id}
                  className="flex items-center justify-between gap-4 rounded-lg border border-border p-3 transition-colors hover:bg-secondary/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{run.recordingName}</p>
                    <p className="text-sm text-muted-foreground">
                      {run.timestamp} · {run.duration}
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
                      <span className="mr-1 h-3 w-3 animate-spin">⏳</span>
                    )}
                    {run.status}
                  </Badge>
                </div>
              ))}
            </div>
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
            <div className="space-y-4">
              {upcomingSchedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className="flex items-center justify-between gap-4 rounded-lg border border-border p-3 transition-colors hover:bg-secondary/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">
                      {schedule.recordingName}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {schedule.nextRun}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    <Clock className="mr-1 h-3 w-3" />
                    {schedule.frequency}
                  </Badge>
                </div>
              ))}
            </div>
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
              <Link href="/recordings/upload">
                <FileVideo className="h-6 w-6 text-primary" />
                <span>Upload Recording</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 p-4" asChild>
              <Link href="/runs/new">
                <Play className="h-6 w-6 text-primary" />
                <span>Run Test</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 p-4" asChild>
              <Link href="/schedules/new">
                <Clock className="h-6 w-6 text-primary" />
                <span>Create Schedule</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 p-4" asChild>
              <Link href="/settings/tokens">
                <TrendingUp className="h-6 w-6 text-primary" />
                <span>API Tokens</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
