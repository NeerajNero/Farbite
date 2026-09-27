import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { upsertUserBodySchema, type UpsertUserResponse } from '@farbite/shared';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe.js';
import { UsersService } from './users.service.js';

type UpsertUserDto = z.output<typeof upsertUserBodySchema>;

// Called by Auth.js from the Next.js server on sign-in (PLAN.md §7.3). The
// internal key is the only auth: there is no actor yet at this point.
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('upsert')
  @HttpCode(HttpStatus.OK)
  upsert(
    @Body(new ZodValidationPipe(upsertUserBodySchema)) body: UpsertUserDto,
  ): Promise<UpsertUserResponse> {
    return this.usersService.upsertOnSignIn(body);
  }
}
