import { Global, Module } from '@nestjs/common';
import { EventsRepository } from './events.repository.js';

@Global()
@Module({
  providers: [EventsRepository],
  exports: [EventsRepository],
})
export class EventsModule {}
