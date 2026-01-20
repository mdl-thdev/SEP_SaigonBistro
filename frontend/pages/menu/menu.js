// SEP_SaigonBistro/docs/menu/menu.js

import { initAuthUI } from "../../js/auth.js";
import { loadMenu } from "../../js/api.js";
import { formatMoney } from "../../js/utils.js";
import {
  getCart,
  addItem,
  removeItem,
  getCartCount,
  computeSubtotal
} from "../../js/cartStore.js";

const itemDisplayGrid = document.getElementById("itemDisplayGrid");
const categoryListContainer = document.getElementById("categoryList");
const menuHeading = document.getElementById("menu-heading");

const cartCountElement = document.getElementById("cartCount");
const cartDrawerItems = document.getElementById("cartDrawerItems");
const drawerSubtotalText = document.getElementById("drawerSubtotalText");
const emptyCartMessage = document.getElementById("emptyCartMessage");
const checkoutLink = document.getElementById("checkoutLink");

const cartDrawer = document.getElementById("cartDrawer");
const openCartBtn = document.getElementById("openCartBtn");
const closeCartBtn = document.getElementById("closeCartBtn");
const cartBackdrop = document.getElementById("cartBackdrop");

// =======================
// State
// =======================
let assets = {};
let categories = [];
let items = [];
let itemsById = {};
let currentCategory = "All";

// =======================
// Drawer helpers
// =======================
function openDrawer() {
  cartDrawer.classList.remove("hidden");
}
function closeDrawer() {
  cartDrawer.classList.add("hidden");
}

// =======================
// Category UI
// =======================
function createCategoryHTML(name, image) {
  const isActive = name === currentCategory ? "border-slate-900" : "border-transparent";
  const isBold = name === currentCategory ? "font-bold" : "font-semibold";

  return `
    <div data-category="${name}" class="category-item cursor-pointer text-center space-y-2 group">
      <img src="${image}" alt="${name}"
        class="w-20 h-20 rounded-full border-4 ${isActive}
        group-hover:border-slate-900 transition mx-auto object-cover hover:scale-[1.05]">
      <p class="${isBold} text-sm text-slate-700">${name}</p>
    </div>
  `;
}

function renderCategories() {
  categoryListContainer.innerHTML = "";

  const allImage = assets.item1 || categories[0]?.category_image || "";
  categoryListContainer.insertAdjacentHTML(
    "beforeend",
    createCategoryHTML("All", allImage)
  );

  categories.forEach(c => {
    categoryListContainer.insertAdjacentHTML(
      "beforeend",
      createCategoryHTML(c.category_name, c.category_image)
    );
  });

  document.querySelectorAll(".category-item").forEach(el => {
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
  return `
    <div class="w-full rounded-xl shadow-md overflow-hidden relative">
      <div class="relative aspect-square overflow-hidden">
        <img src="${item.image}" alt="${item.name}" class="w-full h-full object-cover">
        <div class="absolute bottom-4 right-4 bg-white rounded-full shadow-lg p-1">
          ${
            count === 0
              ? `<button data-id="${item.id}" data-action="add" class="cart-action-btn p-1">
                   <img src="${assets.add_icon}" class="w-7 h-7">
                 </button>`
              : `<div class="flex items-center gap-2">
                   <button data-id="${item.id}" data-action="remove" class="cart-action-btn p-1">
                     <img src="${assets.remove_icon_red}" class="w-4 h-4">
                   </button>
                   <span class="font-bold text-sm">${count}</span>
                   <button data-id="${item.id}" data-action="add" class="cart-action-btn p-1">
                     <img src="${assets.add_icon_green}" class="w-4 h-4">
                   </button>
                 </div>`
          }
        </div>
      </div>

      <div class="p-4 space-y-2">
        <p class="font-semibold">${item.name}</p>
        <p class="text-xs text-slate-500 line-clamp-2">${item.description}</p>
        <p class="text-lg font-bold">${formatMoney(item.price)}</p>
      </div>
    </div>
  `;
}

function renderItems() {
  itemDisplayGrid.innerHTML = "";

  menuHeading.textContent =
    currentCategory === "All" ? "Top Items for You" : `${currentCategory} Items`;

  const cart = getCart();
  const filtered = items.filter(
    i => currentCategory === "All" || i.category === currentCategory
  );

  if (!filtered.length) {
    itemDisplayGrid.innerHTML =
      `<p class="text-center text-slate-500 col-span-full">No items found.</p>`;
    return;
  }

  filtered.forEach(item => {
    const count = cart[item.id] || 0;
    itemDisplayGrid.insertAdjacentHTML(
      "beforeend",
      createItemCardHTML(item, count)
    );
  });

  document.querySelectorAll(".cart-action-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const { id, action } = btn.dataset;
      if (action === "add") addItem(id, 1);
      if (action === "remove") removeItem(id, 1);
      updateCartUI();
      renderItems();
    });
  });
}

