/*
  SARVAM ANNA CHATHRAM
  Frontend JavaScript
*/
const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzWVSIXFFCaDcHjNqaWNaeHSIahjJf699hK_Zbfrb6oClCvtrH4O5g2oa5D7VFWejpRmg/exec";

const STORAGE_KEYS = {
  occasions:     "sarvamCustomOccasions",
  volunteers:    "sarvamCustomVolunteers",
  localBookings: "sarvamLocalBookings"
};

const DEFAULT_OCCASIONS = [
  "Birthday",
  "Wedding Day",
  "Memorial Day",
  "Anniversary",
  "Other"
];

let allBookings     = [];
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

  document.getElementById("openOccasionModalBtn").addEventListener("click", () => openModal("occasionModal"));
  document.getElementById("openVolunteerModalBtn").addEventListener("click", () => openModal("volunteerModal"));

  document.getElementById("occasionForm").addEventListener("submit", (e) => {
    e.preventDefault();
    addOccasion(document.getElementById("newOccasionName").value);
  });
  document.getElementById("volunteerForm").addEventListener("submit", (e) => {
    e.preventDefault();
    addVolunteer(document.getElementById("newVolunteerName").value);
  });

  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", () => closeModal(btn.dataset.close));
  });

  document.getElementById("printBookingBtn").addEventListener("click", printBooking);
  document.getElementById("refreshBookingsBtn").addEventListener("click", loadBookings);
  document.getElementById("bookingsTableBody").addEventListener("click", handleReceiptAction);

  document.querySelectorAll("#bookingForm input, #bookingForm select, #bookingForm textarea").forEach((field) => {
    field.addEventListener("input",  () => clearFieldError(field.name || field.id));
    field.addEventListener("change", () => clearFieldError(field.name || field.id));
  });

  document.getElementById("filterDate").addEventListener("change",    updateDashboard);
  document.getElementById("filterSession").addEventListener("change", updateDashboard);
  document.getElementById("filterStatus").addEventListener("change",  updateDashboard);
  document.getElementById("searchBookings").addEventListener("input", updateDashboard);
}

function setDefaultDate() {
  document.getElementById("sponsorshipDate").value = formatDateForInput(new Date());
}

function setDefaultPaymentStatus() {
  const pending = document.querySelector('input[name="paymentStatus"][value="Pending"]');
  if (pending) pending.checked = true;
}

// ─── Occasions ───────────────────────────────────────────────────────────────

function loadCustomOccasions() {
  const stored = safeParse(localStorage.getItem(STORAGE_KEYS.occasions), []);
  renderSelectOptions("occasion", [...new Set([...DEFAULT_OCCASIONS, ...stored])], "Select Occasion");
}

function addOccasion(nameValue) {
  const name = String(nameValue || "").trim();
  if (!name) { showFieldError("newOccasionName", "Occasion name is required."); return; }
  const store = safeParse(localStorage.getItem(STORAGE_KEYS.occasions), []);
  if (!store.some((i) => i.toLowerCase() === name.toLowerCase())) {
    store.push(name);
    localStorage.setItem(STORAGE_KEYS.occasions, JSON.stringify(store));
  }
  loadCustomOccasions();
  document.getElementById("occasion").value = name;
  closeModal("occasionModal");
}

// ─── Volunteers ───────────────────────────────────────────────────────────────

function loadCustomVolunteers() {
  const stored = safeParse(localStorage.getItem(STORAGE_KEYS.volunteers), []);
  renderSelectOptions("volunteer", [...new Set(stored)], "Select Volunteer");
}

function addVolunteer(nameValue) {
  const name = String(nameValue || "").trim();
  if (!name) { showFieldError("newVolunteerName", "Volunteer name is required."); return; }
  const store = safeParse(localStorage.getItem(STORAGE_KEYS.volunteers), []);
  if (!store.some((i) => i.toLowerCase() === name.toLowerCase())) {
    store.push(name);
    localStorage.setItem(STORAGE_KEYS.volunteers, JSON.stringify(store));
  }
  loadCustomVolunteers();
  document.getElementById("volunteer").value = name;
  closeModal("volunteerModal");
}

