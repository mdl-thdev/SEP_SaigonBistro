// SEP_SaigonBistro/frontend/public/pages/dashboard/dashboard.js

// Imports authentication helpers
// initAuthUI initializes login/logout UI behavior
// getAuthUser is renamed to readAuthUser to avoid naming conflicts and reads the logged-in user from storage
import { initAuthUI, getAuthUser as readAuthUser } from "../../js/auth.js";

const pageTitle = document.getElementById("pageTitle");
const pageActions = document.getElementById("pageActions");
const pageBody = document.getElementById("pageBody");

// Sidebar toggle
const sidebar = document.getElementById("sidebar");
const toggleBtn = document.getElementById("sidebarToggle");
const chevron = document.getElementById("sidebarChevron");

toggleBtn.addEventListener("click", () => {
  const isCollapsed = sidebar.classList.toggle("collapsed");
  chevron.style.transform = isCollapsed ? "rotate(180deg)" : "rotate(0deg)";
});

document.addEventListener("DOMContentLoaded", () => {
  const tabs = document.querySelectorAll(".dash-tab");

  tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabs.forEach((b) => b.classList.remove("is-active"));
      btn.classList.add("is-active");
    });
  });
});

// User: holds the authenticated user object / roleHeader: stores the Authorization header for API requests
let user = null;
let roleHeader = {};

// View Orders: Status steps helpers
const STATUS_STEPS = [
  { key: "ORDER_CONFIRMED", label: "Order Confirmed" },
  { key: "PREPARE_ORDER", label: "Prepare Order" },
  { key: "READY_FOR_PICKUP", label: "Ready for Delivery" },
  { key: "ORDER_COMPLETED", label: "Order Completed" },
];

function normalizeStatus(s) {
  if (!s) return "ORDER_CONFIRMED";

  const t = String(s).trim().toUpperCase();

  if (t === "CONFIRMED" || t === "ORDER CONFIRMED") return "ORDER_CONFIRMED";
  if (t === "PREPARE ORDER") return "PREPARE_ORDER";
  if (t === "READY FOR DELIVERY" || t === "READY FOR PICKUP") return "READY_FOR_PICKUP";
  if (t === "ORDER COMPLETED") return "ORDER_COMPLETED";

  return s;
}

function getStatusIndex(statusKey) {
  const idx = STATUS_STEPS.findIndex((s) => s.key === statusKey);
  return idx === -1 ? 0 : idx;
}

function buttonClass(kind) {
  const base =
    "status-btn rounded-xl px-3 py-2 text-sm font-semibold transition select-none";

  if (kind === "past") return `${base} bg-slate-200 text-slate-500 cursor-not-allowed`; // past: completed steps (disabled, gray)
  if (kind === "current") return `${base} bg-green-600 text-white cursor-not-allowed`; // current: active step (green, disabled)
  return `${base} bg-slate-900 text-white hover:bg-slate-800`; // future: next possible step (clickable)
}

function renderStatusButtons(order) {
  const currentKey = normalizeStatus(order.status);
  const currentIdx = getStatusIndex(currentKey);

  return `
    <div class="flex flex-wrap gap-2">
      ${STATUS_STEPS.map((step, idx) => {
    const kind =
      idx < currentIdx ? "past" : idx === currentIdx ? "current" : "future";

    const disabled = kind !== "future" ? "disabled" : "";

    return `
          <button
            class="${buttonClass(kind)}"
            data-order-id="${order.id}"
            data-status="${step.key}"
            ${disabled}
            aria-disabled="${kind !== "future"}"
            title="${kind === "future" ? "Click to update" : "Not available"}"
          >
            ${step.label}
          </button>
        `;
  }).join("")}
    </div>
  `;
}

