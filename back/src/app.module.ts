import { Module } from '@nestjs/common';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AcademicGradesModule } from './academic-grades/academic-grades.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CommonModule } from './common/common.module';
import { ConfigurationModule } from './config/configuration.module';
import { CoursesModule } from './courses/courses.module';
import { ImportsModule } from './imports/imports.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReportsModule } from './reports/reports.module';
import { SchoolYearsModule } from './school-years/school-years.module';
import { SchoolsModule } from './schools/schools.module';
import { StudentsModule } from './students/students.module';
import { SubjectsModule } from './subjects/subjects.module';
import { TeacherAssignmentsModule } from './teacher-assignments/teacher-assignments.module';
import { TeachersModule } from './teachers/teachers.module';
import { TechnicalGradesModule } from './technical-grades/technical-grades.module';
import { TechnicalLearningOutcomesModule } from './technical-learning-outcomes/technical-learning-outcomes.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigurationModule,
    PrismaModule,
    CommonModule,
    AuthModule,
    SchoolsModule,
    SchoolYearsModule,
    UsersModule,
    TeachersModule,
    CoursesModule,
    StudentsModule,
    SubjectsModule,
    TeacherAssignmentsModule,
    AcademicGradesModule,
    TechnicalLearningOutcomesModule,
    TechnicalGradesModule,
    ImportsModule,
    ReportsModule,
    AuditModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
