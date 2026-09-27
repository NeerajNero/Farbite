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
  createDeliveryPointBodySchema,
  updateDeliveryPointBodySchema,
  type CreateDeliveryPointBody,
  type DeliveryPoint,
  type UpdateDeliveryPointBody,
} from '@farbite/shared';
import { AdminGuard } from '../../common/guards/admin.guard.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { DeliveryPointsService } from './delivery-points.service.js';

@Controller('admin/delivery-points')
@UseGuards(AdminGuard)
export class DeliveryPointsController {
  constructor(private readonly service: DeliveryPointsService) {}

  @Get()
  list(): Promise<DeliveryPoint[]> {
    return this.service.list();
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(createDeliveryPointBodySchema))
    body: CreateDeliveryPointBody,
  ): Promise<DeliveryPoint> {
    return this.service.create(body);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateDeliveryPointBodySchema))
    body: UpdateDeliveryPointBody,
  ): Promise<DeliveryPoint> {
    return this.service.update(id, body);
  }
}
