'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Play, TestTube2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/ui/dialog';
import { useToast } from '@/components/providers/toast-provider';
import { TestCard, TestCardSkeleton } from '@/components/tests/test-card';
import { api, TestSuite, Test } from '@/lib/api';

export default function SuiteDetailPage() {
  const params = useParams();
  const projectId = params.projectId as string;
  const suiteId = params.suiteId as string;
  const toast = useToast();

  const [suite, setSuite] = React.useState<TestSuite | null>(null);
  const [tests, setTests] = React.useState<Test[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [deletingTest, setDeletingTest] = React.useState<Test | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isRunning, setIsRunning] = React.useState(false);
  const router = useRouter();

  const loadData = React.useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [suiteData, testsData] = await Promise.all([
        api.getSuite(projectId, suiteId),
        api.listTests(projectId, { suiteId, limit: 100 }),
      ]);
      setSuite(suiteData);
      setTests(testsData.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load suite');
    } finally {
      setIsLoading(false);
    }
  }, [projectId, suiteId]);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRunSuite = async () => {
    if (isRunning || tests.length === 0) return;
    setIsRunning(true);
    try {
      const result = await api.runSuite({
        suiteId,
        projectId,
        triggeredBy: 'manual',
      });
      toast.success(
        `Suite run queued — ${result.testRuns.length} ${result.testRuns.length === 1 ? 'test' : 'tests'} started`
      );
      router.push(`/projects/${projectId}/runs/${result.suiteRun.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to run suite');
    } finally {
      setIsRunning(false);
    }
  };

  const handleDeleteTest = async () => {
    if (!deletingTest) return;
    setIsDeleting(true);
    try {
      await api.deleteTest(projectId, deletingTest.id);
      setTests((prev) => prev.filter((t) => t.id !== deletingTest.id));
      toast.success('Test deleted');
      setDeletingTest(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete test');
    } finally {
      setIsDeleting(false);
    }
  };

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/projects/${projectId}/suites`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">Test Suite</h1>
        </div>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadData}
            className="mt-2 text-destructive hover:text-destructive"
          >
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/projects/${projectId}/suites`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            {isLoading ? (
              <>
                <Skeleton className="h-7 w-48" />
                <Skeleton className="h-4 w-32 mt-1" />
              </>
            ) : (
              <>
                <h1 className="text-2xl font-bold tracking-tight">
                  {suite?.name || 'Test Suite'}
                </h1>
                <p className="text-muted-foreground">
                  {suite?.description ||
                    `${tests.length} ${tests.length === 1 ? 'test' : 'tests'} in this suite`}
                </p>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            disabled={tests.length === 0 || isRunning}
            onClick={handleRunSuite}
          >
            <Play className="mr-2 h-4 w-4" />
            {isRunning ? 'Running...' : 'Run Suite'}
          </Button>
          <Button asChild>
            <Link href={`/projects/${projectId}/suites/${suiteId}/tests/new`}>
              <Plus className="mr-2 h-4 w-4" />
              Add Test
            </Link>
          </Button>
        </div>
      </div>

      {/* Tests list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <TestCardSkeleton key={i} />
          ))}
        </div>
      ) : tests.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <TestTube2 className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">No tests yet</h3>
          <p className="mt-2 max-w-sm text-center text-sm text-muted-foreground">
            Add tests to this suite by uploading browser recordings.
            Each test saves its configuration for one-click runs.
          </p>
          <Button className="mt-6" asChild>
            <Link href={`/projects/${projectId}/suites/${suiteId}/tests/new`}>
              <Plus className="mr-2 h-4 w-4" />
              Add Test
            </Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {tests.map((test) => (
            <TestCard
              key={test.id}
              test={test}
              projectId={projectId}
              suiteId={suiteId}
              onDelete={setDeletingTest}
            />
          ))}
        </div>
      )}

      {/* Delete test confirmation */}
      <ConfirmDialog
        open={!!deletingTest}
        onClose={() => setDeletingTest(null)}
        onConfirm={handleDeleteTest}
        title="Delete Test"
        description={`Are you sure you want to delete "${deletingTest?.name}"? All run history for this test will be preserved but the test configuration will be removed.`}
        confirmLabel="Delete Test"
        variant="destructive"
        isLoading={isDeleting}
      />
    </div>
  );
}
