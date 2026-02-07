// SEP_SaigonBistro/backend/src/modules/tickets/tickets.routes.js

const express = require("express");
const { requireAuth, requireAdmin, requireStaffOrAdmin } = require("../../middlewares/auth");
const { TICKET_STATUSES } = require("../../utils/constants");
const { supabaseAdmin } = require("../../config/supabaseAdmin");

const router = express.Router();

function isAdminUser(req) {
  return (req.user?.role || "").toLowerCase() === "admin";
}

/* =========================
   Customer APIs
========================= */

// POST Create Ticket (customer)
router.post("/", requireAuth, async (req, res) => {
  try {
    const { category, subject, description, customer_phone, order_publicid } = req.body || {};

    if (!category || !subject || !description) {
      return res.status(400).json({ message: "category, subject, description are required" });
    }

    // Resolve public order code -> orders.id (uuid)
    let resolvedOrderId = null;

    if (order_publicid && String(order_publicid).trim()) {
      const code = String(order_publicid).trim().toUpperCase();

      const { data: order, error: oErr } = await req.sb
        .from("orders")
        .select("id, customer_id, public_orderid")
        .eq("public_orderid", code)
        .maybeSingle();

      if (oErr) return res.status(400).json({ message: oErr.message });

      // Security check: order must belong to the same customer
      if (!order || order.customer_id !== req.user.id) {
        return res.status(400).json({ message: "Invalid Order ID." });
      }

      resolvedOrderId = order.id; // uuid
    }

    const { data: profile } = await req.sb.from("profiles").select("display_name").eq("id", req.user.id).single();

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
          order_id: resolvedOrderId,
          category,
          subject,
          description,
          status: "New",
        },
      ])
      .select("id, ticket_number, status, owner_id, created_at, updated_at, order_id, customer_phone")
      .single();

    if (error) return res.status(400).json({ message: error.message });
    res.status(201).json({ success: true, ticket: data });
  } catch (err) {
    console.error("CREATE TICKET ERROR:", err);
    res.status(500).json({ message: "Failed to create ticket" });
  }
});

// GET View my tickets (customer)
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

