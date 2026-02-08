/**
 * Dashboard Service
 *
 * Provides aggregated statistics for the dashboard view.
 * Uses efficient SQL count queries for performance.
 */

import { sql, eq, and, isNull, gte } from 'drizzle-orm';
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
  recordingName: string;
  recordingUrl: string;
  status: string;
  browser: string;
  durationMs: number | null;
  createdAt: Date;
  completedAt: Date | null;
}

/**
 * Upcoming schedule for dashboard display
 */
export interface UpcomingSchedule {
  id: string;
  name: string;
  recordingId: string;
  recordingName: string;
  cronExpression: string;
  nextRunAt: Date | null;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
}

/**
 * Dashboard data with stats, recent runs, and upcoming schedules
 */
export interface DashboardData {
  stats: DashboardStats;
  recentRuns: RecentRun[];
  upcomingSchedules: UpcomingSchedule[];
}

export class DashboardService {
  constructor(private readonly db: Database) {}

  /**
   * Get dashboard statistics for a user
   */
  async getStats(userId: string): Promise<DashboardStats> {
    // Get recording count
    const recordingCountResult = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(recordings)
      .where(and(eq(recordings.userId, userId), isNull(recordings.deletedAt)));

    const recordingCount = recordingCountResult[0]?.count || 0;

    // Get run counts by status using a single query with conditional aggregation
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
      .where(and(eq(runs.userId, userId), isNull(runs.deletedAt)));

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
      .where(and(eq(schedules.userId, userId), isNull(schedules.deletedAt)));

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
        passRate: Math.round(passRate * 10) / 10, // Round to 1 decimal place
      },
      schedules: {
        total: scheduleStats.total,
        active: scheduleStats.active,
        paused: scheduleStats.paused,
      },
    };
  }

  /**
   * Get recent runs for a user (last 5 runs)
   */
  async getRecentRuns(userId: string, limit = 5): Promise<RecentRun[]> {
    const result = await this.db
      .select({
        id: runs.id,
        recordingName: runs.recordingName,
        recordingUrl: runs.recordingUrl,
        status: runs.status,
        browser: runs.browser,
        durationMs: runs.durationMs,
        createdAt: runs.createdAt,
        completedAt: runs.completedAt,
      })
      .from(runs)
      .where(and(eq(runs.userId, userId), isNull(runs.deletedAt)))
      .orderBy(sql`${runs.createdAt} desc`)
      .limit(limit);

    return result.map((row) => ({
      id: row.id,
      recordingName: row.recordingName,
      recordingUrl: row.recordingUrl,
      status: row.status,
      browser: row.browser,
      durationMs: row.durationMs ? parseInt(row.durationMs, 10) : null,
      createdAt: row.createdAt,
      completedAt: row.completedAt,
    }));
  }

  /**
   * Get upcoming scheduled runs for a user
   */
  async getUpcomingSchedules(userId: string, limit = 5): Promise<UpcomingSchedule[]> {
    const now = new Date();

    const result = await this.db
      .select({
        id: schedules.id,
        name: schedules.name,
        recordingId: schedules.recordingId,
        recordingName: recordings.name,
        cronExpression: schedules.cronExpression,
        nextRunAt: schedules.nextRunAt,
        totalRuns: schedules.totalRuns,
        successfulRuns: schedules.successfulRuns,
        failedRuns: schedules.failedRuns,
      })
      .from(schedules)
      .innerJoin(recordings, eq(schedules.recordingId, recordings.id))
      .where(
        and(
          eq(schedules.userId, userId),
          eq(schedules.status, 'active'),
          isNull(schedules.deletedAt),
          gte(schedules.nextRunAt, now)
        )
      )
      .orderBy(sql`${schedules.nextRunAt} asc nulls last`)
      .limit(limit);

    return result.map((row) => ({
      id: row.id,
      name: row.name,
      recordingId: row.recordingId,
      recordingName: row.recordingName,
      cronExpression: row.cronExpression,
      nextRunAt: row.nextRunAt,
      totalRuns: parseInt(row.totalRuns ?? '0', 10),
      successfulRuns: parseInt(row.successfulRuns ?? '0', 10),
      failedRuns: parseInt(row.failedRuns ?? '0', 10),
    }));
  }

  /**
   * Get complete dashboard data (stats, recent runs, upcoming schedules)
   */
  async getDashboardData(userId: string): Promise<DashboardData> {
    // Run all queries in parallel for performance
    const [stats, recentRuns, upcomingSchedules] = await Promise.all([
      this.getStats(userId),
      this.getRecentRuns(userId, 5),
      this.getUpcomingSchedules(userId, 5),
    ]);

    return {
      stats,
      recentRuns,
      upcomingSchedules,
    };
  }
}
