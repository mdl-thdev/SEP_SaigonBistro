// SEP_SaigonBistro/frontend/public/pages/help/caseDetail.js

import { supabase } from "../../js/supabaseClient.js";  // Imports Supabase client for authentication
import { initAuthUI } from "../../js/auth.js";  // Imports function to initialize authentication UI (login/logout buttons, user info)
import { API_BASE_URL } from "../../js/api.js"; // Imports base URL for API requests 

/* ------------------ api helpers ------------------ */

// Function for GET requests to the API
async function apiFetch(path) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated.");

  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  const json = await res.json().catch(() => ({})); // Parse response as JSON, If parsing fails, return empty object {}
  if (!res.ok) throw new Error(json?.message || "Request failed");
  return json;
}

// Function for POST/PUT/DELETE requests, method - HTTP method (POST, PUT, DELETE), body - data to send
async function apiSend(path, method, body) {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error("Not authenticated.");

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,  // Start fetch request with specified HTTP method
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

// Prevents XSS attacks by escaping HTML special characters, Convert to string and replace dangerous characters, /[&<>"']/g - regex matching any of these characters globally
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
  const el = document.getElementById("notice"); // Get notice element, exit if doesn't exist
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

  el.textContent = message;  // Set the message text
}

// Converts role codes to friendly display names
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

// Renders ticket metadata (number, email, category, dates, etc.)
function renderMeta(metaEl, t) {
  if (!metaEl || !t) return;

  metaEl.innerHTML = "";

  const grid = document.createElement("div"); // Create grid container
  grid.className = "grid grid-cols-1 sm:grid-cols-2 gap-3";  // 1 column on mobile, 2 columns on small+ screens

  // // Inner function to create label-value pairs, span2 - whether to span 2 columns (for longer items)
  const item = (label, value, { span2 = false } = {}) => {
    const div = document.createElement("div");  
    if (span2) div.className = "sm:col-span-2";  // If span2=true, spans both columns on small+ screens

    const l = document.createElement("span");  
    l.className = "font-semibold";  // Create bold label 
    l.textContent = `${label}: `;

    const v = document.createElement("span");
    v.textContent = value ?? "-";  // Create value span (e.g., "T-000123"), Use dash if value is null/undefined

    div.appendChild(l);
    div.appendChild(v);
    return div;   // Assemble: <div><span>Label: </span><span>Value</span></div>
  };

  // Add All Metadata Items
  grid.appendChild(item("Ticket Number", t.ticket_number || "-"));
  grid.appendChild(item("Email Address", t.customer_email || "-"));
  grid.appendChild(item("Issue Category", t.category || "-"));
  grid.appendChild(item("Created", formatDate(t.created_at)));
  grid.appendChild(item("Status", t.status || "-"));
  grid.appendChild(item("Updated", formatDate(t.updated_at)));
  grid.appendChild(item("Subject", t.subject || "-", { span2: true }));  // Subject spans 2 columns (longer text)

  metaEl.appendChild(grid);  // Add grid to page
}

function renderComments(commentsList, comments) {
  if (!commentsList) return;  // Renders conversation/reply thread, Exit if container element missing

  // No Comments Case, If no comments, show "No replies yet" message
  if (!Array.isArray(comments) || comments.length === 0) {
    commentsList.innerHTML = "";
    const p = document.createElement("p");
    p.className = "text-sm text-slate-500";
    p.textContent = "No replies yet. Our team will respond soon.";
    commentsList.appendChild(p);
    return;
  }

  commentsList.innerHTML = "";

  // Loop through each comment, Check if comment is from customer (vs support staff)
  for (const c of comments) {
    const isCustomer = c?.author_role === "customer";

    // Comment Wrapper, Create comment card, Customer comments → gray background, Staff comments → green background (visual distinction)
    const wrapper = document.createElement("div");
    wrapper.className = `rounded-xl border p-4 ${isCustomer ? "bg-slate-50 border-slate-200" : "bg-green-50 border-green-200"
      }`;

    const header = document.createElement("div");
    header.className = "flex items-center justify-between mb-1"; // Comment Header row with author and timestamp

    const who = document.createElement("span"); // Shows "You" or "Support Team"
    who.className = "text-sm font-semibold";
    who.textContent = roleLabel(c?.author_role);

    const when = document.createElement("span"); // Shows timestamp
    when.className = "text-xs text-slate-500";
    when.textContent = formatDate(c?.created_at);

    header.appendChild(who);
    header.appendChild(when);

    const msg = document.createElement("p"); // Comment Message: Comment text, whitespace-pre-wrap - preserves line breaks and spaces
    msg.className = "text-sm whitespace-pre-wrap text-slate-800";
    msg.textContent = c?.message || "";

    // Assemble Comment: Add header and message to wrapper, Add wrapper to comments list
    wrapper.appendChild(header);
    wrapper.appendChild(msg);

    commentsList.appendChild(wrapper);
  }
}

