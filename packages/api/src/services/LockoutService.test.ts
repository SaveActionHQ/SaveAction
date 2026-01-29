/**
 * LockoutService Tests
 *
 * Unit tests for the LockoutService using Redis for brute force protection.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { LockoutService, type LockoutConfig, type LockoutEvent } from './LockoutService.js';
import type { RedisClient } from '../redis/RedisClient.js';

/**
 * Create a mock Redis client
 */
function createMockRedis(): {
  redis: RedisClient;
  storage: Map<string, { value: string; ttl?: number }>;
} {
  const storage = new Map<string, { value: string; ttl?: number }>();

  const mockRedis = {
    exists: vi.fn(async (key: string) => storage.has(key)),
    get: vi.fn(async (key: string) => storage.get(key)?.value || null),
    set: vi.fn(async (key: string, value: string, ttl?: number) => {
      storage.set(key, { value, ttl });
      return 'OK';
    }),
    del: vi.fn(async (...keys: string[]) => {
      let deleted = 0;
      for (const key of keys) {
        if (storage.delete(key)) deleted++;
      }
      return deleted;
    }),
    incr: vi.fn(async (key: string) => {
      const current = parseInt(storage.get(key)?.value || '0', 10);
      const newValue = current + 1;
      storage.set(key, { value: String(newValue), ttl: storage.get(key)?.ttl });
      return newValue;
    }),
    expire: vi.fn(async (key: string, seconds: number) => {
      const existing = storage.get(key);
      if (existing) {
        storage.set(key, { ...existing, ttl: seconds });
        return true;
      }
      return false;
    }),
    ttl: vi.fn(async (key: string) => {
      const item = storage.get(key);
      if (!item) return -2; // Key doesn't exist
      return item.ttl ?? -1; // No TTL set
    }),
  } as unknown as RedisClient;

  return { redis: mockRedis, storage };
}

