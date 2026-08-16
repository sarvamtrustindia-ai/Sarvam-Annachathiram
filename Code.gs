/* 
  SARVAM ANNA CHATHRAM 
  GOOGLE APPS SCRIPT BACKEND 

  FIXES:
  1. Booking ID auto-generated as 001, 002, 003... (backend controls it)
  2. bookingId removed from required fields validation
  3. Ctrl+Z / Undo works — trigger changed from onChange to onEdit
  4. Sponsor sheet + Month View sync on every Add / Edit / Delete
  
  STEPS:
  1. Paste this code in Apps Script editor
  2. Update SPONSOR_SHEET and MONTH_SHEET names to match your sheet tab names exactly
  3. Run installTrigger ONCE from the editor
  4. Deploy as Web App (New version)
*/ 

const SPREADSHEET_ID = "13dxJ6h1BMjeGdXbU6UZNqHFrlVNO2JLczxkGBF2A6xE"; 
const SHEET_NAME     = "Bookings";
const SPONSOR_SHEET  = "Sponsor";    // ← change to your exact Sponsor sheet tab name
const MONTH_SHEET    = "Month View"; // ← change to your exact Month View sheet tab name

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
  "Volunteer", 
  "Payment Status", 
  "Created At", 
  "Notes" 
]; 

// ─────────────────────────────────────────────
// TRIGGER INSTALLER — Run ONCE from the editor
// Uses onEdit so Ctrl+Z / Undo keeps working
// ─────────────────────────────────────────────

function installTrigger() {
  var ss       = SpreadsheetApp.openById(SPREADSHEET_ID);
  var triggers = ScriptApp.getProjectTriggers();

  // Remove all old onBookingEdit / onBookingChange triggers
  for (var i = 0; i < triggers.length; i++) {
    var fn = triggers[i].getHandlerFunction();
    if (fn === "onBookingEdit" || fn === "onBookingChange") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  // Install fresh onEdit trigger (preserves Ctrl+Z / Undo)
  ScriptApp.newTrigger("onBookingEdit")
    .forSpreadsheet(ss)
    .onEdit()
    .create();

  Logger.log("installTrigger: onEdit trigger installed. Ctrl+Z will now work.");
}

// ─────────────────────────────────────────────
// onEdit TRIGGER
// Fires on every manual edit/delete in Bookings sheet only
// ─────────────────────────────────────────────

function onBookingEdit(e) {
  if (!e || !e.source) return;
  var sheet = e.source.getActiveSheet();
  if (sheet.getName() !== SHEET_NAME) return;

  try { refreshSponsorSheet(); } catch (err) { Logger.log("Sponsor refresh error: " + err.message); }
  try { updateMonthView();     } catch (err) { Logger.log("MonthView refresh error: " + err.message); }
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
    return jsonResponse({ success: true, message: "Sarvam Anna Chathram API is running." }); 
  } catch (error) { 
    return jsonResponse({ success: false, message: error.message }); 
  } 
} 

function doPost(e) { 
  try { 
    if (!e || !e.postData || !e.postData.contents) { 
      throw new Error("No booking data was received."); 
    } 

    var data = JSON.parse(e.postData.contents);

    // Strip any bookingId sent by frontend — backend always generates it
    delete data.bookingId;

    validateBooking(data); 

    var sheet     = getBookingsSheet();
    var bookingId = generateNextId(sheet);

    sheet.appendRow([ 
      bookingId,
      normalizeDateForSheet(data.entryDate), 
      data.sponsorName, 
      data.sponsorFor, 
      data.phone, 
      data.occasion, 
      normalizeDateForSheet(data.sponsorshipDate),
      data.foodSession, 
      Number(data.amount), 
      data.volunteer, 
      data.paymentStatus, 
      data.createdAt,
      String(data.notes || "").trim()
    ]); 

    try { updateMonthView();     } catch (mvErr) { Logger.log("Month view error (non-fatal): " + mvErr.message); }
    try { refreshSponsorSheet(); } catch (spErr) { Logger.log("Sponsor sheet error (non-fatal): " + spErr.message); }

    return jsonResponse({ 
      success:   true, 
      message:   "Booking saved successfully.", 
      bookingId: bookingId
    }); 

  } catch (error) { 
    return jsonResponse({ success: false, message: error.message }); 
  } 
}

