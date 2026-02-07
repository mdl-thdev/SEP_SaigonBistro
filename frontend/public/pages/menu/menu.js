// SEP_SaigonBistro/frontend/public/pages/menu/menu.js

import { initAuthUI } from "../../js/auth.js";
import { loadMenu } from "../../js/api.js";
import { formatMoney } from "../../js/utils.js";
import {
  getCart,
  addItem,
  removeItem,
  getCartCount,
  computeSubtotal,
} from "../../js/cartStore.js";

const itemDisplayGrid = document.getElementById("itemDisplayGrid");
const categoryListContainer = document.getElementById("categoryList");
const menuHeading = document.getElementById("menu-heading");

const cartCountElement = document.getElementById("cartCount");
const cartDrawerItems = document.getElementById("cartDrawerItems");
const drawerSubtotalText = document.getElementById("drawerSubtotalText");
const checkoutLink = document.getElementById("checkoutLink");

const cartDrawer = document.getElementById("cartDrawer");
const openCartBtn = document.getElementById("openCartBtn");
const closeCartBtn = document.getElementById("closeCartBtn");
const cartBackdrop = document.getElementById("cartBackdrop");

// =======================
// State
// =======================
let categories = [];
let items = [];
let itemsById = {};
let currentCategory = "All";

// =======================
// Safe placeholder (no 404)
// =======================
const PLACEHOLDER_SVG_DATA_URI =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640">
    <defs>
      <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stop-color="#e2e8f0"/>
        <stop offset="1" stop-color="#f8fafc"/>
      </linearGradient>
    </defs>
    <rect width="640" height="640" rx="48" fill="url(#g)"/>
    <circle cx="320" cy="280" r="92" fill="#cbd5e1"/>
    <path d="M140 520c48-92 128-138 180-138s132 46 180 138" fill="#cbd5e1"/>
    <text x="320" y="600" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, Roboto" font-size="28" fill="#64748b">
      Image unavailable
    </text>
  </svg>
