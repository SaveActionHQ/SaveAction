/**
 * Run Progress Service
 *
 * Handles real-time progress updates for test runs via Redis pub/sub.
 * Used by workers to publish events and by API to subscribe for SSE.
 *
 * SSE Event Types:
 * - run:started - Run has started executing
 * - action:started - Action execution has begun
 * - action:success - Action completed successfully
 * - action:failed - Action failed
 * - action:skipped - Action was skipped
 * - run:completed - Run finished (passed/failed/cancelled)
 * - run:error - Run encountered a fatal error
 */

import type Redis from 'ioredis';

/**
 * Channel name for run progress events
 */
export function getRunProgressChannel(runId: string): string {
  return `saveaction:run-progress:${runId}`;
}

/**
 * Base event interface
 */
interface BaseProgressEvent {
  /** Event type */
  type: string;
  /** Run ID */
  runId: string;
  /** Timestamp of the event */
  timestamp: string;
}

/**
 * Run started event
 */
export interface RunStartedEvent extends BaseProgressEvent {
  type: 'run:started';
  recordingId: string;
  recordingName: string | null;
  totalActions: number;
  browser: string;
  /** Summary of all actions in the recording (id + type) */
  actions?: Array<{ id: string; type: string }>;
}

/**
 * Action started event
 */
export interface ActionStartedEvent extends BaseProgressEvent {
  type: 'action:started';
  actionId: string;
  actionType: string;
  actionIndex: number;
  totalActions: number;
  browser?: string;
}

/**
 * Action success event
 */
export interface ActionSuccessEvent extends BaseProgressEvent {
  type: 'action:success';
  actionId: string;
  actionType: string;
  actionIndex: number;
  totalActions: number;
  durationMs: number;
  selectorUsed?: string;
  browser?: string;
}

/**
 * Action failed event
 */
export interface ActionFailedEvent extends BaseProgressEvent {
  type: 'action:failed';
  actionId: string;
  actionType: string;
  actionIndex: number;
  totalActions: number;
  errorMessage: string;
  durationMs: number;
  browser?: string;
}

/**
 * Action skipped event
 */
export interface ActionSkippedEvent extends BaseProgressEvent {
  type: 'action:skipped';
  actionId: string;
  actionType: string;
  actionIndex: number;
  totalActions: number;
  reason: string;
  browser?: string;
}

/**
 * Run completed event
 */
export interface RunCompletedEvent extends BaseProgressEvent {
  type: 'run:completed';
  status: 'passed' | 'failed' | 'cancelled';
  durationMs: number;
  actionsExecuted: number;
  actionsFailed: number;
  actionsSkipped: number;
  videoPath?: string;
}

/**
 * Run error event
 */
export interface RunErrorEvent extends BaseProgressEvent {
  type: 'run:error';
  errorMessage: string;
  errorStack?: string;
}

/**
 * Union of all progress event types
 */
export type RunProgressEvent =
  | RunStartedEvent
  | ActionStartedEvent
  | ActionSuccessEvent
  | ActionFailedEvent
  | ActionSkippedEvent
  | RunCompletedEvent
  | RunErrorEvent;

/**
 * Run Progress Publisher
 *
 * Used by workers to publish progress events to Redis.
 */
export class RunProgressPublisher {
  private readonly redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * Publish a progress event for a run
   */
  async publish(event: RunProgressEvent): Promise<void> {
    const channel = getRunProgressChannel(event.runId);
    const message = JSON.stringify(event);
    await this.redis.publish(channel, message);
  }

  /**
   * Publish run started event
   */
  async publishRunStarted(data: Omit<RunStartedEvent, 'type' | 'timestamp'>): Promise<void> {
    await this.publish({
      type: 'run:started',
      timestamp: new Date().toISOString(),
      ...data,
    });
  }

  /**
   * Publish action started event
   */
  async publishActionStarted(data: Omit<ActionStartedEvent, 'type' | 'timestamp'>): Promise<void> {
    await this.publish({
      type: 'action:started',
      timestamp: new Date().toISOString(),
      ...data,
    });
  }

  /**
   * Publish action success event
   */
  async publishActionSuccess(data: Omit<ActionSuccessEvent, 'type' | 'timestamp'>): Promise<void> {
    await this.publish({
      type: 'action:success',
      timestamp: new Date().toISOString(),
      ...data,
    });
  }

  /**
   * Publish action failed event
   */
  async publishActionFailed(data: Omit<ActionFailedEvent, 'type' | 'timestamp'>): Promise<void> {
    await this.publish({
      type: 'action:failed',
      timestamp: new Date().toISOString(),
      ...data,
    });
  }

  /**
   * Publish action skipped event
   */
  async publishActionSkipped(data: Omit<ActionSkippedEvent, 'type' | 'timestamp'>): Promise<void> {
    await this.publish({
      type: 'action:skipped',
      timestamp: new Date().toISOString(),
      ...data,
    });
  }

  /**
   * Publish run completed event
   */
  async publishRunCompleted(data: Omit<RunCompletedEvent, 'type' | 'timestamp'>): Promise<void> {
    await this.publish({
      type: 'run:completed',
      timestamp: new Date().toISOString(),
      ...data,
    });
  }

  /**
   * Publish run error event
   */
  async publishRunError(data: Omit<RunErrorEvent, 'type' | 'timestamp'>): Promise<void> {
    await this.publish({
      type: 'run:error',
      timestamp: new Date().toISOString(),
      ...data,
    });
  }
}

/**
 * Options for subscribing to run progress
 */
export interface SubscribeOptions {
  /** Callback when an event is received */
  onEvent: (event: RunProgressEvent) => void;
  /** Callback when an error occurs */
  onError?: (error: Error) => void;
  /** Callback when subscription is closed */
  onClose?: () => void;
}

/**
 * Subscribe to run progress events
 *
 * Creates a new Redis subscriber connection.
 * Returns an unsubscribe function to clean up.
 *
 * @param redisUrl - Redis URL to connect to
 * @param runId - Run ID to subscribe to
 * @param options - Subscription options
 * @returns Unsubscribe function
 */
export async function subscribeToRunProgress(
  redisUrl: string,
  runId: string,
  options: SubscribeOptions
): Promise<() => Promise<void>> {
  // Create a dedicated subscriber connection
  // Note: Redis pub/sub requires a separate connection
  const { default: Redis } = await import('ioredis');
  const subscriber = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: true,
  });

  const channel = getRunProgressChannel(runId);
  let isSubscribed = false;

  // Handle messages
  subscriber.on('message', (_receivedChannel: string, message: string) => {
    try {
      const event = JSON.parse(message) as RunProgressEvent;
      options.onEvent(event);
    } catch (error) {
      options.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  });

  // Handle errors
  subscriber.on('error', (error: Error) => {
    options.onError?.(error);
  });

  // Connect and subscribe
  try {
    await subscriber.connect();
    await subscriber.subscribe(channel);
    isSubscribed = true;
  } catch (error) {
    subscriber.disconnect();
    throw error;
  }

  // Return unsubscribe function
  return async () => {
    if (isSubscribed) {
      try {
        await subscriber.unsubscribe(channel);
      } catch {
        // Ignore unsubscribe errors
      }
    }
    subscriber.disconnect();
    options.onClose?.();
  };
}
