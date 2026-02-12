// SEP_SaigonBistro/frontend/public/pages/dashboard/dashboard.js

import { initAuthUI, getAuthUser as readAuthUser } from "../../js/auth.js";
import { API_BASE_URL } from "../../js/api.js";

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

// User: holds the authenticated user object / roleHeader: stores the Authorization header, { Authorization: "Bearer <token>" }
let user = null;
let roleHeader = {};

// View Orders: 
const STATUS_STEPS = [
  { key: "ORDER_CONFIRMED", label: "Order Confirmed" },
  { key: "PREPARE_ORDER", label: "Prepare Order" },
  { key: "READY_FOR_PICKUP", label: "Ready for Delivery" },
  { key: "ORDER_COMPLETED", label: "Order Completed" },
];

// Normalize backend status into keys
function normalizeStatus(s) {
  if (!s) return "ORDER_CONFIRMED";

  const t = String(s).trim().toUpperCase();

  if (t === "CONFIRMED" || t === "ORDER CONFIRMED") return "ORDER_CONFIRMED";
  if (t === "PREPARE ORDER") return "PREPARE_ORDER";
  if (t === "READY FOR DELIVERY" || t === "READY FOR PICKUP") return "READY_FOR_PICKUP";
  if (t === "ORDER COMPLETED") return "ORDER_COMPLETED";

  return s;
}

// Find which step index the status is at
function getStatusIndex(statusKey) {
  const idx = STATUS_STEPS.findIndex((s) => s.key === statusKey);
  return idx === -1 ? 0 : idx;
}

// Button CSS class helper
function buttonClass(kind) {
  const base =
    "status-btn rounded-xl px-3 py-2 text-sm font-semibold transition select-none";

  if (kind === "past") return `${base} bg-slate-200 text-slate-500 cursor-not-allowed`; // Past steps: gray + not clickable
  if (kind === "current") return `${base} bg-green-600 text-white cursor-not-allowed`; // Current step: green + not clickable
  return `${base} bg-slate-900 text-white hover:bg-slate-800`; // Future steps: black and clickable
}

// Render the status buttons per order
function renderStatusButtons(order) {
  const currentKey = normalizeStatus(order.status);
  const currentIdx = getStatusIndex(currentKey);  // Get current step index

  // Creates a button for each step
  return `
    <div class="flex flex-wrap gap-2">
      ${STATUS_STEPS.map((step, idx) => {
    const kind =
      idx < currentIdx ? "past" : idx === currentIdx ? "current" : "future";

    const disabled = kind !== "future" ? "disabled" : "";

    // Generates <button> with: data-order-id and data-status so clicks know what to update
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


// Theme helper for “reports” tab
const contentArea = document.getElementById("contentArea");
const headerEl = document.querySelector("header");
const footerEl = document.querySelector("footer");
const sidebarEl = document.getElementById("sidebar");

// For now: Reports tab always light
function setReportsTheme(_on) {

  // BODY
  document.body.classList.remove("bg-black", "text-white");
  document.body.classList.add("bg-white", "text-slate-900");

  // HEADER
  headerEl?.classList.remove("bg-black/80", "border-slate-800", "text-white");
  headerEl?.classList.add("bg-white/60", "border-gray-200", "text-slate-900");

  // SIDEBAR
  sidebarEl?.classList.remove("bg-slate-950", "border-slate-800", "text-white");
  sidebarEl?.classList.add("bg-white", "border-gray-200", "text-black");

  // FOOTER
  footerEl?.classList.remove("bg-black", "border-slate-800", "text-slate-200");
  footerEl?.classList.add("bg-gray-100", "border-black/10", "text-black");

  // CONTENT AREA
  contentArea?.classList.remove("bg-black", "text-white");
  contentArea?.classList.add("bg-white", "text-slate-900");

  // Sidebar tab hover (always light)
  document.querySelectorAll(".dash-tab").forEach((btn) => {
    btn.classList.add("hover:bg-black/5");
    btn.classList.remove("hover:bg-white/10");
  });

  // Top nav links always normal
  document.querySelectorAll("header nav a").forEach((a) => {
    a.classList.add("text-black");
    a.classList.remove("text-slate-200");
  });

  // Welcome text normal
  const welcome = document.getElementById("welcomeUser");
  welcome?.classList.remove("text-slate-200");
}

// View Orders: Rendering Orders list
function renderOrders(orders = []) {
  if (!orders.length) {
    pageBody.innerHTML = `
      <div class="p-4 border rounded-xl bg-slate-50 text-slate-600">
        No orders found.
      </div>
    `;
    return;
  }
  // For each order: normalize status; safely get total price (?. avoids crash)
  pageBody.innerHTML = orders
    .map((o) => {
      const status = normalizeStatus(o.status);
      const total = o.totals?.total ?? 0;
      // Render order info + status buttons
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
// Orders API calls
=================================== */

// Fetch orders
async function fetchOrders() {
  const res = await fetch(`${API_BASE_URL}/api/orders`, { headers: { ...roleHeader } })  // Sends GET request with auth header

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to load orders (${res.status})`);
  }
  // Supports multiple backend formats: [ ... ], { orders: [ ... ] }
  const data = await res.json();
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.orders)) return data.orders;
  return []; 
}

