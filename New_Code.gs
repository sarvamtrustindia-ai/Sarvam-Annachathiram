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
    validateBooking(data); 

    var sheet = getBookingsSheet();
    var bookingIds = getExistingBookingIds(sheet); 

    if (bookingIds.has(String(data.bookingId))) { 
      throw new Error("This Booking ID already exists. Please try again."); 
    } 

    sheet.appendRow([ 
      data.bookingId, 
      normalizeDateForSheet(data.entryDate), 
      data.sponsorName, 
      data.sponsorFor, 
      data.phone, 
      data.occasion, 
      normalizeDateForSheet(data.sponsorshipDate),  // stored as dd-MM-yyyy
      data.foodSession, 
      Number(data.amount), 
      data.volunteer, 
      data.paymentStatus, 
      data.createdAt,
      String(data.notes || "").trim()
    ]); 

    try { 
      updateMonthView();   // defined in Month.gs
      updateCalendar();    // defined in Month.gs
    } catch (mvErr) { 
      Logger.log("Calendar update error (non-fatal): " + mvErr.message); 
    }

    return jsonResponse({ 
      success: true, 
      message: "Booking saved successfully.", 
      bookingId: data.bookingId 
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
    "bookingId","entryDate","sponsorName","sponsorFor","phone",
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
  var values  = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues(); 
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
      sponsorshipDate: normalizeDate(row[6]),   // always dd-MM-yyyy
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