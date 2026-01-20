// SEP_SaigonBistro/docs/checkout/checkout.js

import { initAuthUI, getAuthUser } from "../../js/auth.js";
import { loadMenu } from "../../js/api.js";
import { formatMoney } from "../../js/utils.js";
import {
  getCart,
  clearCart,
  computeSubtotal,
  saveLastOrder,
} from "../../js/cartStore.js";

const DELIVERY_FEE = 5;

const form = document.getElementById("checkoutForm");
const checkoutCartItemsContainer = document.getElementById("checkoutCartItems");
const emptyCheckoutMessage = document.getElementById("emptyCheckoutMessage");

const subtotalText = document.getElementById("subtotalText");
const deliveryFeeText = document.getElementById("deliveryFeeText");
const totalText = document.getElementById("totalText");
const buttonTotalText = document.getElementById("buttonTotalText");
const placeOrderBtn = document.getElementById("placeOrderBtn");
const orderConfirmation = document.getElementById("orderConfirmation");

// preserve original button markup so we don't destroy <span id="buttonTotalText">
const originalBtnHTML = placeOrderBtn ? placeOrderBtn.innerHTML : "";

let itemsById = {};

// Demo payment simulation
function pretendPayment() {
  // 90% success
  const ok = Math.random() < 0.9;
  return ok
    ? { ok: true }
    : { ok: false, message: "Payment failed (demo). Please try again." };
}

function renderSummary() {
  const cart = getCart();
  const ids = Object.keys(cart).filter((id) => cart[id] > 0);

  let rowsHTML = "";

  if (ids.length === 0) {
    emptyCheckoutMessage.classList.remove("hidden");

    subtotalText.textContent = formatMoney(0);
    deliveryFeeText.textContent = formatMoney(0);
    totalText.textContent = formatMoney(0);
    if (buttonTotalText) buttonTotalText.textContent = formatMoney(0);

    placeOrderBtn.classList.add("opacity-50", "pointer-events-none");
    checkoutCartItemsContainer
      .querySelectorAll("[data-row='item']")
      .forEach((n) => n.remove());
    return;
  }

  emptyCheckoutMessage.classList.add("hidden");

  ids.forEach((id) => {
    const item = itemsById[id];
    const count = cart[id];
    if (!item) return;

    rowsHTML += `
      <div data-row="item" class="flex justify-between text-sm py-1 border-b border-slate-200">
        <span class="text-slate-700">${count} x ${item.name}</span>
        <span class="font-semibold">${formatMoney(item.price * count)}</span>
      </div>
    `;
  });

  // Remove old item rows and insert new ones
  checkoutCartItemsContainer
    .querySelectorAll("[data-row='item']")
    .forEach((n) => n.remove());
  emptyCheckoutMessage.insertAdjacentHTML("afterend", rowsHTML);

  const subtotal = computeSubtotal(cart, itemsById);
  const total = subtotal > 0 ? subtotal + DELIVERY_FEE : 0;

  subtotalText.textContent = formatMoney(subtotal);
  deliveryFeeText.textContent = formatMoney(DELIVERY_FEE);
  totalText.textContent = formatMoney(total);
  if (buttonTotalText) buttonTotalText.textContent = formatMoney(total);

  placeOrderBtn.classList.remove("opacity-50", "pointer-events-none");
}

async function handleSubmit(e) {
  e.preventDefault();

  const cart = getCart();
  const ids = Object.keys(cart).filter((id) => cart[id] > 0);

  if (ids.length === 0) {
    alert("Your cart is empty.");
    return;
  }

  const user = getAuthUser(); // may be null (guest)
  if (user?.role === "admin") {
    alert("Admin accounts cannot place customer orders.");
    return;
  }

  if (!form.checkValidity()) {
    alert("Please fill out all required fields.");
    return;
  }

  // demo payment check
  const paymentResult = pretendPayment();
  if (!paymentResult.ok) {
    alert(paymentResult.message);
    return;
  }

  const formData = new FormData(form);
  const customer = Object.fromEntries(formData.entries());

  const subtotal = computeSubtotal(cart, itemsById);
  const total = subtotal + DELIVERY_FEE;

  // NOTE: no id here — server should create short id and return it
  const order = {
    createdAt: new Date().toISOString(),
    customer,
    cart,
    totals: { subtotal, deliveryFee: DELIVERY_FEE, total },
    status: "CONFIRMED",
    timeline: [{ status: "CONFIRMED", at: new Date().toISOString() }],
    payment: { status: "PAID" }, // demo
  };

  // preserve button markup
  if (placeOrderBtn) placeOrderBtn.textContent = "Processing...";
  if (placeOrderBtn) placeOrderBtn.disabled = true;

  try {
    // Only send auth headers if user exists
    const headers = { "Content-Type": "application/json" };
    if (user) {
      headers["x-user-id"] = String(user.id);
      headers["x-user-role"] = String(user.role);
    }

    const res = await fetch("/api/order", {
      method: "POST",
      headers,
      body: JSON.stringify(order),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || `Server error (${res.status})`);
    }

    const data = await res.json();
    const savedOrder = data.order;

    // save locally for order status page (useful for logged-in users; harmless for guests)
    saveLastOrder(savedOrder);
    clearCart();

    // show success UI
    form.classList.add("hidden");
    placeOrderBtn.classList.add("hidden");
    orderConfirmation.classList.remove("hidden");

    renderSummary();

    // Redirect: guests -> login with reason, users -> order status
    setTimeout(() => {
      if (!user) {
        window.location.href = `/login/login.html?reason=${encodeURIComponent(
          "Please log in to view your order status."
        )}`;
      } else {
        window.location.href = `/orders/orderStatus.html?orderId=${encodeURIComponent(
          savedOrder.id
        )}`;
      }
    }, 1200);
  } catch (err) {
    console.error(err);
    alert(`Order failed: ${err.message}`);
  } finally {
    // restore original HTML so #buttonTotalText span is not destroyed
    if (placeOrderBtn && originalBtnHTML) placeOrderBtn.innerHTML = originalBtnHTML;
    if (placeOrderBtn) placeOrderBtn.disabled = false;
  }
}

async function init() {
  const menu = await loadMenu();
  itemsById = Object.fromEntries((menu.items || []).map((i) => [String(i.id), i]));

  renderSummary();
  form.addEventListener("submit", handleSubmit);
}

document.addEventListener("DOMContentLoaded", () => {
  initAuthUI({ redirectOnLogout: "/index.html" });

  init().catch((err) => {
    console.error(err);
    alert("Failed to load checkout data.");
  });
});
