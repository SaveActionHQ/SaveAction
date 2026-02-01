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
import { RunExecutionDialog } from '@/components/runs/run-execution-dialog';
import { api, type RecordingListItem, type PaginatedResponse, ApiClientError } from '@/lib/api';
import { formatDate, formatRelativeTime } from '@/lib/utils';

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

function ExternalLinkIcon({ className }: { className?: string }) {
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
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}

function MoreVerticalIcon({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
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
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

interface RecordingsListProps {
  search?: string;
  tags?: string[];
  sortBy?: 'createdAt' | 'updatedAt' | 'name';
  sortOrder?: 'asc' | 'desc';
  onRefresh?: () => void;
}

const PAGE_SIZE = 10;

export function RecordingsList({
  search,
  tags,
  sortBy = 'createdAt',
  sortOrder = 'desc',
  onRefresh,
}: RecordingsListProps) {
  const { success, error: toastError } = useToast();
  const [recordings, setRecordings] = useState<RecordingListItem[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: PAGE_SIZE,
    total: 0,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Delete confirmation state
  const [deleteRecording, setDeleteRecording] = useState<RecordingListItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Run execution dialog state
  const [runRecording, setRunRecording] = useState<RecordingListItem | null>(null);

  // Duplicate state
  const [duplicatingRecordingId, setDuplicatingRecordingId] = useState<string | null>(null);

  // Sorting state
  const [currentSortBy, setCurrentSortBy] = useState(sortBy);
  const [currentSortOrder, setCurrentSortOrder] = useState(sortOrder);

  const fetchRecordings = useCallback(async (page: number = 1) => {
    setIsLoading(true);
    setError(null);

    try {
      const response: PaginatedResponse<RecordingListItem> = await api.listRecordings({
        page,
        limit: PAGE_SIZE,
        search: search || undefined,
        tags: tags?.length ? tags : undefined,
        sortBy: currentSortBy,
        sortOrder: currentSortOrder,
      });

      setRecordings(response.data);
      setPagination(response.pagination);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Failed to load recordings. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [search, tags, currentSortBy, currentSortOrder]);

  useEffect(() => {
    fetchRecordings(1);
  }, [fetchRecordings]);

  const handlePageChange = (page: number) => {
    fetchRecordings(page);
  };

  const handleSort = (column: 'createdAt' | 'updatedAt' | 'name') => {
    if (currentSortBy === column) {
      setCurrentSortOrder(currentSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setCurrentSortBy(column);
      setCurrentSortOrder('desc');
    }
  };

  const handleDelete = async () => {
    if (!deleteRecording) return;

    setIsDeleting(true);
    try {
      await api.deleteRecording(deleteRecording.id);
      success('Recording deleted', `"${deleteRecording.name}" has been deleted.`);
      setDeleteRecording(null);
      fetchRecordings(pagination.page);
      onRefresh?.();
    } catch (err) {
      const errorMessage = err instanceof ApiClientError 
        ? err.message 
        : 'Failed to delete recording. Please try again.';
      setError(errorMessage);
      toastError('Delete failed', errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRun = (recording: RecordingListItem) => {
    setRunRecording(recording);
  };

  const handleRunComplete = () => {
    setRunRecording(null);
    onRefresh?.();
  };

  const handleDuplicate = async (recording: RecordingListItem) => {
    setDuplicatingRecordingId(recording.id);
    try {
      // First, get the full recording details including the data
      const fullRecording = await api.getRecording(recording.id);
      
      // Create a duplicate with a new name
      await api.createRecording({
        name: `${recording.name} (Copy)`,
        description: recording.description || undefined,
        tags: recording.tags,
        data: fullRecording.data,
      });
      
      success('Recording duplicated', `"${recording.name}" has been duplicated.`);
      fetchRecordings(pagination.page);
      onRefresh?.();
    } catch (err) {
      const errorMessage = err instanceof ApiClientError 
        ? err.message 
        : 'Failed to duplicate recording. Please try again.';
      setError(errorMessage);
      toastError('Duplicate failed', errorMessage);
    } finally {
      setDuplicatingRecordingId(null);
    }
  };

  // Error state
  if (error && !isLoading && (!recordings || recordings.length === 0)) {
    return (
      <EmptyState
        variant="error"
        title="Failed to load recordings"
        description={error}
        action={{
          label: 'Try Again',
          onClick: () => fetchRecordings(pagination.page),
        }}
      />
    );
  }

  // Empty state
  if (!isLoading && (!recordings || recordings.length === 0) && !search && !tags?.length) {
    return (
      <EmptyState
        variant="empty"
        title="No recordings yet"
        description="Upload your first recording to get started with automated testing."
      />
    );
  }

  // No results from search/filter
  if (!isLoading && (!recordings || recordings.length === 0) && (search || tags?.length)) {
    return (
      <EmptyState
        variant="no-results"
        title="No recordings found"
        description="Try adjusting your search or filter criteria."
        action={{
          label: 'Clear Filters',
          onClick: () => {
            // This would need to be handled by parent component
            onRefresh?.();
          },
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-lg bg-destructive-light text-destructive border border-destructive/20">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="border border-border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-secondary/50">
              <TableHead
                sortable
                sorted={currentSortBy === 'name' ? currentSortOrder : false}
                onSort={() => handleSort('name')}
              >
                Name
              </TableHead>
              <TableHead>URL</TableHead>
              <TableHead className="text-center">Actions</TableHead>
              <TableHead>Tags</TableHead>
              <TableHead
                sortable
                sorted={currentSortBy === 'createdAt' ? currentSortOrder : false}
                onSort={() => handleSort('createdAt')}
              >
                Created
              </TableHead>
              <TableHead className="w-[120px]">Quick Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableSkeleton columns={6} rows={5} />
            ) : (
              recordings.map((recording) => (
                <TableRow key={recording.id}>
                  <TableCell>
                    <Link
                      href={`/recordings/${recording.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {recording.name}
                    </Link>
                    {recording.description && (
                      <p className="text-sm text-muted-foreground truncate max-w-xs">
                        {recording.description}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <a
                      href={recording.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground max-w-[200px] truncate"
                      title={recording.url}
                    >
                      {new URL(recording.url).hostname}
                      <ExternalLinkIcon className="h-3 w-3 flex-shrink-0" />
                    </a>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="font-medium">{recording.actionCount}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-[150px]">
                      {recording.tags.slice(0, 2).map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                      {recording.tags.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{recording.tags.length - 2}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      title={formatDate(recording.createdAt)}
                      className="text-sm text-muted-foreground"
                    >
                      {formatRelativeTime(recording.createdAt)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleRun(recording)}
                        title="Run test"
                      >
                        <PlayIcon className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDuplicate(recording)}
                        disabled={duplicatingRecordingId === recording.id}
                        title="Duplicate recording"
                      >
                        {duplicatingRecordingId === recording.id ? (
                          <svg
                            className="animate-spin h-4 w-4"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            />
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            />
                          </svg>
                        ) : (
                          <CopyIcon className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setDeleteRecording(recording)}
                        title="Delete recording"
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {!isLoading && pagination.totalPages > 1 && (
        <Pagination
          currentPage={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          limit={pagination.limit}
          onPageChange={handlePageChange}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={!!deleteRecording}
        onClose={() => setDeleteRecording(null)}
        onConfirm={handleDelete}
        title="Delete Recording"
        description={`Are you sure you want to delete "${deleteRecording?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        isLoading={isDeleting}
      />

      {/* Run Execution Dialog */}
      {runRecording && (
        <RunExecutionDialog
          recording={{
            id: runRecording.id,
            name: runRecording.name,
            url: runRecording.url,
            actionCount: runRecording.actionCount,
          }}
          open={!!runRecording}
          onClose={() => setRunRecording(null)}
          onComplete={handleRunComplete}
        />
      )}
    </div>
  );
}
