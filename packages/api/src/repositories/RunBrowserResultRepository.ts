/**
 * Run Browser Result Repository
 *
 * Data access layer for per-browser execution results.
 * Uses Drizzle ORM for type-safe queries.
 *
 * When a test runs on multiple browsers, each browser
 * execution gets its own row for the matrix view.
 */

import { eq, and, sql, desc, asc, inArray } from 'drizzle-orm';
import {
  runBrowserResults,
  type RunBrowserResult,
  type NewRunBrowserResult,
  type BrowserResultStatus,
} from '../db/schema/run-browser-results.js';
import type { Database } from '../db/index.js';

/**
 * Browser result creation data
 */
export interface BrowserResultCreateData {
  userId: string;
  runId: string;
  testId: string;
  browser: string;
  status?: BrowserResultStatus;
}

/**
 * Browser result update data
 */
export interface BrowserResultUpdateData {
  status?: BrowserResultStatus;
  durationMs?: number;
  startedAt?: Date;
  completedAt?: Date;
  actionsTotal?: number;
  actionsExecuted?: number;
  actionsFailed?: number;
  actionsSkipped?: number;
  errorMessage?: string;
  errorStack?: string;
  errorActionId?: string;
  errorActionIndex?: number;
  videoPath?: string;
  screenshotPath?: string;
  tracePath?: string;
}

/**
 * Safe browser result response (parsed fields)
 */
export interface SafeBrowserResult {
  id: string;
  userId: string;
  runId: string;
  testId: string;
  browser: string;
  status: BrowserResultStatus;
  durationMs: number | null;
  startedAt: Date | null;
  completedAt: Date | null;
  actionsTotal: number | null;
  actionsExecuted: number | null;
  actionsFailed: number | null;
  actionsSkipped: number | null;
  errorMessage: string | null;
  errorStack: string | null;
  errorActionId: string | null;
  errorActionIndex: number | null;
  videoPath: string | null;
  screenshotPath: string | null;
  tracePath: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Browser result summary (for matrix view)
 */
export interface BrowserResultSummary {
  id: string;
  runId: string;
  testId: string;
  browser: string;
  status: BrowserResultStatus;
  durationMs: number | null;
  actionsTotal: number | null;
  actionsFailed: number | null;
  errorMessage: string | null;
}

/**
 * Convert raw DB result to SafeBrowserResult
 */
function toSafeBrowserResult(result: RunBrowserResult): SafeBrowserResult {
  return {
    id: result.id,
    userId: result.userId,
    runId: result.runId,
    testId: result.testId,
    browser: result.browser,
    status: result.status,
    durationMs: result.durationMs ? parseInt(result.durationMs, 10) : null,
    startedAt: result.startedAt,
    completedAt: result.completedAt,
    actionsTotal: result.actionsTotal ? parseInt(result.actionsTotal, 10) : null,
    actionsExecuted: result.actionsExecuted ? parseInt(result.actionsExecuted, 10) : null,
    actionsFailed: result.actionsFailed ? parseInt(result.actionsFailed, 10) : null,
    actionsSkipped: result.actionsSkipped ? parseInt(result.actionsSkipped, 10) : null,
    errorMessage: result.errorMessage,
    errorStack: result.errorStack,
    errorActionId: result.errorActionId,
    errorActionIndex: result.errorActionIndex ? parseInt(result.errorActionIndex, 10) : null,
    videoPath: result.videoPath,
    screenshotPath: result.screenshotPath,
    tracePath: result.tracePath,
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
  };
}

/**
 * Convert raw DB result to BrowserResultSummary
 */
function toBrowserResultSummary(
  result: Partial<RunBrowserResult>
): BrowserResultSummary {
  return {
    id: result.id!,
    runId: result.runId!,
    testId: result.testId!,
    browser: result.browser!,
    status: result.status!,
    durationMs: result.durationMs ? parseInt(result.durationMs, 10) : null,
    actionsTotal: result.actionsTotal ? parseInt(result.actionsTotal, 10) : null,
    actionsFailed: result.actionsFailed ? parseInt(result.actionsFailed, 10) : null,
    errorMessage: result.errorMessage ?? null,
  };
}

/**
 * Run Browser Result Repository class
 */
export class RunBrowserResultRepository {
  constructor(private readonly db: Database) {}

  /**
   * Create a new browser result
   */
  async create(data: BrowserResultCreateData): Promise<SafeBrowserResult> {
    const newResult: NewRunBrowserResult = {
      userId: data.userId,
      runId: data.runId,
      testId: data.testId,
      browser: data.browser,
      status: data.status ?? 'pending',
    };

    const result = await this.db
      .insert(runBrowserResults)
      .values(newResult)
      .returning();

    return toSafeBrowserResult(result[0]);
  }

