// FED_KCoffee/docs/orders/orderStatus.js

import { initAuthUI, getAuthUser } from "../../js/auth.js";
import { formatMoney } from "../../js/utils.js";
import { getLastOrder } from "../../js/cartStore.js";

const isGitHubPages = window.location.hostname.includes("github.io");
const isLocal =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

// GitHub Pages needs repo base path; Vercel does not
const BASE_PATH = isGitHubPages ? "/FED_KCoffee" : "";

// Local uses same-origin. Non-local uses Render API.
const API_BASE_URL = isLocal ? "" : "https://fed-kcoffee.onrender.com";

function getPath(path) {
  if (!path.startsWith("/")) return path;
  return `${BASE_PATH}${path}`;
}

const statusBox = document.getElementById("statusBox");

let activeOrderId = null;
let pollTimer = null;
let lastRenderedFingerprint = "";

/* -------------------------
   Helpers
-------------------------- */

// UPDATE redirectToLogin():
function redirectToLogin() {
  const currentPath = window.location.pathname.replace(BASE_PATH, "");
  const next = encodeURIComponent(currentPath + window.location.search);
  const reason = encodeURIComponent("Please log in to view your order status.");
  window.location.href = getPath(`/login/login.html?next=${next}&reason=${reason}`);
}

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* -------------------------
   Rendering
-------------------------- */

// UPDATE renderNoOrder():
function renderNoOrder() {
  statusBox.innerHTML = `
    <div class="space-y-3 text-center">
      <p class="text-slate-700 font-semibold">No recent order found.</p>
      <p class="text-slate-500 text-sm">Place an order first, then come back to track it.</p>
      <a href="${getPath("/menu/menu.html")}"
         class="inline-block rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
        Back to Menu
      </a>
    </div>
  `;
}

function renderOrder(order) {
  const createdAt = order.createdAt ? new Date(order.createdAt).toLocaleString() : "-";
  const id = order.id || order.shortId || order.orderId || "(pending)";
  const status = order.status || "UNKNOWN";
  const totals = order.totals || {};
  const timeline = Array.isArray(order.timeline) ? order.timeline : [];

  const timelineHTML = timeline.length
    ? `<ol class="space-y-2 mt-3">
        ${timeline
          .slice()
          .reverse()
          .map(
            (t) => `
              <li class="text-sm">
                <span class="font-semibold">${escapeHtml(t.status)}</span>
                <span class="text-slate-500">
                  ${t.at ? new Date(t.at).toLocaleString() : ""}
                </span>
              </li>`
          )
          .join("")}
      </ol>`
    : `<p class="text-sm text-slate-500 mt-3">No tracking updates yet.</p>`;

  statusBox.innerHTML = `
    <div class="space-y-4">
      <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <p class="text-slate-500 text-sm">Order ID</p>
          <p class="font-bold text-lg">${escapeHtml(id)}</p>
        </div>

        <div class="inline-flex items-center gap-2 rounded-full px-4 py-2 bg-white border">
          <span class="text-slate-500 text-sm">Status</span>
          <span class="font-bold">${escapeHtml(status)}</span>
        </div>
      </div>

      <div class="grid sm:grid-cols-3 gap-4">
        <div class="bg-white border rounded-xl p-4">
          <p class="text-slate-500 text-sm">Placed</p>
          <p class="font-semibold">${escapeHtml(createdAt)}</p>
        </div>
        <div class="bg-white border rounded-xl p-4">
          <p class="text-slate-500 text-sm">Subtotal</p>
          <p class="font-semibold">${formatMoney(totals.subtotal || 0)}</p>
        </div>
        <div class="bg-white border rounded-xl p-4">
          <p class="text-slate-500 text-sm">Total</p>
          <p class="font-semibold">${formatMoney(totals.total || 0)}</p>
        </div>
      </div>

      <div class="bg-white border rounded-xl p-4">
        <p class="font-semibold">Tracking timeline</p>
        ${timelineHTML}
        <p class="text-xs text-slate-400 mt-3">Auto-updating every 5 seconds</p>
      </div>
    </div>
  `;
}

/* -------------------------
   Server sync + polling
-------------------------- */

// UPDATE fetchOrderFromServer():
async function fetchOrderFromServer(orderId) {
  const user = getAuthUser();
  const res = await fetch(`${API_BASE_URL}/api/order/${encodeURIComponent(orderId)}`, {
    headers: {
      Accept: "application/json",
      "x-user-id": String(user?.id || ""),
      "x-user-role": String(user?.role || ""),
    },
  });
  if (!res.ok) throw new Error(`Failed to load order (${res.status})`);
  const data = await res.json();
  return data.order || data;
}

function fingerprintOrder(order) {
  const id = order?.id || order?.shortId || order?.orderId || "";
  const status = order?.status || "";
  const timelineLen = Array.isArray(order?.timeline) ? order.timeline.length : 0;
  const lastAt = timelineLen > 0 ? order.timeline[timelineLen - 1]?.at || "" : "";
  return `${id}|${status}|${timelineLen}|${lastAt}`;
}

async function loadOrderFromServer() {
  if (!activeOrderId) return;

  try {
    const serverOrder = await fetchOrderFromServer(activeOrderId);
    const fp = fingerprintOrder(serverOrder);

    if (fp !== lastRenderedFingerprint) {
      lastRenderedFingerprint = fp;
      renderOrder(serverOrder);
    }

    // Stop polling once order is completed
    if (["DELIVERED", "CANCELLED"].includes(serverOrder.status)) {
      clearInterval(pollTimer);
    }
  } catch (err) {
    console.warn("Polling failed:", err.message || err);
  }
}

/* -------------------------
   Init
-------------------------- */

async function init() {
  const user = getAuthUser();
  const params = new URLSearchParams(window.location.search);
  const orderIdFromUrl = params.get("orderId");
  const last = getLastOrder?.() || null;

  // Guests are NOT allowed to view order status page
  if (!user) {
    redirectToLogin();
    return;
  }

  // UPDATE init() - admin redirect:
  if (user?.role === "admin") {
    window.location.href = getPath("/admin/dashboard.html");
    return;
  }

  activeOrderId = orderIdFromUrl || last?.id || last?.shortId || last?.orderId || null;

  if (!activeOrderId) {
    renderNoOrder();
    return;
  }

  statusBox.innerHTML = `<p class="text-slate-500">Loading your order...</p>`;

  await loadOrderFromServer();

  if (!lastRenderedFingerprint && last) {
    renderOrder(last);
  }

  pollTimer = setInterval(loadOrderFromServer, 5000);
}

/* -------------------------
   Lifecycle
-------------------------- */

window.addEventListener("beforeunload", () => {
  if (pollTimer) clearInterval(pollTimer);
});

// UPDATE DOMContentLoaded:
document.addEventListener("DOMContentLoaded", () => {
  initAuthUI({ redirectOnLogout: getPath("/index.html") });
  init().catch((err) => {
    console.error(err);
    statusBox.innerHTML = `<p class="text-red-600">Failed to load order status.</p>`;
  });
});
