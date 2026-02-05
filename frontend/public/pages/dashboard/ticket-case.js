// SEP_SaigonBistro/frontend/public/pages/dashboard/ticket-case.js

import { initAuthUI, getAuthUser as readAuthUser } from "../../js/auth.js";

const caseTitle = document.getElementById("caseTitle");
const caseMeta = document.getElementById("caseMeta");
const caseActions = document.getElementById("caseActions");
const caseBody = document.getElementById("caseBody");
const notice = document.getElementById("notice");

const API_BASE = "http://localhost:3000";

let user = null;
let roleHeader = {};
let activeTicketId = null;
let latestPayload = null;

/* ------------------ helpers ------------------ */

function formatDT(v) {
  if (!v) return "-";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "-" : d.toLocaleString();
}

function escapeHtml(s = "") {
  return String(s).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[m]));
}

function showNotice(type, msg) {
  // type: "success" | "error" | "info"
  notice.classList.remove(
    "hidden",
    "border-green-200",
    "bg-green-50",
    "text-green-800",
    "border-red-200",
    "bg-red-50",
    "text-red-800",
    "border-slate-200",
    "bg-slate-50",
    "text-slate-700"
  );

  if (type === "success") notice.classList.add("border-green-200", "bg-green-50", "text-green-800");
  else if (type === "error") notice.classList.add("border-red-200", "bg-red-50", "text-red-800");
  else notice.classList.add("border-slate-200", "bg-slate-50", "text-slate-700");

  notice.textContent = msg;
  setTimeout(() => notice.classList.add("hidden"), 3500);
}

function getTicketIdFromURL() {
  const url = new URL(window.location.href);
  return url.searchParams.get("id");
}

function badgeClassForStatus(status) {
  const s = (status ?? "").toString().trim().toLowerCase();
  if (s === "resolved") return "bg-green-100 text-green-800";
  if (s === "in progress") return "bg-yellow-100 text-yellow-800";
  if (s === "pending review") return "bg-purple-100 text-purple-800";
  if (s === "waiting customer response") return "bg-orange-100 text-orange-800";
  if (s === "reopened") return "bg-red-100 text-red-800";
  if (s === "new") return "bg-blue-100 text-blue-800";
  return "bg-slate-100 text-slate-800";
}

function starsHTML(n) {
  const count = Number(n || 0);
  const full = Math.max(0, Math.min(5, count));
  const empty = 5 - full;
  return `<span class="text-lg">${"★".repeat(full)}${"☆".repeat(empty)}</span>`;
}

/* ------------------ api ------------------ */