// ─────────────────────────────────────────────
// BOOKING ID GENERATOR
// Scans existing IDs, finds highest number, returns next as 3-digit string
// e.g. 001, 002, 003 ...
// ─────────────────────────────────────────────

function generateNextId(sheet) {
  var year     = new Date().getFullYear();
  var lastRow  = sheet.getLastRow();
  var prefix   = "SAC-" + year + "-";

  if (lastRow < 2) return prefix + "001";

  var values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  var max = 0;

  for (var i = 0; i < values.length; i++) {
    var cell = String(values[i][0]).trim();
    // Extract the number part from SAC-2026-001 format
    var match = cell.match(/SAC-\d{4}-(\d+)$/);
    if (match) {
      var n = parseInt(match[1], 10);
      if (n > max) max = n;
    }
  }

  return prefix + String(max + 1).padStart(3, "0");
}
// ─────────────────────────────────────────────
// SPONSOR SHEET — full rebuild from Bookings
// Reflects every Add / Edit / Delete automatically
// ─────────────────────────────────────────────

function refreshSponsorSheet() {
  var ss           = SpreadsheetApp.openById(SPREADSHEET_ID);
  var bookingSheet = ss.getSheetByName(SHEET_NAME);
  var sponsorSheet = ss.getSheetByName(SPONSOR_SHEET);

  if (!bookingSheet) throw new Error("Bookings sheet not found.");
  if (!sponsorSheet) throw new Error('Sponsor sheet "' + SPONSOR_SHEET + '" not found. Update SPONSOR_SHEET name at the top of the script.');

  // Clear data rows only (keep header row 1)
  var sponsorLastRow = sponsorSheet.getLastRow();
  if (sponsorLastRow > 1) {
    sponsorSheet.getRange(2, 1, sponsorLastRow - 1, sponsorSheet.getLastColumn()).clearContent();
  }

  var lastRow = bookingSheet.getLastRow();
  if (lastRow < 2) return;

  var data        = bookingSheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  var sponsorRows = [];

  for (var i = 0; i < data.length; i++) {
    var r = data[i];
    if (!r[0] && !r[2]) continue; // Skip empty rows

    sponsorRows.push([
      r[0],                        // Booking ID
      r[2],                        // Sponsor Name
      r[3],                        // Sponsor For
      r[4],                        // Phone Number
      r[5],                        // Occasion
      normalizeDate(r[6]),         // Sponsorship Date
      r[7],                        // Food Session
      Number(r[8]) || 0,           // Sponsorship Amount
      r[10],                       // Payment Status
      r[9],                        // Volunteer
      String(r[12] || "").trim()   // Notes
    ]);
  }

  if (sponsorRows.length > 0) {
    sponsorSheet.getRange(2, 1, sponsorRows.length, sponsorRows[0].length).setValues(sponsorRows);
  }

  Logger.log("refreshSponsorSheet: " + sponsorRows.length + " rows written.");
}

// ─────────────────────────────────────────────
// MONTH VIEW — full rebuild from Bookings, sorted by Sponsorship Date
// ─────────────────────────────────────────────

function updateMonthView() {
  var ss           = SpreadsheetApp.openById(SPREADSHEET_ID);
  var bookingSheet = ss.getSheetByName(SHEET_NAME);
  var monthSheet   = ss.getSheetByName(MONTH_SHEET);

  if (!bookingSheet) throw new Error("Bookings sheet not found.");
  if (!monthSheet)   throw new Error('Month View sheet "' + MONTH_SHEET + '" not found. Update MONTH_SHEET name at the top of the script.');

  // Clear data rows only (keep header row 1)
  var monthLastRow = monthSheet.getLastRow();
  if (monthLastRow > 1) {
    monthSheet.getRange(2, 1, monthLastRow - 1, monthSheet.getLastColumn()).clearContent();
  }

  var lastRow = bookingSheet.getLastRow();
  if (lastRow < 2) return;

  var data      = bookingSheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  var monthRows = [];

  for (var i = 0; i < data.length; i++) {
    var r = data[i];
    if (!r[0] && !r[2]) continue; // Skip empty rows

    monthRows.push([
      normalizeDate(r[6]),  // Sponsorship Date
      r[0],                 // Booking ID
      r[2],                 // Sponsor Name
      r[7],                 // Food Session
      Number(r[8]) || 0,   // Sponsorship Amount
      r[10]                 // Payment Status
    ]);
  }

  // Sort ascending by Sponsorship Date
  monthRows.sort(function(a, b) {
    return toSortableDate(a[0]) < toSortableDate(b[0]) ? -1 : 1;
  });

  if (monthRows.length > 0) {
    monthSheet.getRange(2, 1, monthRows.length, monthRows[0].length).setValues(monthRows);
  }

  Logger.log("updateMonthView: " + monthRows.length + " rows written.");
}

