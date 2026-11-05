// Auth responses are simulated; no account or database changes.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { AuthService } = require('../dist/src/auth/auth.service');

test('temporary Auth failures are 503; rejected tokens are 401; valid tokens still enforce internal permissions', async () => {
  const originalFetch = global.fetch;
  let lookups = 0;
  let active = true;
  let userQuery;
  const service = new AuthService({ getOrThrow: (key) => key === 'supabase.url' ? 'https://auth.example.test' : 'anon' }, {
    user: { findFirst: async (query) => { lookups++; userQuery = query; return { id: 'user', isActive: active, role: 'SUPER_ADMIN', schoolId: null }; } },
  });
  try {
    for (const status of [401, 403, 429, 500, 503]) {
      global.fetch = async (_url, options) => {
        assert.ok(options.signal instanceof AbortSignal);
        assert.equal(options.headers.authorization, 'Bearer token');
        return new Response('{}', { status });
      };
      await assert.rejects(() => service.validateBearerToken('token'), (error) => error.getStatus() === ([401, 403].includes(status) ? 401 : 503));
    }
    for (const response of ['not json', 'null', '{}', '{"id":123}']) {
      global.fetch = async () => new Response(response);
      await assert.rejects(() => service.validateBearerToken('token'), (error) => error.getStatus() === 503);
    }
    global.fetch = async () => { throw new Error('timeout/offline'); };
    await assert.rejects(() => service.validateBearerToken('token'), (error) => error.getStatus() === 503);
    assert.equal(lookups, 0);
    global.fetch = async () => new Response(JSON.stringify({ id: 'user', user_metadata: { email: 'another-user@example.test' } }));
    assert.equal((await service.validateBearerToken('token')).id, 'user');
    assert.deepEqual(userQuery.where.OR, [{ id: 'user' }], 'editable metadata must not identify an internal account');
    active = false;
    await assert.rejects(() => service.validateBearerToken('token'), (error) => error.getStatus() === 401);
  } finally { global.fetch = originalFetch; }
});
