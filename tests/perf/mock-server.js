// tests/perf/mock-server.js
// Standalone HTTP server for load-testing POST /tickets WITHOUT touching a real database.
// Why this exists: k6 needs a real TCP/HTTP server to fire real concurrent requests at --
// it can't drive an in-process Supertest app the way Jest can. This script mounts the REAL,
// unmodified tickets.routes.js on a real Express server, so you get real HTTP overhead, real
// Express routing, real middleware execution, real JSON serialization -- the actual code
// path a request takes through your app -- but the Supabase layer is swapped for the exact
// same in-memory fakes already proven correct in tests/api/tickets.api.test.js. Result:
//   - no real Supabase Auth call is made (a fixed fake customer is "logged in" automatically)
//   - no real database row is EVER written -- everything lives in memory for the request only
//   - no test account, no real credentials, no real Supabase project needed at all
//
// Run:
//   node tests/perf/mock-server.js          (starts on http://localhost:4000)
//   k6 run tests/perf/load_test.js -e API_BASE_URL=http://localhost:4000


const path = require("path");
const Module = require("module");

// Intercept require() for the two Supabase config modules BEFORE tickets.routes.js loads
// them -- Node has no built-in jest.mock, so we patch Module._load ourselves, but only for
// these two specifiers; everything else loads normally.
//
// IMPORTANT: the real code requires these WITHOUT a ".js" extension --
//   middlewares/auth.js does  require("../config/supabase")
//   tickets.routes.js does    require("../../config/supabaseAdmin")
// so matching on a literal ".js" suffix never matches, the patch silently falls through to
// the real module, and the real module calls process.exit(1) when SUPABASE_URL isn't set.
// Strip a trailing ".js" before comparing so both extension-less and .js-suffixed requires
// from anywhere in the codebase are caught.
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  const normalized = request.replace(/\.js$/, "");
  if (normalized.endsWith("config/supabase")) {
    return {
      supabaseForRequest: () => ({
        token: "fake-jwt",
        client: fakeSupabaseClient(),
      }),
    };
  }
  if (normalized.endsWith("config/supabaseAdmin")) {
    return { supabaseAdmin: { from: () => defaultChain() } };
  }
  return originalLoad.apply(this, arguments);
};

// Same fake query-builder chain shape as tests/api/tickets.api.test.js's defaultChain(),
// just written without jest.fn() since this runs as a plain Node script, not under Jest.
function defaultChain(overrides = {}) {
  return {
    select() { return this; },
    eq() { return this; },
    in() { return this; },
    order() { return this; },
    limit() { return this; },
    insert() { return this; },
    update() { return this; },
    maybeSingle: async () => ({ data: null, error: null }),
    single: async () => ({
      data: {
        id: `mock-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        ticket_number: `TCK-${Math.floor(Math.random() * 100000)}`,
        status: "New",
      },
      error: null,
    }),
    ...overrides,
  };
}

const FAKE_CUSTOMER = { id: "loadtest-customer", email: "loadtest@example.com", role: "customer" };

function fakeSupabaseClient() {
  return {
    auth: {
      // Always "succeeds" -- whatever Bearer token the request actually sends is irrelevant,
      // this never contacts real Supabase Auth.
      getUser: async () => ({ data: { user: FAKE_CUSTOMER }, error: null }),
    },
    from() {
      return defaultChain();
    },
  };
}

const express = require("express");
const ticketsRouter = require(
  path.join(__dirname, "..", "..", "backend", "src", "modules", "tickets", "tickets.routes.js")
);

const app = express();
app.use(express.json());
app.use("/api/tickets", ticketsRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Mock ticket server (no real Supabase, no real DB writes) listening on http://localhost:${PORT}`);
});