// Converts dd-MM-yyyy to yyyy-MM-dd for correct date sorting
function toSortableDate(ddmmyyyy) {
  var p = String(ddmmyyyy).match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (p) return p[3] + "-" + p[2] + "-" + p[1];
  return ddmmyyyy;
}

// ─────────────────────────────────────────────
// MANUAL REFRESH — run from editor anytime to force-sync
// ─────────────────────────────────────────────

function manualRefreshAll() {
  try { refreshSponsorSheet(); Logger.log("Sponsor sheet refreshed OK."); }
  catch (e) { Logger.log("Sponsor error: " + e.message); }
  try { updateMonthView();     Logger.log("Month View refreshed OK."); }
  catch (e) { Logger.log("Month View error: " + e.message); }
}

// ─────────────────────────────────────────────
// SHEET HELPERS
// ─────────────────────────────────────────────

function getBookingsSheet() {
  if (!SPREADSHEET_ID || SPREADSHEET_ID === "PASTE_YOUR_GOOGLE_SHEET_ID_HERE") { 
    throw new Error("Google Sheet ID is not configured in Code.gs."); 
  }
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error('Sheet "' + SHEET_NAME + '" not found.');
  ensureHeaders(sheet);
  return sheet;
}

function ensureHeaders(sheet) { 
  if (!sheet) throw new Error("ensureHeaders: sheet is undefined.");
  var currentHeaders = sheet.getRange(1, 1, 1, HEADERS.length).getValues()[0]; 
  var needsHeaders   = false;
  for (var i = 0; i < HEADERS.length; i++) {
    if (currentHeaders[i] !== HEADERS[i]) { needsHeaders = true; break; }
  }
  if (needsHeaders) { 
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]); 
    sheet.setFrozenRows(1); 
  } 
}

// ─────────────────────────────────────────────
// DATE UTILITIES
// ─────────────────────────────────────────────

function normalizeDateForSheet(value) {
  if (value === undefined || value === null) return "";
  var text = String(value).trim();
  if (!text) return "";
  var p;
  p = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (p) return p[3] + "-" + p[2] + "-" + p[1];
  p = text.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (p) return text;
  p = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (p) return p[1] + "-" + p[2] + "-" + p[3];
  return text;
}

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
  if (p) return text;
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
  // bookingId is NOT required — backend generates it automatically
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
  if (!/^(Breakfast|Lunch|Dinner)$/.test(String(data.foodSession))) { 
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

function getRecentBookings() { 
  var sheet   = getBookingsSheet(); 
  var lastRow = sheet.getLastRow(); 
  if (lastRow < 2) return []; 
  var values  = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues(); 
  var bookings = [];
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    if (!row[0] && !row[2]) continue; // Skip empty rows
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
      volunteer:       row[9], 
      paymentStatus:   row[10], 
      createdAt:       normalizeDateTime(row[11]),
      notes:           String(row[12] || "")
    });
  }
  bookings.reverse();
  return bookings.slice(0, 100); 
} 

// ─────────────────────────────────────────────
// RESPONSE HELPER
// ─────────────────────────────────────────────

function jsonResponse(object) { 
  return ContentService 
    .createTextOutput(JSON.stringify(object)) 
    .setMimeType(ContentService.MimeType.JSON); 
}