// SEP_SaigonBistro/frontend/public/js/api.js

import { supabase } from "./supabaseClient.js";

const isLocal =
  location.hostname === "localhost" || location.hostname === "127.0.0.1";

const API_BASE_URL = isLocal
  ? "http://localhost:3000"
  : "https://fed-saigonbistro.onrender.com";

async function authHeader() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token
    ? { Authorization: `Bearer ${session.access_token}` }
    : {};
}

// helper: avoid "Unexpected token <" when server returns HTML errors
async function parseJsonOrThrow(res, label) {
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${label} failed: ${res.status} ${text.slice(0, 160)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} returned non-JSON: ${text.slice(0, 160)}`);
  }
}

export async function getMe() {
  const headers = await authHeader();

  // point to a real route your backend provides.
  // Common choices are /api/profiles/me or /api/auth/me.
  // Start with profiles/me (most typical).
  const res = await fetch(`${API_BASE_URL}/api/profiles/me`, { headers });
  return parseJsonOrThrow(res, "getMe");
}

export async function loadMenu() {
  const res = await fetch(`${API_BASE_URL}/api/menu`, { cache: "no-store" });
  return parseJsonOrThrow(res, "loadMenu");
}

export async function createOrder(orderData) {
  const headers = { "Content-Type": "application/json", ...(await authHeader()) };

  // backend route is /api/orders (plural)
  const res = await fetch(`${API_BASE_URL}/api/orders`, {
    method: "POST",
    headers,
    body: JSON.stringify(orderData),
  });

  return parseJsonOrThrow(res, "createOrder");
}
