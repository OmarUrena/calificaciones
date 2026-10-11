import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { AcademicPeriodControlsService } from './academic-period-controls.service';
import { SetAcademicPeriodDto } from './dto/set-academic-period.dto';

@Controller('academic-period-controls')
export class AcademicPeriodControlsController {
  constructor(private readonly service: AcademicPeriodControlsService) {}

  @Get(':schoolYearId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER)
  findForYear(@Param('schoolYearId') schoolYearId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.service.findForYear(schoolYearId, user);
  }

  @Patch(':schoolYearId')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  setOpen(
    @Param('schoolYearId') schoolYearId: string,
    @Body() dto: SetAcademicPeriodDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.service.setOpen(schoolYearId, dto.field, dto.isOpen, user);
  }
}
