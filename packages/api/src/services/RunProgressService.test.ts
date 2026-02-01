/**
 * Run Progress Service Tests
 *
 * Tests for the SSE progress service including:
 * - Event publishing
 * - Channel naming
 * - Event type helpers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type Redis from 'ioredis';
import {
  RunProgressPublisher,
  getRunProgressChannel,
  type RunProgressEvent,
  type RunStartedEvent,
  type ActionStartedEvent,
  type ActionSuccessEvent,
  type ActionFailedEvent,
  type ActionSkippedEvent,
  type RunCompletedEvent,
  type RunErrorEvent,
} from './RunProgressService.js';

describe('RunProgressService', () => {
  describe('getRunProgressChannel', () => {
    it('should return correct channel format', () => {
      const runId = '123e4567-e89b-12d3-a456-426614174000';
      const channel = getRunProgressChannel(runId);
      expect(channel).toBe(`saveaction:run-progress:${runId}`);
    });

    it('should work with different run IDs', () => {
      expect(getRunProgressChannel('run-1')).toBe('saveaction:run-progress:run-1');
      expect(getRunProgressChannel('abc')).toBe('saveaction:run-progress:abc');
    });
  });

  describe('RunProgressPublisher', () => {
    let mockRedis: {
      publish: ReturnType<typeof vi.fn>;
    };
    let publisher: RunProgressPublisher;

    beforeEach(() => {
      mockRedis = {
        publish: vi.fn().mockResolvedValue(1),
      };
      publisher = new RunProgressPublisher(mockRedis as unknown as Redis);
    });

    describe('publish', () => {
      it('should publish event to correct channel', async () => {
        const event: RunProgressEvent = {
          type: 'run:started',
          runId: 'test-run-id',
          timestamp: '2026-02-01T12:00:00.000Z',
          recordingId: 'rec-123',
          recordingName: 'Test Recording',
          totalActions: 10,
          browser: 'chromium',
        };

        await publisher.publish(event);

        expect(mockRedis.publish).toHaveBeenCalledTimes(1);
        expect(mockRedis.publish).toHaveBeenCalledWith(
          'saveaction:run-progress:test-run-id',
          JSON.stringify(event)
        );
      });
    });

    describe('publishRunStarted', () => {
      it('should publish run:started event with timestamp', async () => {
        const data: Omit<RunStartedEvent, 'type' | 'timestamp'> = {
          runId: 'run-123',
          recordingId: 'rec-456',
          recordingName: 'My Test',
          totalActions: 5,
          browser: 'firefox',
        };

        await publisher.publishRunStarted(data);

        expect(mockRedis.publish).toHaveBeenCalledTimes(1);
        const [channel, message] = mockRedis.publish.mock.calls[0];
        expect(channel).toBe('saveaction:run-progress:run-123');

        const parsed = JSON.parse(message);
        expect(parsed.type).toBe('run:started');
        expect(parsed.runId).toBe('run-123');
        expect(parsed.recordingId).toBe('rec-456');
        expect(parsed.recordingName).toBe('My Test');
        expect(parsed.totalActions).toBe(5);
        expect(parsed.browser).toBe('firefox');
        expect(parsed.timestamp).toBeDefined();
      });
    });

    describe('publishActionStarted', () => {
      it('should publish action:started event', async () => {
        const data: Omit<ActionStartedEvent, 'type' | 'timestamp'> = {
          runId: 'run-123',
          actionId: 'act_001',
          actionType: 'click',
          actionIndex: 0,
          totalActions: 10,
        };

        await publisher.publishActionStarted(data);

        const [channel, message] = mockRedis.publish.mock.calls[0];
        expect(channel).toBe('saveaction:run-progress:run-123');

        const parsed = JSON.parse(message);
        expect(parsed.type).toBe('action:started');
        expect(parsed.actionId).toBe('act_001');
        expect(parsed.actionType).toBe('click');
        expect(parsed.actionIndex).toBe(0);
        expect(parsed.totalActions).toBe(10);
      });
    });

    describe('publishActionSuccess', () => {
      it('should publish action:success event with duration', async () => {
        const data: Omit<ActionSuccessEvent, 'type' | 'timestamp'> = {
          runId: 'run-123',
          actionId: 'act_002',
          actionType: 'input',
          actionIndex: 1,
          totalActions: 10,
          durationMs: 150,
          selectorUsed: 'id',
        };

        await publisher.publishActionSuccess(data);

        const [, message] = mockRedis.publish.mock.calls[0];
        const parsed = JSON.parse(message);

        expect(parsed.type).toBe('action:success');
        expect(parsed.durationMs).toBe(150);
        expect(parsed.selectorUsed).toBe('id');
      });

      it('should publish action:success event without optional fields', async () => {
        const data: Omit<ActionSuccessEvent, 'type' | 'timestamp'> = {
          runId: 'run-123',
          actionId: 'act_002',
          actionType: 'navigation',
          actionIndex: 1,
          totalActions: 10,
          durationMs: 500,
        };

        await publisher.publishActionSuccess(data);

        const [, message] = mockRedis.publish.mock.calls[0];
        const parsed = JSON.parse(message);

        expect(parsed.type).toBe('action:success');
        expect(parsed.selectorUsed).toBeUndefined();
      });
    });

    describe('publishActionFailed', () => {
      it('should publish action:failed event with error', async () => {
        const data: Omit<ActionFailedEvent, 'type' | 'timestamp'> = {
          runId: 'run-123',
          actionId: 'act_003',
          actionType: 'click',
          actionIndex: 2,
          totalActions: 10,
          errorMessage: 'Element not found',
          durationMs: 30000,
        };

        await publisher.publishActionFailed(data);

        const [, message] = mockRedis.publish.mock.calls[0];
        const parsed = JSON.parse(message);

        expect(parsed.type).toBe('action:failed');
        expect(parsed.errorMessage).toBe('Element not found');
        expect(parsed.durationMs).toBe(30000);
      });
    });

    describe('publishActionSkipped', () => {
      it('should publish action:skipped event with reason', async () => {
        const data: Omit<ActionSkippedEvent, 'type' | 'timestamp'> = {
          runId: 'run-123',
          actionId: 'act_004',
          actionType: 'hover',
          actionIndex: 3,
          totalActions: 10,
          reason: 'Element optional and not found',
        };

        await publisher.publishActionSkipped(data);

        const [, message] = mockRedis.publish.mock.calls[0];
        const parsed = JSON.parse(message);

        expect(parsed.type).toBe('action:skipped');
        expect(parsed.reason).toBe('Element optional and not found');
      });
    });

    describe('publishRunCompleted', () => {
      it('should publish run:completed event for passed run', async () => {
        const data: Omit<RunCompletedEvent, 'type' | 'timestamp'> = {
          runId: 'run-123',
          status: 'passed',
          durationMs: 5000,
          actionsExecuted: 10,
          actionsFailed: 0,
          actionsSkipped: 0,
        };

        await publisher.publishRunCompleted(data);

        const [, message] = mockRedis.publish.mock.calls[0];
        const parsed = JSON.parse(message);

        expect(parsed.type).toBe('run:completed');
        expect(parsed.status).toBe('passed');
        expect(parsed.actionsExecuted).toBe(10);
        expect(parsed.actionsFailed).toBe(0);
      });

      it('should publish run:completed event for failed run', async () => {
        const data: Omit<RunCompletedEvent, 'type' | 'timestamp'> = {
          runId: 'run-123',
          status: 'failed',
          durationMs: 3000,
          actionsExecuted: 5,
          actionsFailed: 1,
          actionsSkipped: 4,
        };

        await publisher.publishRunCompleted(data);

        const [, message] = mockRedis.publish.mock.calls[0];
        const parsed = JSON.parse(message);

        expect(parsed.type).toBe('run:completed');
        expect(parsed.status).toBe('failed');
        expect(parsed.actionsFailed).toBe(1);
      });

      it('should publish run:completed event with video path', async () => {
        const data: Omit<RunCompletedEvent, 'type' | 'timestamp'> = {
          runId: 'run-123',
          status: 'passed',
          durationMs: 5000,
          actionsExecuted: 10,
          actionsFailed: 0,
          actionsSkipped: 0,
          videoPath: '/storage/videos/run-123.webm',
        };

        await publisher.publishRunCompleted(data);

        const [, message] = mockRedis.publish.mock.calls[0];
        const parsed = JSON.parse(message);

        expect(parsed.videoPath).toBe('/storage/videos/run-123.webm');
      });

      it('should publish run:completed event for cancelled run', async () => {
        const data: Omit<RunCompletedEvent, 'type' | 'timestamp'> = {
          runId: 'run-123',
          status: 'cancelled',
          durationMs: 1000,
          actionsExecuted: 2,
          actionsFailed: 0,
          actionsSkipped: 8,
        };

        await publisher.publishRunCompleted(data);

        const [, message] = mockRedis.publish.mock.calls[0];
        const parsed = JSON.parse(message);

        expect(parsed.type).toBe('run:completed');
        expect(parsed.status).toBe('cancelled');
      });
    });

    describe('publishRunError', () => {
      it('should publish run:error event', async () => {
        const data: Omit<RunErrorEvent, 'type' | 'timestamp'> = {
          runId: 'run-123',
          errorMessage: 'Browser crashed unexpectedly',
          errorStack: 'Error: Browser crashed\n    at ...',
        };

        await publisher.publishRunError(data);

        const [, message] = mockRedis.publish.mock.calls[0];
        const parsed = JSON.parse(message);

        expect(parsed.type).toBe('run:error');
        expect(parsed.errorMessage).toBe('Browser crashed unexpectedly');
        expect(parsed.errorStack).toBeDefined();
      });

      it('should publish run:error event without stack', async () => {
        const data: Omit<RunErrorEvent, 'type' | 'timestamp'> = {
          runId: 'run-123',
          errorMessage: 'Timeout exceeded',
        };

        await publisher.publishRunError(data);

        const [, message] = mockRedis.publish.mock.calls[0];
        const parsed = JSON.parse(message);

        expect(parsed.type).toBe('run:error');
        expect(parsed.errorStack).toBeUndefined();
      });
    });

    describe('error handling', () => {
      it('should propagate publish errors', async () => {
        mockRedis.publish.mockRejectedValueOnce(new Error('Redis connection lost'));

        await expect(
          publisher.publishRunStarted({
            runId: 'run-123',
            recordingId: 'rec-456',
            recordingName: 'Test',
            totalActions: 5,
            browser: 'chromium',
          })
        ).rejects.toThrow('Redis connection lost');
      });
    });
  });

  describe('Event Types', () => {
    it('should have correct type structure for RunStartedEvent', () => {
      const event: RunStartedEvent = {
        type: 'run:started',
        runId: 'run-123',
        timestamp: '2026-02-01T12:00:00.000Z',
        recordingId: 'rec-456',
        recordingName: 'Test Recording',
        totalActions: 10,
        browser: 'chromium',
      };

      expect(event.type).toBe('run:started');
    });

    it('should have correct type structure for ActionStartedEvent', () => {
      const event: ActionStartedEvent = {
        type: 'action:started',
        runId: 'run-123',
        timestamp: '2026-02-01T12:00:00.000Z',
        actionId: 'act_001',
        actionType: 'click',
        actionIndex: 0,
        totalActions: 10,
      };

      expect(event.type).toBe('action:started');
    });

    it('should have correct type structure for ActionSuccessEvent', () => {
      const event: ActionSuccessEvent = {
        type: 'action:success',
        runId: 'run-123',
        timestamp: '2026-02-01T12:00:00.000Z',
        actionId: 'act_001',
        actionType: 'click',
        actionIndex: 0,
        totalActions: 10,
        durationMs: 100,
        selectorUsed: 'id',
      };

      expect(event.type).toBe('action:success');
    });

    it('should have correct type structure for ActionFailedEvent', () => {
      const event: ActionFailedEvent = {
        type: 'action:failed',
        runId: 'run-123',
        timestamp: '2026-02-01T12:00:00.000Z',
        actionId: 'act_001',
        actionType: 'click',
        actionIndex: 0,
        totalActions: 10,
        errorMessage: 'Element not found',
        durationMs: 30000,
      };

      expect(event.type).toBe('action:failed');
    });

    it('should have correct type structure for ActionSkippedEvent', () => {
      const event: ActionSkippedEvent = {
        type: 'action:skipped',
        runId: 'run-123',
        timestamp: '2026-02-01T12:00:00.000Z',
        actionId: 'act_001',
        actionType: 'hover',
        actionIndex: 0,
        totalActions: 10,
        reason: 'Optional element not found',
      };

      expect(event.type).toBe('action:skipped');
    });

    it('should have correct type structure for RunCompletedEvent', () => {
      const event: RunCompletedEvent = {
        type: 'run:completed',
        runId: 'run-123',
        timestamp: '2026-02-01T12:00:00.000Z',
        status: 'passed',
        durationMs: 5000,
        actionsExecuted: 10,
        actionsFailed: 0,
        actionsSkipped: 0,
      };

      expect(event.type).toBe('run:completed');
    });

    it('should have correct type structure for RunErrorEvent', () => {
      const event: RunErrorEvent = {
        type: 'run:error',
        runId: 'run-123',
        timestamp: '2026-02-01T12:00:00.000Z',
        errorMessage: 'Fatal error',
      };

      expect(event.type).toBe('run:error');
    });
  });
});
