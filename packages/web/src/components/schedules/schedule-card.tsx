'use client';

import * as React from 'react';
import { useState } from 'react';
import Link from 'next/link';
import {
  Play,
  Pause,
  Pencil,
  Trash2,
  MoreVertical,
  Clock,
  Calendar,
  Globe,
  Video,
  Camera,
  Loader2,
  Hash,
  TrendingUp,
  Layers,
  FileText,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScheduleStatusBadge } from './schedule-status-badge';
import { BrowserIcon, browserLabel } from '@/components/runs/browser-result-cell';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/utils';
import type { Schedule } from '@/lib/api';

// ─── Helpers ────────────────────────────────────────────────────

export function formatCronExpression(cron: string): string {
  const parts = cron.split(' ');
  if (parts.length !== 5) return cron;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  if (cron === '* * * * *') return 'Every minute';
  if (cron === '*/5 * * * *') return 'Every 5 minutes';
  if (cron === '*/15 * * * *') return 'Every 15 minutes';
  if (cron === '*/30 * * * *') return 'Every 30 minutes';
  if (cron === '0 * * * *') return 'Every hour';
  if (cron === '0 */6 * * *') return 'Every 6 hours';
  if (cron === '0 */12 * * *') return 'Every 12 hours';
  if (cron === '0 0 * * *') return 'Daily at midnight';
  if (cron === '0 9 * * *') return 'Daily at 9:00 AM';
  if (cron === '0 18 * * *') return 'Daily at 6:00 PM';
  if (cron === '0 9 * * 1-5') return 'Weekdays at 9:00 AM';
  if (cron === '0 0 * * 1') return 'Weekly on Monday';
  if (cron === '0 0 1 * *') return 'Monthly on the 1st';

  if (minute !== '*' && hour !== '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return `Daily at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
  }
  if (minute !== '*' && hour !== '*' && dayOfMonth === '*' && month === '*' && dayOfWeek !== '*') {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    if (dayOfWeek.includes('-')) {
      const [start, end] = dayOfWeek.split('-').map(Number);
      const dayNames = days.slice(start, end + 1).join('–');
      return `${dayNames} at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
    }
    const dayIndices = dayOfWeek.split(',').map(Number);
    const dayNames = dayIndices.map(i => days[i] || i).join(', ');
    return `${dayNames} at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
  }

  return cron;
}

// ─── ScheduleCard Component ────────────────────────────────────

interface ScheduleCardProps {
  schedule: Schedule;
  projectSlug: string;
  onToggle: (schedule: Schedule) => void;
  onEdit: (schedule: Schedule) => void;
  onDelete: (schedule: Schedule) => void;
  isToggling?: boolean;
  className?: string;
}

export function ScheduleCard({
  schedule,
  projectSlug,
  onToggle,
  onEdit,
  onDelete,
  isToggling,
  className,
}: ScheduleCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  // Close menu on outside click
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  const successRate =
    schedule.totalRuns > 0
      ? Math.round((schedule.successfulRuns / schedule.totalRuns) * 100)
      : null;

  return (
    <Card className={cn('hover:shadow-md transition-shadow', className)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Left: name + status */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Link
                href={`/projects/${projectSlug}/schedules/${schedule.id}`}
                className="font-semibold text-sm hover:text-primary truncate"
              >
                {schedule.name}
              </Link>
              <ScheduleStatusBadge status={schedule.status} size="sm" />
              {schedule.targetType && schedule.targetType !== 'recording' && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 flex items-center gap-1">
                  {schedule.targetType === 'suite' ? <Layers className="h-2.5 w-2.5" /> : <FileText className="h-2.5 w-2.5" />}
                  {schedule.targetType === 'suite' ? 'Suite' : 'Test'}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3 w-3 flex-shrink-0" />
              {formatCronExpression(schedule.cronExpression)}
              <span className="text-muted-foreground/50">•</span>
              <Globe className="h-3 w-3 flex-shrink-0" />
              {schedule.timezone}
            </p>
          </div>

          {/* Right: actions menu */}
          <div className="relative" ref={menuRef}>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowMenu(!showMenu)}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 z-50 w-40 rounded-md border bg-popover shadow-md">
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent rounded-t-md"
                  onClick={() => {
                    onToggle(schedule);
                    setShowMenu(false);
                  }}
                  disabled={isToggling}
                >
                  {isToggling ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : schedule.status === 'active' ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  {schedule.status === 'active' ? 'Pause' : 'Resume'}
                </button>
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
                  onClick={() => {
                    onEdit(schedule);
                    setShowMenu(false);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </button>
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-b-md"
                  onClick={() => {
                    onDelete(schedule);
                    setShowMenu(false);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          {/* Browser */}
          <span className="flex items-center gap-1">
            {(schedule.browsers ?? (schedule.browser ? [schedule.browser] : ['chromium'])).map((b) => (
              <BrowserIcon key={b} browser={b} className="h-3.5 w-3.5" />
            ))}
            {(schedule.browsers ?? (schedule.browser ? [schedule.browser] : ['chromium'])).length === 1 && (
              <span>{browserLabel((schedule.browsers ?? (schedule.browser ? [schedule.browser] : ['chromium']))[0])}</span>
            )}
            {(schedule.browsers ?? (schedule.browser ? [schedule.browser] : ['chromium'])).length > 1 && (
              <span>{(schedule.browsers ?? []).length} browsers</span>
            )}
          </span>

          {/* Runs count */}
          <span className="flex items-center gap-1">
            <Hash className="h-3 w-3" />
            {schedule.totalRuns} run{schedule.totalRuns !== 1 ? 's' : ''}
          </span>

          {/* Success rate */}
          {successRate !== null && (
            <span className={cn(
              'flex items-center gap-1',
              successRate >= 80 ? 'text-green-600' : successRate >= 50 ? 'text-yellow-600' : 'text-red-600'
            )}>
              <TrendingUp className="h-3 w-3" />
              {successRate}%
            </span>
          )}

          {/* Video */}
          {schedule.recordVideo && (
            <span className="flex items-center gap-1">
              <Video className="h-3 w-3" />
              Video
            </span>
          )}

          {/* Screenshots */}
          {schedule.screenshotMode && schedule.screenshotMode !== 'never' && (
            <span className="flex items-center gap-1">
              <Camera className="h-3 w-3" />
              {schedule.screenshotMode === 'always' ? 'Screenshots' : 'On failure'}
            </span>
          )}
        </div>

        {/* Next/last run info */}
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {schedule.nextRunAt ? (
              <>Next: {formatRelativeTime(schedule.nextRunAt, true)}</>
            ) : (
              'Not scheduled'
            )}
          </span>
          {schedule.lastRunAt && (
            <span className="text-muted-foreground">
              Last: {formatRelativeTime(schedule.lastRunAt)}
              {schedule.lastRunStatus && (
                <Badge
                  variant={schedule.lastRunStatus === 'passed' ? 'success-soft' : schedule.lastRunStatus === 'failed' ? 'destructive-soft' : 'secondary'}
                  className="ml-1 text-[10px] px-1.5 py-0"
                >
                  {schedule.lastRunStatus}
                </Badge>
              )}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── ScheduleCardSkeleton ──────────────────────────────────────

export function ScheduleCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-5 w-14" />
            </div>
            <Skeleton className="h-3 w-56" />
          </div>
          <Skeleton className="h-8 w-8" />
        </div>
        <div className="mt-3 flex gap-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-12" />
        </div>
        <div className="mt-3 flex justify-between">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-28" />
        </div>
      </CardContent>
    </Card>
  );
}
