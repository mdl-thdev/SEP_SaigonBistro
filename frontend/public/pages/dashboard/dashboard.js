// SEP_SaigonBistro/frontend/public/pages/dashboard/dashboard.js

// Imports authentication helpers
// initAuthUI initializes login/logout UI behavior
// getAuthUser is renamed to readAuthUser to avoid naming conflicts and reads the logged-in user from storage
import { initAuthUI, getAuthUser as readAuthUser } from "../../js/auth.js";

const pageTitle = document.getElementById("pageTitle");
const pageActions = document.getElementById("pageActions");
const pageBody = document.getElementById("pageBody");

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


// user: holds the authenticated user object / roleHeader: stores the Authorization header for API requests
let user = null;
let roleHeader = {};

/* ================================
   Status steps helpers
================================ */
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

/* ================================
   UI Rendering
================================ */
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
   API Calls
================================ */

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


/* ================================
   Tab loading (simple placeholders)
================================ */

// Fetches orders, render them
async function loadOrdersUI() {
  const orders = await fetchOrders();
  renderOrders(orders);
}

async function loadTicketsUI() {
  pageBody.innerHTML = `
    <div class="p-4 border rounded-xl bg-slate-50 text-slate-600">
      Tickets UI not implemented yet.
    </div>
  `;
}

async function loadStaffUI() {
  pageBody.innerHTML = `
    <div class="p-4 border rounded-xl bg-slate-50 text-slate-600">
      Staff UI not implemented yet.
    </div>
  `;
}

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
      pageTitle.textContent = "Help Desk Tickets";
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
    await loadTab("orders");
  } catch (e) {
    console.error(e);
    pageBody.innerHTML = `
      <div class="p-4 border rounded-xl bg-red-50 text-red-700">
        ${e.message || "Failed to load orders."}
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
