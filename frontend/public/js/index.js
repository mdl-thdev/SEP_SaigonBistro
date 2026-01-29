// SEP_SaigonBistro/frontend/public/js/index.js

import { initAuthUI } from "./auth.js";

document.addEventListener("DOMContentLoaded", async () => {
  await initAuthUI({
    redirectOnLogout: "/index.html",
    redirectAdminStaffTo: "/pages/dashboard/dashboard.html",
  });
});
