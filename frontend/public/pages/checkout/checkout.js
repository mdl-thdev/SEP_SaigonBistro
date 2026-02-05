// SEP_SaigonBistro/frontend/public/pages/checkout/checkout.js

import { initAuthUI, getAuthUser } from "../../js/auth.js";
import { loadMenu, createOrder } from "../../js/api.js";
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
const placeOrderBtn = document.getElementById("placeOrderBtn");
const orderConfirmation = document.getElementById("orderConfirmation");

let itemsById = {};

// NO RANDOM FAILURE
function pretendPayment() {
  return { ok: true };
}

function setButtonTotal(value) {
  const el = document.getElementById("buttonTotalText");
  if (el) el.textContent = formatMoney(value);
}

function renderSummary() {
  const cart = getCart();
  const ids = Object.keys(cart).filter((id) => cart[id] > 0);

  if (ids.length === 0) {
    emptyCheckoutMessage?.classList.remove("hidden");

    subtotalText.textContent = formatMoney(0);
    deliveryFeeText.textContent = formatMoney(0);
    totalText.textContent = formatMoney(0);
    setButtonTotal(0);

    placeOrderBtn.disabled = true;
    placeOrderBtn.classList.add("opacity-50", "pointer-events-none");
    return;
  }

  emptyCheckoutMessage?.classList.add("hidden");

  checkoutCartItemsContainer.innerHTML = ids
    .map((id) => {
      const item = itemsById[id];
      return `
        <div class="flex justify-between text-sm py-1 border-b">
          <span>${cart[id]} x ${item.name}</span>
          <span>${formatMoney(item.price * cart[id])}</span>
        </div>
      `;
    })
    .join("");

  const subtotal = computeSubtotal(cart, itemsById);
  const total = subtotal + DELIVERY_FEE;

  subtotalText.textContent = formatMoney(subtotal);
  deliveryFeeText.textContent = formatMoney(DELIVERY_FEE);
  totalText.textContent = formatMoney(total);
  setButtonTotal(total);

  // ENABLE button
  placeOrderBtn.disabled = false;
  placeOrderBtn.classList.remove("opacity-50", "pointer-events-none");
}

async function handleSubmit(e) {
  e.preventDefault();

  const user = await getAuthUser();
  if (!user) return alert("Please log in.");

  const cart = getCart();
  const ids = Object.keys(cart).filter((id) => cart[id] > 0);
  if (!ids.length) return alert("Cart empty.");

  const payment = pretendPayment();
  if (!payment.ok) return alert(payment.message);

  const formData = new FormData(form);
  const customer = Object.fromEntries(formData.entries());

  const cartLines = ids.map((id) => ({
    menu_item_id: id,
    qty: Number(cart[id]),
  }));

  const payload = {
    customer_name: `${customer.firstName} ${customer.lastName}`,
    customer_email: customer.email,
    delivery: {
      address: customer.address,
      phone: customer.phone,
      notes: customer.notes || null,
    },
    cart: cartLines,
  };

  placeOrderBtn.disabled = true;

  try {
    const res = await createOrder(payload);
    saveLastOrder(res.order);
    clearCart();

    form.classList.add("hidden");
    placeOrderBtn.classList.add("hidden");
    orderConfirmation.classList.remove("hidden");

    setTimeout(() => {
      window.location.href = `/pages/orders/orderStatus.html?orderId=${res.order.id}`;
    }, 800);
  } catch (err) {
    alert(err.message);
  } finally {
    placeOrderBtn.disabled = false;
  }
}

async function init() {
  const menu = await loadMenu();
  itemsById = Object.fromEntries(menu.items.map((i) => [String(i.id), i]));
  renderSummary();
  form.addEventListener("submit", handleSubmit);
}

document.addEventListener("DOMContentLoaded", () => {
  initAuthUI({ redirectOnLogout: "/index.html" });
  init();
});
