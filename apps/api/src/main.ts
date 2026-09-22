import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Everything under /v1 except the public health check (PLAN.md §10).
  app.setGlobalPrefix('v1', { exclude: ['health'] });

  const config = app.get(ConfigService);
  const port = config.getOrThrow<number>('PORT');
  await app.listen(port);
  new Logger('Bootstrap').log(`API listening on http://localhost:${port}`);
}
await bootstrap();
