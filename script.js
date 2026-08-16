/*
  SARVAM ANNA CHATHRAM
  Frontend JavaScript

  IMPORTANT:
  After deploying Google Apps Script, paste the /exec URL below.
*/
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwdjrzfXwVWfjn_6DcGIT3ug9IT_rNtHX953Y4A8YQkp6kRFQrcYuvFUNUEyW5rSK5WRg/exec";

const STORAGE_KEYS = {
  occasions: "sarvamCustomOccasions",
  volunteers: "sarvamCustomVolunteers",
  localBookings: "sarvamLocalBookings"
};

const DEFAULT_OCCASIONS = [
  "Birthday",
  "Wedding Day",
  "Memorial Day",
  "Anniversary",
  "Other"
];

let allBookings = [];
let lastSavedBooking = null;

document.addEventListener("DOMContentLoaded", initApp);

function initApp() {
  bindEvents();
  loadCustomOccasions();
  loadCustomVolunteers();
  setDefaultDate();
  setDefaultPaymentStatus();
  loadBookings();
  loadTodaysSponsor();
}

function bindEvents() {
  document.getElementById("bookingForm").addEventListener("submit", handleBookingSubmit);

  document.getElementById("openOccasionModalBtn").addEventListener("click", () => {
    openModal("occasionModal");
  });

  document.getElementById("openVolunteerModalBtn").addEventListener("click", () => {
    openModal("volunteerModal");
  });

  document.getElementById("occasionForm").addEventListener("submit", (event) => {
    event.preventDefault();
    addOccasion(document.getElementById("newOccasionName").value);
  });

  document.getElementById("volunteerForm").addEventListener("submit", (event) => {
    event.preventDefault();
    addVolunteer(document.getElementById("newVolunteerName").value);
  });

  document.querySelectorAll("[data-close]").forEach((button) => {
    button.addEventListener("click", () => closeModal(button.dataset.close));
  });

  document.getElementById("printBookingBtn").addEventListener("click", printBooking);
  document.getElementById("refreshBookingsBtn").addEventListener("click", loadBookings);

  document.querySelectorAll("#bookingForm input, #bookingForm select").forEach((field) => {
    field.addEventListener("input", () => clearFieldError(field.name || field.id));
    field.addEventListener("change", () => clearFieldError(field.name || field.id));
  });

  document.getElementById("filterDate").addEventListener("change", updateDashboard);
  document.getElementById("filterSession").addEventListener("change", updateDashboard);
  document.getElementById("filterStatus").addEventListener("change", updateDashboard);
  document.getElementById("searchBookings").addEventListener("input", updateDashboard);

}

function setDefaultDate() {
  document.getElementById("sponsorshipDate").value = formatDateForInput(new Date());
}

function setDefaultPaymentStatus() {
  const pending = document.querySelector('input[name="paymentStatus"][value="Pending"]');
  if (pending) pending.checked = true;
}

function loadCustomOccasions() {
  const stored = safeParse(localStorage.getItem(STORAGE_KEYS.occasions), []);
  renderSelectOptions(
    "occasion",
    [...new Set([...DEFAULT_OCCASIONS, ...stored])],
    "Select Occasion"
  );
}

function loadCustomVolunteers() {
  const stored = safeParse(localStorage.getItem(STORAGE_KEYS.volunteers), []);
  renderSelectOptions("volunteer", [...new Set(stored)], "Select Volunteer");
}

function renderSelectOptions(selectId, values, placeholderText) {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML =
    `<option value="">${escapeHtml(placeholderText)}</option>` +
    values
      .filter(Boolean)
      .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)
      .join("");
}

function addOccasion(nameValue) {
  const name = String(nameValue || "").trim();

  if (!name) {
    showFieldError("newOccasionName", "Occasion name is required.");
    return;
  }

  const store = safeParse(localStorage.getItem(STORAGE_KEYS.occasions), []);

  if (!store.some((item) => item.toLowerCase() === name.toLowerCase())) {
    store.push(name);
    localStorage.setItem(STORAGE_KEYS.occasions, JSON.stringify(store));
  }

  loadCustomOccasions();
  document.getElementById("occasion").value = name;
  closeModal("occasionModal");
}

