import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { validateEnv } from './config/env.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { InternalKeyGuard } from './common/guards/internal-key.guard.js';
import { ActorGuard } from './common/guards/actor.guard.js';
import { DbModule } from './db/db.module.js';
import { EventsModule } from './events/events.module.js';
import { HealthModule } from './health/health.module.js';
import { UsersModule } from './users/users.module.js';
import { AdminModule } from './admin/admin.module.js';
import { PingController } from './ping/ping.controller.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      // Tests control env via process.env only.
      ignoreEnvFile: process.env.NODE_ENV === 'test',
    }),
    ScheduleModule.forRoot(),
    // Per-route throttling (keyed on X-Client-IP) is applied in Phase 3 on the
    // order endpoints (PLAN.md §7.2); the module is wired now.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    DbModule,
    EventsModule,
    HealthModule,
    UsersModule,
    AdminModule,
  ],
  controllers: [PingController],
  providers: [
    // Order matters: internal key first, then actor construction.
    { provide: APP_GUARD, useClass: InternalKeyGuard },
    { provide: APP_GUARD, useClass: ActorGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
