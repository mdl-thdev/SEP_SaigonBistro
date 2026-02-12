// SEP_SaigonBistro/frontend/public/pages/help/help.js

import { supabase } from "../../js/supabaseClient.js";
import { initAuthUI } from "../../js/auth.js";
import { API_BASE_URL } from "../../js/api.js";

function showNotice(message, type = "info") {
    const el = document.getElementById("notice");
    if (!el) return;

    el.classList.remove(
        "hidden",
        "border-amber-200", "bg-amber-50", "text-amber-900",
        "border-green-200", "bg-green-50", "text-green-900",
        "border-red-200", "bg-red-50", "text-red-900"
    );

    if (type === "success") el.classList.add("border-green-200", "bg-green-50", "text-green-900");
    else if (type === "error") el.classList.add("border-red-200", "bg-red-50", "text-red-900");
    else el.classList.add("border-amber-200", "bg-amber-50", "text-amber-900");

    el.innerHTML = message; // allow buttons/links
}

function normalizeTicketNumber(input) {
    return String(input || "").trim().toUpperCase();
}

function escapeHtml(str) {
    return String(str)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

async function requireLoginOrRedirect() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) return session;

    const next = encodeURIComponent("/pages/help/help.html");
    window.location.href =
        `/pages/login/login.html?next=${next}&reason=${encodeURIComponent("Please log in to create a support ticket.")}`;
    return null;
}

async function apiFetch(path, { method = "GET", body } = {}) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error("Not authenticated.");

    const res = await fetch(`${API_BASE_URL}${path}`, {
        method,
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
        },
        body: body ? JSON.stringify(body) : undefined,
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json?.message || "Request failed");
    return json;
}

// Ticket creation wrapper
async function createTicket({ subject, category, description }) {
    return apiFetch("/api/tickets", {
        method: "POST",
        body: { subject, category, description },
    });
}

// Load “My Cases” list
async function loadMyCases({ highlightTicketId, rangeDays = "all", ticketQuery = "" } = {}) {
    const tbody = document.getElementById("casesTbody");
    const empty = document.getElementById("casesEmpty");
    if (!tbody || !empty) return;

    tbody.innerHTML = "";
    empty.classList.add("hidden");

    const json = await apiFetch("/api/tickets/mine");
    let tickets = Array.isArray(json.tickets) ? json.tickets : []; // Ensures tickets is an array

    // filter by time range
    if (rangeDays !== "all") {
        const days = Number(rangeDays);
        const cutoff = Date.now() - days * 24 * 60 * 60 * 1000; // If user selected something like “7 days”:convert to a number, compute cutoff timestamp
        tickets = tickets.filter((t) => {
            const tTime = t.created_at ? new Date(t.created_at).getTime() : 0;
            return tTime >= cutoff; // Keep only tickets whose created_at is newer than cutoff
        });
    }

    // Filter by ticket number search
    const q = normalizeTicketNumber(ticketQuery);
    if (q) {
        tickets = tickets.filter((t) => normalizeTicketNumber(t.ticket_number).includes(q));
    }

    // Empty state: If nothing matches, show empty message and stop
    if (tickets.length === 0) {
        empty.classList.remove("hidden");
        return;
    }

    // Render each ticket row: Creates a <tr> row and gives it border styling
    for (const t of tickets) {
        const tr = document.createElement("tr");
        tr.className = "border-b last:border-b-0";

        const updated = t.updated_at ? new Date(t.updated_at).toLocaleString() : ""; // Convert update date to readable string

        if (highlightTicketId && t.id === highlightTicketId) tr.classList.add("bg-green-50");

        const ticketNumber = t.ticket_number || "-";
        const detailUrl = `/pages/help/caseDetail.html?id=${encodeURIComponent(t.id)}`;

        tr.innerHTML = `
  <td class="py-2 pr-4 font-semibold">
    <a href="${detailUrl}"
       data-ticket-id="${escapeHtml(t.id)}"
       class="ticketLink underline hover:no-underline text-slate-900">
      ${escapeHtml(ticketNumber)}
    </a>
  </td>
      <td class="py-2 pr-4">${escapeHtml(t.subject || "")}</td>
      <td class="py-2 pr-4 capitalize">${escapeHtml(t.category || "")}</td>
      <td class="py-2 pr-4">${escapeHtml(t.status || "")}</td>
      <td class="py-2 pr-4 text-slate-500">${escapeHtml(updated)}</td>
    `;

        tbody.appendChild(tr);
    }
}

