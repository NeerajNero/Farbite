import { HttpStatus, Injectable } from '@nestjs/common';
import type {
  CreateRestaurantBody,
  Restaurant,
  UpdateRestaurantBody,
} from '@farbite/shared';
import { AppException } from '../../common/errors/app.exception.js';
import {
  RestaurantsRepository,
  type RestaurantRow,
} from './restaurants.repository.js';

export function toRestaurantDto(row: RestaurantRow): Restaurant {
  return {
    id: row.id,
    name: row.name,
    area: row.area,
    address: row.address,
    phone: row.phone,
    notes: row.notes,
    is_active: row.isActive,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt?.toISOString() ?? null,
  };
}

@Injectable()
export class RestaurantsService {
  constructor(private readonly repo: RestaurantsRepository) {}

  async list(): Promise<Restaurant[]> {
    return (await this.repo.list()).map(toRestaurantDto);
  }

  async create(body: CreateRestaurantBody): Promise<Restaurant> {
    const row = await this.repo.create({
      name: body.name,
      area: body.area ?? null,
      address: body.address ?? null,
      phone: body.phone ?? null,
      notes: body.notes ?? null,
    });
    return toRestaurantDto(row);
  }

  async update(id: string, body: UpdateRestaurantBody): Promise<Restaurant> {
    const row = await this.repo.update(id, {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.area !== undefined ? { area: body.area } : {}),
      ...(body.address !== undefined ? { address: body.address } : {}),
      ...(body.phone !== undefined ? { phone: body.phone } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
      ...(body.is_active !== undefined ? { isActive: body.is_active } : {}),
    });
    if (!row)
      throw new AppException(
        'NOT_FOUND',
        'Restaurant not found',
        HttpStatus.NOT_FOUND,
      );
    return toRestaurantDto(row);
  }
}
