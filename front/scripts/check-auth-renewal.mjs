// Real Supabase SDK with fake HTTP/storage/clock: never contacts a live account.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { createClient } from "@supabase/supabase-js";

let now = 1_000_000;
const actualNow = Date.now;
const originalError = console.error;
const source = ts.transpileModule(readFileSync(new URL("../lib/auth-fetch.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exports = {};
vm.runInNewContext(source, { exports, URL, Request, AbortController, Date, setTimeout, clearTimeout });
const { createAuthFetch } = exports;
const authUrl = "https://auth.example.test";
const refreshUrl = authUrl + "/auth/v1/token?grant_type=refresh_token";

async function rateLimitScenario(protectedFetch) {
  const storage = new Map();
  const key = protectedFetch ? "protected-session" : "baseline-session";
  let requests = 0;
  const fetcher = async () => {
    requests++;
    if (requests === 1) {
      // Avoid real SDK backoff waits; the first response took longer than its retry budget.
      now += 31_000;
      return new Response(JSON.stringify({ code: "over_request_rate_limit", msg: "Too many requests" }), {
        status: 429, headers: { "Content-Type": "application/json", "X-Supabase-Api-Version": "2024-01-01", "Retry-After": "60" },
      });
    }
    return new Response(JSON.stringify({ access_token: `rotated-${requests}`, refresh_token: `rotated-refresh-${requests}`, expires_in: 300,
      token_type: "bearer", user: { id: "teacher", email: "teacher@example.test" } }), {
      headers: { "Content-Type": "application/json" },
    });
  };
  const client = createClient(authUrl, "test-key", {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: true, storageKey: key,
      storage: { getItem: (name) => storage.get(name) ?? null, setItem: (name, value) => storage.set(name, value), removeItem: (name) => storage.delete(name) } },
    global: { fetch: protectedFetch ? createAuthFetch(authUrl, fetcher) : fetcher },
  });
  await client.auth.initialize();
  storage.set(key, JSON.stringify({ access_token: "expired", refresh_token: "still-renewable", expires_at: now / 1000 - 1,
    token_type: "bearer", user: { id: "teacher", email: "teacher@example.test" } }));
  const first = await client.auth.getSession();
  assert.ok(first.error);
  assert.equal(requests, 1);
  if (!protectedFetch) {
    assert.equal(storage.has(key), false, "confirmed SDK regression: HTTP 429 removes an expired session");
  } else {
    assert.equal(first.error.name, "AuthRetryableFetchError");
    assert.equal(JSON.parse(storage.get(key)).refresh_token, "still-renewable", "rate limiting must retain credentials");
    await client.auth.getSession();
    assert.equal(requests, 1, "SDK retries during cooldown must not send additional requests");
    now += 61_000;
    const renewed = await client.auth.getSession();
    assert.equal(renewed.error, null);
    assert.equal(renewed.data.session.access_token, "rotated-2");
    assert.equal(requests, 2, "session can renew after the rate limit lifts without another login");
    for (let i = 0; i < 24; i++) {
      now += 301_000;
      const next = await client.auth.getSession();
      assert.equal(next.error, null);
      assert.equal(next.data.session.access_token, `rotated-${i + 3}`);
    }
    assert.equal(requests, 26, "repeated rotations over two hours keep using the latest refresh token");
  }
  await client.auth.stopAutoRefresh();
}

try {
  Date.now = () => now;
  console.error = () => {}; // The SDK logs simulated fetch failures; no credentials are logged.
  await rateLimitScenario(false);
  await rateLimitScenario(true);

  let calls = 0;
  const guarded = createAuthFetch(authUrl, async () => {
    calls++;
    return new Response("{}", { status: 429, headers: { "Retry-After": "120" } });
  });
  await assert.rejects(guarded(refreshUrl), /temporalmente limitada/);
  now += 61_000;
  await assert.rejects(guarded(refreshUrl), /temporalmente limitada/);
  assert.equal(calls, 1, "honor a Retry-After longer than one minute");
  now += 60_000;
  await assert.rejects(guarded(refreshUrl), /temporalmente limitada/);
  assert.equal(calls, 2);

  let passthroughs = 0;
  const untouched = createAuthFetch(authUrl, async () => { passthroughs++; return new Response("{}", { status: 400 }); });
  assert.equal((await untouched(authUrl + "/auth/v1/token?grant_type=password")).status, 400);
  assert.equal((await untouched("https://other.example.test/auth/v1/token?grant_type=refresh_token")).status, 400);
  assert.equal(passthroughs, 2, "password and other origins retain their normal HTTP errors");

  let timeout;
  let cleared = false;
  const timeoutExports = {};
  vm.runInNewContext(source, {
    exports: timeoutExports, URL, Request, AbortController, Date,
    setTimeout: (callback, delay) => { assert.equal(delay, 15_000); timeout = callback; return 1; },
    clearTimeout: () => { cleared = true; },
  });
  const hanging = timeoutExports.createAuthFetch(authUrl, (_input, { signal }) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
  }));
  const stalled = hanging(refreshUrl);
  timeout();
  await assert.rejects(stalled, /aborted/);
  assert.equal(cleared, true, "a stalled refresh aborts and releases its timeout");
} finally {
  Date.now = actualNow;
  console.error = originalError;
}
console.log("Real SDK renewal checks passed: reproduced HTTP 429 credential loss, retained refresh tokens, cooldown and subsequent renewal.");