// Tab switcher
function setActiveTab(tab) {
    const tabCreate = document.getElementById("tabCreate");
    const tabCases = document.getElementById("tabCases");
    const createHeader = document.getElementById("createHeader");
    const panelCreate = document.getElementById("panelCreate");
    const panelCases = document.getElementById("panelCases");

    const setBtnActive = (btn) => {
        if (!btn) return;
        btn.classList.add("bg-slate-900", "text-white");
        btn.classList.remove("bg-transparent", "text-slate-900");
    };

    const setBtnInactive = (btn) => {
        if (!btn) return;
        btn.classList.remove("bg-slate-900", "text-white");
        btn.classList.add("bg-transparent", "text-slate-900");
    };

    if (tab === "cases") {
        createHeader?.classList.add("hidden");
        panelCreate?.classList.add("hidden");
        panelCases?.classList.remove("hidden");

        setBtnInactive(tabCreate);
        setBtnActive(tabCases);
    } else {
        createHeader?.classList.remove("hidden");
        panelCases?.classList.add("hidden");
        panelCreate?.classList.remove("hidden");

        setBtnInactive(tabCases);
        setBtnActive(tabCreate);
    }
}

// Main startup: DOMContentLoaded
document.addEventListener("DOMContentLoaded", async () => {
    // Sets up header/login/logout UI. If user logs out, redirects back to login.
    await initAuthUI({ redirectOnLogout: "/pages/login/login.html?next=/pages/help/help.html" });

    // require login
    const session = await requireLoginOrRedirect();
    if (!session) return;

    // Prefetch ticket detail when clicking a ticket link
    const casesTbody = document.getElementById("casesTbody"); // Adds click handler to the table body (event delegation)
    casesTbody?.addEventListener("click", async (e) => {
        const a = e.target.closest("a.ticketLink"); // Only react if user clicked a link with class ticketLink
        if (!a) return;

        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // If user is trying to open in new tab/window or special click, don’t interfere

        e.preventDefault(); // Stop normal navigation for now (so can prefetch first)

        // Get ticket id and destination URL. If missing, stop
        const id = a.getAttribute("data-ticket-id");
        const href = a.getAttribute("href");
        if (!id || !href) return;

        // Try prefetch:
        try {
            a.classList.add("opacity-60", "pointer-events-none"); // Visually “disable” the link so they can’t spam click

            // Fetch ticket detail for that ticket (user-owned endpoint)
            const json = await apiFetch(`/api/tickets/mine/${encodeURIComponent(id)}`);

            // Store fetched data into sessionStorage. The detail page (caseDetail.html) can read this to load instantly.
            sessionStorage.setItem(
                `casePrefetch:${id}`,
                JSON.stringify({ at: Date.now(), data: json })
            );

            window.location.href = href; // Navigate to the detail page
        // Fallback if prefetch fails: Still navigate; detail page will just load normally
        } catch {
            window.location.href = href;
        } finally {
            a.classList.remove("opacity-60", "pointer-events-none"); // Cleanup: Re-enable link styling
        }
    });

    // Grab UI elements: Reads various buttons, inputs, and panels used later
    const form = document.getElementById("ticketForm");
    const submitBtn = document.getElementById("submitBtn");
    const tabCreate = document.getElementById("tabCreate");
    const tabCases = document.getElementById("tabCases");
    const refreshCasesBtn = document.getElementById("refreshCasesBtn");
    const casesRange = document.getElementById("casesRange");
    const ticketSearch = document.getElementById("ticketSearch");
    const applyCasesFilterBtn = document.getElementById("applyCasesFilterBtn");
    const clearCasesFilterBtn = document.getElementById("clearCasesFilterBtn");

    // Helper to refresh cases using filters
    async function refreshCasesWithFilters() {
        const rangeDays = casesRange?.value || "all";
        const ticketQuery = ticketSearch?.value || "";
        await loadMyCases({ rangeDays, ticketQuery }); // Reads selected range + search query and loads cases
    }

    // Filter buttons: Clicking Apply refreshes the list and shows errors if any
    applyCasesFilterBtn?.addEventListener("click", async () => {
        try {
            await refreshCasesWithFilters();
        } catch (e) {
            showNotice(e.message, "error");
        }
    });

    // Clear: Resets filters and reloads all cases
    clearCasesFilterBtn?.addEventListener("click", async () => {
        if (casesRange) casesRange.value = "all";
        if (ticketSearch) ticketSearch.value = "";
        try {
            await loadMyCases({ rangeDays: "all", ticketQuery: "" });
        } catch (e) {
            showNotice(e.message, "error");
        }
    });

    // Enter key in search triggers apply:
    ticketSearch?.addEventListener("keydown", async (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            try {
                await refreshCasesWithFilters();
            } catch (err) {
                showNotice(err.message, "error");
            }
        }
    });

    // Tab button events
    tabCreate?.addEventListener("click", () => setActiveTab("create"));
    // Switch to cases panel and load cases immediately
    tabCases?.addEventListener("click", async () => {
        setActiveTab("cases");
        try {
            await loadMyCases({
                rangeDays: casesRange?.value || "all",
                ticketQuery: ticketSearch?.value || "",
            });
        } catch (e) {
            showNotice(e.message, "error");
        }
    });

    // Refresh button: 
    refreshCasesBtn?.addEventListener("click", async () => {
        try {
            await refreshCasesWithFilters();
        } catch (e) {
            showNotice(e.message, "error");
        }
    });

    // Initial tab from URL: Reads ?tab=cases from URL
    const params = new URLSearchParams(window.location.search);
    const initialTab = params.get("tab");

    // If URL says cases, switch and load automatically
    if (initialTab === "cases") {
        setActiveTab("cases");
        try {
            await loadMyCases({
                rangeDays: casesRange?.value || "all",
                ticketQuery: ticketSearch?.value || "",
            });
        } catch (e) {
            showNotice(e.message, "error");
        }
    }

    // Stop if form not present: If there’s no ticket form on this page, don’t set up submit handler
    if (!form) return;

    // Ticket form submit handler
    form.addEventListener("submit", async (e) => {
        e.preventDefault(); // Prevents normal form submission (no page reload)

        // Read fields: Reads subject/category/description. Trims subject and description. Default category to "other".
        const subject = (document.getElementById("subject")?.value || "").trim();
        const category = document.getElementById("category")?.value || "other";
        const description = (document.getElementById("description")?.value || "").trim();

        // Validate: If missing, show error and stop
        if (!subject || !description) {
            showNotice("Please fill in Subject and Description.", "error");
            return;
        }

        // Disable button + show loading text:
        submitBtn.disabled = true;
        submitBtn.textContent = "Submitting...";

        // Create ticket: Calls backend and pulls returned ticket info
        try {
            const result = await createTicket({ subject, category, description });
            const ticket = result?.ticket;

            // Extract ticket number + id:
            const ticketNumber = ticket?.ticket_number || "(unknown)";
            const ticketId = ticket?.id;

            // Show success notice (includes a button): Uses HTML notice so it can include a button. Escapes the ticket number before inserting.
            showNotice(
                `Ticket submitted successfully. Your ticket number is <strong>${escapeHtml(ticketNumber)}</strong>. Our staff will respond soon.
        <div class="mt-3 flex flex-wrap gap-2">
          <button id="viewCasesBtn" class="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            View your cases
          </button>
        </div>`,
                "success"
            );

            form.reset(); // Reset form:

            // Hook up the “View your cases” button: Clears filters, Switches to cases tab, Reloads cases and highlights the new ticket
            document.getElementById("viewCasesBtn")?.addEventListener("click", async () => {
                if (casesRange) casesRange.value = "all";
                if (ticketSearch) ticketSearch.value = "";

                setActiveTab("cases");
                try {
                    await loadMyCases({ highlightTicketId: ticketId, rangeDays: "all", ticketQuery: "" });
                } catch (e) {
                    showNotice(e.message, "error");
                }
            });
        } catch (err) {
            showNotice(err.message || "Something went wrong.", "error");
        // Always restore submit button:
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "Submit Ticket";
        }
    });
});
