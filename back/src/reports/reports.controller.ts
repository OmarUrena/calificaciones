import { Controller, Get, Header, Param, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { UserRole } from '@prisma/client';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { ReportCardQueryDto } from './dto/report-card-query.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('students/:studentId/report-card')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER)
  @Header('Content-Type', 'application/pdf')
  async generateStudentReportCard(
    @Param('studentId') studentId: string,
    @Query() query: ReportCardQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    const pdf = await this.reportsService.generateStudentReportCard(studentId, query.period, user);
    response.setHeader(
      'Content-Disposition',
      `inline; filename="boletin-estudiante-${studentId}.pdf"`,
    );

    return pdf;
  }

  @Get('courses/:courseId/report-cards')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER)
  @Header('Content-Type', 'application/pdf')
  async generateCourseReportCards(
    @Param('courseId') courseId: string,
    @Query() query: ReportCardQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ) {
    const pdf = await this.reportsService.generateCourseReportCards(courseId, query.period, user);
    response.setHeader('Content-Disposition', `inline; filename="boletines-curso-${courseId}.pdf"`);

    return pdf;
  }
}
