import { Controller } from '@nestjs/common';

import { TeacherAssignmentsService } from './teacher-assignments.service';

@Controller('teacher-assignments')
export class TeacherAssignmentsController {
  constructor(private readonly teacherAssignmentsService: TeacherAssignmentsService) {}
}
