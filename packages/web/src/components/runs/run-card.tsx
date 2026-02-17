'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Clock,
  CheckCircle,
  XCircle,
  Hash,
  Timer,
  Play,
  MoreVertical,
  Trash2,
  RefreshCw,
  Ban,
  ExternalLink,
  FlaskConical,
  Layers,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RunStatusBadge } from './run-status-badge';
import { BrowserIcon, browserLabel } from './browser-result-cell';
import { cn, formatRelativeTime, formatDuration } from '@/lib/utils';
import type { Run } from '@/lib/api';

// ─── RunCard Component ──────────────────────────────────────────

interface RunCardProps {
  run: Run;
  projectId: string;
  onCancel?: (run: Run) => void;
  onRetry?: (run: Run) => void;
  onDelete?: (run: Run) => void;
  className?: string;
}

export function RunCard({
  run,
  projectId,
  onCancel,
  onRetry,
  onDelete,
  className,
}: RunCardProps) {
  const [showMenu, setShowMenu] = React.useState(false);
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

  const isActive = run.status === 'running' || run.status === 'queued';
  const canCancel = isActive && onCancel;
  const canRetry = (run.status === 'failed' || run.status === 'cancelled') && onRetry;

  const progress = React.useMemo(() => {
    const total = run.actionsTotal ?? 0;
    if (total === 0) return 0;
    const executed = (run.actionsExecuted ?? 0) + (run.actionsFailed ?? 0) + (run.actionsSkipped ?? 0);
    return Math.round((executed / total) * 100);
  }, [run]);

  const runTypeIcon = run.runType === 'suite' ? Layers : run.runType === 'test' ? FlaskConical : Play;
  const RunTypeIcon = runTypeIcon;

  const title = run.testName || run.recordingName || 'Test Run';

  return (
    <Card
      className={cn(
        'transition-colors hover:border-border/80',
        isActive && 'border-primary/30',
        className
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Left: Info */}
          <div className="flex-1 min-w-0 space-y-2">
            {/* Title + Status */}
            <div className="flex items-center gap-2 flex-wrap">
              <Link
                href={`/projects/${projectId}/runs/${run.id}`}
                className="font-semibold text-sm hover:text-primary truncate max-w-[260px]"
                title={title}
              >
                {title}
              </Link>
              <RunStatusBadge status={run.status} size="sm" />
            </div>

            {/* Meta row */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              {/* Run type */}
              <span className="flex items-center gap-1">
                <RunTypeIcon className="h-3 w-3" />
                <span className="capitalize">{run.runType || 'recording'}</span>
              </span>

              {/* Browser(s) */}
              {run.browsers && run.browsers.length > 1 ? (
                <span className="flex items-center gap-1">
                  {run.browsers.map((b) => (
                    <BrowserIcon key={b} browser={b} className="h-3 w-3" />
                  ))}
                  <span>{run.browsers.length} browsers</span>
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <BrowserIcon browser={run.browser} className="h-3 w-3" />
                  {browserLabel(run.browser)}
                </span>
              )}

              {/* Run ID */}
              <span className="flex items-center gap-1">
                <Hash className="h-3 w-3" />
                {run.id.slice(0, 8)}
              </span>

              {/* Duration */}
              {run.durationMs != null && (
                <span className="flex items-center gap-1">
                  <Timer className="h-3 w-3" />
                  {formatDuration(run.durationMs)}
                </span>
              )}

              {/* Started */}
              {run.startedAt && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatRelativeTime(run.startedAt)}
                </span>
              )}
            </div>

            {/* Progress bar for active runs */}
            {isActive && run.actionsTotal != null && run.actionsTotal > 0 && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Progress</span>
                  <span>
                    {(run.actionsExecuted ?? 0) + (run.actionsFailed ?? 0)}/
                    {run.actionsTotal}
                  </span>
                </div>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Action stats for completed runs */}
            {!isActive && run.actionsTotal != null && run.actionsTotal > 0 && (
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle className="h-3 w-3" />
                  {run.actionsExecuted ?? 0} passed
                </span>
                {(run.actionsFailed ?? 0) > 0 && (
                  <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                    <XCircle className="h-3 w-3" />
                    {run.actionsFailed} failed
                  </span>
                )}
              </div>
            )}

            {/* Error message */}
            {run.errorMessage && (
              <p className="text-xs text-red-600 dark:text-red-400 truncate max-w-[400px]" title={run.errorMessage}>
                {run.errorMessage}
              </p>
            )}
          </div>

          {/* Right: Actions */}
          <div className="relative" ref={menuRef}>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setShowMenu(!showMenu)}
              className="h-7 w-7"
            >
              <MoreVertical className="h-4 w-4" />
            </Button>

            {showMenu && (
              <div className="absolute right-0 top-8 z-50 w-44 rounded-md border bg-popover shadow-md py-1">
                <Link
                  href={`/projects/${projectId}/runs/${run.id}`}
                  className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent w-full"
                  onClick={() => setShowMenu(false)}
                >
                  <ExternalLink className="h-4 w-4" />
                  View Details
                </Link>
                {canCancel && (
                  <button
                    type="button"
                    className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent w-full text-left"
                    onClick={() => {
                      setShowMenu(false);
                      onCancel(run);
                    }}
                  >
                    <Ban className="h-4 w-4" />
                    Cancel Run
                  </button>
                )}
                {canRetry && (
                  <button
                    type="button"
                    className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent w-full text-left"
                    onClick={() => {
                      setShowMenu(false);
                      onRetry(run);
                    }}
                  >
                    <RefreshCw className="h-4 w-4" />
                    Retry Run
                  </button>
                )}
                {!isActive && onDelete && (
                  <>
                    <div className="border-t my-1" />
                    <button
                      type="button"
                      className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent w-full text-left text-destructive"
                      onClick={() => {
                        setShowMenu(false);
                        onDelete(run);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete Run
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── RunCardSkeleton ────────────────────────────────────────────

export function RunCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-14" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
