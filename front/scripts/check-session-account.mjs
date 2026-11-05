// Deterministic checks; all Auth, navigation and cache operations are simulated.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const jsx = (type, props) => ({ type, props });
function load(file, dependencies, globals = {}) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  vm.runInNewContext(source, { exports, require: (name) => dependencies[name], ...globals });
  return exports;
}
async function flush() { for (let i = 0; i < 8; i++) await Promise.resolve(); }

function accountFixture(pathname = "/grades/academic") {
  const calls = [];
  const events = new Map();
  let listener; let cleanup; let leaving = false; let resolveSession;
  const initialSession = new Promise((resolve) => { resolveSession = resolve; });
  const modules = {
    "react": {
      useState: () => [leaving, (value) => { leaving = value; }],
      useEffect: (effect) => { if (!cleanup) cleanup = effect(); },
    },
    "@tanstack/react-query": { useQueryClient: () => ({ cancelQueries: async () => calls.push("cancel"), clear: () => calls.push("clear") }) },
    "@/lib/session": { supabase: { auth: {
      onAuthStateChange: (callback) => { listener = callback; return { data: { subscription: { unsubscribe: () => calls.push("unsubscribe") } } }; },
      getSession: () => initialSession,
    } } },
  };
  const component = load("../components/auth/SessionAccountGuard.tsx", modules, {
    queueMicrotask,
    window: {
      location: { pathname, replace: (url) => calls.push(url) },
      addEventListener: (event, callback) => events.set(event, callback),
      removeEventListener: (event) => events.delete(event),
    },
  }).SessionAccountGuard;
  const render = () => component({ children: "editor-with-unsaved-notes" });
  assert.equal(render(), "editor-with-unsaved-notes");
  return { calls, events, render, cleanup: () => cleanup(), resolveSession,
    emit: (event, id) => listener(event, id ? { user: { id } } : null) };
}

const account = accountFixture();
account.emit("INITIAL_SESSION", "account-a");
await flush();
account.resolveSession({ data: { session: { user: { id: "stale-initial-user" } } } });
await flush();
account.emit("TOKEN_REFRESHED", "account-a");
account.emit("SIGNED_OUT", null);
account.emit("SIGNED_IN", "account-a");
await flush();
assert.deepEqual(account.calls, [], "same-account renewal and reauthentication preserve drafts");
assert.equal(account.render(), "editor-with-unsaved-notes");
account.emit("SIGNED_IN", "account-b");
await flush();
assert.deepEqual(account.calls, ["cancel", "clear", "/login?reason=account-changed"]);
assert.equal(account.render(), null, "another account cannot see the previous editor");
account.emit("SIGNED_IN", "account-c");
await flush();
assert.equal(account.calls.length, 3, "only one navigation is issued");
account.cleanup();
assert.equal(account.events.size, 0);

const otherTab = accountFixture();
otherTab.events.get("storage")({ key: "unrelated", newValue: "value" });
assert.deepEqual(otherTab.calls, []);
otherTab.events.get("storage")({ key: "califapp_logout", newValue: "123" });
assert.deepEqual(otherTab.calls, ["cancel", "clear", "/login?reason=signed-out"]);
otherTab.cleanup();

const loginPage = accountFixture("/login");
loginPage.emit("INITIAL_SESSION", "account-a");
loginPage.emit("SIGNED_IN", "account-b");
await flush();
assert.deepEqual(loginPage.calls, [], "explicit login handles its own cache reset and navigation");
loginPage.cleanup();
loginPage.emit("SIGNED_IN", "account-c");
await flush();
assert.equal(loginPage.calls.at(-1), "unsubscribe");

