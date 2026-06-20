import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { TechnicalGradesService } from './technical-grades.service';
import { BulkTechnicalGradesDto } from './dto/bulk-technical-grades.dto';
import { CreateTechnicalGradeDto } from './dto/create-technical-grade.dto';
import { UpdateTechnicalGradeDto } from './dto/update-technical-grade.dto';

@Controller('technical-grades')
export class TechnicalGradesController {
  constructor(private readonly technicalGradesService: TechnicalGradesService) {}

  @Get('course/:courseId/subject/:subjectId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER)
  findByCourseAndSubject(
    @Param('courseId') courseId: string,
    @Param('subjectId') subjectId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.technicalGradesService.findByCourseAndSubject(courseId, subjectId, user);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER)
  create(@Body() dto: CreateTechnicalGradeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.technicalGradesService.create(dto, user);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTechnicalGradeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.technicalGradesService.update(id, dto, user);
  }

  @Post('bulk')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER)
  bulk(@Body() dto: BulkTechnicalGradesDto, @CurrentUser() user: AuthenticatedUser) {
    return this.technicalGradesService.bulk(dto, user);
  }

  @Post('recalculate/student/:studentId/subject/:subjectId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER)
  recalculate(
    @Param('studentId') studentId: string,
    @Param('subjectId') subjectId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.technicalGradesService.recalculate(studentId, subjectId, user);
  }
}
