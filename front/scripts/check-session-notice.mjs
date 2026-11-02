// Deterministic component checks with a fake clock and auth events; no live writes.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

let now = 1_000_000;
let currentSession = { access_token: "original", expires_at: now / 1000 + 3600 };
let listener;
let cleanup;
let unsubscribed = false;
let refreshMode = "success";
let refreshCalls = 0;
let cursor = 0;
const state = [];
const timers = new Map();
const events = new Map();
const successes = [];
const jsx = (type, props) => ({ type, props });
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
      getSession: async () => ({ data: { session: currentSession }, error: null }),
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
      currentSession = { access_token: "renewed", expires_at: now / 1000 + 3600 };
      listener("TOKEN_REFRESHED", currentSession);
      return currentSession.access_token;
    },
  },
};
const target = {
  addEventListener: (event, callback) => events.set(event, callback),
  removeEventListener: (event) => events.delete(event),
};
const exports = {};
const source = ts.transpileModule(readFileSync(new URL("../components/layout/SessionExpiryNotice.tsx", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
vm.runInNewContext(source, {
  exports, require: (name) => modules[name],
  Date: { now: () => now },
  setTimeout: (callback, delay) => { const id = Symbol(); timers.set(id, { callback, at: now + delay }); return id; },
  clearTimeout: (id) => timers.delete(id),
  window: target, document: { ...target, visibilityState: "visible" },
});
function render() { cursor = 0; return exports.SessionExpiryNotice(); }
function content(tree) { return JSON.stringify(tree); }
async function flush() { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }
function advance(ms) {
  now += ms;
  for (const [id, timer] of [...timers]) {
    if (timer.at <= now) { timers.delete(id); timer.callback(); }
  }
}
function continueSession() {
  const button = render().props.children[0].props.children[1];
  button.props.onClick();
}

assert.equal(render(), null);
await flush();
assert.equal(render(), null, "no warning for a fresh session");
advance(55 * 60 * 1000 + 100);
assert.match(content(render()), /próxima a vencer/);
const modal = render();
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
assert.equal(cancelled, true, "Escape must not silently dismiss the renewal notice");
continueSession();
assert.match(content(render()), /Renovando sesión/);
await flush();
assert.equal(render(), null);
assert.equal(refreshCalls, 1);
assert.equal(successes.length, 1);

advance(55 * 60 * 1000 + 100);
assert.ok(render());
currentSession = { access_token: "auto", expires_at: now / 1000 + 3600 };
listener("TOKEN_REFRESHED", currentSession);
assert.equal(render(), null, "automatic renewal dismisses the warning");

advance(55 * 60 * 1000 + 100);
refreshMode = "error";
continueSession();
await flush();
assert.match(content(render()), /No se pudo renovar/);
assert.equal(render().props.children[0].props.children[1].props.disabled, false);
advance(5 * 60 * 1000);
assert.match(content(render()), /necesita renovarse/);
currentSession = null;
listener("SIGNED_OUT", null);
refreshMode = "missing";
continueSession();
await flush();
assert.match(content(render()), /otra pestaña con la misma cuenta/);

currentSession = { access_token: "other-tab", expires_at: now / 1000 + 3600 };
listener("SIGNED_IN", currentSession);
assert.equal(render(), null);
now += 3601 * 1000; // Simulate sleeping without timer callbacks.
events.get("visibilitychange")();
assert.match(content(render()), /necesita renovarse/);
cleanup();
assert.equal(unsubscribed, true);
assert.equal(timers.size, 0);
assert.equal(events.size, 0);
console.log("Session notice checks passed: timing, manual/automatic renewal, failures, expiry, other tabs, wake and cleanup.");
