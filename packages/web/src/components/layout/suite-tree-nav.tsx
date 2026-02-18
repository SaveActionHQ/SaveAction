'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ChevronRight,
  FolderOpen,
  FolderClosed,
  FlaskConical,
  Plus,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { onSidebarRefresh } from '@/lib/events';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { api, type TestSuiteWithStats, type Test } from '@/lib/api';

interface SuiteTreeNavProps {
  projectId: string;
  collapsed?: boolean;
}

interface SuiteNodeProps {
  suite: TestSuiteWithStats;
  projectId: string;
  isActive: boolean;
  pathname: string;
}

function SuiteNode({ suite, projectId, isActive, pathname }: SuiteNodeProps) {
  const [expanded, setExpanded] = React.useState(isActive);
  const [tests, setTests] = React.useState<Test[]>([]);
  const [testsLoading, setTestsLoading] = React.useState(false);
  const [testsLoaded, setTestsLoaded] = React.useState(false);

  const suiteBasePath = `/projects/${projectId}/suites/${suite.id}`;

  // Auto-expand if we're viewing this suite or any of its children
  React.useEffect(() => {
    if (pathname.startsWith(suiteBasePath)) {
      setExpanded(true);
    }
  }, [pathname, suiteBasePath]);

  // Load tests when expanded
  React.useEffect(() => {
    if (expanded && !testsLoaded && suite.testCount > 0) {
      setTestsLoading(true);
      api
        .listTests(projectId, {
          suiteId: suite.id,
          limit: 50,
          sortBy: 'displayOrder',
          sortOrder: 'asc',
        })
        .then((res) => {
          setTests(res.data);
          setTestsLoaded(true);
        })
        .catch((err) => {
          console.error('Failed to load tests:', err);
        })
        .finally(() => {
          setTestsLoading(false);
        });
    }
  }, [expanded, testsLoaded, suite.testCount, suite.id, projectId]);

  // Silently refresh tests on navigation or sidebar refresh event
  const refreshTests = React.useCallback(() => {
    if (expanded && testsLoaded) {
      api
        .listTests(projectId, {
          suiteId: suite.id,
          limit: 50,
          sortBy: 'displayOrder',
          sortOrder: 'asc',
        })
        .then((res) => {
          setTests(res.data);
        })
        .catch(() => {
          // Silent — keep existing data on error
        });
    }
  }, [expanded, testsLoaded, projectId, suite.id]);

  React.useEffect(() => {
    refreshTests();
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    return onSidebarRefresh(refreshTests);
  }, [refreshTests]);

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setExpanded(!expanded);
  };

  return (
    <div>
      {/* Suite row */}
      <div className="flex items-center group">
        <button
          onClick={handleToggle}
          className="flex items-center justify-center h-6 w-6 shrink-0 rounded hover:bg-sidebar-accent transition-colors"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          <ChevronRight
            className={cn(
              'h-3.5 w-3.5 text-muted-foreground transition-transform duration-200',
              expanded && 'rotate-90'
            )}
          />
        </button>
        <Link
          href={suiteBasePath}
          className={cn(
            'flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors min-w-0',
            pathname === suiteBasePath || pathname === `${suiteBasePath}/`
              ? 'bg-sidebar-accent text-primary font-medium'
              : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
          )}
        >
          {expanded ? (
            <FolderOpen className="h-4 w-4 shrink-0 text-primary/70" />
          ) : (
            <FolderClosed className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate">{suite.name}</span>
          {suite.testCount > 0 && (
            <span className="ml-auto text-xs text-muted-foreground shrink-0">
              {suite.testCount}
            </span>
          )}
        </Link>
      </div>

      {/* Tests list (expanded) */}
      {expanded && (
        <div className="ml-6 border-l border-sidebar-border pl-2 mt-0.5 space-y-0.5">
          {testsLoading && (
            <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span>Loading...</span>
            </div>
          )}

          {!testsLoading &&
            tests.map((test) => {
              const testPath = `${suiteBasePath}/tests/${test.id}`;
              const isTestActive =
                pathname === testPath || pathname.startsWith(`${testPath}/`);

              return (
                <Link
                  key={test.id}
                  href={testPath}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors min-w-0',
                    isTestActive
                      ? 'bg-sidebar-accent text-primary font-medium'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                  )}
                >
                  <FlaskConical className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{test.name}</span>
                </Link>
              );
            })}

          {!testsLoading && testsLoaded && tests.length === 0 && (
            <p className="px-2 py-1.5 text-xs text-muted-foreground italic">
              No tests yet
            </p>
          )}

          {/* Add test link */}
          <Link
            href={`${suiteBasePath}/tests/new`}
            className="flex items-center gap-2 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
          >
            <Plus className="h-3 w-3" />
            <span>Add Test</span>
          </Link>
        </div>
      )}
    </div>
  );
}

