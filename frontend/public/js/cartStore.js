// SEP_SaigonBistro/frontend/public/js/cartStore.js

const CART_KEY = "sai_cart";
const LAST_ORDER_KEY = "saigonbistro_last_order";

function safeParse(json, fallback) {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

export function getCart() {
  const raw = localStorage.getItem(CART_KEY);
  const obj = raw ? safeParse(raw, {}) : {};
  // ensure numeric counts
  for (const k of Object.keys(obj)) obj[k] = Number(obj[k]) || 0;
  return obj;
}

export function setCart(cartObj) {
  localStorage.setItem(CART_KEY, JSON.stringify(cartObj || {}));
}

export function clearCart() {
  localStorage.removeItem(CART_KEY);
}

export function addItem(id, qty = 1) {
  const cart = getCart();
  const next = (cart[id] || 0) + qty;

  if (next <= 0) delete cart[id];
  else cart[id] = next;

  setCart(cart);
  return cart;
}

export function isCartEmpty(cart = getCart()) {
  return getCartCount(cart) === 0;
}

export function removeItem(id, qty = 1) {
  return addItem(id, -qty);
}

export function getCartCount(cart = getCart()) {
  return Object.values(cart).reduce((sum, n) => sum + (Number(n) || 0), 0);
}

export function computeSubtotal(cart, itemsById) {
  let subtotal = 0;
  for (const [id, count] of Object.entries(cart)) {
    const item = itemsById[id];
    if (item && count > 0) subtotal += item.price * count;
  }
  return subtotal;
}

// Save last order for orderStatus page
export function saveLastOrder(order) {
  localStorage.setItem(LAST_ORDER_KEY, JSON.stringify(order));
}

export function getLastOrder() {
  const raw = localStorage.getItem(LAST_ORDER_KEY);
  return raw ? safeParse(raw, null) : null;
}
