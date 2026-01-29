// SEP_SaigonBistro/frontend/public/pages/help/caseDetail.js

import { supabase } from "/js/supabaseClient.js";
import { initAuthUI } from "/js/auth.js";

const API_BASE = "http://127.0.0.1:3000";

function showNotice(message, type = "info") {
  const el = document.getElementById("notice");
  if (!el) return;

  el.classList.remove(
    "hidden",
    "border-amber-200", "bg-amber-50", "text-amber-900",
    "border-green-200", "bg-green-50", "text-green-900",
    "border-red-200", "bg-red-50", "text-red-900"
  );

  if (type === "success") el.classList.add("border-green-200", "bg-green-50", "text-green-900");
  else if (type === "error") el.classList.add("border-red-200", "bg-red-50", "text-red-900");
  else el.classList.add("border-amber-200", "bg-amber-50", "text-amber-900");

  el.textContent = message;
}

function roleLabel(role) {
  if (role === "staff" || role === "admin") return "Support Team";
  if (role === "customer") return "You";
  return "Support";
}

function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

async function apiFetch(path) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated.");

  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || "Request failed");
  return json;
}

function renderMeta(metaEl, t) {
  if (!metaEl || !t) return;

  metaEl.innerHTML = ""; // clear

  const grid = document.createElement("div");
  grid.className = "grid grid-cols-1 sm:grid-cols-2 gap-3";

  const item = (label, value, { span2 = false } = {}) => {
    const div = document.createElement("div");
    if (span2) div.className = "sm:col-span-2";

    const l = document.createElement("span");
    l.className = "font-semibold";
    l.textContent = `${label}: `;

    const v = document.createElement("span");
    v.textContent = value ?? "-";

    div.appendChild(l);
    div.appendChild(v);
    return div;
  };

  grid.appendChild(item("Ticket #", t.ticket_number || "-"));
  grid.appendChild(item("Status", t.status || "-"));
  grid.appendChild(item("Category", t.category || "-"));
  grid.appendChild(item("Updated", formatDate(t.updated_at)));
  grid.appendChild(item("Subject", t.subject || "-", { span2: true }));

  metaEl.appendChild(grid);
}

function renderComments(commentsList, comments) {
  if (!commentsList) return;

  if (!Array.isArray(comments) || comments.length === 0) {
    commentsList.innerHTML = "";
    const p = document.createElement("p");
    p.className = "text-sm text-slate-500";
    p.textContent = "No replies yet. Our team will respond soon.";
    commentsList.appendChild(p);
    return;
  }

  commentsList.innerHTML = "";

  for (const c of comments) {
    const isCustomer = c?.author_role === "customer";

    const wrapper = document.createElement("div");
    wrapper.className = `rounded-xl border p-4 ${
      isCustomer ? "bg-slate-50 border-slate-200" : "bg-green-50 border-green-200"
    }`;

    const header = document.createElement("div");
    header.className = "flex items-center justify-between mb-1";

    const who = document.createElement("span");
    who.className = "text-sm font-semibold";
    who.textContent = roleLabel(c?.author_role);

    const when = document.createElement("span");
    when.className = "text-xs text-slate-500";
    when.textContent = formatDate(c?.created_at);

    header.appendChild(who);
    header.appendChild(when);

    const msg = document.createElement("p");
    msg.className = "text-sm whitespace-pre-wrap text-slate-800";
    msg.textContent = c?.message || "";

    wrapper.appendChild(header);
    wrapper.appendChild(msg);

    commentsList.appendChild(wrapper);
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  await initAuthUI({ redirectAdminStaffTo: "/pages/dashboard/dashboard.html" });

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/pages/login/login.html?next=${next}`;
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  if (!id) {
    showNotice("Missing case id.", "error");
    return;
  }

  try {
    const json = await apiFetch(`/api/tickets/mine/${encodeURIComponent(id)}`);
    const t = json?.ticket;
    const comments = Array.isArray(json?.comments) ? json.comments : [];

    if (!t) {
      showNotice("Ticket not found.", "error");
      return;
    }

    const meta = document.getElementById("caseMeta");
    const desc = document.getElementById("caseDesc");
    const commentsList = document.getElementById("commentsList");

    renderMeta(meta, t);

    if (desc) desc.textContent = t.description || "";

    renderComments(commentsList, comments);
  } catch (e) {
    showNotice(e?.message || "Failed to load case detail.", "error");
  }
});