describe('LockoutService', () => {
  let lockoutService: LockoutService;
  let mockRedis: RedisClient;
  let storage: Map<string, { value: string; ttl?: number }>;

  const testUserId = 'user-123';
  const testEmail = 'test@example.com';
  const testIp = '192.168.1.1';

  beforeEach(() => {
    const mock = createMockRedis();
    mockRedis = mock.redis;
    storage = mock.storage;
    lockoutService = new LockoutService(mockRedis);
  });

  afterEach(() => {
    vi.clearAllMocks();
    storage.clear();
  });

  describe('constructor', () => {
    it('should create instance with default config', () => {
      const service = new LockoutService(mockRedis);
      const config = service.getConfig();

      expect(config.maxAttempts).toBe(5);
      expect(config.baseLockoutDuration).toBe(900);
      expect(config.maxLockoutDuration).toBe(86400);
      expect(config.attemptsTtl).toBe(900);
      expect(config.keyPrefix).toBe('lockout:');
    });

    it('should create instance with custom config', () => {
      const customConfig: Partial<LockoutConfig> = {
        maxAttempts: 3,
        baseLockoutDuration: 300,
        keyPrefix: 'custom:',
      };

      const service = new LockoutService(mockRedis, customConfig);
      const config = service.getConfig();

      expect(config.maxAttempts).toBe(3);
      expect(config.baseLockoutDuration).toBe(300);
      expect(config.keyPrefix).toBe('custom:');
    });
  });

  describe('recordFailedAttempt', () => {
    it('should increment failed attempts on first failure', async () => {
      const status = await lockoutService.recordFailedAttempt(testUserId, testEmail, testIp);

      expect(status.isLocked).toBe(false);
      expect(status.failedAttempts).toBe(1);
      expect(status.remainingAttempts).toBe(4);
      expect(status.lockoutRemaining).toBe(0);
      expect(mockRedis.incr).toHaveBeenCalledWith(`lockout:attempts:${testUserId}`);
    });

    it('should set TTL on first attempt', async () => {
      await lockoutService.recordFailedAttempt(testUserId, testEmail, testIp);

      expect(mockRedis.expire).toHaveBeenCalledWith(`lockout:attempts:${testUserId}`, 900);
    });

    it('should not set TTL on subsequent attempts', async () => {
      // First attempt
      await lockoutService.recordFailedAttempt(testUserId, testEmail, testIp);
      vi.mocked(mockRedis.expire).mockClear();

      // Second attempt
      await lockoutService.recordFailedAttempt(testUserId, testEmail, testIp);

      expect(mockRedis.expire).not.toHaveBeenCalled();
    });

    it('should lock account after max attempts', async () => {
      // Record 5 failed attempts
      for (let i = 0; i < 4; i++) {
        await lockoutService.recordFailedAttempt(testUserId, testEmail, testIp);
      }

      // 5th attempt should trigger lockout
      const status = await lockoutService.recordFailedAttempt(testUserId, testEmail, testIp);

      expect(status.isLocked).toBe(true);
      expect(status.failedAttempts).toBe(5);
      expect(status.remainingAttempts).toBe(0);
      expect(status.lockoutRemaining).toBe(900); // Base duration
      expect(status.lockoutCount).toBe(1);
    });

    it('should return locked status if already locked', async () => {
      // Manually set locked state
      storage.set(`lockout:locked:${testUserId}`, { value: '1', ttl: 600 });
      storage.set(`lockout:count:${testUserId}`, { value: '1' });

      const status = await lockoutService.recordFailedAttempt(testUserId, testEmail, testIp);

      expect(status.isLocked).toBe(true);
      expect(status.failedAttempts).toBe(5);
      expect(status.remainingAttempts).toBe(0);
    });

    it('should emit failed_attempt event', async () => {
      const events: LockoutEvent[] = [];
      lockoutService.onEvent((event) => events.push(event));

      await lockoutService.recordFailedAttempt(testUserId, testEmail, testIp);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('failed_attempt');
      expect(events[0].userId).toBe(testUserId);
      expect(events[0].email).toBe(testEmail);
      expect(events[0].ip).toBe(testIp);
      expect(events[0].failedAttempts).toBe(1);
    });

    it('should emit lockout event when locked', async () => {
      const events: LockoutEvent[] = [];
      lockoutService.onEvent((event) => events.push(event));

      // Trigger lockout
      for (let i = 0; i < 5; i++) {
        await lockoutService.recordFailedAttempt(testUserId, testEmail, testIp);
      }

      const lockoutEvent = events.find((e) => e.type === 'lockout');
      expect(lockoutEvent).toBeDefined();
      expect(lockoutEvent?.lockoutDuration).toBe(900);
      expect(lockoutEvent?.lockoutCount).toBe(1);
    });
  });

  describe('exponential backoff', () => {
    it('should double lockout duration on repeated lockouts', async () => {
      const service = new LockoutService(mockRedis, {
        maxAttempts: 2,
        baseLockoutDuration: 60,
      });

      // First lockout
      await service.recordFailedAttempt(testUserId, testEmail);
      let status = await service.recordFailedAttempt(testUserId, testEmail);
      expect(status.lockoutRemaining).toBe(60);

      // Clear the locked state but keep lockout count
      storage.delete(`lockout:locked:${testUserId}`);
      storage.delete(`lockout:attempts:${testUserId}`);

      // Second lockout
      await service.recordFailedAttempt(testUserId, testEmail);
      status = await service.recordFailedAttempt(testUserId, testEmail);
      expect(status.lockoutRemaining).toBe(120); // 60 * 2

      // Clear again
      storage.delete(`lockout:locked:${testUserId}`);
      storage.delete(`lockout:attempts:${testUserId}`);

      // Third lockout
      await service.recordFailedAttempt(testUserId, testEmail);
      status = await service.recordFailedAttempt(testUserId, testEmail);
      expect(status.lockoutRemaining).toBe(240); // 60 * 4
    });

    it('should cap lockout duration at maxLockoutDuration', async () => {
      const service = new LockoutService(mockRedis, {
        maxAttempts: 1,
        baseLockoutDuration: 1000,
        maxLockoutDuration: 2000,
      });

      // First lockout: 1000
      let status = await service.recordFailedAttempt(testUserId, testEmail);
      expect(status.lockoutRemaining).toBe(1000);

      storage.delete(`lockout:locked:${testUserId}`);
      storage.delete(`lockout:attempts:${testUserId}`);

      // Second lockout: 2000 (would be 2000)
      status = await service.recordFailedAttempt(testUserId, testEmail);
      expect(status.lockoutRemaining).toBe(2000);

      storage.delete(`lockout:locked:${testUserId}`);
      storage.delete(`lockout:attempts:${testUserId}`);

      // Third lockout: capped at 2000 (would be 4000)
      status = await service.recordFailedAttempt(testUserId, testEmail);
      expect(status.lockoutRemaining).toBe(2000);
    });
  });

  describe('isLocked', () => {
    it('should return false when not locked', async () => {
      const result = await lockoutService.isLocked(testUserId);
      expect(result).toBe(false);
    });

    it('should return true when locked', async () => {
      storage.set(`lockout:locked:${testUserId}`, { value: '1', ttl: 600 });

      const result = await lockoutService.isLocked(testUserId);
      expect(result).toBe(true);
    });
  });

  describe('getStatus', () => {
    it('should return clean status for new user', async () => {
      const status = await lockoutService.getStatus(testUserId);

      expect(status.isLocked).toBe(false);
      expect(status.failedAttempts).toBe(0);
      expect(status.remainingAttempts).toBe(5);
      expect(status.lockoutRemaining).toBe(0);
      expect(status.lockoutCount).toBe(0);
    });

    it('should return correct status with failed attempts', async () => {
      storage.set(`lockout:attempts:${testUserId}`, { value: '3', ttl: 600 });

      const status = await lockoutService.getStatus(testUserId);

      expect(status.isLocked).toBe(false);
      expect(status.failedAttempts).toBe(3);
      expect(status.remainingAttempts).toBe(2);
      expect(status.lockoutRemaining).toBe(0);
    });

    it('should return correct status when locked', async () => {
      storage.set(`lockout:locked:${testUserId}`, { value: '1', ttl: 500 });
      storage.set(`lockout:count:${testUserId}`, { value: '2' });

      const status = await lockoutService.getStatus(testUserId);

      expect(status.isLocked).toBe(true);
      expect(status.failedAttempts).toBe(5);
      expect(status.remainingAttempts).toBe(0);
      expect(status.lockoutRemaining).toBe(500);
      expect(status.lockoutCount).toBe(2);
    });
  });

  describe('getLockoutRemaining', () => {
    it('should return 0 when not locked', async () => {
      const remaining = await lockoutService.getLockoutRemaining(testUserId);
      expect(remaining).toBe(0);
    });

    it('should return remaining TTL when locked', async () => {
      storage.set(`lockout:locked:${testUserId}`, { value: '1', ttl: 300 });

      const remaining = await lockoutService.getLockoutRemaining(testUserId);
      expect(remaining).toBe(300);
    });
  });

  describe('onSuccessfulLogin', () => {
    it('should clear all lockout data', async () => {
      storage.set(`lockout:attempts:${testUserId}`, { value: '3' });
      storage.set(`lockout:locked:${testUserId}`, { value: '1', ttl: 600 });
      storage.set(`lockout:count:${testUserId}`, { value: '2' });

      await lockoutService.onSuccessfulLogin(testUserId, testEmail, testIp);

      expect(storage.has(`lockout:attempts:${testUserId}`)).toBe(false);
      expect(storage.has(`lockout:locked:${testUserId}`)).toBe(false);
      expect(storage.has(`lockout:count:${testUserId}`)).toBe(false);
    });

    it('should emit unlock event if was locked', async () => {
      storage.set(`lockout:locked:${testUserId}`, { value: '1', ttl: 600 });

      const events: LockoutEvent[] = [];
      lockoutService.onEvent((event) => events.push(event));

      await lockoutService.onSuccessfulLogin(testUserId, testEmail, testIp);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('unlock');
      expect(events[0].userId).toBe(testUserId);
    });

    it('should not emit unlock event if was not locked', async () => {
      const events: LockoutEvent[] = [];
      lockoutService.onEvent((event) => events.push(event));

      await lockoutService.onSuccessfulLogin(testUserId, testEmail, testIp);

      expect(events).toHaveLength(0);
    });
  });

  describe('unlock', () => {
    it('should clear all lockout data', async () => {
      storage.set(`lockout:attempts:${testUserId}`, { value: '3' });
      storage.set(`lockout:locked:${testUserId}`, { value: '1', ttl: 600 });
      storage.set(`lockout:count:${testUserId}`, { value: '2' });

      await lockoutService.unlock(testUserId, testEmail);

      expect(storage.has(`lockout:attempts:${testUserId}`)).toBe(false);
      expect(storage.has(`lockout:locked:${testUserId}`)).toBe(false);
      expect(storage.has(`lockout:count:${testUserId}`)).toBe(false);
    });

    it('should emit manual_unlock event', async () => {
      const events: LockoutEvent[] = [];
      lockoutService.onEvent((event) => events.push(event));

      await lockoutService.unlock(testUserId, testEmail);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('manual_unlock');
      expect(events[0].userId).toBe(testUserId);
      expect(events[0].email).toBe(testEmail);
    });
  });

  describe('event listeners', () => {
    it('should support multiple listeners', async () => {
      const listener1Events: LockoutEvent[] = [];
      const listener2Events: LockoutEvent[] = [];

      lockoutService.onEvent((event) => listener1Events.push(event));
      lockoutService.onEvent((event) => listener2Events.push(event));

      await lockoutService.recordFailedAttempt(testUserId, testEmail);

      expect(listener1Events).toHaveLength(1);
      expect(listener2Events).toHaveLength(1);
    });

    it('should allow removing listeners', async () => {
      const events: LockoutEvent[] = [];
      const listener = (event: LockoutEvent) => events.push(event);

      lockoutService.onEvent(listener);
      await lockoutService.recordFailedAttempt(testUserId, testEmail);
      expect(events).toHaveLength(1);

      lockoutService.offEvent(listener);
      await lockoutService.recordFailedAttempt(testUserId, testEmail);
      expect(events).toHaveLength(1); // No new events
    });

    it('should handle listener errors gracefully', async () => {
      const events: LockoutEvent[] = [];

      lockoutService.onEvent(() => {
        throw new Error('Listener error');
      });
      lockoutService.onEvent((event) => events.push(event));

      // Should not throw
      await lockoutService.recordFailedAttempt(testUserId, testEmail);

      // Second listener should still be called
      expect(events).toHaveLength(1);
    });
  });

  describe('getConfig', () => {
    it('should return a copy of config', () => {
      const config1 = lockoutService.getConfig();
      const config2 = lockoutService.getConfig();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2); // Different objects
    });
  });
});
