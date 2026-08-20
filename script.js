/*
  SARVAM ANNA CHATHRAM
  Frontend JavaScript
*/

const GOOGLE_APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzDwn0FkCSV6algoQX3ICt4P4TMZ43O954mabxa9t743HXRS4JHEoyQFxiawMyDpoVrjw/exec";

const STORAGE_KEYS = {
  occasions:     "sarvamCustomOccasions",
  volunteers:    "sarvamCustomVolunteers",
  localBookings: "sarvamLocalBookings",
  localUsers:    "sarvamRegisteredUsers",
  authToken:     "sarvamAuthToken",
  userRole:      "sarvamUserRole",
  userEmail:     "sarvamUserEmail",
  userName:      "sarvamUserName",
  rememberMe:    "sarvamRememberMe"
};

const DEFAULT_OCCASIONS = [
  "Birthday",
  "Memorial Day",
  "Anniversary",
  "Other"
];

const DEFAULT_VOLUNTEERS = [
  "Panner Selvan"
];

let allBookings      = [];
let lastSavedBooking = null;
let currentAuth = {
  token: "",
  role: "",
  email: "",
  name: ""
};

// ─────────────────────────────────────────────
// INITIALIZATION
// ─────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", initApp);

function initApp() {
  bindEvents();
  loadSavedSession();

  if (isAuthenticated()) {
    showAppView();
    initializeAppData();
  } else {
    showLoginView();
  }
}

function loadSavedSession() {
  const remember = localStorage.getItem(STORAGE_KEYS.rememberMe) === "true";
  const storage = remember ? localStorage : sessionStorage;

  currentAuth = {
    token: storage.getItem(STORAGE_KEYS.authToken) || "",
    role:  storage.getItem(STORAGE_KEYS.userRole)  || "",
    email: storage.getItem(STORAGE_KEYS.userEmail) || "",
    name:  storage.getItem(STORAGE_KEYS.userName)  || ""
  };
}

function isAuthenticated() {
  return Boolean(currentAuth.token || currentAuth.role);
}

function initializeAppData() {
  loadCustomOccasions();
  loadCustomVolunteers();
  setDefaultDate();
  setDefaultPaymentStatus();
  loadBookings();
  loadTodaysSponsor();
}

// ─────────────────────────────────────────────
// EVENT BINDINGS
// ─────────────────────────────────────────────

function bindEvents() {
  // Navigation Tabs & Switching
  document.getElementById("tabSignInBtn")?.addEventListener("click", () => switchAuthTab("signin"));
  document.getElementById("tabSignUpBtn")?.addEventListener("click", () => switchAuthTab("signup"));
  document.getElementById("linkToSignup")?.addEventListener("click", () => switchAuthTab("signup"));
  document.getElementById("linkToSignin")?.addEventListener("click", () => switchAuthTab("signin"));

  // Password Visibility Toggles
  document.getElementById("toggleLoginPwd")?.addEventListener("click", () => {
    togglePasswordVisibility("loginPassword", "toggleLoginPwd");
  });
  document.getElementById("toggleSignupPwd")?.addEventListener("click", () => {
    togglePasswordVisibility("signupPassword", "toggleSignupPwd");
  });

  // Auth Submissions & Logout
  document.getElementById("authLoginForm")?.addEventListener("submit", handleLoginSubmit);
  document.getElementById("authSignupForm")?.addEventListener("submit", handleSignupSubmit);
  document.getElementById("logoutBtn")?.addEventListener("click", handleLogout);

  // App & Booking Form
  document.getElementById("bookingForm").addEventListener("submit", handleBookingSubmit);
  document.getElementById("printBookingBtn").addEventListener("click", printBooking);
  document.getElementById("refreshBookingsBtn").addEventListener("click", loadBookings);
  document.getElementById("exportBookingsBtn").addEventListener("click", exportBookings);
  document.getElementById("bookingsTableBody").addEventListener("click", handleReceiptAction);
  document.getElementById("blTableBody")?.addEventListener("click", handleReceiptAction);

  // Modal Openers
  document.getElementById("openOccasionModalBtn").addEventListener("click", () => openModal("occasionModal"));
  document.getElementById("openVolunteerModalBtn").addEventListener("click", () => openModal("volunteerModal"));

  // Modal Submissions
  document.getElementById("occasionForm").addEventListener("submit", (e) => {
    e.preventDefault();
    addOccasion(document.getElementById("newOccasionName").value);
  });
  document.getElementById("volunteerForm").addEventListener("submit", (e) => {
    e.preventDefault();
    addVolunteer(document.getElementById("newVolunteerName").value);
  });

  // Modal Closers
  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", () => closeModal(btn.dataset.close));
  });

  // Booking Form Field Clear-on-input
  document.querySelectorAll("#bookingForm input, #bookingForm select, #bookingForm textarea").forEach((field) => {
    field.addEventListener("input",  () => clearFieldError(field.name || field.id));
    field.addEventListener("change", () => clearFieldError(field.name || field.id));
  });

  // Filter & Search Controls
  document.getElementById("filterDate").addEventListener("change",    updateDashboard);
  document.getElementById("filterSession").addEventListener("change", updateDashboard);
  document.getElementById("filterStatus").addEventListener("change",  updateDashboard);
  document.getElementById("searchBookings").addEventListener("input", updateDashboard);

  // Bookings Page Filter & Search Controls
  document.getElementById("blFilterMonth")?.addEventListener("change", renderBookingsPage);
  document.getElementById("blFilterYear")?.addEventListener("change", renderBookingsPage);
  document.getElementById("blSearch")?.addEventListener("input", renderBookingsPage);

  // Calendar Controls
  document.getElementById("calPrevBtn")?.addEventListener("click", () => {
    currentCalendarMonth--;
    if (currentCalendarMonth < 0) {
      currentCalendarMonth = 11;
      currentCalendarYear--;
    }
    renderCalendarPage();
  });
  document.getElementById("calNextBtn")?.addEventListener("click", () => {
    currentCalendarMonth++;
    if (currentCalendarMonth > 11) {
      currentCalendarMonth = 0;
      currentCalendarYear++;
    }
    renderCalendarPage();
  });
}

// ─────────────────────────────────────────────
// VIEW SWITCHING (Dedicated Login vs App)
// ─────────────────────────────────────────────

