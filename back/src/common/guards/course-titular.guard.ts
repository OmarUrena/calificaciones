import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { REQUIRE_COURSE_TITULAR_KEY } from '../decorators/require-course-titular.decorator';
import { PermissionsService } from '../services/permissions.service';
import { RequestWithUser } from '../types/request-with-user.type';
import { readRequestValue } from '../utils/request-value.util';

@Injectable()
export class CourseTitularGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const source = this.reflector.getAllAndOverride<string>(REQUIRE_COURSE_TITULAR_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!source) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    const courseId = readRequestValue(source, request);

    if (!user || typeof courseId !== 'string') {
      return true;
    }

    await this.permissionsService.ensureTeacherCanGenerateCourseReport({ user, courseId });
    return true;
  }
}
