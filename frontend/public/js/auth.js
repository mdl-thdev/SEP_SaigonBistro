// SEP_SaigonBistro/frontend/public/js/auth.js

import { supabase } from "./supabaseClient.js";
import { getMe } from "./api.js";

export async function initAuthUI(options = {}) {
  const {
    redirectOnLogout = "/index.html",
    redirectAdminStaffTo = null, // e.g. "/pages/dashboard/dashboard.html"
    hideAuthAreaIfMissing = false,
  } = options;

  const authArea = document.getElementById("authArea");
  const authLoggedOut = document.getElementById("authLoggedOut");
  const authLoggedIn = document.getElementById("authLoggedIn");
  const welcomeUser = document.getElementById("welcomeUser");
  const logoutBtn = document.getElementById("logoutBtn");
  const adminDashboardLink = document.getElementById("adminDashboardLink");
  const orderNavLink = document.getElementById("orderNavLink");

  if (orderNavLink) {
    orderNavLink.href = "/pages/orders/orderStatus.html";
  }

  if (!authArea && hideAuthAreaIfMissing) return;

  async function render() {
    const { data: { session } } = await supabase.auth.getSession();

    // default hide
    adminDashboardLink?.classList.add("hidden");

    if (!session?.user) {
      authLoggedOut?.classList.remove("hidden");
      authLoggedIn?.classList.add("hidden");
      orderNavLink?.classList.remove("hidden");
      return;
    }

    // logged in
    authLoggedOut?.classList.add("hidden");
    authLoggedIn?.classList.remove("hidden");

    // fetch profile/role
    let role = "customer";
    let displayName = session.user.email || "Customer";

    try {
      const me = await getMe();
      // role from backend profile
      role = me?.profile?.role ?? role;
      // name from backend profile
      displayName =
        me?.profile?.display_name ||
        me?.profile?.name ||
        me?.profile?.displayName ||
        displayName;

      if (redirectAdminStaffTo && (role === "admin" || role === "staff")) {
        window.location.href = redirectAdminStaffTo;
        return;
      }
    } catch (e) {
      // if getMe fails, still stay logged in, just don't show admin features
      console.warn("getMe failed:", e.message);
    }
    // update UI
    if (welcomeUser) welcomeUser.textContent = `Hi, ${displayName}`;

    if (role === "admin") {
      adminDashboardLink?.classList.remove("hidden");
      orderNavLink?.classList.add("hidden");
    } else {
      orderNavLink?.classList.remove("hidden");
    }
  }

  // logout
  function withTimeout(promise, ms = 1200) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
    ]);
  }

  // logout
  logoutBtn?.addEventListener("click", async (e) => {
    e.preventDefault();

    // disable to prevent double-click / double signout
    logoutBtn.disabled = true;

    // 1) Clear local session immediately (this is the key)
    // Supabase v2 supports scope: "local" to remove session instantly on this device
    try {
      await withTimeout(supabase.auth.signOut({ scope: "local" }), 1200);
    } catch (err) {
      // even if network hangs, local logout usually already happened
      console.warn("Logout timeout or error:", err?.message || err);
    } finally {
      // 2) Redirect after logout is done (don’t redirect before)
      window.location.assign(redirectOnLogout);
    }
  });

  await render();

  // keep UI updated
  supabase.auth.onAuthStateChange(async (_event, _session) => {
    await render();
  });
}

export async function getAuthUser() {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) return null;

  // token for your backend Authorization: Bearer <token>
  const token = session.access_token;

  // role/name usually comes from your backend profile (getMe)
  let role = "customer";
  let name = session.user.email || "Customer";

  try {
    const me = await getMe();
    role = me?.profile?.role || me?.role || role;
    name = me?.profile?.name || me?.name || name;
  } catch (e) {
    // if backend fails, still return token so protected endpoints may work
    console.warn("getMe failed in getAuthUser:", e.message);
  }

  return {
    id: session.user.id,
    email: session.user.email,
    token,
    role,
    name,
  };
}
