'use client';

import * as React from 'react';
import { Play, Pause, Ban, Timer } from 'lucide-react';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ─── Types ──────────────────────────────────────────────────────

export type ScheduleStatus = 'active' | 'paused' | 'disabled' | 'expired';

type StatusConfig = {
  label: string;
  variant: BadgeProps['variant'];
  icon: React.ComponentType<{ className?: string }>;
};

// ─── Status Configuration ───────────────────────────────────────

const SCHEDULE_STATUS_CONFIG: Record<ScheduleStatus, StatusConfig> = {
  active: {
    label: 'Active',
    variant: 'success-soft',
    icon: Play,
  },
  paused: {
    label: 'Paused',
    variant: 'warning-soft',
    icon: Pause,
  },
  disabled: {
    label: 'Disabled',
    variant: 'secondary',
    icon: Ban,
  },
  expired: {
    label: 'Expired',
    variant: 'secondary',
    icon: Timer,
  },
};

// ─── ScheduleStatusBadge ────────────────────────────────────────

interface ScheduleStatusBadgeProps {
  status: ScheduleStatus | string;
  size?: 'sm' | 'md';
  showIcon?: boolean;
  className?: string;
}

export function ScheduleStatusBadge({
  status,
  size = 'md',
  showIcon = true,
  className,
}: ScheduleStatusBadgeProps) {
  const config = SCHEDULE_STATUS_CONFIG[status as ScheduleStatus] ?? {
    label: status,
    variant: 'secondary' as const,
    icon: Timer,
  };

  const Icon = config.icon;

  return (
    <Badge
      variant={config.variant}
      className={cn(size === 'sm' && 'text-[10px] px-1.5 py-0', className)}
    >
      {showIcon && (
        <Icon className={cn('mr-1', size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
      )}
      {config.label}
    </Badge>
  );
}

// ─── ScheduleStatusDot ──────────────────────────────────────────

interface ScheduleStatusDotProps {
  status: ScheduleStatus | string;
  className?: string;
}

const STATUS_DOT_COLORS: Record<ScheduleStatus, string> = {
  active: 'bg-green-500',
  paused: 'bg-yellow-500',
  disabled: 'bg-gray-400',
  expired: 'bg-gray-400',
};

export function ScheduleStatusDot({ status, className }: ScheduleStatusDotProps) {
  const color = STATUS_DOT_COLORS[status as ScheduleStatus] ?? 'bg-gray-400';

  return (
    <span
      className={cn(
        'inline-block h-2 w-2 rounded-full',
        color,
        status === 'active' && 'animate-pulse',
        className
      )}
    />
  );
}
