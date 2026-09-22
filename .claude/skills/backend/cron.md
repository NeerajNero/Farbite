---
name: backend:cron
description: Add scheduled cron jobs to the backend — add a @Cron() method to CronScheduler and the corresponding business logic to CronService
---

# Backend Cron Jobs

## Architecture

Cron jobs live in `src/background/cron/`:

```
src/background/cron/
  cron.scheduler.ts   # @Injectable() — @Cron() methods; calls CronService directly
  cron.service.ts     # Business logic for scheduled work
  cron.module.ts      # Provides CronScheduler + CronService
```

`ScheduleModule.forRoot()` is registered in `AppModule`. The cron module is imported by `BackgroundModule`.

## When to Use Cron vs Queue

| Use cron | Use queue |
|----------|-----------|
| Time-based triggers (daily, hourly) | Event-triggered async work |
| Maintenance tasks (cleanup, rollup) | User-initiated operations |
| Polling external systems | Webhook delivery |
| Scheduled reports | Email sending (use EmailQueueService) |

## Adding a New Cron Job

### Step 1 — Add business logic to CronService

```typescript
// src/background/cron/cron.service.ts
@Injectable()
export class CronService {
  constructor(
    private readonly logger: Logger,
    // inject DB services or providers as needed
  ) {}

  async myScheduledTask(): Promise<void> {
    this.logger.log('Running my scheduled task');
    // business logic here
  }
}
```

### Step 2 — Add @Cron() method to CronScheduler

```typescript
// src/background/cron/cron.scheduler.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CronService } from './cron.service';

@Injectable()
export class CronScheduler {
  private readonly logger = new Logger(CronScheduler.name);

  constructor(private readonly cronService: CronService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async myScheduledTask(): Promise<void> {
    this.logger.log('Triggering my scheduled task');
    await this.cronService.myScheduledTask();
  }
}
```

## Common CronExpression Values

```typescript
CronExpression.EVERY_MINUTE
CronExpression.EVERY_5_MINUTES
CronExpression.EVERY_HOUR
CronExpression.EVERY_DAY_AT_MIDNIGHT    // '0 0 * * *'
CronExpression.EVERY_DAY_AT_NOON        // '0 12 * * *'
CronExpression.EVERY_WEEK               // '0 0 * * 0'
CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT
```

For custom schedules use a cron string directly:
```typescript
@Cron('0 2 * * *')  // every day at 2am
```

## Dispatching to a Queue from Cron (fan-out pattern)

For heavy work, dispatch to SQS from the cron handler — the cron just kicks off the work:

```typescript
// cron.scheduler.ts
@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
async scheduleNightlyProcessing(): Promise<void> {
  await this.cronService.scheduleNightlyProcessing();
}

// cron.service.ts — enqueues work, doesn't do it
async scheduleNightlyProcessing(): Promise<void> {
  const userIds = await this.usersDb.findAllActiveUserIds();
  for (const userId of userIds) {
    void this.profileQueue.addProcessingJob({ userId });
  }
}
```

## Conventions

- **`CronScheduler` is thin** — all logic goes in `CronService`, not the scheduler
- **Never call external APIs directly in the scheduler** — delegate to `CronService` or queue
- **Use `void` on queue dispatches** — cron jobs are fire-and-forget
- **Log at start of every job** — helps with observability when tasks run silently
- `ScheduleModule.forRoot()` is in `AppModule` — do not add it to `CronModule`
