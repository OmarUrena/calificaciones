import { registerAs } from '@nestjs/config';

export default registerAs('reports', () => ({
  academicBlockTitles: [
    process.env.ACADEMIC_BLOCK_1_TITLE?.trim() || 'Comunicativa',
    process.env.ACADEMIC_BLOCK_2_TITLE?.trim() ||
      'Pensamiento Lógico, Creativo y Crítico - Resolución de Problemas',
    process.env.ACADEMIC_BLOCK_3_TITLE?.trim() ||
      'Científica y Tecnológica - Ambiental y de la Salud',
    process.env.ACADEMIC_BLOCK_4_TITLE?.trim() ||
      'Ética y Ciudadana - Desarrollo Personal y Espiritual',
  ],
}));
