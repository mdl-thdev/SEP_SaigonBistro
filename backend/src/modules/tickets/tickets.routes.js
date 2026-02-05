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

// GET My ticket detail + comments (customer)
router.get("/mine/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // 1) ticket must belong to customer
    const { data: ticket, error: tErr } = await req.sb
      .from("tickets")
      .select("id, ticket_number, category, subject, description, status, created_at, updated_at")
      .eq("id", id)
      .eq("customer_id", req.user.id)
      .single();

    if (tErr || !ticket) return res.status(404).json({ message: "Ticket not found" });

    // 2) comments
    const { data: comments, error: cErr } = await supabaseAdmin
      .from("ticket_comments")
      .select("id, author_role, author_email, message, created_at")
      .eq("ticket_id", id)
      .order("created_at", { ascending: true });

    if (cErr) console.error("TICKET COMMENTS ERROR:", cErr);

    // compute allow_customer_reply
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
    } catch (e) {
      // if error, default allow (and server still enforces on POST)
    } res.json({
      success: true,
      ticket,
      comments: Array.isArray(comments) ? comments : [],
      allow_customer_reply,
      reply_deadline,
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

    if (lcErr) {
      console.error("LAST STAFF COMMENT ERROR:", lcErr);
    }

    // 3) Enforce 5-day rule:
    // - If there is a staff/admin reply, customer can reply only within 5 days from that time
    // - If there is NO staff/admin reply yet, allow customer to add more info anytime
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

    // 5) If ticket was Resolved, set to Reopened (keep owner_id so staff can continue)
    // You can decide if you want "Reopened" or "Waiting Customer Response".
    const nextStatus = ticket.status === "Resolved" ? "Reopened" : ticket.status;

    if (nextStatus !== ticket.status) {
      await req.sb
        .from("tickets")
        .update({ status: nextStatus })
        .eq("id", id);
    }

    res.status(201).json({ success: true, comment, status: nextStatus });
  } catch (err) {
    console.error("CUSTOMER POST COMMENT ERROR:", err);
    res.status(500).json({ message: "Failed to post reply" });
  }
});


/* =========================
   Staff/Admin APIs
========================= */

// GET View all tickets (staff/admin)
router.get("/", requireStaffOrAdmin, async (req, res) => {
  try {
    const { data, error } = await req.sb
      .from("tickets")
      .select(
        "id, ticket_number, customer_name, customer_email, customer_phone, order_id, category, subject, status, owner_id, created_at, updated_at"
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

// GET Ticket detail + comments + feedback (staff/admin)
router.get("/:id", requireStaffOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: ticket, error: tErr } = await req.sb.from("tickets").select("*").eq("id", id).single();
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
      // ignore if table doesn't exist
    }

    // feedback
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
// - staff can only take unassigned tickets (or re-assign to themselves if already theirs)
// - admin can self-assign anytime
router.patch("/:id/assign-self", requireStaffOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};

    const { data: existing, error: findErr } = await req.sb
      .from("tickets")
      .select("id, owner_id")
      .eq("id", id)
      .single();

    if (findErr || !existing) return res.status(404).json({ message: "Ticket not found" });

    const admin = isAdminUser(req);

    // staff cannot steal ticket from another staff
    if (!admin && existing.owner_id && existing.owner_id !== req.user.id) {
      return res.status(403).json({ message: "Ticket is already assigned to another staff." });
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
// - staff: only if assigned owner
// - admin: allowed anytime
router.patch("/:id/status", requireStaffOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};

    if (!status || !TICKET_STATUSES.has(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const { data: existing, error: findErr } = await req.sb
      .from("tickets")
      .select("id, owner_id")
      .eq("id", id)
      .single();

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

// PATCH Admin assign Ticket to Staff (admin only)
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
