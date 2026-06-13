import { registerAs } from '@nestjs/config';

export default registerAs('supabase', () => ({
  url: process.env.SUPABASE_URL,
  anonKey: process.env.SUPABASE_ANON_KEY,
  serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  schoolLogosBucket: process.env.SUPABASE_STORAGE_BUCKET_SCHOOL_LOGOS ?? 'school-logos',
}));
