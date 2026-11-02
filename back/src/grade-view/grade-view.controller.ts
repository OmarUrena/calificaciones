import { Controller, Get, Param } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { GradeViewService } from './grade-view.service';

@Controller('grade-view')
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER)
export class GradeViewController {
  constructor(private readonly service: GradeViewService) {}

  @Get('courses')
  findCourses(@CurrentUser() user: AuthenticatedUser) {
    return this.service.findCourses(user);
  }

  @Get('course/:courseId/subjects')
  findSubjects(@Param('courseId') courseId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.findSubjects(courseId, user);
  }

  @Get('course/:courseId/subject/:subjectId')
  findRegister(
    @Param('courseId') courseId: string,
    @Param('subjectId') subjectId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.findRegister(courseId, subjectId, user);
  }
}
