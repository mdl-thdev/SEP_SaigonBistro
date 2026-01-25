// SEP_SaigonBistro/backend/src/modules/profiles/profiles.routes.js

const express = require("express");
const { requireAuth } = require("../../middlewares/auth");

const router = express.Router();

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

module.exports = router;
