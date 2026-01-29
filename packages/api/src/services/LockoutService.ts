/**
 * Lockout Service
 *
 * Handles account lockout for brute force protection using Redis.
 * Features:
 * - Track failed login attempts with TTL for auto-expiry
 * - Exponential backoff for repeated lockouts
 * - Auto-unlock when TTL expires
 * - Lockout event logging
 */

import type { RedisClient } from '../redis/RedisClient.js';

/**
 * Lockout configuration
 */
export interface LockoutConfig {
  /** Maximum failed attempts before lockout (default: 5) */
  maxAttempts: number;
  /** Base lockout duration in seconds (default: 900 = 15 minutes) */
  baseLockoutDuration: number;
  /** Maximum lockout duration in seconds for exponential backoff (default: 86400 = 24 hours) */
  maxLockoutDuration: number;
  /** TTL for failed attempts counter in seconds (default: 900 = 15 minutes) */
  attemptsTtl: number;
  /** Redis key prefix for lockout data */
  keyPrefix: string;
}

/**
 * Lockout status for a user
 */
export interface LockoutStatus {
  /** Whether the account is currently locked */
  isLocked: boolean;
  /** Number of failed attempts */
  failedAttempts: number;
  /** Remaining attempts before lockout (0 if locked) */
  remainingAttempts: number;
  /** Seconds until unlock (0 if not locked) */
  lockoutRemaining: number;
  /** Number of times the account has been locked */
  lockoutCount: number;
}

/**
 * Lockout event for logging/monitoring
 */
export interface LockoutEvent {
  type: 'failed_attempt' | 'lockout' | 'unlock' | 'manual_unlock';
  userId: string;
  email: string;
  ip?: string;
  failedAttempts?: number;
  lockoutDuration?: number;
  lockoutCount?: number;
  timestamp: Date;
}

/**
 * Default lockout configuration
 */
const DEFAULT_CONFIG: LockoutConfig = {
  maxAttempts: 5,
  baseLockoutDuration: 900, // 15 minutes
  maxLockoutDuration: 86400, // 24 hours
  attemptsTtl: 900, // 15 minutes
  keyPrefix: 'lockout:',
};

/**
 * Lockout Service class
 */
export class LockoutService {
  private readonly config: LockoutConfig;
  private readonly eventListeners: ((event: LockoutEvent) => void)[] = [];

