import { Module } from '@nestjs/common';

import { TechnicalLearningOutcomesController } from './technical-learning-outcomes.controller';
import { TechnicalLearningOutcomesService } from './technical-learning-outcomes.service';

@Module({
  controllers: [TechnicalLearningOutcomesController],
  providers: [TechnicalLearningOutcomesService],
  exports: [TechnicalLearningOutcomesService],
})
export class TechnicalLearningOutcomesModule {}
