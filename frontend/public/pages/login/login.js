// SEP_SaigonBistro/frontend/pages/login/login.js

import { supabase } from "../../js/supabaseClient.js";
import { getMe } from "../../js/api.js";

// Detect env
const isGitHubPages = window.location.hostname.includes("github.io");
const BASE_PATH = isGitHubPages ? "/SEP_SaigonBistro" : "";

// Prefix paths only when needed (for GitHub Pages)
function getPath(path) {
  if (!path.startsWith("/")) return path;
  return `${BASE_PATH}${path}`;
}

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");

  const params = new URLSearchParams(window.location.search);
  const reason = params.get("reason");

  const loginNotice = document.getElementById("loginNotice");
  const loginNoticeText = document.getElementById("loginNoticeText");

  if (reason && loginNotice && loginNoticeText) {
    loginNoticeText.textContent = reason;
    loginNotice.classList.remove("hidden");
  }

  // Show/Hide password
  const pwd = document.getElementById("loginPassword");
  const toggle = document.getElementById("togglePassword");
  if (pwd && toggle) {
    toggle.addEventListener("click", () => {
      const isHidden = pwd.type === "password";
      pwd.type = isHidden ? "text" : "password";
      toggle.textContent = isHidden ? "Hide" : "Show";
    });
  }

  if (!loginForm) return;

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = (document.getElementById("loginEmail")?.value || "").trim();
    const password = document.getElementById("loginPassword")?.value || "";

    try {
      // 1) Login with Supabase (creates browser session + access token)
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        alert(error.message || "Login failed.");
        return;
      }

      // 2) Fetch role/profile from your backend using Bearer token (api.js adds it)
      const me = await getMe();
      const role = me?.profile?.role || "customer";

      // Optional: store for UI convenience (NOT used for backend auth)
      localStorage.setItem("currentUser", JSON.stringify({ id: data.user.id, email: data.user.email, role }));

      // 3) Redirect
      const params2 = new URLSearchParams(window.location.search);
      const next = params2.get("next");
      if (next) {
        window.location.href = getPath(decodeURIComponent(next));
        return;
      }

      window.location.href =
        role === "admin" || role === "staff"
          ? getPath("/pages/dashboard/dashboard.html")
          : getPath("/index.html");

    } catch (err) {
      console.error("Login error:", err);
      alert(err.message || "An error occurred. Please try again.");
    }
  });
});
