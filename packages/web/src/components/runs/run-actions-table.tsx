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
import { api } from '@/lib/api';
import { BrowserIcon, browserLabel } from './browser-result-cell';

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
  browser?: string;
}

// Grouped action — one entry per unique actionId
interface GroupedAction {
  actionId: string;
  actionType: string;
  actionIndex: number;
  selectorUsed?: string;
  selectorValue?: string;
  browsers: RunAction[]; // one per browser
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

// Small status dot for browser icons
function StatusDot({ status }: { status: RunAction['status'] }) {
  const colors: Record<RunAction['status'], string> = {
    success: 'bg-emerald-500',
    failed: 'bg-red-500',
    skipped: 'bg-amber-500',
    running: 'bg-blue-500 animate-pulse',
    pending: 'bg-zinc-400',
  };
  return (
    <span className={cn('absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full ring-1 ring-background', colors[status])} />
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

// Build screenshot URL with JWT token
function getScreenshotUrl(runId: string, actionId: string, browser?: string): string {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const token = api.getAccessToken();
  let url = `${apiUrl}/api/v1/runs/${runId}/actions/${actionId}/screenshot?token=${token}`;
  if (browser) {
    url += `&browser=${browser}`;
  }
  return url;
}

// Screenshot thumbnail for expanded rows
function ActionScreenshot({
  runId,
  actionId,
  browser,
}: {
  runId: string;
  actionId: string;
  browser?: string;
}) {
  const [isLoading, setIsLoading] = React.useState(true);
  const [hasError, setHasError] = React.useState(false);

  const url = getScreenshotUrl(runId, actionId, browser);

  if (hasError) {
    return (
      <div className="w-full aspect-video bg-secondary/50 rounded-md flex items-center justify-center">
        <p className="text-xs text-muted-foreground">Failed to load</p>
      </div>
    );
  }

  return (
    <div className="relative w-full aspect-video bg-secondary/30 rounded-md overflow-hidden">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Skeleton className="w-full h-full" />
        </div>
      )}
      <img
        src={url}
        alt={`Screenshot ${actionId} ${browser || ''}`}
        className={cn(
          'w-full h-full object-contain transition-opacity',
          isLoading ? 'opacity-0' : 'opacity-100'
        )}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false);
          setHasError(true);
        }}
      />
    </div>
  );
}

