'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/shared/data-table';
import { formatDuration, cn } from '@/lib/utils';

// Run action type from API
export interface RunAction {
  id: string;
  actionId: string;
  actionType: string;
  actionIndex: number;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  durationMs?: number;
  startedAt?: string;
  completedAt?: string;
  selectorUsed?: string;
  selectorValue?: string;
  retryCount?: number;
  errorMessage?: string;
  screenshotPath?: string;
  elementFound?: boolean;
  elementTagName?: string;
  pageUrl?: string;
  pageTitle?: string;
}

// Icons
function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function XCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </svg>
  );
}

function SkipIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M5 5v14l11-7z" />
      <line x1="19" x2="19" y1="5" y2="19" />
    </svg>
  );
}

function LoaderIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 2v4" />
      <path d="m16.2 7.8 2.9-2.9" />
      <path d="M18 12h4" />
      <path d="m16.2 16.2 2.9 2.9" />
      <path d="M12 18v4" />
      <path d="m4.9 19.1 2.9-2.9" />
      <path d="M2 12h4" />
      <path d="m4.9 4.9 2.9 2.9" />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

// Status icon component
function StatusIcon({ status }: { status: RunAction['status'] }) {
  switch (status) {
    case 'success':
      return <CheckCircleIcon className="h-4 w-4 text-success" />;
    case 'failed':
      return <XCircleIcon className="h-4 w-4 text-destructive" />;
    case 'skipped':
      return <SkipIcon className="h-4 w-4 text-warning" />;
    case 'running':
      return <LoaderIcon className="h-4 w-4 text-primary animate-spin" />;
    default:
      return <ClockIcon className="h-4 w-4 text-muted-foreground" />;
  }
}

// Status badge component
function StatusBadge({ status }: { status: RunAction['status'] }) {
  const variants: Record<
    RunAction['status'],
    'success-soft' | 'destructive-soft' | 'warning-soft' | 'primary-soft' | 'secondary'
  > = {
    success: 'success-soft',
    failed: 'destructive-soft',
    skipped: 'warning-soft',
    running: 'primary-soft',
    pending: 'secondary',
  };

  const labels: Record<RunAction['status'], string> = {
    success: 'Passed',
    failed: 'Failed',
    skipped: 'Skipped',
    running: 'Running',
    pending: 'Pending',
  };

  return (
    <Badge variant={variants[status]} className="capitalize">
      {labels[status]}
    </Badge>
  );
}

