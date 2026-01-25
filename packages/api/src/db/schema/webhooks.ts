import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  text,
  index,
  boolean,
  pgEnum,
  jsonb,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { users } from './users.js';

/**
 * Webhook event types enum
 */
export const webhookEventEnum = pgEnum('webhook_event', [
  // Run events
  'run.started',
  'run.completed',
  'run.passed',
  'run.failed',
  'run.cancelled',

  // Recording events
  'recording.created',
  'recording.updated',
  'recording.deleted',

  // Schedule events
  'schedule.triggered',
  'schedule.failed',
  'schedule.paused',

  // API events
  'api_token.created',
  'api_token.expired',
]);

/**
 * Webhook status enum
 */
export const webhookStatusEnum = pgEnum('webhook_status', [
  'active', // Receiving events
  'paused', // Temporarily paused
  'disabled', // Permanently disabled
  'suspended', // Auto-suspended due to failures
]);

/**
 * Webhooks table - Event notifications to external URLs
 *
 * Enterprise considerations:
 * - HMAC signature verification (SHA-256)
 * - Event filtering (subscribe to specific events)
 * - Automatic retry with exponential backoff
 * - Circuit breaker (suspend after N consecutive failures)
 * - Request/response logging for debugging
 * - Rate limiting per webhook
 * - SSL/TLS validation options
 * - Custom headers support
 * - Soft delete with audit trail
 */
export const webhooks = pgTable(
  'webhooks',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Ownership
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Webhook configuration
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    url: varchar('url', { length: 2048 }).notNull(),

    // Security
    // Secret for HMAC-SHA256 signature in X-SaveAction-Signature header
    secret: varchar('secret', { length: 255 }).notNull(),

    // Status
    status: webhookStatusEnum('status').notNull().default('active'),

    // Event subscription (array of event types)
    // If null/empty, receives all events
    events: jsonb('events').$type<string[]>(),

    // Filtering (optional - only send for specific recordings/runs)
    recordingIds: jsonb('recording_ids').$type<string[]>(),
    filterTags: jsonb('filter_tags').$type<string[]>(),

    // Custom headers to send with webhook
    customHeaders: jsonb('custom_headers').$type<Record<string, string>>(),

    // SSL/TLS options
    verifySsl: boolean('verify_ssl').default(true),

    // Retry configuration
    maxRetries: varchar('max_retries', { length: 10 }).default('3'),
    retryDelayMs: varchar('retry_delay_ms', { length: 10 }).default('1000'),
    timeoutMs: varchar('timeout_ms', { length: 10 }).default('10000'),

    // Circuit breaker
    consecutiveFailures: varchar('consecutive_failures', { length: 10 }).default('0'),
    suspendAfterFailures: varchar('suspend_after_failures', { length: 10 }).default('10'),
    suspendedAt: timestamp('suspended_at', { withTimezone: true }),
    suspendedReason: text('suspended_reason'),

    // Usage statistics
    totalDeliveries: varchar('total_deliveries', { length: 20 }).default('0'),
    successfulDeliveries: varchar('successful_deliveries', { length: 20 }).default('0'),
    failedDeliveries: varchar('failed_deliveries', { length: 20 }).default('0'),
    lastDeliveryAt: timestamp('last_delivery_at', { withTimezone: true }),
    lastDeliveryStatus: varchar('last_delivery_status', { length: 20 }),
    lastResponseCode: varchar('last_response_code', { length: 10 }),
    lastErrorMessage: text('last_error_message'),

    // Rate limiting
    rateLimitPerMinute: varchar('rate_limit_per_minute', { length: 10 }).default('60'),
    deliveriesThisMinute: varchar('deliveries_this_minute', { length: 10 }).default('0'),
    minuteResetAt: timestamp('minute_reset_at', { withTimezone: true }),

    // Soft delete
    deletedAt: timestamp('deleted_at', { withTimezone: true }),

    // Timestamps
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // User's webhooks (settings page)
    index('webhooks_user_id_idx')
      .on(table.userId)
      .where(sql`${table.deletedAt} IS NULL`),

    // Active webhooks for event dispatch
    index('webhooks_active_idx')
      .on(table.status)
      .where(sql`${table.status} = 'active' AND ${table.deletedAt} IS NULL`),

    // Suspended webhooks (for admin review/cleanup)
    index('webhooks_suspended_idx')
      .on(table.suspendedAt)
      .where(sql`${table.status} = 'suspended'`),

    // URL uniqueness per user (partial - only non-deleted)
    index('webhooks_user_url_idx')
      .on(table.userId, table.url)
      .where(sql`${table.deletedAt} IS NULL`),
  ]
);

/**
 * Webhook deliveries table - Log of all webhook delivery attempts
 *
 * Enterprise considerations:
 * - Full audit trail for debugging
 * - Request/response logging
 * - Retention policy support (can purge old deliveries)
 * - High-volume table - minimal indexes
 */
export const webhookDeliveries = pgTable(
  'webhook_deliveries',
  {
    // Primary key
    id: uuid('id').primaryKey().defaultRandom(),

    // Webhook reference
    webhookId: uuid('webhook_id')
      .notNull()
      .references(() => webhooks.id, { onDelete: 'cascade' }),

    // Event details
    eventType: varchar('event_type', { length: 100 }).notNull(),
    eventId: uuid('event_id'), // ID of the resource that triggered event
    payload: jsonb('payload'), // Full payload sent

    // Delivery result
    success: boolean('success').notNull(),
    attemptNumber: varchar('attempt_number', { length: 10 }).notNull().default('1'),

    // Request details
    requestUrl: varchar('request_url', { length: 2048 }).notNull(),
    requestHeaders: jsonb('request_headers').$type<Record<string, string>>(),

    // Response details
    responseCode: varchar('response_code', { length: 10 }),
    responseHeaders: jsonb('response_headers').$type<Record<string, string>>(),
    responseBody: text('response_body'), // Truncated to 10KB
    responseTimeMs: varchar('response_time_ms', { length: 10 }),

    // Error details
    errorMessage: text('error_message'),
    errorCode: varchar('error_code', { length: 50 }), // ECONNREFUSED, ETIMEDOUT, etc.

    // Timing
    deliveredAt: timestamp('delivered_at', { withTimezone: true }).notNull().defaultNow(),
    willRetryAt: timestamp('will_retry_at', { withTimezone: true }),
  },
  (table) => [
    // Webhook delivery history (recent first)
    index('webhook_deliveries_webhook_id_idx').on(table.webhookId, table.deliveredAt),

    // Failed deliveries for retry queue
    index('webhook_deliveries_retry_idx')
      .on(table.willRetryAt)
      .where(sql`${table.willRetryAt} IS NOT NULL AND ${table.success} = false`),

    // Event type analytics
    index('webhook_deliveries_event_type_idx').on(table.eventType, table.deliveredAt),

    // Cleanup by date (for retention policy)
    index('webhook_deliveries_date_idx').on(table.deliveredAt),
  ]
);

/**
 * Webhook type inference
 */
export type Webhook = typeof webhooks.$inferSelect;
export type NewWebhook = typeof webhooks.$inferInsert;
export type WebhookStatus = (typeof webhookStatusEnum.enumValues)[number];
export type WebhookEvent = (typeof webhookEventEnum.enumValues)[number];

export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type NewWebhookDelivery = typeof webhookDeliveries.$inferInsert;