// GET My ticket detail + comments + feedback + allow_customer_reply (customer)
router.get("/mine/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // 1) ticket must belong to customer
    const { data: ticket, error: tErr } = await req.sb
      .from("tickets")
      .select(
        "id, ticket_number, category, subject, description, status, customer_phone, order_id, created_at, updated_at, customer_email"
      )
      .eq("id", id)
      .eq("customer_id", req.user.id)
      .single();

    if (tErr || !ticket) return res.status(404).json({ message: "Ticket not found" });

    // 2) comments (admin client to read)
    const { data: comments, error: cErr } = await supabaseAdmin
      .from("ticket_comments")
      .select("id, author_role, author_email, message, created_at")
      .eq("ticket_id", id)
      .order("created_at", { ascending: true });

    if (cErr) console.error("TICKET COMMENTS ERROR:", cErr);

    // 3) compute allow_customer_reply (5-day rule)
    let allow_customer_reply = true;
    let reply_deadline = null;

    try {
      const { data: lastStaffComment } = await req.sb
        .from("ticket_comments")
        .select("created_at")
        .eq("ticket_id", id)
        .in("author_role", ["staff", "admin"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lastStaffComment?.created_at) {
        const last = new Date(lastStaffComment.created_at).getTime();
        const fiveDaysMs = 5 * 24 * 60 * 60 * 1000;
        const deadlineMs = last + fiveDaysMs;
        reply_deadline = new Date(deadlineMs).toISOString();
        allow_customer_reply = Date.now() <= deadlineMs;
      }
    } catch {
      // default allow if error
    }

    // 4) feedback (optional)
    let feedback = null;
    try {
      const { data: fData } = await req.sb
        .from("ticket_feedback")
        .select("id, ticket_id, stars, comment, created_at")
        .eq("ticket_id", id)
        .maybeSingle();
      if (fData) feedback = fData;
    } catch {
      // ignore
    }

    // respond ONCE
    res.json({
      success: true,
      ticket,
      comments: Array.isArray(comments) ? comments : [],
      allow_customer_reply,
      reply_deadline,
      feedback,
    });
  } catch (err) {
    console.error("MY TICKET DETAIL ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Customer: POST reply on own ticket + reopen within 5 days of last staff/admin reply
router.post("/mine/:id/comments", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body || {};

    if (!message || !String(message).trim()) {
      return res.status(400).json({ message: "message is required" });
    }

    // 1) ticket must belong to customer
    const { data: ticket, error: tErr } = await req.sb
      .from("tickets")
      .select("id, status, customer_id, owner_id")
      .eq("id", id)
      .eq("customer_id", req.user.id)
      .single();

    if (tErr || !ticket) return res.status(404).json({ message: "Ticket not found" });

    // 2) Find last staff/admin reply time
    const { data: lastStaffComment, error: lcErr } = await req.sb
      .from("ticket_comments")
      .select("created_at, author_role")
      .eq("ticket_id", id)
      .in("author_role", ["staff", "admin"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lcErr) console.error("LAST STAFF COMMENT ERROR:", lcErr);

    // 3) Enforce 5-day rule
    if (lastStaffComment?.created_at) {
      const last = new Date(lastStaffComment.created_at).getTime();
      const now = Date.now();
      const fiveDaysMs = 5 * 24 * 60 * 60 * 1000;

      if (now - last > fiveDaysMs) {
        return res.status(403).json({
          message: "This case is closed for replies (more than 5 days since support last responded).",
        });
      }
    }

    // 4) Insert customer comment
    const payload = {
      ticket_id: id,
      author_id: req.user.id,
      author_role: "customer",
      author_email: req.user.email || "",
      message: String(message).trim(),
    };

    const { data: comment, error: cErr } = await req.sb
      .from("ticket_comments")
      .insert([payload])
      .select("id, ticket_id, author_id, author_role, author_email, message, created_at")
      .single();

    if (cErr) return res.status(400).json({ message: cErr.message });

    // 5) If ticket is Resolved -> Reopened AND UNASSIGN so another staff can claim
    let nextStatus = ticket.status;

    if (String(ticket.status || "").toLowerCase() === "resolved") {
      nextStatus = "Reopened";

      const { error: upErr } = await supabaseAdmin
        .from("tickets")
        .update({ status: nextStatus, owner_id: null })
        .eq("id", id);

      if (upErr) {
        console.error("REOPEN/UNASSIGN UPDATE ERROR:", upErr);
        return res.status(500).json({ message: "Reply saved, but failed to reopen the ticket." });
      }
    }

    res.status(201).json({ success: true, comment, status: nextStatus });
  } catch (err) {
    console.error("CUSTOMER POST COMMENT ERROR:", err);
    res.status(500).json({ message: "Failed to post reply" });
  }
});

// Customer: POST feedback on own ticket (only when Resolved, only once)
router.post("/mine/:id/feedback", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { stars, comment } = req.body || {};

    const s = Number(stars);
    if (!Number.isInteger(s) || s < 1 || s > 5) {
      return res.status(400).json({ message: "stars must be an integer from 1 to 5" });
    }

    // ticket must belong to customer
    const { data: ticket, error: tErr } = await req.sb
      .from("tickets")
      .select("id, customer_id, status")
      .eq("id", id)
      .eq("customer_id", req.user.id)
      .single();

    if (tErr || !ticket) return res.status(404).json({ message: "Ticket not found" });

    if (String(ticket.status || "").toLowerCase() !== "resolved") {
      return res.status(403).json({ message: "Feedback can only be submitted after the ticket is resolved." });
    }

    // prevent duplicates (one feedback per ticket)
    const { data: existing } = await req.sb.from("ticket_feedback").select("id").eq("ticket_id", id).maybeSingle();

    if (existing?.id) {
      return res.status(409).json({ message: "Feedback already submitted for this ticket." });
    }

    const payload = {
      ticket_id: id,
      stars: s,
      comment: comment ? String(comment).trim().slice(0, 1000) : null,
    };

    const { data, error } = await req.sb
      .from("ticket_feedback")
      .insert([payload])
      .select("id, ticket_id, stars, comment, created_at")
      .single();

    if (error) return res.status(400).json({ message: error.message });

    res.status(201).json({ success: true, feedback: data });
  } catch (err) {
    console.error("POST FEEDBACK ERROR:", err);
    res.status(500).json({ message: "Failed to submit feedback" });
  }
});

/* =========================
   Staff/Admin APIs
========================= */