// Update order status
async function updateOrderStatus(orderId, status) {
  const res = await fetch(`${API_BASE_URL}/api/orders/${encodeURIComponent(orderId)}`, {
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
  // Supports response being either { order: {...} } or direct object
  const data = await res.json().catch(() => ({}));
  return data.order || data;
}

// Load orders UI: Fetch then render
async function loadOrdersUI() {
  const orders = await fetchOrders();
  renderOrders(orders);
}

/* ================================
// Tickets APIs 
=================================== */

// Tickets: constants + helpers
// Show 10 tickets per page
const TICKETS_PAGE_SIZE = 10;

// normalize for comparisons
function safeLower(v) {
  return (v ?? "").toString().trim().toLowerCase();
}

// format date nicely
function formatDT(v) {
  if (!v) return "-";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "-" : d.toLocaleString();
}

// convert date input YYYY-MM-DD to milliseconds for filtering
function parseDateOnlyToMs(dateStr, endOfDay = false) {
  if (!dateStr) return null;
  
  const t = endOfDay ? `${dateStr}T23:59:59.999` : `${dateStr}T00:00:00.000`;
  const ms = new Date(t).getTime();
  return isNaN(ms) ? null : ms;
}


// Tickets API + filter system + pagination + rendering
// Fetch tickets
async function fetchTickets() {
  const res = await fetch(`${API_BASE_URL}/api/tickets`, { headers: { ...roleHeader } });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to load tickets (${res.status})`);
  }

  const data = await res.json().catch(() => ({}));
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.tickets)) return data.tickets;
  return [];
}

// helpers escapeHtml: Prevents HTML injection when inserting text into .innerHTML; Replaces <, >, &, quotes, etc
function escapeHtml(s) {
  return (s ?? "").toString().replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[m]));
}

// Fetch tickets
async function fetchOrdersForLookup() {
  const res = await fetch(`${API_BASE_URL}/api/orders`, { headers: { ...roleHeader } });
  if (!res.ok) return [];
  const data = await res.json().catch(() => ({}));
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.orders)) return data.orders;
  return [];
}

// loadTicketsUI
async function loadTicketsUI() {
  // Initial Data Fetching
  const allTicketsRaw = await fetchTickets();
  const orders = await fetchOrdersForLookup();
  const orderLookup = new Map();

  // Order Lookup Builder, Helper to map multiple order ID formats to one public ID
  function putKey(k, pub) {
    const key = (k ?? "").toString().trim();
    const p = (pub ?? "").toString().trim();
    if (!key || !p) return;
    orderLookup.set(key, p);
    orderLookup.set(key.toLowerCase(), p);
  }

  orders.forEach((o) => {
    const pub =
      (o.public_orderid ?? o.publicOrderId ?? o.public_order_id ?? "").toString().trim();

    // try every possible “id” field orders API might return
    const keys = [
      o.id,
      o.order_id,
      o.orderId,
      o.uuid,
      o.order_uuid,
      o.orderUuid,
    ];

    keys.forEach((k) => putKey(k, pub));

    // also allow direct searching by SB-...
    putKey(pub, pub);
  });

  // Fetch profiles so we can map owner_id <-> email/name
  let profiles = [];
  try {
    profiles = await fetchStaffs(); 
  } catch (e) {
    profiles = [];
  }

  const byId = new Map(profiles.map(p => [String(p.id), p]));

  // Enrich tickets so filters can work with email/name
  const allTickets = allTicketsRaw.map(t => {
    const owner = t.owner_id ? byId.get(String(t.owner_id)) : null;

    const rawOrder = (t.order_id ?? t.orderId ?? t.order_uuid ?? t.orderUuid ?? "").toString().trim();

    const rawUpper = rawOrder.toUpperCase();
    const publicOrderId =
      rawUpper.startsWith("SB-")
        ? rawUpper
        : (orderLookup.get(rawOrder) || orderLookup.get(rawOrder.toLowerCase()) || "");

    return {
      ...t,
      owner_email: t.owner_email || owner?.email || "",
      owner_name: t.owner_name || owner?.display_name || owner?.name || owner?.full_name || "",
      public_orderid: publicOrderId,
    };
  });

  const STATUS_OPTIONS = ["All", "New", "Pending Review", "Waiting Customer Response", "Resolved", "Reopened"];

  const CATEGORY_SET = Array.from(
    new Set(allTickets.map((t) => (t.category ?? "").toString().trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  const state = {
    status: "All",
    startDate: "",
    endDate: "",
    customerEmail: "",
    ticketNumber: "",
    ownerEmailOrId: "",
    category: "All",
    page: 1,
  };

  // Filter Logic
  function applyFilters(list) {
    const sStatus = safeLower(state.status);
    const sCat = safeLower(state.category);
    const startMs = parseDateOnlyToMs(state.startDate, false);
    const endMs = parseDateOnlyToMs(state.endDate, true);
    const fEmail = safeLower(state.customerEmail);
    const fTicketNo = safeLower(state.ticketNumber);
    const fOwner = safeLower(state.ownerEmailOrId);

    return list.filter((t) => {
      if (sStatus !== "all" && safeLower(t.status) !== sStatus) return false;

      const createdMs = t.created_at ? new Date(t.created_at).getTime() : null;
      if (startMs != null && createdMs != null && createdMs < startMs) return false;
      if (endMs != null && createdMs != null && createdMs > endMs) return false;

      if (fEmail && !safeLower(t.customer_email).includes(fEmail)) return false;
      if (fTicketNo && !safeLower(t.ticket_number).includes(fTicketNo)) return false;

      const ownerBlob = `${safeLower(t.owner_id)} ${safeLower(t.owner_email)} ${safeLower(t.owner_name)}`;
      if (fOwner && !ownerBlob.includes(fOwner)) return false;

      if (sCat !== "all" && safeLower(t.category) !== sCat) return false;

      return true;
    });
  }
  // Defines a function that takes a list of items and splits it into pages
  function paginate(list) {
    const total = list.length;
    const totalPages = Math.max(1, Math.ceil(total / TICKETS_PAGE_SIZE));
    const page = Math.min(Math.max(1, state.page), totalPages);
    state.page = page; // Updates the state with the normalized page number

    const start = (page - 1) * TICKETS_PAGE_SIZE;
    const items = list.slice(start, start + TICKETS_PAGE_SIZE); // Extracts the items for the current page
    return { items, total, totalPages, page };
  }

  // function that updates the UI whenever filters or page changes
  function render() {
    const filtered = applyFilters(allTickets);  // Applies all active filters to get the filtered ticket list
    const { items, total, totalPages, page } = paginate(filtered);

    // Page Actions (Ticket Count)
    pageActions.innerHTML = `
      <div class="text-sm text-slate-600">
        <span class="font-semibold">${total}</span> ticket(s)
      </div>
    `;

    // Checks if ANY filter is currently active
    const hasAnyFilter =
      state.status !== "All" ||
      state.category !== "All" ||
      !!state.startDate ||    // !!state.startDate - converts string to boolean (empty string = false, any text = true)
      !!state.endDate ||
      !!state.customerEmail ||
      !!state.ticketNumber ||
      !!state.ownerEmailOrId;

    // building the entire page content 
    pageBody.innerHTML = `
    <!-- Top toolbar  -->
    <div class="flex items-center justify-between md:justify-end gap-3">
      <button id="btnOpenFilters" class="rounded-xl px-4 py-2 text-sm font-semibold border hover:bg-black/5">
          + Add filter
      </button>
    </div>
  
    <!-- Active filter chips row -->
    <div class="mt-3 flex items-start justify-between gap-3">

    <!-- Left: chips (only render when filters exist) -->
    <div class="flex flex-wrap gap-2 text-xs">

    <!-- Only show chips if filters are active; Starts an array of chip strings -->
    ${hasAnyFilter ? [
        state.status !== "All" ? `Status: ${escapeHtml(state.status)}` : "",
        state.category !== "All" ? `Category: ${escapeHtml(state.category)}` : "",
        state.startDate ? `From: ${escapeHtml(state.startDate)}` : "",
        state.endDate ? `To: ${escapeHtml(state.endDate)}` : "",
        state.customerEmail ? `Email: ${escapeHtml(state.customerEmail)}` : "",
        state.ticketNumber ? `Ticket#: ${escapeHtml(state.ticketNumber)}` : "",
        state.ownerEmailOrId ? `Owner: ${escapeHtml(state.ownerEmailOrId)}` : "",
      ].filter(Boolean).map((txt) => `
      
      <span class="rounded-full border px-3 py-1 bg-slate-50 text-slate-700">${txt}</span>
    `).join("") : ``}
    </div>
    
    <!-- Right: empty state under Add filter (only when NO filters) -->
    ${!hasAnyFilter ? `
    <div class="text-xs text-slate-400 text-right whitespace-nowrap">
      No filters applied</div>
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
            <span class="text-xs font-semibold text-slate-700">Category</span>
            <select id="fCategory" class="w-full rounded-xl border px-3 py-2 text-sm">
            <option ${state.category === "All" ? "selected" : ""}>All</option>
            ${CATEGORY_SET.map((c) => `
            <option ${c === state.category ? "selected" : ""}>${escapeHtml(c)}</option>
            `).join("")}
            </select>
          </label>
      
          <label class="space-y-1">
            <span class="text-xs font-semibold text-slate-700">Ticket Status</span>
            <select id="fStatus" class="w-full rounded-xl border px-3 py-2 text-sm">
            ${STATUS_OPTIONS.map((x) => `<option ${x === state.status ? "selected" : ""}>${escapeHtml(x)}</option>`).join("")}
            </select>
          </label>

          <label class="space-y-1">
            <span class="text-xs font-semibold text-slate-700">Ticket Number</span>
            <input id="fTicketNumber" value="${escapeHtml(state.ticketNumber)}" placeholder="e.g. T-000011"
            class="w-full rounded-xl border px-3 py-2 text-sm" />
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
            <span class="text-xs font-semibold text-slate-700">Ticket Owner (staff email / id)</span>
            <input id="fOwner" value="${escapeHtml(state.ownerEmailOrId)}" placeholder="owner id (or email if added later)"
            class="w-full rounded-xl border px-3 py-2 text-sm" />
          </label>
        
        </div>

        <div class="mt-3 flex flex-wrap items-center gap-2">
          <button id="btnApply" class="rounded-xl px-4 py-2 text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800">
            Apply </button>
       
          <button id="btnReset" class="rounded-xl px-4 py-2 text-sm font-semibold border hover:bg-black/5">
            Reset</button>
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
              <div class="font-bold">Ticket ${escapeHtml(String(t.ticket_number ?? t.id ?? "-"))}</div>
              <span class="inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ${badgeClass}">
                ${escapeHtml(String(status))}</span>
                
              ${(t.public_orderid || t.order_id || t.orderId) ?
              `<span class="text-xs text-slate-500">Order: ${escapeHtml(t.public_orderid || t.order_id || t.orderId)}</span>`
              : ""}
            </div>

            <div class="text-sm text-slate-700 font-semibold truncate">${escapeHtml(String(t.subject ?? "(no subject)"))}</div>

            <div class="text-sm text-slate-600 flex flex-wrap gap-x-3 gap-y-1">
              <span>
                <span class="font-semibold">Customer:</span>
                ${escapeHtml(String(t.customer_name ?? "-"))}
                (${escapeHtml(String(t.customer_email ?? "-"))})
                </span>
                ${t.customer_phone ? `<span><span class="font-semibold">Phone:</span> ${escapeHtml(String(t.customer_phone))}</span>` : ""}
                <span>
                  <span class="font-semibold">Category:</span> ${escapeHtml(String(t.category ?? "-"))}

                </span>
                <span><span class="font-semibold">Owner:</span>
                ${t.owner_name
                ? `${escapeHtml(t.owner_name)} (${escapeHtml(t.owner_email || t.owner_id)})`
                  : escapeHtml(t.owner_email || t.owner_id || "Unassigned")}
              
              </span>
            </div>

            <div class="text-xs text-slate-500">Created: ${formatDT(t.created_at)} · Updated: ${formatDT(t.updated_at)}</div>
          </div>

          <div class="shrink-0 flex items-center gap-2">
            <a class="rounded-xl px-3 py-2 text-sm font-semibold border hover:bg-black/5"
              href="/pages/dashboard/ticket-case.html?id=${encodeURIComponent(t.id)}">View case</a>
          </div>
        </div>`;
        
        }).join("") : `
          <div class="p-4 border rounded-2xl bg-slate-50 text-slate-600">No tickets found with the current filters.</div>
        `}
        </div>

    <!-- Pagination -->
    <div class="flex items-center justify-between border rounded-2xl p-4 bg-white">
      <div class="text-sm text-slate-600">Page 
        <span class="font-semibold">${page}</span> of <span class="font-semibold">${totalPages}</span>
      </div>

      <div class="flex items-center gap-2">
        <button id="btnPrev" class="rounded-xl px-3 py-2 text-sm font-semibold border hover:bg-black/5" ${page <= 1 ? "disabled" : ""}>
          Prev</button>
          
        <button id="btnNext" class="rounded-xl px-3 py-2 text-sm font-semibold border hover:bg-black/5" ${page >= totalPages ? "disabled" : ""}>
          Next</button>
        
      </div>
    </div>
    `;

    // Events handlers
    const $ = (id) => document.getElementById(id);   // Shorthand function to get element by ID, $("btnApply") is same as document.getElementById("btnApply")

    // open/close filter panel
    // When "+ Add filter" clicked, show/hide the filters panel
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

    // When Apply clicked, read all input values and update state
    $("btnApply")?.addEventListener("click", () => {
      state.status = $("fStatus")?.value ?? "All";
      state.startDate = $("fStart")?.value ?? "";
      state.endDate = $("fEnd")?.value ?? "";
      state.customerEmail = $("fCustomerEmail")?.value ?? "";
      state.ticketNumber = $("fTicketNumber")?.value ?? "";      
      state.ownerEmailOrId = $("fOwner")?.value ?? "";
      state.category = $("fCategory")?.value ?? "All";
      state.page = 1;
      render();
    });

    $("btnReset")?.addEventListener("click", () => {
      state.status = "All";
      state.startDate = "";
      state.endDate = "";
      state.customerEmail = "";
      state.ticketNumber = "";
      state.ownerEmailOrId = "";
      state.category = "All";
      state.page = 1;
      render();
    });
  }
  render();
}


/* ================================
// View Staffs API (Admin only)
=================================== */

async function fetchStaffs() {
  const res = await fetch(`${API_BASE_URL}/api/profiles`, {headers: { ...roleHeader },});  // Gets staff/admin profiles

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to load staffs (${res.status})`);
  }

  // Handles formats: array { staffs: [...] }, { staff: [...] }
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

