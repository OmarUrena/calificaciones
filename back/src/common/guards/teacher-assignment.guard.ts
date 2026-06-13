import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import {
  REQUIRE_TEACHER_ASSIGNMENT_KEY,
  TeacherAssignmentSources,
} from '../decorators/require-teacher-assignment.decorator';
import { PermissionsService } from '../services/permissions.service';
import { RequestWithUser } from '../types/request-with-user.type';
import { readRequestValue } from '../utils/request-value.util';

@Injectable()
export class TeacherAssignmentGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const sources = this.reflector.getAllAndOverride<TeacherAssignmentSources>(
      REQUIRE_TEACHER_ASSIGNMENT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!sources) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;

    if (!user) {
      return true;
    }

    const courseId = readRequestValue(sources.courseId, request);
    const subjectId = readRequestValue(sources.subjectId, request);
    const schoolYearId = sources.schoolYearId
      ? readRequestValue(sources.schoolYearId, request)
      : undefined;

    if (typeof courseId !== 'string' || typeof subjectId !== 'string' || !user.schoolId) {
      return true;
    }

    await this.permissionsService.ensureTeacherCanManageSubject({
      user,
      schoolId: user.schoolId,
      courseId,
      subjectId,
      schoolYearId: typeof schoolYearId === 'string' ? schoolYearId : undefined,
    });

    return true;
  }
}
