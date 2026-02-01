---
applyTo: "packages/api/src/**/*.ts"
---

# API Package Guidelines

## Architecture: Service-Repository Pattern

The API uses a layered architecture:

```
Routes → Services → Repositories → Database (Drizzle)
              ↓
         Validation (Zod)
              ↓
      Error Handling (ApiError)
```

## File Organization

```
src/
├── routes/          # Fastify route handlers (thin layer)
├── services/        # Business logic (validation, rules)
├── repositories/    # Data access (Drizzle queries)
├── db/schema/       # Drizzle table definitions
├── auth/            # Authentication service
├── queues/          # BullMQ job processors
├── plugins/         # Fastify plugins
├── redis/           # Redis client
├── errors/          # Error classes
└── config/          # Environment config
```

## Routes

Routes should be thin - delegate to services:

```typescript
fastify.post<{ Body: CreateRequest }>('/', async (request, reply) => {
  try {
    const userId = (request.user as { sub: string }).sub;
    const result = await service.create(userId, request.body);
    return reply.status(201).send({ success: true, data: result });
  } catch (error) {
    return handleError(error, reply);
  }
});
```

## Services

Services contain business logic and validation:

```typescript
export class MyService {
  constructor(
    private readonly repository: MyRepository,
    private readonly otherDep: OtherDep
  ) {}

  async create(userId: string, data: unknown) {
    // 1. Validate with Zod
    const validated = createSchema.parse(data);
    
    // 2. Business rules
    if (someCondition) throw MyErrors.SOME_ERROR;
    
    // 3. Call repository
    return this.repository.create({ userId, ...validated });
  }
}
```

## Error Handling

Define errors as constants:

```typescript
export class MyError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'MyError';
  }
}

export const MyErrors = {
  NOT_FOUND: new MyError('Resource not found', 'NOT_FOUND', 404),
  NOT_AUTHORIZED: new MyError('Not authorized', 'NOT_AUTHORIZED', 403),
} as const;
```

## Repositories

Repositories handle database operations only:

```typescript
export class MyRepository {
  constructor(private readonly db: Database) {}

  async findById(userId: string, id: string) {
    const [result] = await this.db
      .select()
      .from(myTable)
      .where(and(eq(myTable.id, id), eq(myTable.userId, userId)));
    return result;
  }
}
```

## Database Schema (Drizzle)

Use PostgreSQL with proper types:

```typescript
export const myTable = pgTable('my_table', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  name: varchar('name', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});
```

## Validation (Zod)

Always validate input:

```typescript
export const createSchema = z.object({
  name: z.string().min(1).max(255),
  tags: z.array(z.string()).max(20).optional(),
});

export type CreateRequest = z.infer<typeof createSchema>;
```

## Testing

Test each layer separately:
- **Routes**: Mock services, test HTTP behavior
- **Services**: Mock repositories, test business logic
- **Repositories**: Mock database, test query building

```typescript
// Mock database for repository tests
const mockDb = {
  select: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([mockData]),
    }),
  }),
};
```

## Authentication

Routes requiring auth use JWT middleware:

```typescript
fastify.addHook('onRequest', async (request, reply) => {
  await request.jwtVerify();
});

// Access user in route
const userId = (request.user as { sub: string }).sub;
```

## Queue Jobs

For background processing, use BullMQ:

```typescript
// Add job
await jobQueueManager.addJob('test-runs', {
  runId: run.id,
  recordingData: recording.data,
});

// Process job (in worker)
export async function processTestRun(job: Job<TestRunJobData>) {
  // Use @saveaction/core to execute
}
```