// loadStaffUI
async function loadStaffUI() {
  pageTitle.textContent = "All Staffs";
  pageActions.innerHTML = "";
  pageBody.innerHTML = `
    <div class="p-4 border rounded-xl bg-slate-50 text-slate-600">
      Loading staffs...
    </div>
  `;

  const staffs = await fetchStaffs();
  const state = { q: "" };

  pageBody.innerHTML = `
  <div class="flex items-center">
    <div class="w-full md:w-80 md:ml-auto">
      <input
        id="staffSearch"
        placeholder="Search name / email / role..."
        class="w-full rounded-xl border px-3 py-2 text-sm"
      />
    </div>
  </div>

  <div id="staffList" class="mt-3 space-y-3"></div>
`;

  const inputEl = document.getElementById("staffSearch");
  const listEl = document.getElementById("staffList");

  function renderList() {
    const q = safeLower(state.q);

    const filtered = staffs.filter((s) => {
      const blob = [
        s.id,
        s.display_name,
        s.name,
        s.full_name,
        s.email,
        s.role,
      ]
        .map((x) => safeLower(x))
        .join(" ");

      return !q || blob.includes(q);
    });

    pageActions.innerHTML = `
      <div class="text-sm text-slate-600">
        <span class="font-semibold">${filtered.length}</span> staff(s)
      </div>
    `;

    listEl.innerHTML = filtered.length
      ? filtered
        .map((s) => {
          const name = s.display_name ?? s.name ?? s.full_name ?? "-";
          const email = s.email ?? "-";
          const role = s.role ?? "-";
          const created = s.created_at
            ? formatDT(s.created_at)
            : s.createdAt
              ? formatDT(s.createdAt)
              : "-";

          return `
              <div class="border rounded-2xl p-4 bg-white flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div class="min-w-0 space-y-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <div class="font-bold truncate">${escapeHtml(name)}</div>
                    ${staffBadge(role)}
                  </div>

                  <div class="text-sm text-slate-600 flex flex-wrap gap-x-3 gap-y-1">
                    <span><span class="font-semibold">Email:</span> ${escapeHtml(email)}</span>
                  </div>

                  <div class="text-xs text-slate-500">
                    Created: ${escapeHtml(created)}
                  </div>
                </div>
              </div>
            `;
        })
        .join("")
      : `
          <div class="p-4 border rounded-2xl bg-slate-50 text-slate-600">
            No staffs found.
          </div>
        `;
  }

  inputEl.addEventListener("input", (e) => {
    state.q = e.target.value || "";
    renderList();
  });

  renderList();
}


