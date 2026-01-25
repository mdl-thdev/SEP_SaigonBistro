// SEP_SaigonBistro/backend/src/config/supabase.js
// config/: environment + database + settings (e.g., db.js, dotenv, constants)
// Supabase does handle auth (login, signup, issuing JWTs, refreshing sessions, etc.)
// Backend (3000) use this file supabaseForRequest(req) to validates JWT, enforces RLS, reads profile / role
// >> returns safe user data to frontend

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY in .env");
  process.exit(1);
}

// Base client (no user JWT)
const supabaseBase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Create client bound to request JWT (RLS uses auth.uid())
function supabaseForRequest(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

  return {
    token,
    client: createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: token ? { headers: { Authorization: `Bearer ${token}` } } : {},
    }),
  };
}

module.exports = { supabaseBase, supabaseForRequest };