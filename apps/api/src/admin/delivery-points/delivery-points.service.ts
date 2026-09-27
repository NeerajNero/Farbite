import { HttpStatus, Injectable } from '@nestjs/common';
import type {
  CreateDeliveryPointBody,
  DeliveryPoint,
  UpdateDeliveryPointBody,
} from '@farbite/shared';
import { AppException } from '../../common/errors/app.exception.js';
import {
  DeliveryPointsRepository,
  type DeliveryPointRow,
} from './delivery-points.repository.js';

export function toDeliveryPointDto(row: DeliveryPointRow): DeliveryPoint {
  return {
    id: row.id,
    name: row.name,
    area: row.area,
    landmark: row.landmark,
    handover_notes: row.handoverNotes,
    sort_order: row.sortOrder,
    is_active: row.isActive,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt?.toISOString() ?? null,
  };
}

@Injectable()
export class DeliveryPointsService {
  constructor(private readonly repo: DeliveryPointsRepository) {}

  async list(): Promise<DeliveryPoint[]> {
    return (await this.repo.list()).map(toDeliveryPointDto);
  }

  async create(body: CreateDeliveryPointBody): Promise<DeliveryPoint> {
    const row = await this.repo.create({
      name: body.name,
      area: body.area ?? null,
      landmark: body.landmark ?? null,
      handoverNotes: body.handover_notes ?? null,
      sortOrder: body.sort_order ?? 0,
    });
    return toDeliveryPointDto(row);
  }

  async update(
    id: string,
    body: UpdateDeliveryPointBody,
  ): Promise<DeliveryPoint> {
    const row = await this.repo.update(id, {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.area !== undefined ? { area: body.area } : {}),
      ...(body.landmark !== undefined ? { landmark: body.landmark } : {}),
      ...(body.handover_notes !== undefined
        ? { handoverNotes: body.handover_notes }
        : {}),
      ...(body.sort_order !== undefined ? { sortOrder: body.sort_order } : {}),
      ...(body.is_active !== undefined ? { isActive: body.is_active } : {}),
    });
    if (!row)
      throw new AppException(
        'NOT_FOUND',
        'Delivery point not found',
        HttpStatus.NOT_FOUND,
      );
    return toDeliveryPointDto(row);
  }
}
