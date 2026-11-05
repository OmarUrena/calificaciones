// Deterministic checks with a fake clock and auth events; no live writes.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = ts.transpileModule(readFileSync(new URL("../components/layout/SessionExpiryNotice.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const jsx = (type, props) => ({ type, props });
const content = (tree) => JSON.stringify(tree);
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

function fixture(lifetime = 3600) {
  let now = 1_000_000;
  let currentSession = { access_token: "original", expires_at: now / 1000 + lifetime };
  let listener;
  let cleanup;
  let cursor = 0;
  let unsubscribed = false;
  let authCallbackRunning = false;
  let getSession = async () => ({ data: { session: currentSession }, error: null });
  let refreshMode = "success";
  let refreshCalls = 0;
  let sessionReads = 0;
  const state = [];
  const timers = new Map();
  const events = new Map();
  const successes = [];
  const emit = (session, event = "TOKEN_REFRESHED") => {
    currentSession = session;
    authCallbackRunning = true;
    try { listener(event, session); } finally { authCallbackRunning = false; }
  };
  const fresh = (token = "renewed", seconds = lifetime) => ({ access_token: token, expires_at: now / 1000 + seconds });
  const modules = {
    "react": {
      useState: (initial) => {
        const index = cursor++;
        if (!(index in state)) state[index] = initial;
        return [state[index], (value) => { state[index] = value; }];
      },
      useEffect: (effect) => { if (!cleanup) cleanup = effect(); },
    },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "sonner": { toast: { success: (message) => successes.push(message) } },
    "@/lib/session": {
      supabase: { auth: {
        getSession: () => {
          assert.equal(authCallbackRunning, false, "Auth calls must wait for the auth callback to release its lock");
          sessionReads++;
          return getSession();
        },
        onAuthStateChange: (callback) => {
          listener = callback;
          return { data: { subscription: { unsubscribe: () => { unsubscribed = true; } } } };
        },
      } },
      refreshAccessToken: async (token) => {
        refreshCalls++;
        assert.equal(token, currentSession?.access_token ?? "");
        await Promise.resolve();
        if (refreshMode === "error") throw new Error("offline");
        if (refreshMode === "missing") return null;
        const session = fresh();
        emit(session);
        return session.access_token;
      },
    },
  };
  const target = {
    addEventListener: (event, callback) => events.set(event, callback),
    removeEventListener: (event) => events.delete(event),
  };
  const exports = {};
  vm.runInNewContext(source, {
    exports, require: (name) => modules[name],
    Date: { now: () => now },
    setTimeout: (callback, delay) => { const id = Symbol(); timers.set(id, { callback, at: now + delay }); return id; },
    clearTimeout: (id) => timers.delete(id),
    window: target, document: { ...target, visibilityState: "visible" },
  });
  function render() { cursor = 0; return exports.SessionExpiryNotice(); }
  async function flush() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
  async function advance(ms = 0) {
    now += ms;
    for (const [id, timer] of [...timers]) {
      if (timer.at <= now) { timers.delete(id); timer.callback(); }
    }
    await flush();
  }
  assert.equal(render(), null);
  return {
    render, emit, fresh, flush, advance, events, successes,
    sleep: (ms) => { now += ms; },
    setRead: (read) => { getSession = read; },
    setRefreshMode: (mode) => { refreshMode = mode; },
    reads: () => sessionReads,
    refreshCalls: () => refreshCalls,
    continueSession: () => render().props.children[0].props.children[1].props.onClick(),
    cleanup: () => {
      cleanup();
      assert.equal(unsubscribed, true);
      assert.equal(timers.size, 0);
      assert.equal(events.size, 0);
    },
  };
}

// The old five-minute warning blocked five-minute tokens immediately on login.
for (const lifetime of [60, 300, 3600]) {
  const app = fixture(lifetime);
  await app.flush();
  assert.equal(app.render(), null, lifetime + "s login must not open the renewal modal");
  await app.advance((lifetime - 1) * 1000);
  app.events.get("focus")();
  assert.equal(app.render(), null, "a still-valid token must not block work");
  assert.equal(app.reads(), 1, "no session polling while the token is valid");
  app.emit(app.fresh("automatic"));
  assert.equal(app.render(), null, "normal automatic refresh stays silent");
  app.cleanup();
}

const recovered = fixture(300);
await recovered.flush();
recovered.setRead(async () => ({ data: { session: recovered.fresh() }, error: null }));
await recovered.advance(300_100);
assert.equal(recovered.render(), null, "expiry schedules a silent recovery before showing a modal");
await recovered.advance();
assert.equal(recovered.render(), null, "silent recovery of a five-minute token does not show a modal");
assert.equal(recovered.reads(), 2);
assert.equal(recovered.successes.length, 0, "automatic refresh must not toast on every token rotation");
recovered.cleanup();

