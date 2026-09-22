---
name: backend:provider
description: Create providers following the Strategy pattern with abstract base and concrete implementations
---

# Backend Provider

## Trigger

Use when creating external service integrations in `./`.

## Steps

1. **Identify the integration type** — email, SMS, storage, AI, payment, etc.
2. **Check for existing providers** — look in `src/{module}/providers/` to understand naming and injection patterns
3. **Define the abstract interface** — what methods must every implementation expose? (method names, param types, return types)
4. **Create the abstract provider** — `src/{module}/providers/{provider}.provider.ts` using the Abstract Provider template below
5. **Create concrete implementation(s)** — one file per provider (e.g., `sendgrid.provider.ts`, `ses.provider.ts`)
6. **Create the module** — register abstract token + concrete class in `providers`, export the abstract token
7. **Inject via abstract token** — consumers inject the abstract class, never the concrete implementation
8. **Run `pnpm type-check`** — fix all errors

## Structure

```
src/{module}/
  providers/
    {provider}.provider.ts       # Abstract base
    {impl1}.provider.ts          # Implementation 1
    {impl2}.provider.ts          # Implementation 2
```

## Templates

### Abstract Provider

```typescript
// {provider}.provider.ts
import { Injectable, Logger } from '@nestjs/common';

export interface {Provider}Config {
  apiKey: string;
  region?: string;
  endpoint?: string;
}

export interface {Provider}Input {
  // Define input
}

export interface {Provider}Result {
  success: boolean;
  id?: string;
  data?: unknown;
  error?: string;
}

@Injectable()
export abstract class {Provider}Provider {
  protected readonly logger = new Logger(this.constructor.name);
  protected config: {Provider}Config;

  constructor(config: {Provider}Config) {
    this.config = config;
  }

  abstract initialize(): Promise<void>;
  abstract process(input: {Provider}Input): Promise<{Provider}Result>;
  abstract healthCheck(): Promise<boolean>;
  abstract dispose(): Promise<void>;
  abstract getProviderName(): string;
}
```

### Concrete Implementation

```typescript
// {impl}.provider.ts
import { Injectable } from '@nestjs/common';
import {
  {Provider}Provider,
  {Provider}Config,
  {Provider}Input,
  {Provider}Result,
} from './{provider}.provider';

@Injectable()
export class {Impl}Provider extends {Provider}Provider {
  private client: unknown;

  constructor(config: {Provider}Config) {
    super(config);
  }

  getProviderName(): string {
    return '{Impl}';
  }

  async initialize(): Promise<void> {
    this.logger.log(`Initializing ${this.getProviderName()}`);
    // this.client = new Client({ apiKey: this.config.apiKey });
  }

  async process(input: {Provider}Input): Promise<{Provider}Result> {
    try {
      this.logger.debug(`Processing with ${this.getProviderName()}`, { input });
      // const response = await this.client.operation(input);
      return { success: true, id: 'result-id', data: {} };
    } catch (error) {
      this.logger.error(`${this.getProviderName()} failed`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      // await this.client.ping();
      return true;
    } catch {
      return false;
    }
  }

  async dispose(): Promise<void> {
    this.logger.log(`Disposing ${this.getProviderName()}`);
    // await this.client.close();
  }
}
```

### Module Factory

```typescript
// {module}.module.ts
import { Module, DynamicModule, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { {Provider}Provider } from './providers/{provider}.provider';
import { {Impl1}Provider } from './providers/{impl1}.provider';
import { {Impl2}Provider } from './providers/{impl2}.provider';

@Module({})
export class {Module}Module implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly provider: {Provider}Provider) {}

  static register(): DynamicModule {
    return {
      module: {Module}Module,
      providers: [
        {
          provide: {Provider}Provider,
          useFactory: (config: ConfigService): {Provider}Provider => {
            const type = config.get<string>('{PROVIDER}_TYPE') ?? '{impl1}';
            const providerConfig = {
              apiKey: config.get<string>('{PROVIDER}_API_KEY') ?? '',
              region: config.get<string>('{PROVIDER}_REGION'),
            };

            switch (type.toLowerCase()) {
              case '{impl2}':
                return new {Impl2}Provider(providerConfig);
              default:
                return new {Impl1}Provider(providerConfig);
            }
          },
          inject: [ConfigService],
        },
      ],
      exports: [{Provider}Provider],
    };
  }

  async onModuleInit() {
    await this.provider.initialize();
  }

  async onModuleDestroy() {
    await this.provider.dispose();
  }
}
```

## Common Provider Types

| Type | Methods | Implementations |
|------|---------|-----------------|
| Storage | `upload`, `download`, `delete`, `getSignedUrl` | S3, Cloudinary, GCS |
| Email | `send`, `sendTemplate`, `sendBulk` | SMTP, SES, SendGrid |
| SMS | `send`, `sendOtp`, `verifyOtp` | Twilio, SNS |
| Payment | `charge`, `refund`, `subscribe` | Stripe, PayPal |
| AI | `complete`, `chat`, `embed` | Claude, OpenAI |

## Environment Variables

```bash
{PROVIDER}_TYPE={impl1}
{PROVIDER}_API_KEY=
{PROVIDER}_REGION=
```