// Expanded row details — shows per-browser details + screenshots
function GroupedActionDetails({
  group,
  runId,
  isMultiBrowser,
}: {
  group: GroupedAction;
  runId?: string;
  isMultiBrowser: boolean;
}) {
  // For single-browser runs, show simple details
  const representative = group.browsers[0];

  return (
    <div className="p-4 bg-secondary/30 space-y-4">
      {/* Per-browser details */}
      {isMultiBrowser ? (
        <div className="space-y-3">
          {group.browsers.map((action) => (
            <div key={action.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <BrowserIcon browser={action.browser || 'unknown'} className="h-4 w-4" />
                <span className="text-sm font-medium">{browserLabel(action.browser || 'unknown')}</span>
                <StatusBadge status={action.status} />
                {action.durationMs !== undefined && (
                  <span className="text-xs text-muted-foreground ml-auto">{formatDuration(action.durationMs)}</span>
                )}
              </div>
              {action.errorMessage && (
                <pre className="text-xs text-destructive bg-destructive/10 p-2 rounded-md whitespace-pre-wrap font-mono overflow-x-auto ml-6">
                  {action.errorMessage}
                </pre>
              )}
            </div>
          ))}
        </div>
      ) : (
        <>
          {representative?.errorMessage && (
            <div className="space-y-1">
              <p className="text-sm font-medium text-destructive">Error Message</p>
              <pre className="text-xs text-destructive bg-destructive/10 p-2 rounded-md whitespace-pre-wrap font-mono overflow-x-auto">
                {representative.errorMessage}
              </pre>
            </div>
          )}
        </>
      )}

      {/* Common details (selector, element, page) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        {representative?.selectorUsed && (
          <div>
            <p className="text-muted-foreground">Selector Type</p>
            <p className="font-medium">{representative.selectorUsed}</p>
          </div>
        )}
        {representative?.selectorValue && (
          <div className="col-span-2">
            <p className="text-muted-foreground">Selector Value</p>
            <code className="text-xs bg-secondary px-1 py-0.5 rounded">{representative.selectorValue}</code>
          </div>
        )}
        {representative?.elementTagName && (
          <div>
            <p className="text-muted-foreground">Element Tag</p>
            <code className="text-xs bg-secondary px-1 py-0.5 rounded">&lt;{representative.elementTagName}&gt;</code>
          </div>
        )}
        {representative?.retryCount !== undefined && representative.retryCount > 0 && (
          <div>
            <p className="text-muted-foreground">Retries</p>
            <p className="font-medium">{representative.retryCount}</p>
          </div>
        )}
        {representative?.pageUrl && (
          <div className="col-span-2">
            <p className="text-muted-foreground">Page URL</p>
            <a
              href={representative.pageUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline truncate block"
            >
              {representative.pageUrl}
            </a>
          </div>
        )}
        {representative?.pageTitle && (
          <div className="col-span-2">
            <p className="text-muted-foreground">Page Title</p>
            <p className="font-medium truncate">{representative.pageTitle}</p>
          </div>
        )}
      </div>

      {/* Screenshots grid — side by side for each browser */}
      {runId && group.browsers.some((a) => a.screenshotPath) && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Screenshots</p>
          <div className={cn(
            'grid gap-3',
            isMultiBrowser ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 max-w-md'
          )}>
            {group.browsers
              .filter((a) => a.screenshotPath)
              .map((action) => (
                <div key={action.id} className="space-y-1">
                  {isMultiBrowser && (
                    <div className="flex items-center gap-1.5">
                      <BrowserIcon browser={action.browser || 'unknown'} className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{browserLabel(action.browser || 'unknown')}</span>
                    </div>
                  )}
                  <ActionScreenshot
                    runId={runId}
                    actionId={action.actionId}
                    browser={action.browser}
                  />
                </div>
              ))}
          </div>
        </div>
      )}
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

// Group flat actions by actionId
function groupActions(actions: RunAction[]): GroupedAction[] {
  const map = new Map<string, GroupedAction>();
  // Canonical browser order
  const browserOrder = ['chromium', 'firefox', 'webkit'];

  for (const action of actions) {
    const existing = map.get(action.actionId);
    if (existing) {
      existing.browsers.push(action);
    } else {
      map.set(action.actionId, {
        actionId: action.actionId,
        actionType: action.actionType,
        actionIndex: action.actionIndex,
        selectorUsed: action.selectorUsed,
        selectorValue: action.selectorValue,
        browsers: [action],
      });
    }
  }

  const groups = Array.from(map.values());
  // Sort by actionIndex
  groups.sort((a, b) => a.actionIndex - b.actionIndex);
  // Sort browsers within each group by canonical order
  for (const group of groups) {
    group.browsers.sort((a, b) => {
      const ai = browserOrder.indexOf(a.browser || '');
      const bi = browserOrder.indexOf(b.browser || '');
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  }
  return groups;
}

// Compute aggregate status for a group
function aggregateStatus(browsers: RunAction[]): RunAction['status'] {
  if (browsers.some((a) => a.status === 'failed')) return 'failed';
  if (browsers.some((a) => a.status === 'running')) return 'running';
  if (browsers.every((a) => a.status === 'success')) return 'success';
  if (browsers.every((a) => a.status === 'skipped')) return 'skipped';
  if (browsers.every((a) => a.status === 'pending')) return 'pending';
  return 'success'; // mixed success/skipped
}

interface RunActionsTableProps {
  actions: RunAction[];
  isLoading?: boolean;
  runId?: string;
  onScreenshotClick?: (actionId: string) => void;
}

export function RunActionsTable({ actions, isLoading, runId, onScreenshotClick }: RunActionsTableProps) {
  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(new Set());

  const grouped = React.useMemo(() => groupActions(actions), [actions]);
  const isMultiBrowser = React.useMemo(
    () => grouped.length > 0 && grouped[0].browsers.length > 1,
    [grouped]
  );

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
            <TableHead>{isMultiBrowser ? 'Browsers' : 'Status'}</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Selector</TableHead>
            <TableHead className="w-12"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {grouped.map((group) => {
            const isExpanded = expandedRows.has(group.actionId);
            const aggStatus = aggregateStatus(group.browsers);
            // Max duration across browsers
            const maxDuration = group.browsers.reduce(
              (max, a) => Math.max(max, a.durationMs ?? 0),
              0
            );
            const hasAnyFailed = group.browsers.some((a) => a.status === 'failed');

            return (
              <React.Fragment key={group.actionId}>
                <TableRow
                  className={cn(
                    'cursor-pointer',
                    hasAnyFailed && 'bg-destructive/5',
                    isExpanded && 'border-b-0'
                  )}
                  onClick={() => toggleRow(group.actionId)}
                >
                  <TableCell className="font-medium text-muted-foreground">
                    {group.actionIndex + 1}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <ActionTypeIcon type={group.actionType} />
                      <span className="font-medium capitalize">{group.actionType}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {isMultiBrowser ? (
                      <div className="flex items-center gap-2">
                        {group.browsers.map((action) => (
                          <div
                            key={action.id}
                            className="relative"
                            title={`${browserLabel(action.browser || 'unknown')}: ${action.status}`}
                          >
                            <BrowserIcon
                              browser={action.browser || 'unknown'}
                              className={cn(
                                'h-4.5 w-4.5',
                                action.status === 'success' && 'text-emerald-600 dark:text-emerald-400',
                                action.status === 'failed' && 'text-red-600 dark:text-red-400',
                                action.status === 'skipped' && 'text-amber-600 dark:text-amber-400',
                                action.status === 'running' && 'text-blue-600 dark:text-blue-400 animate-pulse',
                                action.status === 'pending' && 'text-muted-foreground'
                              )}
                            />
                            <StatusDot status={action.status} />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <StatusIcon status={aggStatus} />
                        <StatusBadge status={aggStatus} />
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {maxDuration > 0 ? (
                      formatDuration(maxDuration)
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {group.selectorUsed ? (
                      <Badge variant="secondary" className="text-xs">
                        {group.selectorUsed}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <ChevronDownIcon
                      className={cn(
                        'h-4 w-4 text-muted-foreground transition-transform',
                        isExpanded && 'rotate-180'
                      )}
                    />
                  </TableCell>
                </TableRow>
                {isExpanded && (
                  <tr>
                    <td colSpan={6} className="p-0">
                      <GroupedActionDetails
                        group={group}
                        runId={runId}
                        isMultiBrowser={isMultiBrowser}
                      />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
