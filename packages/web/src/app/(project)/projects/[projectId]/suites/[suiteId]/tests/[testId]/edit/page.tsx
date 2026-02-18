'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Upload, Library, FileJson } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/providers/toast-provider';
import { BrowserSelector } from '@/components/tests/browser-selector';
import { TestConfigForm } from '@/components/tests/test-config-form';
import { RecordingUpload } from '@/components/tests/recording-upload';
import { RecordingSearchSelect, type SelectedRecording } from '@/components/tests/recording-search-select';
import { api, type Test, type TestBrowser, type TestConfig, type Recording } from '@/lib/api';
import { cn } from '@/lib/utils';

type RecordingChangeMode = 'none' | 'upload' | 'library';

interface RecordingInfo {
  data: Record<string, unknown>;
  name: string;
  url: string;
  actionCount: number;
  version: string;
  viewport?: { width: number; height: number };
}

export default function EditTestPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const suiteId = params.suiteId as string;
  const testId = params.testId as string;
  const toast = useToast();

  const [test, setTest] = React.useState<Test | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  // Form state
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [browsers, setBrowsers] = React.useState<TestBrowser[]>(['chromium']);
  const [config, setConfig] = React.useState<Partial<TestConfig>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Recording change state
  const [changeMode, setChangeMode] = React.useState<RecordingChangeMode>('none');
  const [uploadedRecording, setUploadedRecording] = React.useState<RecordingInfo | null>(null);
  const [libraryRecording, setLibraryRecording] = React.useState<SelectedRecording | null>(null);
  const [libraryRecordingData, setLibraryRecordingData] = React.useState<Record<string, unknown> | null>(null);
  const [isLoadingRecording, setIsLoadingRecording] = React.useState(false);

  // Load test data
  React.useEffect(() => {
    async function load() {
      try {
        setIsLoading(true);
        setLoadError(null);
        const data = await api.getTest(projectId, testId);
        setTest(data);
        setName(data.name);
        setDescription(data.description || '');
        setBrowsers(data.browsers);
        setConfig(data.config);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : 'Failed to load test');
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [projectId, testId]);

  // Handle library recording selection
  const handleLibraryChange = async (selected: SelectedRecording | null) => {
    setLibraryRecording(selected);
    setLibraryRecordingData(null);

    if (selected) {
      setIsLoadingRecording(true);
      try {
        const full: Recording = await api.getRecording(selected.id);
        setLibraryRecordingData(full.data as unknown as Record<string, unknown>);
      } catch {
        setError('Failed to load recording data from library');
        setLibraryRecording(null);
      } finally {
        setIsLoadingRecording(false);
      }
    }
  };

  const cancelRecordingChange = () => {
    setChangeMode('none');
    setUploadedRecording(null);
    setLibraryRecording(null);
    setLibraryRecordingData(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Test name is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const updateData: Record<string, unknown> = {
        name: name.trim(),
        description: description.trim() || undefined,
        browsers,
        config: config as Partial<TestConfig>,
      };

      // Include recording change if user swapped
      if (changeMode === 'upload' && uploadedRecording) {
        updateData.recordingData = uploadedRecording.data;
        updateData.actionCount = uploadedRecording.actionCount;
        updateData.recordingId = null; // Clear library link
      } else if (changeMode === 'library' && libraryRecording && libraryRecordingData) {
        updateData.recordingData = libraryRecordingData;
        updateData.actionCount = libraryRecording.actionCount;
        updateData.recordingId = libraryRecording.id;
      }

      await api.updateTest(projectId, testId, updateData);
      toast.success('Test updated');
      router.push(`/projects/${projectId}/suites/${suiteId}/tests/${testId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update test');
      setIsSubmitting(false);
    }
  };

  const backUrl = `/projects/${projectId}/suites/${suiteId}/tests/${testId}`;

  if (loadError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={backUrl}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Edit Test</h1>
        </div>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
          <p className="text-sm text-destructive">{loadError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={backUrl}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          {isLoading ? (
            <>
              <Skeleton className="h-7 w-40" />
              <Skeleton className="h-4 w-56 mt-1" />
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold tracking-tight">Edit Test</h1>
              <p className="text-muted-foreground">
                Update configuration for &ldquo;{test?.name}&rdquo;
              </p>
            </>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="max-w-2xl space-y-6">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Test Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Test Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="test-name" className="text-sm font-medium">
                  Test Name <span className="text-destructive">*</span>
                </label>
                <Input
                  id="test-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Login with valid credentials"
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="test-description" className="text-sm font-medium">
                  Description
                </label>
                <Textarea
                  id="test-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional description"
                  disabled={isSubmitting}
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Recording */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recording</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {changeMode === 'none' ? (
                <>
                  {/* Current recording info */}
                  <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted shrink-0">
                      <FileJson className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">Current recording</p>
                      <p className="text-xs text-muted-foreground">
                        {test?.actionCount ?? 0} actions
                        {test?.recordingId && (
                          <span className="ml-1.5 inline-flex items-center gap-1 text-primary">
                            <Library className="h-3 w-3" /> Linked to library
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  {/* Change buttons */}
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setChangeMode('upload')}
                      disabled={isSubmitting}
                    >
                      <Upload className="h-3.5 w-3.5 mr-1.5" />
                      Upload New
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setChangeMode('library')}
                      disabled={isSubmitting}
                    >
                      <Library className="h-3.5 w-3.5 mr-1.5" />
                      From Library
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  {/* Source toggle */}
                  <div className="flex gap-2 rounded-lg bg-muted p-1">
                    <button
                      type="button"
                      className={cn(
                        'flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        changeMode === 'upload'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                      onClick={() => setChangeMode('upload')}
                      disabled={isSubmitting}
                    >
                      <Upload className="h-4 w-4" />
                      Upload File
                    </button>
                    <button
                      type="button"
                      className={cn(
                        'flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        changeMode === 'library'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                      onClick={() => setChangeMode('library')}
                      disabled={isSubmitting}
                    >
                      <Library className="h-4 w-4" />
                      From Library
                    </button>
                  </div>

                  {changeMode === 'upload' ? (
                    <RecordingUpload
                      value={uploadedRecording}
                      onChange={setUploadedRecording}
                      disabled={isSubmitting}
                    />
                  ) : (
                    <div className="space-y-2">
                      <RecordingSearchSelect
                        projectId={projectId}
                        value={libraryRecording}
                        onChange={handleLibraryChange}
                        disabled={isSubmitting || isLoadingRecording}
                        label=""
                      />
                      {isLoadingRecording && (
                        <p className="text-xs text-muted-foreground animate-pulse">
                          Loading recording data…
                        </p>
                      )}
                    </div>
                  )}

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={cancelRecordingChange}
                    disabled={isSubmitting}
                  >
                    Cancel change
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Browsers */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Target Browsers</CardTitle>
            </CardHeader>
            <CardContent>
              <BrowserSelector
                value={browsers}
                onChange={setBrowsers}
                disabled={isSubmitting}
              />
            </CardContent>
          </Card>

          {/* Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Run Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <TestConfigForm
                value={config}
                onChange={setConfig}
                disabled={isSubmitting}
              />
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(backUrl)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting} disabled={isLoadingRecording}>
              Save Changes
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