async function fetchTicketDetail(id) {
  const res = await fetch(`${API_BASE}/api/tickets/${encodeURIComponent(id)}`, {
    headers: { ...roleHeader },
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || `Failed to load ticket (${res.status})`);
  return json;
}

// POST /api/tickets/:id/comments  { message }
async function postStaffReply(ticketId, message) {
  const res = await fetch(`${API_BASE}/api/tickets/${encodeURIComponent(ticketId)}/comments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...roleHeader,
    },
    body: JSON.stringify({ message }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || `Failed to send reply (${res.status})`);
  return json;
}

// PATCH /api/tickets/:id/assign-self
async function assignTicketToSelf(ticketId) {
  const res = await fetch(`${API_BASE}/api/tickets/${encodeURIComponent(ticketId)}/assign-self`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...roleHeader,
    },
    body: JSON.stringify({}),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || `Failed to assign ticket (${res.status})`);
  return json;
}

// PATCH /api/tickets/:id/status  { status }
async function updateTicketStatus(ticketId, status) {
  const res = await fetch(`${API_BASE}/api/tickets/${encodeURIComponent(ticketId)}/status`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...roleHeader,
    },
    body: JSON.stringify({ status }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || `Failed to update status (${res.status})`);
  return json;
}

/* ------------------ render ------------------ */

function renderActions(t) {
  const status = (t.status ?? "New").toString();
  const ownerId = t.owner_id ?? null;
  const isMine = ownerId && user?.id && ownerId === user.id;

  const STATUS_OPTIONS = [
    "New",
    "Pending Review",
    "In Progress",
    "Waiting Customer Response",
    "Resolved",
    "Reopened",
  ];

  caseActions.innerHTML = `
    <span class="inline-flex items-center rounded-full px-3 py-1.5 text-sm font-semibold ${badgeClassForStatus(status)}">
      ${escapeHtml(status)}
    </span>

    <button id="btnAssignMe"
      class="rounded-xl px-3 py-2 text-sm font-semibold border hover:bg-black/5"
      ${isMine ? "disabled" : ""}>
      ${isMine ? "Assigned to you" : "Assign to me"}
    </button>

    <select id="statusSelect" class="rounded-xl border px-3 py-2 text-sm">
      ${STATUS_OPTIONS.map(
        (opt) => `
          <option value="${escapeHtml(opt)}" ${opt.toLowerCase() === status.toLowerCase() ? "selected" : ""}>
            ${escapeHtml(opt)}
          </option>
        `
      ).join("")}
    </select>

    <button id="btnUpdateStatus"
      class="rounded-xl px-3 py-2 text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800">
      Update
    </button>

    <button id="btnRefresh"
      class="rounded-xl px-3 py-2 text-sm font-semibold border hover:bg-black/5">
      Refresh
    </button>
  `;
}

function renderDetail(payload) {
  latestPayload = payload;

  const t = payload.ticket;
  const comments = Array.isArray(payload.comments) ? payload.comments : [];
  const feedback = payload.feedback || null;

  const ticketLabel = t.ticket_number ?? t.id;
  caseTitle.textContent = `Ticket #${ticketLabel}`;
  caseMeta.textContent = `Created: ${formatDT(t.created_at)} · Updated: ${formatDT(t.updated_at)}`;

  renderActions(t);

  const statusLower = (t.status ?? "").toString().toLowerCase();

  // If backend returns joined owner profile, prefer it; else fallback to UUID
  const ownerName =
    t.owner?.display_name ||
    t.owner?.name ||
    t.owner_display_name ||
    (t.owner_id ? t.owner_id : "Unassigned");

  caseBody.innerHTML = `
    <!-- Ticket info -->
    <div class="border rounded-2xl p-4 bg-white space-y-2">
      <div class="text-sm font-bold">Ticket Info</div>
      <div class="text-sm text-slate-700 grid grid-cols-1 md:grid-cols-2 gap-2">
        <div><span class="font-semibold">Category:</span> ${escapeHtml(t.category ?? "-")}</div>
        <div><span class="font-semibold">Order ID:</span> ${escapeHtml(t.order_id ?? "-")}</div>
        <div><span class="font-semibold">Customer:</span> ${escapeHtml(t.customer_name ?? "-")} (${escapeHtml(
          t.customer_email ?? "-"
        )})</div>
        <div><span class="font-semibold">Phone:</span> ${escapeHtml(t.customer_phone ?? "-")}</div>
        <div><span class="font-semibold">Owner (staff):</span> ${escapeHtml(ownerName)}</div>
        <div><span class="font-semibold">Ticket Number:</span> ${escapeHtml(t.ticket_number ?? "-")}</div>
      </div>

      <div class="pt-2">
        <div class="text-sm font-bold">Subject</div>
        <div class="text-sm text-slate-700">${escapeHtml(t.subject ?? "-")}</div>
      </div>

      <div class="pt-2">
        <div class="text-sm font-bold">Description</div>
        <div class="text-sm text-slate-700 whitespace-pre-wrap">${escapeHtml(t.description ?? "-")}</div>
      </div>
    </div>

    <!-- Reply box (staff) -->
    <div class="border rounded-2xl p-4 bg-white">
      <div class="flex items-center justify-between gap-3">
        <div class="text-sm font-bold">Staff Reply</div>
        <div class="text-xs text-slate-500">This message will appear to the customer</div>
      </div>

      <form id="replyForm" class="mt-3 space-y-3">
        <textarea id="replyText" rows="4" required maxlength="2000"
          class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900"
          placeholder="Write your response..."></textarea>

        <div class="flex items-center justify-end gap-2">
          <button id="btnSendReply" type="submit"
            class="rounded-xl px-4 py-2 text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800">
            Send reply
          </button>
        </div>
      </form>
    </div>

    <!-- Conversation -->
    <div class="border rounded-2xl p-4 bg-white">
      <div class="flex items-center justify-between">
        <div class="text-sm font-bold">Conversation</div>
        <div class="text-xs text-slate-500">${comments.length} message(s)</div>
      </div>

      <div class="mt-3 space-y-3">
        ${
          comments.length
            ? comments
                .map((c) => {
                  const role = String(c.author_role || "").toLowerCase();
                  const isStaffSide = role === "staff" || role === "admin";
                  return `
                    <div class="border rounded-xl p-3 ${isStaffSide ? "bg-blue-50" : "bg-slate-50"}">
                      <div class="flex items-center justify-between gap-3">
                        <div class="text-xs font-semibold text-slate-700">
                          ${(c.author_role ?? "user").toString().toUpperCase()}
                          ${c.author_email ? `· ${escapeHtml(c.author_email)}` : ""}
                        </div>
                        <div class="text-xs text-slate-500">${formatDT(c.created_at)}</div>
                      </div>
                      <div class="mt-1 text-sm text-slate-700 whitespace-pre-wrap">${escapeHtml(c.message ?? "")}</div>
                    </div>
                  `;
                })
                .join("")
            : `<div class="text-sm text-slate-600">No comments yet.</div>`
        }
      </div>
    </div>

    <!-- Feedback -->
    <div class="border rounded-2xl p-4 bg-white">
      <div class="text-sm font-bold">Customer Feedback</div>

      ${
        statusLower === "resolved"
          ? feedback
            ? `
              <div class="mt-2 flex items-center gap-3">
                ${starsHTML(feedback.stars)}
                <div class="text-sm text-slate-700">${escapeHtml(feedback.comment ?? "")}</div>
              </div>
              <div class="mt-1 text-xs text-slate-500">Submitted: ${formatDT(feedback.created_at)}</div>
            `
            : `<div class="mt-2 text-sm text-slate-600">No feedback submitted yet.</div>`
          : `<div class="mt-2 text-sm text-slate-600">Feedback appears after the case is resolved.</div>`
      }
    </div>
  `;

  wireEventsAfterRender();
}

function wireEventsAfterRender() {
  // Assign to me
  document.getElementById("btnAssignMe")?.addEventListener("click", async () => {
    try {
      await assignTicketToSelf(activeTicketId);
      showNotice("success", "Ticket assigned to you.");
      await reload();
    } catch (e) {
      showNotice("error", e.message || "Failed to assign ticket.");
    }
  });

  // Update status
  document.getElementById("btnUpdateStatus")?.addEventListener("click", async () => {
    const nextStatus = document.getElementById("statusSelect")?.value;
    if (!nextStatus) return;

    try {
      await updateTicketStatus(activeTicketId, nextStatus);
      showNotice("success", `Status updated to "${nextStatus}".`);
      await reload();
    } catch (e) {
      showNotice("error", e.message || "Failed to update status.");
    }
  });

  // Refresh
  document.getElementById("btnRefresh")?.addEventListener("click", async () => {
    await reload();
  });

  // Reply submit
  document.getElementById("replyForm")?.addEventListener("submit", async (ev) => {
    ev.preventDefault();

    const textarea = document.getElementById("replyText");
    const btn = document.getElementById("btnSendReply");

    const message = (textarea?.value || "").trim();
    if (!message) return;

    btn.disabled = true;

    try {
      await postStaffReply(activeTicketId, message);
      textarea.value = "";
      showNotice("success", "Reply sent.");
      await reload();
    } catch (e) {
      showNotice("error", e.message || "Failed to send reply.");
    } finally {
      btn.disabled = false;
    }
  });
}

/* ------------------ load ------------------ */

async function reload() {
  try {
    const payload = await fetchTicketDetail(activeTicketId);
    renderDetail(payload);
  } catch (e) {
    console.error(e);
    caseBody.innerHTML = `
      <div class="p-4 border rounded-2xl bg-red-50 text-red-700">
        ${escapeHtml(e.message || "Failed to load ticket.")}
      </div>
    `;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  initAuthUI({ redirectOnLogout: "/index.html" });

  user = await readAuthUser();
  roleHeader = user?.token ? { Authorization: `Bearer ${user.token}` } : {};

  const role = user?.role?.toLowerCase();
  if (!user || !["admin", "staff"].includes(role)) {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/login/login.html?next=${next}`;
    return;
  }

  activeTicketId = getTicketIdFromURL();
  if (!activeTicketId) {
    caseBody.innerHTML = `<div class="p-4 border rounded-2xl bg-red-50 text-red-700">Missing ticket id.</div>`;
    return;
  }

  await reload();
});
