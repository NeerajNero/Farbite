import { Global, Module } from '@nestjs/common';
import { DbService } from './db.service.js';

// Global so every repository can inject DbService without re-importing.
@Global()
@Module({
  providers: [DbService],
  exports: [DbService],
})
export class DbModule {}
