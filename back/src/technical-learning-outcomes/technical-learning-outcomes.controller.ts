import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { CreateTechnicalLearningOutcomeDto } from './dto/create-technical-learning-outcome.dto';
import { UpdateTechnicalLearningOutcomeDto } from './dto/update-technical-learning-outcome.dto';
import { TechnicalLearningOutcomesService } from './technical-learning-outcomes.service';

@Controller('technical-learning-outcomes')
export class TechnicalLearningOutcomesController {
  constructor(
    private readonly technicalLearningOutcomesService: TechnicalLearningOutcomesService,
  ) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  create(@Body() dto: CreateTechnicalLearningOutcomeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.technicalLearningOutcomesService.create(dto, user);
  }

  @Get('subject/:subjectId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER)
  findBySubject(@Param('subjectId') subjectId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.technicalLearningOutcomesService.findBySubject(subjectId, user);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTechnicalLearningOutcomeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.technicalLearningOutcomesService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.technicalLearningOutcomesService.remove(id, user);
  }
}
