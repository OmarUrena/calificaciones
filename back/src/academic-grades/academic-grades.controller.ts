import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { AcademicGradesService } from './academic-grades.service';
import { AcademicFinalEvaluationDto } from './dto/academic-final-evaluation.dto';
import { BulkAcademicGradesDto } from './dto/bulk-academic-grades.dto';
import { CreateAcademicGradeDto } from './dto/create-academic-grade.dto';
import { UpdateAcademicGradeDto } from './dto/update-academic-grade.dto';

@Controller('academic-grades')
export class AcademicGradesController {
  constructor(private readonly academicGradesService: AcademicGradesService) {}

  @Get('course/:courseId/subject/:subjectId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER)
  findByCourseAndSubject(
    @Param('courseId') courseId: string,
    @Param('subjectId') subjectId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.academicGradesService.findByCourseAndSubject(courseId, subjectId, user);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER)
  create(@Body() dto: CreateAcademicGradeDto, @CurrentUser() user: AuthenticatedUser) {
    return this.academicGradesService.create(dto, user);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAcademicGradeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.academicGradesService.update(id, dto, user);
  }

  @Post('bulk')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER)
  bulk(@Body() dto: BulkAcademicGradesDto, @CurrentUser() user: AuthenticatedUser) {
    return this.academicGradesService.bulk(dto, user);
  }

  @Post('recalculate/student/:studentId/subject/:subjectId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER)
  recalculate(
    @Param('studentId') studentId: string,
    @Param('subjectId') subjectId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.academicGradesService.recalculate(studentId, subjectId, user);
  }

  @Post('final-evaluations')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER)
  finalEvaluations(
    @Body() dto: AcademicFinalEvaluationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.academicGradesService.finalEvaluations(dto, user);
  }

  @Post('evaluate-special-right/:studentId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  evaluateSpecialRight(
    @Param('studentId') studentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.academicGradesService.evaluateSpecialRight(studentId, user);
  }
}
