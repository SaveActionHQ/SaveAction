'use client';

import * as React from 'react';
import Link from 'next/link';
import { Plus, FolderOpen, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SuiteCard, SuiteCardSkeleton } from './suite-card';
import { api, TestSuiteWithStats } from '@/lib/api';

interface SuiteListProps {
  projectId: string;
  projectSlug: string;
  onEdit?: (suite: TestSuiteWithStats) => void;
  onDelete?: (suite: TestSuiteWithStats) => void;
  onRun?: (suite: TestSuiteWithStats) => void;
  /** Trigger to force refresh (increment to reload) */
  refreshKey?: number;
}

export function SuiteList({
  projectId,
  projectSlug,
  onEdit,
  onDelete,
  onRun,
  refreshKey,
}: SuiteListProps) {
  const [suites, setSuites] = React.useState<TestSuiteWithStats[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState('');

  const loadSuites = React.useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.listAllSuites(projectId);
      setSuites(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load test suites');
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  React.useEffect(() => {
    loadSuites();
  }, [loadSuites, refreshKey]);

  const filteredSuites = React.useMemo(() => {
    if (!search.trim()) return suites;
    const query = search.toLowerCase();
    return suites.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.description?.toLowerCase().includes(query)
    );
  }, [suites, search]);

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <SuiteCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={loadSuites}
          className="mt-2 text-destructive hover:text-destructive"
        >
          Try again
        </Button>
      </div>
    );
  }

  if (suites.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <FolderOpen className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="mt-4 text-lg font-semibold">No test suites yet</h3>
        <p className="mt-2 max-w-sm text-center text-sm text-muted-foreground">
          Test suites help you organize related tests into logical groups.
          Create your first suite to get started.
        </p>
        <Button className="mt-6" asChild>
          <Link href={`/projects/${projectSlug}/suites/new`}>
            <Plus className="mr-2 h-4 w-4" />
            Create Test Suite
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search (only show if there are suites) */}
      {suites.length > 3 && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search suites..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      )}

      {/* No search results */}
      {search && filteredSuites.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12">
          <p className="text-sm text-muted-foreground">
            No suites match &quot;{search}&quot;
          </p>
          <Button variant="ghost" size="sm" onClick={() => setSearch('')} className="mt-2">
            Clear search
          </Button>
        </div>
      )}

      {/* Suite grid */}
      {filteredSuites.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSuites.map((suite) => (
            <SuiteCard
              key={suite.id}
              suite={suite}
              projectSlug={projectSlug}
              onEdit={onEdit}
              onDelete={onDelete}
              onRun={onRun}
            />
          ))}
        </div>
      )}
    </div>
  );
}
