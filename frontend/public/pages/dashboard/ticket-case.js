// SEP_SaigonBistro/frontend/public/pages/dashboard/ticket-case.js

import { initAuthUI, getAuthUser as readAuthUser } from "../../js/auth.js";
import { API_BASE_URL } from "../../js/api.js";

// DOM element, Reads elements from the HTML using their IDs
const caseTitle = document.getElementById("caseTitle");
const caseMeta = document.getElementById("caseMeta");
let caseActions = document.getElementById("caseActions");
const caseBody = document.getElementById("caseBody");
const notice = document.getElementById("notice");

// Runtime state:
let user = null;  // user: logged-in user object from auth
let roleHeader = {};  // roleHeader: headers object containing Authorization token
let activeTicketId = null; // activeTicketId: ticket id from URL query string
let latestPayload = null; // latestPayload: last response from backend (ticket + comments + feedback), cached for modal usage

// Admin Assign modal state (frontend only)
let assigneesCache = []; // assigneesCache: list of possible assignees from the server
let selectedAssigneeId = null; // selectedAssigneeId: who is selected in the modal UI

/* ---------------- helpers ---------------- */

function formatDT(v) {
  if (!v) return "-";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString(); // Converts a date value into a readable local date string
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

function renderStars(n) {
  const s = Number(n) || 0;
  return Array.from({ length: 5 })
    .map((_, i) => (i < s ? "★" : "☆")) // Turns a number like 3 into "★★★☆☆"
    .join("");
}

function showNotice(type, msg) {
  if (!notice) return;

  notice.className = "mt-3 rounded-xl border px-4 py-3 text-sm";
  if (type === "success") notice.classList.add("border-green-200", "bg-green-50", "text-green-800");
  else if (type === "error") notice.classList.add("border-red-200", "bg-red-50", "text-red-800");
  else notice.classList.add("border-slate-200", "bg-slate-50", "text-slate-700");

  notice.textContent = msg;
  notice.classList.remove("hidden");
  setTimeout(() => notice.classList.add("hidden"), 3500);
}

function getTicketIdFromURL() {
  return new URL(window.location.href).searchParams.get("id");  // Reads the ?id=... query parameter from the current page URL
}

/* ---------------- api ---------------- */

// Makes a request to API_BASE_URL + path. Adds JSON content type plus auth header (roleHeader), plus any custom headers
async function api(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...roleHeader,
      ...(options.headers || {}),
    },
  });

  const json = await res.json().catch(() => ({}));  // Tries to parse JSON response
  if (!res.ok) throw new Error(json?.message || "Request failed"); // If HTTP status is not OK (like 400/401/500), throws an Error using server message if available
  return json; // Otherwise returns parsed JSON
}

// API calls
async function assignTicketToSelf(ticketId) {
  return api(`/api/tickets/${encodeURIComponent(ticketId)}/assign-self`, {
    method: "PATCH",
    body: JSON.stringify({}),
  });
}

