'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/providers/toast-provider';
import { BrowserSelector } from '@/components/tests/browser-selector';
import { TestConfigForm, DEFAULT_TEST_CONFIG } from '@/components/tests/test-config-form';
import { RecordingUpload } from '@/components/tests/recording-upload';
import { api, type TestBrowser, type TestConfig } from '@/lib/api';

interface RecordingInfo {
  data: Record<string, unknown>;
  name: string;
  url: string;
  actionCount: number;
  version: string;
  viewport?: { width: number; height: number };
}

export default function NewTestPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.projectId as string;
  const suiteId = params.suiteId as string;
  const toast = useToast();

  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [recording, setRecording] = React.useState<RecordingInfo | null>(null);
  const [browsers, setBrowsers] = React.useState<TestBrowser[]>(['chromium']);
  const [config, setConfig] = React.useState<Partial<TestConfig>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = React.useState(false);

  // Auto-fill name from recording
  const handleRecordingChange = (info: RecordingInfo | null) => {
    setRecording(info);
    if (info && !name) {
      setName(info.name);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!recording) {
      setError('Please upload a recording file');
      return;
    }
    if (!name.trim()) {
      setError('Test name is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const mergedConfig = { ...DEFAULT_TEST_CONFIG, ...config };
      const test = await api.createTest(projectId, {
        name: name.trim(),
        suiteId,
        description: description.trim() || undefined,
        recordingData: recording.data,
        actionCount: recording.actionCount,
        browsers,
        config: mergedConfig,
      });
      toast.success('Test created');
      router.push(`/projects/${projectId}/suites/${suiteId}/tests/${test.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create test');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/projects/${projectId}/suites/${suiteId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Add New Test</h1>
          <p className="text-muted-foreground">
            Upload a recording and configure test settings
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Step 1: Recording */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">1. Upload Recording</CardTitle>
          </CardHeader>
          <CardContent>
            <RecordingUpload
              value={recording}
              onChange={handleRecordingChange}
              disabled={isSubmitting}
            />
          </CardContent>
        </Card>

        {/* Step 2: Test Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Test Details</CardTitle>
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
                placeholder="Optional description for this test"
                disabled={isSubmitting}
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Step 3: Browsers */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">3. Target Browsers</CardTitle>
          </CardHeader>
          <CardContent>
            <BrowserSelector
              value={browsers}
              onChange={setBrowsers}
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground mt-2">
              The test will run once per selected browser
            </p>
          </CardContent>
        </Card>

        {/* Step 4: Advanced Configuration (collapsible) */}
        <Card>
          <CardHeader>
            <button
              type="button"
              className="flex w-full items-center justify-between"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <CardTitle className="text-base">4. Configuration</CardTitle>
              <span className="text-xs text-muted-foreground">
                {showAdvanced ? 'Hide' : 'Show'} advanced options
              </span>
            </button>
          </CardHeader>
          {showAdvanced && (
            <CardContent>
              <TestConfigForm
                value={config}
                onChange={setConfig}
                disabled={isSubmitting}
              />
            </CardContent>
          )}
        </Card>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/projects/${projectId}/suites/${suiteId}`)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            Create Test
          </Button>
        </div>
      </form>
    </div>
  );
}
