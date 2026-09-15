import { Controller, Get, Param, Query, StreamableFile } from '@nestjs/common';
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
  async generateStudentReportCard(
    @Param('studentId') studentId: string,
    @Query() query: ReportCardQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const pdf = await this.reportsService.generateStudentReportCard(studentId, query.period, user);
    return new StreamableFile(pdf, {
      type: 'application/pdf',
      disposition: `attachment; filename="boletin-estudiante-${studentId}.pdf"`,
    });
  }

  @Get('courses/:courseId/report-cards')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER)
  async generateCourseReportCards(
    @Param('courseId') courseId: string,
    @Query() query: ReportCardQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const pdf = await this.reportsService.generateCourseReportCards(courseId, query.period, user);
    return new StreamableFile(pdf, {
      type: 'application/pdf',
      disposition: `attachment; filename="boletines-curso-${courseId}.pdf"`,
    });
  }
}
