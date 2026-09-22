---
name: backend:sqs
description: Create new SQS producers and consumers — queue service, consumer class, module registration, and BackgroundModule wiring. Use when adding a new queue domain beyond email/notification/webhook.
---

# Backend SQS — New Queue Scaffold

## Architecture Rules (read before writing anything)

- `SqsProducer` is `@Global()` — inject it anywhere via NestJS DI
- **Consumers ONLY run in `WorkerModule` via `BackgroundModule`** — never register a consumer in `AppModule` or any feature module; it will start long-polling in the API process
- Queue services (producers) can be imported by feature modules — they only call `sqsProducer.send()`, never poll
- Add new queue URLs to `SqsQueueName` enum and `SQS_QUEUE_URL_ENV_MAP` in `src/sqs/sqs.constants.ts`

## When to Use This Skill

Only scaffold a new queue when:
- The operation is a genuinely new domain (e.g. `PROFILE_PROCESSING`, `ACOUSTIC_PROCESSING`)
- None of the existing queues (EMAIL, NOTIFICATION, WEBHOOK_DELIVERY) fit

For dispatching to **existing** queues, use `backend:background-job` instead.

## Files to Create

```
src/background/queue/{domain}/
  {domain}-queue.service.ts    # Producer — wraps SqsProducer.send()
  {domain}.consumer.ts         # Consumer — extends SqsConsumer
  {domain}-queue.module.ts     # NestJS module — exports the queue service
```

## Step 1 — Register the Queue

**`src/sqs/sqs.constants.ts`** — add to both enum and URL map:

```typescript
export enum SqsQueueName {
  // ... existing ...
  MY_DOMAIN = 'MY_DOMAIN',
}

export const SQS_QUEUE_URL_ENV_MAP: Record<SqsQueueName, string> = {
  // ... existing ...
  [SqsQueueName.MY_DOMAIN]: 'SQS_MY_DOMAIN_QUEUE_URL',
};
```

**`src/config/env.config.ts`** — add optional env var:
```typescript
@IsOptional() @IsString() SQS_MY_DOMAIN_QUEUE_URL?: string;
```

**`localstack/init-queues.sh`** — add queue creation:
```bash
awslocal sqs create-queue --queue-name my-domain-queue
```

## Step 2 — Queue Service (Producer)

```typescript
// src/background/queue/{domain}/{domain}-queue.service.ts
import { Injectable } from '@nestjs/common';
import { SqsProducer } from '@sqs/sqs.producer';
import { SqsQueueName } from '@sqs/sqs.constants';
import { JobName } from '@bg/constants/job.constant';
import { IMyDomainJob } from '@bg/interfaces/job.interface';

@Injectable()
export class MyDomainQueueService {
  constructor(private readonly sqsProducer: SqsProducer) {}

  async addMyDomainJob(data: IMyDomainJob): Promise<void> {
    await this.sqsProducer.send(SqsQueueName.MY_DOMAIN, JobName.MY_DOMAIN_PROCESS, data);
  }
}
```

## Step 3 — Consumer

```typescript
// src/background/queue/{domain}/{domain}.consumer.ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SQSClient } from '@aws-sdk/client-sqs';
import { EnvConfig } from '@config/env.config';
import { SQS_CLIENT, SqsQueueName } from '@sqs/sqs.constants';
import { SqsConsumer } from '@sqs/sqs.consumer';
import { ISqsJobEnvelope } from '@sqs/interfaces/sqs-message.interface';
import { JobName } from '@bg/constants/job.constant';
import { IMyDomainJob } from '@bg/interfaces/job.interface';

@Injectable()
export class MyDomainConsumer extends SqsConsumer {
  protected readonly logger = new Logger(MyDomainConsumer.name);
  protected readonly queueName = SqsQueueName.MY_DOMAIN;
  protected override readonly concurrency = 3; // adjust per throughput needs

  constructor(
    @Inject(SQS_CLIENT) sqsClient: SQSClient,
    configService: ConfigService<EnvConfig>,
  ) {
    super(sqsClient, configService);
  }

  protected async processJob(envelope: ISqsJobEnvelope): Promise<void> {
    switch (envelope.jobName) {
      case JobName.MY_DOMAIN_PROCESS:
        await this.handleProcess(envelope.data as IMyDomainJob);
        break;
      default:
        this.logger.warn(`Unknown job: ${envelope.jobName}`);
    }
  }

  private async handleProcess(data: IMyDomainJob): Promise<void> {
    // business logic here
  }
}
```

### Retry / DLQ in handleFailure

Override `handleFailure` only if you need custom retry logic. Default behaviour (from base class) changes message visibility for exponential backoff and routes to DLQ after max attempts:

```typescript
// Override only when needed — e.g. different max attempts or delay schedule
protected override async handleFailure(
  envelope: ISqsJobEnvelope,
  error: Error,
  receiptHandle: string,
  sqsAttributes: Record<string, string>,
): Promise<void> {
  const attempt = parseInt(sqsAttributes['ApproximateReceiveCount'] ?? '1', 10);
  if (attempt >= 3) {
    await this.deadLetterProducer.addFailedJob({ ...envelope, failedReason: error.message });
    await this.deleteMessage(receiptHandle);
  } else {
    const delay = Math.min(10 * Math.pow(2, attempt - 1), 900);
    await this.changeVisibility(receiptHandle, delay);
  }
}
```

## Step 4 — Queue Module

```typescript
// src/background/queue/{domain}/{domain}-queue.module.ts
import { Module } from '@nestjs/common';
import { MyDomainQueueService } from './{domain}-queue.service';

@Module({
  providers: [MyDomainQueueService],
  exports: [MyDomainQueueService],
})
export class MyDomainQueueModule {}
```

## Step 5 — Wire into BackgroundModule

```typescript
// src/background/background.module.ts — add consumer as provider, import queue module
@Module({
  imports: [
    // ... existing queue modules ...
    MyDomainQueueModule,
  ],
  providers: [
    // ... existing consumers ...
    MyDomainConsumer, // ← consumer registered HERE, not in the queue module
  ],
})
export class BackgroundModule {}
```

## Step 6 — Add JobName + Interface

```typescript
// src/background/constants/job.constant.ts
export enum JobName {
  MY_DOMAIN_PROCESS = 'MY_DOMAIN_PROCESS',
}

// src/background/interfaces/job.interface.ts
export interface IMyDomainJob {
  resourceId: string;
  userId: string;
}
```

## Checklist

- [ ] `SqsQueueName` enum updated
- [ ] `SQS_QUEUE_URL_ENV_MAP` updated
- [ ] Env var added to `env.config.ts`
- [ ] `localstack/init-queues.sh` updated
- [ ] Queue service created (producer only)
- [ ] Consumer created (extends `SqsConsumer`)
- [ ] Consumer registered in `BackgroundModule` providers (NOT in queue module)
- [ ] Queue module imported in `BackgroundModule`
- [ ] `JobName` enum updated
- [ ] Job interface added
- [ ] `pnpm type-check` passes
