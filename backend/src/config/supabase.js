// SEP_SaigonBistro/backend/src/config/supabase.js
// User-scoped Supabase client (RLS enforced)
// requests coming from the frontend:
// the user logs in via Supabase Auth> the frontend sends a JWT> Row Level Security (RLS) must apply> backend should not have admin powers

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY; // public key used by browsers and normal backend requests

// Defensive check, Makes sure the app doesn’t start with missing config
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env");
  process.exit(1); // Immediately stops the Node.js process, Prevents running the backend in a broken / insecure state
}

// Creates a base Supabase client, No user JWT attached
const supabaseBase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Create client bound to request JWT (RLS uses auth.uid())
function supabaseForRequest(req) {
  const authHeader = req.headers.authorization || ""; // Reads the Authorization header
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null; // Checks if header starts with `"Bearer "`, If yes → extracts only the JWT, If no → token is `null`

  return {
    token,
    client: createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: token ? { headers: { Authorization: `Bearer ${token}` } } : {}, // If a token exists, Injects it into every Supabase request header
    }),  // If no token, Client behaves like anonymous access
  };
}

module.exports = { supabaseBase, supabaseForRequest }; // supabaseBase → anonymous / system-safe usage, supabaseForRequest(req) → per-user secure access