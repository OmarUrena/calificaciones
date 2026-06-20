import { Body, Controller, Get, Param, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { ImportGradesDto } from './dto/import-grades.dto';
import { ImportStudentsDto } from './dto/import-students.dto';
import { UploadedExcelFile } from './types/uploaded-excel-file.type';
import { ImportsService } from './imports.service';

@Controller('imports')
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Post('students')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  importStudents(
    @UploadedFile() file: UploadedExcelFile,
    @Body() dto: ImportStudentsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.importsService.importStudents(file, dto, user);
  }

  @Post('academic-grades')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER)
  @UseInterceptors(FileInterceptor('file'))
  importAcademicGrades(
    @UploadedFile() file: UploadedExcelFile,
    @Body() dto: ImportGradesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.importsService.importAcademicGrades(file, dto, user);
  }

  @Post('technical-grades')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER)
  @UseInterceptors(FileInterceptor('file'))
  importTechnicalGrades(
    @UploadedFile() file: UploadedExcelFile,
    @Body() dto: ImportGradesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.importsService.importTechnicalGrades(file, dto, user);
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER)
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.importsService.findAll(user);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER)
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.importsService.findOne(id, user);
  }
}