function showLoginView() {
  document.getElementById("loginView").classList.remove("hidden");
  document.getElementById("appView").classList.add("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

// RBAC: Only sarvamtrustindia@gmail.com is editor. Everyone else is viewer.
function isEditorEmail(email) {
  return (email || "").toLowerCase().trim() === "sarvamtrustindia@gmail.com";
}

function showAppView() {
  document.getElementById("loginView").classList.add("hidden");
  document.getElementById("appView").classList.remove("hidden");

  // Enforce role based on email — only sarvam email is editor
  const isEditor = isEditorEmail(currentAuth.email);
  currentAuth.role = isEditor ? "editor" : "viewer";

  const nameEl   = document.getElementById("headerUserName");
  const statusEl = document.getElementById("accessStatus");

  if (nameEl) {
    nameEl.textContent = currentAuth.name || currentAuth.email.split("@")[0] || "Sarvam User";
  }
  if (statusEl) {
    statusEl.textContent = isEditor ? "Editor Access" : "Viewer Access";
    statusEl.style.color = isEditor ? "" : "#f59e0b";
  }

  // Show / hide editor-only elements based on role
  document.querySelectorAll(".editor-only").forEach((el) => {
    el.classList.toggle("hidden", !isEditor);
  });

  if (isEditor) {
    switchPage('dashboard');
  } else {
    switchPage('bookings');
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function switchAuthTab(mode) {
  const isSignIn = mode === "signin";
  document.getElementById("tabSignInBtn")?.classList.toggle("active", isSignIn);
  document.getElementById("tabSignUpBtn")?.classList.toggle("active", !isSignIn);
  document.getElementById("authLoginForm")?.classList.toggle("hidden", !isSignIn);
  document.getElementById("authSignupForm")?.classList.toggle("hidden", isSignIn);

  clearAuthAlert();
  clearFieldError("loginEmail");
  clearFieldError("loginPassword");
  clearFieldError("signupName");
  clearFieldError("signupEmail");
  clearFieldError("signupPassword");
  clearFieldError("signupConfirmPassword");
}

function togglePasswordVisibility(inputId, toggleBtnId) {
  const input = document.getElementById(inputId);
  const btn   = document.getElementById(toggleBtnId);
  if (!input || !btn) return;
  const isPassword = input.type === "password";
  input.type = isPassword ? "text" : "password";
  btn.textContent = isPassword ? "🙈" : "👁️";
}

function showAuthAlert(message, type) {
  const alertEl = document.getElementById("authAlert");
  if (!alertEl) return;
  alertEl.className = `auth-alert ${type}`;
  alertEl.innerHTML = message;
  alertEl.classList.remove("hidden");
}

function clearAuthAlert() {
  const alertEl = document.getElementById("authAlert");
  if (!alertEl) return;
  alertEl.className = "auth-alert hidden";
  alertEl.textContent = "";
}

// ─────────────────────────────────────────────
// AUTHENTICATION LOGIC
// ─────────────────────────────────────────────

async function handleLoginSubmit(event) {
  event.preventDefault();
  clearAuthAlert();
  clearFieldError("loginEmail");
  clearFieldError("loginPassword");

  const emailEl    = document.getElementById("loginEmail");
  const passwordEl = document.getElementById("loginPassword");
  const rememberEl = document.getElementById("rememberMe");
  const submitBtn  = document.getElementById("loginSubmitBtn");

  const email    = emailEl.value.trim();
  const password = passwordEl.value.trim();
  const remember = rememberEl ? rememberEl.checked : true;

  if (!email) {
    document.getElementById("loginEmailError").textContent = "Please enter your email address.";
    emailEl.focus();
    return;
  }
  if (!password) {
    document.getElementById("loginPasswordError").textContent = "Please enter your password.";
    passwordEl.focus();
    return;
  }

  submitBtn.disabled = true;
  submitBtn.querySelector(".btn-text").textContent = "Authenticating...";

  try {
    let result = null;

    if (GOOGLE_APPS_SCRIPT_URL && GOOGLE_APPS_SCRIPT_URL !== "PASTE_YOUR_WEB_APP_URL_HERE") {
      try {
        const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ action: "login", email, password, device: getDeviceInfo() })
        });
        result = await response.json();
      } catch (netErr) {
        console.warn("Backend login network response fallback:", netErr);
      }
    }

    // Check if the backend is the legacy version (which returns "Missing required field..." on login action)
    const isLegacyBackendError = result && !result.success && result.message && String(result.message).includes("Missing required field");

    // Local / direct authentication verification if backend is offline, legacy, or default admin accounts
    if (!result || typeof result.success === "undefined" || isLegacyBackendError || !result.success) {
      const lowerEmail = email.toLowerCase();
      if (lowerEmail === "sarvamtrustindia@gmail.com" && (password === "Sarvam@Panner" || password === "sarvam2025" || password === "admin123")) {
        result = {
          success: true,
          token: "sarvam-auth-" + Date.now(),
          role: "editor",
          name: "Sarvam Trust",
          email: email
        };
      } else {
        // Check newly registered local accounts — all local accounts are viewers
        const localUsers = safeParse(localStorage.getItem(STORAGE_KEYS.localUsers), []);
        const matchedLocalUser = localUsers.find(
          (u) => u.email.toLowerCase() === lowerEmail && u.password === password
        );
        if (matchedLocalUser) {
          result = {
            success: true,
            token: "sarvam-auth-" + Date.now(),
            role: "viewer",   // All non-sarvam accounts are viewers
            name: matchedLocalUser.name || "User",
            email: matchedLocalUser.email
          };
        } else if (isLegacyBackendError) {
          throw new Error("Invalid email or password. Please check your credentials.");
        }
      }
    }

    if (!result || !result.success) {
      throw new Error(result?.message || "Invalid email or password. Please try again.");
    }

    // Enforce role: only sarvam email is editor regardless of what backend says
    const resolvedRole = isEditorEmail(result.email || email) ? "editor" : "viewer";

    // Store Auth Session
    currentAuth = {
      token: result.token || "token-" + Date.now(),
      role:  resolvedRole,
      email: result.email || email,
      name:  result.name || email.split("@")[0]
    };

    const targetStorage = remember ? localStorage : sessionStorage;
    targetStorage.setItem(STORAGE_KEYS.authToken, currentAuth.token);
    targetStorage.setItem(STORAGE_KEYS.userRole,  currentAuth.role);
    targetStorage.setItem(STORAGE_KEYS.userEmail, currentAuth.email);
    targetStorage.setItem(STORAGE_KEYS.userName,  currentAuth.name);
    localStorage.setItem(STORAGE_KEYS.rememberMe, remember ? "true" : "false");

    document.getElementById("authLoginForm").reset();
    showToast(`Welcome back, <strong>${escapeHtml(currentAuth.name)}</strong>!`, "success");

    showAppView();
    initializeAppData();

  } catch (err) {
    showAuthAlert(err.message || "Unable to sign in. Please verify your credentials.", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.querySelector(".btn-text").textContent = "Sign In";
  }
}

async function handleSignupSubmit(event) {
  event.preventDefault();
  clearAuthAlert();
  clearFieldError("signupName");
  clearFieldError("signupEmail");
  clearFieldError("signupPassword");
  clearFieldError("signupConfirmPassword");

  const nameEl     = document.getElementById("signupName");
  const emailEl    = document.getElementById("signupEmail");
  const pwdEl      = document.getElementById("signupPassword");
  const confirmEl  = document.getElementById("signupConfirmPassword");
  const submitBtn  = document.getElementById("signupSubmitBtn");

  const name     = nameEl.value.trim();
  const email    = emailEl.value.trim();
  const password = pwdEl.value;
  const confirm  = confirmEl.value;

  if (!name) {
    document.getElementById("signupNameError").textContent = "Full name is required.";
    nameEl.focus();
    return;
  }
  if (!email || !email.includes("@")) {
    document.getElementById("signupEmailError").textContent = "Please enter a valid email address.";
    emailEl.focus();
    return;
  }
  if (!password || password.length < 6) {
    document.getElementById("signupPasswordError").textContent = "Password must be at least 6 characters.";
    pwdEl.focus();
    return;
  }
  if (password !== confirm) {
    document.getElementById("signupConfirmPasswordError").textContent = "Passwords do not match.";
    confirmEl.focus();
    return;
  }

  submitBtn.disabled = true;
  submitBtn.querySelector(".btn-text").textContent = "Creating Account...";

  try {
    let result = null;

    if (GOOGLE_APPS_SCRIPT_URL && GOOGLE_APPS_SCRIPT_URL !== "PASTE_YOUR_WEB_APP_URL_HERE") {
      try {
        const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ action: "signup", name, email, password, role: "viewer" })
        });
        result = await response.json();
      } catch (e) {
        console.warn("Backend signup fallback:", e);
      }
    }

    // Check if the backend is the legacy version (which returns "Missing required field: entryDate")
    const isLegacyBackendError = result && !result.success && result.message && String(result.message).includes("Missing required field");

    // Local / direct registration fallback if backend is offline or legacy Apps Script
    if (!result || typeof result.success === "undefined" || isLegacyBackendError) {
      const localUsers = safeParse(localStorage.getItem(STORAGE_KEYS.localUsers), []);
      const exists = localUsers.some((u) => u.email.toLowerCase() === email.toLowerCase());
      if (exists) {
        throw new Error("An account with this email already exists. Please sign in.");
      }
      localUsers.push({
        name,
        email,
        password,
        role: "viewer",  // All new accounts are viewers by default
        createdAt: new Date().toISOString()
      });
      localStorage.setItem(STORAGE_KEYS.localUsers, JSON.stringify(localUsers));

      result = {
        success: true,
        email: email,
        name: name,
        message: "Account created successfully!"
      };
    }

    if (!result.success) {
      throw new Error(result.message || "Could not register account.");
    }

    document.getElementById("authSignupForm").reset();
    document.getElementById("loginEmail").value = email;
    switchAuthTab("signin");
    showAuthAlert(`Account created for <strong>${escapeHtml(name)}</strong>! Please sign in with your password.`, "success");
    document.getElementById("loginPassword")?.focus();

  } catch (err) {
    showAuthAlert(err.message || "Failed to create account.", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.querySelector(".btn-text").textContent = "Create Account";
  }
}

