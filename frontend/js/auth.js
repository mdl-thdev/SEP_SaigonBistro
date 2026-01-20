// SEP_SaigonBistro/docs/js/auth.js

const AUTH_KEYS = ["saigonbistro_user", "currentUser"];

export function getAuthUser() {
  for (const key of AUTH_KEYS) {
    try {
      const v = JSON.parse(localStorage.getItem(key) || "null");
      if (v) return v;
    } catch {}
  }
  return null;
}

export function clearAuthUser() {
  for (const key of AUTH_KEYS) localStorage.removeItem(key);
}

export function initAuthUI(options = {}) {
  const {
    redirectOnLogout = "/index.html",
    hideAuthAreaIfMissing = false,
  } = options;

  const authArea = document.getElementById("authArea");
  const authLoggedOut = document.getElementById("authLoggedOut");
  const authLoggedIn = document.getElementById("authLoggedIn");
  const welcomeUser = document.getElementById("welcomeUser");
  const logoutBtn = document.getElementById("logoutBtn");
  const adminDashboardLink = document.getElementById("adminDashboardLink");

  // query inside init (DOM is ready)
  const orderNavLink = document.getElementById("orderNavLink");

  const user = getAuthUser();

  if (!authArea && hideAuthAreaIfMissing) return;

  // default: hide dashboard
  adminDashboardLink?.classList.add("hidden");

  if (user) {
    // logged in UI
    authLoggedOut?.classList.add("hidden");
    authLoggedIn?.classList.remove("hidden");

    if (welcomeUser) {
      const displayName = user.name || user.email || "Customer";
      welcomeUser.textContent = `Hi, ${displayName}`;
    }

    // Role-based nav
    if (user.role === "admin") {
      adminDashboardLink?.classList.remove("hidden");
      orderNavLink?.classList.add("hidden");
    } else {
      adminDashboardLink?.classList.add("hidden");
      orderNavLink?.classList.remove("hidden");
    }
  } else {
    // logged out UI
    authLoggedOut?.classList.remove("hidden");
    authLoggedIn?.classList.add("hidden");

    adminDashboardLink?.classList.add("hidden");
    orderNavLink?.classList.remove("hidden");
  }

  // logout
  logoutBtn?.addEventListener("click", () => {
    clearAuthUser();
    window.location.href = redirectOnLogout;
  });
}
