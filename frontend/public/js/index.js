// SEP_SaigonBistro/frontend/public/js/index.js

import { supabase } from "./supabaseClient.js";

import { initAuthUI } from "./auth.js";

document.addEventListener("DOMContentLoaded", async () => {
  await initAuthUI({
    redirectOnLogout: "/index.html",
    redirectAdminStaffTo: "/pages/dashboard/dashboard.html",
  });
});

export async function initAuthUI({ redirectOnLogout } = {}) {
  const { data: { session } } = await supabase.auth.getSession();

  toggleNavbar(!!session?.user, session?.user);

  // only call /me if logged in
  if (session?.access_token) {
    const r = await fetch("http://127.0.0.1:3000/api/me", {
      headers: { Authorization: `Bearer ${session.access_token}` }
    });

    if (r.ok) {
      const json = await r.json();
      const role = json?.profile?.role;

      if (role === "admin" || role === "staff") {
        window.location.href = "/pages/dashboard/dashboard.html";
        return;
      }
    }
  }

  supabase.auth.onAuthStateChange((_event, session) => {
    toggleNavbar(!!session?.user, session?.user);
    if (!session && redirectOnLogout) window.location.href = redirectOnLogout;
  });
}






