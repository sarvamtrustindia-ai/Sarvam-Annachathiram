/* 
  SARVAM ANNA CHATHRAM 
  GOOGLE APPS SCRIPT BACKEND 
 
  IMPORTANT: 
  1. Open your Google Spreadsheet.
  2. Manually create a sheet named exactly: Bookings
  3. Paste your Spreadsheet ID into SPREADSHEET_ID below.
  4. In Apps Script editor, select setupSheets and click Run.
  5. Deploy as Web App when ready.
*/ 

const SPREADSHEET_ID = "1dmqsZqy9j2UhOBtZA6TvzcO1xPOZuCF7mKjc8_3dH88"; 
const SHEET_NAME = "Bookings"; 

const HEADERS = [ 
  "Booking ID", 
  "Entry Date", 
  "Sponsor Name", 
  "Sponsor For", 
  "Phone Number", 
  "Occasion", 
  "Sponsorship Date", 
  "Food Session", 
  "Sponsorship Amount", 
  "Place",
  "Volunteer", 
  "Payment Status", 
  "Created At", 
  "Notes" 
]; 

// ─────────────────────────────────────────────
// Run this once to set up the Bookings sheet.
// ─────────────────────────────────────────────
function setupSheets() {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    Logger.log("Looking for Bookings sheet...");
    var bookingSheet = ss.getSheetByName(SHEET_NAME);
    if (!bookingSheet) {
      throw new Error(
        'Sheet "' + SHEET_NAME + '" not found. ' +
        'Please create it manually in the spreadsheet first, then run setupSheets again.'
      );
    }
    ensureHeaders(bookingSheet);
    Logger.log("SUCCESS: Bookings sheet is ready.");
  } catch (err) {
    Logger.log("FAILED: " + err.message);
    throw err;
  }
}

// ─────────────────────────────────────────────
// HTTP HANDLERS
// ─────────────────────────────────────────────

function doGet(e) { 
  try { 
    var action = e && e.parameter ? e.parameter.action : ""; 
    if (action === "recent") { 
      return jsonResponse({ success: true, data: getRecentBookings() }); 
    }
    if (action === "export") {
      return jsonResponse({ success: true, data: getAllBookings() });
    }
    return jsonResponse({ success: true, message: "Sarvam Anna Chathram API is running." }); 
  } catch (error) { 
    return jsonResponse({ success: false, message: error.message }); 
  } 
} 

function doPost(e) { 
  try { 
    if (!e || !e.postData || !e.postData.contents) { 
      throw new Error("No data was received."); 
    } 

    var data = JSON.parse(e.postData.contents); 
    var action = String(data.action || "createBooking").trim();

    // ── LOGIN ──
    if (action === "login") {
      var loginResult = handleLoginAction({
        email:    data.email,
        password: data.password,
        device:   data.device
      });
      return jsonResponse(loginResult);
    }

    // ── SIGNUP ──
    if (action === "signup") {
      var signupResult = handleSignupAction({
        name:     data.name,
        email:    data.email,
        password: data.password,
        role:     data.role || "viewer",
        device:   data.device
      });
      return jsonResponse(signupResult);
    }

    // ── LOGOUT ──
    if (action === "logout") {
      recordLoginActivity({
        name:   data.name || "",
        email:  data.email || "",
        action: "Logout",
        role:   data.role || "",
        device: data.device || "",
        status: "Success"
      });
      return jsonResponse({ success: true, message: "Logout recorded." });
    }

    // ── EXPORT ──
    if (action === "export") {
      return jsonResponse({ success: true, data: getAllBookings() });
    }

    // ── CREATE BOOKING ──
    // Frontend may send bookingId but we IGNORE it — we always
    // generate a clean sequential SAC-YYYY-NNN based on the last ID
    // already present in the Google Sheet (e.g. SAC-2026-021 after SAC-2026-020).
    delete data.bookingId;

    validateBooking(data);

    var sheet     = getBookingsSheet();
    var bookingId = generateNextId(sheet);

    sheet.appendRow([
      bookingId,
      normalizeDateForSheet(data.entryDate),
      String(data.sponsorName || "").trim(),
      String(data.sponsorFor  || "").trim(),
      String(data.phone       || "").trim(),
      String(data.occasion    || "").trim(),
      normalizeDateForSheet(data.sponsorshipDate),
      String(data.foodSession || "").trim(),
      Number(data.amount),
      String(data.place       || "").trim(),
      String(data.volunteer   || "").trim(),
      String(data.paymentStatus || "").trim(),
      normalizeDateTime(data.createdAt),
      String(data.notes       || "").trim()
    ]);

    try {
      if (typeof updateMonthView === "function") updateMonthView();
      if (typeof updateCalendar  === "function") updateCalendar();
    } catch (mvErr) {
      Logger.log("Calendar update error (non-fatal): " + mvErr.message);
    }

    try {
      if (typeof refreshSponsorSheet === "function") refreshSponsorSheet();
    } catch (spErr) {
      Logger.log("Sponsor sheet update error (non-fatal): " + spErr.message);
    }

    return jsonResponse({
      success: true,
      message: "Booking saved successfully.",
      bookingId: bookingId
    }); 

  } catch (error) { 
    return jsonResponse({ success: false, message: error.message }); 
  } 
} 