function addVolunteer(nameValue) {
  const name = String(nameValue || "").trim();

  if (!name) {
    showFieldError("newVolunteerName", "Volunteer name is required.");
    return;
  }

  const store = safeParse(localStorage.getItem(STORAGE_KEYS.volunteers), []);

  if (!store.some((item) => item.toLowerCase() === name.toLowerCase())) {
    store.push(name);
    localStorage.setItem(STORAGE_KEYS.volunteers, JSON.stringify(store));
  }

  loadCustomVolunteers();
  document.getElementById("volunteer").value = name;
  closeModal("volunteerModal");
}

function openModal(id) {
  const modal = document.getElementById(id);
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");

  const inputId = id === "occasionModal" ? "newOccasionName" : "newVolunteerName";
  setTimeout(() => document.getElementById(inputId).focus(), 50);
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;

  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");

  const inputId = id === "occasionModal" ? "newOccasionName" : "newVolunteerName";
  const input = document.getElementById(inputId);

  if (input) {
    input.value = "";
    clearFieldError(inputId);
  }
}

async function handleBookingSubmit(event) {
  event.preventDefault();
  clearFormMessage();

  const validation = validateForm();

  if (!validation.isValid) {
    showMessage("Please complete all required fields.", "error");
    const firstError = Object.keys(validation.errors)[0];
    document.getElementById(firstError)?.focus();
    return;
  }

  if (
    !GOOGLE_APPS_SCRIPT_URL ||
    GOOGLE_APPS_SCRIPT_URL === "PASTE_YOUR_WEB_APP_URL_HERE"
  ) {
    showMessage(
      "Google Apps Script URL is not configured. Follow the connection steps and paste the /exec URL into script.js.",
      "error"
    );
    return;
  }

  const button = document.getElementById("saveBookingBtn");
  button.disabled = true;
  button.textContent = "Saving...";

  try {
    // No bookingId generated here — backend assigns 001, 002, 003...
    const payload = buildBookingPayload();

    /*
      text/plain is intentional.
      It avoids a browser CORS preflight request when calling Google Apps Script.
    */
    const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.message || "Google Apps Script could not save the booking.");
    }

    // Use the bookingId returned from the backend (001, 002, 003...)
    lastSavedBooking = { ...payload, bookingId: result.bookingId };

    allBookings = [
      lastSavedBooking,
      ...allBookings.filter((item) => item.bookingId !== lastSavedBooking.bookingId)
    ];

    localStorage.setItem(
      STORAGE_KEYS.localBookings,
      JSON.stringify(allBookings.slice(0, 100))
    );

    showMessage(
      `Booking saved successfully!<br>Booking ID: <strong>${escapeHtml(result.bookingId)}</strong>`,
      "success"
    );

    document.getElementById("printBookingBtn").classList.remove("hidden");
    updateDashboard();
    resetForm();
  } catch (error) {
    console.error(error);
    showMessage(
      error.message || "Unable to save booking. Please check your connection.",
      "error"
    );
  } finally {
    button.disabled = false;
    button.textContent = "Save Booking";
  }
}