// View Orders: Renders the list of orders into the page body
function renderOrders(orders = []) {
  if (!orders.length) {
    pageBody.innerHTML = `
      <div class="p-4 border rounded-xl bg-slate-50 text-slate-600">
        No orders found.
      </div>
    `;
    return;
  }

  pageBody.innerHTML = orders
    .map((o) => {
      const status = normalizeStatus(o.status);
      const total = o.totals?.total ?? 0;

      return `
        <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 border rounded-xl">
          <div class="space-y-1">
            <p class="font-semibold">Order #${o.id}</p>
            <p class="text-sm text-slate-500">
              Status: <span class="font-semibold">${status}</span>
            </p>
            <p class="text-sm text-slate-500">
              Total: $${Number(total).toFixed(2)}
            </p>
            <p class="text-xs text-slate-400">
              Created: ${o.createdAt ? new Date(o.createdAt).toLocaleString() : "-"}
            </p>
          </div>

          ${renderStatusButtons(o)}
        </div>
      `;
    })
    .join("");
}


/* ================================
// APIs: View Orders:
=================================== */

// View Orders:
// GET /api/orders
async function fetchOrders() {
  const res = await fetch("http://localhost:3000/api/orders", { headers: { ...roleHeader } })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to load orders (${res.status})`);
  }

  const data = await res.json();
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.orders)) return data.orders;
  return []; // Handles multiple backend response formats
}

// PATCH /api/orders/:id
async function updateOrderStatus(orderId, status) {
  const res = await fetch(`http://localhost:3000/api/orders/${encodeURIComponent(orderId)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...roleHeader,
    },
    body: JSON.stringify({ status }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to update (${res.status})`);
  }

  const data = await res.json().catch(() => ({}));
  return data.order || data;
}

// Tab loading (simple placeholders)
// Fetches orders, render them
async function loadOrdersUI() {
  const orders = await fetchOrders();
  renderOrders(orders);
}

/* ================================
// APIs: Tickets:
=================================== */
const TICKETS_PAGE_SIZE = 10;

function safeLower(v) {
  return (v ?? "").toString().trim().toLowerCase();
}

function formatDT(v) {
  if (!v) return "-";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "-" : d.toLocaleString();
}

function parseDateOnlyToMs(dateStr, endOfDay = false) {
  if (!dateStr) return null;
  // dateStr is YYYY-MM-DD from <input type="date">
  const t = endOfDay ? `${dateStr}T23:59:59.999` : `${dateStr}T00:00:00.000`;
  const ms = new Date(t).getTime();
  return isNaN(ms) ? null : ms;
}

function starsHTML(n) {
  const count = Number(n || 0);
  const full = Math.max(0, Math.min(5, count));
  const empty = 5 - full;
  return `
    <span class="inline-flex items-center gap-0.5" aria-label="${full} out of 5 stars">
      ${"★".repeat(full)}${"☆".repeat(empty)}
    </span>
  `;
}

// GET /api/tickets (staff/admin)
async function fetchTickets() {
  const res = await fetch("http://localhost:3000/api/tickets", { headers: { ...roleHeader } });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to load tickets (${res.status})`);
  }

  const data = await res.json().catch(() => ({}));
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.tickets)) return data.tickets;
  return [];
}

// helpers
function escapeHtml(s) {
  return (s ?? "").toString().replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[m]));
}

function buildPageItems(page, totalPages) {
  // returns array of numbers and "..."
  const items = [];
  const maxButtons = 7; // center group size
  if (totalPages <= 9) {
    for (let i = 1; i <= totalPages; i++) items.push(i);
    return items;
  }

  items.push(1);

  const left = Math.max(2, page - 2);
  const right = Math.min(totalPages - 1, page + 2);

  if (left > 2) items.push("...");
  for (let i = left; i <= right; i++) items.push(i);
  if (right < totalPages - 1) items.push("...");

  items.push(totalPages);
  return items;
}

