import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  url: process.env.DATABASE_URL,
  connectOnBoot: process.env.DATABASE_CONNECT_ON_BOOT === 'true',
}));
