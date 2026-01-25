// SEP_SaigonBistro/backend/src/modules/tickets/tickets.routes.js

const express = require("express");
const { requireAuth, requireAdmin, requireStaffOrAdmin } = require("../../middlewares/auth");
const { TICKET_STATUSES } = require("../../utils/constants");

const router = express.Router();

router.post("/", requireAuth, async (req, res) => {
  try {
    const { category, subject, description, customer_phone, order_id } = req.body || {};

    if (!category || !subject || !description) {
      return res.status(400).json({ message: "category, subject, description are required" });
    }

    const { data: profile } = await req.sb
      .from("profiles")
      .select("display_name")
      .eq("id", req.user.id)
      .single();

    const customer_name = profile?.display_name || req.user.email || "Customer";
    const customer_email = req.user.email || "";

    const { data, error } = await req.sb
      .from("tickets")
      .insert([
        {
          customer_id: req.user.id,
          customer_name,
          customer_email,
          customer_phone: customer_phone || null,
          order_id: order_id || null,
          category,
          subject,
          description,
          status: "New",
        },
      ])
      .select("id, ticket_number, status, owner_id, created_at, updated_at")
      .single();

    if (error) return res.status(400).json({ message: error.message });
    res.status(201).json({ success: true, ticket: data });
  } catch (err) {
    console.error("CREATE TICKET ERROR:", err);
    res.status(500).json({ message: "Failed to create ticket" });
  }
});

router.get("/mine", requireAuth, async (req, res) => {
  try {
    const { data, error } = await req.sb
      .from("tickets")
      .select("id, ticket_number, category, subject, status, owner_id, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (error) return res.status(400).json({ message: error.message });
    res.json({ success: true, tickets: data });
  } catch (err) {
    console.error("MY TICKETS ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/", requireStaffOrAdmin, async (req, res) => {
  try {
    const { data, error } = await req.sb
      .from("tickets")
      .select(
        "id, ticket_number, customer_name, customer_email, customer_phone, order_id, category, subject, status, owner_id, created_at, updated_at"
      )
      .order("created_at", { ascending: false });

    if (error) return res.status(400).json({ message: error.message });
    res.json({ success: true, tickets: data });
  } catch (err) {
    console.error("GET TICKETS ERROR:", err);
    res.status(500).json({ message: "Failed to load tickets" });
  }
});

router.patch("/:id/assign-self", requireStaffOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};

    const payload = {};
    if (status) {
      if (!TICKET_STATUSES.has(status)) return res.status(400).json({ message: "Invalid status" });
      payload.status = status;
    } else {
      payload.status = "In Progress";
    }

    const { data, error } = await req.sb
      .from("tickets")
      .update(payload)
      .eq("id", id)
      .select("id, ticket_number, status, owner_id, updated_at")
      .single();

    if (error) return res.status(400).json({ message: error.message });
    res.json({ success: true, ticket: data });
  } catch (err) {
    console.error("ASSIGN SELF ERROR:", err);
    res.status(500).json({ message: "Failed to assign ticket to self" });
  }
});

router.patch("/:id/status", requireStaffOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};

    if (!status || !TICKET_STATUSES.has(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const { data, error } = await req.sb
      .from("tickets")
      .update({ status })
      .eq("id", id)
      .select("id, ticket_number, status, owner_id, updated_at")
      .single();

    if (error) return res.status(400).json({ message: error.message });
    res.json({ success: true, ticket: data });
  } catch (err) {
    console.error("UPDATE TICKET STATUS ERROR:", err);
    res.status(500).json({ message: "Failed to update ticket status" });
  }
});

router.patch("/:id/assign-staff", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { owner_id, status } = req.body || {};

    if (!owner_id) return res.status(400).json({ message: "owner_id is required" });

    const { data: staffProfile, error: pErr } = await req.sb
      .from("profiles")
      .select("id, role, display_name")
      .eq("id", owner_id)
      .single();

    if (pErr || !staffProfile) return res.status(400).json({ message: "Invalid owner_id" });
    if (staffProfile.role !== "staff") {
      return res.status(400).json({ message: "owner_id must belong to a staff user" });
    }

    const payload = { owner_id };
    if (status) {
      if (!TICKET_STATUSES.has(status)) return res.status(400).json({ message: "Invalid status" });
      payload.status = status;
    }

    const { data, error } = await req.sb
      .from("tickets")
      .update(payload)
      .eq("id", id)
      .select("id, ticket_number, status, owner_id, updated_at")
      .single();

    if (error) return res.status(400).json({ message: error.message });

    res.json({
      success: true,
      ticket: data,
      assigned_to: { id: staffProfile.id, name: staffProfile.display_name },
    });
  } catch (err) {
    console.error("ASSIGN STAFF ERROR:", err);
    res.status(500).json({ message: "Failed to assign ticket to staff" });
  }
});

module.exports = router;
