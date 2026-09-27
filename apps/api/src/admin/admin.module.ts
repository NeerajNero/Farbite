import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { DeliveryPointsController } from './delivery-points/delivery-points.controller.js';
import { DeliveryPointsRepository } from './delivery-points/delivery-points.repository.js';
import { DeliveryPointsService } from './delivery-points/delivery-points.service.js';
import { DropsController } from './drops/drops.controller.js';
import { DropsRepository } from './drops/drops.repository.js';
import { DropsService } from './drops/drops.service.js';
import { RestaurantsController } from './restaurants/restaurants.controller.js';
import { RestaurantsRepository } from './restaurants/restaurants.repository.js';
import { RestaurantsService } from './restaurants/restaurants.service.js';
import { SettingsController } from './settings/settings.controller.js';

// Every controller here is behind AdminGuard (PLAN.md §10 "Admin").
// UsersModule is imported so AdminGuard can check users.is_admin.
@Module({
  imports: [UsersModule],
  controllers: [
    RestaurantsController,
    DeliveryPointsController,
    DropsController,
    SettingsController,
  ],
  providers: [
    RestaurantsService,
    RestaurantsRepository,
    DeliveryPointsService,
    DeliveryPointsRepository,
    DropsService,
    DropsRepository,
  ],
})
export class AdminModule {}