function paginationHTML(page, totalPages) {
  const items = buildPageItems(page, totalPages);

  return `
    <div class="flex items-center justify-between border rounded-2xl p-4 bg-white">
      <div class="text-sm text-slate-600">
        Page <span class="font-semibold">${page}</span> of <span class="font-semibold">${totalPages}</span>
      </div>

      <div class="flex items-center gap-1">
        <button id="btnPrev"
          class="rounded-xl px-3 py-2 text-sm font-semibold border hover:bg-black/5"
          ${page <= 1 ? "disabled" : ""}>
          ‹
        </button>

        ${items.map((it) => {
    if (it === "...") {
      return `<span class="px-2 text-slate-400 select-none">…</span>`;
    }
    const active = it === page;
    return `
            <button data-page="${it}"
              class="page-btn rounded-xl px-3 py-2 text-sm font-semibold border
                ${active ? "bg-slate-900 text-white border-slate-900" : "hover:bg-black/5"}">
              ${it}
            </button>
          `;
  }).join("")}

        <button id="btnNext"
          class="rounded-xl px-3 py-2 text-sm font-semibold border hover:bg-black/5"
          ${page >= totalPages ? "disabled" : ""}>
          ›
        </button>
      </div>
    </div>
  `;
}

async function loadTicketsUI() {
  // state lives only while this tab is active
  const allTickets = await fetchTickets();

  const STATUS_OPTIONS = ["All", "New", "Pending Review", "Waiting Customer Response", "Resolved", "Reopened"];

  const CATEGORY_SET = Array.from(
    new Set(allTickets.map((t) => (t.category ?? "").toString().trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  const state = {
    status: "All",
    startDate: "",
    endDate: "",
    customerEmail: "",
    customerPhone: "",
    keyword: "",
    ticketNumber: "",
    orderId: "",
    ownerEmailOrId: "",
    category: "All",
    page: 1,
  };

  function applyFilters(list) {
    const sStatus = safeLower(state.status);
    const sCat = safeLower(state.category);

    const startMs = parseDateOnlyToMs(state.startDate, false);
    const endMs = parseDateOnlyToMs(state.endDate, true);

    const fEmail = safeLower(state.customerEmail);
    const fPhone = safeLower(state.customerPhone);
    const fKeyword = safeLower(state.keyword);
    const fTicketNo = safeLower(state.ticketNumber);
    const fOrderId = safeLower(state.orderId);
    const fOwner = safeLower(state.ownerEmailOrId);

    return list.filter((t) => {
      // status
      if (sStatus !== "all" && safeLower(t.status) !== sStatus) return false;

      // time range (created_at)
      const createdMs = t.created_at ? new Date(t.created_at).getTime() : null;
      if (startMs != null && createdMs != null && createdMs < startMs) return false;
      if (endMs != null && createdMs != null && createdMs > endMs) return false;

      // customer email/phone exact-ish contains
      if (fEmail && !safeLower(t.customer_email).includes(fEmail)) return false;
      if (fPhone && !safeLower(t.customer_phone).includes(fPhone)) return false;

      // ticket number / order id
      if (fTicketNo && !safeLower(t.ticket_number).includes(fTicketNo)) return false;
      if (fOrderId && !safeLower(t.order_id).includes(fOrderId)) return false;

      // owner (you currently only have owner_id in list)
      // This input supports owner_id (and future owner email if you add it later).
      const ownerBlob = `${safeLower(t.owner_id)} ${safeLower(t.owner_email)} ${safeLower(t.owner_name)}`;
      if (fOwner && !ownerBlob.includes(fOwner)) return false;

      // category
      if (sCat !== "all" && safeLower(t.category) !== sCat) return false;

      // keyword (search across subject/description/customer fields)
      if (fKeyword) {
        const blob = [
          t.subject,
          t.description,
          t.customer_name,
          t.customer_email,
          t.customer_phone,
          t.ticket_number,
          t.order_id,
          t.category,
          t.status,
        ]
          .map((x) => safeLower(x))
          .join(" ");
        if (!blob.includes(fKeyword)) return false;
      }

      return true;
    });
  }

  function paginate(list) {
    const total = list.length;
    const totalPages = Math.max(1, Math.ceil(total / TICKETS_PAGE_SIZE));
    const page = Math.min(Math.max(1, state.page), totalPages);
    state.page = page;

    const start = (page - 1) * TICKETS_PAGE_SIZE;
    const items = list.slice(start, start + TICKETS_PAGE_SIZE);
    return { items, total, totalPages, page };
  }

  function render() {
    const filtered = applyFilters(allTickets);
    const { items, total, totalPages, page } = paginate(filtered);

    pageActions.innerHTML = `
      <div class="text-sm text-slate-600">
        <span class="font-semibold">${total}</span> ticket(s)
      </div>
    `;

    const hasAnyFilter =
      state.status !== "All" ||
      state.category !== "All" ||
      !!state.startDate ||
      !!state.endDate ||
      !!state.customerEmail ||
      !!state.customerPhone ||
      !!state.keyword ||
      !!state.ticketNumber ||
      !!state.orderId ||
      !!state.ownerEmailOrId;

    pageBody.innerHTML = `
  <!-- Top toolbar  -->
  <div class="flex items-center justify-between md:justify-end gap-3">
        <button id="btnOpenFilters"
          class="rounded-xl px-4 py-2 text-sm font-semibold border hover:bg-black/5">
          + Add filter
        </button>
      </div>
  

    <!-- Active filter chips row -->
<div class="mt-3 flex items-start justify-between gap-3">
  <!-- Left: chips (only render when filters exist) -->
  <div class="flex flex-wrap gap-2 text-xs">
    ${hasAnyFilter ? [
        state.status !== "All" ? `Status: ${escapeHtml(state.status)}` : "",
        state.category !== "All" ? `Category: ${escapeHtml(state.category)}` : "",
        state.startDate ? `From: ${escapeHtml(state.startDate)}` : "",
        state.endDate ? `To: ${escapeHtml(state.endDate)}` : "",
        state.customerEmail ? `Email: ${escapeHtml(state.customerEmail)}` : "",
        state.customerPhone ? `Phone: ${escapeHtml(state.customerPhone)}` : "",
        state.keyword ? `Keyword: ${escapeHtml(state.keyword)}` : "",
        state.ticketNumber ? `Ticket#: ${escapeHtml(state.ticketNumber)}` : "",
        state.orderId ? `Order: ${escapeHtml(state.orderId)}` : "",
        state.ownerEmailOrId ? `Owner: ${escapeHtml(state.ownerEmailOrId)}` : "",
      ].filter(Boolean).map((txt) => `
      <span class="rounded-full border px-3 py-1 bg-slate-50 text-slate-700">${txt}</span>
    `).join("") : ``}
  </div>

  <!-- Right: empty state under Add filter (only when NO filters) -->
  ${!hasAnyFilter ? `
    <div class="text-xs text-slate-400 text-right whitespace-nowrap">
      No filters applied
    </div>
  ` : ``}
</div>

    <!-- Filters panel (hidden until "+ Add filter") -->
  <div id="filtersPanel" class="hidden border rounded-2xl p-4 bg-white">
    <div class="flex items-center justify-between">
      <div class="text-sm font-bold">Filters</div>
      <button id="btnCloseFilters" class="text-sm font-semibold text-slate-600 hover:text-slate-900">
        Close
      </button>
    </div>

    <div class="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      <label class="space-y-1">
        <span class="text-xs font-semibold text-slate-700">Ticket Status</span>
        <select id="fStatus" class="w-full rounded-xl border px-3 py-2 text-sm">
          ${STATUS_OPTIONS.map((x) => `<option ${x === state.status ? "selected" : ""}>${escapeHtml(x)}</option>`).join("")}
        </select>
      </label>

      <label class="space-y-1">
        <span class="text-xs font-semibold text-slate-700">Start Date</span>
        <input id="fStart" type="date" value="${escapeHtml(state.startDate)}"
          class="w-full rounded-xl border px-3 py-2 text-sm" />
      </label>

      <label class="space-y-1">
        <span class="text-xs font-semibold text-slate-700">End Date</span>
        <input id="fEnd" type="date" value="${escapeHtml(state.endDate)}"
          class="w-full rounded-xl border px-3 py-2 text-sm" />
      </label>

      <label class="space-y-1">
        <span class="text-xs font-semibold text-slate-700">Customer Email</span>
        <input id="fCustomerEmail" value="${escapeHtml(state.customerEmail)}" placeholder="e.g. user@email.com"
          class="w-full rounded-xl border px-3 py-2 text-sm" />
      </label>

      <label class="space-y-1">
        <span class="text-xs font-semibold text-slate-700">Customer Phone</span>
        <input id="fCustomerPhone" value="${escapeHtml(state.customerPhone)}" placeholder="e.g. +65..."
          class="w-full rounded-xl border px-3 py-2 text-sm" />
      </label>

      <label class="space-y-1">
        <span class="text-xs font-semibold text-slate-700">Keyword</span>
        <input id="fKeyword" value="${escapeHtml(state.keyword)}" placeholder="Search subject / description / customer..."
          class="w-full rounded-xl border px-3 py-2 text-sm" />
      </label>

      <label class="space-y-1">
        <span class="text-xs font-semibold text-slate-700">Ticket Number</span>
        <input id="fTicketNumber" value="${escapeHtml(state.ticketNumber)}" placeholder="e.g. TCK-000123"
          class="w-full rounded-xl border px-3 py-2 text-sm" />
      </label>

      <label class="space-y-1">
        <span class="text-xs font-semibold text-slate-700">Order ID</span>
        <input id="fOrderId" value="${escapeHtml(state.orderId)}" placeholder="e.g. 123"
          class="w-full rounded-xl border px-3 py-2 text-sm" />
      </label>

      <label class="space-y-1">
        <span class="text-xs font-semibold text-slate-700">Ticket Owner (staff email / id)</span>
        <input id="fOwner" value="${escapeHtml(state.ownerEmailOrId)}" placeholder="owner id (or email if added later)"
          class="w-full rounded-xl border px-3 py-2 text-sm" />
      </label>
    </div>

    <div class="mt-3 flex flex-wrap items-center gap-2">
      <button id="btnApply"
        class="rounded-xl px-4 py-2 text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800">
        Apply
      </button>
      <button id="btnReset"
        class="rounded-xl px-4 py-2 text-sm font-semibold border hover:bg-black/5">
        Reset
      </button>
    </div>
  </div>


      <!-- Middle: category chips -->
      <div class="border rounded-2xl p-4 bg-white">
        <div class="flex items-center justify-between gap-3">
          <div class="text-sm font-bold">Issue Categories</div>
          <div class="text-xs text-slate-500">Click to filter</div>
        </div>

        <div class="mt-3 flex flex-wrap gap-2">
      <button data-cat="All"
        class="cat-chip rounded-full px-3 py-1.5 text-xs font-semibold border ${state.category === "All" ? "bg-slate-900 text-white" : "hover:bg-black/5"}">
        All
      </button>
      ${CATEGORY_SET.map((c) => {
        const active = c === state.category;
        return `
          <button data-cat="${escapeHtml(c)}"
            class="cat-chip rounded-full px-3 py-1.5 text-xs font-semibold border ${active ? "bg-slate-900 text-white" : "hover:bg-black/5"}">
            ${escapeHtml(c)}
          </button>
        `;
      }).join("")}
    </div>
  </div>

      <!-- Tickets list -->
      <div class="space-y-3">
        ${items.length ? items.map((t) => {
        const status = (t.status ?? "-").toString();
        const badgeClass =
          safeLower(status) === "resolved" ? "bg-green-100 text-green-800"
            : safeLower(status) === "in progress" ? "bg-yellow-100 text-yellow-800"
              : safeLower(status) === "new" ? "bg-blue-100 text-blue-800"
                : "bg-slate-100 text-slate-800";

        return `
            <div class="border rounded-2xl p-4 bg-white flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div class="min-w-0 space-y-1">
                <div class="flex flex-wrap items-center gap-2">
                  <div class="font-bold">Ticket #${t.ticket_number ?? t.id}</div>
                  <span class="inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${badgeClass}">
                    ${status}
                  </span>
                  ${t.order_id ? `<span class="text-xs text-slate-500">Order: ${t.order_id}</span>` : ""}
                </div>

                <div class="text-sm text-slate-700 font-semibold truncate">
                  ${t.subject ?? "(no subject)"}
                </div>

                <div class="text-sm text-slate-600 flex flex-wrap gap-x-3 gap-y-1">
                  <span><span class="font-semibold">Customer:</span> ${t.customer_name ?? "-"} (${t.customer_email ?? "-"})</span>
                  ${t.customer_phone ? `<span><span class="font-semibold">Phone:</span> ${t.customer_phone}</span>` : ""}
                  <span><span class="font-semibold">Category:</span> ${t.category ?? "-"}</span>
                  <span><span class="font-semibold">Owner:</span> ${t.owner_id ?? "Unassigned"}</span>
                </div>

                <div class="text-xs text-slate-500">
                  Created: ${formatDT(t.created_at)} · Updated: ${formatDT(t.updated_at)}
                </div>
              </div>

              <div class="shrink-0 flex items-center gap-2">
                <a class="rounded-xl px-3 py-2 text-sm font-semibold border hover:bg-black/5"
                   href="/pages/dashboard/ticket-case.html?id=${encodeURIComponent(t.id)}">
                  View case
                </a>
              </div>
            </div>
          `;
      }).join("") : `
          <div class="p-4 border rounded-2xl bg-slate-50 text-slate-600">
            No tickets found with the current filters.
          </div>
        `}
      </div>

      <!-- Pagination -->
      <div class="flex items-center justify-between border rounded-2xl p-4 bg-white">
        <div class="text-sm text-slate-600">
          Page <span class="font-semibold">${page}</span> of <span class="font-semibold">${totalPages}</span>
        </div>

        <div class="flex items-center gap-2">
          <button id="btnPrev" class="rounded-xl px-3 py-2 text-sm font-semibold border hover:bg-black/5" ${page <= 1 ? "disabled" : ""}>
            Prev
          </button>
          <button id="btnNext" class="rounded-xl px-3 py-2 text-sm font-semibold border hover:bg-black/5" ${page >= totalPages ? "disabled" : ""}>
            Next
          </button>
        </div>
      </div>
    `;

    // wire events
    const $ = (id) => document.getElementById(id);

    // open/close filter panel
    $("btnOpenFilters")?.addEventListener("click", () => {
      $("filtersPanel")?.classList.toggle("hidden");
    });

    $("btnCloseFilters")?.addEventListener("click", () => {
      $("filtersPanel")?.classList.add("hidden");
    });

    // pagination: prev/next
    $("btnPrev")?.addEventListener("click", () => {
      state.page = Math.max(1, state.page - 1);
      render();
    });
    $("btnNext")?.addEventListener("click", () => {
      state.page = Math.min(totalPages, state.page + 1);
      render();
    });

    // pagination: number buttons
    document.querySelectorAll(".page-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const p = Number(btn.dataset.page);
        if (!Number.isFinite(p)) return;
        state.page = p;
        render();
      });
    });


    $("btnApply")?.addEventListener("click", () => {
      state.status = $("fStatus").value;
      state.startDate = $("fStart").value;
      state.endDate = $("fEnd").value;
      state.customerEmail = $("fCustomerEmail").value;
      state.customerPhone = $("fCustomerPhone").value;
      state.keyword = $("fKeyword").value;
      state.ticketNumber = $("fTicketNumber").value;
      state.orderId = $("fOrderId").value;
      state.ownerEmailOrId = $("fOwner").value;
      state.page = 1;
      render();
    });

    $("btnReset")?.addEventListener("click", () => {
      state.status = "All";
      state.startDate = "";
      state.endDate = "";
      state.customerEmail = "";
      state.customerPhone = "";
      state.keyword = "";
      state.ticketNumber = "";
      state.orderId = "";
      state.ownerEmailOrId = "";
      state.category = "All";
      state.page = 1;
      render();
    });

    document.querySelectorAll(".cat-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        state.category = btn.dataset.cat || "All";
        state.page = 1;
        render();
      });
    });

    $("btnPrev")?.addEventListener("click", () => {
      state.page = Math.max(1, state.page - 1);
      render();
    });

    $("btnNext")?.addEventListener("click", () => {
      state.page = state.page + 1;
      render();
    });
  }

  render();
}


/* ================================
// APIs: View Staffs (Admin only)
=================================== */

// GET /api/staff (admin only, admin can view all staffs and all admins)
// Expected response formats supported:
//   - Array of staff objects
//   - { staffs: [...] } or { staff: [...] }
async function fetchStaffs() {
  const res = await fetch("http://localhost:3000/api/staff", {
    headers: { ...roleHeader },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to load staffs (${res.status})`);
  }

  const data = await res.json().catch(() => ({}));
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.staffs)) return data.staffs;
  if (Array.isArray(data.staff)) return data.staff;
  return [];
}