/* ================================
// Reports APIs
=================================== */
// Async function that loads and displays ticket reports/analytics, Called when user navigates to Reports page
async function loadReportsUI() {
  pageTitle.textContent = "Case Reports";
  pageActions.innerHTML = "";

  pageBody.innerHTML = `
    <div class="p-4 border rounded-xl bg-slate-50 text-slate-600">
      Loading report...
    </div>
  `;

  // Fetches all tickets from the API, await: pauses execution until data arrives
  const allTickets = await fetchTickets();

  const STATUS_OPTIONS = [
    "All",
    "New",
    "Pending Review",
    "Waiting Customer Response",
    "In Progress",
    "Resolved",
    "Reopened",
  ];

  // Building list of categories dynamically from tickets
  const CATEGORY_OPTIONS = ["All"].concat(
    Array.from(
      new Set(allTickets.map((t) => (t.category ?? "").toString().trim()).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b))
  );

  const state = {
    startDate: "", // YYYY-MM-DD
    endDate: "",   // YYYY-MM-DD
    status: "All",
    category: "All",
  };

  // ---------- helpers ----------
  function applyFilters(list) {
    const startMs = parseDateOnlyToMs(state.startDate, false); // Converts date strings to milliseconds timestamps, false = start of day (00:00:00)
    const endMs = parseDateOnlyToMs(state.endDate, true);   // true = end of day (23:59:59)

    const sStatus = safeLower(state.status);
    const sCat = safeLower(state.category);

    return list.filter((t) => {
      const createdMs = t.created_at ? new Date(t.created_at).getTime() : null;

      if (startMs != null && createdMs != null && createdMs < startMs) return false; // If start date is set AND ticket was created before start date → exclude
      if (endMs != null && createdMs != null && createdMs > endMs) return false; // If end date is set AND ticket was created after end date → exclude

      if (sStatus !== "all" && safeLower(t.status) !== sStatus) return false; // If status filter is not "All" AND ticket status doesn't match → exclude
      if (sCat !== "all" && safeLower(t.category) !== sCat) return false;  // If category filter is not "All" AND ticket category doesn't match → exclude

      return true; // If all checks pass → include ticket
    });
  }

  // count items by a specific property, keyFn is a function that extracts the key from each item
  function countBy(list, keyFn) {
    const m = new Map(); // Creates a Map to store counts
    for (const x of list) { // Loop through each item
      const k = (keyFn(x) ?? "Unknown").toString().trim() || "Unknown";  // Extract key using keyFn, Default to "Unknown" if key is null/undefined/empty
      m.set(k, (m.get(k) || 0) + 1);
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]); // [key, count], Sort by count descending (highest count first)
  }

  // Status text colors 
  function statusTextClass(status) {
    const s = safeLower(status);
    if (s === "resolved") return "text-green-900";
    if (s === "new") return "text-blue-600";
    if (s === "in progress" || s === "pending review" || s === "waiting customer response") return "text-purple-400";
    if (s === "reopened") return "text-red-900";
    return "text-dark-blue-500";
  }

  // Category palette 
  const CATEGORY_PALETTE = [
    "#ef4444", // red
    "#f59e0b", // amber
    "#22c55e", // green
    "#3b82f6", // blue
    "#a855f7", // purple
    "#06b6d4", // cyan
    "#f97316", // orange
    "#84cc16", // lime
    "#e879f9", // pink
    "#60a5fa", // light blue
  ];

  // Converts a string to a consistent number index, Used to assign colors to categories consistently
  function hashToIndex(str, mod) {
    const s = String(str ?? "");  // Convert to string, default to empty string
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; // Loop through each character, h * 31 - multiply current hash by 31 (prime number), + s.charCodeAt(i) - add character code, >>> 0 - convert to unsigned 32-bit integer (prevents negative numbers)
    return h % mod;  // Use modulo to get index within range 0 to (mod-1), Example: if mod=10, returns 0-9
  }

  // Takes a category name, Hashes it to get consistent index (0-9), Returns corresponding color from palette, Same category always gets same color
  function categoryColor(label) {
    return CATEGORY_PALETTE[hashToIndex(label, CATEGORY_PALETTE.length)];
  }

  // Generates SVG bar chart HTML, items - array of [label, count] pairs, Destructured parameters with defaults:
  function renderBarChart(items, { width = 720, barH = 22, gap = 10, left = 220, right = 20 } = {}) {
    const max = Math.max(1, ...items.map(([, c]) => c));  // Find the highest count value, ...items.map(([, c]) => c) - extract all counts, Math.max(1, ...) - ensure minimum of 1 to avoid division by zero
    const height = Math.max(90, items.length * (barH + gap) + 30); // Calculate total SVG height, items.length * (barH + gap) - space needed for all bars, + 30 - padding, Math.max(90, ...) - minimum height of 90px
    const chartW = width - left - right; // Calculate available width for bars (excluding margins)

    // Generate Bar Rows, Map each item to SVG elements, [label, count] - destructure the array, i - index for positioning
    const rows = items.map(([label, count], i) => {
      const y = 20 + i * (barH + gap);  // Calculate vertical position for this bar, Starts at 20px, then each bar is (barH + gap) pixels below previous
      const w = Math.round((count / max) * chartW); // Calculate bar width proportional to count, (count / max) - percentage of max value, * chartW - scale to available width, Math.round() - round to nearest pixel
      const fill = categoryColor(label); // Get consistent color for this category

      // Label Text: SVG text element for category label, x="${left - 10}" - positioned 10px before the bars start, y="${y + barH - 6}" - vertically aligned with bar,text-anchor="end" - right-align text,  Shows category name (e.g., "Billing")
      return `
        <text x="${left - 10}" y="${y + barH - 6}" text-anchor="end" font-size="12" fill="#000000">
          ${escapeHtml(label)}
        </text>

        <rect x="${left}" y="${y}" width="${w}" height="${barH}" rx="8" fill="${fill}"></rect>

        <text x="${left + w + 8}" y="${y + barH - 6}" font-size="12" fill="#0f172a">
          ${count}
        </text>
      `;
    }).join("");

    // Assemble SVG, viewBox="0 0 ${width} ${height}" - coordinate system, class="w-full h-auto" - responsive sizing
    return `
      <svg viewBox="0 0 ${width} ${height}" class="w-full h-auto">
        <text x="${left}" y="14" font-size="12" fill="#334155">Count</text>
        ${rows || `<text x="${left}" y="40" font-size="12" fill="#334155">No data</text>`}
      </svg>
    `;
  }

  // ---------- render ----------
  // function that draws the entire reports page
  function render() {
    const filtered = applyFilters(allTickets); // Calculate Data, Get filtered tickets based on current state
    const byStatus = countBy(filtered, (t) => t.status ?? "Unknown"); // Count tickets by status, Returns: [["Resolved", 45], ["New", 23], ...]
    const byCategory = countBy(filtered, (t) => t.category ?? "Unknown"); // Count tickets by category
    const total = filtered.length; // Total number of filtered tickets

    // Update Page Actions (Top Right)
    pageActions.innerHTML = `
      <div class="text-sm text-black">
        Showing <span class="font-semibold text-black">${total}</span> case(s)
      </div>
    `;

    // Take only top 10 categories (already sorted by count)
    const topCategories = byCategory.slice(0, 10);

    // Start building the page content
    pageBody.innerHTML = `
      <!-- Filters -->
      <div class="border border-gray-200 rounded-2xl p-4 bg-white text-slate-900">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          
        <!-- LEFT: filters -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 w-full lg:w-auto">
            
          <label class="space-y-1">
              <div class="text-xs font-semibold text-black">Start date</div>
              <input id="rStart" type="date"
                value="${escapeHtml(state.startDate)}"
                class="w-full rounded-xl border border-gray-300 bg-white text-slate-900 px-3 py-2 text-sm" />
            </label>

            <label class="space-y-1">
              <div class="text-xs font-semibold text-black">End date</div>
              <input id="rEnd" type="date"
                value="${escapeHtml(state.endDate)}"
                class="w-full rounded-xl border border-gray-300 bg-white text-slate-900 px-3 py-2 text-sm" />
            </label>

            <label class="space-y-1">
              <div class="text-xs font-semibold text-black">Status</div>
              <select id="rStatus"
                class="w-full rounded-xl border border-gray-300 bg-white text-slate-900 px-3 py-2 text-sm">
                ${STATUS_OPTIONS.map(x =>
      `<option ${x === state.status ? "selected" : ""}>${escapeHtml(x)}</option>`
    ).join("")}
              </select>
            </label>

            <label class="space-y-1">
              <div class="text-xs font-semibold text-black">Category</div>
              <select id="rCat"
                class="w-full rounded-xl border border-gray-300 bg-white text-slate-900 px-3 py-2 text-sm">
                ${CATEGORY_OPTIONS.map(x =>
      `<option ${x === state.category ? "selected" : ""}>${escapeHtml(x)}</option>`
    ).join("")}
              </select>
            </label>
          </div>

          <!-- RIGHT: buttons -->
          <div class="flex items-center gap-2 justify-end shrink-0">
            
            <button id="rApply"
              class="rounded-xl px-4 py-2 text-sm font-semibold border border-gray-300 text-slate-900 hover:bg-black/5">
              Apply
            </button>

            <button id="rReset"
              class="rounded-xl px-4 py-2 text-sm font-semibold border border-gray-300 text-slate-900 hover:bg-black/5">
              Reset
            </button>

          </div>
        </div>
      </div>

      <!-- Summary cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div class="border border-gray-200 rounded-2xl p-4 bg-white text-slate-900">
          <div class="text-xs text-black">Total cases</div>
          <div class="text-3xl font-extrabold mt-1">${total}</div>
        </div>

        <div class="border border-gray-200 rounded-2xl p-4 bg-white text-slate-900">
          <div class="text-xs text-black">Top category</div>
          <div class="text-lg font-bold mt-1">${escapeHtml(topCategories[0]?.[0] ?? "-")}</div>
          <div class="text-sm text-black">${topCategories[0]?.[1] ?? 0} case(s)</div>
        </div>

        <div class="border border-gray-200 rounded-2xl p-4 bg-white text-slate-900">
          <div class="text-xs text-black">Top status</div>
          <div class="text-lg font-bold mt-1 ${statusTextClass(byStatus[0]?.[0] ?? "")}">
            ${escapeHtml(byStatus[0]?.[0] ?? "-")}
          </div>
          <div class="text-sm text-black">${byStatus[0]?.[1] ?? 0} case(s)</div>
        </div>
      </div>

      <!-- Charts -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div class="border border-gray-200 rounded-2xl p-4 bg-white text-slate-900">
          <div class="flex items-center justify-between">
            <div class="text-sm font-bold">Cases by category</div>
            <div class="text-xs text-black">
              ${escapeHtml(state.startDate || "All time")} → ${escapeHtml(state.endDate || "Now")}
            </div>
          </div>

          <div class="mt-3">
            ${renderBarChart(topCategories)}
          </div>

          <!-- Legend -->
          <div class="mt-3 flex flex-wrap gap-2 text-xs text-black">
            ${topCategories.map(([label]) => `
              <span class="inline-flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1 bg-white text-slate-900">
                <span class="inline-block w-2.5 h-2.5 rounded-full" style="background:${categoryColor(label)}"></span>
                ${escapeHtml(label)}
              </span>
            `).join("")}
          </div>
        </div>

        <div class="border border-gray-200 rounded-2xl p-4 bg-white text-slate-900">
          <div class="text-sm font-bold">Cases by status</div>
          <div class="mt-3 space-y-2">
            ${byStatus.length
        ? byStatus.map(([k, c]) => `
                    <div class="flex items-center justify-between text-sm">
                      <div class="font-semibold ${statusTextClass(k)}">${escapeHtml(k)}</div>
                      <div class="text-slate-900">${c}</div>
                    </div>
                  `).join("")
        : `<div class="text-sm text-slate-300">No data for current filters.</div>`
      }
          </div>
        </div>
      </div>
    `;

    // wire events
    const $ = (id) => document.getElementById(id);  // Shorthand for getting elements by ID

    // Apply Button
    $("rApply")?.addEventListener("click", () => {
      state.startDate = $("rStart").value;
      state.endDate = $("rEnd").value;
      state.status = $("rStatus").value;
      state.category = $("rCat").value;
      render();
    });

    // Reset Button
    $("rReset")?.addEventListener("click", () => {
      state.startDate = "";
      state.endDate = "";
      state.status = "All";
      state.category = "All";
      render();
    });
  }

  render();
}


