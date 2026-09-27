import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  createDropBodySchema,
  transitionDropBodySchema,
  updateDropBodySchema,
  type CreateDropBody,
  type Drop,
  type DropDashboard,
  type DropListItem,
  type TransitionDropBody,
  type UpdateDropBody,
} from '@farbite/shared';
import type { RequestWithActor } from '../../common/guards/actor.guard.js';
import { AdminGuard } from '../../common/guards/admin.guard.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { DropsService } from './drops.service.js';

@Controller('admin/drops')
@UseGuards(AdminGuard)
export class DropsController {
  constructor(private readonly service: DropsService) {}

  @Get()
  list(): Promise<DropListItem[]> {
    return this.service.list();
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(createDropBodySchema)) body: CreateDropBody,
  ): Promise<Drop> {
    return this.service.create(body);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string): Promise<Drop> {
    return this.service.getById(id);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateDropBodySchema)) body: UpdateDropBody,
  ): Promise<Drop> {
    return this.service.update(id, body);
  }

  @Post(':id/duplicate')
  duplicate(@Param('id', ParseUUIDPipe) id: string): Promise<Drop> {
    return this.service.duplicate(id);
  }

  @Post(':id/transition')
  @HttpCode(HttpStatus.OK)
  transition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(transitionDropBodySchema))
    body: TransitionDropBody,
    @Req() req: RequestWithActor,
  ): Promise<Drop> {
    return this.service.transition(id, body, req.actor);
  }

  @Get(':id/dashboard')
  dashboard(@Param('id', ParseUUIDPipe) id: string): Promise<DropDashboard> {
    return this.service.dashboard(id);
  }
}