// Shows or hides reply form based on whether ticket is closed, Get all reply-related elements
function setReplyAvailabilityUI({ allow_customer_reply }) {
  const replySection = document.getElementById("replySection"); // wrapper div
  const replyForm = document.getElementById("replyForm");
  const replyText = document.getElementById("replyText");
  const sendBtn = document.getElementById("btnSendReply");

  // Create Banner Element, Try to get existing banner element
  let b = document.getElementById("replyClosedBanner");
  if (!b) {
    b = document.createElement("div");  // If doesn't exist, create it. Initially hidden
    b.id = "replyClosedBanner";
    b.className =
      "hidden mt-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 px-4 py-3 text-sm";

    // Insert banner before reply section in DOM, Uses optional chaining ?. to handle missing elements
    (replySection?.parentElement || replyForm?.parentElement)?.insertBefore(b, replySection || replyForm);
  }

  // Show/Hide Based on allow_customer_reply
  // If customer is allowed to reply (ticket still open)
  if (allow_customer_reply) {
    b.classList.add("hidden");  // Hide banner, show reply section
    if (replySection) replySection.classList.remove("hidden");

    if (replyText) replyText.disabled = false;
    if (sendBtn) sendBtn.disabled = false;
    if (replyForm) replyForm.classList.remove("opacity-50", "pointer-events-none");
  } else {
    // Customer Cannot Reply If ticket is closed/resolved: Hide entire reply section
    if (replySection) replySection.classList.add("hidden");

    // Show banner with message
    b.textContent = "This case has been closed, please open a new case to get support.";
    b.classList.remove("hidden");

    // Disable form (safety measure)
    if (replyText) replyText.disabled = true;
    if (sendBtn) sendBtn.disabled = true;
    if (replyForm) replyForm.classList.add("opacity-50", "pointer-events-none");
  }
}

// Renders feedback/rating section for resolved tickets
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

  // Feedback Form (Not Yet Submitted)
  const wrap = document.createElement("div");  // Create form wrapper
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

  feedbackEl.appendChild(wrap);  // Add form to page

  // Star Rating Logic, Track selected star count (0 = none), Get all interactive elements
  let selected = 0;
  const starButtons = wrap.querySelectorAll(".starBtn");
  const btn = wrap.querySelector("#btnSubmitFeedback");
  const commentEl = wrap.querySelector("#fbComment");

  // Updates star display, Stars 1-3 filled if selected=3: ★★★☆☆
  function paint() {
    starButtons.forEach((b) => {
      const n = Number(b.dataset.star);
      b.textContent = n <= selected ? "★" : "☆";
    });
  }

  // When star clicked, update selection and repaint
  starButtons.forEach((b) => {
    b.addEventListener("click", () => {
      selected = Number(b.dataset.star);
      paint();
    });
  });

  // Submit Feedback Handler, Validate star selection
  btn.addEventListener("click", async () => {
    if (selected < 1 || selected > 5) {
      showNotice("Please select 1–5 stars.", "error");
      return;
    }
    try {
      btn.disabled = true; // Disable button to prevent double-submit

      // Send feedback to API, Includes star rating and optional comment
      await apiSend(`/api/tickets/mine/${encodeURIComponent(id)}/feedback`, "POST", {
        stars: selected,
        comment: (commentEl.value || "").trim(),
      });

      showNotice("Thanks for your feedback!", "success");

      // Reload ticket data. Re-render feedback section (now shows submitted feedback)
      const json = await apiFetch(`/api/tickets/mine/${encodeURIComponent(id)}`);
      renderFeedback(feedbackEl, json.ticket, json.feedback, id);
    } catch (e) {
      showNotice(e?.message || "Failed to submit feedback.", "error");
    } finally {
      btn.disabled = false;  // Re-enable button in finally block
    }
  });

  paint(); // Initial paint to show empty stars
}

