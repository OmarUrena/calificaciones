import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { CreateTeacherAssignmentDto } from './dto/create-teacher-assignment.dto';
import { UpdateTeacherAssignmentDto } from './dto/update-teacher-assignment.dto';
import { TeacherAssignmentsService } from './teacher-assignments.service';

@Controller('teacher-assignments')
export class TeacherAssignmentsController {
  constructor(private readonly teacherAssignmentsService: TeacherAssignmentsService) {}

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  create(@Body() dto: CreateTeacherAssignmentDto, @CurrentUser() user: AuthenticatedUser) {
    return this.teacherAssignmentsService.create(dto, user);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER)
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.teacherAssignmentsService.findAll(user);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTeacherAssignmentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.teacherAssignmentsService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.teacherAssignmentsService.remove(id, user);
  }
}
