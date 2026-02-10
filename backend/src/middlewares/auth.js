// SEP_SaigonBistro/backend/src/middlewares/auth.js

// supabaseForRequest(req) returns: token extracted from Authorization: Bearer ...; client that sends this token to Supabase on every request (so RLS applies)
const { supabaseForRequest } = require("../config/supabase"); 

//Defines an Express middleware function, async because it will call Supabase (network request)
async function requireAuth(req, res, next) {
  try {
    const { token, client } = supabaseForRequest(req);
    if (!token) return res.status(401).json({ message: "Missing Bearer token" }); // If there’s no JWT → reject immediately

    const { data, error } = await client.auth.getUser(); // Supabase checks the JWT and returns the user if valid
    if (error || !data?.user) return res.status(401).json({ message: "Invalid token" }); // If token is expired/invalid → error happens or data.user is missing

    req.user = data.user; // Attaches the authenticated user object to the request
    req.sb = client; // Attaches the user-scoped Supabase client to request; Route handlers can do database queries with RLS enforced
    next();
  } catch (err) {
    console.error("AUTH ERROR:", err);
    res.status(500).json({ message: "Auth error" });
  }
}

// Helper function to fetch a user’s role from your profiles table; sb: a Supabase client (usually req.sb); userId: user’s UUID
async function getMyRole(sb, userId) {
  const { data, error } = await sb.from("profiles").select("role").eq("id", userId).single(); // .single() means expects exactly 1 row and returns object instead of array
  if (error) return null; // If query fails (not found, RLS denies, etc.) return null; if 0 rows (or multiple) → error
  return data?.role || null;
}

// Middleware: only allow admins
async function requireAdmin(req, res, next) {
  await requireAuth(req, res, async () => {      // Only after authentication passes, run the admin-role check
    try {
      const role = await getMyRole(req.sb, req.user.id);
      if (role !== "admin") return res.status(403).json({ message: "Admin only" }); // 403 Forbidden means: we know who you are, but you’re not allowed
      next();
    } catch (err) {
      console.error("ADMIN GUARD ERROR:", err);
      res.status(500).json({ message: "Server error" }); // If something breaks unexpectedly → 500
    }
  });
}

// Allows 2 roles: staff OR admin; authenticate first, then role-check
async function requireStaffOrAdmin(req, res, next) {
  await requireAuth(req, res, async () => {
    try {
      const role = await getMyRole(req.sb, req.user.id);
      if (role !== "admin" && role !== "staff") {
        return res.status(403).json({ message: "Staff/Admin only" });
      }
      next();
    } catch (err) {
      console.error("STAFF/ADMIN GUARD ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  });
}

module.exports = { requireAuth, requireAdmin, requireStaffOrAdmin, getMyRole };
