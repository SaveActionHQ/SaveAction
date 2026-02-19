/**
 * Dashboard Service
 *
 * Provides aggregated statistics for the dashboard view.
 * Uses efficient SQL count queries for performance.
 * Supports project-scoped filtering.
 */

import { sql, eq, and, isNull, gte, desc } from 'drizzle-orm';
import type { Database } from '../db/index.js';
import { recordings } from '../db/schema/recordings.js';
import { runs } from '../db/schema/runs.js';
import { schedules } from '../db/schema/schedules.js';

/**
 * Dashboard statistics response
 */
export interface DashboardStats {
  recordings: {
    total: number;
  };
  runs: {
    total: number;
    passed: number;
    failed: number;
    cancelled: number;
    queued: number;
    running: number;
    passRate: number;
  };
  schedules: {
    total: number;
    active: number;
    paused: number;
  };
}

/**
 * Recent run for dashboard display
 */
export interface RecentRun {
  id: string;
  runType: string | null;
  testName: string | null;
  recordingName: string | null;
  recordingUrl: string | null;
  status: string;
  browser: string;
  parentRunId: string | null;
  actionsTotal: number | null;
  actionsExecuted: number | null;
  actionsFailed: number | null;
  durationMs: number | null;
  triggeredBy: string | null;
  createdAt: Date;
  completedAt: Date | null;
}

/**
 * Upcoming schedule for dashboard display
 */
export interface UpcomingSchedule {
  id: string;
  name: string;
  targetType: string;
  cronExpression: string;
  nextRunAt: Date | null;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
}

/**
 * Run history entry for trend charts (daily aggregation)
 */
export interface RunTrendEntry {
  date: string; // YYYY-MM-DD
  total: number;
  passed: number;
  failed: number;
}

/**
 * Dashboard data with stats, recent runs, and upcoming schedules
 */
export interface DashboardData {
  stats: DashboardStats;
  recentRuns: RecentRun[];
  upcomingSchedules: UpcomingSchedule[];
  runTrend: RunTrendEntry[];
}

export class DashboardService {
  constructor(private readonly db: Database) {}

