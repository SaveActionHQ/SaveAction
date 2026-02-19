'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Upload,
  Search,
  FileJson,
  Trash2,
  MoreVertical,
  ExternalLink,
  Globe,
  Clock,
  Hash,
  Loader2,
  FlaskConical,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/shared/empty-state';
import { Pagination } from '@/components/shared/pagination';
import { useToast } from '@/components/providers/toast-provider';
import { api, type RecordingListItem } from '@/lib/api';
import { formatRelativeTime, cn } from '@/lib/utils';
import { useProjectFromSlug } from '@/lib/hooks';

const ITEMS_PER_PAGE = 12;

// ─── Recording Card ─────────────────────────────────────────────

function RecordingCard({
  recording,
  projectSlug,
  onDelete,
}: {
  recording: RecordingListItem;
  projectSlug: string;
  onDelete: (recording: RecordingListItem) => void;
}) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  let hostname = '';
  try {
    hostname = new URL(recording.url).hostname;
  } catch {
    hostname = recording.url;
  }

  const formatBytes = (bytes: number | undefined) => {
    if (!bytes) return null;
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Card className="group relative transition-all hover:shadow-md">
      <Link
        href={`/projects/${projectSlug}/library/${recording.id}`}
        className="absolute inset-0 z-0"
      >
        <span className="sr-only">View {recording.name}</span>
      </Link>

      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0 mt-0.5">
              <FileJson className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm font-semibold truncate">{recording.name}</h3>
              {recording.description && (
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                  {recording.description}
                </p>
              )}

              {/* URL */}
              <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
                <Globe className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{hostname}</span>
              </div>

              {/* Meta row */}
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <Hash className="h-3 w-3" />
                  {recording.actionCount} actions
                </span>
                {recording.dataSizeBytes && (
                  <span>{formatBytes(recording.dataSizeBytes)}</span>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatRelativeTime(recording.createdAt)}
                </span>
              </div>

              {/* Tags */}
              {recording.tags.length > 0 && (
                <div className="flex items-center gap-1 mt-2 flex-wrap">
                  {recording.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                      {tag}
                    </Badge>
                  ))}
                  {recording.tags.length > 3 && (
                    <span className="text-[10px] text-muted-foreground">
                      +{recording.tags.length - 3}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Action menu */}
          <div className="relative z-10" ref={menuRef}>
            <Button
              variant="ghost"
              size="icon-sm"
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.preventDefault();
                setMenuOpen(!menuOpen);
              }}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-40 rounded-lg border border-border bg-background py-1 shadow-lg z-50">
                <Link
                  href={`/projects/${projectSlug}/library/${recording.id}`}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  <ExternalLink className="h-4 w-4" />
                  View Details
                </Link>
                <Link
                  href={`/projects/${projectSlug}/tests/new-from-recording?recordingId=${recording.id}`}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors"
                  onClick={() => setMenuOpen(false)}
                >
                  <FlaskConical className="h-4 w-4" />
                  Create Test
                </Link>
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-muted transition-colors"
                  onClick={(e) => {
                    e.preventDefault();
                    setMenuOpen(false);
                    onDelete(recording);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RecordingCardSkeleton() {
  return (
    <Card className="animate-pulse">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-40 rounded bg-muted" />
            <div className="h-3 w-32 rounded bg-muted" />
            <div className="h-3 w-48 rounded bg-muted" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Upload Area ────────────────────────────────────────────────

function UploadRecordingInline({
  projectId,
  onUploaded,
}: {
  projectId: string;
  onUploaded: () => void;
}) {
  const toast = useToast();
  const [dragActive, setDragActive] = React.useState(false);
  const [isUploading, setIsUploading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.name.endsWith('.json')) {
      toast.error('Invalid file', 'Please upload a .json recording file');
      return;
    }

    setIsUploading(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data || typeof data !== 'object' || !data.actions) {
        throw new Error('Invalid recording format');
      }

      await api.createRecording({
        projectId,
        name: data.testName || file.name.replace('.json', ''),
        data,
      });

      toast.success('Recording uploaded');
      onUploaded();
    } catch (err) {
      toast.error(
        'Upload failed',
        err instanceof Error ? err.message : 'Failed to upload recording'
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (isUploading) return;
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  };

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => {
        e.preventDefault();
        if (!isUploading) setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onClick={() => !isUploading && inputRef.current?.click()}
      className={cn(
        'flex items-center gap-3 rounded-lg border-2 border-dashed p-4 transition-colors cursor-pointer',
        dragActive
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-primary/50 hover:bg-muted/50',
        isUploading && 'cursor-not-allowed opacity-60'
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".json"
        onChange={handleInputChange}
        disabled={isUploading}
        className="hidden"
      />
      {isUploading ? (
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      ) : (
        <Upload className="h-5 w-5 text-muted-foreground" />
      )}
      <div>
        <p className="text-sm font-medium">
          {isUploading ? 'Uploading...' : 'Upload Recording'}
        </p>
        <p className="text-xs text-muted-foreground">
          Drag & drop a .json file or click to browse
        </p>
      </div>
    </div>
  );
}

// ─── Main Library Page ──────────────────────────────────────────

export default function LibraryPage() {
  const { projectSlug, projectId } = useProjectFromSlug();
  const toast = useToast();

  const [recordings, setRecordings] = React.useState<RecordingListItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [total, setTotal] = React.useState(0);
  const [deletingRecording, setDeletingRecording] = React.useState<RecordingListItem | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const loadRecordings = React.useCallback(
    async (currentPage: number, currentSearch: string) => {
      try {
        setIsLoading(true);
        setError(null);
        const result = await api.listRecordings({
          projectId,
          page: currentPage,
          limit: ITEMS_PER_PAGE,
          search: currentSearch || undefined,
          sortBy: 'createdAt',
          sortOrder: 'desc',
        });
        setRecordings(result.data);
        setTotalPages(result.pagination.totalPages);
        setTotal(result.pagination.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load recordings');
      } finally {
        setIsLoading(false);
      }
    },
    [projectId]
  );

  // Load on mount and page change
  React.useEffect(() => {
    loadRecordings(page, search);
  }, [page, loadRecordings]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced search
  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setPage(1);
      loadRecordings(1, value);
    }, 300);
  };

  const handleDelete = async () => {
    if (!deletingRecording) return;
    setIsDeleting(true);
    try {
      await api.deleteRecording(deletingRecording.id);
      toast.success('Recording deleted');
      setDeletingRecording(null);
      loadRecordings(page, search);
    } catch (err) {
      toast.error(
        'Delete failed',
        err instanceof Error ? err.message : 'Failed to delete recording'
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUploaded = () => {
    setPage(1);
    setSearch('');
    loadRecordings(1, '');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Recording Library</h1>
          <p className="text-muted-foreground">
            Upload and manage test recordings for this project
          </p>
        </div>
      </div>

      {/* Upload area */}
      <UploadRecordingInline projectId={projectId} onUploaded={handleUploaded} />

      {/* Search bar */}
      {(total > 0 || search) && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search recordings..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => loadRecordings(page, search)}
            className="mt-2 text-destructive hover:text-destructive"
          >
            Try again
          </Button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && !error && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <RecordingCardSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && recordings.length === 0 && !search && (
        <EmptyState
          variant="empty"
          title="No recordings yet"
          description="Upload a recording JSON file to get started. Recordings created by tests will also appear here."
        />
      )}

      {/* No search results */}
      {!isLoading && !error && recordings.length === 0 && search && (
        <EmptyState
          variant="no-results"
          title="No recordings found"
          description={`No recordings match "${search}"`}
          action={{ label: 'Clear search', onClick: () => handleSearchChange('') }}
        />
      )}

      {/* Recording grid */}
      {!isLoading && !error && recordings.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recordings.map((recording) => (
              <RecordingCard
                key={recording.id}
                recording={recording}
                projectSlug={projectSlug}
                onDelete={setDeletingRecording}
              />
            ))}
          </div>

          {/* Pagination */}
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            total={total}
            limit={ITEMS_PER_PAGE}
            onPageChange={setPage}
          />
        </>
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deletingRecording}
        onClose={() => setDeletingRecording(null)}
        onConfirm={handleDelete}
        title="Delete Recording"
        description={`Are you sure you want to delete "${deletingRecording?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        isLoading={isDeleting}
      />
    </div>
  );
}