export function SuiteTreeNav({ projectId, collapsed }: SuiteTreeNavProps) {
  const pathname = usePathname();
  const [suites, setSuites] = React.useState<TestSuiteWithStats[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const hasLoadedRef = React.useRef(false);

  const loadSuites = React.useCallback(async () => {
    try {
      // Only show loading skeleton on initial load
      if (!hasLoadedRef.current) {
        setLoading(true);
      }
      setError(null);
      const data = await api.listAllSuites(projectId);
      setSuites(data);
      hasLoadedRef.current = true;
    } catch (err) {
      console.error('Failed to load suites:', err);
      if (!hasLoadedRef.current) {
        setError('Failed to load suites');
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Fetch suites on mount and silently refresh on every navigation
  React.useEffect(() => {
    loadSuites();
  }, [loadSuites, pathname]);

  // Also refresh when a mutation event is emitted (delete, etc.)
  React.useEffect(() => {
    return onSidebarRefresh(loadSuites);
  }, [loadSuites]);

  // Don't render tree when sidebar is collapsed
  if (collapsed) {
    return null;
  }

  if (loading) {
    return (
      <div className="space-y-2 px-2">
        <div className="flex items-center justify-between px-1">
          <Skeleton className="h-4 w-24" />
        </div>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-3 py-2">
        <p className="text-xs text-destructive">{error}</p>
        <Button
          variant="ghost"
          size="sm"
          className="mt-1 h-auto py-1 text-xs"
          onClick={() => {
            setLoading(true);
            setError(null);
            api
              .listAllSuites(projectId)
              .then(setSuites)
              .catch(() => setError('Failed to load'))
              .finally(() => setLoading(false));
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* Section header */}
      <div className="flex items-center justify-between px-3 pt-1 pb-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Test Suites
        </span>
        <Link
          href={`/projects/${projectId}/suites/new`}
          className="flex items-center justify-center h-5 w-5 rounded hover:bg-sidebar-accent transition-colors"
          title="New Suite"
        >
          <Plus className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
        </Link>
      </div>

      {/* Suite tree */}
      {suites.length > 0 ? (
        <div className="space-y-0.5 px-1">
          {suites.map((suite) => {
            const suiteBasePath = `/projects/${projectId}/suites/${suite.id}`;
            const isActive = pathname.startsWith(suiteBasePath);

            return (
              <SuiteNode
                key={suite.id}
                suite={suite}
                projectId={projectId}
                isActive={isActive}
                pathname={pathname}
              />
            );
          })}
        </div>
      ) : (
        <div className="px-3 py-2">
          <p className="text-xs text-muted-foreground">No suites yet</p>
          <Link
            href={`/projects/${projectId}/suites/new`}
            className="inline-flex items-center gap-1 mt-1 text-xs text-primary hover:underline"
          >
            <Plus className="h-3 w-3" />
            Create Suite
          </Link>
        </div>
      )}
    </div>
  );
}