  constructor(
    private readonly redis: RedisClient,
    config?: Partial<LockoutConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Get Redis keys for a user
   */
  private getKeys(userId: string) {
    const prefix = this.config.keyPrefix;
    return {
      attempts: `${prefix}attempts:${userId}`,
      locked: `${prefix}locked:${userId}`,
      lockoutCount: `${prefix}count:${userId}`,
    };
  }

  /**
   * Calculate lockout duration with exponential backoff
   * Duration doubles with each consecutive lockout, up to maxLockoutDuration
   */
  private calculateLockoutDuration(lockoutCount: number): number {
    // lockoutCount is 0-indexed for the first lockout
    const multiplier = Math.pow(2, lockoutCount);
    const duration = this.config.baseLockoutDuration * multiplier;
    return Math.min(duration, this.config.maxLockoutDuration);
  }

  /**
   * Register a failed login attempt
   * Returns the updated lockout status
   */
  async recordFailedAttempt(userId: string, email: string, ip?: string): Promise<LockoutStatus> {
    const keys = this.getKeys(userId);

    // Check if already locked
    const isLocked = await this.redis.exists(keys.locked);
    if (isLocked) {
      const ttl = await this.redis.ttl(keys.locked);
      const lockoutCount = parseInt((await this.redis.get(keys.lockoutCount)) || '0', 10);
      return {
        isLocked: true,
        failedAttempts: this.config.maxAttempts,
        remainingAttempts: 0,
        lockoutRemaining: Math.max(0, ttl),
        lockoutCount,
      };
    }

    // Increment failed attempts
    const attempts = await this.redis.incr(keys.attempts);

    // Set TTL on first attempt
    if (attempts === 1) {
      await this.redis.expire(keys.attempts, this.config.attemptsTtl);
    }

    // Emit failed attempt event
    this.emitEvent({
      type: 'failed_attempt',
      userId,
      email,
      ip,
      failedAttempts: attempts,
      timestamp: new Date(),
    });

    // Check if max attempts reached
    if (attempts >= this.config.maxAttempts) {
      // Get and increment lockout count
      const lockoutCount = await this.redis.incr(keys.lockoutCount);
      const lockoutDuration = this.calculateLockoutDuration(lockoutCount - 1);

      // Set lockout with calculated duration
      await this.redis.set(keys.locked, '1', lockoutDuration);

      // Clear the attempts counter
      await this.redis.del(keys.attempts);

      // Emit lockout event
      this.emitEvent({
        type: 'lockout',
        userId,
        email,
        ip,
        failedAttempts: attempts,
        lockoutDuration,
        lockoutCount,
        timestamp: new Date(),
      });

      return {
        isLocked: true,
        failedAttempts: attempts,
        remainingAttempts: 0,
        lockoutRemaining: lockoutDuration,
        lockoutCount,
      };
    }

    const lockoutCount = parseInt((await this.redis.get(keys.lockoutCount)) || '0', 10);

    return {
      isLocked: false,
      failedAttempts: attempts,
      remainingAttempts: this.config.maxAttempts - attempts,
      lockoutRemaining: 0,
      lockoutCount,
    };
  }

  /**
   * Check if a user is locked out
   */
  async isLocked(userId: string): Promise<boolean> {
    const keys = this.getKeys(userId);
    return this.redis.exists(keys.locked);
  }

  /**
   * Get the current lockout status for a user
   */
  async getStatus(userId: string): Promise<LockoutStatus> {
    const keys = this.getKeys(userId);

    const [isLocked, attemptsStr, lockoutCountStr, ttl] = await Promise.all([
      this.redis.exists(keys.locked),
      this.redis.get(keys.attempts),
      this.redis.get(keys.lockoutCount),
      this.redis.ttl(keys.locked),
    ]);

    const failedAttempts = parseInt(attemptsStr || '0', 10);
    const lockoutCount = parseInt(lockoutCountStr || '0', 10);

    return {
      isLocked,
      failedAttempts: isLocked ? this.config.maxAttempts : failedAttempts,
      remainingAttempts: isLocked ? 0 : this.config.maxAttempts - failedAttempts,
      lockoutRemaining: isLocked ? Math.max(0, ttl) : 0,
      lockoutCount,
    };
  }

  /**
   * Get remaining lockout time in seconds
   */
  async getLockoutRemaining(userId: string): Promise<number> {
    const keys = this.getKeys(userId);
    const ttl = await this.redis.ttl(keys.locked);
    return Math.max(0, ttl);
  }

  /**
   * Clear failed attempts on successful login
   * Also resets the lockout count after successful login
   */
  async onSuccessfulLogin(userId: string, email: string, ip?: string): Promise<void> {
    const keys = this.getKeys(userId);

    // Check if was locked before clearing
    const wasLocked = await this.redis.exists(keys.locked);

    // Clear attempts and lockout
    await Promise.all([
      this.redis.del(keys.attempts),
      this.redis.del(keys.locked),
      this.redis.del(keys.lockoutCount),
    ]);

    // Emit unlock event if was locked
    if (wasLocked) {
      this.emitEvent({
        type: 'unlock',
        userId,
        email,
        ip,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Manually unlock a user account (admin action)
   */
  async unlock(userId: string, email: string): Promise<void> {
    const keys = this.getKeys(userId);

    await Promise.all([
      this.redis.del(keys.attempts),
      this.redis.del(keys.locked),
      this.redis.del(keys.lockoutCount),
    ]);

    this.emitEvent({
      type: 'manual_unlock',
      userId,
      email,
      timestamp: new Date(),
    });
  }

  /**
   * Register an event listener for lockout events
   */
  onEvent(listener: (event: LockoutEvent) => void): void {
    this.eventListeners.push(listener);
  }

  /**
   * Remove an event listener
   */
  offEvent(listener: (event: LockoutEvent) => void): void {
    const index = this.eventListeners.indexOf(listener);
    if (index !== -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  /**
   * Emit a lockout event to all listeners
   */
  private emitEvent(event: LockoutEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch {
        // Ignore listener errors
      }
    }
  }

  /**
   * Get the configuration
   */
  getConfig(): Readonly<LockoutConfig> {
    return { ...this.config };
  }
}
