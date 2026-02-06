'use client';

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/ui/dialog';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableSkeleton,
} from '@/components/shared/data-table';
import { Pagination } from '@/components/shared/pagination';
import { EmptyState } from '@/components/shared/empty-state';
import { useToast } from '@/components/providers/toast-provider';
import { EditScheduleDialog } from './edit-schedule-dialog';
import { api, type Schedule, type PaginatedResponse, ApiClientError } from '@/lib/api';
import { formatRelativeTime, truncate } from '@/lib/utils';

// Icons
function PlayIcon({ className }: { className?: string }) {
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
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  );
}

function PauseIcon({ className }: { className?: string }) {
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
      <rect x="14" y="4" width="4" height="16" rx="1" />
      <rect x="6" y="4" width="4" height="16" rx="1" />
    </svg>
  );
}

function EditIcon({ className }: { className?: string }) {
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
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      <path d="m15 5 4 4" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
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
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
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

// Status badge component
function StatusBadge({ status }: { status: Schedule['status'] }) {
  const variants: Record<Schedule['status'], 'success-soft' | 'warning-soft' | 'secondary'> = {
    active: 'success-soft',
    paused: 'warning-soft',
  };

  const labels: Record<Schedule['status'], string> = {
    active: 'Active',
    paused: 'Paused',
  };

  return (
    <Badge variant={variants[status]} className="capitalize">
      {labels[status]}
    </Badge>
  );
}

// Browser icon component
function BrowserIcon({ browser, className }: { browser: string; className?: string }) {
  if (browser === 'chromium') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8 0-1.85.63-3.55 1.69-4.9L12 12l4.31-4.31C17.37 8.45 18 10.15 18 12c0 4.41-3.59 8-8 8z"/>
      </svg>
    );
  }
  if (browser === 'firefox') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
      </svg>
    );
  }
  // webkit
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="10"/>
    </svg>
  );
}

// Cron expression to human-readable text
function formatCronExpression(cron: string): string {
  const parts = cron.split(' ');
  if (parts.length !== 5) return cron;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // Common patterns
  if (cron === '* * * * *') return 'Every minute';
  if (cron === '0 * * * *') return 'Every hour';
  if (cron === '0 0 * * *') return 'Daily at midnight';
  if (minute !== '*' && hour !== '*' && dayOfMonth === '*' && month === '*' && dayOfWeek === '*') {
    return `Daily at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
  }
  if (minute !== '*' && hour !== '*' && dayOfMonth === '*' && month === '*' && dayOfWeek !== '*') {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayIndices = dayOfWeek.split(',').map(Number);
    const dayNames = dayIndices.map(i => days[i] || i).join(', ');
    return `${dayNames} at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
  }

  return cron;
}

interface SchedulesListProps {
  searchQuery?: string;
  statusFilter?: Schedule['status'];
  onRefresh?: () => void;
}

const PAGE_SIZE = 10;