// =======================
// Cart drawer
// =======================
function updateCartUI() {
  const cart = getCart();
  cartCountElement.textContent = getCartCount(cart);

  cartDrawerItems.innerHTML = "";
  const ids = Object.keys(cart).filter(id => cart[id] > 0);

  if (!ids.length) {
    cartDrawerItems.appendChild(emptyCartMessage);
    drawerSubtotalText.textContent = formatMoney(0);
    checkoutLink.classList.add("opacity-50", "pointer-events-none");
    return;
  }

  emptyCartMessage.remove?.();

  ids.forEach(id => {
    const item = itemsById[id];
    const count = cart[id];
    cartDrawerItems.insertAdjacentHTML(
      "beforeend",
      `
      <div class="flex items-center justify-between p-2 border-b">
        <div class="flex items-center gap-3">
          <img src="${item.image}" class="w-12 h-12 rounded-md">
          <div>
            <p class="font-semibold text-sm">${item.name}</p>
            <p class="text-xs text-slate-500">${formatMoney(item.price)}</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button data-id="${id}" data-action="remove" class="drawer-action">
            <img src="${assets.remove_icon_red}" class="w-4 h-4">
          </button>
          <span class="font-bold">${count}</span>
          <button data-id="${id}" data-action="add" class="drawer-action">
            <img src="${assets.add_icon_green}" class="w-4 h-4">
          </button>
        </div>
      </div>`
    );
  });

  drawerSubtotalText.textContent =
    formatMoney(computeSubtotal(cart, itemsById));
  checkoutLink.classList.remove("opacity-50", "pointer-events-none");

  document.querySelectorAll(".drawer-action").forEach(btn => {
    btn.addEventListener("click", () => {
      const { id, action } = btn.dataset;
      if (action === "add") addItem(id, 1);
      if (action === "remove") removeItem(id, 1);
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

  assets = data.assets || {};
  categories = data.categories || [];
  items = data.items || [];
  itemsById = Object.fromEntries(items.map(i => [i.id, i]));

  renderCategories();
  renderItems();
  updateCartUI();

  openCartBtn.addEventListener("click", openDrawer);
  closeCartBtn.addEventListener("click", closeDrawer);
  cartBackdrop.addEventListener("click", closeDrawer);

  document.addEventListener("keydown", e => {
    if (e.key === "Escape" && !cartDrawer.classList.contains("hidden")) {
      closeDrawer();
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const isGitHubPages = window.location.hostname.includes("github.io");
  const redirectOnLogout = isGitHubPages
    ? "/FED_KCoffee/index.html"
    : "/index.html";

  initAuthUI({ redirectOnLogout });

  init().catch(err => {
    console.error(err);
    itemDisplayGrid.innerHTML =
      `<p class="text-center text-red-600 col-span-full">Failed to load menu.</p>`;
  });
});