/* ================================
   Event delegation for status buttons
================================ */

// Uses event delegation for dynamically rendered buttons, Instead of adding listeners to every button individually, attach one listener to pageBody.
pageBody.addEventListener("click", async (e) => {
  const btn = e.target.closest(".status-btn"); // closest(".status-btn") finds the clicked button if click happened inside it
  if (!btn || btn.disabled) return;

  // Reads data- attributes rendered earlier
  const orderId = btn.dataset.orderId;
  const status = btn.dataset.status;
  if (!orderId || !status) return;

  // Temporary UI feedback
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Updating...";

  // Update backend, then refresh orders list, If error: restore button text and enable it
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
   Page Init (main dashboard startup)
================================ */

// Start auth UI, If logout happens, redirect home
document.addEventListener("DOMContentLoaded", async () => {
  initAuthUI({ redirectOnLogout: "/index.html" });

  // Get logged user, Set auth header
  user = await readAuthUser();
  roleHeader = user?.token ? { Authorization: `Bearer ${user.token}` } : {};

  // Normalize role
  const role = user?.role?.toLowerCase();

  // If not logged in OR not staff/admin: redirect to login page and pass next= so login can send them back
  if (!user || !["admin", "staff"].includes(role)) {
    const next = encodeURIComponent("/pages/dashboard/dashboard.html");
    window.location.href = `/login/login.html?next=${next}`;
    return;
  }

  // Only admin sees the “View Staffs” tab
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
    setReportsTheme(tabKey === "reports");
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

  // Clicking tab loads its content
  tabs.forEach((b) => {
    b.addEventListener("click", () => loadTab(b.dataset.tab)); 
  });

  // initial load: default opens Tickets on load
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

  // Polling orders every 5 seconds
  setInterval(async () => {
    try {
      const activeBtn = document.querySelector(".dash-tab.bg-white/10");
      const activeTab = activeBtn?.dataset?.tab;
      if (activeTab === "orders") await loadOrdersUI();
    } catch {
      // ignore polling errors
    }
  }, 5000); 
});