  /**
   * Create multiple browser results at once (for multi-browser runs)
   */
  async createMany(
    dataList: BrowserResultCreateData[]
  ): Promise<SafeBrowserResult[]> {
    if (dataList.length === 0) return [];

    const values: NewRunBrowserResult[] = dataList.map((data) => ({
      userId: data.userId,
      runId: data.runId,
      testId: data.testId,
      browser: data.browser,
      status: data.status ?? 'pending',
    }));

    const result = await this.db
      .insert(runBrowserResults)
      .values(values)
      .returning();

    return result.map(toSafeBrowserResult);
  }

  /**
   * Find a browser result by ID
   */
  async findById(id: string): Promise<SafeBrowserResult | null> {
    const result = await this.db
      .select()
      .from(runBrowserResults)
      .where(eq(runBrowserResults.id, id))
      .limit(1);

    return result[0] ? toSafeBrowserResult(result[0]) : null;
  }

  /**
   * Find a browser result by ID and verify ownership
   */
  async findByIdAndUser(
    id: string,
    userId: string
  ): Promise<SafeBrowserResult | null> {
    const result = await this.db
      .select()
      .from(runBrowserResults)
      .where(
        and(
          eq(runBrowserResults.id, id),
          eq(runBrowserResults.userId, userId)
        )
      )
      .limit(1);

    return result[0] ? toSafeBrowserResult(result[0]) : null;
  }

  /**
   * Get all browser results for a run
   */
  async findByRunId(runId: string): Promise<SafeBrowserResult[]> {
    const result = await this.db
      .select()
      .from(runBrowserResults)
      .where(eq(runBrowserResults.runId, runId))
      .orderBy(asc(runBrowserResults.browser));

    return result.map(toSafeBrowserResult);
  }

  /**
   * Get browser result summaries for a run (matrix view)
   */
  async findSummariesByRunId(runId: string): Promise<BrowserResultSummary[]> {
    const result = await this.db
      .select({
        id: runBrowserResults.id,
        runId: runBrowserResults.runId,
        testId: runBrowserResults.testId,
        browser: runBrowserResults.browser,
        status: runBrowserResults.status,
        durationMs: runBrowserResults.durationMs,
        actionsTotal: runBrowserResults.actionsTotal,
        actionsFailed: runBrowserResults.actionsFailed,
        errorMessage: runBrowserResults.errorMessage,
      })
      .from(runBrowserResults)
      .where(eq(runBrowserResults.runId, runId))
      .orderBy(asc(runBrowserResults.browser));

    return result.map(toBrowserResultSummary);
  }

  /**
   * Get all browser results for a test (history across runs)
   */
  async findByTestId(
    testId: string,
    limit = 50
  ): Promise<SafeBrowserResult[]> {
    const result = await this.db
      .select()
      .from(runBrowserResults)
      .where(eq(runBrowserResults.testId, testId))
      .orderBy(desc(runBrowserResults.createdAt))
      .limit(limit);

    return result.map(toSafeBrowserResult);
  }

  /**
   * Find a specific result by run + test + browser (unique combo)
   */
  async findByRunTestBrowser(
    runId: string,
    testId: string,
    browser: string
  ): Promise<SafeBrowserResult | null> {
    const result = await this.db
      .select()
      .from(runBrowserResults)
      .where(
        and(
          eq(runBrowserResults.runId, runId),
          eq(runBrowserResults.testId, testId),
          eq(runBrowserResults.browser, browser)
        )
      )
      .limit(1);

    return result[0] ? toSafeBrowserResult(result[0]) : null;
  }

  /**
   * Update a browser result
   */
  async update(
    id: string,
    data: BrowserResultUpdateData
  ): Promise<SafeBrowserResult | null> {
    const updateData: Record<string, unknown> = {};

    if (data.status !== undefined) updateData.status = data.status;
    if (data.startedAt !== undefined) updateData.startedAt = data.startedAt;
    if (data.completedAt !== undefined) updateData.completedAt = data.completedAt;
    if (data.durationMs !== undefined) updateData.durationMs = String(data.durationMs);
    if (data.actionsTotal !== undefined) updateData.actionsTotal = String(data.actionsTotal);
    if (data.actionsExecuted !== undefined) updateData.actionsExecuted = String(data.actionsExecuted);
    if (data.actionsFailed !== undefined) updateData.actionsFailed = String(data.actionsFailed);
    if (data.actionsSkipped !== undefined) updateData.actionsSkipped = String(data.actionsSkipped);
    if (data.errorMessage !== undefined) updateData.errorMessage = data.errorMessage;
    if (data.errorStack !== undefined) updateData.errorStack = data.errorStack;
    if (data.errorActionId !== undefined) updateData.errorActionId = data.errorActionId;
    if (data.errorActionIndex !== undefined) updateData.errorActionIndex = String(data.errorActionIndex);
    if (data.videoPath !== undefined) updateData.videoPath = data.videoPath;
    if (data.screenshotPath !== undefined) updateData.screenshotPath = data.screenshotPath;
    if (data.tracePath !== undefined) updateData.tracePath = data.tracePath;

    const result = await this.db
      .update(runBrowserResults)
      .set(updateData)
      .where(eq(runBrowserResults.id, id))
      .returning();

    return result[0] ? toSafeBrowserResult(result[0]) : null;
  }

