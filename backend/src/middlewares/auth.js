// SEP_SaigonBistro/backend/src/middlewares/auth.js
// auth.js = “who are you / do you have permission?”

// middlewares/: reusable request/response logic (auth, error handler, validation, logging)

// middlewares/auth.js is doing auth enforcement on backend routes:
// It reads the Bearer token from the request
// It creates a Supabase client that includes that token
// It calls client.auth.getUser() to verify the token is valid
// Then it attaches req.user and req.sb so route handlers can use them

const { supabaseForRequest } = require("../config/supabase");

async function requireAuth(req, res, next) {
  try {
    const { token, client } = supabaseForRequest(req);
    if (!token) return res.status(401).json({ message: "Missing Bearer token" });

    const { data, error } = await client.auth.getUser();
    if (error || !data?.user) return res.status(401).json({ message: "Invalid token" });

    req.user = data.user;
    req.sb = client;
    next();
  } catch (err) {
    console.error("AUTH ERROR:", err);
    res.status(500).json({ message: "Auth error" });
  }
}

async function getMyRole(sb, userId) {
  const { data, error } = await sb.from("profiles").select("role").eq("id", userId).single();
  if (error) return null;
  return data?.role || null;
}

async function requireAdmin(req, res, next) {
  await requireAuth(req, res, async () => {
    try {
      const role = await getMyRole(req.sb, req.user.id);
      if (role !== "admin") return res.status(403).json({ message: "Admin only" });
      next();
    } catch (err) {
      console.error("ADMIN GUARD ERROR:", err);
      res.status(500).json({ message: "Server error" });
    }
  });
}

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
