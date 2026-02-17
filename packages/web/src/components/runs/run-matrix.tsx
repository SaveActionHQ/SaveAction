'use client';

import * as React from 'react';
import {
  BrowserResultCell,
  BrowserResultCellSkeleton,
  BrowserIcon,
  browserLabel,
} from './browser-result-cell';
import { RunStatusBadge } from './run-status-badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { Run, RunBrowserResult } from '@/lib/api';

// ─── Types ──────────────────────────────────────────────────────

interface TestRow {
  testId: string;
  testName: string;
}

// ─── RunMatrix Component ────────────────────────────────────────

interface RunMatrixProps {
  /** The parent run */
  run: Run;
  /** Per-browser results */
  browserResults: RunBrowserResult[];
  /** Optional test metadata for better labels */
  tests?: TestRow[];
  /** Called when a cell is clicked */
  onCellClick?: (result: RunBrowserResult) => void;
  /** Show compact cells */
  compact?: boolean;
  className?: string;
}

/**
 * Test × Browser results matrix.
 *
 * Displays a grid where rows are tests and columns are browsers.
 * Each cell shows pass/fail/running/pending status.
 *
 * ```
 *                 Chrome   Firefox   Safari
 * Login Test        ✅        ✅       ✅
 * Add to Cart       ✅        ❌       ✅
 * Checkout          ✅        ✅       ⏳
 * ```
 */
export function RunMatrix({
  run,
  browserResults,
  tests,
  onCellClick,
  compact = false,
  className,
}: RunMatrixProps) {
  // Ensure browserResults is always an array
  const safeResults = browserResults ?? [];

  // Derive unique browsers and tests from results
  const browsers = React.useMemo(() => {
    const set = new Set<string>();
    safeResults.forEach((r) => set.add(r.browser));
    // If no results yet, use the run's browser
    if (set.size === 0 && run.browser) {
      set.add(run.browser);
    }
    return Array.from(set).sort((a, b) => {
      const order = ['chromium', 'firefox', 'webkit'];
      return order.indexOf(a) - order.indexOf(b);
    });
  }, [safeResults, run.browser]);

  const testIds = React.useMemo(() => {
    const seen = new Map<string, string>();
    safeResults.forEach((r) => {
      if (!seen.has(r.testId)) {
        const test = tests?.find((t) => t.testId === r.testId);
        seen.set(r.testId, test?.testName ?? r.testId.slice(0, 8));
      }
    });
    return Array.from(seen.entries()); // [testId, label][]
  }, [safeResults, tests]);

  // Build lookup: testId:browser → result
  const resultMap = React.useMemo(() => {
    const map = new Map<string, RunBrowserResult>();
    safeResults.forEach((r) => {
      map.set(`${r.testId}:${r.browser}`, r);
    });
    return map;
  }, [safeResults]);

  // If no browser results, show a fallback "single browser" view
  if (safeResults.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <BrowserIcon browser={run.browser} className="h-5 w-5 text-muted-foreground" />
            <span className="text-sm font-medium">{browserLabel(run.browser)}</span>
            <RunStatusBadge status={run.status} size="sm" />
            {run.durationMs != null && (
              <span className="text-xs text-muted-foreground ml-auto">
                {run.durationMs < 1000
                  ? `${run.durationMs}ms`
                  : `${(run.durationMs / 1000).toFixed(1)}s`}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Single test: show horizontal browser results
  if (testIds.length <= 1) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Browser Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {browsers.map((browser) => {
              const key = testIds.length > 0 ? `${testIds[0][0]}:${browser}` : '';
              const result = resultMap.get(key);

              return (
                <div key={browser} className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <BrowserIcon browser={browser} className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-medium">{browserLabel(browser)}</span>
                  </div>
                  {result ? (
                    <BrowserResultCell
                      result={result}
                      compact={compact}
                      onClick={onCellClick ? () => onCellClick(result) : undefined}
                    />
                  ) : (
                    <BrowserResultCellSkeleton compact={compact} />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Full matrix: multiple tests × multiple browsers
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium">Results Matrix</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="text-left font-medium text-muted-foreground pb-3 pr-4 min-w-[160px]">
                Test
              </th>
              {browsers.map((browser) => (
                <th
                  key={browser}
                  className="text-center font-medium text-muted-foreground pb-3 px-2"
                >
                  <div className="flex flex-col items-center gap-1">
                    <BrowserIcon browser={browser} className="h-4 w-4" />
                    <span className="text-xs">{browserLabel(browser)}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {testIds.map(([testId, testName]) => (
              <tr key={testId} className="border-t border-border/50">
                <td className="py-2 pr-4">
                  <span className="font-medium text-sm truncate block max-w-[200px]" title={testName}>
                    {testName}
                  </span>
                </td>
                {browsers.map((browser) => {
                  const result = resultMap.get(`${testId}:${browser}`);
                  return (
                    <td key={browser} className="py-2 px-2 text-center">
                      {result ? (
                        <div className="flex justify-center">
                          <BrowserResultCell
                            result={result}
                            compact={compact}
                            onClick={
                              onCellClick ? () => onCellClick(result) : undefined
                            }
                          />
                        </div>
                      ) : (
                        <div className="flex justify-center">
                          <BrowserResultCellSkeleton compact={compact} />
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

// ─── RunMatrixSkeleton ──────────────────────────────────────────

interface RunMatrixSkeletonProps {
  rows?: number;
  browsers?: number;
  className?: string;
}

export function RunMatrixSkeleton({
  rows = 3,
  browsers = 3,
  className,
}: RunMatrixSkeletonProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Header row */}
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-24" />
            {Array.from({ length: browsers }).map((_, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <Skeleton className="h-4 w-4 rounded-full" />
                <Skeleton className="h-3 w-10" />
              </div>
            ))}
          </div>
          {/* Data rows */}
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 pt-2 border-t border-border/50">
              <Skeleton className="h-4 w-24" />
              {Array.from({ length: browsers }).map((_, j) => (
                <BrowserResultCellSkeleton key={j} compact />
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