async function updateTicketStatus(ticketId, status) {
  return api(`/api/tickets/${encodeURIComponent(ticketId)}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

async function postStaffReply(ticketId, message) {
  return api(`/api/tickets/${encodeURIComponent(ticketId)}/comments`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}

async function fetchAssignees() {
  return api(`/api/tickets/assignees/list`, { method: "GET" });  // Get list of possible assignees (admin feature)
}

async function assignTicketOwner(ticketId, owner_id) {
  return api(`/api/tickets/${encodeURIComponent(ticketId)}/assign-owner`, {
    method: "PATCH",
    body: JSON.stringify({ owner_id }),
  });
}

/* ---------------- Assign Modal ---------------- */

function closeAssignModal() {
  selectedAssigneeId = null;
  document.getElementById("assignModalOverlay")?.remove(); // Clears selected assignee and removes the modal overlay from the DOM
}

function openAssignModal(currentOwnerId) {
  selectedAssigneeId = currentOwnerId || null;  // Sets initial selection to current owner (if any), then draws modal
  renderAssignModal();
}

function renderAssignModal() {
  document.getElementById("assignModalOverlay")?.remove(); // Ensures only one modal exists (remove old one before creating new)
  const overlay = document.createElement("div");
  overlay.id = "assignModalOverlay";
  overlay.className = "fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4";

  overlay.innerHTML = `
    <div class="w-full max-w-xl rounded-2xl bg-white shadow-lg border">
      <div class="flex items-center justify-between px-4 py-3 border-b">
        <div class="text-sm font-bold">Assign Ticket</div>
        <button id="btnCloseAssignModal" class="rounded-lg px-2 py-1 text-sm border hover:bg-black/5">Close</button>
      </div>
      <div class="p-4 space-y-3">
        <input id="assigneeSearch" type="text" class="w-full rounded-xl border px-3 py-2 text-sm" placeholder="Search..." />
        <div class="border rounded-xl max-h-64 overflow-auto">
          <div id="assigneeList" class="p-2 space-y-2"></div>
        </div>
        <div class="flex items-center justify-end gap-2 pt-2">
          <button id="btnUnassign" class="rounded-xl px-3 py-2 text-sm font-semibold border hover:bg-black/5">Unassign</button>
          <button id="btnConfirmAssign" class="rounded-xl px-4 py-2 text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800">Confirm</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay); // Injects modal HTML and attaches to page

  // Then it grabs modal elements
  const listEl = document.getElementById("assigneeList");
  const searchEl = document.getElementById("assigneeSearch");

  // Filters assignees by search query (matches display_name or email)
  function drawList(filter = "") {
    const q = filter.toLowerCase().trim();
    const rows = (assigneesCache || []).filter(a => 
      !q || (a.display_name || '').toLowerCase().includes(q) || (a.email || '').toLowerCase().includes(q)
    );
    // Renders each assignee as a button
    listEl.innerHTML = rows.map(a => `
      <button data-id="${a.id}" class="w-full text-left rounded-xl border px-3 py-2 ${selectedAssigneeId === a.id ? "bg-slate-50 border-slate-400" : ""}">
        <div class="text-sm font-semibold">${escapeHtml(a.display_name || a.email)}</div>
        <div class="text-xs text-slate-500">${escapeHtml(a.role.toUpperCase())}</div>
      </button>
    `).join("");

    // Clicking a row sets selectedAssigneeId and re-renders list so highlight updates
    listEl.querySelectorAll("button[data-id]").forEach(btn => {
      btn.onclick = () => { selectedAssigneeId = btn.dataset.id; drawList(searchEl.value); };
    });
  }
  drawList(""); // First render with no filter

  document.getElementById("btnCloseAssignModal").onclick = closeAssignModal;
  document.getElementById("btnUnassign").onclick = () => { selectedAssigneeId = null; drawList(searchEl.value); }; // Clears selection (unassign)
  // Calls backend to update owner, hows success message, closes modal, reloads ticket
  document.getElementById("btnConfirmAssign").onclick = async () => {
    await assignTicketOwner(activeTicketId, selectedAssigneeId);
    showNotice("success", "Assignment updated.");
    closeAssignModal();
    await reload();
  };
}

/* ---------------- render ---------------- */

// Rendering ticket header actions
function renderHeaderBadges(t, ctx) {
  const { canWork, canClaim, isAdmin } = ctx;  // Reads permissions and defines allowed statuses for dropdown
  const STATUS_OPTIONS = ["New", "Pending Review", "In Progress", "Waiting Customer Response", "Resolved", "Reopened"];

  caseActions.innerHTML = `
    <div class="flex flex-wrap items-center gap-3">
      <div class="flex flex-wrap items-center gap-2 md:ml-auto">
        ${canClaim ? `
          <button id="btnAssignMe" type="button" class="rounded-xl px-4 py-2 text-sm font-semibold bg-white border hover:bg-slate-50">
            Assign to me
          </button>
        ` : ""}

        ${isAdmin ? `
          <button id="btnAssign" type="button" class="rounded-xl px-4 py-2 text-sm font-semibold bg-white border hover:bg-slate-50">
            Assign ticket
          </button>
        ` : ""}

        ${canWork ? `
          <div class="flex items-center gap-2">
            <select id="statusSelect" class="rounded-xl border px-3 py-2 text-sm bg-white">
              ${STATUS_OPTIONS.map(s => `<option value="${escapeHtml(s)}" ${String(t.status || "") === s ? "selected" : ""}>${escapeHtml(s)}</option>`).join("")}
            </select>
            <button id="btnUpdateStatus" type="button" class="rounded-xl px-4 py-2 text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800">
              Update status
            </button>
          </div>
        ` : ""}
      </div>
    </div>
  `;
}