class ApiError extends Error { constructor(status) { super("Auth error"); this.status = status; } }
let logoutFailure = false; let currentUserStatus = 503;
const authCalls = [];
const auth = load("../lib/auth.ts", {
  "@/lib/api": {
    ApiError,
    apiFetch: async () => { throw new ApiError(currentUserStatus); },
    clearStoredToken: () => authCalls.push("clear-token"),
    setStoredToken: () => authCalls.push("set-token"),
  },
  "@/lib/session": { supabase: { auth: {
    signInWithPassword: async () => ({ data: { session: { access_token: "token" } }, error: null }),
    signOut: async (options) => { assert.equal(options.scope, "local"); authCalls.push("sign-out"); return { error: logoutFailure ? new Error("offline") : null }; },
  } } },
}, { window: { localStorage: { setItem: (key) => authCalls.push(key) } } });
await assert.rejects(() => auth.login({ email: "user@test", password: "test" }));
assert.deepEqual(authCalls, ["set-token"], "temporary profile errors retain the Supabase session");
logoutFailure = true;
await assert.rejects(() => auth.logout());
assert.equal(authCalls.includes("clear-token"), false, "failed logout does not pretend to clear credentials");
logoutFailure = false;
currentUserStatus = 401;
authCalls.length = 0;
await assert.rejects(() => auth.login({ email: "user@test", password: "test" }));
assert.deepEqual(authCalls, ["set-token", "sign-out", "clear-token", "califapp_logout"]);

let mutation; const hookCalls = []; let failLogout = false;
const hook = load("../hooks/use-auth.ts", {
  "@tanstack/react-query": {
    useQueryClient: () => ({ cancelQueries: async () => hookCalls.push("cancel"), clear: () => hookCalls.push("clear"), setQueryData: (key, value) => hookCalls.push([key[0], value.id]) }),
    useMutation: (options) => { mutation = options; return {}; },
  },
  "next/navigation": { useRouter: () => ({ replace: (path) => hookCalls.push(path) }) },
  "sonner": { toast: { error: () => hookCalls.push("logout-error") } },
  "@/lib/auth": { login: () => {}, logout: async () => { if (failLogout) throw new Error("offline"); }, getRoleRedirectPath: () => "/my-subjects" },
}).useAuth();
await mutation.onMutate();
mutation.onSuccess({ user: { id: "new-user", role: "TEACHER" } });
assert.deepEqual(hookCalls, ["cancel", "clear", ["current-user", "new-user"], "/my-subjects"]);
hookCalls.length = 0;
failLogout = true;
await hook.logout();
assert.deepEqual(hookCalls, ["logout-error"]);

let userState; const navigations = [];
const layout = load("../components/layout/DashboardLayout.tsx", {
  "react": { useEffect: (effect) => effect() },
  "react/jsx-runtime": { jsx, jsxs: jsx },
  "lucide-react": { Loader2: "loader" },
  "next/navigation": { useRouter: () => ({ replace: (path) => navigations.push(path) }) },
  "@/hooks/use-current-user": { useCurrentUser: () => userState },
  "@/lib/api": { ApiError },
  "./AppSidebar": { AppSidebar: "sidebar" },
  "./Topbar": { Topbar: "topbar" },
  "./SessionExpiryNotice": { SessionExpiryNotice: "expiry-notice" },
}).DashboardLayout;
userState = { isError: true, error: new ApiError(503), refetch: () => {} };
assert.match(JSON.stringify(layout({ children: "draft-editor" })), /Reintentar/);
assert.deepEqual(navigations, []);
userState = { ...userState, data: { id: "user" } };
assert.match(JSON.stringify(layout({ children: "draft-editor" })), /draft-editor/);
userState = { ...userState, error: new ApiError(401) };
assert.match(JSON.stringify(layout({ children: "draft-editor" })), /draft-editor/);
assert.deepEqual(navigations, [], "background failures retain an existing editor");
userState = { ...userState, data: undefined };
layout({ children: "draft-editor" });
assert.deepEqual(navigations, ["/login"]);

console.log("Account/session checks passed: draft preservation, account changes, cross-tab logout, cache isolation and temporary errors.");
