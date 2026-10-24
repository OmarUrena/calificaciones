import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { AuditService } from '../audit/audit.service';
import { PermissionsService } from '../common/services/permissions.service';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { rethrowKnownPrismaError } from '../common/utils/prisma-error.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeacherAssignmentDto } from './dto/create-teacher-assignment.dto';
import { UpdateTeacherAssignmentDto } from './dto/update-teacher-assignment.dto';

@Injectable()
export class TeacherAssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionsService: PermissionsService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateTeacherAssignmentDto, user: AuthenticatedUser) {
    this.permissionsService.ensureCanAccessSchool(user, dto.schoolId);
    await this.validateAssignmentRelations(dto);
    await this.ensureAssignmentIsUnique(dto);

    try {
      const assignment = await this.prisma.teacherAssignment.create({
        data: {
          ...dto,
          createdBy: user.id,
          updatedBy: user.id,
        },
      });
      await this.auditService.logCreate({
        schoolId: assignment.schoolId,
        userId: user.id,
        entity: 'TeacherAssignment',
        entityId: assignment.id,
        newValue: assignment,
      });

      return assignment;
    } catch (error) {
      rethrowKnownPrismaError(
        error,
        'Ese curso ya tiene esa asignatura registrada en el año escolar seleccionado.',
      );
    }
  }

  findAll(user: AuthenticatedUser) {
    return this.prisma.teacherAssignment.findMany({
      where:
        user.role === UserRole.SUPER_ADMIN
          ? undefined
          : {
              schoolId: user.schoolId ?? '',
              ...(user.role === UserRole.TEACHER ? { teacherId: user.teacherId ?? '' } : {}),
            },
      include: {
        teacher: true,
        subject: true,
        course: true,
        schoolYear: true,
      },
      orderBy: [{ schoolYearId: 'desc' }, { courseId: 'asc' }],
    });
  }

  async update(id: string, dto: UpdateTeacherAssignmentDto, user: AuthenticatedUser) {
    const current = await this.findAccessibleById(id, user);
    const next = {
      schoolId: current.schoolId,
      schoolYearId: dto.schoolYearId ?? current.schoolYearId,
      teacherId: dto.teacherId ?? current.teacherId,
      subjectId: dto.subjectId ?? current.subjectId,
      courseId: dto.courseId ?? current.courseId,
    };

    await this.validateAssignmentRelations(next);
    await this.ensureAssignmentIsUnique(next, id);

    try {
      const assignment = await this.prisma.teacherAssignment.update({
        where: { id },
        data: {
          ...dto,
          updatedBy: user.id,
        },
      });
      await this.auditService.logUpdate({
        schoolId: assignment.schoolId,
        userId: user.id,
        entity: 'TeacherAssignment',
        entityId: assignment.id,
        oldValue: current,
        newValue: assignment,
      });

      return assignment;
    } catch (error) {
      rethrowKnownPrismaError(
        error,
        'Ese curso ya tiene esa asignatura registrada en el año escolar seleccionado.',
      );
    }
  }

  async remove(id: string, user: AuthenticatedUser) {
    const oldValue = await this.findAccessibleById(id, user);

    const assignment = await this.prisma.teacherAssignment.update({
      where: { id },
      data: {
        isActive: false,
        updatedBy: user.id,
      },
    });
    await this.auditService.logDelete({
      schoolId: assignment.schoolId,
      userId: user.id,
      entity: 'TeacherAssignment',
      entityId: assignment.id,
      oldValue,
    });

    return assignment;
  }

  private async findAccessibleById(id: string, user: AuthenticatedUser) {
    const assignment = await this.prisma.teacherAssignment.findUnique({ where: { id } });

    if (!assignment) {
      throw new NotFoundException('Teacher assignment not found.');
    }

    this.permissionsService.ensureCanAccessSchool(user, assignment.schoolId);
    return assignment;
  }

  private async ensureAssignmentIsUnique(
    params: {
      schoolId: string;
      schoolYearId: string;
      subjectId: string;
      courseId: string;
    },
    currentId?: string,
  ): Promise<void> {
    const existing = await this.prisma.teacherAssignment.findFirst({
      where: {
        schoolId: params.schoolId,
        schoolYearId: params.schoolYearId,
        courseId: params.courseId,
        subjectId: params.subjectId,
        ...(currentId ? { NOT: { id: currentId } } : {}),
      },
      select: { isActive: true },
    });

    if (!existing) return;

    if (existing.isActive) {
      throw new ConflictException(
        'Ese curso ya tiene esa asignatura asignada en el año escolar seleccionado.',
      );
    }

    throw new ConflictException(
      'Ya existe una asignación inactiva para ese curso y asignatura. Reactívala y selecciona el nuevo maestro.',
    );
  }

  private async validateAssignmentRelations(params: {
    schoolId: string;
    schoolYearId: string;
    teacherId: string;
    subjectId: string;
    courseId: string;
  }): Promise<void> {
    const [schoolYear, teacher, subject, course] = await Promise.all([
      this.prisma.schoolYear.findFirst({
        where: { id: params.schoolYearId, schoolId: params.schoolId },
        select: { id: true },
      }),
      this.prisma.teacher.findFirst({
        where: { id: params.teacherId, schoolId: params.schoolId },
        select: { id: true },
      }),
      this.prisma.subject.findFirst({
        where: { id: params.subjectId, schoolId: params.schoolId },
        select: { id: true },
      }),
      this.prisma.course.findFirst({
        where: {
          id: params.courseId,
          schoolId: params.schoolId,
          schoolYearId: params.schoolYearId,
        },
        select: { id: true },
      }),
    ]);

    if (!schoolYear) {
      throw new BadRequestException('School year must belong to the same school.');
    }

    if (!teacher) {
      throw new BadRequestException('Teacher must belong to the same school.');
    }

    if (!subject) {
      throw new BadRequestException('Subject must belong to the same school.');
    }

    if (!course) {
      throw new BadRequestException('Course must belong to the same school and school year.');
    }
  }
}