// Reads cached ticket data from sessionStorage, maxAgeMs - default 2 minutes (120,000 ms), Prevents loading flash when navigating from tickets list
function readPrefetch(id, maxAgeMs = 2 * 60 * 1000) {
  try {
    const raw = sessionStorage.getItem(`casePrefetch:${id}`);  // Try to get cached data from sessionStorage, Return null if not found
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.data) return null;
    if (Date.now() - (parsed.at || 0) > maxAgeMs) return null; // Check if cached data is too old, Date.now() - parsed.at - time elapsed since cache, If older than 2 minutes → return null (stale)
    return parsed.data; // Return cached data if valid
  } catch {
    return null;  // Catch any errors (invalid JSON, etc.) and return null
  }
}


/* ------------------ main ------------------ */

// Wait for HTML to fully load before running code
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

  // Get Ticket ID from URL
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");  // Extract id from URL query string. Example: caseDetail.html?id=123 → id = "123"

  if (!id) {
    showNotice("Missing case id.", "error");
    return;
  }

  // Get all interactive elements
  const replyForm = document.getElementById("replyForm");
  const replyText = document.getElementById("replyText");
  const sendBtn = document.getElementById("btnSendReply");

  const caseCard = document.getElementById("caseCard");
  const caseLoading = document.getElementById("caseLoading");

  // Loading State Helper
  function setLoading(isLoading) {
    if (caseLoading) caseLoading.classList.toggle("hidden", !isLoading); // toggle("hidden", !isLoading) - show loading if isLoading=true
    if (caseCard) caseCard.classList.toggle("hidden", isLoading); // toggle("hidden", isLoading) - show card if isLoading=false
  }

  // Instant Render from Prefetch, Try to load from cache, If found, skip loading skeleton
  const prefetched = readPrefetch(id);
  if (prefetched?.ticket) {
    setLoading(false);

    // Render all sections using cached data, Provides instant page load (no flashing), Fresh data will be loaded next
    const t = prefetched.ticket;
    const comments = Array.isArray(prefetched.comments) ? prefetched.comments : [];

    renderMeta(document.getElementById("caseMeta"), t);

    const desc = document.getElementById("caseDesc");
    if (desc) desc.textContent = t.description || "";

    renderComments(document.getElementById("commentsList"), comments);

    setReplyAvailabilityUI({
      allow_customer_reply: !!prefetched.allow_customer_reply,
    });

    renderFeedback(document.getElementById("feedbackBox"), t, prefetched.feedback || null, id);
  }

  // Fetch fresh ticket data from API
  async function loadAndRender() {
    const json = await apiFetch(`/api/tickets/mine/${encodeURIComponent(id)}`);
    const t = json?.ticket;
    const comments = Array.isArray(json?.comments) ? json.comments : [];  // Extract ticket and comments

    if (!t) {
      showNotice("Ticket not found.", "error");
      return;
    }

    // Render ticket metadata, description, and comments
    renderMeta(document.getElementById("caseMeta"), t);

    const desc = document.getElementById("caseDesc");
    if (desc) desc.textContent = t.description || "";

    renderComments(document.getElementById("commentsList"), comments);

    // Update reply form visibility
    setReplyAvailabilityUI({
      allow_customer_reply: !!json.allow_customer_reply,
      reply_deadline: json.reply_deadline || null,
    });

    // Render feedback section
    renderFeedback(document.getElementById("feedbackBox"), t, json.feedback || null, id);

    return json;
  }

  // Reply Form Handler: Listen for form submission
  replyForm?.addEventListener("submit", async (e) => {
    e.preventDefault();  // Prevent default form submission (page reload)
    const msg = (replyText?.value || "").trim();  // Get message text
    if (!msg) return;

    try {
      if (sendBtn) sendBtn.disabled = true;  // Disable button to prevent double-submit

      await apiSend(`/api/tickets/mine/${encodeURIComponent(id)}/comments`, "POST", { message: msg }); // Send reply to API

      replyText.value = "";
      showNotice("Reply sent.", "success");

      await loadAndRender();  // Reload ticket to show new comment
    } catch (err) {
      showNotice(err?.message || "Failed to send reply.", "error");
    } finally {
      if (sendBtn) sendBtn.disabled = false;
    }
  });

  // initial load
  try {
    // Only show loading skeleton if no prefetch available
    if (!prefetched?.ticket) setLoading(true);

    await loadAndRender();  // Load fresh data

    setLoading(false);  // Hide loading skeleton
  } catch (e) {
    setLoading(false);
    showNotice(e?.message || "Failed to load case detail.", "error");
  }
});
