// SEP_SaigonBistro/frontend/public/pages/help/help.js

import { supabase } from "/js/supabaseClient.js";
import { initAuthUI } from "/js/auth.js";

const API_BASE = "http://127.0.0.1:3000";

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

    const res = await fetch(`${API_BASE}${path}`, {
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

async function createTicket({ subject, category, description }) {
    return apiFetch("/api/tickets", {
        method: "POST",
        body: { subject, category, description },
    });
}

async function loadMyCases({ highlightTicketId, rangeDays = "all", ticketQuery = "" } = {}) {
    const tbody = document.getElementById("casesTbody");
    const empty = document.getElementById("casesEmpty");
    if (!tbody || !empty) return;

    tbody.innerHTML = "";
    empty.classList.add("hidden");

    const json = await apiFetch("/api/tickets/mine");
    let tickets = Array.isArray(json.tickets) ? json.tickets : [];

    // filter by time range
    if (rangeDays !== "all") {
        const days = Number(rangeDays);
        const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
        tickets = tickets.filter((t) => {
            const tTime = t.created_at ? new Date(t.created_at).getTime() : 0;
            return tTime >= cutoff;
        });
    }

    // search by ticket number
    const q = normalizeTicketNumber(ticketQuery);
    if (q) {
        tickets = tickets.filter((t) => normalizeTicketNumber(t.ticket_number).includes(q));
    }

    if (tickets.length === 0) {
        empty.classList.remove("hidden");
        return;
    }

    for (const t of tickets) {
        const tr = document.createElement("tr");
        tr.className = "border-b last:border-b-0";

        const updated = t.updated_at ? new Date(t.updated_at).toLocaleString() : "";

        if (highlightTicketId && t.id === highlightTicketId) tr.classList.add("bg-green-50");

        const ticketNumber = t.ticket_number || "-";
        const detailUrl = `/pages/help/caseDetail.html?id=${encodeURIComponent(t.id)}`;

        tr.innerHTML = `
      <td class="py-2 pr-4 font-semibold">
        <a href="${detailUrl}" class="underline hover:no-underline text-slate-900">
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

// simple tab switch
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

function withTimeout(promise, ms = 1200) {
    return Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
    ]);
}

document.addEventListener("DOMContentLoaded", async () => {
    // init header auth UI first (it shows/hides logoutBtn)
    await initAuthUI({ redirectOnLogout: "/pages/login/login.html?next=/pages/help/help.html" });

    // require login
    const session = await requireLoginOrRedirect();
    if (!session) return;

    const form = document.getElementById("ticketForm");
    const submitBtn = document.getElementById("submitBtn");
    const tabCreate = document.getElementById("tabCreate");
    const tabCases = document.getElementById("tabCases");
    const refreshCasesBtn = document.getElementById("refreshCasesBtn");
    const casesRange = document.getElementById("casesRange");
    const ticketSearch = document.getElementById("ticketSearch");
    const applyCasesFilterBtn = document.getElementById("applyCasesFilterBtn");
    const clearCasesFilterBtn = document.getElementById("clearCasesFilterBtn");

    async function refreshCasesWithFilters() {
        const rangeDays = casesRange?.value || "all";
        const ticketQuery = ticketSearch?.value || "";
        await loadMyCases({ rangeDays, ticketQuery });
    }

    applyCasesFilterBtn?.addEventListener("click", async () => {
        try {
            await refreshCasesWithFilters();
        } catch (e) {
            showNotice(e.message, "error");
        }
    });

    clearCasesFilterBtn?.addEventListener("click", async () => {
        if (casesRange) casesRange.value = "all";
        if (ticketSearch) ticketSearch.value = "";
        try {
            await loadMyCases({ rangeDays: "all", ticketQuery: "" });
        } catch (e) {
            showNotice(e.message, "error");
        }
    });

    // press Enter in search box triggers apply
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

    tabCreate?.addEventListener("click", () => setActiveTab("create"));
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

    refreshCasesBtn?.addEventListener("click", async () => {
        try {
            await refreshCasesWithFilters();
        } catch (e) {
            showNotice(e.message, "error");
        }
    });

    // initial tab from URL (?tab=cases)
    const params = new URLSearchParams(window.location.search);
    const initialTab = params.get("tab");

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

    if (!form) return;

    form.addEventListener("submit", async (e) => {
        e.preventDefault();

        const subject = (document.getElementById("subject")?.value || "").trim();
        const category = document.getElementById("category")?.value || "other";
        const description = (document.getElementById("description")?.value || "").trim();

        if (!subject || !description) {
            showNotice("Please fill in Subject and Description.", "error");
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = "Submitting...";

        try {
            const result = await createTicket({ subject, category, description });
            const ticket = result?.ticket;

            const ticketNumber = ticket?.ticket_number || "(unknown)";
            const ticketId = ticket?.id;

            showNotice(
                `Ticket submitted successfully. Your ticket number is <strong>${escapeHtml(ticketNumber)}</strong>. Our staff will respond soon.
        <div class="mt-3 flex flex-wrap gap-2">
          <button id="viewCasesBtn" class="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            View your cases
          </button>
        </div>`,
                "success"
            );

            form.reset();

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
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = "Submit Ticket";
        }
    });
});
