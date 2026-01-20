// SEP_SaigonBistro/docs/signup/signup.js
import { signup } from "../../js/api.js";

document.addEventListener("DOMContentLoaded", () => {
  // Hide signup button if it exists (your original behavior)
  const signupBtn = document.getElementById("signupBtn");
  if (signupBtn) signupBtn.classList.add("hidden");

  const signupForm = document.getElementById("signupForm");
  if (!signupForm) return;

  // Password show/hide toggle (your original behavior)
  const pwd = document.getElementById("signupPassword");
  const toggle = document.getElementById("togglePassword");
  if (pwd && toggle) {
    toggle.addEventListener("click", () => {
      const isHidden = pwd.type === "password";
      pwd.type = isHidden ? "text" : "password";
      toggle.textContent = isHidden ? "Hide" : "Show";
    });
  }

  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("signupName")?.value?.trim() || "";
    const email = document.getElementById("signupEmail")?.value?.trim() || "";
    const password = document.getElementById("signupPassword")?.value || "";

    try {
      // Call the shared API helper (it will use Render on Vercel)
      await signup(name, email, password);

      alert("Account created successfully!");
      window.location.href = "../login/login.html";
    } catch (error) {
      console.error("Signup error:", error);
      alert(error.message || "Signup failed. Please try again.");
    }
  });
});
