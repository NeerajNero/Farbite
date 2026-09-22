---
name: backend:background-job
description: Dispatch async background jobs using AWS SQS producers — email, notification, webhook, and dead-letter queues. Uses SqsProducer to fire-and-forget from feature services.
---

# Backend Background Job

## When to Queue vs. Call Synchronously

| Dispatch async (queue) | Call synchronously |
|------------------------|-------------------|
| Sending emails or SMS | Validating input |
| Push notifications | Reading data for response |
| Outbound webhooks | Simple DB writes |
| AI/LLM inference | Auth checks |
| File processing | Immediate confirmation needed |
| Any operation > 200ms | |

## Existing Queues

Do not create new queues unless the operation is genuinely a new domain. Use existing queues:

| Queue | `SqsQueueName` | Service to inject | Use for |
|-------|---------------|------------------|---------|
| Email | `SqsQueueName.EMAIL` | `EmailQueueService` | All transactional emails |
| Notification | `SqsQueueName.NOTIFICATION` | `NotificationQueueService` | In-app + push notifications |
| Webhook | `SqsQueueName.WEBHOOK_DELIVERY` | `WebhookQueueService` | Outbound webhook delivery |
| Dead Letter | `SqsQueueName.DEAD_LETTER` | `DeadLetterQueueService` | Failed job logging |

Path aliases: `@email-queue/*`, `@notification-queue/*`, `@webhook-queue/*`, `@dead-letter-queue/*`

## Steps

1. **Choose the correct existing queue** from the table above
2. **Define the job payload interface** in `src/background/interfaces/job.interface.ts` — typed, flat object; no circular references
3. **Add a `JobName` enum value** in `src/background/constants/job.constant.ts` if dispatching a new job type
4. **Add a producer method** to the queue's service (e.g. `EmailQueueService.addWelcomeEmailJob(data)`)
5. **Inject the queue service** into the feature service
6. **Dispatch fire-and-forget**: `void this.emailQueue.addWelcomeEmailJob(data)` — never `await` in the HTTP path
7. **Run `pnpm type-check`**

## Template: Dispatching to an Existing Queue

```typescript
// 1. Add job payload interface — src/background/interfaces/job.interface.ts
export interface IWelcomeEmailJob {
  to: string;
  name: string;
  userId: string;
}

// 2. Add JobName — src/background/constants/job.constant.ts
export enum JobName {
  // ... existing ...
  WELCOME_EMAIL = 'WELCOME_EMAIL',
}

// 3. Add producer method — src/background/queue/email/email-queue.service.ts
async addWelcomeEmailJob(data: IWelcomeEmailJob): Promise<void> {
  await this.sqsProducer.send(SqsQueueName.EMAIL, JobName.WELCOME_EMAIL, data);
}

// 4. Handle in consumer — src/background/queue/email/email.consumer.ts
protected async processJob(envelope: ISqsJobEnvelope): Promise<void> {
  switch (envelope.jobName) {
    case JobName.WELCOME_EMAIL:
      await this.handleWelcomeEmail(envelope.data as IWelcomeEmailJob);
      break;
    // ...
  }
}

// 5. Inject and dispatch — src/api/{module}/{module}.service.ts
import { EmailQueueService } from '@email-queue/email-queue.service';

@Injectable()
export class ProfileService {
  constructor(
    private readonly profileDb: ProfileDbService,
    private readonly emailQueue: EmailQueueService,
  ) {}

  async create(dto: CreateProfileDto): Promise<ProfileResponseDto> {
    const profile = await this.profileDb.create(dto);
    void this.emailQueue.addWelcomeEmailJob({
      to: dto.email,
      name: dto.name,
      userId: profile.id,
    });
    return profile;
  }
}
```

## Creating a New Queue (only when needed)

Only create a new queue if the operation is genuinely a new domain (not email, notification, or webhook). See `backend:sqs` skill for full producer + consumer scaffold.

## Conventions

- **Fire and forget** — use `void this.queueService.addXxxJob(data)`, never `await` in the HTTP request path
- **Typed payload interfaces** — define in `src/background/interfaces/job.interface.ts`; no `any`, no `unknown` in job data
- **`JobName` enum** — all job type strings go in `src/background/constants/job.constant.ts`
- **Producer methods on queue services** — never call `sqsProducer.send()` directly from feature services; wrap it in a named method
- **Consumer switch dispatch** — consumers route by `envelope.jobName`; add a `case` for each new job type
- **Retry is automatic** — SQS handles retries via `ApproximateReceiveCount`; do not implement retry logic in the producer
- Queue services live in `src/background/queue/{domain}/` — never inside the feature module
