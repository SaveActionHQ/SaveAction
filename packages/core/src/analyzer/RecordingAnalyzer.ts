import type { Recording } from '../types/recording.js';
import type { Action } from '../types/actions.js';
import type {
  RecordingAnalysis,
  RecordingMetadata,
  ViewportInfo,
  ActionStatistics,
  TimingAnalysis,
  NavigationInsights,
} from '../types/analyzer.js';

/**
 * Analyzes recording files and provides detailed statistics
 */
export class RecordingAnalyzer {
  /**
   * Analyzes a recording and returns detailed statistics
   * @param recording - The recording object to analyze
   * @param filePath - Path to the recording file (used for display)
   * @returns Analysis results with metadata, statistics, timing, and navigation info
   */
  public analyze(recording: Recording, filePath: string): RecordingAnalysis {
    // Handle both Windows (\) and Unix (/) path separators for cross-platform compatibility
    const basename = filePath.split(/[\\/]/).pop() || filePath;

    return {
      file: basename,
      metadata: this.extractMetadata(recording),
      viewport: this.analyzeViewport(recording),
      statistics: this.analyzeActions(recording.actions),
      timing: this.analyzeTiming(recording),
      navigation: this.analyzeNavigation(recording.actions),
    };
  }

  /**
   * Extract metadata from recording
   */
  private extractMetadata(recording: Recording): RecordingMetadata {
    const version = recording.version || 'unknown';

    if (version !== '1.0' && version !== 'unknown') {
      console.warn(`⚠️  Recording uses schema v${version} (current: v1.0)`);
      console.warn('Some fields may not be available.\n');
    }

    return {
      testName: recording.testName,
      recordingId: recording.id,
      startURL: recording.url,
      recordedAt: recording.startTime,
      completedAt: recording.endTime || recording.startTime,
      schemaVersion: version,
      userAgent: recording.userAgent,
    };
  }

  /**
   * Analyze viewport and categorize device type
   */
  private analyzeViewport(recording: Recording): ViewportInfo {
    if (!recording.viewport) {
      return {
        category: 'Unknown',
        width: 0,
        height: 0,
      };
    }

    const width = Math.max(1, recording.viewport?.width || 0);
    const height = Math.max(1, recording.viewport?.height || 0);

    let category: ViewportInfo['category'] = 'Unknown';
    if (width <= 768) {
      category = 'Mobile';
    } else if (width <= 1024) {
      category = 'Tablet';
    } else if (width > 1024) {
      category = 'Desktop';
    }

    return { category, width, height };
  }

  /**
   * Analyze actions and generate statistics
   */
  private analyzeActions(actions: Action[]): ActionStatistics {
    const validActions = actions.filter(Boolean);
    const total = validActions.length;

    if (total === 0) {
      return {
        total: 0,
        byType: {},
        byPage: {},
        percentages: {},
      };
    }

    const byType: Record<string, number> = {};
    const byPage: Record<string, number> = {};

    for (const action of validActions) {
      // Count by type
      const type = action.type || 'unknown';
      byType[type] = (byType[type] || 0) + 1;

      // Count by page (with URL normalization)
      if (action.url) {
        const normalizedURL = this.normalizeURL(action.url);
        byPage[normalizedURL] = (byPage[normalizedURL] || 0) + 1;
      }
    }

    // Calculate percentages
    const percentages: Record<string, number> = {};
    for (const [type, count] of Object.entries(byType)) {
      percentages[type] = (count / total) * 100;
    }

    return { total, byType, byPage, percentages };
  }

  /**
   * Analyze timing information
   */
  private analyzeTiming(recording: Recording): TimingAnalysis {
    const actions = recording.actions
      .filter(Boolean)
      .filter(
        (action) =>
          typeof action.timestamp === 'number' && action.timestamp > 0 && isFinite(action.timestamp)
      );

    if (actions.length === 0) {
      return {
        recordingDuration: 0,
        actionSpan: 0,
        gaps: { min: 0, max: 0, avg: 0, median: 0 },
      };
    }

    // Recording duration (from recording start to end)
    const recordingDuration =
      new Date(recording.endTime || recording.startTime).getTime() -
      new Date(recording.startTime).getTime();

    // Action span (from first to last action)
    const timestamps = actions.map((a) => a.timestamp);
    const actionSpan = Math.max(...timestamps) - Math.min(...timestamps);

    // Calculate gaps between actions
    const gaps: number[] = [];
    for (let i = 1; i < actions.length; i++) {
      gaps.push(actions[i].timestamp - actions[i - 1].timestamp);
    }

    if (gaps.length === 0) {
      return {
        recordingDuration,
        actionSpan,
        gaps: { min: 0, max: 0, avg: 0, median: 0 },
      };
    }

    const sortedGaps = [...gaps].sort((a, b) => a - b);
    const min = sortedGaps[0];
    const max = sortedGaps[sortedGaps.length - 1];
    const avg = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;

    // Median calculation
    const length = sortedGaps.length;
    const midIndex = Math.floor(length / 2);
    const median =
      length % 2 === 1
        ? sortedGaps[midIndex]
        : (sortedGaps[midIndex - 1] + sortedGaps[midIndex]) / 2;

    return {
      recordingDuration,
      actionSpan,
      gaps: { min, max, avg, median },
    };
  }

  /**
   * Analyze navigation patterns
   */
  private analyzeNavigation(actions: Action[]): NavigationInsights {
    const validActions = actions.filter(Boolean).filter((action) => action.url);

    if (validActions.length === 0) {
      return {
        uniquePages: 0,
        transitions: 0,
        flowType: 'N/A' as const,
      };
    }

    const uniqueURLs = new Set(validActions.map((action) => this.normalizeURL(action.url)));

    const uniquePages = uniqueURLs.size;
    const transitions = Math.max(0, uniquePages - 1);

    const flowType: NavigationInsights['flowType'] =
      uniquePages === 1 ? 'SPA' : uniquePages > 1 ? 'MPA' : 'N/A';

    return { uniquePages, transitions, flowType };
  }

  /**
   * Normalize URL by removing trailing slashes and hash fragments
   * @param url - URL string to normalize
   * @returns Normalized URL string
   */
  private normalizeURL(url: string): string {
    if (!url || url === '') return '';
    if (url === null || url === undefined) return '';

    try {
      const urlObj = new URL(url);
      // Remove hash
      urlObj.hash = '';
      // Remove trailing slash for all paths (including root)
      if (urlObj.pathname.endsWith('/') && urlObj.pathname.length > 1) {
        urlObj.pathname = urlObj.pathname.slice(0, -1);
      } else if (urlObj.pathname === '/' && urlObj.search === '') {
        // For root path with no query params, remove trailing slash
        return `${urlObj.origin}`;
      }
      return urlObj.toString();
    } catch {
      // Invalid URL, return as-is
      return url;
    }
  }
}