function staffBadge(role) {
  const r = (role ?? "").toString().toLowerCase();
  const cls =
    r === "admin" ? "bg-purple-100 text-purple-800"
    : r === "staff" ? "bg-blue-100 text-blue-800"
    : "bg-slate-100 text-slate-800";
  return `<span class="inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${cls}">
    ${escapeHtml(role ?? "Unknown")}
  </span>`;
}

async function loadStaffUI() {
  // quick loading state
  pageTitle.textContent = "View Staffs";
  pageActions.innerHTML = "";
  pageBody.innerHTML = `
    <div class="p-4 border rounded-xl bg-slate-50 text-slate-600">
      Loading staffs...
    </div>
  `;

  const staffs = await fetchStaffs();

  // local UI state (search)
  const state = { q: "" };

  function render() {
    const q = safeLower(state.q);
    const filtered = staffs.filter((s) => {
      const blob = [
        s.id,
        s.name,
        s.full_name,
        s.email,
        s.role,
        s.phone,
      ].map((x) => safeLower(x)).join(" ");
      return !q || blob.includes(q);
    });

    pageActions.innerHTML = `
      <div class="text-sm text-slate-600">
        <span class="font-semibold">${filtered.length}</span> staff(s)
      </div>
    `;

    pageBody.innerHTML = `
      <div class="border rounded-2xl p-4 bg-white">
        <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div class="text-lg font-bold">Staff Directory</div>
            <div class="text-sm text-slate-600">Admin only</div>
          </div>

          <div class="w-full md:w-80">
            <input id="staffSearch"
              value="${escapeHtml(state.q)}"
              placeholder="Search name / email / role..."
              class="w-full rounded-xl border px-3 py-2 text-sm" />
          </div>
        </div>
      </div>

      <div class="mt-3 space-y-3">
        ${filtered.length ? filtered.map((s) => {
          const name = s.name ?? s.full_name ?? "-";
          const email = s.email ?? "-";
          const role = s.role ?? "-";
          const created = s.created_at ? formatDT(s.created_at) : (s.createdAt ? formatDT(s.createdAt) : "-");

          return `
            <div class="border rounded-2xl p-4 bg-white flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div class="min-w-0 space-y-1">
                <div class="flex flex-wrap items-center gap-2">
                  <div class="font-bold truncate">${escapeHtml(name)}</div>
                  ${staffBadge(role)}
                </div>

                <div class="text-sm text-slate-600 flex flex-wrap gap-x-3 gap-y-1">
                  <span><span class="font-semibold">Email:</span> ${escapeHtml(email)}</span>
                  ${s.phone ? `<span><span class="font-semibold">Phone:</span> ${escapeHtml(s.phone)}</span>` : ""}
                  <span><span class="font-semibold">ID:</span> ${escapeHtml(s.id ?? "-")}</span>
                </div>

                <div class="text-xs text-slate-500">
                  Created: ${escapeHtml(created)}
                </div>
              </div>

              <div class="shrink-0 flex items-center gap-2">
              <!-- future actions (edit / deactivate) -->
              </div>

          `;
        }).join("") : `
          <div class="p-4 border rounded-2xl bg-slate-50 text-slate-600">
            No staffs found.
          </div>
        `}
      </div>
    `;

    // wire search
    document.getElementById("staffSearch")?.addEventListener("input", (e) => {
      state.q = e.target.value || "";
      render();
    });
  }

  render();
}