// ─── Select helpers ───────────────────────────────────────────────────────────

function renderSelectOptions(selectId, values, placeholderText) {
  const select = document.getElementById(selectId);
  if (!select) return;
  select.innerHTML =
    `<option value="">${escapeHtml(placeholderText)}</option>` +
    values.filter(Boolean).map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");
}

// ─── Modal ────────────────────────────────────────────────────────────────────

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
  if (input) { input.value = ""; clearFieldError(inputId); }
}

// ─── Form submit ──────────────────────────────────────────────────────────────

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

  if (!GOOGLE_APPS_SCRIPT_URL || GOOGLE_APPS_SCRIPT_URL === "PASTE_YOUR_WEB_APP_URL_HERE") {
    showMessage("Google Apps Script URL is not configured.", "error");
    return;
  }

  const button = document.getElementById("saveBookingBtn");
  button.disabled    = true;
  button.textContent = "Saving...";

  try {
    const payload  = buildBookingPayload();
    const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
      method:  "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body:    JSON.stringify(payload)
    });
    const result = await response.json();
    if (!result.success) throw new Error(result.message || "Could not save booking.");

    lastSavedBooking = { ...payload, bookingId: result.bookingId };
    allBookings = [
      lastSavedBooking,
      ...allBookings.filter((b) => b.bookingId !== lastSavedBooking.bookingId)
    ];
    localStorage.setItem(STORAGE_KEYS.localBookings, JSON.stringify(allBookings.slice(0, 100)));

    showMessage(
      `Booking saved successfully!<br>Booking ID: <strong>${escapeHtml(result.bookingId)}</strong>`,
      "success"
    );
    document.getElementById("printBookingBtn").classList.remove("hidden");
    updateDashboard();
    resetForm();
  } catch (error) {
    console.error(error);
    showMessage(error.message || "Unable to save booking. Please check your connection.", "error");
  } finally {
    button.disabled    = false;
    button.textContent = "Save Booking";
  }
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateForm() {
  const form   = document.getElementById("bookingForm");
  const errors = {};

  const sponsorName   = form.sponsorName.value.trim();
  const sponsorFor    = form.sponsorFor.value.trim();
  const phone         = form.phone.value.trim();
  const occasion      = form.occasion.value;
  const date          = form.sponsorshipDate.value;
  const session       = form.foodSession.value;
  const amount        = Number(form.amount.value);
  const volunteer     = form.volunteer.value;
  const paymentStatus = form.querySelector('input[name="paymentStatus"]:checked')?.value || "";

  if (!sponsorName)                                  errors.sponsorName      = "Sponsor name is required.";
  if (!sponsorFor)                                   errors.sponsorFor       = "Sponsor For is required.";
  if (!isValidIndianPhone(phone))                    errors.phone            = "Enter a valid Indian mobile number.";
  if (!occasion)                                     errors.occasion         = "Please select an occasion.";
  if (!date || !isValidDate(date))                   errors.sponsorshipDate  = "Select a valid date.";
  if (!session)                                      errors.foodSession      = "Select a food session.";
  if (!Number.isFinite(amount) || amount <= 0)       errors.amount           = "Enter an amount greater than zero.";
  if (!volunteer)                                    errors.volunteer        = "Please select a volunteer.";
  if (!paymentStatus)                                errors.paymentStatus    = "Select Paid or Pending.";

  Object.entries(errors).forEach(([field, msg]) => showFieldError(field, msg));
  return { isValid: Object.keys(errors).length === 0, errors };
}

// ─── Payload ──────────────────────────────────────────────────────────────────

