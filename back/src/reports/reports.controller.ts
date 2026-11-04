import { Controller, Get, Param, Query, StreamableFile } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { ReportCardQueryDto } from './dto/report-card-query.dto';
import { ReportsService } from './reports.service';
import { SubjectGradeReportQueryDto } from './dto/subject-grade-report-query.dto';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('assignments/:assignmentId/grades')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER)
  async generateSubjectGradeReport(
    @Param('assignmentId') assignmentId: string,
    @Query() query: SubjectGradeReportQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const { buffer, filename } = await this.reportsService.generateSubjectGradeReport(
      assignmentId,
      query.period,
      user,
      query,
    );
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="${filename}"`,
    });
  }

  @Get('assignments/:assignmentId/grade-options')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.TEACHER)
  subjectGradeReportOptions(
    @Param('assignmentId') assignmentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.reportsService.subjectGradeReportOptions(assignmentId, user);
  }

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
