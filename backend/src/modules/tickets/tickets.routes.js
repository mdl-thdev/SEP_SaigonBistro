// SEP_SaigonBistro/backend/src/modules/tickets/tickets.routes.js

const express = require("express");
const { requireAuth, requireAdmin, requireStaffOrAdmin } = require("../../middlewares/auth");
const { TICKET_STATUSES } = require("../../utils/constants");

const router = express.Router();

// API (customers): POST Create Ticket
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

// API (customers): GET view tickets
router.get("/mine", requireAuth, async (req, res) => {
  try {
    const { data, error } = await req.sb
      .from("tickets")
      .select("id, ticket_number, category, subject, status, owner_id, created_at, updated_at")
      .eq("customer_id", req.user.id)
      .order("created_at", { ascending: false });

    if (error) return res.status(400).json({ message: error.message });
    res.json({ success: true, tickets: data });
  } catch (err) {
    console.error("MY TICKETS ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET customer ticket detail + comments
router.get("/mine/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // 1) Get ticket (must belong to customer)
    const { data: ticket, error: tErr } = await req.sb
      .from("tickets")
      .select("id, ticket_number, category, subject, description, status, created_at, updated_at")
      .eq("id", id)
      .eq("customer_id", req.user.id)
      .single();

    if (tErr || !ticket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    // 2) Get comments for this ticket
    const { data: comments, error: cErr } = await req.sb
      .from("ticket_comments")
      .select("id, author_role, author_email, message, created_at")
      .eq("ticket_id", id)
      .order("created_at", { ascending: true });

    if (cErr) {
      console.error("TICKET COMMENTS ERROR:", cErr);
    }

    res.json({
      success: true,
      ticket,
      comments: Array.isArray(comments) ? comments : [],
    });
  } catch (err) {
    console.error("MY TICKET DETAIL ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});


// Admin/Staff APIs
// GET View all Tickets
router.get("/", requireStaffOrAdmin, async (req, res) => {
  try {
    const { data, error } = await req.sb
      .from("tickets")
      .select("id, ticket_number, customer_name, customer_email, customer_phone, order_id, category, subject, status, owner_id, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("TICKETS SUPABASE ERROR:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
      return res.status(400).json({ message: error.message });
    }

    res.json({ success: true, tickets: data });
  } catch (err) {
    console.error("GET TICKETS ERROR:", err);
    res.status(500).json({ message: "Failed to load tickets" });
  }
});

// GET View Ticket Details
router.get("/:id", requireStaffOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: ticket, error: tErr } = await req.sb
      .from("tickets")
      .select("*")
      .eq("id", id)
      .single();

    if (tErr) return res.status(404).json({ message: tErr.message || "Ticket not found" });

    // comments table 
    let comments = [];
    try {
      const { data: cData, error: cErr } = await req.sb
        .from("ticket_comments")
        .select("id, ticket_id, author_role, author_email, message, created_at")
        .eq("ticket_id", id)
        .order("created_at", { ascending: true });

      if (!cErr && Array.isArray(cData)) comments = cData;
    } catch {
      // ignore if table doesn't exist
    }

    // feedback table 
    let feedback = null;
    try {
      const { data: fData, error: fErr } = await req.sb
        .from("ticket_feedback")
        .select("id, ticket_id, stars, comment, created_at")
        .eq("ticket_id", id)
        .single();

      if (!fErr && fData) feedback = fData;
    } catch {
      // ignore if table doesn't exist
    }

    res.json({ success: true, ticket, comments, feedback });
  } catch (err) {
    console.error("GET TICKET DETAIL ERROR:", err);
    res.status(500).json({ message: "Failed to load ticket detail" });
  }
});


// PATCH Assign Ticket to Self
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

// PATCH Update Ticket Status
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


// PATCH Admin assign Ticket to Staff
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
