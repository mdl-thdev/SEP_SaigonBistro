// SEP_SaigonBistro/docs/admin/dashboard.js

import { initAuthUI, getAuthUser as readAuthUser } from "../../js/auth.js";

const dashboard = document.getElementById("dashboard");
const user = readAuthUser();
const roleHeader = user?.role ? { "x-user-role": user.role } : {};

const STATUS_STEPS = [
  { key: "ORDER_CONFIRMED", label: "Order Confirmed" },
  { key: "PREPARE_ORDER", label: "Prepare Order" },
  { key: "READY_FOR_PICKUP", label: "Ready for Delivery" },
  { key: "ORDER_COMPLETED", label: "Order Completed" },
];

function normalizeStatus(s) {
  if (!s) return "ORDER_CONFIRMED";
  if (s === "CONFIRMED") return "ORDER_CONFIRMED";
  return s;
}

function getStatusIndex(statusKey) {
  const idx = STATUS_STEPS.findIndex((s) => s.key === statusKey);
  return idx === -1 ? 0 : idx;
}

function buttonClass(kind) {
  // Tailwind classes
  const base =
    "status-btn rounded-xl px-3 py-2 text-sm font-semibold transition select-none";

  if (kind === "past") {
    return `${base} bg-slate-200 text-slate-500 cursor-not-allowed`;
  }
  if (kind === "current") {
    return `${base} bg-green-600 text-white cursor-not-allowed`;
  }
  // future (clickable)
  return `${base} bg-slate-900 text-white hover:bg-slate-800`;
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
    dashboard.innerHTML = `
      <div class="p-4 border rounded-xl bg-slate-50 text-slate-600">
        No orders found.
      </div>
    `;
    return;
  }

  dashboard.innerHTML = orders
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
async function fetchOrders() {
  const res = await fetch("/api/orders", { headers: { ...roleHeader } });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `Failed to load orders (${res.status})`);
  }

  const data = await res.json();
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.orders)) return data.orders;
  return [];
}

async function updateOrderStatus(orderId, status) {
  const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
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
   Page Init
================================ */
document.addEventListener("DOMContentLoaded", async () => {
  initAuthUI({ redirectOnLogout: "/index.html" });

  // admin guard
  if (!user || user.role !== "admin") {
    const next = encodeURIComponent("/admin/dashboard.html");
    window.location.href = `/login/login.html?next=${next}`;
    return;
  }

  // initial load
  try {
    const orders = await fetchOrders();
    renderOrders(orders);
  } catch (e) {
    console.error(e);
    dashboard.innerHTML = `
      <div class="p-4 border rounded-xl bg-red-50 text-red-700">
        ${e.message || "Failed to load orders."}
      </div>
    `;
  }

  // event delegation
  dashboard.addEventListener("click", async (e) => {
    const btn = e.target.closest(".status-btn");
    if (!btn) return;
    if (btn.disabled) return; // ignore grey/current buttons

    const orderId = btn.dataset.orderId;
    const status = btn.dataset.status;
    if (!orderId || !status) return;

    const original = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Updating...";

    try {
      await updateOrderStatus(orderId, status);
      const orders = await fetchOrders();
      renderOrders(orders);
    } catch (err) {
      console.error(err);
      alert(err.message || "Failed to update order status");
      btn.disabled = false;
      btn.textContent = original;
    }
  });

  // polling
  setInterval(async () => {
    try {
      const orders = await fetchOrders();
      renderOrders(orders);
    } catch {
      // ignore polling errors
    }
  }, 5000);
});