const app = fixture();
await app.flush();
app.setRead(async () => { throw new Error("offline"); });
await app.advance(3_600_100);
assert.equal(app.render(), null, "do not warn before attempting recovery");
await app.advance();
assert.match(content(app.render()), /necesita renovarse/);
const modal = app.render();
assert.equal(modal.type, "dialog");
assert.equal(modal.props["aria-labelledby"], "session-expiry-title");
let opened = false;
let closed = false;
const closeModal = modal.props.ref({ showModal: () => { opened = true; }, close: () => { closed = true; } });
assert.equal(opened, true, "uses the browser modal with focus trapping");
closeModal();
assert.equal(closed, true, "closes the modal on unmount");
let cancelled = false;
modal.props.onCancel({ preventDefault: () => { cancelled = true; } });
assert.equal(cancelled, true);
app.setRefreshMode("error");
app.continueSession();
assert.match(content(app.render()), /Renovando sesión/);
await app.flush();
assert.match(content(app.render()), /No se pudo renovar/);
assert.equal(app.render().props.children[0].props.children[1].props.disabled, false);
app.setRefreshMode("success");
app.continueSession();
await app.flush();
assert.equal(app.render(), null);
assert.equal(app.refreshCalls(), 2);
assert.equal(app.successes.length, 1);

app.emit(null, "SIGNED_OUT");
assert.equal(app.render(), null, "a null auth event is checked outside the auth lock");
app.setRead(async () => ({ data: { session: null }, error: null }));
await app.advance();
assert.ok(app.render(), "a confirmed lost session still offers recovery without unmounting editors");
app.setRefreshMode("missing");
app.continueSession();
await app.flush();
assert.match(content(app.render()), /otra pestaña con la misma cuenta/);
app.emit(app.fresh("other-tab"), "SIGNED_IN");
assert.equal(app.render(), null);
app.cleanup();

const initial = fixture(300);
const initialRead = deferred();
initial.setRead(() => initialRead.promise);
initial.emit(null, "INITIAL_SESSION");
await initial.advance();
initial.emit(initial.fresh(), "SIGNED_IN");
initialRead.resolve({ data: { session: null }, error: null });
await initial.flush();
assert.equal(initial.render(), null, "a stale null initial read must not overwrite a successful login");
initial.cleanup();

const waking = fixture(300);
await waking.flush();
await waking.advance(300_100);
const wakeRead = deferred();
waking.setRead(() => wakeRead.promise);
await waking.advance();
for (let i = 0; i < 5; i++) waking.events.get("focus")();
assert.equal(waking.reads(), 2, "focus events share the in-flight recovery");
waking.emit(waking.fresh("other-tab"));
wakeRead.reject(new Error("old refresh failure"));
await waking.flush();
assert.equal(waking.render(), null, "a late failure must not reopen a modal after another tab renewed");
waking.cleanup();

const sleeping = fixture(300);
await sleeping.flush();
sleeping.sleep(600_000); // Background tab: the browser did not run its timers.
sleeping.setRead(async () => {
  const session = sleeping.fresh("wake-refresh");
  sleeping.emit(session); // The SDK can emit TOKEN_REFRESHED during getSession.
  return { data: { session }, error: null };
});
sleeping.events.get("visibilitychange")();
assert.equal(sleeping.render(), null);
await sleeping.advance();
assert.equal(sleeping.render(), null, "waking an expired tab first recovers silently");
assert.equal(sleeping.reads(), 2);
sleeping.cleanup();

const rejected = fixture(300);
await rejected.flush();
rejected.setRead(async () => ({ data: { session: null }, error: new Error("revoked") }));
await rejected.advance(300_100);
await rejected.advance();
assert.match(content(rejected.render()), /necesita renovarse/, "a rejected expired session still needs user recovery");
rejected.cleanup();

const unknownExpiry = fixture();
await unknownExpiry.flush();
unknownExpiry.emit({ access_token: "no-expiry" });
assert.equal(unknownExpiry.render(), null, "missing expiry must not be treated as Unix epoch");
unknownExpiry.cleanup();

const disposed = fixture(300);
await disposed.flush();
await disposed.advance(300_100);
const pending = deferred();
disposed.setRead(() => pending.promise);
await disposed.advance();
disposed.cleanup();
pending.reject(new Error("offline"));
await disposed.flush();
assert.equal(disposed.render(), null, "an expired component must not set state after cleanup");

console.log("Session notice checks passed: short-token login, silent renewal, expiry failures, manual recovery, races, focus, missing expiry and cleanup.");