// ─────────────────────────────────────────────
// SHEET HELPERS
// ─────────────────────────────────────────────

function getBookingsSheet() {
  if (!SPREADSHEET_ID || SPREADSHEET_ID === "PASTE_YOUR_GOOGLE_SHEET_ID_HERE") { 
    throw new Error("Google Sheet ID is not configured in Code.gs."); 
  }
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    throw new Error(
      'Sheet "' + SHEET_NAME + '" not found. Run setupSheets() from the editor first.'
    );
  }
  ensureHeaders(sheet);
  return sheet;
}

function ensureHeaders(sheet) { 
  if (!sheet) throw new Error("ensureHeaders: sheet is undefined.");
  var currentHeaders = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0]; 
  var needsHeaders = false;
  for (var i = 0; i < HEADERS.length; i++) {
    if (currentHeaders[i] !== HEADERS[i]) {
      needsHeaders = true;
      break;
    }
  }
  if (needsHeaders) { 
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]); 
    sheet.setFrozenRows(1); 
  } 
}

// ─────────────────────────────────────────────
// DATE UTILITIES
// ─────────────────────────────────────────────

/**
 * Converts any date input to dd-MM-yyyy string for storage.
 */
function normalizeDateForSheet(value) {
  if (value === undefined || value === null) return "";
  var text = String(value).trim();
  if (!text) return "";
  var p;
  // yyyy-MM-dd -> dd-MM-yyyy
  p = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (p) return p[3] + "-" + p[2] + "-" + p[1];
  // dd-MM-yyyy -> already correct
  p = text.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (p) return p[1] + "-" + p[2] + "-" + p[3];
  // dd/MM/yyyy -> convert to dd-MM-yyyy
  p = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (p) return p[1] + "-" + p[2] + "-" + p[3];
  return text;
}

/**
 * Reads a cell value and returns dd-MM-yyyy string.
 */
function normalizeDate(value) { 
  if (value instanceof Date) { 
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "dd-MM-yyyy"); 
  } 
  var text = String(value || "").trim(); 
  if (!text) return ""; 
  var p;
  p = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (p) return p[3] + "-" + p[2] + "-" + p[1];
  p = text.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (p) return p[1] + "-" + p[2] + "-" + p[3];
  p = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (p) return p[1] + "-" + p[2] + "-" + p[3];
  return text; 
}

function normalizeDateTime(value) { 
  if (value instanceof Date) { 
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss"); 
  } 
  return String(value || ""); 
} 

// ─────────────────────────────────────────────
// BOOKING HELPERS
// ─────────────────────────────────────────────

function validateBooking(data) { 
  var required = [ 
    "entryDate","sponsorName","sponsorFor","phone",
    "occasion","sponsorshipDate","foodSession","amount",
    "volunteer","paymentStatus","createdAt" 
  ]; 
  for (var i = 0; i < required.length; i++) {
    var field = required[i];
    if (data[field] === undefined || data[field] === null || String(data[field]).trim() === "") { 
      throw new Error("Missing required field: " + field); 
    }
  }
  if (!/^(Breakfast|Lunch|Dinner|Twice|Whole Day)$/.test(String(data.foodSession))) { 
    throw new Error("Invalid food session."); 
  } 
  if (!/^(Paid|Pending)$/.test(String(data.paymentStatus))) { 
    throw new Error("Invalid payment status."); 
  } 
  var amount = Number(data.amount); 
  if (!Number.isFinite(amount) || amount <= 0) { 
    throw new Error("Invalid sponsorship amount."); 
  } 
} 

