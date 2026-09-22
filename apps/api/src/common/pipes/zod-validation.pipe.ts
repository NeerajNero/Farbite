import { ArgumentMetadata, HttpStatus, Injectable, PipeTransform } from '@nestjs/common';
import { ZodType } from 'zod';
import { AppException } from '../errors/app.exception.js';

// Usage on a route: @Body(new ZodValidationPipe(createOrderSchema)) body: CreateOrderDto
// Schemas live in @farbite/shared so web and api validate the same shapes.
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodType) {}

  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new AppException(
        'VALIDATION_ERROR',
        'Invalid request',
        HttpStatus.BAD_REQUEST,
        result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      );
    }
    return result.data;
  }
}
