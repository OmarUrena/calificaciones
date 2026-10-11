const fs = require('node:fs');
const path = require('node:path');

function publicSupabaseUrl() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) return process.env.NEXT_PUBLIC_SUPABASE_URL;
  const envPath = path.join(__dirname, '../../front/.env.local');
  const env = fs.readFileSync(envPath, 'utf8');
  const value = env.match(/^NEXT_PUBLIC_SUPABASE_URL\s*=\s*(.+)$/m)?.[1]?.trim();
  if (!value) throw new Error('Falta NEXT_PUBLIC_SUPABASE_URL para las pruebas de interfaz.');
  return value.replace(/^["']|["']$/g, '');
}

async function seedUiSession(context) {
  const projectRef = new URL(publicSupabaseUrl()).hostname.split('.')[0];
  const key = `sb-${projectRef}-auth-token`;
  const session = {
    access_token: 'test-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: 'test-refresh-token',
    user: { id: 'test-user', aud: 'authenticated', role: 'authenticated', email: 'test@example.test' },
  };
  await context.addInitScript(({ key, session }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(session));
    if (!localStorage.getItem('califapp_last_activity')) {
      localStorage.setItem('califapp_last_activity', String(Date.now()));
    }
  }, { key, session });
}

module.exports = { seedUiSession };