/**
 * Generates the NEXT sequential booking ID using the pattern:
 *   SAC-<YEAR>-<NNN>
 *
 * Examples:
 *   If the sheet contains SAC-2026-001 … SAC-2026-020
 *   → this returns  SAC-2026-021
 *
 *   If the sheet is empty or has no SAC-* IDs
 *   → this returns  SAC-<CURRENT_YEAR>-001
 *
 * Works across any mix of old/other ID formats — it only
 * looks at existing SAC-YYYY-NNN values in column A.
 */
function generateNextId(sheet) {
  var year    = new Date().getFullYear();
  var lastRow = sheet.getLastRow();
  var prefix  = "SAC-" + year + "-";

  if (lastRow < 2) return prefix + "001";

  var values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  var max    = 0;

  for (var i = 0; i < values.length; i++) {
    var match = String(values[i][0]).trim().match(/^SAC-(\d{4})-(\d+)$/);
    if (match) {
      var n = parseInt(match[2], 10);
      if (n > max) max = n;
    }
  }

  return prefix + String(max + 1).padStart(3, "0");
} 

function getExistingBookingIds(sheet) { 
  var lastRow = sheet.getLastRow(); 
  if (lastRow < 2) {
    return { has: function() { return false; } };
  }
  var values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  var ids = {};
  for (var i = 0; i < values.length; i++) {
    ids[String(values[i][0])] = true;
  }
  return {
    has: function(id) { return ids[id] === true; }
  };
} 

function getRecentBookings() { 
  var sheet   = getBookingsSheet(); 
  var lastRow = sheet.getLastRow(); 
  if (lastRow < 2) return []; 
  var colCount = Math.max(HEADERS.length, sheet.getLastColumn());
  var values  = sheet.getRange(2, 1, lastRow - 1, colCount).getValues(); 
  var bookings = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    bookings.push({ 
      bookingId:       row[0], 
      entryDate:       normalizeDate(row[1]), 
      sponsorName:     row[2], 
      sponsorFor:      row[3], 
      phone:           row[4], 
      occasion:        row[5], 
      sponsorshipDate: normalizeDate(row[6]),
      foodSession:     row[7], 
      amount:          Number(row[8]) || 0, 
      place:           String(row[9] || ""),
      volunteer:       row[10], 
      paymentStatus:   row[11], 
      createdAt:       normalizeDateTime(row[12]),
      notes:           String(row[13] || "")
    });
  }
  bookings.reverse();
  return bookings.slice(0, 100); 
}

function getAllBookings() {
  var sheet   = getBookingsSheet(); 
  var lastRow = sheet.getLastRow(); 
  if (lastRow < 2) return []; 
  var colCount = Math.max(HEADERS.length, sheet.getLastColumn());
  var values  = sheet.getRange(2, 1, lastRow - 1, colCount).getValues(); 
  var bookings = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    bookings.push({ 
      bookingId:       row[0], 
      entryDate:       normalizeDate(row[1]), 
      sponsorName:     row[2], 
      sponsorFor:      row[3], 
      phone:           row[4], 
      occasion:        row[5], 
      sponsorshipDate: normalizeDate(row[6]),
      foodSession:     row[7], 
      amount:          Number(row[8]) || 0, 
      place:           String(row[9] || ""),
      volunteer:       row[10], 
      paymentStatus:   row[11], 
      createdAt:       normalizeDateTime(row[12]),
      notes:           String(row[13] || "")
    });
  }
  return bookings;
} 

// ─────────────────────────────────────────────
// RESPONSE HELPER
// ─────────────────────────────────────────────

function jsonResponse(object) {
  return ContentService
    .createTextOutput(JSON.stringify(object))
    .setMimeType(ContentService.MimeType.JSON);
}


// ════════════════════════════════════════════════════════════════
// LOGIN & USER MANAGEMENT — SEPARATE FUNCTIONS
// ════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────
// SHEET NAMES & HEADERS (hoisted var declarations)
// ─────────────────────────────────────────────