function validateForm() {
  const form = document.getElementById("bookingForm");
  const errors = {};

  const sponsorName = form.sponsorName.value.trim();
  const sponsorFor = form.sponsorFor.value.trim();
  const phone = form.phone.value.trim();
  const occasion = form.occasion.value;
  const date = form.sponsorshipDate.value;
  const session = form.foodSession.value;
  const amount = Number(form.amount.value);
  const volunteer = form.volunteer.value;
  const paymentStatus =
    form.querySelector('input[name="paymentStatus"]:checked')?.value || "";

  if (!sponsorName) errors.sponsorName = "Sponsor name is required.";
  if (!sponsorFor) errors.sponsorFor = "Sponsor For is required.";
  if (!isValidIndianPhone(phone)) errors.phone = "Enter a valid Indian mobile number.";
  if (!occasion) errors.occasion = "Please select an occasion.";
  if (!date || !isValidDate(date)) errors.sponsorshipDate = "Select a valid date.";
  if (!session) errors.foodSession = "Select Breakfast, Lunch or Dinner.";
  if (!Number.isFinite(amount) || amount <= 0) errors.amount = "Enter an amount greater than zero.";
  if (!volunteer) errors.volunteer = "Please select a volunteer.";
  if (!paymentStatus) errors.paymentStatus = "Select Paid or Pending.";

  Object.entries(errors).forEach(([field, message]) => showFieldError(field, message));

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

// No bookingId parameter — backend assigns it
function buildBookingPayload() {
  const form = document.getElementById("bookingForm");

  return {
    entryDate: formatDateForSheet(new Date()),
    sponsorName: form.sponsorName.value.trim(),
    sponsorFor: form.sponsorFor.value.trim(),
    phone: form.phone.value.trim(),
    occasion: form.occasion.value,
    sponsorshipDate: formatDateForSheet(form.sponsorshipDate.value),
    foodSession: form.foodSession.value,
    amount: Number(form.amount.value),
    volunteer: form.volunteer.value,
    paymentStatus:
      form.querySelector('input[name="paymentStatus"]:checked')?.value || "Pending",
    notes: form.notes.value.trim(),
    createdAt: formatDateTime(new Date())
  };
}

async function loadBookings() {
  const local = safeParse(localStorage.getItem(STORAGE_KEYS.localBookings), []);
  allBookings = Array.isArray(local) ? local : [];
  updateDashboard();

  if (
    !GOOGLE_APPS_SCRIPT_URL ||
    GOOGLE_APPS_SCRIPT_URL === "PASTE_YOUR_WEB_APP_URL_HERE"
  ) {
    return;
  }

  try {
    const response = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?action=recent`);
    const result = await response.json();

    if (result.success && Array.isArray(result.data)) {
      allBookings = result.data;
      localStorage.setItem(
        STORAGE_KEYS.localBookings,
        JSON.stringify(allBookings.slice(0, 100))
      );
      updateDashboard();
      renderTodaysSponsor(getTodayIST()); // NEW: refresh banner with live data
    }
  } catch (error) {
    console.warn("Could not load Google Sheet bookings:", error);
  }
}

function updateDashboard() {
  const filtered = filterBookingsData().slice(0, 10);
  const body = document.getElementById("bookingsTableBody");

  if (!filtered.length) {
    body.innerHTML =
      '<tr><td colspan="9" class="empty-state">No bookings found.</td></tr>';
  } else {
    body.innerHTML = filtered
      .map(
        (booking) => `
          <tr>
            <td>${escapeHtml(booking.bookingId || "-")}</td>
            <td>${escapeHtml(booking.sponsorName || "-")}</td>
            <td>${escapeHtml(booking.sponsorFor || "-")}</td>
            <td>${escapeHtml(formatDateForDisplay(booking.sponsorshipDate))}</td>
            <td>${escapeHtml(booking.foodSession || "-")}</td>
            <td>${formatCurrency(booking.amount)}</td>
            <td>${escapeHtml(booking.volunteer || "-")}</td>
            <td>
              <span class="status-pill ${String(booking.paymentStatus || "Pending").toLowerCase()}">
                ${escapeHtml(booking.paymentStatus || "Pending")}
              </span>
            </td>
            <td>${escapeHtml(booking.notes || "-")}</td>
          </tr>
        `
      )
      .join("");
  }

  updateSummaryCards();
}

function filterBookingsData() {
  const date = document.getElementById("filterDate").value;
  const session = document.getElementById("filterSession").value;
  const status = document.getElementById("filterStatus").value;
  const search = document.getElementById("searchBookings").value.trim().toLowerCase();

  return [...allBookings]
    .filter((booking) => {
      if (date && normalizeDateForCompare(booking.sponsorshipDate) !== date) return false;
      if (session !== "All" && booking.foodSession !== session) return false;
      if (status !== "All" && (booking.paymentStatus || "Pending") !== status) return false;

      if (search) {
        const target = `${booking.sponsorName || ""} ${booking.phone || ""} ${booking.bookingId || ""} ${booking.notes || ""}`.toLowerCase();
        if (!target.includes(search)) return false;
      }

      return true;
    })
    .sort((a, b) => {
      const da = new Date(a.createdAt || a.sponsorshipDate || 0);
      const db = new Date(b.createdAt || b.sponsorshipDate || 0);
      return db - da;
    });
}

function updateSummaryCards() {
  const today = formatDateISO(new Date());

  const todayBookings = allBookings.filter(
    (booking) => normalizeDateForCompare(booking.sponsorshipDate) === today
  );

  const total = todayBookings.reduce(
    (sum, booking) => sum + (Number(booking.amount) || 0),
    0
  );

  const paid = todayBookings
    .filter((booking) => booking.paymentStatus === "Paid")
    .reduce((sum, booking) => sum + (Number(booking.amount) || 0), 0);

  const pending = todayBookings
    .filter((booking) => booking.paymentStatus === "Pending")
    .reduce((sum, booking) => sum + (Number(booking.amount) || 0), 0);

  document.getElementById("summaryTodayCount").textContent = todayBookings.length;
  document.getElementById("summaryTodayAmount").textContent = formatCurrency(total);
  document.getElementById("summaryPaidAmount").textContent = formatCurrency(paid);
  document.getElementById("summaryPendingAmount").textContent = formatCurrency(pending);
}

function resetForm() {
  document.getElementById("bookingForm").reset();
  setDefaultDate();
  setDefaultPaymentStatus();
  clearAllFieldErrors();
}

/* ─────────────────────────────────────────────────────────────────────
   TODAY'S SPONSOR BANNER
   ─ Retrieves today's sponsorship from the allBookings array (already
     loaded from Google Sheets by loadBookings).
   ─ Falls back gracefully when the sheet data isn't available yet.
   ─ Uses the same normalizeDateForCompare + formatDateISO helpers that
     updateSummaryCards() uses — no duplicate logic.
───────────────────────────────────────────────────────────────────── */
function loadTodaysSponsor() {
  // Use India timezone (Asia/Kolkata) for "today"
  const todayISO = getTodayIST();
  renderTodaysSponsor(todayISO);
}

/** Returns today's date as YYYY-MM-DD in Asia/Kolkata timezone. */
function getTodayIST() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  // en-CA locale produces YYYY-MM-DD format
}

/**
 * Scans allBookings for today's sponsorship and updates the banner.
 * Called after allBookings is populated / refreshed.
 */
function renderTodaysSponsor(todayISO) {
  const contentEl = document.getElementById("todaysSponsorContent");
  if (!contentEl) return;

  // Find ALL bookings for today
  const todayBookings = allBookings.filter(
    (b) => normalizeDateForCompare(b.sponsorshipDate) === todayISO
  );

  if (todayBookings.length === 0) {
    contentEl.innerHTML = `<span class="ts-no-sponsor">No sponsor booked for today</span>`;
    return;
  }

  // Sort by meal order: Breakfast → Lunch → Dinner
  const sessionOrder = { "Breakfast": 1, "Lunch": 2, "Dinner": 3 };
  todayBookings.sort(
    (a, b) => (sessionOrder[a.foodSession] || 99) - (sessionOrder[b.foodSession] || 99)
  );

  // Build a single flat ticker line: "Name — Occasion [BREAKFAST] &nbsp;|&nbsp; Name2 — Occasion2 [LUNCH]"
  const parts = todayBookings.map((b) => {
    const name     = escapeHtml(b.sponsorName || "—");
    const occasion = escapeHtml(b.occasion    || "—");
    const session  = escapeHtml(b.foodSession  || "");
    const pill     = session
      ? `<span class="ts-session ts-session--${session.toLowerCase()}">${session}</span>`
      : "";
    return `<strong>${name}</strong> &mdash; ${occasion} ${pill}`;
  });

  contentEl.innerHTML = parts.join("&nbsp;&nbsp;&bull;&nbsp;&nbsp;");
}

/* ─────────────────────────────────────────────────────────────────────
   PRINT LAST BOOKING — improved PDF layout
   ─ Keeps ALL existing booking fields.
   ─ Adds: logo (top-left), contact info (top-right), watermark,
     Secretary signature (bottom-left).
   ─ Logo path reuses the same "Sarvam Logo.png" already in the project.
───────────────────────────────────────────────────────────────────── */
function printBooking() {
  if (!lastSavedBooking) {
    showMessage("No saved booking available to print.", "error");
    return;
  }

  const b = lastSavedBooking;

  // Convert both images to base64 so they work in the about:blank print window
  Promise.all([
    fetchImageAsBase64("Sarvam Logo.png"),
    fetchImageAsBase64("Logo.png")
  ])
    .then(([headerB64, wmB64]) => openPrintWindow(b, headerB64, wmB64))
    .catch(() =>
      fetchImageAsBase64("Sarvam Logo.png")
        .then(headerB64 => openPrintWindow(b, headerB64, ""))
        .catch(() => openPrintWindow(b, "", ""))
    );
}

/** Reads a same-origin image file and resolves with a base64 data-URL. */
function fetchImageAsBase64(filename) {
  return fetch(new URL(filename, window.location.href).href)
    .then(r => { if (!r.ok) throw new Error("fetch failed"); return r.blob(); })
    .then(blob => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    }));
}

function openPrintWindow(b, headerLogoB64, watermarkB64) {
  const printWindow = window.open("", "_blank");

  const headerLogoHTML = headerLogoB64
    ? `<img class="doc-logo" src="${headerLogoB64}" alt="Sarvam Anna Chathiram logo">`
    : "";

  // Watermark: fixed <img> behind all content, full A4 page coverage.
  // All content backgrounds are transparent so watermark shows through everywhere.
  const watermarkHTML = watermarkB64 ? `
  <img
    src="${watermarkB64}"
    aria-hidden="true"
    style="
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      object-fit: contain;
      object-position: center center;
      opacity: 0.08;
      pointer-events: none;
      z-index: 0;
      display: block;
    "
    alt=""
  >` : "";

  printWindow.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(b.bookingId)} – Sarvam Annachathiram</title>
  <style>
    @page { size: A4 portrait; margin: 18mm 14mm 18mm 14mm; }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: Arial, "Noto Sans Tamil", sans-serif;
      color: #1a3520;
      position: relative;
      min-height: 100vh;
    }

    /* z-index layering: watermark=0, page-content=1 so content always on top */
    .page-content { position: relative; z-index: 1; }

    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

    .doc-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      padding-bottom: 14px;
      border-bottom: 3px solid #2e7d32;
      margin-bottom: 20px;
      background: transparent;
    }

    .doc-logo { height: 90px; width: auto; object-fit: contain; flex-shrink: 0; }

    .doc-contact { text-align: right; flex: 1; min-width: 0; }
    .doc-contact .phones { font-size: 1.05rem; font-weight: 700; color: #1b5e20; white-space: nowrap; }
    .doc-contact .email  { font-size: 0.82rem; color: #2e7d32; margin-top: 4px; }
    .doc-contact .address { font-size: 0.75rem; color: #4a6b50; margin-top: 5px; line-height: 1.4; }

    .doc-title-block { text-align: center; margin-bottom: 22px; background: transparent; }
    .doc-title-block h1 { font-size: 1.4rem; color: #1b5e20; letter-spacing: 0.04em; margin-bottom: 4px; }
    .doc-title-block .doc-subtitle { font-size: 0.85rem; color: #5a7560; }

    .booking-id-badge {
      display: inline-block; margin-top: 8px;
      background: rgba(232,245,233,0.7); border: 1px solid #a5d6a7; border-radius: 6px;
      padding: 4px 14px; font-weight: 700; font-size: 0.88rem;
      color: #1b5e20; letter-spacing: 0.05em;
    }

    .booking-table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }

    .booking-table td {
      padding: 9px 12px;
      border: 1px solid #c8e6c9;
      font-size: 0.88rem;
      vertical-align: top;
      background: transparent;
    }

    /* Use semi-transparent tints so watermark bleeds through */
    .booking-table tr:nth-child(even) td { background: rgba(244,251,245,0.55); }

    .booking-table td.field-label {
      width: 38%; font-weight: 700; color: #215028;
      background: rgba(232,245,233,0.60);
    }

    .status-paid    { color: #1b5e20; font-weight: 700; }
    .status-pending { color: #e65100; font-weight: 700; }

    .thank-you {
      text-align: center; margin-top: 10px; margin-bottom: 30px;
      font-size: 0.82rem; color: #4a6b50; font-style: italic;
      background: transparent; padding: 6px 0;
    }

    .signature-block { padding-top: 14px; border-top: 1px solid #c8e6c9; background: transparent; }
    .signature-block .sig-name { font-weight: 700; font-size: 0.92rem; color: #1a3520; }
    .signature-block .sig-title { font-size: 0.82rem; color: #5a7560; margin-top: 2px; }
  </style>
</head>
<body>
  ${watermarkHTML}

  <div class="page-content">

    <div class="doc-header">
      ${headerLogoHTML}
      <div class="doc-contact">
        <div class="phones">95002 18240 &nbsp;|&nbsp; 63846 08158</div>
        <div class="email">sarvamtrustindia@gmail.com</div>
        <div class="address">
          No.379, Manthoppu Street, Hasanamapet Post,<br>
          Vembakkam Tk., Thiruvannamalai Dt., Pincode – 604 402
        </div>
      </div>
    </div>

    <div class="doc-title-block">
      <h1>Sarvam Annachathiram</h1>
      <br>
      <br>
      <div class="doc-subtitle">Food Sponsorship Booking Confirmation</div>
      <div class="booking-id-badge">Booking ID: ${escapeHtml(b.bookingId)}</div>
    </div>

    <table class="booking-table">
      <tr><td class="field-label">Sponsor Name</td><td>${escapeHtml(b.sponsorName)}</td></tr>
      <tr><td class="field-label">Sponsor For</td><td>${escapeHtml(b.sponsorFor)}</td></tr>
      <tr><td class="field-label">Phone Number</td><td>${escapeHtml(b.phone)}</td></tr>
      <tr><td class="field-label">Occasion</td><td>${escapeHtml(b.occasion)}</td></tr>
      <tr><td class="field-label">Sponsorship Date</td><td>${escapeHtml(formatDateForDisplay(b.sponsorshipDate))}</td></tr>
      <tr><td class="field-label">Food Session</td><td>${escapeHtml(b.foodSession)}</td></tr>
      <tr><td class="field-label">Sponsorship Amount</td><td>${formatCurrency(b.amount)}</td></tr>
      <tr><td class="field-label">Volunteer</td><td>${escapeHtml(b.volunteer)}</td></tr>
      <tr>
        <td class="field-label">Payment Status</td>
        <td><span class="${b.paymentStatus === "Paid" ? "status-paid" : "status-pending"}">${escapeHtml(b.paymentStatus)}</span></td>
      </tr>
      <tr><td class="field-label">Notes</td><td>${escapeHtml(b.notes || "—")}</td></tr>
    </table>

    <div class="thank-you">Thank you for your generous support of Sarvam Annachathiram. 🙏</div>

     <div class="signature-block">
      <div class="sig-name">For, <br>Sarvam Trust</div>
  <div class="sig-title" style="margin-top: 100px; font-size: 0.78rem; color: #5a7560; font-style: italic; border-top: 1px dashed #c8e6c9; padding-top: 8px;">
    ✦ Note: This is a system-generated document. No manual signature is required.
    </div>
  </div>

  </div>
  <script>window.addEventListener("load", function(){ window.print(); });<\/script>
</body>
</html>`);

  printWindow.document.close();
  printWindow.focus();
}

function showMessage(message, type) {
  const box = document.getElementById("formMessage");
  box.className = `message ${type}`;
  box.innerHTML = message;
}

function clearFormMessage() {
  const box = document.getElementById("formMessage");
  box.className = "message hidden";
  box.textContent = "";
}

function showFieldError(field, message) {
  const el = document.querySelector(`[data-error-for="${field}"]`);
  if (el) el.textContent = message;
}

function clearFieldError(field) {
  const el = document.querySelector(`[data-error-for="${field}"]`);
  if (el) el.textContent = "";
}

function clearAllFieldErrors() {
  document.querySelectorAll(".field-error").forEach((el) => (el.textContent = ""));
}

function isValidIndianPhone(value) {
  const clean = value.replace(/\s+/g, "").trim();
  return /^(\+91|91)?[6-9]\d{9}$/.test(clean);
}

function isValidDate(value) {
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime());
}

