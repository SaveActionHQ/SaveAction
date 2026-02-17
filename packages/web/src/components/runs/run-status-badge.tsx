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
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { RunStatus } from '@/lib/api';

// ─── Status Configuration ───────────────────────────────────────

type StatusConfig = {
  label: string;
  variant: BadgeProps['variant'];
  icon: React.ComponentType<{ className?: string }>;
};

const RUN_STATUS_CONFIG: Record<RunStatus, StatusConfig> = {
  passed: {
    label: 'Passed',
    variant: 'success-soft',
    icon: CheckCircle,
  },
  failed: {
    label: 'Failed',
    variant: 'destructive-soft',
    icon: XCircle,
  },
  running: {
    label: 'Running',
    variant: 'primary-soft',
    icon: Loader2,
  },
  queued: {
    label: 'Queued',
    variant: 'warning-soft',
    icon: Clock,
  },
  cancelled: {
    label: 'Cancelled',
    variant: 'secondary',
    icon: Ban,
  },
};

const BROWSER_RESULT_STATUS_CONFIG: Record<string, StatusConfig> = {
  ...RUN_STATUS_CONFIG,
  pending: {
    label: 'Pending',
    variant: 'secondary',
    icon: Circle,
  },
  skipped: {
    label: 'Skipped',
    variant: 'secondary',
    icon: SkipForward,
  },
};

// ─── RunStatusBadge Component ───────────────────────────────────

interface RunStatusBadgeProps {
  status: RunStatus | string;
  size?: 'sm' | 'md';
  showIcon?: boolean;
  className?: string;
}

export function RunStatusBadge({
  status,
  size = 'md',
  showIcon = true,
  className,
}: RunStatusBadgeProps) {
  const config =
    BROWSER_RESULT_STATUS_CONFIG[status] ?? BROWSER_RESULT_STATUS_CONFIG.pending;

  const Icon = config.icon;
  const isAnimated = status === 'running';

  return (
    <Badge
      variant={config.variant}
      className={cn(
        size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1',
        className
      )}
    >
      {showIcon && (
        <Icon
          className={cn(
            'mr-1',
            size === 'sm' ? 'h-3 w-3' : 'h-4 w-4',
            isAnimated && 'animate-spin'
          )}
        />
      )}
      {config.label}
    </Badge>
  );
}

// ─── RunStatusDot ───────────────────────────────────────────────

const DOT_COLORS: Record<string, string> = {
  passed: 'bg-emerald-500',
  failed: 'bg-red-500',
  running: 'bg-blue-500',
  queued: 'bg-amber-500',
  cancelled: 'bg-zinc-400',
  pending: 'bg-zinc-300',
  skipped: 'bg-zinc-400',
};

interface RunStatusDotProps {
  status: RunStatus | string;
  className?: string;
  pulse?: boolean;
}

/**
 * Small colored dot indicator for status.
 * Use `pulse` for running/queued states.
 */
export function RunStatusDot({ status, className, pulse }: RunStatusDotProps) {
  const color = DOT_COLORS[status] ?? DOT_COLORS.pending;
  const shouldPulse = pulse ?? (status === 'running' || status === 'queued');

  return (
    <span className={cn('relative inline-flex', className)}>
      {shouldPulse && (
        <span
          className={cn(
            'absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping',
            color
          )}
        />
      )}
      <span className={cn('relative inline-flex h-2 w-2 rounded-full', color)} />
    </span>
  );
}