var LOGIN_SHEET = "Login";
var USERS_SHEET = "Users";

var LOGIN_HEADERS = [
  "Login ID",      // A
  "Timestamp",     // B
  "Name",          // C
  "Email",         // D
  "Action",        // E — Login / Signup / Logout
  "Role",          // F — editor / viewer
  "Device",        // G
  "IP Address",    // H
  "Status"         // I — Success / Failed
];

var USERS_HEADERS = [
  "User ID",       // A
  "Name",          // B
  "Email",         // C
  "Password Hash", // D
  "Role",          // E
  "Created At",    // F
  "Last Login"     // G
];


// ============================================================
// 1. LOGIN ACTIVITY TRACKING — STANDALONE FUNCTION
// ============================================================

/**
 * Standalone function to record login/signup/logout activity to the "Login" sheet.
 * Call this from anywhere or run it manually to test.
 * Creates the Login sheet automatically if it doesn't exist.
 *
 * @param {Object} params   — { name, email, action, role, device, ip, status }
 * @returns {Object}        — { success, loginId, message }
 */
function recordLoginActivity(params) {
  try {
    var p = params || {};
    var name   = String(p.name   || "").trim();
    var email  = String(p.email  || "").trim().toLowerCase();
    var action = String(p.action || "Login").trim();
    var role   = String(p.role   || "viewer").trim();
    var device = String(p.device || "").trim();
    var ip     = String(p.ip     || "").trim();
    var status = String(p.status || "Success").trim();

    if (!email) {
      throw new Error("Email is required to record login activity.");
    }

    var sheet     = getLoginSheet();
    var loginId   = generateLoginId(sheet);
    var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");

    sheet.appendRow([loginId, timestamp, name, email, action, role, device, ip, status]);

    alignLoginSheet(sheet);
    Logger.log("Login activity recorded: " + loginId + " | " + email + " | " + action + " | " + status);
    return { success: true, loginId: loginId, message: "Activity recorded." };
  } catch (err) {
    Logger.log("recordLoginActivity ERROR: " + err.message);
    return { success: false, message: err.message };
  }
}

/**
 * Manual helper — run once from Apps Script editor to create the Login sheet.
 * USE THIS if you get "You do not have permission" errors.
 * This uses the ACTIVE spreadsheet (run from Extensions → Apps Script inside your Google Sheet).
 */
function setupLoginSheet() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) {
      ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    }
    var sheet = ss.getSheetByName(LOGIN_SHEET);
    if (!sheet) {
      sheet = ss.insertSheet(LOGIN_SHEET);
      Logger.log('Created sheet: "' + LOGIN_SHEET + '"');
    }
    ensureLoginHeaders(sheet);
    alignLoginSheet(sheet);
    Logger.log('"' + LOGIN_SHEET + '" sheet is ready.');
  } catch (err) {
    Logger.log("setupLoginSheet ERROR: " + err.message);
    throw new Error(
      "Permission error fix:\n" +
      "1. Open YOUR Google Sheet in browser\n" +
      "2. Click menu: Extensions → Apps Script\n" +
      "3. Paste this Code.gs there\n" +
      "4. Run setupLoginSheet() from THERE (not from a standalone project)\n" +
      "5. Authorize when prompted\n\n" +
      "Original error: " + err.message
    );
  }
}

function getLoginSheet() {
  var ss;
  try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) { ss = null; }
  if (!ss) ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(LOGIN_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(LOGIN_SHEET);
    Logger.log('Auto-created sheet: "' + LOGIN_SHEET + '"');
  }
  ensureLoginHeaders(sheet);
  return sheet;
}

function ensureLoginHeaders(sheet) {
  var current     = sheet.getRange(1, 1, 1, LOGIN_HEADERS.length).getValues()[0];
  var needsUpdate = false;
  for (var i = 0; i < LOGIN_HEADERS.length; i++) {
    if (current[i] !== LOGIN_HEADERS[i]) { needsUpdate = true; break; }
  }
  if (needsUpdate) {
    sheet.getRange(1, 1, 1, LOGIN_HEADERS.length).setValues([LOGIN_HEADERS]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, LOGIN_HEADERS.length).setFontWeight("bold");
  }
}

