// SEP_SaigonBistro/docs/login/login.js
import { login } from "../../js/api.js";

// Detect env
const isGitHubPages = window.location.hostname.includes("github.io");
const isLocal =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

// GitHub Pages needs repo base path; Vercel does not
const BASE_PATH = isGitHubPages ? "/SEP_SaigonBistro" : "";

// Prefix paths only when needed (for GitHub Pages)
function getPath(path) {
  if (!path.startsWith("/")) return path;
  return `${BASE_PATH}${path}`;
}

document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");

  // Show reason message (e.g., redirected from Order Status)
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

    const emailEl = document.getElementById("loginEmail");
    const passEl = document.getElementById("loginPassword");

    const email = (emailEl?.value || "").trim();
    const password = passEl?.value || "";

    try {
      // Uses Render API automatically on Vercel + GitHub Pages (via api.js)
      const data = await login(email, password);

      if (!data?.success || !data?.user) {
        alert(data?.message || "Login failed. Please check your credentials.");
        return;
      }

      const user = data.user;

      // Save session (both keys for compatibility)
      localStorage.setItem("currentUser", JSON.stringify(user));
      localStorage.setItem("kcoffee_user", JSON.stringify(user));

      const params2 = new URLSearchParams(window.location.search);
      const next = params2.get("next");

      // Respect "next" for BOTH admin and customer
      if (next) {
        // next is expected to be a path like "/orders/orderStatus.html?..."
        window.location.href = getPath(decodeURIComponent(next));
        return;
      }

      // Otherwise route by role
      window.location.href =
        user.role === "admin"
          ? getPath("/admin/dashboard.html")
          : getPath("/index.html");
    } catch (error) {
      console.error("Login error:", error);
      alert(error.message || "An error occurred. Please try again later.");
    }
  });
});
