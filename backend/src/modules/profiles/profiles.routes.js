// SEP_SaigonBistro/backend/src/modules/profiles/profiles.routes.js

const express = require("express");
const { requireAuth } = require("../../middlewares/auth");

const router = express.Router();

// GET /api/profiles/me
router.get("/me", requireAuth, async (req, res) => {
  try {
    const { data, error } = await req.sb
      .from("profiles")
      .select("id, display_name, role, created_at, updated_at")
      .eq("id", req.user.id)
      .single();

    if (error) return res.status(400).json({ message: error.message });
    res.json({ success: true, profile: data });
  } catch (err) {
    console.error("ME ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* ================================
   GET /api/profiles
   View all staffs (Admin only)
=================================== */
router.get("/", requireAuth, async (req, res) => {
  try {
    // 1) Get the caller's role from profiles table
    const { data: me, error: meErr } = await req.sb
      .from("profiles")
      .select("role")
      .eq("id", req.user.id)
      .single();

    if (meErr) return res.status(400).json({ message: meErr.message });

    const role = (me?.role || "").toLowerCase();
    if (role !== "admin") return res.status(403).json({ message: "Admin access only" });

    // 2) Return all admin + staff
    const { data, error } = await req.sb
      .from("profiles")
      .select("id, display_name, email, role, created_at, updated_at")
      .in("role", ["admin", "staff"])
      .order("created_at", { ascending: false });

    if (error) return res.status(400).json({ message: error.message });

    return res.json({ success: true, staffs: data });
  } catch (err) {
    console.error("STAFF LIST ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;