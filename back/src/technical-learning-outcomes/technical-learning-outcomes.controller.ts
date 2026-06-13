import { Controller } from '@nestjs/common';

import { TechnicalLearningOutcomesService } from './technical-learning-outcomes.service';

@Controller('technical-learning-outcomes')
export class TechnicalLearningOutcomesController {
  constructor(
    private readonly technicalLearningOutcomesService: TechnicalLearningOutcomesService,
  ) {}
}
