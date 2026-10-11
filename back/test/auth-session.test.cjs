// Run after npm run build. No real Supabase or database requests.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { AuthService } = require('../dist/src/auth/auth.service');

function service() {
  return new AuthService({
    getOrThrow: (key) => key === 'supabase.url' ? 'https://auth.example.test' : 'anon-key',
  }, {
    user: {
      findFirst: async () => ({
        id: 'user-1', email: 'teacher@example.test', fullName: 'Teacher',
        role: 'TEACHER', schoolId: 'school-1', teacherId: 'teacher-1',
        isActive: true, school: { id: 'school-1', name: 'School', isActive: true },
      }),
    },
    schoolYear: { findFirst: async () => null },
  });
}

test('an expired token is unauthorized, while a Supabase outage is temporary', async () => {
  const originalFetch = global.fetch;
  try {
    global.fetch = async () => new Response(null, { status: 401 });
    await assert.rejects(() => service().validateBearerToken('expired'),
      (error) => error.getStatus() === 401);

    global.fetch = async () => new Response(null, { status: 503 });
    await assert.rejects(() => service().validateBearerToken('valid'),
      (error) => error.getStatus() === 503);

    global.fetch = async () => { throw new Error('network failure'); };
    await assert.rejects(() => service().validateBearerToken('valid'),
      (error) => error.getStatus() === 503);
  } finally {
    global.fetch = originalFetch;
  }
});

test('a valid token still resolves the internal user', async () => {
  const originalFetch = global.fetch;
  try {
    global.fetch = async () => Response.json({ id: 'auth-1', email: 'teacher@example.test' });
    const user = await service().validateBearerToken('valid');
    assert.equal(user.id, 'user-1');
    assert.equal(user.role, 'TEACHER');
  } finally {
    global.fetch = originalFetch;
  }
});