export function SchedulesList({ searchQuery, statusFilter, onRefresh }: SchedulesListProps) {
  const { success, error: toastError } = useToast();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Delete confirmation state
  const [deleteSchedule, setDeleteSchedule] = useState<Schedule | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Toggle state
  const [togglingScheduleId, setTogglingScheduleId] = useState<string | null>(null);

  // Edit state
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);

  const fetchSchedules = useCallback(
    async (page: number = 1) => {
      setIsLoading(true);
      setError(null);

      try {
        const response: PaginatedResponse<Schedule> = await api.listSchedules({
          page,
          limit: PAGE_SIZE,
          status: statusFilter,
        });

        // Filter by search query client-side if needed
        let filteredSchedules = response.data;
        if (searchQuery) {
          const query = searchQuery.toLowerCase();
          filteredSchedules = filteredSchedules.filter((schedule) =>
            schedule.name.toLowerCase().includes(query) ||
            schedule.id.toLowerCase().includes(query)
          );
        }

        setSchedules(filteredSchedules);
        setPagination(response.pagination);
      } catch (err) {
        if (err instanceof ApiClientError) {
          setError(err.message);
        } else {
          setError('Failed to load schedules. Please try again.');
        }
      } finally {
        setIsLoading(false);
      }
    },
    [statusFilter, searchQuery]
  );

  useEffect(() => {
    fetchSchedules(1);
  }, [fetchSchedules]);

  const handlePageChange = (page: number) => {
    fetchSchedules(page);
  };

  const handleToggle = async (schedule: Schedule) => {
    setTogglingScheduleId(schedule.id);
    try {
      const result = await api.toggleSchedule(schedule.id);
      // Merge the partial response with existing schedule data
      setSchedules((prev) =>
        prev.map((s) => (s.id === schedule.id ? { ...s, status: result.status, nextRunAt: result.nextRunAt ?? undefined } : s))
      );
      success(`Schedule ${result.status === 'active' ? 'activated' : 'paused'}`);
    } catch (err) {
      if (err instanceof ApiClientError) {
        toastError(err.message);
      } else {
        toastError('Failed to toggle schedule. Please try again.');
      }
    } finally {
      setTogglingScheduleId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteSchedule) return;

    setIsDeleting(true);
    try {
      await api.deleteSchedule(deleteSchedule.id);
      setSchedules((prev) => prev.filter((s) => s.id !== deleteSchedule.id));
      success('Schedule deleted successfully');
      setDeleteSchedule(null);
      onRefresh?.();
    } catch (err) {
      if (err instanceof ApiClientError) {
        toastError(err.message);
      } else {
        toastError('Failed to delete schedule. Please try again.');
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleEditSuccess = (updatedSchedule: Schedule) => {
    setSchedules((prev) =>
      prev.map((s) => (s.id === updatedSchedule.id ? updatedSchedule : s))
    );
    setEditingSchedule(null);
  };

  // Loading state
  if (isLoading && schedules.length === 0) {
    return (
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Schedule</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Total Runs</TableHead>
              <TableHead>Last Run</TableHead>
              <TableHead>Next Run</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableSkeleton columns={7} rows={5} />
          </TableBody>
        </Table>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <EmptyState
        variant="error"
        title="Failed to load schedules"
        description={error}
        action={{
          label: 'Try again',
          onClick: () => fetchSchedules(pagination.page),
        }}
      />
    );
  }

  // Empty state
  if (schedules.length === 0) {
    return (
      <EmptyState
        variant={searchQuery || statusFilter ? 'no-results' : 'empty'}
        title={searchQuery || statusFilter ? 'No schedules found' : 'No schedules yet'}
        description={
          searchQuery || statusFilter
            ? 'Try adjusting your filters to find what you\'re looking for.'
            : 'Create a schedule to automatically run your tests at specified intervals.'
        }
      />
    );
  }

  return (
    <>
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Schedule</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Run Count</TableHead>
              <TableHead>Last Run</TableHead>
              <TableHead>Next Run</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {schedules.map((schedule) => (
              <TableRow key={schedule.id}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{truncate(schedule.name, 40)}</span>
                    <span className="text-xs text-muted-foreground">
                      {schedule.timezone}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <ClockIcon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm" title={schedule.cronExpression}>
                      {formatCronExpression(schedule.cronExpression)}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge status={schedule.status} />
                </TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-mono text-sm">{schedule.totalRuns}</span>
                    <span className="text-xs text-muted-foreground">
                      {schedule.successfulRuns} passed, {schedule.failedRuns} failed
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  {schedule.lastRunAt ? (
                    <div className="flex flex-col">
                      <span className="text-sm" title={new Date(schedule.lastRunAt).toLocaleString()}>
                        {formatRelativeTime(schedule.lastRunAt)}
                      </span>
                      {schedule.lastRunStatus && (
                        <span className={`text-xs ${schedule.lastRunStatus === 'passed' ? 'text-green-600' : 'text-red-600'}`}>
                          {schedule.lastRunStatus}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">Never</span>
                  )}
                </TableCell>
                <TableCell>
                  {schedule.lastRunStatus === 'running' ? (
                    <Badge variant="default" className="bg-blue-500 text-white animate-pulse">
                      <span className="mr-1 h-3 w-3 inline-block animate-spin">⏳</span>
                      Running
                    </Badge>
                  ) : schedule.nextRunAt ? (
                    <span className="text-sm" title={new Date(schedule.nextRunAt).toLocaleString()}>
                      {formatRelativeTime(schedule.nextRunAt, true)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    {/* Toggle Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggle(schedule)}
                      disabled={togglingScheduleId === schedule.id}
                      title={schedule.status === 'active' ? 'Pause schedule' : 'Activate schedule'}
                    >
                      {togglingScheduleId === schedule.id ? (
                        <LoaderIcon className="h-4 w-4 animate-spin" />
                      ) : schedule.status === 'active' ? (
                        <PauseIcon className="h-4 w-4" />
                      ) : (
                        <PlayIcon className="h-4 w-4" />
                      )}
                    </Button>

                    {/* Edit Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingSchedule(schedule)}
                      title="Edit schedule"
                    >
                      <EditIcon className="h-4 w-4" />
                    </Button>

                    {/* Delete Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteSchedule(schedule)}
                      title="Delete schedule"
                      className="text-destructive hover:text-destructive"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          onPageChange={handlePageChange}
          total={pagination.total}
          limit={pagination.limit}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!deleteSchedule}
        onClose={() => setDeleteSchedule(null)}
        title="Delete Schedule"
        description={`Are you sure you want to delete "${deleteSchedule?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
        onConfirm={handleDelete}
        isLoading={isDeleting}
      />

      {/* Edit Schedule Dialog */}
      {editingSchedule && (
        <EditScheduleDialog
          schedule={editingSchedule}
          open={!!editingSchedule}
          onOpenChange={(open) => !open && setEditingSchedule(null)}
          onSuccess={handleEditSuccess}
        />
      )}
    </>
  );
}
