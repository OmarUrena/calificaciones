import { SetMetadata } from '@nestjs/common';

export const REQUIRE_TEACHER_ASSIGNMENT_KEY = 'requireTeacherAssignment';

export type TeacherAssignmentSources = {
  courseId: string;
  subjectId: string;
  schoolYearId?: string;
};

export const RequireTeacherAssignment = (
  sources: TeacherAssignmentSources = {
    courseId: 'params.courseId',
    subjectId: 'params.subjectId',
  },
): MethodDecorator & ClassDecorator => SetMetadata(REQUIRE_TEACHER_ASSIGNMENT_KEY, sources);
