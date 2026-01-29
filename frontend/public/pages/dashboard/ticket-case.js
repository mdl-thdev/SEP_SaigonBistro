// SEP_SaigonBistro/frontend/public/pages/dashboard/ticket-case.js

import { initAuthUI, getAuthUser as readAuthUser } from "../../js/auth.js";

const caseTitle = document.getElementById("caseTitle");
const caseMeta = document.getElementById("caseMeta");
const caseActions = document.getElementById("caseActions");
const caseBody = document.getElementById("caseBody");

let user = null;
let roleHeader = {};

function formatDT(v) {
  if (!v) return "-";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "-" : d.toLocaleString();
}

function starsHTML(n) {
  const count = Number(n || 0);
  const full = Math.max(0, Math.min(5, count));
  const empty = 5 - full;
  return `<span class="text-lg">${"★".repeat(full)}${"☆".repeat(empty)}</span>`;
}

function getTicketIdFromURL() {
  const url = new URL(window.location.href);
  return url.searchParams.get("id");
}

async function fetchTicketDetail(id) {
  const res = await fetch(`http://localhost:3000/api/tickets/${encodeURIComponent(id)}`, {
    headers: { ...roleHeader },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to load ticket (${res.status})`);
  }

  return res.json();
}

function renderDetail(payload) {
  const t = payload.ticket;
  const comments = Array.isArray(payload.comments) ? payload.comments : [];
  const feedback = payload.feedback || null;

  const ticketLabel = t.ticket_number ?? t.id;
  caseTitle.textContent = `Ticket #${ticketLabel}`;
  caseMeta.textContent = `Created: ${formatDT(t.created_at)} · Updated: ${formatDT(t.updated_at)}`;

  const status = (t.status ?? "-").toString();
  const statusLower = status.toLowerCase();

  const badgeClass =
    statusLower === "resolved" ? "bg-green-100 text-green-800"
    : statusLower === "in progress" ? "bg-yellow-100 text-yellow-800"
    : statusLower === "new" ? "bg-blue-100 text-blue-800"
    : "bg-slate-100 text-slate-800";

  caseActions.innerHTML = `
    <span class="inline-flex items-center rounded-full px-3 py-1.5 text-sm font-semibold ${badgeClass}">
      ${status}
    </span>
  `;

  caseBody.innerHTML = `
    <div class="border rounded-2xl p-4 bg-white space-y-2">
      <div class="text-sm font-bold">Ticket Info</div>
      <div class="text-sm text-slate-700 grid grid-cols-1 md:grid-cols-2 gap-2">
        <div><span class="font-semibold">Category:</span> ${t.category ?? "-"}</div>
        <div><span class="font-semibold">Order ID:</span> ${t.order_id ?? "-"}</div>
        <div><span class="font-semibold">Customer:</span> ${t.customer_name ?? "-"} (${t.customer_email ?? "-"})</div>
        <div><span class="font-semibold">Phone:</span> ${t.customer_phone ?? "-"}</div>
        <div><span class="font-semibold">Owner (staff):</span> ${t.owner_id ?? "Unassigned"}</div>
        <div><span class="font-semibold">Ticket Number:</span> ${t.ticket_number ?? "-"}</div>
      </div>

      <div class="pt-2">
        <div class="text-sm font-bold">Subject</div>
        <div class="text-sm text-slate-700">${t.subject ?? "-"}</div>
      </div>

      <div class="pt-2">
        <div class="text-sm font-bold">Description</div>
        <div class="text-sm text-slate-700 whitespace-pre-wrap">${t.description ?? "-"}</div>
      </div>
    </div>

    <div class="border rounded-2xl p-4 bg-white">
      <div class="flex items-center justify-between">
        <div class="text-sm font-bold">Comments</div>
        <div class="text-xs text-slate-500">${comments.length} message(s)</div>
      </div>

      <div class="mt-3 space-y-3">
        ${
          comments.length
            ? comments.map((c) => `
              <div class="border rounded-xl p-3 bg-slate-50">
                <div class="flex items-center justify-between gap-3">
                  <div class="text-xs font-semibold text-slate-700">
                    ${(c.author_role ?? "user").toString().toUpperCase()}
                    ${c.author_email ? `· ${c.author_email}` : ""}
                  </div>
                  <div class="text-xs text-slate-500">${formatDT(c.created_at)}</div>
                </div>
                <div class="mt-1 text-sm text-slate-700 whitespace-pre-wrap">${c.message ?? ""}</div>
              </div>
            `).join("")
            : `<div class="text-sm text-slate-600">No comments yet.</div>`
        }
      </div>
    </div>

    <div class="border rounded-2xl p-4 bg-white">
      <div class="text-sm font-bold">Customer Feedback</div>

      ${
        statusLower === "resolved"
          ? (feedback
              ? `
                <div class="mt-2 flex items-center gap-3">
                  ${starsHTML(feedback.stars)}
                  <div class="text-sm text-slate-700">${feedback.comment ?? ""}</div>
                </div>
                <div class="mt-1 text-xs text-slate-500">Submitted: ${formatDT(feedback.created_at)}</div>
              `
              : `<div class="mt-2 text-sm text-slate-600">No feedback submitted yet.</div>`
            )
          : `<div class="mt-2 text-sm text-slate-600">Feedback appears after the case is resolved.</div>`
      }
    </div>
  `;
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

  const id = getTicketIdFromURL();
  if (!id) {
    caseBody.innerHTML = `<div class="p-4 border rounded-2xl bg-red-50 text-red-700">Missing ticket id.</div>`;
    return;
  }

  try {
    const payload = await fetchTicketDetail(id);
    renderDetail(payload);
  } catch (e) {
    console.error(e);
    caseBody.innerHTML = `<div class="p-4 border rounded-2xl bg-red-50 text-red-700">${e.message || "Failed to load ticket."}</div>`;
  }
});
