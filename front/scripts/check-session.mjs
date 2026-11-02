import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(file, dependencies, globals = {}) {
  const source = ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, {
    exports, require: (name) => dependencies[name],
    process: { env: { NEXT_PUBLIC_SUPABASE_URL: "https://example.test", NEXT_PUBLIC_SUPABASE_ANON_KEY: "test" } },
    Headers, FormData, ...globals,
  });
  return exports;
}

let sessionToken = "current";
let refreshCount = 0;
let listener;
const storage = new Map([["califapp_token", "expired-copy"]]);
const document = { cookie: "" };
const session = load("../lib/session.ts", {
  "@supabase/supabase-js": {
    createClient: () => ({ auth: {
      onAuthStateChange: (callback) => { listener = callback; },
      getSession: async () => ({ data: { session: sessionToken ? { access_token: sessionToken } : null }, error: null }),
      refreshSession: async () => {
        refreshCount++;
        await new Promise((resolve) => setTimeout(resolve, 5));
        sessionToken = "renewed";
        return { data: { session: { access_token: sessionToken } }, error: null };
      },
    } }),
  },
}, { window: { localStorage: { setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) } }, document });

assert.equal(await session.getAccessToken(), "current");
assert.equal(storage.get("califapp_token"), "current");
listener("TOKEN_REFRESHED", { access_token: "event-token" });
assert.match(document.cookie, /event-token/);
assert.equal(storage.get("califapp_token"), "event-token");
const tokens = await Promise.all([session.refreshAccessToken("current"), session.refreshAccessToken("current")]);
assert.deepEqual(tokens, ["renewed", "renewed"]);
assert.equal(refreshCount, 1, "concurrent failures share one refresh");
assert.equal(await session.refreshAccessToken("old-request"), "renewed");
assert.equal(refreshCount, 1, "a refreshed token is reused for late 401 responses");
listener("SIGNED_OUT", null);
assert.equal(storage.has("califapp_token"), false);
assert.match(document.cookie, /max-age=0/);
sessionToken = null;
assert.equal(await session.refreshAccessToken("old-request"), null);

let requests;
let statuses;
let renewals;
let failRefresh = false;
let networkFailure = false;
const api = load("../lib/api.ts", {
  "@/lib/session": {
    getAccessToken: async () => "current",
    refreshAccessToken: async () => {
      renewals++;
      if (failRefresh) throw new Error("revoked");
      return "renewed";
    },
  },
}, { fetch: async (url, options) => {
  requests.push({ url, ...options });
  if (networkFailure) throw new Error("offline");
  return new Response(JSON.stringify({ ok: true }), { status: statuses.shift(), headers: { "Content-Type": "application/json" } });
} });
function reset(codes) { requests = []; statuses = codes; renewals = 0; }

reset([401, 200]);
await api.apiFetch("/grades", { method: "POST", body: '{"score":85}' });
assert.equal(requests.length, 2);
assert.equal(requests[0].headers.get("Authorization"), "Bearer current");
assert.equal(requests[1].headers.get("Authorization"), "Bearer renewed");
assert.equal(requests[1].body, requests[0].body);
assert.equal(requests[1].method, "POST");

reset([401, 401]);
await assert.rejects(api.apiFetch("/grades"), (error) => error.status === 401 && /Mantén esta página abierta/.test(error.message));
assert.equal(requests.length, 2, "401 retries are bounded");

for (const status of [400, 403, 500]) {
  reset([status]);
  await assert.rejects(api.apiFetch("/grades"));
  assert.equal(requests.length, 1);
  assert.equal(renewals, 0);
}
reset([401]);
await assert.rejects(api.apiFetch("/grades", { token: "explicit" }));
assert.equal(renewals, 0, "explicit credentials must not be replaced");

reset([401]);
failRefresh = true;
await assert.rejects(api.apiFetch("/grades"), (error) => error.status === 401);
assert.equal(requests.length, 1);
failRefresh = false;

reset([200]);
networkFailure = true;
await assert.rejects(api.apiFetch("/grades"), (error) => error.code === "NETWORK_ERROR");
assert.equal(requests.length, 1, "uncertain writes must never be replayed");
networkFailure = false;

reset([401, 200]);
await api.downloadBlob("/report");
assert.equal(requests.length, 2);
reset([401, 200]);
await api.uploadFile("/import", { file: new File(["grades"], "grades.csv") });
assert.equal(requests[0].body, requests[1].body);
assert.equal(requests[1].headers.has("Content-Type"), false);

console.log("Session regression checks passed: renewal, synchronization, concurrency, bounded retries, errors, downloads and uploads.");
