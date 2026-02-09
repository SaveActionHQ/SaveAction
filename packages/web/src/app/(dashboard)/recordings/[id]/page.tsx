'use client';

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/ui/dialog';
import { RunExecutionDialog } from '@/components/runs/run-execution-dialog';
import { useToast } from '@/components/providers/toast-provider';
import { api, type Recording, type Run, ApiClientError } from '@/lib/api';
import { formatDate, formatRelativeTime } from '@/lib/utils';

// Icons
function ArrowLeftIcon({ className }: { className?: string }) {
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
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  );
}

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
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

function PencilIcon({ className }: { className?: string }) {
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

function GlobeIcon({ className }: { className?: string }) {
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
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  );
}

function LayersIcon({ className }: { className?: string }) {
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
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}

function FileTextIcon({ className }: { className?: string }) {
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
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="M10 9H8" />
      <path d="M16 13H8" />
      <path d="M16 17H8" />
    </svg>
  );
}

function TagIcon({ className }: { className?: string }) {
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
      <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
      <circle cx="7.5" cy="7.5" r=".5" fill="currentColor" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
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
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
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
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

// Stat card component
function StatCard({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-secondary text-muted-foreground">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-xl font-semibold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Loading skeleton
function RecordingDetailsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-lg" />
    </div>
  );
}

// Action type badge colors
const actionTypeColors: Record<string, string> = {
  click: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  input: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  navigation: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  scroll: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  select: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  keypress: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
  submit: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  hover: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
};

export default function RecordingDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { success, error: toastError } = useToast();

  const recordingId = params.id as string;

  const [recording, setRecording] = useState<Recording | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Delete dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Run dialog state
  const [showRunDialog, setShowRunDialog] = useState(false);

  // Fetch recording
  const fetchRecording = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await api.getRecording(recordingId);
      setRecording(data);
      setEditName(data.name);
      setEditDescription(data.description || '');
      setEditTags(data.tags || []);
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.code === 'NOT_FOUND' || err.code === 'RECORDING_NOT_FOUND') {
          setError('Recording not found');
        } else {
          setError(err.message);
        }
      } else {
        setError('Failed to load recording');
      }
    } finally {
      setIsLoading(false);
    }
  }, [recordingId]);

  useEffect(() => {
    fetchRecording();
  }, [fetchRecording]);

  // Handle save
  const handleSave = async () => {
    if (!recording) return;

    setIsSaving(true);
    try {
      const updated = await api.updateRecording(recording.id, {
        name: editName,
        description: editDescription || undefined,
        tags: editTags,
      });
      setRecording(updated);
      setIsEditing(false);
      success('Recording updated successfully');
    } catch (err) {
      if (err instanceof ApiClientError) {
        toastError(err.message);
      } else {
        toastError('Failed to update recording');
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    if (recording) {
      setEditName(recording.name);
      setEditDescription(recording.description || '');
      setEditTags(recording.tags || []);
    }
    setIsEditing(false);
  };

  // Handle add tag
  const handleAddTag = () => {
    const tag = newTag.trim().toLowerCase();
    if (tag && !editTags.includes(tag)) {
      setEditTags([...editTags, tag]);
      setNewTag('');
    }
  };

  // Handle remove tag
  const handleRemoveTag = (tag: string) => {
    setEditTags(editTags.filter((t) => t !== tag));
  };

  // Handle delete
  const handleDelete = async () => {
    if (!recording) return;

    setIsDeleting(true);
    try {
      await api.deleteRecording(recording.id);
      success('Recording deleted successfully');
      router.push('/recordings');
    } catch (err) {
      if (err instanceof ApiClientError) {
        toastError(err.message);
      } else {
        toastError('Failed to delete recording');
      }
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  // Handle run recording
  const handleRunRecording = () => {
    setShowRunDialog(true);
  };

  // Handle run complete
  const handleRunComplete = (run: Run) => {
    setShowRunDialog(false);
    // Optionally navigate to the run details
    // router.push(`/runs/${run.id}`);
  };

  // Format file size
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Format duration
  const formatDuration = (ms?: number) => {
    if (!ms) return 'Unknown';
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
  };

  if (isLoading) {
    return (
      <div className="container py-6">
        <RecordingDetailsSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-lg text-muted-foreground mb-4">{error}</p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => router.push('/recordings')}>
                <ArrowLeftIcon className="h-4 w-4 mr-2" />
                Back to Recordings
              </Button>
              <Button onClick={fetchRecording}>Try Again</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!recording) {
    return null;
  }

  const actions = (recording.data?.actions || []) as Array<{
    id?: string;
    type: string;
    selector?: { css?: string };
  }>;

  return (
    <div className="container py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/recordings')}>
            <ArrowLeftIcon className="h-5 w-5" />
          </Button>
          <div className="space-y-1">
            {isEditing ? (
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="text-2xl font-bold h-auto py-1"
                placeholder="Recording name"
              />
            ) : (
              <h1 className="text-2xl font-bold">{recording.name}</h1>
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Created {formatRelativeTime(recording.createdAt)}</span>
              <span>•</span>
              <span>{formatDate(recording.createdAt)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-auto md:ml-0">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={handleCancelEdit} disabled={isSaving}>
                <XIcon className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                <CheckIcon className="h-4 w-4 mr-2" />
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                <PencilIcon className="h-4 w-4 mr-2" />
                Edit
              </Button>
              <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
                <TrashIcon className="h-4 w-4 mr-2" />
                Delete
              </Button>
              <Button onClick={handleRunRecording}>
                <PlayIcon className="h-4 w-4 mr-2" />
                Run Test
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Actions" value={recording.actionCount} icon={LayersIcon} />
        <StatCard
          title="Duration"
          value={formatDuration(recording.estimatedDurationMs)}
          icon={ClockIcon}
        />
        <StatCard title="File Size" value={formatFileSize(recording.dataSizeBytes)} icon={FileTextIcon} />
        <StatCard title="Version" value={recording.schemaVersion || '1.0'} icon={TagIcon} />
      </div>

      {/* Description & Tags */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Description Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Description</CardTitle>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full min-h-[100px] p-2 rounded-md border bg-background resize-none"
                placeholder="Add a description..."
              />
            ) : (
              <p className="text-muted-foreground">
                {recording.description || 'No description provided'}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Tags Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Tags</CardTitle>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="Add a tag..."
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                  />
                  <Button variant="outline" onClick={handleAddTag}>
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {editTags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="pr-1">
                      {tag}
                      <button
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1 p-0.5 rounded hover:bg-secondary-foreground/20"
                      >
                        <XIcon className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  {editTags.length === 0 && (
                    <span className="text-sm text-muted-foreground">No tags</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {recording.tags && recording.tags.length > 0 ? (
                  recording.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground">No tags</span>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* URL Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <GlobeIcon className="h-5 w-5" />
            Starting URL
          </CardTitle>
        </CardHeader>
        <CardContent>
          <a
            href={recording.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline break-all"
          >
            {recording.url}
          </a>
        </CardContent>
      </Card>

      {/* Actions Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <LayersIcon className="h-5 w-5" />
            Actions ({actions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {actions.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {actions.map((action, index) => (
                <div
                  key={action.id || index}
                  className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                >
                  <span className="text-sm font-mono text-muted-foreground w-8">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <Badge
                    variant="secondary"
                    className={actionTypeColors[action.type] || 'bg-gray-100 text-gray-800'}
                  >
                    {action.type}
                  </Badge>
                  {action.selector?.css && (
                    <code className="text-sm text-muted-foreground truncate">
                      {action.selector.css}
                    </code>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No actions recorded</p>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        title="Delete Recording"
        description={`Are you sure you want to delete "${recording.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
        isLoading={isDeleting}
      />

      {/* Run Execution Dialog */}
      <RunExecutionDialog
        recording={{
          id: recording.id,
          name: recording.name,
          url: recording.url,
          actionCount: recording.actionCount,
        }}
        open={showRunDialog}
        onClose={() => setShowRunDialog(false)}
        onComplete={handleRunComplete}
      />
    </div>
  );
}