function getDeviceInfo() {
  const ua = navigator.userAgent || "";
  let browser = "Browser";
  if (ua.includes("Chrome")) browser = "Chrome";
  else if (ua.includes("Safari")) browser = "Safari";
  else if (ua.includes("Firefox")) browser = "Firefox";
  else if (ua.includes("Edge")) browser = "Edge";
  
  let os = "Device";
  if (ua.includes("Windows")) os = "Windows";
  else if (ua.includes("Android")) os = "Android";
  else if (ua.includes("iPhone") || ua.includes("iPad")) os = "iOS";
  else if (ua.includes("Mac")) os = "Mac";
  else if (ua.includes("Linux")) os = "Linux";

  return `${browser} (${os})`;
}

function handleGuestLogin() {
  currentAuth = {
    token: "guest-token",
    role:  "viewer",
    email: "guest@sarvam.org",
    name:  "Guest Viewer"
  };

  sessionStorage.setItem(STORAGE_KEYS.authToken, currentAuth.token);
  sessionStorage.setItem(STORAGE_KEYS.userRole,  currentAuth.role);
  sessionStorage.setItem(STORAGE_KEYS.userEmail, currentAuth.email);
  sessionStorage.setItem(STORAGE_KEYS.userName,  currentAuth.name);

  showToast("Entered in Guest Viewer mode.", "info");
  showAppView();
  initializeAppData();
}

function handleLogout() {
  currentAuth = { token: "", role: "", email: "", name: "" };

  sessionStorage.removeItem(STORAGE_KEYS.authToken);
  sessionStorage.removeItem(STORAGE_KEYS.userRole);
  sessionStorage.removeItem(STORAGE_KEYS.userEmail);
  sessionStorage.removeItem(STORAGE_KEYS.userName);

  localStorage.removeItem(STORAGE_KEYS.authToken);
  localStorage.removeItem(STORAGE_KEYS.userRole);
  localStorage.removeItem(STORAGE_KEYS.userEmail);
  localStorage.removeItem(STORAGE_KEYS.userName);

  clearAuthAlert();
  document.getElementById("authLoginForm")?.reset();
  showLoginView();
  showToast("You have been signed out.", "info");
}

// ─────────────────────────────────────────────
// OCCASIONS & VOLUNTEERS
// ─────────────────────────────────────────────

function loadCustomOccasions() {
  const stored = safeParse(localStorage.getItem(STORAGE_KEYS.occasions), []);
  const combined = [...new Set([...DEFAULT_OCCASIONS, ...stored])];
  renderSelectOptions("occasion", combined, "Select Occasion");
}

