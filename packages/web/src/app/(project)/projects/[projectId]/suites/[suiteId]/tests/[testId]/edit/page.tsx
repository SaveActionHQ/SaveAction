'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/providers/toast-provider';
import { BrowserSelector } from '@/components/tests/browser-selector';
import { TestConfigForm } from '@/components/tests/test-config-form';
import { api, type Test, type TestBrowser, type TestConfig } from '@/lib/api';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Test name is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await api.updateTest(projectId, testId, {
        name: name.trim(),
        description: description.trim() || undefined,
        browsers,
        config: config as Partial<TestConfig>,
      });
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
            <Button type="submit" isLoading={isSubmitting}>
              Save Changes
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
