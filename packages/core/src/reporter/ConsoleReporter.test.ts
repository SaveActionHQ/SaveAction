import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ConsoleReporter } from './ConsoleReporter.js';
import type { ClickAction } from '../types/index.js';
import type { RunResult } from '../types/runner.js';

describe('ConsoleReporter', () => {
  let reporter: ConsoleReporter;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    reporter = new ConsoleReporter();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  const sampleClickAction: ClickAction = {
    id: 'act_001',
    type: 'click',
    timestamp: Date.now(),
    url: 'https://example.com',
    tagName: 'button',
    selector: { id: 'submit', priority: ['id'] },
    coordinates: { x: 100, y: 200 },
    coordinatesRelativeTo: 'element',
    button: 'left',
    clickCount: 1,
    modifiers: [],
    text: 'Submit',
  };

  describe('onStart', () => {
    it('should log test name and action count', () => {
      reporter.onStart({ testName: 'Test Recording', actionsTotal: 5 });

      expect(consoleLogSpy).toHaveBeenCalled();
      const logCalls = consoleLogSpy.mock.calls.map((call: any) => call.join(' '));
      const hasTestName = logCalls.some((log: string) => log.includes('Test Recording'));
      expect(hasTestName).toBe(true);
    });

    it('should handle plural actions correctly', () => {
      reporter.onStart({ testName: 'Test', actionsTotal: 1 });
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('onActionStart', () => {
    it('should log action start message', () => {
      reporter.onActionStart(sampleClickAction, 1);

      expect(consoleLogSpy).toHaveBeenCalled();
      const logCalls = consoleLogSpy.mock.calls.map((call: any) => call.join(' '));
      const hasClick = logCalls.some((log: string) => log.toLowerCase().includes('click'));
      expect(hasClick).toBe(true);
    });

    it('should display action number', () => {
      reporter.onActionStart(sampleClickAction, 5);

      expect(consoleLogSpy).toHaveBeenCalled();
      const logCalls = consoleLogSpy.mock.calls.map((call: any) => call.join(' '));
      const hasNumber = logCalls.some((log: string) => log.includes('5'));
      expect(hasNumber).toBe(true);
    });
  });

  describe('onActionSuccess', () => {
    it('should log success message with duration', () => {
      reporter.onActionSuccess(sampleClickAction, 1, 250);

      expect(consoleLogSpy).toHaveBeenCalled();
      const logCalls = consoleLogSpy.mock.calls.map((call: any) => call.join(' '));
      const hasSuccess = logCalls.some((log: string) => log.includes('250ms'));
      expect(hasSuccess).toBe(true);
    });

    it('should handle zero duration', () => {
      reporter.onActionSuccess(sampleClickAction, 1, 0);
      expect(consoleLogSpy).toHaveBeenCalled();
    });
  });

  describe('onActionError', () => {
    it('should log error message', () => {
      const error = new Error('Element not found');
      reporter.onActionError(sampleClickAction, 1, error);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const logCalls = consoleErrorSpy.mock.calls.map((call: any) => call.join(' '));
      const hasError = logCalls.some((log: string) => 
        log.includes('Element not found') || log.toLowerCase().includes('failed')
      );
      expect(hasError).toBe(true);
    });

    it('should include action number in error', () => {
      const error = new Error('Test error');
      reporter.onActionError(sampleClickAction, 3, error);

      expect(consoleErrorSpy).toHaveBeenCalled();
      const logCalls = consoleErrorSpy.mock.calls.map((call: any) => call.join(' '));
      const hasNumber = logCalls.some((log: string) => log.includes('3'));
      expect(hasNumber).toBe(true);
    });
  });

  describe('onComplete', () => {
    it('should log success summary when all actions pass', () => {
      const result: RunResult = {
        status: 'success',
        duration: 5000,
        actionsTotal: 10,
        actionsExecuted: 10,
        actionsFailed: 0,
        errors: [],
      };

      reporter.onComplete(result);

      expect(consoleLogSpy).toHaveBeenCalled();
      const logCalls = consoleLogSpy.mock.calls.map((call: any) => call.join(' '));
      const hasSuccess = logCalls.some((log: string) => 
        log.toLowerCase().includes('success') || log.includes('✅')
      );
      expect(hasSuccess).toBe(true);
    });

    it('should log failure summary when actions fail', () => {
      const result: RunResult = {
        status: 'failed',
        duration: 5000,
        actionsTotal: 10,
        actionsExecuted: 10,
        actionsFailed: 2,
        errors: [
          { actionId: 'act_005', error: 'Element not found', actionType: 'click', timestamp: Date.now() },
          { actionId: 'act_008', error: 'Timeout exceeded', actionType: 'input', timestamp: Date.now() },
        ],
      };

      reporter.onComplete(result);

      expect(consoleLogSpy).toHaveBeenCalled();
      const logCalls = consoleLogSpy.mock.calls.map((call: any) => call.join(' '));
      const hasFailure = logCalls.some((log: string) => 
        log.toLowerCase().includes('fail') || log.includes('❌')
      );
      expect(hasFailure).toBe(true);
    });

    it('should handle partial status', () => {
      const result: RunResult = {
        status: 'partial',
        duration: 5000,
        actionsTotal: 10,
        actionsExecuted: 8,
        actionsFailed: 2,
        errors: [
          { actionId: 'act_005', error: 'Element not found', actionType: 'click', timestamp: Date.now() },
        ],
      };

      reporter.onComplete(result);

      expect(consoleLogSpy).toHaveBeenCalled();
      const logCalls = consoleLogSpy.mock.calls.map((call: any) => call.join(' '));
      const hasPartial = logCalls.some((log: string) => 
        log.toLowerCase().includes('partial') || log.includes('⚠️')
      );
      expect(hasPartial).toBe(true);
    });

    it('should display execution duration', () => {
      const result: RunResult = {
        status: 'success',
        duration: 12345,
        actionsTotal: 5,
        actionsExecuted: 5,
        actionsFailed: 0,
        errors: [],
      };

      reporter.onComplete(result);

      expect(consoleLogSpy).toHaveBeenCalled();
      const logCalls = consoleLogSpy.mock.calls.map((call: any) => call.join(' '));
      const hasDuration = logCalls.some((log: string) => 
        log.includes('12.') // Should be formatted as 12.35s
      );
      expect(hasDuration).toBe(true);
    });

    it('should list all errors when present', () => {
      const result: RunResult = {
        status: 'failed',
        duration: 5000,
        actionsTotal: 10,
        actionsExecuted: 10,
        actionsFailed: 3,
        errors: [
          { actionId: 'act_001', error: 'Error 1', actionType: 'click', timestamp: Date.now() },
          { actionId: 'act_002', error: 'Error 2', actionType: 'input', timestamp: Date.now() },
          { actionId: 'act_003', error: 'Error 3', actionType: 'scroll', timestamp: Date.now() },
        ],
      };

      reporter.onComplete(result);

      expect(consoleLogSpy).toHaveBeenCalled();
      const logCalls = consoleLogSpy.mock.calls.map((call: any) => call.join(' '));
      const hasErrors = logCalls.some((log: string) => 
        log.includes('Error 1') && log.includes('act_001')
      );
      expect(hasErrors).toBe(true);
    });

    it('should show video path when present', () => {
      const result: RunResult = {
        status: 'success',
        duration: 5000,
        actionsTotal: 5,
        actionsExecuted: 5,
        actionsFailed: 0,
        errors: [],
        video: './videos/test-recording.webm',
      };

      reporter.onComplete(result);

      expect(consoleLogSpy).toHaveBeenCalled();
      const logCalls = consoleLogSpy.mock.calls.map((call: any) => call.join(' '));
      const hasVideo = logCalls.some((log: string) => 
        log.includes('test-recording.webm') || log.includes('🎥')
      );
      expect(hasVideo).toBe(true);
    });

    it('should show executed vs total actions', () => {
      const result: RunResult = {
        status: 'success',
        duration: 5000,
        actionsTotal: 15,
        actionsExecuted: 15,
        actionsFailed: 0,
        errors: [],
      };

      reporter.onComplete(result);

      expect(consoleLogSpy).toHaveBeenCalled();
      const logCalls = consoleLogSpy.mock.calls.map((call: any) => call.join(' '));
      const hasActionCount = logCalls.some((log: string) => log.includes('15'));
      expect(hasActionCount).toBe(true);
    });
  });

  describe('reporter interface', () => {
    it('should implement all required reporter methods', () => {
      expect(typeof reporter.onStart).toBe('function');
      expect(typeof reporter.onActionStart).toBe('function');
      expect(typeof reporter.onActionSuccess).toBe('function');
      expect(typeof reporter.onActionError).toBe('function');
      expect(typeof reporter.onComplete).toBe('function');
    });

    it('should not throw when called in sequence', () => {
      expect(() => {
        reporter.onStart({ testName: 'Test', actionsTotal: 1 });
        reporter.onActionStart(sampleClickAction, 1);
        reporter.onActionSuccess(sampleClickAction, 1, 100);
        reporter.onComplete({
          status: 'success',
          duration: 100,
          actionsTotal: 1,
          actionsExecuted: 1,
          actionsFailed: 0,
          errors: [],
        });
      }).not.toThrow();
    });

    it('should handle error flow without throwing', () => {
      expect(() => {
        reporter.onStart({ testName: 'Test', actionsTotal: 1 });
        reporter.onActionStart(sampleClickAction, 1);
        reporter.onActionError(sampleClickAction, 1, new Error('Test'));
        reporter.onComplete({
          status: 'failed',
          duration: 100,
          actionsTotal: 1,
          actionsExecuted: 1,
          actionsFailed: 1,
          errors: [{ actionId: 'act_001', error: 'Test', actionType: 'click', timestamp: Date.now() }],
        });
      }).not.toThrow();
    });
  });
});
