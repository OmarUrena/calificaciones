import { SetMetadata } from '@nestjs/common';

export const REQUIRE_COURSE_TITULAR_KEY = 'requireCourseTitular';

export const RequireCourseTitular = (
  courseIdSource: string = 'params.courseId',
): MethodDecorator & ClassDecorator => SetMetadata(REQUIRE_COURSE_TITULAR_KEY, courseIdSource);
