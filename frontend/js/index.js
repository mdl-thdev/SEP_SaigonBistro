// SEP_SaigonBistro/docs/js/index.js

import { initAuthUI, getAuthUser } from "./auth.js";

document.addEventListener("DOMContentLoaded", () => {
  initAuthUI({ redirectOnLogout: "/index.html" });

  const user = getAuthUser();
  if (user?.role === "admin") {
    window.location.href = "/admin/dashboard.html";
  }
});






