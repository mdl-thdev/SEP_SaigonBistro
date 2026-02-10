// SEP_SaigonBistro/backend/src/config/supabaseAdmin.js
// Use it when: seeding data, cron jobs, moderation, system tasks, backend-only operations

const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // Uses the Service Role key, full database access

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

// Creates a Supabase client with full privileges
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }, // Disables session persistence, backend doesn’t need cookies, avoids memory leaks, avoids accidental auth state sharing
});

module.exports = { supabaseAdmin };
