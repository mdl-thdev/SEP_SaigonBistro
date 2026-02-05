// SEP_SaigonBistro/frontend/public/pages/orders/orderStatus.js

import { initAuthUI, getAuthUser } from "../../js/auth.js";
import { formatMoney } from "../../js/utils.js";
import { supabase } from "../../js/supabaseClient.js";

const API_BASE =
  window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
    ? "http://localhost:3000"
    : "https://fed-saigonbistro.onrender.com";

const statusBox = document.getElementById("statusBox");

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderNoOrder() {
  statusBox.innerHTML = `
    <div class="text-center space-y-3">
      <p class="font-semibold text-slate-700">No order selected.</p>
      <a href="../menu/menu.html"
         class="inline-block px-4 py-2 rounded bg-slate-900 text-white hover:bg-slate-800">
        Back to Menu
      </a>
    </div>
  `;
}

function renderOrder(order) {
  const shortId = order.public_orderid || order.public_orderId || null;
  const showId = shortId || order.id;

  const placedAt = order.created_at ? new Date(order.created_at).toLocaleString() : "-";
  const total = Number(order.total || 0);

  statusBox.innerHTML = `
    <div class="space-y-4">
      <div>
        <p class="text-sm text-slate-500">Order ID</p>
        <p class="font-bold text-lg">${escapeHtml(showId)}</p>
        ${
          shortId
            ? `<p class="text-xs text-slate-400 mt-1">Reference: ${escapeHtml(order.id)}</p>`
            : ""
        }
      </div>

      <div class="flex items-center gap-2">
        <span class="text-sm text-slate-500">Status</span>
        <span class="font-semibold">${escapeHtml(order.status || "UNKNOWN")}</span>
      </div>

      <div class="grid sm:grid-cols-2 gap-4">
        <div class="p-4 border rounded">
          <p class="text-sm text-slate-500">Placed</p>
          <p class="font-semibold">${escapeHtml(placedAt)}</p>
        </div>

        <div class="p-4 border rounded">
          <p class="text-sm text-slate-500">Total</p>
          <p class="font-semibold">${formatMoney(total)}</p>
        </div>
      </div>

      <div class="p-4 border rounded">
        <p class="text-sm text-slate-500 mb-1">Delivery Address</p>
        <p class="text-sm">
          ${escapeHtml(order.delivery_address || "-")}
          ${order.block_unit_number ? `<br>${escapeHtml(order.block_unit_number)}` : ""}
          ${order.delivery_city ? `<br>${escapeHtml(order.delivery_city)}` : ""}
          ${order.delivery_state ? `, ${escapeHtml(order.delivery_state)}` : ""}
          ${order.delivery_zip ? ` ${escapeHtml(order.delivery_zip)}` : ""}
        </p>
        ${order.delivery_notes ? `<p class="text-xs text-slate-500 mt-2">Notes: ${escapeHtml(order.delivery_notes)}</p>` : ""}
      </div>
    </div>
  `;
}

async function fetchOrderFromServer(orderUuid) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) throw new Error("Not authenticated");

  const res = await fetch(`${API_BASE}/api/orders/${encodeURIComponent(orderUuid)}`, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.message || "Failed to load order");
  return json.order;
}

async function init() {
  const user = await getAuthUser();
  if (!user) {
    window.location.href = "../login/login.html";
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const orderId = params.get("orderId"); // this is UUID from checkout redirect

  if (!orderId) {
    renderNoOrder();
    return;
  }

  statusBox.innerHTML = `<p class="text-slate-500">Loading your order...</p>`;

  try {
    const order = await fetchOrderFromServer(orderId);
    renderOrder(order);
  } catch (err) {
    statusBox.innerHTML = `<p class="text-red-600">${escapeHtml(err.message || "Failed to load order")}</p>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initAuthUI({ redirectOnLogout: "/index.html" });
  init();
});
