import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { CreateSchoolYearDto } from './dto/create-school-year.dto';
import { UpdateSchoolYearDto } from './dto/update-school-year.dto';
import { SchoolYearsService } from './school-years.service';

@Controller('school-years')
export class SchoolYearsController {
  constructor(private readonly schoolYearsService: SchoolYearsService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  create(@Body() dto: CreateSchoolYearDto, @CurrentUser() user: AuthenticatedUser) {
    return this.schoolYearsService.create(dto, user);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.schoolYearsService.findAll(user);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSchoolYearDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.schoolYearsService.update(id, dto, user);
  }

  @Patch(':id/activate')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  activate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.schoolYearsService.activate(id, user);
  }
}
