'use client';

import * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { RunExecutionDialog } from '@/components/runs/run-execution-dialog';
import { api, type RecordingListItem, ApiClientError } from '@/lib/api';
import { cn, formatRelativeTime } from '@/lib/utils';

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

function SearchIcon({ className }: { className?: string }) {
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
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function FileIcon({ className }: { className?: string }) {
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
      <polygon points="6 3 20 12 6 21 6 3" />
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
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export default function NewRunPage() {
  const router = useRouter();
  const [recordings, setRecordings] = useState<RecordingListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedRecording, setSelectedRecording] = useState<RecordingListItem | null>(null);
  const [showExecutionDialog, setShowExecutionDialog] = useState(false);

  const fetchRecordings = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.listRecordings({
        page: 1,
        limit: 100, // Fetch more recordings for selection
        search: search || undefined,
        sortBy: 'updatedAt',
        sortOrder: 'desc',
      });
      setRecordings(response.data);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else {
        setError('Failed to load recordings');
      }
    } finally {
      setIsLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRecordings();
    }, 300); // Debounce search

    return () => clearTimeout(timer);
  }, [fetchRecordings]);

  const handleRecordingSelect = (recording: RecordingListItem) => {
    setSelectedRecording(recording);
    setShowExecutionDialog(true);
  };

  const handleRunComplete = () => {
    setShowExecutionDialog(false);
    setSelectedRecording(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/runs')}>
          <ArrowLeftIcon className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New Test Run</h1>
          <p className="text-muted-foreground">
            Select a recording to run
          </p>
        </div>
      </div>

      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle>Select Recording</CardTitle>
          <CardDescription>
            Choose a recording to execute. You can search by name or URL.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search recordings..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Error State */}
      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">{error}</p>
            <Button variant="outline" className="mt-4" onClick={fetchRecordings}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Recordings List */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-1/2 mb-4" />
                <Skeleton className="h-4 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : recordings.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {search ? 'No recordings found' : 'No recordings available'}
            </h3>
            <p className="text-muted-foreground text-center mb-4">
              {search
                ? 'Try adjusting your search terms'
                : 'Upload a recording to get started'}
            </p>
            {!search && (
              <Button onClick={() => router.push('/recordings')}>
                Go to Recordings
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recordings.map((recording) => (
            <Card
              key={recording.id}
              className={cn(
                'cursor-pointer transition-all hover:border-primary/50 hover:shadow-md',
                selectedRecording?.id === recording.id && 'border-primary ring-1 ring-primary'
              )}
              onClick={() => handleRecordingSelect(recording)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{recording.name}</h3>
                    <a
                      href={recording.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 truncate"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {new URL(recording.url).hostname}
                      <ExternalLinkIcon className="h-3 w-3 flex-shrink-0" />
                    </a>
                  </div>
                  {selectedRecording?.id === recording.id && (
                    <CheckIcon className="h-5 w-5 text-primary flex-shrink-0" />
                  )}
                </div>

                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-3">
                  <Badge variant="secondary" className="text-xs">
                    {recording.actionCount} actions
                  </Badge>
                  <span>•</span>
                  <span>{formatRelativeTime(recording.updatedAt)}</span>
                </div>

                {recording.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {recording.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="outline" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {recording.tags.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{recording.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                )}

                <Button
                  variant="default"
                  size="sm"
                  className="w-full mt-4"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRecordingSelect(recording);
                  }}
                >
                  <PlayIcon className="h-4 w-4 mr-2" />
                  Run Test
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Run Execution Dialog */}
      {selectedRecording && showExecutionDialog && (
        <RunExecutionDialog
          recording={{
            id: selectedRecording.id,
            name: selectedRecording.name,
            url: selectedRecording.url,
            actionCount: selectedRecording.actionCount,
          }}
          open={showExecutionDialog}
          onClose={() => {
            setShowExecutionDialog(false);
            setSelectedRecording(null);
          }}
          onComplete={handleRunComplete}
        />
      )}
    </div>
  );
}
