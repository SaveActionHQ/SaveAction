'use client';

import * as React from 'react';
import {
  CheckCircle,
  XCircle,
  Loader2,
  Clock,
  Ban,
  SkipForward,
  Circle,
} from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { RunBrowserResult } from '@/lib/api';

// ─── Browser Icons (PNG) ────────────────────────────────────────

const BROWSER_ICONS: Record<string, string> = {
  chromium: '/chrome.png',
  firefox: '/firefox.png',
  webkit: '/safari.png',
};

export function BrowserIcon({
  browser,
  className,
}: {
  browser: string;
  className?: string;
}) {
  const src = BROWSER_ICONS[browser];
  if (!src) {
    return <Circle className={className} />;
  }
  return (
    <Image
      src={src}
      alt={browserLabel(browser)}
      width={24}
      height={24}
      className={cn('inline-block object-contain', className)}
      unoptimized
    />
  );
}

export function browserLabel(browser: string): string {
  switch (browser) {
    case 'chromium':
      return 'Chrome';
    case 'firefox':
      return 'Firefox';
    case 'webkit':
      return 'Safari';
    default:
      return browser;
  }
}

// ─── Status Styling ─────────────────────────────────────────────

type CellStatus = RunBrowserResult['status'];

const STATUS_ICON: Record<CellStatus, React.ComponentType<{ className?: string }>> = {
  passed: CheckCircle,
  failed: XCircle,
  running: Loader2,
  pending: Clock,
  cancelled: Ban,
  skipped: SkipForward,
};

const STATUS_BG: Record<CellStatus, string> = {
  passed: 'bg-emerald-50 dark:bg-emerald-950/40',
  failed: 'bg-red-50 dark:bg-red-950/40',
  running: 'bg-blue-50 dark:bg-blue-950/40',
  pending: 'bg-zinc-50 dark:bg-zinc-800/40',
  cancelled: 'bg-zinc-50 dark:bg-zinc-800/40',
  skipped: 'bg-zinc-50 dark:bg-zinc-800/40',
};

const STATUS_ICON_COLOR: Record<CellStatus, string> = {
  passed: 'text-emerald-600 dark:text-emerald-400',
  failed: 'text-red-600 dark:text-red-400',
  running: 'text-blue-600 dark:text-blue-400',
  pending: 'text-zinc-400 dark:text-zinc-500',
  cancelled: 'text-zinc-400 dark:text-zinc-500',
  skipped: 'text-zinc-400 dark:text-zinc-500',
};

const STATUS_BORDER: Record<CellStatus, string> = {
  passed: 'border-emerald-200 dark:border-emerald-800',
  failed: 'border-red-200 dark:border-red-800',
  running: 'border-blue-200 dark:border-blue-800',
  pending: 'border-zinc-200 dark:border-zinc-700',
  cancelled: 'border-zinc-200 dark:border-zinc-700',
  skipped: 'border-zinc-200 dark:border-zinc-700',
};

// ─── BrowserResultCell Component ────────────────────────────────

interface BrowserResultCellProps {
  result: RunBrowserResult;
  /** Compact mode shows only the icon */
  compact?: boolean;
  /** Clickable — triggers navigation or expand */
  onClick?: () => void;
  className?: string;
}

/**
 * A single cell in the Test × Browser matrix.
 * Shows pass/fail status with optional duration and action count.
 */
export function BrowserResultCell({
  result,
  compact = false,
  onClick,
  className,
}: BrowserResultCellProps) {
  const status = result.status as CellStatus;
  const Icon = STATUS_ICON[status] ?? Circle;
  const isAnimated = status === 'running';

  if (compact) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={!onClick}
        className={cn(
          'inline-flex items-center justify-center rounded-md border p-2 transition-colors',
          STATUS_BG[status],
          STATUS_BORDER[status],
          onClick && 'cursor-pointer hover:ring-2 hover:ring-primary/30',
          !onClick && 'cursor-default',
          className
        )}
        title={`${browserLabel(result.browser)}: ${status}`}
      >
        <Icon
          className={cn(
            'h-4 w-4',
            STATUS_ICON_COLOR[status],
            isAnimated && 'animate-spin'
          )}
        />
      </button>
    );
  }

  const durationMs = typeof result.durationMs === 'number' ? result.durationMs : null;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        'flex flex-col items-center gap-1 rounded-lg border p-3 transition-colors min-w-[80px]',
        STATUS_BG[status],
        STATUS_BORDER[status],
        onClick && 'cursor-pointer hover:ring-2 hover:ring-primary/30',
        !onClick && 'cursor-default',
        className
      )}
    >
      <Icon
        className={cn(
          'h-5 w-5',
          STATUS_ICON_COLOR[status],
          isAnimated && 'animate-spin'
        )}
      />
      <span className="text-xs font-medium capitalize">{status}</span>
      {durationMs !== null && (
        <span className="text-[10px] text-muted-foreground">
          {durationMs < 1000
            ? `${durationMs}ms`
            : `${(durationMs / 1000).toFixed(1)}s`}
        </span>
      )}
      {result.actionsFailed != null && Number(result.actionsFailed) > 0 && (
        <span className="text-[10px] text-red-600 dark:text-red-400">
          {result.actionsFailed} failed
        </span>
      )}
    </button>
  );
}

// ─── BrowserResultCellSkeleton ──────────────────────────────────

export function BrowserResultCellSkeleton({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="inline-flex h-9 w-9 animate-pulse rounded-md border border-zinc-200 bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800" />
    );
  }

  return (
    <div className="flex flex-col items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-100 p-3 min-w-[80px] animate-pulse dark:border-zinc-700 dark:bg-zinc-800">
      <div className="h-5 w-5 rounded-full bg-zinc-200 dark:bg-zinc-700" />
      <div className="h-3 w-10 rounded bg-zinc-200 dark:bg-zinc-700" />
    </div>
  );
}
