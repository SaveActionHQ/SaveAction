'use client';

import * as React from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import {
  RefreshCw,
  Plus,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/ui/dialog';
import { Pagination } from '@/components/shared/pagination';
import { EmptyState } from '@/components/shared/empty-state';
import {
  ScheduleCard,
  ScheduleCardSkeleton,
} from '@/components/schedules/schedule-card';
import { CreateScheduleDialog } from '@/components/schedules/create-schedule-dialog';
import { EditScheduleDialog } from '@/components/schedules/edit-schedule-dialog';
import { useToast } from '@/components/providers/toast-provider';
import { api, type Schedule, ApiClientError } from '@/lib/api';
import { cn } from '@/lib/utils';

// ─── Status Filter Tabs ─────────────────────────────────────────

type StatusFilter = 'all' | 'active' | 'paused';

const STATUS_FILTERS: { label: string; value: StatusFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Paused', value: 'paused' },
];

const PAGE_SIZE = 20;

// ─── Page Component ─────────────────────────────────────────────

export default function ProjectSchedulesPage() {
  const params = useParams();
  const { success, error: toastError } = useToast();

  const projectId = params.projectId as string;

  // Data state
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Dialogs
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Schedule | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Toggle state
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Auto-refresh
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── Data Fetching ────────────────────────────────────────────

  const fetchSchedules = useCallback(async () => {
    try {
      const response = await api.listSchedules({
        projectId,
        page,
        limit: PAGE_SIZE,
        status: statusFilter === 'all' ? undefined : statusFilter,
      });

      setSchedules(response.data);
      setTotalPages(response.pagination?.totalPages ?? 1);
      setTotalItems(response.pagination?.total ?? response.data.length);
      setError(null);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Failed to load schedules');
      }
    } finally {
      setIsLoading(false);
    }
  }, [projectId, page, statusFilter]);

  useEffect(() => {
    setIsLoading(true);
    fetchSchedules();
  }, [fetchSchedules]);

  // Auto-refresh every 30s
  useEffect(() => {
    refreshTimerRef.current = setInterval(() => {
      fetchSchedules();
    }, 30_000);

    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [fetchSchedules]);

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  // ─── Actions ──────────────────────────────────────────────────

  const handleToggle = async (schedule: Schedule) => {
    setTogglingId(schedule.id);
    try {
      const result = await api.toggleSchedule(schedule.id);
      setSchedules((prev) =>
        prev.map((s) =>
          s.id === schedule.id
            ? {
                ...s,
                status: result.status,
                nextRunAt: result.nextRunAt ?? undefined,
              }
            : s
        )
      );
      success(`Schedule ${result.status === 'active' ? 'resumed' : 'paused'}`);
    } catch (err) {
      if (err instanceof ApiClientError) {
        toastError(err.message);
      } else {
        toastError('Failed to toggle schedule');
      }
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      await api.deleteSchedule(deleteTarget.id);
      setSchedules((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      setTotalItems((prev) => prev - 1);
      success('Schedule deleted');
    } catch (err) {
      if (err instanceof ApiClientError) {
        toastError(err.message);
      } else {
        toastError('Failed to delete schedule');
      }
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleCreateSuccess = (_schedule: Schedule) => {
    setShowCreateDialog(false);
    fetchSchedules();
  };

  const handleEditSuccess = (updated: Schedule) => {
    setEditingSchedule(null);
    setSchedules((prev) =>
      prev.map((s) => (s.id === updated.id ? updated : s))
    );
  };

  // ─── Client-side search ───────────────────────────────────────

  const filteredSchedules = searchQuery
    ? schedules.filter((s) =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : schedules;

  // ─── Render ───────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Schedules</h1>
          <p className="text-muted-foreground">
            Automate test runs on a recurring schedule
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsLoading(true);
              fetchSchedules();
            }}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Schedule
          </Button>
        </div>
      </div>

      {/* Filters row */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Status tabs */}
        <div className="flex items-center rounded-lg border border-border bg-muted/30 p-1">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setStatusFilter(filter.value)}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                statusFilter === filter.value
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search schedules..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="grid gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <ScheduleCardSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <EmptyState
          variant="error"
          title="Failed to load schedules"
          description={error}
          action={{
            label: 'Retry',
            onClick: () => {
              setIsLoading(true);
              fetchSchedules();
            },
          }}
        />
      ) : filteredSchedules.length === 0 ? (
        searchQuery || statusFilter !== 'all' ? (
          <EmptyState
            variant="no-results"
            title="No matching schedules"
            description={
              searchQuery
                ? `No schedules match "${searchQuery}"`
                : `No ${statusFilter} schedules found`
            }
            action={{
              label: 'Clear filters',
              onClick: () => {
                setSearchQuery('');
                setStatusFilter('all');
              },
            }}
          />
        ) : (
          <EmptyState
            variant="empty"
            title="No schedules yet"
            description="Create a schedule to automatically run your tests on a recurring basis."
            action={{
              label: 'Create Schedule',
              onClick: () => setShowCreateDialog(true),
            }}
          />
        )
      ) : (
        <>
          <div className="grid gap-3">
            {filteredSchedules.map((schedule) => (
              <ScheduleCard
                key={schedule.id}
                schedule={schedule}
                projectId={projectId}
                onToggle={handleToggle}
                onEdit={setEditingSchedule}
                onDelete={setDeleteTarget}
                isToggling={togglingId === schedule.id}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              total={totalItems}
              limit={PAGE_SIZE}
              onPageChange={setPage}
            />
          )}
        </>
      )}

      {/* Create Dialog */}
      <CreateScheduleDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={handleCreateSuccess}
      />

      {/* Edit Dialog */}
      {editingSchedule && (
        <EditScheduleDialog
          schedule={editingSchedule}
          open={!!editingSchedule}
          onOpenChange={(open) => {
            if (!open) setEditingSchedule(null);
          }}
          onSuccess={handleEditSuccess}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Schedule"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This will stop all future scheduled runs. This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
        isLoading={isDeleting}
      />
    </div>
  );
}
