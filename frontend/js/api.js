// SEP_SaigonBistro/docs/js/api.js

const isLocal =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

const API_BASE_URL = isLocal ? "" : "https://fed-SaigonBistro.onrender.com";

export async function loadMenu() {
  const res = await fetch(`${API_BASE_URL}/api/menu`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to load menu: ${res.status}`);
  }
  return res.json();
}

export async function signup(name, email, password) {
  const res = await fetch(`${API_BASE_URL}/api/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Signup failed" }));
    throw new Error(err.message || "Signup failed");
  }
  return res.json();
}

export async function login(email, password) {
  const res = await fetch(`${API_BASE_URL}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Login failed" }));
    throw new Error(err.message || "Login failed");
  }
  return res.json();
}

export async function createOrder(orderData) {
  const user = JSON.parse(localStorage.getItem("currentUser") || "null");
  const headers = {
    "Content-Type": "application/json",
  };
  if (user) {
    headers["x-user-id"] = String(user.id);
    headers["x-user-role"] = user.role || "customer";
  }

  const res = await fetch(`${API_BASE_URL}/api/order`, {
    method: "POST",
    headers,
    body: JSON.stringify(orderData),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Failed to create order" }));
    throw new Error(err.message || "Failed to create order");
  }
  return res.json();
}

export async function getOrderStatus(orderId) {
  const user = JSON.parse(localStorage.getItem("currentUser") || "null");
  if (!user || !user.id) {
    throw new Error("Login required to view order status");
  }

  const headers = {
    "x-user-id": String(user.id),
    "x-user-role": user.role || "customer",
  };

  const res = await fetch(`${API_BASE_URL}/api/order/${orderId}`, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Failed to load order" }));
    throw new Error(err.message || "Failed to load order");
  }
  return res.json();
}

export async function loadOrders(userRole) {
  const res = await fetch(`${API_BASE_URL}/api/orders`, {
    headers: { "x-user-role": userRole },
  });
  if (!res.ok) {
    throw new Error(`Failed to load orders: ${res.status}`);
  }
  return res.json();
}

export async function updateOrderStatus(orderId, status, userRole) {
  const res = await fetch(`${API_BASE_URL}/api/orders/${orderId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "x-user-role": userRole,
    },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    throw new Error(`Failed to update order: ${res.status}`);
  }
  return res.json();
}