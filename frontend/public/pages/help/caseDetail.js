// SEP_SaigonBistro/frontend/public/pages/help/caseDetail.js

import { supabase } from "/js/supabaseClient.js";
import { initAuthUI } from "/js/auth.js";

const API_BASE = "http://127.0.0.1:3000";

/* ------------------ api helpers ------------------ */

async function apiFetch(path) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated.");

  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || "Request failed");
  return json;
}

async function apiSend(path, method, body) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated.");

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body || {}),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || "Request failed");
  return json;
}

/* ------------------ ui helpers ------------------ */

function escapeHtml(s = "") {
  return String(s).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[m]));
}

function showNotice(message, type = "info") {
  const el = document.getElementById("notice");
  if (!el) return;

  el.classList.remove(
    "hidden",
    "border-amber-200",
    "bg-amber-50",
    "text-amber-900",
    "border-green-200",
    "bg-green-50",
    "text-green-900",
    "border-red-200",
    "bg-red-50",
    "text-red-900"
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

function renderMeta(metaEl, t) {
  if (!metaEl || !t) return;

  metaEl.innerHTML = "";

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

  grid.appendChild(item("Ticket Number", t.ticket_number || "-"));
  grid.appendChild(item("Email Address", t.customer_email || "-"));
  grid.appendChild(item("Issue Category", t.category || "-"));
  grid.appendChild(item("Created", formatDate(t.created_at)));
  grid.appendChild(item("Status", t.status || "-"));
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
    wrapper.className = `rounded-xl border p-4 ${isCustomer ? "bg-slate-50 border-slate-200" : "bg-green-50 border-green-200"
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

function setReplyAvailabilityUI({ allow_customer_reply, reply_deadline }) {
  const replyForm = document.getElementById("replyForm");
  const replyText = document.getElementById("replyText");
  const sendBtn = document.getElementById("btnSendReply");
  const banner = document.getElementById("replyClosedBanner");

  // Create banner if missing
  let b = banner;
  if (!b) {
    b = document.createElement("div");
    b.id = "replyClosedBanner";
    b.className = "hidden mt-3 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 px-4 py-3 text-sm";
    replyForm?.parentElement?.insertBefore(b, replyForm);
  }

  if (allow_customer_reply) {
    b.classList.add("hidden");
    if (replyText) replyText.disabled = false;
    if (sendBtn) sendBtn.disabled = false;
    if (replyForm) replyForm.classList.remove("opacity-50", "pointer-events-none");
  } else {
    const until = reply_deadline ? ` Reply window ended on ${formatDate(reply_deadline)}.` : "";
    b.textContent = `This case is closed for replies.${until}`;
    b.classList.remove("hidden");
    if (replyText) replyText.disabled = true;
    if (sendBtn) sendBtn.disabled = true;
    if (replyForm) replyForm.classList.add("opacity-50", "pointer-events-none");
  }
}

function renderFeedback(feedbackEl, t, feedback, id) {
  if (!feedbackEl) return;

  const status = String(t?.status || "").toLowerCase();
  feedbackEl.innerHTML = "";

  // Only show feedback section when resolved
  if (status !== "resolved") return;

  // If already submitted: show it
  if (feedback?.id) {
    const box = document.createElement("div");
    box.className = "rounded-2xl border border-slate-200 bg-slate-50 p-4";
    box.innerHTML = `
      <div class="text-sm font-bold">Your Feedback</div>
      <div class="mt-1 text-sm">Stars: ${"★".repeat(feedback.stars)}${"☆".repeat(5 - feedback.stars)}</div>
      ${feedback.comment
        ? `<div class="mt-2 text-sm text-slate-700 whitespace-pre-wrap">${escapeHtml(feedback.comment)}</div>`
        : ""
      }
      <div class="mt-2 text-xs text-slate-500">Submitted: ${formatDate(feedback.created_at)}</div>
    `;
    feedbackEl.appendChild(box);
    return;
  }

  // Otherwise show form
  const wrap = document.createElement("div");
  wrap.className = "rounded-2xl border bg-white p-4 space-y-3";

  wrap.innerHTML = `
    <div class="text-sm font-bold">Rate our support</div>

    <div class="flex gap-1 text-2xl select-none" aria-label="Star rating">
      ${[1, 2, 3, 4, 5]
      .map((n) => `<button type="button" class="starBtn" data-star="${n}" aria-label="${n} stars">☆</button>`)
      .join("")}
    </div>

    <textarea id="fbComment" rows="3" maxlength="1000"
      class="w-full rounded-xl border px-3 py-2 text-sm"
      placeholder="Optional comment..."></textarea>

    <div class="flex justify-end">
      <button id="btnSubmitFeedback"
        class="rounded-xl px-4 py-2 text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800">
        Submit feedback
      </button>
    </div>
  `;

  feedbackEl.appendChild(wrap);

  let selected = 0;
  const starButtons = wrap.querySelectorAll(".starBtn");
  const btn = wrap.querySelector("#btnSubmitFeedback");
  const commentEl = wrap.querySelector("#fbComment");

  function paint() {
    starButtons.forEach((b) => {
      const n = Number(b.dataset.star);
      b.textContent = n <= selected ? "★" : "☆";
    });
  }

  starButtons.forEach((b) => {
    b.addEventListener("click", () => {
      selected = Number(b.dataset.star);
      paint();
    });
  });

  btn.addEventListener("click", async () => {
    if (selected < 1 || selected > 5) {
      showNotice("Please select 1–5 stars.", "error");
      return;
    }
    try {
      btn.disabled = true;

      await apiSend(`/api/tickets/mine/${encodeURIComponent(id)}/feedback`, "POST", {
        stars: selected,
        comment: (commentEl.value || "").trim(),
      });

      showNotice("Thanks for your feedback!", "success");

      const json = await apiFetch(`/api/tickets/mine/${encodeURIComponent(id)}`);
      renderFeedback(feedbackEl, json.ticket, json.feedback, id);
    } catch (e) {
      showNotice(e?.message || "Failed to submit feedback.", "error");
    } finally {
      btn.disabled = false;
    }
  });

  paint();
}

/* ------------------ main ------------------ */

document.addEventListener("DOMContentLoaded", async () => {
  await initAuthUI({ redirectAdminStaffTo: "/pages/dashboard/dashboard.html" });

  const {
    data: { session },
  } = await supabase.auth.getSession();

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

  const replyForm = document.getElementById("replyForm");
  const replyText = document.getElementById("replyText");
  const sendBtn = document.getElementById("btnSendReply");

  const caseCard = document.getElementById("caseCard");
  const caseLoading = document.getElementById("caseLoading");

  function setLoading(isLoading) {
    if (caseLoading) caseLoading.classList.toggle("hidden", !isLoading);
    if (caseCard) caseCard.classList.toggle("hidden", isLoading);
  }

  async function loadAndRender() {
    const json = await apiFetch(`/api/tickets/mine/${encodeURIComponent(id)}`);
    const t = json?.ticket;
    const comments = Array.isArray(json?.comments) ? json.comments : [];

    if (!t) {
      showNotice("Ticket not found.", "error");
      return;
    }

    renderMeta(document.getElementById("caseMeta"), t);

    const desc = document.getElementById("caseDesc");
    if (desc) desc.textContent = t.description || "";

    renderComments(document.getElementById("commentsList"), comments);

    // Reply availability
    setReplyAvailabilityUI({
      allow_customer_reply: !!json.allow_customer_reply,
      reply_deadline: json.reply_deadline || null,
    });

    // Feedback
    renderFeedback(document.getElementById("feedbackBox"), t, json.feedback || null, id);

    return json;
  }

  // wire reply
  replyForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = (replyText?.value || "").trim();
    if (!msg) return;

    try {
      if (sendBtn) sendBtn.disabled = true;

      await apiSend(`/api/tickets/mine/${encodeURIComponent(id)}/comments`, "POST", { message: msg });

      replyText.value = "";
      showNotice("Reply sent.", "success");

      await loadAndRender();
    } catch (err) {
      showNotice(err?.message || "Failed to send reply.", "error");
    } finally {
      if (sendBtn) sendBtn.disabled = false;
    }
  });

  // initial load
  try {
    setLoading(true);
    await loadAndRender();
    setLoading(false);
  } catch (e) {
    setLoading(false);
    showNotice(e?.message || "Failed to load case detail.", "error");
  }
});