function safeParse(value, fallback) {
  try {
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function formatDateISO(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateForInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateForSheet(value) {
  if (!value) return "";

  if (value instanceof Date) {
    const day = String(value.getDate()).padStart(2, "0");
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const year = value.getFullYear();
    return `${day}-${month}-${year}`;
  }

  const text = String(value).trim();
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return `${isoMatch[3]}-${isoMatch[2]}-${isoMatch[1]}`;
  }

  const slashMatch = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slashMatch) {
    return `${slashMatch[1]}-${slashMatch[2]}-${slashMatch[3]}`;
  }

  const dashMatch = text.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dashMatch) {
    return `${dashMatch[1]}-${dashMatch[2]}-${dashMatch[3]}`;
  }

  return text;
}

function formatDateForDisplay(value) {
  if (!value) return "-";
  const text = String(value).trim();

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return `${isoMatch[3]}-${isoMatch[2]}-${isoMatch[1]}`;
  }

  const dashMatch = text.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dashMatch) {
    return `${dashMatch[1]}-${dashMatch[2]}-${dashMatch[3]}`;
  }

  const slashMatch = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slashMatch) {
    return `${slashMatch[1]}-${slashMatch[2]}-${slashMatch[3]}`;
  }

  return text;
}

function normalizeDateForCompare(value) {
  if (!value) return "";

  const text = String(value).trim();
  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return text;

  const dashMatch = text.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dashMatch) {
    return `${dashMatch[3]}-${dashMatch[2]}-${dashMatch[1]}`;
  }

  const slashMatch = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slashMatch) {
    return `${slashMatch[3]}-${slashMatch[2]}-${slashMatch[1]}`;
  }

  return text;
}

function formatDateTime(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}