function addOccasion(nameValue) {
  const name = String(nameValue || "").trim();
  if (!name) {
    showFieldError("newOccasionName", "Occasion name is required.");
    return;
  }
  const store = safeParse(localStorage.getItem(STORAGE_KEYS.occasions), []);
  if (!store.some((i) => i.toLowerCase() === name.toLowerCase())) {
    store.push(name);
    localStorage.setItem(STORAGE_KEYS.occasions, JSON.stringify(store));
  }
  loadCustomOccasions();
  document.getElementById("occasion").value = name;
  closeModal("occasionModal");
  showToast(`Added occasion: <strong>${escapeHtml(name)}</strong>`, "success");
}

function loadCustomVolunteers() {
  const stored = safeParse(localStorage.getItem(STORAGE_KEYS.volunteers), []);
  const combined = [...new Set([...DEFAULT_VOLUNTEERS, ...stored])];
  renderSelectOptions("volunteer", combined, "Select Volunteer");
}

function addVolunteer(nameValue) {
  const name = String(nameValue || "").trim();
  if (!name) {
    showFieldError("newVolunteerName", "Volunteer name is required.");
    return;
  }
  const store = safeParse(localStorage.getItem(STORAGE_KEYS.volunteers), []);
  if (!store.some((i) => i.toLowerCase() === name.toLowerCase())) {
    store.push(name);
    localStorage.setItem(STORAGE_KEYS.volunteers, JSON.stringify(store));
  }
  loadCustomVolunteers();
  document.getElementById("volunteer").value = name;
  closeModal("volunteerModal");
  showToast(`Added volunteer: <strong>${escapeHtml(name)}</strong>`, "success");
}

function renderSelectOptions(selectId, values, placeholderText) {
  const select = document.getElementById(selectId);
  if (!select) return;
  const currentVal = select.value;
  select.innerHTML =
    `<option value="">${escapeHtml(placeholderText)}</option>` +
    values.filter(Boolean).map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join("");
  if (currentVal && values.includes(currentVal)) {
    select.value = currentVal;
  }
}

// ─────────────────────────────────────────────
// MODAL CONTROLS
// ─────────────────────────────────────────────

function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
  const inputId = id === "occasionModal" ? "newOccasionName" : "newVolunteerName";
  setTimeout(() => document.getElementById(inputId)?.focus(), 50);
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

// ─────────────────────────────────────────────
// BOOKING FORM SUBMISSION
// ─────────────────────────────────────────────

async function handleBookingSubmit(event) {
  event.preventDefault();

  if (!isEditorEmail(currentAuth.email)) {
    showToast("Only Sarvam admin has editor access to save bookings.", "error");
    return;
  }

  const validation = validateBookingForm();
  if (!validation.isValid) {
    showToast("Please complete all required fields.", "error");
    const firstError = Object.keys(validation.errors)[0];
    document.getElementById(firstError)?.focus();
    return;
  }

  const button = document.getElementById("saveBookingBtn");
  button.disabled    = true;
  button.textContent = "Saving Booking...";

  try {
    const bookingPayload = buildBookingPayload();
    const payload = { ...bookingPayload, action: "createBooking", token: currentAuth.token };

    let bookingId = bookingPayload.bookingId;

    if (GOOGLE_APPS_SCRIPT_URL && GOOGLE_APPS_SCRIPT_URL !== "PASTE_YOUR_WEB_APP_URL_HERE") {
      const response = await fetch(GOOGLE_APPS_SCRIPT_URL, {
        method:  "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body:    JSON.stringify(payload)
      });
      const result = await response.json();
      if (!result.success) throw new Error(result.message || "Could not save booking to Google Sheets.");
      if (result.bookingId) bookingId = result.bookingId;
    }

    lastSavedBooking = { ...bookingPayload, bookingId };
    allBookings = [
      lastSavedBooking,
      ...allBookings.filter((b) => b.bookingId !== lastSavedBooking.bookingId)
    ];
    localStorage.setItem(STORAGE_KEYS.localBookings, JSON.stringify(allBookings.slice(0, 100)));

    showToast(`Booking saved successfully!<br>ID: <strong>${escapeHtml(bookingId)}</strong>`, "success");
    document.getElementById("printBookingBtn").classList.remove("hidden");
    
    updateDashboard();
    if (typeof renderBookingsPage === "function") renderBookingsPage();
    if (typeof renderCalendarPage === "function") renderCalendarPage();
    renderTodaysSponsor(getTodayIST());
    resetBookingForm();

  } catch (error) {
    console.error(error);
    showToast(error.message || "Unable to save booking. Please check connection.", "error");
  } finally {
    button.disabled    = false;
    button.textContent = "Save Booking";
  }
}

function validateBookingForm() {
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

  if (!sponsorName)                             errors.sponsorName     = "Sponsor name is required.";
  if (!sponsorFor)                              errors.sponsorFor      = "Sponsor For is required.";
  if (!isValidIndianPhone(phone))               errors.phone           = "Enter a valid 10-digit mobile number.";
  if (!occasion)                                errors.occasion        = "Please select an occasion.";
  if (!date || !isValidDate(date))              errors.sponsorshipDate = "Select a valid sponsorship date.";
  if (!session)                                 errors.foodSession     = "Select a food session.";
  if (!Number.isFinite(amount) || amount <= 0)  errors.amount          = "Enter an amount greater than ₹0.";
  if (!volunteer)                               errors.volunteer       = "Please select a volunteer.";
  if (!paymentStatus)                           errors.paymentStatus   = "Select Paid or Pending status.";

  Object.entries(errors).forEach(([field, msg]) => showFieldError(field, msg));
  return { isValid: Object.keys(errors).length === 0, errors };
}

