// SEP_SaigonBistro/frontend/public/js/api.js

import { supabase } from "./supabaseClient.js";

const isLocal =
  location.hostname === "localhost" || location.hostname === "127.0.0.1";

export const API_BASE_URL =
  window.API_BASE_URL || (isLocal ? "http://localhost:3000" : "https://fed-saigonbistro.onrender.com");

export async function signup(displayName, email, password) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name: displayName, // shows up in Auth -> Users "Display name"
      },
    },
  });

  if (error) throw error;

  // Create / update profile row
  const { error: upsertError } = await supabase.from("profiles").upsert({
    id: data.user.id,
    email: data.user.email,
    display_name:
      data.user.user_metadata?.name ??
      data.user.email.split("@")[0],
  });

  if (upsertError) throw upsertError;

  return data;
}


async function authHeader() {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token
    ? { Authorization: `Bearer ${session.access_token}` }
    : {};
}

async function parseJsonOrThrow(res, label) {
  const text = await res.text();
  if (!res.ok) throw new Error(`${label} failed: ${res.status} ${text.slice(0, 160)}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} returned non-JSON: ${text.slice(0, 160)}`);
  }
}

export async function getMe() {
  const headers = await authHeader();

  // Try profiles/me first
  let res = await fetch(`${API_BASE_URL}/api/profiles/me`, { headers });
  if (res.ok) return parseJsonOrThrow(res, "getMe");

  // Fallback to auth/me (in case your backend implemented it there)
  res = await fetch(`${API_BASE_URL}/api/auth/me`, { headers });
  return parseJsonOrThrow(res, "getMe");
}

export async function loadMenu() {
  const res = await fetch(`${API_BASE_URL}/api/menu`, { cache: "no-store" });
  return parseJsonOrThrow(res, "loadMenu");
}

export async function createOrder(orderData) {
  const headers = { "Content-Type": "application/json", ...(await authHeader()) };

  const res = await fetch(`${API_BASE_URL}/api/orders`, {
    method: "POST",
    headers,
    body: JSON.stringify(orderData),
  });

  return parseJsonOrThrow(res, "createOrder");
}