  /**
   * Get dashboard statistics for a user, optionally scoped to a project
   */
  async getStats(userId: string, projectId?: string): Promise<DashboardStats> {
    // Build project filter conditions
    const recordingConditions = [eq(recordings.userId, userId), isNull(recordings.deletedAt)];
    const runConditions = [eq(runs.userId, userId), isNull(runs.deletedAt)];
    const scheduleConditions = [eq(schedules.userId, userId), isNull(schedules.deletedAt)];

    if (projectId) {
      recordingConditions.push(eq(recordings.projectId, projectId));
      runConditions.push(eq(runs.projectId, projectId));
      scheduleConditions.push(eq(schedules.projectId, projectId));
    }

    // Get recording count
    const recordingCountResult = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(recordings)
      .where(and(...recordingConditions));

    const recordingCount = recordingCountResult[0]?.count || 0;

    // Get run counts by status — exclude child runs (parentRunId IS NULL) for cleaner stats
    const runStatsResult = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        passed: sql<number>`count(*) filter (where ${runs.status} = 'passed')::int`,
        failed: sql<number>`count(*) filter (where ${runs.status} = 'failed')::int`,
        cancelled: sql<number>`count(*) filter (where ${runs.status} = 'cancelled')::int`,
        queued: sql<number>`count(*) filter (where ${runs.status} = 'queued')::int`,
        running: sql<number>`count(*) filter (where ${runs.status} = 'running')::int`,
      })
      .from(runs)
      .where(and(...runConditions, isNull(runs.parentRunId)));

    const runStats = runStatsResult[0] || {
      total: 0,
      passed: 0,
      failed: 0,
      cancelled: 0,
      queued: 0,
      running: 0,
    };

    // Calculate pass rate (only count completed runs: passed + failed)
    const completedRuns = runStats.passed + runStats.failed;
    const passRate = completedRuns > 0 ? (runStats.passed / completedRuns) * 100 : 0;

    // Get schedule counts
    const scheduleStatsResult = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        active: sql<number>`count(*) filter (where ${schedules.status} = 'active')::int`,
        paused: sql<number>`count(*) filter (where ${schedules.status} = 'paused')::int`,
      })
      .from(schedules)
      .where(and(...scheduleConditions));

    const scheduleStats = scheduleStatsResult[0] || {
      total: 0,
      active: 0,
      paused: 0,
    };

    return {
      recordings: {
        total: recordingCount,
      },
      runs: {
        total: runStats.total,
        passed: runStats.passed,
        failed: runStats.failed,
        cancelled: runStats.cancelled,
        queued: runStats.queued,
        running: runStats.running,
        passRate: Math.round(passRate * 10) / 10,
      },
      schedules: {
        total: scheduleStats.total,
        active: scheduleStats.active,
        paused: scheduleStats.paused,
      },
    };
  }

  /**
   * Get recent runs for a user (excludes child runs for cleaner display)
   */
  async getRecentRuns(userId: string, limit = 10, projectId?: string): Promise<RecentRun[]> {
    const conditions = [eq(runs.userId, userId), isNull(runs.deletedAt), isNull(runs.parentRunId)];
    if (projectId) {
      conditions.push(eq(runs.projectId, projectId));
    }

    const result = await this.db
      .select({
        id: runs.id,
        runType: runs.runType,
        testName: runs.testName,
        recordingName: runs.recordingName,
        recordingUrl: runs.recordingUrl,
        status: runs.status,
        browser: runs.browser,
        parentRunId: runs.parentRunId,
        actionsTotal: runs.actionsTotal,
        actionsExecuted: runs.actionsExecuted,
        actionsFailed: runs.actionsFailed,
        durationMs: runs.durationMs,
        triggeredBy: runs.triggeredBy,
        createdAt: runs.createdAt,
        completedAt: runs.completedAt,
      })
      .from(runs)
      .where(and(...conditions))
      .orderBy(desc(runs.createdAt))
      .limit(limit);

    return result.map((row) => ({
      id: row.id,
      runType: row.runType,
      testName: row.testName,
      recordingName: row.recordingName,
      recordingUrl: row.recordingUrl,
      status: row.status,
      browser: row.browser,
      parentRunId: row.parentRunId ?? null,
      actionsTotal: row.actionsTotal ? parseInt(row.actionsTotal, 10) : null,
      actionsExecuted: row.actionsExecuted ? parseInt(row.actionsExecuted, 10) : null,
      actionsFailed: row.actionsFailed ? parseInt(row.actionsFailed, 10) : null,
      durationMs: row.durationMs ? parseInt(row.durationMs, 10) : null,
      triggeredBy: row.triggeredBy,
      createdAt: row.createdAt,
      completedAt: row.completedAt,
    }));
  }

  /**
   * Get upcoming scheduled runs for a user (supports suite/test schedules)
   */
  async getUpcomingSchedules(userId: string, limit = 5, projectId?: string): Promise<UpcomingSchedule[]> {
    const now = new Date();
    const conditions = [
      eq(schedules.userId, userId),
      eq(schedules.status, 'active'),
      isNull(schedules.deletedAt),
      gte(schedules.nextRunAt, now),
    ];
    if (projectId) {
      conditions.push(eq(schedules.projectId, projectId));
    }

    const result = await this.db
      .select({
        id: schedules.id,
        name: schedules.name,
        targetType: schedules.targetType,
        cronExpression: schedules.cronExpression,
        nextRunAt: schedules.nextRunAt,
        totalRuns: schedules.totalRuns,
        successfulRuns: schedules.successfulRuns,
        failedRuns: schedules.failedRuns,
      })
      .from(schedules)
      .where(and(...conditions))
      .orderBy(sql`${schedules.nextRunAt} asc nulls last`)
      .limit(limit);

    return result.map((row) => ({
      id: row.id,
      name: row.name,
      targetType: row.targetType ?? 'recording',
      cronExpression: row.cronExpression,
      nextRunAt: row.nextRunAt,
      totalRuns: parseInt(row.totalRuns ?? '0', 10),
      successfulRuns: parseInt(row.successfulRuns ?? '0', 10),
      failedRuns: parseInt(row.failedRuns ?? '0', 10),
    }));
  }

  /**
   * Get daily run trend for the last N days (for chart display)
   */
  async getRunTrend(userId: string, days = 14, projectId?: string): Promise<RunTrendEntry[]> {
    const conditions = [eq(runs.userId, userId), isNull(runs.deletedAt), isNull(runs.parentRunId)];
    if (projectId) {
      conditions.push(eq(runs.projectId, projectId));
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    conditions.push(gte(runs.createdAt, startDate));

    const result = await this.db
      .select({
        date: sql<string>`to_char(${runs.createdAt}, 'YYYY-MM-DD')`,
        total: sql<number>`count(*)::int`,
        passed: sql<number>`count(*) filter (where ${runs.status} = 'passed')::int`,
        failed: sql<number>`count(*) filter (where ${runs.status} = 'failed')::int`,
      })
      .from(runs)
      .where(and(...conditions))
      .groupBy(sql`to_char(${runs.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${runs.createdAt}, 'YYYY-MM-DD') asc`);

    // Fill in missing dates with zeros
    const trend: RunTrendEntry[] = [];
    const dateMap = new Map(result.map((r) => [r.date, r]));

    for (let i = days; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const entry = dateMap.get(key);
      trend.push({
        date: key,
        total: entry?.total ?? 0,
        passed: entry?.passed ?? 0,
        failed: entry?.failed ?? 0,
      });
    }

    return trend;
  }

  /**
   * Get complete dashboard data (stats, recent runs, upcoming schedules, trend)
   */
  async getDashboardData(userId: string, projectId?: string): Promise<DashboardData> {
    const [stats, recentRuns, upcomingSchedules, runTrend] = await Promise.all([
      this.getStats(userId, projectId),
      this.getRecentRuns(userId, 10, projectId),
      this.getUpcomingSchedules(userId, 5, projectId),
      this.getRunTrend(userId, 14, projectId),
    ]);

    return {
      stats,
      recentRuns,
      upcomingSchedules,
      runTrend,
    };
  }
}
