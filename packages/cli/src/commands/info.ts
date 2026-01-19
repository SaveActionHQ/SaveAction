import { RecordingParser, RecordingAnalyzer } from '@saveaction/core';
import path from 'node:path';
import { existsSync } from 'node:fs';

interface InfoOptions {
  json?: boolean;
  format?: 'console' | 'json';
}

/**
 * Display recording information without running it
 * Provides: metadata, action counts, timing stats, navigation insights
 */
export async function info(filePath: string, options: InfoOptions = {}): Promise<void> {
  const format = options.json ? 'json' : options.format || 'console';

  // Validate file exists
  if (!existsSync(filePath)) {
    console.error(`❌ Error: File not found: ${filePath}`);
    process.exit(1);
  }

  // Validate file extension
  const ext = path.extname(filePath);
  if (ext !== '.json') {
    console.error(`❌ Error: Invalid file type. Expected .json, got ${ext}`);
    process.exit(1);
  }

  try {
    // Parse recording file
    const parser = new RecordingParser();
    const recording = await parser.parseFile(filePath);

    // Analyze recording
    const analyzer = new RecordingAnalyzer();
    const analysis = analyzer.analyze(recording, filePath);

    // Output based on format
    if (format === 'json') {
      outputJSON(analysis);
    } else {
      outputConsole(analysis);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(`❌ Error analyzing recording: ${error.message}`);
    } else {
      console.error(`❌ Unknown error: ${String(error)}`);
    }
    process.exit(1);
  }
}

/**
 * Output analysis in JSON format to stdout
 */
function outputJSON(analysis: any): void {
  // Convert to JSON format with version field first
  const jsonOutput = {
    version: '1.0',
    file: analysis.file,
    metadata: analysis.metadata,
    viewport: analysis.viewport,
    statistics: analysis.statistics,
    timing: analysis.timing,
    navigation: analysis.navigation,
  };
  console.log(JSON.stringify(jsonOutput, null, 2));
}

/**
 * Output analysis in human-readable console format
 */
function outputConsole(analysis: any): void {
  console.log('');
  console.log('📊 Recording Analysis');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  // File info
  console.log('📁 File');
  console.log(`  Name:         ${analysis.file}`);
  console.log('');

  // Metadata
  console.log('📝 Metadata');
  console.log(`  Test Name:    ${analysis.metadata.testName}`);
  console.log(`  Recording ID: ${analysis.metadata.recordingId}`);
  console.log(`  Start URL:    ${analysis.metadata.startURL}`);
  console.log(`  Recorded:     ${new Date(analysis.metadata.recordedAt).toLocaleString()}`);
  console.log(`  Completed:    ${new Date(analysis.metadata.completedAt).toLocaleString()}`);
  console.log(`  Schema:       v${analysis.metadata.schemaVersion}`);
  console.log(`  User Agent:   ${truncateUserAgent(analysis.metadata.userAgent)}`);
  console.log('');

  // Viewport
  if (analysis.viewport) {
    console.log('📱 Viewport');
    console.log(`  Category:     ${analysis.viewport.category}`);
    console.log(`  Dimensions:   ${analysis.viewport.width}x${analysis.viewport.height}`);
    console.log('');
  }

  // Statistics
  console.log('📊 Actions');
  console.log(`  Total:        ${analysis.statistics.total}`);
  console.log('');
  console.log('  By Type:');
  const sortedByType = Object.entries(analysis.statistics.byType).sort(
    ([, a], [, b]) => (b as number) - (a as number)
  );
  for (const [type, count] of sortedByType) {
    const percentage = analysis.statistics.percentages[type] || 0;
    const bar = createProgressBar(percentage, 30);
    console.log(
      `    ${type.padEnd(12)} ${String(count).padStart(3)} ${bar} ${percentage.toFixed(1)}%`
    );
  }
  console.log('');
  console.log('  By Page:');
  const sortedByPage = Object.entries(analysis.statistics.byPage)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 5); // Top 5 pages
  for (const [url, count] of sortedByPage) {
    console.log(`    ${truncateURL(url, 50).padEnd(50)} ${String(count).padStart(3)}`);
  }
  if (Object.keys(analysis.statistics.byPage).length > 5) {
    console.log(`    ... and ${Object.keys(analysis.statistics.byPage).length - 5} more`);
  }
  console.log('');

  // Timing
  console.log('⏱️  Timing');
  console.log(`  Recording:    ${formatDuration(analysis.timing.recordingDuration)}`);
  console.log(`  Action Span:  ${formatDuration(analysis.timing.actionSpan)}`);
  console.log('');
  console.log('  Gaps Between Actions:');
  console.log(`    Min:        ${formatDuration(analysis.timing.gaps.min)}`);
  console.log(`    Max:        ${formatDuration(analysis.timing.gaps.max)}`);
  console.log(`    Average:    ${formatDuration(analysis.timing.gaps.avg)}`);
  console.log(`    Median:     ${formatDuration(analysis.timing.gaps.median)}`);
  console.log('');

  // Navigation
  console.log('🗺️  Navigation');
  console.log(`  Flow Type:    ${analysis.navigation.flowType}`);
  console.log(`  Unique Pages: ${analysis.navigation.uniquePages}`);
  console.log(`  Transitions:  ${analysis.navigation.transitions}`);
  console.log('');
}

/**
 * Create ASCII progress bar
 */
function createProgressBar(percentage: number, width: number = 30): string {
  const filledWidth = Math.round((percentage / 100) * width);
  const filled = '█'.repeat(filledWidth);
  const empty = '░'.repeat(width - filledWidth);
  return `${filled}${empty}`;
}

/**
 * Format duration in milliseconds to human-readable string
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms.toFixed(0)}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(2)}s`;
  } else {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}m ${seconds}s`;
  }
}

/**
 * Truncate URL to specified length with ellipsis
 */
function truncateURL(url: string, maxLength: number): string {
  if (url.length <= maxLength) return url;
  return url.slice(0, maxLength - 3) + '...';
}

/**
 * Truncate user agent string
 */
function truncateUserAgent(ua: string): string {
  // Extract browser name and version
  const chromeMatch = ua.match(/Chrome\/(\d+\.\d+)/);
  const firefoxMatch = ua.match(/Firefox\/(\d+\.\d+)/);
  const safariMatch = ua.match(/Version\/(\d+\.\d+).*Safari/);

  if (chromeMatch) return `Chrome ${chromeMatch[1]}`;
  if (firefoxMatch) return `Firefox ${firefoxMatch[1]}`;
  if (safariMatch) return `Safari ${safariMatch[1]}`;

  return truncateURL(ua, 50);
}