function alignLoginSheet(sheet) {
  var lastRow    = sheet.getLastRow();
  var lastColumn = Math.max(sheet.getLastColumn(), LOGIN_HEADERS.length);
  if (lastRow >= 1) {
    sheet.getRange(1, 1, lastRow, lastColumn).setHorizontalAlignment("left");
  }
  if (lastRow >= 2) {
    sheet.getRange(2, 1, lastRow - 1, lastColumn).setNumberFormat("@");
  }
  sheet.autoResizeColumns(1, LOGIN_HEADERS.length);
}

function generateLoginId(sheet) {
  var year    = new Date().getFullYear();
  var lastRow = sheet.getLastRow();
  var prefix  = "LOG-" + year + "-";
  if (lastRow < 2) return prefix + "001";
  var values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  var max    = 0;
  for (var i = 0; i < values.length; i++) {
    var match = String(values[i][0]).trim().match(/LOG-\d{4}-(\d+)$/);
    if (match) {
      var n = parseInt(match[1], 10);
      if (n > max) max = n;
    }
  }
  return prefix + String(max + 1).padStart(3, "0");
}


// ============================================================
// 2. USERS SHEET — STORAGE FOR REGISTERED USERS
// ============================================================

function getUsersSheet() {
  var ss;
  try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch (e) { ss = null; }
  if (!ss) ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(USERS_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(USERS_SHEET);
    Logger.log('Auto-created sheet: "' + USERS_SHEET + '"');
  }
  ensureUsersHeaders(sheet);
  return sheet;
}

function ensureUsersHeaders(sheet) {
  var current     = sheet.getRange(1, 1, 1, USERS_HEADERS.length).getValues()[0];
  var needsUpdate = false;
  for (var i = 0; i < USERS_HEADERS.length; i++) {
    if (current[i] !== USERS_HEADERS[i]) { needsUpdate = true; break; }
  }
  if (needsUpdate) {
    sheet.getRange(1, 1, 1, USERS_HEADERS.length).setValues([USERS_HEADERS]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, USERS_HEADERS.length).setFontWeight("bold");
  }
}

function setupUsersSheet() {
  try {
    var sheet = getUsersSheet();
    alignUsersSheet(sheet);
    Logger.log('"' + USERS_SHEET + '" sheet is ready.');
  } catch (err) {
    Logger.log("setupUsersSheet ERROR: " + err.message);
    throw new Error(
      "Permission error fix:\n" +
      "1. Open YOUR Google Sheet in browser\n" +
      "2. Click menu: Extensions → Apps Script\n" +
      "3. Paste this Code.gs there\n" +
      "4. Run setupUsersSheet() from THERE\n" +
      "5. Authorize when prompted\n\n" +
      "Original error: " + err.message
    );
  }
}

function alignUsersSheet(sheet) {
  var lastRow    = sheet.getLastRow();
  var lastColumn = Math.max(sheet.getLastColumn(), USERS_HEADERS.length);
  if (lastRow >= 1) {
    sheet.getRange(1, 1, lastRow, lastColumn).setHorizontalAlignment("left");
  }
  if (lastRow >= 2) {
    sheet.getRange(2, 1, lastRow - 1, lastColumn).setNumberFormat("@");
  }
}

function generateUserId(sheet) {
  var year    = new Date().getFullYear();
  var lastRow = sheet.getLastRow();
  var prefix  = "USR-" + year + "-";
  if (lastRow < 2) return prefix + "001";
  var values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  var max    = 0;
  for (var i = 0; i < values.length; i++) {
    var match = String(values[i][0]).trim().match(/USR-\d{4}-(\d+)$/);
    if (match) {
      var n = parseInt(match[1], 10);
      if (n > max) max = n;
    }
  }
  return prefix + String(max + 1).padStart(3, "0");
}

function simpleHash(str) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, str, Utilities.Charset.UTF_8);
  var hex = "";
  for (var i = 0; i < bytes.length; i++) {
    var b = bytes[i] < 0 ? bytes[i] + 256 : bytes[i];
    hex += ("0" + b.toString(16)).slice(-2);
  }
  return hex;
}

