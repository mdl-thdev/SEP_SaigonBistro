// SEP_SaigonBistro/backend/src/modules/auth/auth.routes.js

const express = require("express");
const { supabaseBase } = require("../../config/supabase");

const router = express.Router();

router.post("/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ message: "name, email, password are required" });
    }

    const { data, error } = await supabaseBase.auth.signUp({
      email: String(email).trim().toLowerCase(),
      password: String(password),
      options: { data: { display_name: String(name).trim() } },
    });

    if (error) return res.status(400).json({ message: error.message });

    return res.status(201).json({
      success: true,
      user: data.user,
      session: data.session,
      message: data.session ? "Signup successful" : "Signup created. Please confirm your email.",
    });
  } catch (err) {
    console.error("SIGNUP ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const { data, error } = await supabaseBase.auth.signInWithPassword({
      email: String(email).trim().toLowerCase(),
      password: String(password),
    });

    if (error) return res.status(401).json({ message: error.message });

    return res.json({ success: true, session: data.session, user: data.user });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