// GET View all tickets (staff/admin)
router.get("/", requireStaffOrAdmin, async (req, res) => {
  try {
    const { data, error } = await req.sb
      .from("tickets_with_owner")
      .select(
        `
        id, ticket_number, customer_name, customer_email, customer_phone,
        order_id, category, subject, status, owner_id, owner_name, owner_email, created_at, updated_at,
        orders:order_id ( public_orderid )
      `
      )
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

// GET Assignees list (admin only) - staff + admin
router.get("/assignees/list", requireAdmin, async (req, res) => {
  try {
    const { data, error } = await req.sb
      .from("profiles")
      .select("id, display_name, email, role")
      .in("role", ["staff", "admin"])
      .order("role", { ascending: true })
      .order("display_name", { ascending: true });

    if (error) return res.status(400).json({ message: error.message });

    res.json({ success: true, assignees: data || [] });
  } catch (err) {
    console.error("GET ASSIGNEES ERROR:", err);
    res.status(500).json({ message: "Failed to load assignees" });
  }
});

// GET Ticket detail + comments + feedback (staff/admin)
router.get("/:id", requireStaffOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: ticket, error: tErr } = await req.sb
      .from("tickets")
      .select(
        `
        *,
        orders:order_id ( id, public_orderid ),
        owner:owner_id ( id, display_name, email )
      `
      )
      .eq("id", id)
      .single();

    if (tErr || !ticket) return res.status(404).json({ message: tErr?.message || "Ticket not found" });

    // comments
    let comments = [];
    try {
      const { data: cData, error: cErr } = await supabaseAdmin
        .from("ticket_comments")
        .select("id, ticket_id, author_role, author_email, message, created_at")
        .eq("ticket_id", id)
        .order("created_at", { ascending: true });

      if (!cErr && Array.isArray(cData)) comments = cData;
    } catch {
      // ignore
    }

    // feedback (use maybeSingle so no error when none)
    let feedback = null;
    try {
      const { data: fData, error: fErr } = await req.sb
        .from("ticket_feedback")
        .select("id, ticket_id, stars, comment, created_at")
        .eq("ticket_id", id)
        .maybeSingle();

      if (!fErr && fData) feedback = fData;
    } catch {
      // ignore
    }

    res.json({ success: true, ticket, comments, feedback });
  } catch (err) {
    console.error("GET TICKET DETAIL ERROR:", err);
    res.status(500).json({ message: "Failed to load ticket detail" });
  }
});

// POST Staff/Admin reply to ticket (only owner or admin)
router.post("/:id/comments", requireStaffOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body || {};

    if (!message || !String(message).trim()) {
      return res.status(400).json({ message: "message is required" });
    }

    const { data: ticket, error: tErr } = await req.sb.from("tickets").select("id, owner_id").eq("id", id).single();
    if (tErr || !ticket) return res.status(404).json({ message: "Ticket not found" });

    const admin = isAdminUser(req);
    const owner = ticket.owner_id && ticket.owner_id === req.user.id;

    if (!admin && !owner) {
      return res.status(403).json({ message: "Assign this ticket to yourself first." });
    }

    const payload = {
      ticket_id: id,
      author_role: admin ? "admin" : "staff",
      author_email: req.user.email || "",
      message: String(message).trim(),
    };

    const { data, error } = await supabaseAdmin
      .from("ticket_comments")
      .insert([payload])
      .select("id, ticket_id, author_role, author_email, message, created_at")
      .single();

    if (error) return res.status(400).json({ message: error.message });

    res.status(201).json({ success: true, comment: data });
  } catch (err) {
    console.error("POST COMMENT ERROR:", err);
    res.status(500).json({ message: "Failed to post comment" });
  }
});

// PATCH Assign Ticket to Self (staff/admin)
router.patch("/:id/assign-self", requireStaffOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};

    const { data: existing, error: findErr } = await req.sb
      .from("tickets")
      .select("id, owner_id, status")
      .eq("id", id)
      .single();

    if (findErr || !existing) return res.status(404).json({ message: "Ticket not found" });

    const admin = isAdminUser(req);

    if (!admin && existing.owner_id && existing.owner_id !== req.user.id) {
      if ((existing.status || "").toLowerCase() !== "reopened") {
        return res.status(403).json({ message: "Ticket is assigned to another staff." });
      }
    }

    const payload = {
      owner_id: req.user.id,
      status: "In Progress",
    };

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

    const { data: existing, error: findErr } = await req.sb.from("tickets").select("id, owner_id").eq("id", id).single();
    if (findErr || !existing) return res.status(404).json({ message: "Ticket not found" });

    const admin = isAdminUser(req);

    if (!admin && (!existing.owner_id || existing.owner_id !== req.user.id)) {
      return res.status(403).json({ message: "Assign this ticket to yourself first." });
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

// PATCH Admin assign Ticket to Owner (staff/admin) OR unassign (admin only)
router.patch("/:id/assign-owner", requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { owner_id, status } = req.body || {};

    if (owner_id === undefined) {
      return res.status(400).json({ message: "owner_id is required (can be null)" });
    }

    let assignedProfile = null;

    if (owner_id) {
      const { data: profile, error: pErr } = await req.sb
        .from("profiles")
        .select("id, role, display_name, email")
        .eq("id", owner_id)
        .single();

      if (pErr || !profile) return res.status(400).json({ message: "Invalid owner_id" });

      const r = String(profile.role || "").toLowerCase();
      if (r !== "staff" && r !== "admin") {
        return res.status(400).json({ message: "owner_id must belong to a staff/admin user" });
      }

      assignedProfile = profile;
    }

    const payload = { owner_id: owner_id || null };

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
      assigned_to: assignedProfile
        ? { id: assignedProfile.id, name: assignedProfile.display_name, email: assignedProfile.email, role: assignedProfile.role }
        : null,
    });
  } catch (err) {
    console.error("ASSIGN OWNER ERROR:", err);
    res.status(500).json({ message: "Failed to assign ticket owner" });
  }
});

module.exports = router;