`);

// =======================
// Drawer helpers
// =======================
function openDrawer() {
  cartDrawer?.classList.remove("hidden");
}
function closeDrawer() {
  cartDrawer?.classList.add("hidden");
}

// =======================
// Path resolver
// =======================
const isGitHubPages = window.location.hostname.includes("github.io");
const BASE_PATH = isGitHubPages ? "/SEP_SaigonBistro" : "";

function withBasePath(path) {
  if (!path || !path.startsWith("/")) return path;
  return `${BASE_PATH}${path}`;
}

function resolvePublicPath(p, fallback = PLACEHOLDER_SVG_DATA_URI) {
  if (!p) return fallback;

  const s = String(p).trim();

  // external
  if (s.startsWith("http://") || s.startsWith("https://")) return s;

  // already absolute -> prefix base path for GitHub Pages
  if (s.startsWith("/")) return withBasePath(s);

  // DB values like "./assets/..." or "../assets/..."
  const cleaned = s.replace(/^(\.\/)+/, "").replace(/^(\.\.\/)+/, "");
  return withBasePath("/" + cleaned);
}

// =======================
// Inline SVG icons 
// =======================
function iconPlus() {
  return `
    <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
      <path d="M12 5v14M5 12h14"/>
    </svg>
  `;
}

function iconMinus() {
  return `
    <svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round">
      <path d="M5 12h14"/>
    </svg>
  `;
}

// =======================
// Category UI
// =======================
function createCategoryHTML(name, image) {
  const isActive = name === currentCategory ? "border-slate-900" : "border-transparent";
  const isBold = name === currentCategory ? "font-bold" : "font-semibold";

  return `
    <div data-category="${name}" class="category-item cursor-pointer text-center space-y-2 group">
      <img src="${resolvePublicPath(image)}" alt="${name}"
        onerror="this.onerror=null;this.src='${PLACEHOLDER_SVG_DATA_URI}'"
        class="w-20 h-20 rounded-full border-4 ${isActive}
        group-hover:border-slate-900 transition mx-auto object-cover hover:scale-[1.05]">
      <p class="${isBold} text-sm text-slate-700">${name}</p>
    </div>
  `;
}

function renderCategories() {
  if (!categoryListContainer) return;

  categoryListContainer.innerHTML = "";

  // "All" category image: use first category image or placeholder
  const allImage = resolvePublicPath(categories[0]?.category_image);

  categoryListContainer.insertAdjacentHTML("beforeend", createCategoryHTML("All", allImage));

  categories.forEach((c) => {
    categoryListContainer.insertAdjacentHTML(
      "beforeend",
      createCategoryHTML(c.category_name, c.category_image)
    );
  });

  document.querySelectorAll(".category-item").forEach((el) => {
    el.addEventListener("click", () => {
      const next = el.dataset.category;
      currentCategory = currentCategory === next ? "All" : next;
      renderCategories();
      renderItems();
    });
  });
}

// =======================
// Menu items
// =======================
function createItemCardHTML(item, count) {
  const imgSrc = resolvePublicPath(item.image);
  const safeName = item.name ?? "Menu item";

  return `
    <div class="w-full rounded-xl shadow-md overflow-hidden relative bg-white">
      <div class="relative aspect-square overflow-hidden">
        <img src="${imgSrc}" alt="${safeName}"
          onerror="this.onerror=null;this.src='${PLACEHOLDER_SVG_DATA_URI}'"
          class="w-full h-full object-cover">

        <div class="absolute bottom-4 right-4 bg-white rounded-full shadow-lg p-1">
          ${count === 0
      ? `
                <button data-id="${item.id}" data-action="add"
                  class="cart-action-btn w-10 h-10 rounded-full bg-green-600 text-white grid place-items-center hover:bg-green-700 active:scale-95 transition">
                  ${iconPlus()}
                </button>
              `
      : `
                <div class="flex items-center gap-2 bg-white rounded-full px-2 py-1 shadow-lg">
                  <button data-id="${item.id}" data-action="remove"
                    class="cart-action-btn w-8 h-8 rounded-full bg-red-600 text-white grid place-items-center hover:bg-red-700 active:scale-95 transition">
                    ${iconMinus()}
                  </button>

                  <span class="font-bold text-sm min-w-[1.25rem] text-center">${count}</span>

                  <button data-id="${item.id}" data-action="add"
                    class="cart-action-btn w-8 h-8 rounded-full bg-green-600 text-white grid place-items-center hover:bg-green-700 active:scale-95 transition">
                    ${iconPlus()}
                  </button>
                </div>
              `
    }
        </div>
      </div>

      <div class="p-4 space-y-2">
        <p class="font-semibold">${safeName}</p>
        <p class="text-xs text-slate-500 line-clamp-2">${item.description ?? ""}</p>
        <p class="text-lg font-bold">${formatMoney(item.price ?? 0)}</p>
      </div>
    </div>
  `;
}

function renderItems() {
  if (!itemDisplayGrid || !menuHeading) return;

  itemDisplayGrid.innerHTML = "";

  menuHeading.textContent =
    currentCategory === "All" ? "Top Items for You" : `${currentCategory} Items`;

  const cart = getCart();
  const filtered = items.filter((i) => currentCategory === "All" || i.category === currentCategory);

  if (!filtered.length) {
    itemDisplayGrid.innerHTML =
      `<p class="text-center text-slate-500 col-span-full">No items found.</p>`;
    return;
  }

  filtered.forEach((item) => {
    const count = cart[String(item.id)] || 0;
    itemDisplayGrid.insertAdjacentHTML("beforeend", createItemCardHTML(item, count));
  });

  // bind actions
  document.querySelectorAll(".cart-action-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const { id, action } = btn.dataset;
      if (!id || !action) return;

      if (action === "add") addItem(String(id), 1);
      if (action === "remove") removeItem(String(id), 1);

      updateCartUI();
      renderItems();
    });
  });
}

// =======================
// Cart drawer
// =======================
function updateCartUI() {
  if (!cartDrawerItems || !cartCountElement || !drawerSubtotalText || !checkoutLink) return;

  const cart = getCart();
  cartCountElement.textContent = getCartCount(cart);

  const ids = Object.keys(cart).filter((id) => cart[id] > 0);

  // empty state
  if (!ids.length) {
    cartDrawerItems.innerHTML = `<p class="text-center text-slate-500 pt-10">Your cart is empty.</p>`;
    drawerSubtotalText.textContent = formatMoney(0);
    checkoutLink.classList.add("opacity-50", "pointer-events-none");
    return;
  }

  checkoutLink.classList.remove("opacity-50", "pointer-events-none");

  // render items
  cartDrawerItems.innerHTML = ids
    .map((id) => {
      const item = itemsById[String(id)];
      if (!item) return ""; // skip missing
      const count = cart[id];

      return `
        <div class="flex items-center justify-between p-2 border-b">
          <div class="flex items-center gap-3">
            <img src="${resolvePublicPath(item.image)}"
              onerror="this.onerror=null;this.src='${PLACEHOLDER_SVG_DATA_URI}'"
              class="w-12 h-12 rounded-md object-cover" />
            <div>
              <p class="font-semibold text-sm">${item.name}</p>
              <p class="text-xs text-slate-500">${formatMoney(item.price ?? 0)}</p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button data-id="${id}" data-action="remove"
              class="drawer-action w-8 h-8 rounded-full bg-red-600 text-white grid place-items-center hover:bg-red-700 active:scale-95 transition"
              aria-label="Remove one">
              ${iconMinus()}
            </button>

            <span class="font-bold min-w-[1.25rem] text-center">${count}</span>

            <button data-id="${id}" data-action="add"
              class="drawer-action w-8 h-8 rounded-full bg-green-600 text-white grid place-items-center hover:bg-green-700 active:scale-95 transition"
              aria-label="Add one">
              ${iconPlus()}
            </button>
          </div>
        </div>
      `;
    })
    .join("");

  drawerSubtotalText.textContent = formatMoney(computeSubtotal(cart, itemsById));

  // bind drawer actions
  document.querySelectorAll(".drawer-action").forEach((btn) => {
    btn.addEventListener("click", () => {
      const { id, action } = btn.dataset;
      if (!id || !action) return;

      if (action === "add") addItem(String(id), 1);
      if (action === "remove") removeItem(String(id), 1);

      updateCartUI();
      renderItems();
    });
  });
}

// =======================
// Init
// =======================
async function init() {
  const data = await loadMenu();

  categories = data.categories || [];
  items = data.items || [];

  // normalize category images
  categories = categories.map((c) => ({
    ...c,
    category_image: resolvePublicPath(c.category_image),
  }));

  // normalize items from DB (item_id, category_name, image)
  items = items
    .map((i) => ({
      ...i,
      id: i.id ?? i.item_id,
      category: i.category ?? i.category_name,
      image: resolvePublicPath(i.image),
      price: Number(i.price ?? 0),
    }))
    .filter((i) => i.id != null); // ensure id exists

  // cart uses string ids
  itemsById = Object.fromEntries(items.map((i) => [String(i.id), i]));

  renderCategories();
  renderItems();
  updateCartUI();

  openCartBtn?.addEventListener("click", openDrawer);
  closeCartBtn?.addEventListener("click", closeDrawer);
  cartBackdrop?.addEventListener("click", closeDrawer);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && cartDrawer && !cartDrawer.classList.contains("hidden")) {
      closeDrawer();
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const redirectOnLogout = withBasePath("/index.html");

  initAuthUI({ redirectOnLogout });

  init().catch((err) => {
    console.error(err);
    if (itemDisplayGrid) {
      itemDisplayGrid.innerHTML =
        `<p class="text-center text-red-600 col-span-full">Failed to load menu.</p>`;
    }
  });
});

