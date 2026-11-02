import { Module } from '@nestjs/common';

import { GradeViewController } from './grade-view.controller';
import { GradeViewService } from './grade-view.service';

@Module({ controllers: [GradeViewController], providers: [GradeViewService] })
export class GradeViewModule {}