function findUserByEmail(email) {
  var sheet   = getUsersSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  var values = sheet.getRange(2, 1, lastRow - 1, USERS_HEADERS.length).getValues();
  var target = String(email || "").trim().toLowerCase();
  for (var i = 0; i < values.length; i++) {
    var rowEmail = String(values[i][2] || "").trim().toLowerCase();
    if (rowEmail === target) {
      return {
        rowNum:   i + 2,
        userId:   String(values[i][0] || ""),
        name:     String(values[i][1] || ""),
        email:    String(values[i][2] || ""),
        password: String(values[i][3] || ""),
        role:     String(values[i][4] || "viewer"),
        createdAt: String(values[i][5] || ""),
        lastLogin: String(values[i][6] || "")
      };
    }
  }
  return null;
}

function updateUserLastLogin(email) {
  try {
    var user = findUserByEmail(email);
    if (!user) return;
    var sheet = getUsersSheet();
    var ts = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
    sheet.getRange(user.rowNum, 7).setValue(ts);
  } catch (ignore) {}
}


// ============================================================
// 3. AUTHENTICATION HANDLERS — STANDALONE FUNCTIONS
// ============================================================

/**
 * Standalone login handler. Verifies credentials against Users sheet + default admin.
 * Records the attempt in the Login sheet (success or failure).
 *
 * @param {Object} data — { email, password, device }
 * @returns {Object}    — { success, token, role, name, email, message }
 */
function handleLoginAction(data) {
  var email    = String(data.email    || "").trim().toLowerCase();
  var password = String(data.password || "");
  var device   = String(data.device   || "").trim();
  var ip       = "";
  try { ip = data.ip || ""; } catch (ignore) {}

  var action = "Login";
  var name   = "";
  var role   = "viewer";

  try {
    if (!email || !password) {
      throw new Error("Email and password are required.");
    }

    // DEFAULT ADMIN — sarvamtrustindia@gmail.com (editor role)
    var isAdmin = email === "sarvamtrustindia@gmail.com";
    var adminPasswords = ["Sarvam@Panner", "sarvam2025"];
    var adminAuthed = isAdmin && adminPasswords.indexOf(password) !== -1;

    if (adminAuthed) {
      name = "Sarvam Trust";
      role = "editor";
    } else {
      // Look up in Users sheet
      var user = findUserByEmail(email);
      if (!user) {
        throw new Error("No account found with this email.");
      }
      var hashedInput = simpleHash(password);
      if (hashedInput !== user.password && password !== user.password) {
        throw new Error("Incorrect password.");
      }
      name = user.name || email.split("@")[0];
      role = isAdmin ? "editor" : (user.role || "viewer");
      updateUserLastLogin(email);
    }

    var token = "sarvam-auth-" + Utilities.getUuid();

    recordLoginActivity({
      name:   name,
      email:  email,
      action: action,
      role:   role,
      device: device,
      ip:     ip,
      status: "Success"
    });

    return {
      success: true,
      token:   token,
      role:    role,
      name:    name,
      email:   email,
      message: "Login successful."
    };

  } catch (err) {
    recordLoginActivity({
      name:   name || email.split("@")[0],
      email:  email,
      action: action,
      role:   role,
      device: device,
      ip:     ip,
      status: "Failed"
    });
    return { success: false, message: err.message || "Login failed." };
  }
}


/**
 * Standalone signup handler. Creates a new user in the Users sheet.
 * Records the signup in the Login sheet. All new accounts are viewers by default.
 *
 * @param {Object} data — { name, email, password, role }
 * @returns {Object}    — { success, name, email, message }
 */
function handleSignupAction(data) {
  var name     = String(data.name     || "").trim();
  var email    = String(data.email    || "").trim().toLowerCase();
  var password = String(data.password || "");
  var role     = String(data.role     || "viewer").trim();
  var device   = String(data.device   || "").trim();
  var ip       = "";
  try { ip = data.ip || ""; } catch (ignore) {}

  try {
    if (!name)     throw new Error("Full name is required.");
    if (!email)    throw new Error("Email address is required.");
    if (email.indexOf("@") === -1) throw new Error("Please enter a valid email.");
    if (!password || password.length < 6) throw new Error("Password must be at least 6 characters.");

    if (email === "sarvamtrustindia@gmail.com") {
      throw new Error("This email is reserved. Please sign in instead.");
    }

    if (findUserByEmail(email)) {
      throw new Error("An account with this email already exists. Please sign in.");
    }

    var sheet       = getUsersSheet();
    var userId      = generateUserId(sheet);
    var hashedPwd   = simpleHash(password);
    var createdAt   = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");

    sheet.appendRow([userId, name, email, hashedPwd, role, createdAt, ""]);
    alignUsersSheet(sheet);

    recordLoginActivity({
      name:   name,
      email:  email,
      action: "Signup",
      role:   role,
      device: device,
      ip:     ip,
      status: "Success"
    });

    return {
      success: true,
      name:    name,
      email:   email,
      role:    role,
      message: "Account created successfully!"
    };

  } catch (err) {
    recordLoginActivity({
      name:   name || email.split("@")[0],
      email:  email,
      action: "Signup",
      role:   role,
      device: device,
      ip:     ip,
      status: "Failed"
    });
    return { success: false, message: err.message || "Signup failed." };
  }
}


