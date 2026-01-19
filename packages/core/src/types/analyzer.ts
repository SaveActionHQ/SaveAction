/**
 * Analysis result for a recording file
 */
export interface RecordingAnalysis {
  file: string;
  metadata: RecordingMetadata;
  viewport?: ViewportInfo;
  statistics: ActionStatistics;
  timing: TimingAnalysis;
  navigation: NavigationInsights;
}

/**
 * Recording metadata extracted from the recording file
 */
export interface RecordingMetadata {
  testName: string;
  recordingId: string;
  startURL: string;
  recordedAt: string;
  completedAt: string;
  schemaVersion: string;
  userAgent: string;
}

/**
 * Viewport information and categorization
 */
export interface ViewportInfo {
  category: 'Mobile' | 'Tablet' | 'Desktop' | 'Unknown';
  width: number;
  height: number;
}

/**
 * Action statistics with counts and percentages
 */
export interface ActionStatistics {
  total: number;
  byType: Record<string, number>;
  byPage: Record<string, number>;
  percentages: Record<string, number>;
}

/**
 * Timing analysis for recording and actions
 */
export interface TimingAnalysis {
  recordingDuration: number;
  actionSpan: number;
  gaps: {
    min: number;
    max: number;
    avg: number;
    median: number;
  };
}

/**
 * Navigation insights and flow type detection
 */
export interface NavigationInsights {
  uniquePages: number;
  transitions: number;
  flowType: 'SPA' | 'MPA' | 'N/A';
}

/**
 * JSON-serializable format for analysis results
 */
export interface RecordingAnalysisJSON {
  version: '1.0';
  metadata: RecordingMetadata;
  viewport?: ViewportInfo;
  statistics: ActionStatistics;
  timing: TimingAnalysis;
  navigation: NavigationInsights;
}