function buildBookingPayload() {
  const form = document.getElementById("bookingForm");
  const now = new Date();
  const y = String(now.getFullYear()).slice(-2);
  const m = ("0" + (now.getMonth() + 1)).slice(-2);
  const rand = ("000" + Math.floor(Math.random() * 10000)).slice(-4);
  const bookingId = "BK" + y + m + "-" + rand;

  return {
    bookingId:       bookingId,
    entryDate:       formatDateForSheet(new Date()),
    sponsorName:     form.sponsorName.value.trim(),
    sponsorFor:      form.sponsorFor.value.trim(),
    phone:           form.phone.value.trim(),
    occasion:        form.occasion.value,
    sponsorshipDate: formatDateForSheet(form.sponsorshipDate.value),
    foodSession:     form.foodSession.value,
    amount:          Number(form.amount.value),
    place:           form.place ? form.place.value.trim() : "",
    volunteer:       form.volunteer.value,
    paymentStatus:   form.querySelector('input[name="paymentStatus"]:checked')?.value || "Pending",
    notes:           form.notes.value.trim(),
    createdAt:       formatDateTime(new Date())
  };
}

function resetBookingForm() {
  document.getElementById("bookingForm").reset();
  setDefaultDate();
  setDefaultPaymentStatus();
  clearAllFieldErrors();
}

function setDefaultDate() {
  const dateInput = document.getElementById("sponsorshipDate");
  if (dateInput) dateInput.value = formatDateForInput(new Date());
}

function setDefaultPaymentStatus() {
  const pending = document.querySelector('input[name="paymentStatus"][value="Pending"]');
  if (pending) pending.checked = true;
}

// ─────────────────────────────────────────────
// LOAD BOOKINGS & GOOGLE SHEETS SYNC
// ─────────────────────────────────────────────