// Action type icon
function ActionTypeIcon({ type }: { type: string }) {
  const iconColor = 'text-muted-foreground';
  
  switch (type.toLowerCase()) {
    case 'click':
      return (
        <svg className={cn('h-4 w-4', iconColor)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 9l10 10m0-10v10h-10" />
        </svg>
      );
    case 'input':
    case 'type':
      return (
        <svg className={cn('h-4 w-4', iconColor)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 7V4h16v3" />
          <path d="M9 20h6" />
          <path d="M12 4v16" />
        </svg>
      );
    case 'navigation':
    case 'navigate':
      return (
        <svg className={cn('h-4 w-4', iconColor)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
        </svg>
      );
    case 'scroll':
      return (
        <svg className={cn('h-4 w-4', iconColor)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 3v18" />
          <path d="m8 6 4-3 4 3" />
          <path d="m8 18 4 3 4-3" />
        </svg>
      );
    case 'select':
      return (
        <svg className={cn('h-4 w-4', iconColor)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m3 9 9 9 9-9" />
        </svg>
      );
    case 'hover':
      return (
        <svg className={cn('h-4 w-4', iconColor)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.36-5.64-1.42 1.42M7.06 16.94l-1.42 1.42m12.72 0-1.42-1.42M7.06 7.06 5.64 5.64" />
        </svg>
      );
    default:
      return (
        <svg className={cn('h-4 w-4', iconColor)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
  }
}

// Expanded row details
function ActionDetails({ action }: { action: RunAction }) {
  return (
    <div className="p-4 bg-secondary/30 space-y-3">
      {action.errorMessage && (
        <div className="space-y-1">
          <p className="text-sm font-medium text-destructive">Error Message</p>
          <pre className="text-xs text-destructive bg-destructive/10 p-2 rounded-md whitespace-pre-wrap font-mono overflow-x-auto">
            {action.errorMessage}
          </pre>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        {action.selectorUsed && (
          <div>
            <p className="text-muted-foreground">Selector Type</p>
            <p className="font-medium">{action.selectorUsed}</p>
          </div>
        )}
        {action.selectorValue && (
          <div className="col-span-2">
            <p className="text-muted-foreground">Selector Value</p>
            <code className="text-xs bg-secondary px-1 py-0.5 rounded">{action.selectorValue}</code>
          </div>
        )}
        {action.elementTagName && (
          <div>
            <p className="text-muted-foreground">Element Tag</p>
            <code className="text-xs bg-secondary px-1 py-0.5 rounded">&lt;{action.elementTagName}&gt;</code>
          </div>
        )}
        {action.retryCount !== undefined && action.retryCount > 0 && (
          <div>
            <p className="text-muted-foreground">Retries</p>
            <p className="font-medium">{action.retryCount}</p>
          </div>
        )}
        {action.pageUrl && (
          <div className="col-span-2">
            <p className="text-muted-foreground">Page URL</p>
            <a
              href={action.pageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline truncate block"
            >
              {action.pageUrl}
            </a>
          </div>
        )}
        {action.pageTitle && (
          <div className="col-span-2">
            <p className="text-muted-foreground">Page Title</p>
            <p className="font-medium truncate">{action.pageTitle}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Loading skeleton
function ActionsSkeleton() {
  return (
    <>
      {[1, 2, 3, 4, 5].map((i) => (
        <TableRow key={i}>
          <TableCell><Skeleton className="h-4 w-8" /></TableCell>
          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
          <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
          <TableCell><Skeleton className="h-4 w-16" /></TableCell>
          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
        </TableRow>
      ))}
    </>
  );
}

interface RunActionsTableProps {
  actions: RunAction[];
  isLoading?: boolean;
}

export function RunActionsTable({ actions, isLoading }: RunActionsTableProps) {
  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(new Set());

  const toggleRow = (actionId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(actionId)) {
        next.delete(actionId);
      } else {
        next.add(actionId);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Selector</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <ActionsSkeleton />
        </TableBody>
      </Table>
    );
  }

  if (actions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <ClockIcon className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-muted-foreground">No action results available</p>
        <p className="text-sm text-muted-foreground">
          Actions will appear here once the run starts executing.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">#</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Selector</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {actions.map((action) => (
            <React.Fragment key={action.id}>
              <TableRow
                className={cn(
                  'cursor-pointer',
                  action.status === 'failed' && 'bg-destructive/5',
                  expandedRows.has(action.id) && 'border-b-0'
                )}
                onClick={() => toggleRow(action.id)}
              >
                <TableCell className="font-medium text-muted-foreground">
                  {action.actionIndex + 1}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <ActionTypeIcon type={action.actionType} />
                    <span className="font-medium capitalize">{action.actionType}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <StatusIcon status={action.status} />
                    <StatusBadge status={action.status} />
                  </div>
                </TableCell>
                <TableCell>
                  {action.durationMs !== undefined ? (
                    formatDuration(action.durationMs)
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {action.selectorUsed ? (
                    <Badge variant="secondary" className="text-xs">
                      {action.selectorUsed}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <ChevronDownIcon
                    className={cn(
                      'h-4 w-4 text-muted-foreground transition-transform',
                      expandedRows.has(action.id) && 'rotate-180'
                    )}
                  />
                </TableCell>
              </TableRow>
              {expandedRows.has(action.id) && (
                <tr>
                  <td colSpan={6} className="p-0">
                    <ActionDetails action={action} />
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