// Rendering the ticket detail
function renderDetail(payload) {
  // Saves payload and extracts ticket/comments/feedback safely
  latestPayload = payload;
  const t = payload.ticket || {};
  const comments = Array.isArray(payload.comments) ? payload.comments : [];
  const feedback = payload.feedback || null;

  // Permissions:
  const role = String(user?.role || "").toLowerCase();
  const isAdmin = role === "admin";
  const isOwner = t.owner_id === user?.id;
  const canWork = isAdmin || isOwner;
  const statusLower = String(t.status || "").toLowerCase();
  const canClaim = !isOwner && (isAdmin || !t.owner_id || statusLower === "reopened");

  // Uses nested owner object if present, otherwise fallback
  const ownerName = t.owner?.display_name || t.owner?.email || (t.owner_id ? t.owner_id : "Unassigned");
  // Conversation thread:
  const thread = [{ author_role: "customer", message: t.description || "", created_at: t.created_at }, ...comments]
    .filter(m => String(m.message || "").trim().length > 0);

  caseTitle.textContent = `Ticket #${t.ticket_number || t.id || ""}`;
  if (caseMeta) caseMeta.textContent = "";

  const feedbackBlock = feedback ? `
    <div class="border rounded-2xl p-4 bg-white mt-4">
      <div class="flex items-center justify-between"><div class="text-sm font-bold">Customer Feedback</div>
      <div class="text-sm font-semibold"><span class="text-amber-500">${renderStars(feedback.stars)}</span> <span class="ml-2">${feedback.stars}/5</span></div></div>
      <div class="mt-2 text-sm text-slate-700 whitespace-pre-wrap">${escapeHtml(feedback.comment || "No comment provided.")}</div>
      <div class="mt-2 text-xs text-slate-500">Submitted: ${formatDT(feedback.created_at)}</div>
    </div>` : `
    <div class="border rounded-2xl p-4 bg-white mt-4">
      <div class="text-sm font-bold">Customer Feedback</div>
      <div class="mt-2 text-sm text-slate-500">No feedback submitted yet.</div>
    </div>`;

  caseBody.innerHTML = `
    <div class="border rounded-2xl p-4 bg-white space-y-2">
      <div class="text-sm font-bold">Ticket Info</div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
        <div><b>Status:</b> ${escapeHtml(t.status || "-")}</div>
        <div><b>Customer:</b> ${escapeHtml(t.customer_name || "-")} (${escapeHtml(t.customer_email || "-")})</div>
        <div><b>Category:</b> ${escapeHtml(t.category || "-")}</div>
        <div><b>Owner:</b> ${escapeHtml(ownerName)}</div>
        
        <div><b>Created:</b> ${formatDT(t.created_at)}</div>
        <div><b>Subject:</b> ${escapeHtml(t.subject || "-")}</div>
        <div><b>Updated:</b> ${formatDT(t.updated_at)}</div>
      </div>
    </div>

    <div id="caseActionsInline" class="mt-4 p-4 border rounded-2xl bg-slate-50"></div>

    <div class="border rounded-2xl p-4 bg-white mt-4">
      <div class="text-sm font-bold mb-2">Conversation</div>
      <div class="space-y-3">
        ${thread.map(c => {
          const isStaffSide = ["staff", "admin"].includes(String(c.author_role || "").toLowerCase());
          return `
            <div class="border rounded-xl p-3 ${isStaffSide ? "bg-blue-50" : "bg-slate-50"}">
              <div class="flex items-center justify-between gap-3">
                <div class="text-xs font-semibold">${escapeHtml(String(c.author_role || "user").toUpperCase())}</div>
                <div class="text-xs text-slate-500">${formatDT(c.created_at)}</div>
              </div>
              <div class="mt-1 text-sm whitespace-pre-wrap">${escapeHtml(c.message || "")}</div>
            </div>`;
        }).join("")}
      </div>
      ${canWork ? `
        <div class="mt-4 border-t pt-4">
          <form id="replyForm" class="space-y-3" autocomplete="off">
            <textarea id="replyText" rows="4" required maxlength="2000" class="w-full rounded-xl border px-3 py-2 text-sm" placeholder="Write your response..."></textarea>
            <div class="flex justify-end"><button id="btnSendReply" type="submit" class="rounded-xl px-4 py-2 text-sm font-semibold bg-slate-900 text-white">Send reply</button></div>
          </form>
        </div>` : ""}
    </div>
    ${feedbackBlock}
  `;

  // Replaces the caseActions reference so action buttons render inside the body area
  caseActions = document.getElementById("caseActionsInline") || caseActions;

  // Draws the buttons/dropdowns and hooks their click handlers
  renderHeaderBadges(t, { canWork, canClaim, isAdmin });
  wireEvents({ canWork, canClaim, isAdmin });
}