function buildBookingPayload() {
  const form = document.getElementById("bookingForm");
  return {
    entryDate:       formatDateForSheet(new Date()),
    sponsorName:     form.sponsorName.value.trim(),
    sponsorFor:      form.sponsorFor.value.trim(),
    phone:           form.phone.value.trim(),
    occasion:        form.occasion.value,
    sponsorshipDate: formatDateForSheet(form.sponsorshipDate.value),
    foodSession:     form.foodSession.value,
    amount:          Number(form.amount.value),
    place:           form.place.value.trim(),          // ← NEW
    volunteer:       form.volunteer.value,
    paymentStatus:   form.querySelector('input[name="paymentStatus"]:checked')?.value || "Pending",
    notes:           form.notes.value.trim(),
    createdAt:       formatDateTime(new Date())
  };
}

// ─── Load bookings ────────────────────────────────────────────────────────────

async function loadBookings() {
  const local = safeParse(localStorage.getItem(STORAGE_KEYS.localBookings), []);
  allBookings = Array.isArray(local) ? local : [];
  updateDashboard();

  if (!GOOGLE_APPS_SCRIPT_URL || GOOGLE_APPS_SCRIPT_URL === "PASTE_YOUR_WEB_APP_URL_HERE") return;

  try {
    const response = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?action=recent`);
    const result   = await response.json();
    if (result.success && Array.isArray(result.data)) {
      allBookings = result.data;
      localStorage.setItem(STORAGE_KEYS.localBookings, JSON.stringify(allBookings.slice(0, 100)));
      updateDashboard();
      renderTodaysSponsor(getTodayIST());
    }
  } catch (error) {
    console.warn("Could not load Google Sheet bookings:", error);
  }
}

// ─── Dashboard / table ────────────────────────────────────────────────────────

function updateDashboard() {
  const filtered = filterBookingsData().slice(0, 10);
  const body     = document.getElementById("bookingsTableBody");

  if (!filtered.length) {
    body.innerHTML = '<tr><td colspan="11" class="empty-state">No bookings found.</td></tr>';
  } else {
    body.innerHTML = filtered.map((b) => `
      <tr>
        <td>${escapeHtml(b.bookingId    || "-")}</td>
        <td>${escapeHtml(b.sponsorName  || "-")}</td>
        <td>${escapeHtml(b.sponsorFor   || "-")}</td>
        <td>${escapeHtml(formatDateForDisplay(b.sponsorshipDate))}</td>
        <td>${escapeHtml(b.foodSession  || "-")}</td>
        <td>${formatCurrency(b.amount)}</td>
        <td>${escapeHtml(b.place        || "-")}</td>
        <td>${escapeHtml(b.volunteer    || "-")}</td>
        <td>
          <span class="status-pill ${String(b.paymentStatus || "Pending").toLowerCase()}">
            ${escapeHtml(b.paymentStatus || "Pending")}
          </span>
        </td>
        <td>${escapeHtml(b.notes || "-")}</td>
        <td class="booking-action-cell">
          <button
            type="button"
            class="receipt-btn"
            data-booking-id="${escapeHtml(b.bookingId || "")}"
            title="Generate receipt"
          >Download Receipt</button>
        </td>
      </tr>
    `).join("");
  }

  updateSummaryCards();
}

function filterBookingsData() {
  const date    = document.getElementById("filterDate").value;
  const session = document.getElementById("filterSession").value;
  const status  = document.getElementById("filterStatus").value;
  const search  = document.getElementById("searchBookings").value.trim().toLowerCase();

  return [...allBookings]
    .filter((b) => {
      if (date    && normalizeDateForCompare(b.sponsorshipDate) !== date) return false;
      if (session !== "All" && b.foodSession   !== session) return false;
      if (status  !== "All" && (b.paymentStatus || "Pending") !== status) return false;
      if (search) {
        const target = `${b.sponsorName || ""} ${b.phone || ""} ${b.bookingId || ""} ${b.notes || ""} ${b.place || ""}`.toLowerCase();
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
    (b) => normalizeDateForCompare(b.sponsorshipDate) === today
  );
  const total   = todayBookings.reduce((s, b) => s + (Number(b.amount) || 0), 0);
  const paid    = todayBookings.filter((b) => b.paymentStatus === "Paid").reduce((s, b) => s + (Number(b.amount) || 0), 0);
  const pending = todayBookings.filter((b) => b.paymentStatus === "Pending").reduce((s, b) => s + (Number(b.amount) || 0), 0);

  document.getElementById("summaryTodayCount").textContent  = todayBookings.length;
  document.getElementById("summaryTodayAmount").textContent = formatCurrency(total);
  document.getElementById("summaryPaidAmount").textContent  = formatCurrency(paid);
  document.getElementById("summaryPendingAmount").textContent = formatCurrency(pending);
}

function resetForm() {
  document.getElementById("bookingForm").reset();
  setDefaultDate();
  setDefaultPaymentStatus();
  clearAllFieldErrors();
}

// ─── Today's sponsor ticker ───────────────────────────────────────────────────

function loadTodaysSponsor() {
  renderTodaysSponsor(getTodayIST());
}

function getTodayIST() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

function renderTodaysSponsor(todayISO) {
  const contentEl = document.getElementById("todaysSponsorContent");
  if (!contentEl) return;

  const todayBookings = allBookings.filter(
    (b) => normalizeDateForCompare(b.sponsorshipDate) === todayISO
  );

  if (todayBookings.length === 0) {
    contentEl.innerHTML = `<span class="ts-no-sponsor">No sponsor booked for today</span>`;
    return;
  }

  const sessionOrder = { Breakfast: 1, Lunch: 2, Dinner: 3, Twice: 4, "Whole Day": 5 };
  todayBookings.sort((a, b) => (sessionOrder[a.foodSession] || 99) - (sessionOrder[b.foodSession] || 99));

  const parts = todayBookings.map((b) => {
    const name    = escapeHtml(b.sponsorName || "—");
    const occasion = escapeHtml(b.occasion   || "—");
    const session  = escapeHtml(b.foodSession || "");
    const pill     = session
      ? `<span class="ts-session ts-session--${session.toLowerCase()}">${session}</span>`
      : "";
    return `<strong>${name}</strong> &mdash; ${occasion} ${pill}`;
  });

  contentEl.innerHTML = parts.join("&nbsp;&nbsp;&bull;&nbsp;&nbsp;");
}

// ─── Receipt ──────────────────────────────────────────────────────────────────

function handleReceiptAction(event) {
  const button = event.target.closest(".receipt-btn");
  if (!button) return;
  const bookingId = button.dataset.bookingId;
  if (!bookingId) { showMessage("Booking ID is missing.", "error"); return; }
  const booking = allBookings.find((b) => String(b.bookingId) === String(bookingId));
  if (!booking) { showMessage("Booking not found. Please refresh.", "error"); return; }
  generateReceiptForBooking(booking);
}

function generateReceiptForBooking(booking) {
  Promise.all([fetchImageAsBase64("Sarvam Logo.png"), fetchImageAsBase64("Logo.png")])
    .then(([h, w]) => openPrintWindow(booking, h, w))
    .catch(() =>
      fetchImageAsBase64("Sarvam Logo.png")
        .then((h) => openPrintWindow(booking, h, ""))
        .catch(() => openPrintWindow(booking, "", ""))
    );
}

function printBooking() {
  if (!lastSavedBooking) { showMessage("No saved booking to print.", "error"); return; }
  Promise.all([fetchImageAsBase64("Sarvam Logo.png"), fetchImageAsBase64("Logo.png")])
    .then(([h, w]) => openPrintWindow(lastSavedBooking, h, w))
    .catch(() =>
      fetchImageAsBase64("Sarvam Logo.png")
        .then((h) => openPrintWindow(lastSavedBooking, h, ""))
        .catch(() => openPrintWindow(lastSavedBooking, "", ""))
    );
}

function fetchImageAsBase64(filename) {
  return fetch(new URL(filename, window.location.href).href)
    .then((r) => { if (!r.ok) throw new Error("fetch failed"); return r.blob(); })
    .then((blob) => new Promise((resolve, reject) => {
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

  const watermarkHTML = watermarkB64 ? `
  <img src="${watermarkB64}" aria-hidden="true" style="
    position:fixed;top:0;left:0;width:100vw;height:100vh;
    object-fit:contain;object-position:center;
    opacity:0.08;pointer-events:none;z-index:0;display:block;">` : "";

  printWindow.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(b.bookingId)} – Sarvam Annachathiram</title>
  <style>
    @page { size:A4 portrait; margin:18mm 14mm; }
    *     { box-sizing:border-box; margin:0; padding:0; }
    body  { font-family:Arial,"Noto Sans Tamil",sans-serif; color:#1a3520; position:relative; min-height:100vh; }
    .page-content { position:relative; z-index:1; }
    body  { -webkit-print-color-adjust:exact; print-color-adjust:exact; }

    .doc-header { display:flex; justify-content:space-between; align-items:flex-start; gap:16px;
                  padding-bottom:14px; border-bottom:3px solid #2e7d32; margin-bottom:20px; }
    .doc-logo   { height:90px; width:auto; object-fit:contain; flex-shrink:0; }
    .doc-contact { text-align:right; flex:1; }
    .doc-contact .phones  { font-size:1.05rem; font-weight:700; color:#1b5e20; white-space:nowrap; }
    .doc-contact .email   { font-size:0.82rem; color:#2e7d32; margin-top:4px; }
    .doc-contact .address { font-size:0.75rem; color:#4a6b50; margin-top:5px; line-height:1.4; }

    .doc-title-block         { text-align:center; margin-bottom:22px; }
    .doc-title-block h1      { font-size:1.4rem; color:#1b5e20; letter-spacing:.04em; margin-bottom:4px; }
    .doc-title-block .doc-subtitle { font-size:.85rem; color:#5a7560; }
    .booking-id-badge { display:inline-block; margin-top:8px; background:rgba(232,245,233,.7);
                        border:1px solid #a5d6a7; border-radius:6px; padding:4px 14px;
                        font-weight:700; font-size:.88rem; color:#1b5e20; letter-spacing:.05em; }

    .booking-table              { width:100%; border-collapse:collapse; margin-bottom:24px; }
    .booking-table td           { padding:9px 12px; border:1px solid #c8e6c9; font-size:.88rem; vertical-align:top; }
    .booking-table tr:nth-child(even) td { background:rgba(244,251,245,.55); }
    .booking-table td.field-label { width:38%; font-weight:700; color:#215028; background:rgba(232,245,233,.6); }

    .status-paid    { color:#1b5e20; font-weight:700; }
    .status-pending { color:#e65100; font-weight:700; }

    .tax-exemption { text-align:center; font-size:0.8rem; color:#2e7d32; font-style:italic; margin-top:8px; }
    .thank-you     { text-align:center; margin:10px 0 30px; font-size:.82rem; color:#4a6b50; font-style:italic; }
    .signature-block { padding-top:14px; border-top:1px solid #c8e6c9; }
    .signature-block .sig-name  { font-weight:700; font-size:.92rem; color:#1a3520; }
    .signature-block .sig-title { font-size:.82rem; color:#5a7560; margin-top:2px; }
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
      <br><br>
      <div class="doc-subtitle">Food Sponsorship Booking Confirmation</div>
      <div class="booking-id-badge">Booking ID: ${escapeHtml(b.bookingId)}</div>
    </div>

    <table class="booking-table">
      <tr><td class="field-label">Sponsor Name</td>     <td>${escapeHtml(b.sponsorName)}</td></tr>
      <tr><td class="field-label">Sponsor For</td>      <td>${escapeHtml(b.sponsorFor)}</td></tr>
      <tr><td class="field-label">Phone Number</td>     <td>${escapeHtml(b.phone)}</td></tr>
      <tr><td class="field-label">Occasion</td>         <td>${escapeHtml(b.occasion)}</td></tr>
      <tr><td class="field-label">Sponsorship Date</td> <td>${escapeHtml(formatDateForDisplay(b.sponsorshipDate))}</td></tr>
      <tr><td class="field-label">Food Session</td>     <td>${escapeHtml(b.foodSession)}</td></tr>
      <tr><td class="field-label">Sponsorship Amount</td><td>${formatCurrency(b.amount)}</td></tr>
      <tr><td class="field-label">Place</td>            <td>${escapeHtml(b.place || "—")}</td></tr>
      <tr><td class="field-label">Volunteer</td>        <td>${escapeHtml(b.volunteer)}</td></tr>
      <tr>
        <td class="field-label">Payment Status</td>
        <td><span class="${b.paymentStatus === "Paid" ? "status-paid" : "status-pending"}">${escapeHtml(b.paymentStatus)}</span></td>
      </tr>
      <tr><td class="field-label">Notes</td>            <td>${escapeHtml(b.notes || "—")}</td></tr>
    </table>

    <div class="tax-exemption">80g - Tax Exemption is Available for your Donations</div>
    <br>
    <div class="thank-you">Thank you for your generous support of Sarvam Annachathiram. 🙏</div>

    <div class="signature-block">
      <div class="sig-name">For, <br>Sarvam Trust</div>
      <div class="sig-title" style="margin-top:100px;font-size:.78rem;color:#5a7560;font-style:italic;border-top:1px dashed #c8e6c9;padding-top:8px;">
        ✦ Note: This is a system-generated document. No manual signature is required.
      </div>
    </div>
  </div>
  <script>window.addEventListener("load",function(){ window.print(); });<\/script>
</body>
</html>`);

  printWindow.document.close();
  printWindow.focus();
}

// ─── Message helpers ──────────────────────────────────────────────────────────

function showMessage(message, type) {
  const box = document.getElementById("formMessage");
  box.className = `message ${type}`;
  box.innerHTML = message;
}

function clearFormMessage() {
  const box = document.getElementById("formMessage");
  box.className   = "message hidden";
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

// ─── Validation helpers ───────────────────────────────────────────────────────

function isValidIndianPhone(value) {
  const clean = value.replace(/\s+/g, "").trim();
  return /^(\+91|91)?[6-9]\d{9}$/.test(clean);
}

function isValidDate(value) {
  return !Number.isNaN(new Date(`${value}T00:00:00`).getTime());
}

function safeParse(value, fallback) {
  try { const p = JSON.parse(value); return p ?? fallback; } catch { return fallback; }
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function formatDateISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateForInput(date) {
  return formatDateISO(date);
}

// Frontend always sends DD-MM-YYYY to the backend
function formatDateForSheet(value) {
  if (!value) return "";
  if (value instanceof Date) {
    const d = String(value.getDate()).padStart(2, "0");
    const m = String(value.getMonth() + 1).padStart(2, "0");
    return `${d}-${m}-${value.getFullYear()}`;
  }
  const text = String(value).trim();
  const iso  = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso)   return `${iso[3]}-${iso[2]}-${iso[1]}`;
  const sl   = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (sl)    return `${sl[1]}-${sl[2]}-${sl[3]}`;
  const da   = text.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (da)    return text;
  return text;
}

function formatDateForDisplay(value) {
  if (!value) return "-";
  const text = String(value).trim();
  const iso  = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso)   return `${iso[3]}-${iso[2]}-${iso[1]}`;
  const da   = text.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (da)    return text;
  const sl   = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (sl)    return `${sl[1]}-${sl[2]}-${sl[3]}`;
  return text;
}

function normalizeDateForCompare(value) {
  if (!value) return "";
  const text = String(value).trim();
  const iso  = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso)   return text;
  const da   = text.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (da)    return `${da[3]}-${da[2]}-${da[1]}`;
  const sl   = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (sl)    return `${sl[3]}-${sl[2]}-${sl[1]}`;
  return text;
}

function formatDateTime(date) {
  const p = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth()+1)}-${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0
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