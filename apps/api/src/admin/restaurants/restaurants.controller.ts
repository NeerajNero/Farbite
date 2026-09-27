import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  createRestaurantBodySchema,
  updateRestaurantBodySchema,
  type CreateRestaurantBody,
  type Restaurant,
  type UpdateRestaurantBody,
} from '@farbite/shared';
import { AdminGuard } from '../../common/guards/admin.guard.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { RestaurantsService } from './restaurants.service.js';

@Controller('admin/restaurants')
@UseGuards(AdminGuard)
export class RestaurantsController {
  constructor(private readonly service: RestaurantsService) {}

  @Get()
  list(): Promise<Restaurant[]> {
    return this.service.list();
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(createRestaurantBodySchema))
    body: CreateRestaurantBody,
  ): Promise<Restaurant> {
    return this.service.create(body);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateRestaurantBodySchema))
    body: UpdateRestaurantBody,
  ): Promise<Restaurant> {
    return this.service.update(id, body);
  }
}