async function loadBookings() {
  const local = safeParse(localStorage.getItem(STORAGE_KEYS.localBookings), []);
  allBookings = Array.isArray(local) ? local : [];
  updateDashboard();
  if (typeof renderBookingsPage === "function") renderBookingsPage();
  if (typeof renderCalendarPage === "function") renderCalendarPage();

  if (!GOOGLE_APPS_SCRIPT_URL || GOOGLE_APPS_SCRIPT_URL === "PASTE_YOUR_WEB_APP_URL_HERE") return;

  try {
    const response = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?action=recent`);
    const result   = await response.json();
    if (result.success && Array.isArray(result.data)) {
      allBookings = result.data;
      localStorage.setItem(STORAGE_KEYS.localBookings, JSON.stringify(allBookings.slice(0, 100)));
      updateDashboard();
      if (typeof renderBookingsPage === "function") renderBookingsPage();
      if (typeof renderCalendarPage === "function") renderCalendarPage();
      renderTodaysSponsor(getTodayIST());
    }
  } catch (error) {
    console.warn("Google Sheet sync notice:", error);
  }
}

// ─────────────────────────────────────────────
// DASHBOARD / TABLE RENDERING
// ─────────────────────────────────────────────

function updateDashboard() {
  const filtered = filterBookingsData().slice(0, 2);
  const body     = document.getElementById("bookingsTableBody");
  if (!body) return;

  if (!filtered.length) {
    body.innerHTML = '<tr><td colspan="11" class="empty-state">No sponsorship bookings found matching the criteria.</td></tr>';
  } else {
    body.innerHTML = filtered.map((b) => `
      <tr>
        <td><strong>${escapeHtml(b.bookingId || "-")}</strong></td>
        <td>${escapeHtml(b.sponsorName  || "-")}</td>
        <td>${escapeHtml(b.sponsorFor   || "-")}</td>
        <td>${escapeHtml(formatDateForDisplay(b.sponsorshipDate))}</td>
        <td><span class="ts-session ts-session--${String(b.foodSession || "").toLowerCase().replace(" ", "-")}">${escapeHtml(b.foodSession || "-")}</span></td>
        <td><strong>${formatCurrency(b.amount)}</strong></td>
        <td>${escapeHtml(b.place        || "-")}</td>
        <td>${escapeHtml(b.volunteer    || "-")}</td>
        <td>
          <span class="status-pill ${String(b.paymentStatus || "Pending").toLowerCase()}">
            ${escapeHtml(b.paymentStatus || "Pending")}
          </span>
        </td>
        <td>${escapeHtml(b.notes || "-")}</td>
        <td>
          <button
            type="button"
            class="receipt-btn"
            data-booking-id="${escapeHtml(b.bookingId || "")}"
            title="Download receipt"
          >📄 Receipt</button>
        </td>
      </tr>
    `).join("");
  }

  updateSummaryCards();
}

function filterBookingsData() {
  const dateEl    = document.getElementById("filterDate");
  const sessionEl = document.getElementById("filterSession");
  const statusEl  = document.getElementById("filterStatus");
  const searchEl  = document.getElementById("searchBookings");

  const date    = dateEl ? dateEl.value : "";
  const session = sessionEl ? sessionEl.value : "All";
  const status  = statusEl ? statusEl.value : "All";
  const search  = searchEl ? searchEl.value.trim().toLowerCase() : "";

  return [...allBookings]
    .filter((b) => {
      if (date && normalizeDateForCompare(b.sponsorshipDate) !== date) return false;
      if (session !== "All" && b.foodSession !== session) return false;
      if (status  !== "All" && (b.paymentStatus || "Pending") !== status) return false;
      if (search) {
        const target = `${b.sponsorName || ""} ${b.sponsorFor || ""} ${b.phone || ""} ${b.bookingId || ""} ${b.notes || ""} ${b.place || ""}`.toLowerCase();
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

  const countEl   = document.getElementById("summaryTodayCount");
  const totalEl   = document.getElementById("summaryTodayAmount");
  const paidEl    = document.getElementById("summaryPaidAmount");
  const pendingEl = document.getElementById("summaryPendingAmount");

  if (countEl)   countEl.textContent   = todayBookings.length;
  if (totalEl)   totalEl.textContent   = formatCurrency(total);
  if (paidEl)    paidEl.textContent    = formatCurrency(paid);
  if (pendingEl) pendingEl.textContent = formatCurrency(pending);
}

// ─────────────────────────────────────────────
// TODAY'S SPONSOR TICKER
// ─────────────────────────────────────────────

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
    contentEl.innerHTML = `<span class="ts-no-sponsor">No sponsor booked yet for today</span>`;
    return;
  }

  const sessionOrder = { Breakfast: 1, Lunch: 2, Dinner: 3, Twice: 4, "Whole Day": 5 };
  todayBookings.sort((a, b) => (sessionOrder[a.foodSession] || 99) - (sessionOrder[b.foodSession] || 99));

  const parts = todayBookings.map((b) => {
    const name    = escapeHtml(b.sponsorName || "—");
    const occasion = escapeHtml(b.occasion   || "—");
    const session  = escapeHtml(b.foodSession || "");
    const sessionClass = session.toLowerCase().replace(" ", "-");
    const pill = session ? `<span class="ts-session ts-session--${sessionClass}">${session}</span>` : "";
    return `<strong>${name}</strong> (${occasion}) ${pill}`;
  });

  contentEl.innerHTML = parts.join("&nbsp;&nbsp;&bull;&nbsp;&nbsp;");
}

// ─────────────────────────────────────────────
// CSV EXPORT
// ─────────────────────────────────────────────

async function exportBookings() {
  if (!isEditorEmail(currentAuth.email)) {
    showToast("Only Sarvam admin can download/export bookings.", "error");
    return;
  }

  try {
    let exportData = allBookings;

    if (GOOGLE_APPS_SCRIPT_URL && GOOGLE_APPS_SCRIPT_URL !== "PASTE_YOUR_WEB_APP_URL_HERE") {
      try {
        const res = await fetch(`${GOOGLE_APPS_SCRIPT_URL}?action=export`);
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          exportData = json.data;
        }
      } catch (e) {
        console.warn("Direct export fallback to local cache:", e);
      }
    }

    if (!exportData.length) {
      showToast("No bookings available to download.", "info");
      return;
    }

    downloadCsv(exportData);
    showToast("Bookings CSV downloaded successfully.", "success");
  } catch (err) {
    showToast(err.message || "Failed to download CSV.", "error");
  }
}

function downloadCsv(bookings) {
  const columns = [
    "Booking ID", "Entry Date", "Sponsor Name", "Sponsor For",
    "Phone Number", "Occasion", "Sponsorship Date", "Food Session",
    "Sponsorship Amount", "Place", "Volunteer", "Payment Status",
    "Created At", "Notes"
  ];
  const fields = [
    "bookingId", "entryDate", "sponsorName", "sponsorFor",
    "phone", "occasion", "sponsorshipDate", "foodSession",
    "amount", "place", "volunteer", "paymentStatus",
    "createdAt", "notes"
  ];

  const quote = (val) => `"${String(val ?? "").replace(/"/g, '""')}"`;
  const csvRows = [
    columns.map(quote).join(","),
    ...bookings.map((b) => fields.map((f) => quote(b[f])).join(","))
  ];

  const blob = new Blob(["\uFEFF" + csvRows.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `sarvam-bookings-${formatDateISO(new Date())}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

// ─────────────────────────────────────────────
// FORMAL RECEIPT PRINTING
// ─────────────────────────────────────────────

function handleReceiptAction(event) {
  const button = event.target.closest(".receipt-btn");
  if (!button) return;
  const bookingId = button.dataset.bookingId;
  if (!bookingId) return;
  const booking = allBookings.find((b) => String(b.bookingId) === String(bookingId));
  if (!booking) {
    showToast("Booking record not found. Please refresh.", "error");
    return;
  }
  generateReceiptForBooking(booking);
}

function printBooking() {
  if (!lastSavedBooking) {
    showToast("No newly saved booking to print.", "error");
    return;
  }
  generateReceiptForBooking(lastSavedBooking);
}

function generateReceiptForBooking(booking) {
  Promise.all([fetchImageAsBase64("Sarvam Logo.png"), fetchImageAsBase64("Logo.png")])
    .then(([headerLogo, watermark]) => openPrintWindow(booking, headerLogo, watermark))
    .catch(() => {
      fetchImageAsBase64("Sarvam Logo.png")
        .then((h) => openPrintWindow(booking, h, ""))
        .catch(() => openPrintWindow(booking, "", ""));
    });
}

function fetchImageAsBase64(filename) {
  return fetch(new URL(filename, window.location.href).href)
    .then((r) => { if (!r.ok) throw new Error("Image fetch failed"); return r.blob(); })
    .then((blob) => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload  = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    }));
}

function openPrintWindow(b, headerLogoB64, watermarkB64) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    showToast("Please allow popups to download or print the receipt.", "error");
    return;
  }

  const headerLogoHTML = headerLogoB64
    ? `<img class="doc-logo" src="${headerLogoB64}" alt="Sarvam Anna Chathram logo">`
    : "";

  const watermarkHTML = watermarkB64 ? `
    <img src="${watermarkB64}" aria-hidden="true" style="
      position:fixed;top:0;left:0;width:100vw;height:100vh;
      object-fit:contain;object-position:center;
      opacity:0.07;pointer-events:none;z-index:0;display:block;">` : "";

  printWindow.document.write(`<!DOCTYPE html>
<html lang="ta">
<head>
  <meta charset="UTF-8">
  <title>Receipt - ${escapeHtml(b.bookingId)} - Sarvam Annachathiram</title>
  <style>
    @page { size: A4 portrait; margin: 16mm 14mm; }
    *     { box-sizing: border-box; margin: 0; padding: 0; }
    body  { font-family: Arial, "Noto Sans Tamil", sans-serif; color: #1a3520; position: relative; min-height: 100vh; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page-content { position: relative; z-index: 1; }

    .doc-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; padding-bottom: 14px; border-bottom: 3px solid #2e7d32; margin-bottom: 18px; }
    .doc-logo   { height: 85px; width: auto; object-fit: contain; flex-shrink: 0; }
    .doc-contact { text-align: right; flex: 1; }
    .doc-contact .phones  { font-size: 1.02rem; font-weight: 700; color: #1b5e20; white-space: nowrap; }
    .doc-contact .email   { font-size: 0.82rem; color: #2e7d32; margin-top: 4px; }
    .doc-contact .address { font-size: 0.76rem; color: #4a6b50; margin-top: 5px; line-height: 1.4; }

    .doc-title-block { text-align: center; margin-bottom: 20px; }
    .doc-title-block h1 { font-size: 1.35rem; color: #1b5e20; letter-spacing: .04em; margin-bottom: 4px; }
    .doc-title-block .doc-subtitle { font-size: .86rem; color: #5a7560; }
    .booking-id-badge { display: inline-block; margin-top: 8px; background: rgba(232,245,233,.8); border: 1px solid #a5d6a7; border-radius: 6px; padding: 4px 14px; font-weight: 700; font-size: .88rem; color: #1b5e20; }

    .booking-table { width: 100%; border-collapse: collapse; margin-bottom: 22px; }
    .booking-table td { padding: 9px 12px; border: 1px solid #c8e6c9; font-size: .88rem; vertical-align: top; }
    .booking-table tr:nth-child(even) td { background: rgba(244,251,245,.55); }
    .booking-table td.field-label { width: 38%; font-weight: 700; color: #215028; background: rgba(232,245,233,.6); }

    .status-paid    { color: #1b5e20; font-weight: 700; }
    .status-pending { color: #e65100; font-weight: 700; }

    .tax-exemption { text-align: center; font-size: 0.82rem; color: #2e7d32; font-weight: 700; margin-top: 8px; }
    .thank-you     { text-align: center; margin: 10px 0 26px; font-size: .84rem; color: #4a6b50; font-style: italic; }
    .signature-block { padding-top: 14px; border-top: 1px solid #c8e6c9; }
    .signature-block .sig-name { font-weight: 700; font-size: .92rem; color: #1a3520; }
    .signature-block .sig-title { font-size: .78rem; color: #5a7560; margin-top: 80px; font-style: italic; border-top: 1px dashed #c8e6c9; padding-top: 6px; }
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
      <div class="doc-subtitle">Food Sponsorship Official Receipt &amp; Confirmation</div>
      <div class="booking-id-badge">Booking ID: ${escapeHtml(b.bookingId)}</div>
    </div>

    <table class="booking-table">
      <tr><td class="field-label">Sponsor Name</td>     <td>${escapeHtml(b.sponsorName)}</td></tr>
      <tr><td class="field-label">Sponsor For</td>      <td>${escapeHtml(b.sponsorFor)}</td></tr>
      <tr><td class="field-label">Phone Number</td>     <td>${escapeHtml(b.phone)}</td></tr>
      <tr><td class="field-label">Occasion</td>         <td>${escapeHtml(b.occasion)}</td></tr>
      <tr><td class="field-label">Sponsorship Date</td> <td>${escapeHtml(formatDateForDisplay(b.sponsorshipDate))}</td></tr>
      <tr><td class="field-label">Food Session</td>     <td>${escapeHtml(b.foodSession)}</td></tr>
      <tr><td class="field-label">Sponsorship Amount</td><td><strong>${formatCurrency(b.amount)}</strong></td></tr>
      <tr><td class="field-label">Place</td>            <td>${escapeHtml(b.place || "—")}</td></tr>
      <tr><td class="field-label">Volunteer</td>        <td>${escapeHtml(b.volunteer)}</td></tr>
      <tr>
        <td class="field-label">Payment Status</td>
        <td><span class="${b.paymentStatus === "Paid" ? "status-paid" : "status-pending"}">${escapeHtml(b.paymentStatus)}</span></td>
      </tr>
      <tr><td class="field-label">Notes</td>            <td>${escapeHtml(b.notes || "—")}</td></tr>
    </table>

    <div class="tax-exemption">80G Tax Exemption Available for all Donations</div>
    <div class="thank-you">Thank you for your generous support of Sarvam Annachathiram. 🙏</div>

    <div class="signature-block">
      <div class="sig-name">For, <br>Sarvam Trust</div>
      <div class="sig-title">
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

// ─────────────────────────────────────────────
// TOAST & FIELD ERROR UTILITIES
// ─────────────────────────────────────────────

function showToast(message, type = "info") {
  const toast = document.getElementById("toastMessage");
  if (!toast) return;
  toast.className = `message ${type}`;
  toast.innerHTML = message;
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

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

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

function formatDateISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateForInput(date) {
  return formatDateISO(date);
}

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

// ─────────────────────────────────────────────
// PAGE NAVIGATION & MULTI-PAGE RENDERING
// ─────────────────────────────────────────────

let currentCalendarMonth = new Date().getMonth(); // 0-11
let currentCalendarYear = new Date().getFullYear();

function switchPage(pageId) {
  // Hide all page containers
  document.querySelectorAll(".app-page").forEach((page) => {
    page.classList.add("hidden");
  });

  // Remove active styling from all nav tabs
  document.querySelectorAll(".app-nav-btn").forEach((btn) => {
    btn.classList.remove("active");
  });

  if (pageId === "dashboard") {
    document.getElementById("pageDashboard")?.classList.remove("hidden");
    document.getElementById("navDashboard")?.classList.add("active");
  } else if (pageId === "bookings") {
    document.getElementById("pageBookings")?.classList.remove("hidden");
    document.getElementById("navBookings")?.classList.add("active");
    renderBookingsPage();
  } else if (pageId === "calendar") {
    document.getElementById("pageCalendar")?.classList.remove("hidden");
    document.getElementById("navCalendar")?.classList.add("active");
    renderCalendarPage();
  }
}

function populateBookingsYears() {
  const yearSelect = document.getElementById("blFilterYear");
  if (!yearSelect) return;

  const currentVal = yearSelect.value;
  yearSelect.innerHTML = '<option value="0">All Years</option>';

  const years = new Set();
  years.add(new Date().getFullYear());

  allBookings.forEach((b) => {
    const dateStr = normalizeDateForCompare(b.sponsorshipDate);
    if (dateStr) {
      const year = new Date(dateStr).getFullYear();
      if (year && !isNaN(year)) {
        years.add(year);
      }
    }
  });

  const sortedYears = Array.from(years).sort((a, b) => b - a);
  sortedYears.forEach((year) => {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = year;
    yearSelect.appendChild(option);
  });

  if (currentVal && Array.from(yearSelect.options).some((opt) => opt.value === currentVal)) {
    yearSelect.value = currentVal;
  }
}

function renderBookingsPage() {
  populateBookingsYears();

  const monthFilter = parseInt(document.getElementById("blFilterMonth")?.value || "0", 10);
  const yearFilter = parseInt(document.getElementById("blFilterYear")?.value || "0", 10);
  const searchFilter = (document.getElementById("blSearch")?.value || "").trim().toLowerCase();

  const tbody = document.getElementById("blTableBody");
  if (!tbody) return;

  const filtered = allBookings.filter((b) => {
    const dateStr = normalizeDateForCompare(b.sponsorshipDate);
    if (!dateStr) return false;

    const bDate = new Date(dateStr);
    const bMonth = bDate.getMonth() + 1; // 1-12
    const bYear = bDate.getFullYear();

    if (monthFilter !== 0 && bMonth !== monthFilter) return false;
    if (yearFilter !== 0 && bYear !== yearFilter) return false;

    if (searchFilter) {
      const targetText = `${b.sponsorName || ""} ${b.sponsorFor || ""} ${b.phone || ""} ${b.bookingId || ""} ${b.notes || ""} ${b.place || ""}`.toLowerCase();
      if (!targetText.includes(searchFilter)) return false;
    }
    return true;
  }).sort((a, b) => {
    const da = new Date(normalizeDateForCompare(a.sponsorshipDate));
    const db = new Date(normalizeDateForCompare(b.sponsorshipDate));
    return db - da; // Show newest date first
  });

  const summaryEl = document.getElementById("blSummary");
  if (summaryEl) {
    summaryEl.textContent = `Showing ${filtered.length} booking(s)`;
  }

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" class="empty-state">No bookings found for the selected criteria.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map((b, idx) => `
    <tr>
      <td><strong>${idx + 1}</strong></td>
      <td><strong>${escapeHtml(formatDateForDisplay(b.sponsorshipDate))}</strong></td>
      <td>${escapeHtml(b.sponsorName || "-")}</td>
      <td>${escapeHtml(b.sponsorFor || "-")}</td>
      <td><span class="ts-session ts-session--${String(b.foodSession || "").toLowerCase().replace(" ", "-")}">${escapeHtml(b.foodSession || "-")}</span></td>
      <td><strong>${formatCurrency(b.amount)}</strong></td>
      <td>
        <span class="status-pill ${String(b.paymentStatus || "Pending").toLowerCase()}">
          ${escapeHtml(b.paymentStatus || "Pending")}
        </span>
      </td>
      <td>${escapeHtml(b.occasion || "-")}</td>
      <td>${escapeHtml(b.place || "-")}</td>
      <td>
        <button
          type="button"
          class="receipt-btn"
          data-booking-id="${escapeHtml(b.bookingId || "")}"
          title="Download receipt"
        >📄 Receipt</button>
      </td>
    </tr>
  `).join("");
}

let selectedCalendarDate = formatDateISO(new Date());

function renderCalendarPage() {
  const grid = document.getElementById("calendarGrid");
  const monthLabel = document.getElementById("calMonthLabel");
  if (!grid || !monthLabel) return;

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  monthLabel.textContent = `${monthNames[currentCalendarMonth]} ${currentCalendarYear}`;

  const firstDayIndex = new Date(currentCalendarYear, currentCalendarMonth, 1).getDay();
  const totalDays = new Date(currentCalendarYear, currentCalendarMonth + 1, 0).getDate();
  const prevMonthTotalDays = new Date(currentCalendarYear, currentCalendarMonth, 0).getDate();

  grid.innerHTML = "";

  // Previous month buffer days
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const day = prevMonthTotalDays - i;
    const dayDiv = document.createElement("div");
    dayDiv.className = "cal-day other-month";
    dayDiv.innerHTML = `<span class="cal-day-num">${day}</span>`;
    grid.appendChild(dayDiv);
  }

  // Active month days
  const todayStr = formatDateISO(new Date());
  for (let day = 1; day <= totalDays; day++) {
    const dateStr = `${currentCalendarYear}-${String(currentCalendarMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dayBookings = allBookings.filter((b) => normalizeDateForCompare(b.sponsorshipDate) === dateStr);

    const dayDiv = document.createElement("div");
    dayDiv.className = "cal-day";
    dayDiv.dataset.date = dateStr;
    
    if (dateStr === todayStr) {
      dayDiv.classList.add("today");
    }
    if (dateStr === selectedCalendarDate) {
      dayDiv.classList.add("selected");
    }
    if (dayBookings.length > 0) {
      dayDiv.classList.add("has-bookings");
    }

    dayDiv.addEventListener("click", () => showCalendarDayDetails(dateStr));

    let html = `<span class="cal-day-num">${day}</span>`;
    if (dayBookings.length > 0) {
      html += `<span class="cal-day-dot"></span>`;
    }

    dayDiv.innerHTML = html;
    grid.appendChild(dayDiv);
  }

  // Next month buffer days to align table cells grid
  const totalCells = firstDayIndex + totalDays;
  const nextMonthPadding = (7 - (totalCells % 7)) % 7;
  for (let day = 1; day <= nextMonthPadding; day++) {
    const dayDiv = document.createElement("div");
    dayDiv.className = "cal-day other-month";
    dayDiv.innerHTML = `<span class="cal-day-num">${day}</span>`;
    grid.appendChild(dayDiv);
  }

  // Initial update of side details panel
  showCalendarDayDetails(selectedCalendarDate);
}

function showCalendarDayDetails(dateStr) {
  selectedCalendarDate = dateStr;

  // Highlight selected date in calendar grid
  document.querySelectorAll(".cal-day").forEach((el) => {
    if (el.dataset.date === dateStr) {
      el.classList.add("selected");
    } else {
      el.classList.remove("selected");
    }
  });

  const contentEl = document.getElementById("calDetailsContent");
  const titleEl = document.getElementById("calDetailsTitle");
  if (!contentEl) return;

  // Format date display (e.g. 2026-08-20 -> 20-Aug-2026)
  let formattedDate = dateStr;
  try {
    const parts = dateStr.split("-");
    if (parts.length === 3) {
      const shortMonths = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      formattedDate = `${parts[2]}-${shortMonths[parseInt(parts[1], 10) - 1]}-${parts[0]}`;
    }
  } catch (e) {}

  if (titleEl) {
    titleEl.textContent = `Sponsorships: ${formattedDate}`;
  }

  const dayBookings = allBookings.filter((b) => normalizeDateForCompare(b.sponsorshipDate) === dateStr);

  if (dayBookings.length === 0) {
    contentEl.innerHTML = `
      <p class="cal-details-placeholder">No food sponsorships scheduled for this date.</p>
    `;
    return;
  }

  contentEl.innerHTML = dayBookings.map((b) => `
    <div class="cal-detail-item">
      <div class="cal-detail-sponsor">${escapeHtml(b.sponsorName)}</div>
      <div class="cal-detail-sponsor-for" style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 6px;">
        For: ${escapeHtml(b.sponsorFor || "—")}
      </div>
      <div class="cal-detail-meta">
        <span class="cal-detail-session ${String(b.foodSession || "").toLowerCase().replace(" ", "-")}">${escapeHtml(b.foodSession)}</span>
        <span class="cal-detail-amount">${formatCurrency(b.amount)}</span>
      </div>
    </div>
  `).join("");
}