  /**
   * Mark a browser result as started
   */
  async markStarted(id: string): Promise<SafeBrowserResult | null> {
    return this.update(id, {
      status: 'running',
      startedAt: new Date(),
    });
  }

  /**
   * Mark a browser result as passed
   */
  async markPassed(
    id: string,
    data: {
      durationMs: number;
      actionsTotal: number;
      actionsExecuted: number;
      videoPath?: string;
      screenshotPath?: string;
      tracePath?: string;
    }
  ): Promise<SafeBrowserResult | null> {
    return this.update(id, {
      status: 'passed',
      completedAt: new Date(),
      durationMs: data.durationMs,
      actionsTotal: data.actionsTotal,
      actionsExecuted: data.actionsExecuted,
      actionsFailed: 0,
      actionsSkipped: 0,
      videoPath: data.videoPath,
      screenshotPath: data.screenshotPath,
      tracePath: data.tracePath,
    });
  }

  /**
   * Mark a browser result as failed
   */
  async markFailed(
    id: string,
    data: {
      durationMs: number;
      actionsTotal: number;
      actionsExecuted: number;
      actionsFailed: number;
      actionsSkipped?: number;
      errorMessage: string;
      errorStack?: string;
      errorActionId?: string;
      errorActionIndex?: number;
      videoPath?: string;
      screenshotPath?: string;
      tracePath?: string;
    }
  ): Promise<SafeBrowserResult | null> {
    return this.update(id, {
      status: 'failed',
      completedAt: new Date(),
      ...data,
    });
  }

  /**
   * Cancel all pending/running browser results for a run
   */
  async cancelByRunId(runId: string): Promise<number> {
    const result = await this.db
      .update(runBrowserResults)
      .set({
        status: 'cancelled',
        completedAt: new Date(),
      })
      .where(
        and(
          eq(runBrowserResults.runId, runId),
          inArray(runBrowserResults.status, ['pending', 'running'])
        )
      )
      .returning();

    return result.length;
  }

  /**
   * Delete all browser results for a run
   */
  async deleteByRunId(runId: string): Promise<number> {
    const result = await this.db
      .delete(runBrowserResults)
      .where(eq(runBrowserResults.runId, runId))
      .returning();

    return result.length;
  }

  /**
   * Get distinct browsers for multiple runs (batch query).
   * Returns a map of runId → sorted browser names.
   */
  async getBrowsersByRunIds(runIds: string[]): Promise<Map<string, string[]>> {
    if (runIds.length === 0) return new Map();

    const result = await this.db
      .select({
        runId: runBrowserResults.runId,
        browser: runBrowserResults.browser,
      })
      .from(runBrowserResults)
      .where(inArray(runBrowserResults.runId, runIds))
      .orderBy(asc(runBrowserResults.browser));

    const map = new Map<string, Set<string>>();
    for (const row of result) {
      if (!map.has(row.runId)) {
        map.set(row.runId, new Set());
      }
      map.get(row.runId)!.add(row.browser);
    }

    const sorted = new Map<string, string[]>();
    const order = ['chromium', 'firefox', 'webkit'];
    for (const [runId, browsers] of map) {
      sorted.set(
        runId,
        Array.from(browsers).sort((a, b) => order.indexOf(a) - order.indexOf(b))
      );
    }

    return sorted;
  }

  /**
   * Get aggregate stats for a run (passed/failed/pending counts)
   */
  async getRunStats(runId: string): Promise<{
    total: number;
    passed: number;
    failed: number;
    running: number;
    pending: number;
    cancelled: number;
    skipped: number;
  }> {
    const result = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        passed: sql<number>`count(case when ${runBrowserResults.status} = 'passed' then 1 end)::int`,
        failed: sql<number>`count(case when ${runBrowserResults.status} = 'failed' then 1 end)::int`,
        running: sql<number>`count(case when ${runBrowserResults.status} = 'running' then 1 end)::int`,
        pending: sql<number>`count(case when ${runBrowserResults.status} = 'pending' then 1 end)::int`,
        cancelled: sql<number>`count(case when ${runBrowserResults.status} = 'cancelled' then 1 end)::int`,
        skipped: sql<number>`count(case when ${runBrowserResults.status} = 'skipped' then 1 end)::int`,
      })
      .from(runBrowserResults)
      .where(eq(runBrowserResults.runId, runId));

    return result[0] ?? {
      total: 0,
      passed: 0,
      failed: 0,
      running: 0,
      pending: 0,
      cancelled: 0,
      skipped: 0,
    };
  }
}