// ============================================================
// 4. UPDATED doPost — routes login, signup, booking actions
// ============================================================
// NOTE: Keep the original doPost above and replace it with the one below,
//       or simply delete the original doPost function.

function doPostUpdated(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error("No data was received.");
    }

    var data = JSON.parse(e.postData.contents);
    var action = String(data.action || "");

    // ─── AUTH ACTIONS ────────────────────────────────
    if (action === "login") {
      var loginResult = handleLoginAction({
        email:    data.email,
        password: data.password,
        device:   data.device
      });
      return jsonResponse(loginResult);
    }

    if (action === "signup") {
      var signupResult = handleSignupAction({
        name:     data.name,
        email:    data.email,
        password: data.password,
        role:     data.role || "viewer",
        device:   data.device
      });
      return jsonResponse(signupResult);
    }

    if (action === "logout") {
      recordLoginActivity({
        name:   data.name || "",
        email:  data.email || "",
        action: "Logout",
        role:   data.role || "",
        device: data.device || "",
        status: "Success"
      });
      return jsonResponse({ success: true, message: "Logout recorded." });
    }

    // ─── BOOKING ACTION ──────────────────────────────
    delete data.bookingId;

    validateBooking(data);

    var sheet     = getBookingsSheet();
    var bookingId = generateNextId(sheet);

    sheet.appendRow([
      bookingId,
      formatDateDDMMYYYY(data.entryDate),
      String(data.sponsorName   || "").trim(),
      String(data.sponsorFor    || "").trim(),
      String(data.phone         || "").trim(),
      String(data.occasion      || "").trim(),
      formatDateDDMMYYYY(data.sponsorshipDate),
      String(data.foodSession   || "").trim(),
      Number(data.amount),
      String(data.place         || "").trim(),
      String(data.volunteer     || "").trim(),
      String(data.paymentStatus || "").trim(),
      formatDateTime(data.createdAt),
      String(data.notes         || "").trim()
    ]);

    alignBookingsSheet();

    try { refreshMonthView();    } catch (mvErr) { Logger.log("Month View (non-fatal): " + mvErr.message); }
    try { refreshSponsorSheet(); } catch (spErr) { Logger.log("Sponsor (non-fatal): "    + spErr.message); }

    return jsonResponse({ success: true, message: "Booking saved successfully.", bookingId: bookingId });

  } catch (err) {
    return jsonResponse({ success: false, message: err.message });
  }
}
function installTrigger() {
  // Delete any existing onEdit triggers first to avoid duplicates.
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "onBookingEdit") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  // Install a new onChange trigger.
  ScriptApp.newTrigger("onBookingEdit")
    .forSpreadsheet(SpreadsheetApp.openById(SPREADSHEET_ID))
    .onChange()
    .create();
  Logger.log("Trigger installed successfully.");
}

function onBookingEdit(e) {
  try {
    updateMonthView();
  } catch (err) {
    Logger.log("MonthView refresh error: " + err.message);
  }
  try {
    refreshSponsorSheet();
  } catch (err) {
    Logger.log("Sponsor refresh error: " + err.message);
  }
}
function onBookingChange(e) {
  if (!e) return;
  try {
    updateMonthView();
  } catch (err) {
    Logger.log("Month View refresh error: " + err.message);
  }
  try {
    refreshSponsorSheet();
  } catch (err) {
    Logger.log("Sponsor refresh error: " + err.message);
  }
}