/* ================================
// APIs: Reports: (Admin only)
=================================== */
async function loadReportsUI() {
  pageBody.innerHTML = `
    <div class="p-4 border rounded-xl bg-slate-50 text-slate-600">
      Reports UI not implemented yet.
    </div>
  `;
}


/* ================================
   Event delegation for status buttons
================================ */

// Uses event delegation for dynamically rendered buttons
pageBody.addEventListener("click", async (e) => {
  const btn = e.target.closest(".status-btn"); // Finds closest .status-btn
  if (!btn || btn.disabled) return;

  const orderId = btn.dataset.orderId;
  const status = btn.dataset.status;
  if (!orderId || !status) return;

  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Updating...";

  try {
    await updateOrderStatus(orderId, status);
    await loadOrdersUI();
  } catch (err) {
    console.error(err);
    alert(err.message || "Failed to update order status");
    btn.disabled = false;
    btn.textContent = original;
  }
});

/* ================================
   Page Init
================================ */
document.addEventListener("DOMContentLoaded", async () => {
  initAuthUI({ redirectOnLogout: "/index.html" });

  // Read user AFTER initAuthUI
  user = await readAuthUser();
  roleHeader = user?.token ? { Authorization: `Bearer ${user.token}` } : {};

  const role = user?.role?.toLowerCase();

  // staff/admin guard
  if (!user || !["admin", "staff"].includes(role)) {
    const next = encodeURIComponent("/pages/dashboard/dashboard.html");
    window.location.href = `/login/login.html?next=${next}`;
    return;
  }

  // show staff tab for admin
  const staffTabBtn = document.getElementById("staffTabBtn");
  if (role === "admin") {
    staffTabBtn?.classList.remove("hidden");
  }

  const tabs = document.querySelectorAll(".dash-tab");

  function setActiveTab(tabKey) {
    tabs.forEach((b) => {
      const active = b.dataset.tab === tabKey;
      b.classList.toggle("bg-white/10", active);
      b.classList.toggle("font-semibold", active);
    });
  }

  async function loadTab(tabKey) {
    setActiveTab(tabKey);
    pageActions.innerHTML = "";

    if (tabKey === "orders") {
      pageTitle.textContent = "View Orders";
      await loadOrdersUI();
      return;
    }

    if (tabKey === "tickets") {
      pageTitle.textContent = "All Tickets";
      await loadTicketsUI();
      return;
    }

    if (tabKey === "staff") {
      if (role !== "admin") {
        pageBody.innerHTML = `
          <div class="p-4 border rounded-xl bg-red-50 text-red-700">Admin only.</div>
        `;
        return;
      }
      pageTitle.textContent = "View Staffs";
      await loadStaffUI();
      return;
    }

    if (tabKey === "reports") {
      pageTitle.textContent = "Reports";
      await loadReportsUI();
      return;
    }
  }

  tabs.forEach((b) => {
    b.addEventListener("click", () => loadTab(b.dataset.tab)); // Switches tabs dynamically without reload
  });

  // initial load
  try {
    await loadTab("tickets");
  } catch (e) {
    console.error(e);
    pageBody.innerHTML = `
      <div class="p-4 border rounded-xl bg-red-50 text-red-700">
        ${e.message || "Failed to load tickets."}
      </div>
    `;
  }

  // polling (refresh orders only when Orders tab is active) / Keeps order status up-to-date without full page reload
  setInterval(async () => {
    try {
      const activeBtn = document.querySelector(".dash-tab.bg-white/10");
      const activeTab = activeBtn?.dataset?.tab;
      if (activeTab === "orders") await loadOrdersUI();
    } catch {
      // ignore polling errors
    }
  }, 5000); // Runs every 5 seconds
});
