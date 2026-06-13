import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';

import { PermissionsService } from '../common/services/permissions.service';
import { AuthenticatedUser } from '../common/types/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';

@Injectable()
export class CoursesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly permissionsService: PermissionsService,
  ) {}

  async create(dto: CreateCourseDto, user: AuthenticatedUser) {
    this.permissionsService.ensureCanAccessSchool(user, dto.schoolId);
    await this.validateSchoolYear(dto.schoolId, dto.schoolYearId);
    await this.validateTitular(dto.schoolId, dto.titularId);

    return this.prisma.course.create({
      data: {
        ...dto,
        createdBy: user.id,
        updatedBy: user.id,
      },
    });
  }

  findAll(user: AuthenticatedUser) {
    return this.prisma.course.findMany({
      where: user.role === UserRole.SUPER_ADMIN ? undefined : { schoolId: user.schoolId ?? '' },
      include: { schoolYear: true, titular: true },
      orderBy: [{ grade: 'asc' }, { section: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const course = await this.prisma.course.findUnique({
      where: { id },
      include: { schoolYear: true, titular: true },
    });

    if (!course) {
      throw new NotFoundException('Course not found.');
    }

    this.permissionsService.ensureCanAccessSchool(user, course.schoolId);
    return course;
  }

  async update(id: string, dto: UpdateCourseDto, user: AuthenticatedUser) {
    const course = await this.findOne(id, user);

    if (dto.schoolYearId) {
      await this.validateSchoolYear(course.schoolId, dto.schoolYearId);
    }

    await this.validateTitular(course.schoolId, dto.titularId);

    return this.prisma.course.update({
      where: { id },
      data: {
        ...dto,
        updatedBy: user.id,
      },
    });
  }

  async remove(id: string, user: AuthenticatedUser) {
    await this.findOne(id, user);
    return this.prisma.course.delete({ where: { id } });
  }

  private async validateSchoolYear(schoolId: string, schoolYearId: string): Promise<void> {
    const schoolYear = await this.prisma.schoolYear.findFirst({
      where: { id: schoolYearId, schoolId },
      select: { id: true },
    });

    if (!schoolYear) {
      throw new BadRequestException('School year must belong to the same school.');
    }
  }

  private async validateTitular(schoolId: string, titularId?: string): Promise<void> {
    if (!titularId) {
      return;
    }

    const titular = await this.prisma.teacher.findFirst({
      where: { id: titularId, schoolId },
      select: { id: true },
    });

    if (!titular) {
      throw new BadRequestException('Titular teacher must belong to the same school.');
    }
  }
}