/* ---------------- events ---------------- */

// Wiring events (buttons/forms)
function wireEvents({ canWork, canClaim, isAdmin }) {
  // Assign to me, Calls API, shows notice, reloads
  document.getElementById("btnAssignMe")?.addEventListener("click", async () => {
    try {
      await assignTicketToSelf(activeTicketId);
      showNotice("success", "Ticket assigned to you.");
      await reload();
    } catch (e) { showNotice("error", e.message); }
  });
  
  // Update status: Reads dropdown value and PATCHes it
  document.getElementById("btnUpdateStatus")?.addEventListener("click", async () => {
    const status = document.getElementById("statusSelect")?.value;
    try {
      await updateTicketStatus(activeTicketId, status);
      showNotice("success", "Status updated.");
      await reload();
    } catch (e) { showNotice("error", e.message); }
  });

  // Reply form submit:
  document.getElementById("replyForm")?.addEventListener("submit", async (e) => {
    e.preventDefault(); // Prevents page reload
    const textarea = document.getElementById("replyText"); // Sends comment
    const message = textarea.value.trim(); // Clears textarea and reloads
    if (!message) return;
    try {
      await postStaffReply(activeTicketId, message);
      textarea.value = "";
      showNotice("success", "Reply sent.");
      await reload();
    } catch (err) { showNotice("error", err.message); }
  });

  // Admin assign modal button:If no cached assignees, fetch once, Opens modal with current owner pre-selected
  document.getElementById("btnAssign")?.addEventListener("click", async () => {
    if (!assigneesCache.length) {
      const out = await fetchAssignees();
      assigneesCache = out.assignees || [];
    }
    openAssignModal(latestPayload?.ticket?.owner_id);
  });
}

// Reloading ticket data from server: Calls backend to get ticket detail payload
async function reload() {
  try {
    const payload = await api(`/api/tickets/${encodeURIComponent(activeTicketId)}`);
    renderDetail(payload);
  } catch (e) {
    caseBody.innerHTML = `<div class="p-4 border rounded-2xl bg-red-50 text-red-700">${escapeHtml(e.message)}</div>`;
  }
}

// Page startup (DOMContentLoaded)
document.addEventListener("DOMContentLoaded", async () => {
  initAuthUI({ redirectOnLogout: "/index.html" });
  user = await readAuthUser();
  if (!user || !["admin", "staff"].includes(String(user.role || "").toLowerCase())) {
    window.location.href = "/pages/login/login.html";
    return;
  }
  roleHeader = { Authorization: `Bearer ${user.token}` };
  activeTicketId = getTicketIdFromURL();
  if (!activeTicketId) {
    caseBody.innerHTML = `<div class="p-4 border rounded-2xl bg-red-50 text-red-700">Missing ticket id.</div>`;
    return;
  }
  await reload();
});