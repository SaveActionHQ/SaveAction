'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, FileJson, Globe, Hash, Loader2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/providers/toast-provider';
import { BrowserSelector } from '@/components/tests/browser-selector';
import { TestConfigForm, DEFAULT_TEST_CONFIG } from '@/components/tests/test-config-form';
import {
  api,
  type Recording,
  type TestBrowser,
  type TestConfig,
  type TestSuiteWithStats,
} from '@/lib/api';
import { useProjectFromSlug } from '@/lib/hooks';

export default function NewTestFromRecordingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { projectSlug, projectId } = useProjectFromSlug();
  const recordingId = searchParams.get('recordingId');
  const toast = useToast();

  const [recording, setRecording] = React.useState<Recording | null>(null);
  const [suites, setSuites] = React.useState<TestSuiteWithStats[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [selectedSuiteId, setSelectedSuiteId] = React.useState('');
  const [browsers, setBrowsers] = React.useState<TestBrowser[]>(['chromium']);
  const [config, setConfig] = React.useState<Partial<TestConfig>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [variables, setVariables] = React.useState<Record<string, string>>({});

  const hasVariables = Object.keys(variables).length > 0;
  const hasEmptyVariables = hasVariables && Object.values(variables).some((v) => !v || !v.trim());

  // Fetch recording and suites
  React.useEffect(() => {
    if (!recordingId) {
      setError('No recording ID provided');
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const [rec, suiteList] = await Promise.all([
          api.getRecording(recordingId),
          api.listAllSuites(projectId),
        ]);
        setRecording(rec);
        setSuites(suiteList);
        setName(rec.data?.testName || rec.name);

        // Extract variables from recording data
        const recData = rec.data as unknown as Record<string, unknown> | undefined;
        if (recData) {
          const recVars = recData.variables as Array<{ name: string }> | undefined;
          if (Array.isArray(recVars) && recVars.length > 0) {
            const vars: Record<string, string> = {};
            for (const v of recVars) {
              if (v.name) vars[v.name] = '';
            }
            setVariables(vars);
          }
        }

        // Auto-select default suite or first one
        const defaultSuite = suiteList.find((s) => s.isDefault);
        if (defaultSuite) {
          setSelectedSuiteId(defaultSuite.id);
        } else if (suiteList.length > 0) {
          setSelectedSuiteId(suiteList[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load recording');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [recordingId, projectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!recording || !recordingId) return;
    if (!name.trim()) {
      setSubmitError('Test name is required');
      return;
    }
    if (!selectedSuiteId) {
      setSubmitError('Please select a test suite');
      return;
    }
    if (hasEmptyVariables) {
      setSubmitError('All variables must have values before creating the test');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const mergedConfig = { ...DEFAULT_TEST_CONFIG, ...config };
      const test = await api.createTest(projectId, {
        name: name.trim(),
        suiteId: selectedSuiteId,
        description: description.trim() || undefined,
        recordingId,
        recordingData: recording.data as unknown as Record<string, unknown>,
        actionCount: recording.actionCount,
        browsers,
        config: mergedConfig,
        variables: hasVariables ? variables : undefined,
      });
      toast.success('Test created from recording');
      router.push(`/projects/${projectSlug}/suites/${selectedSuiteId}/tests/${test.id}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create test');
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !recording) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/projects/${projectSlug}/library`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Create Test from Recording</h1>
        </div>
        <div className="rounded-md bg-destructive/10 p-4 text-sm text-destructive">
          {error || 'Recording not found'}
        </div>
      </div>
    );
  }

  let hostname = '';
  try {
    hostname = new URL(recording.url).hostname;
  } catch {
    hostname = recording.url;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href={`/projects/${projectSlug}/library`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create Test from Recording</h1>
          <p className="text-muted-foreground">
            Configure test settings for this recording
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        {submitError && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {submitError}
          </div>
        )}

        {/* Recording Info (read-only) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recording</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                <FileJson className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold">{recording.name}</h3>
                <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                  <Globe className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{hostname}</span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Hash className="h-3 w-3" />
                    {recording.actionCount} actions
                  </span>
                  <span>v{recording.schemaVersion || '1.0.0'}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

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
                placeholder="Optional description for this test"
                disabled={isSubmitting}
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Suite Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Test Suite <span className="text-destructive">*</span></CardTitle>
          </CardHeader>
          <CardContent>
            {suites.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No test suites found. Create a suite first.
              </p>
            ) : (
              <div className="space-y-2">
                {suites.map((suite) => (
                  <label
                    key={suite.id}
                    className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                      selectedSuiteId === suite.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="suiteId"
                      value={suite.id}
                      checked={selectedSuiteId === suite.id}
                      onChange={() => setSelectedSuiteId(suite.id)}
                      disabled={isSubmitting}
                      className="accent-primary"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{suite.name}</div>
                      {suite.description && (
                        <div className="text-xs text-muted-foreground truncate">
                          {suite.description}
                        </div>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {suite.testCount} test{suite.testCount !== 1 ? 's' : ''}
                    </span>
                  </label>
                ))}
              </div>
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
            <p className="text-xs text-muted-foreground mt-2">
              The test will run once per selected browser
            </p>
          </CardContent>
        </Card>

        {/* Advanced Configuration */}
        <Card>
          <CardHeader>
            <button
              type="button"
              className="flex w-full items-center justify-between"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <CardTitle className="text-base">Configuration</CardTitle>
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

        {/* Variables (shown when recording has variables) */}
        {hasVariables && (
          <Card className={hasEmptyVariables ? 'border-destructive' : ''}>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                Variables
                {hasEmptyVariables && (
                  <span className="flex items-center gap-1 text-xs font-normal text-destructive">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    All values required
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                This recording uses variables. Set values for each variable — they replace {'${VAR}'} placeholders during execution.
              </p>
              {Object.entries(variables).map(([varName]) => (
                <div key={varName} className="space-y-1">
                  <label className="text-sm font-medium font-mono">{varName}</label>
                  <Input
                    value={variables[varName] || ''}
                    onChange={(e) =>
                      setVariables((prev) => ({ ...prev, [varName]: e.target.value }))
                    }
                    placeholder={`Enter value for ${varName}`}
                    disabled={isSubmitting}
                    className={!variables[varName]?.trim() ? 'border-destructive' : ''}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/projects/${projectSlug}/library`)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting} disabled={suites.length === 0 || hasEmptyVariables}>
            Create Test
          </Button>
        </div>
      </form>
    </div>
  );
}
