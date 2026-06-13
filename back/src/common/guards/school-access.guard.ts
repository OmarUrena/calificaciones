import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

import { PermissionsService } from '../services/permissions.service';
import { RequestWithUser } from '../types/request-with-user.type';

@Injectable()
export class SchoolAccessGuard implements CanActivate {
  constructor(private readonly permissionsService: PermissionsService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    const schoolId = this.findSchoolId(request);

    if (!user || !schoolId) {
      return true;
    }

    this.permissionsService.ensureCanAccessSchool(user, schoolId);
    return true;
  }

  private findSchoolId(request: RequestWithUser): string | undefined {
    const paramsSchoolId = request.params?.schoolId;
    const querySchoolId = request.query?.schoolId;
    const bodySchoolId = this.getBodySchoolId(request.body);

    return this.asString(paramsSchoolId) ?? this.asString(querySchoolId) ?? bodySchoolId;
  }

  private getBodySchoolId(body: unknown): string | undefined {
    if (!body || typeof body !== 'object') {
      return undefined;
    }

    return this.asString((body as Record<string, unknown>).schoolId);
  }

  private asString(value: unknown): string | undefined {
    return typeof value === 'string' ? value : undefined;
  }
}
