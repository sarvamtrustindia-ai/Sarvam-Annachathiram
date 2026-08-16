/**
 * ==========================================
 * SARVAM ANNA CHATHRAM
 * MONTH VIEW — Month.gs
 *
 * Setup steps:
 * 1. Create a sheet named exactly "Month View" in your spreadsheet.
 * 2. Run setupMonthSheets() once from the Apps Script editor.
 * ==========================================
 */

// ─────────────────────────────────────────────
// Run this once after creating "Month View" manually.
// ─────────────────────────────────────────────
function setupMonthSheets() {
  Logger.log("Looking for Month View sheet...");
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var monthSheet = ss.getSheetByName("Month View");
  if (!monthSheet) {
    throw new Error('"Month View" sheet not found. Please create it manually first.');
  }
  Logger.log("Found: " + monthSheet.getName());
  setupMonthViewLayout(monthSheet);
  updateMonthView();
  Logger.log("SUCCESS: Month View is ready.");
}

// ─────────────────────────────────────────────
// MONTH VIEW LAYOUT
// ─────────────────────────────────────────────

function setupMonthViewLayout(sheet) {
  if (!sheet) {
    sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Month View");
  }
  if (!sheet) {
    throw new Error('"Month View" sheet not found. Please create it manually first.');
  }

  sheet.getRange("A2").setValue("Month");
  sheet.getRange("C2").setValue("Year");

  var months = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];
  var monthRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(months, true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange("B2").setDataValidation(monthRule);

  var currentYear = new Date().getFullYear();
  var years = [];
  for (var y = currentYear - 10; y <= currentYear + 10; y++) {
    years.push(String(y));
  }
  var yearRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(years, true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange("D2").setDataValidation(yearRule);

  var currentMonth = Utilities.formatDate(
    new Date(), Session.getScriptTimeZone(), "MMMM"
  );
  sheet.getRange("B2").setValue(currentMonth);
  sheet.getRange("D2").setValue(currentYear);

  sheet.getRange("A4:G4").setValues([
    ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]
  ]);
  sheet.getRange("A5:G10").clearContent().clearNote().setBackground("white");

  Logger.log("Month View layout written to: " + sheet.getName());
}

// ─────────────────────────────────────────────
// MONTH VIEW UPDATE
// ─────────────────────────────────────────────

function updateMonthView() {
  var ss            = SpreadsheetApp.getActiveSpreadsheet();
  var bookingSheet  = ss.getSheetByName("Bookings");
  var monthSheet    = ss.getSheetByName("Month View");

  if (!bookingSheet) {
    Logger.log("updateMonthView: Bookings sheet not found.");
    return;
  }
  if (!monthSheet) {
    Logger.log("updateMonthView: Month View sheet not found.");
    return;
  }

  var monthName     = monthSheet.getRange("B2").getDisplayValue().trim();
  var selectedMonth = getMonthIndex(monthName); // 0-based
  var selectedYear  = Number(monthSheet.getRange("D2").getValue());

  if (selectedMonth < 0 || selectedMonth > 11 || !selectedYear) {
    Logger.log("updateMonthView: Invalid month/year — " + monthName + " / " + selectedYear);
    return;
  }

  // Build blank calendar grid (6 rows x 7 cols).
  var firstDay       = new Date(selectedYear, selectedMonth, 1);
  var lastDay        = new Date(selectedYear, selectedMonth + 1, 0);
  var firstDayOfWeek = firstDay.getDay();
  var totalDays      = lastDay.getDate();

  var calendar = [];
  for (var r = 0; r < 6; r++) {
    calendar.push(["", "", "", "", "", "", ""]);
  }
  for (var day = 1; day <= totalDays; day++) {
    var pos = firstDayOfWeek + day - 1;
    calendar[Math.floor(pos / 7)][pos % 7] = day;
  }

  var gridRange = monthSheet.getRange("A5:G10");
  gridRange.setValues(calendar);
  gridRange.clearNote();
  gridRange.setBackground("white");

  // Overlay bookings.
  var lastRow = bookingSheet.getLastRow();
  if (lastRow < 2) return;

  var bookings = bookingSheet.getRange(2, 1, lastRow - 1, 11).getValues();

  for (var b = 0; b < bookings.length; b++) {
    var row         = bookings[b];
    var rawDate     = row[6];   // Sponsorship Date column
    var foodSession = String(row[7]  || "").trim();
    var sponsorName = String(row[2]  || "").trim();
    var sponsorFor  = String(row[3]  || "").trim();
    var amount      = Number(row[8]) || 0;
    var payment     = String(row[10] || "Pending").trim();

    var parsed = parseDateFromAny(rawDate);
    if (!parsed) continue;
    if (parsed.getFullYear() !== selectedYear)  continue;
    if (parsed.getMonth()    !== selectedMonth) continue;

    var d      = parsed.getDate();
    var p      = firstDayOfWeek + d - 1;
    var rowNum = Math.floor(p / 7) + 5;  // 1-based sheet row; grid starts at row 5
    var colNum = (p % 7) + 1;            // 1-based sheet column

    var cell     = monthSheet.getRange(rowNum, colNum);
    var existing = cell.getNote();
    var note     = existing ? existing + "\n------------------------\n" : "";
    note += "Food: "    + foodSession + "\n";
    note += "Sponsor: " + sponsorName + "\n";
    note += "For: "     + sponsorFor  + "\n";
    note += "Amount: ₹" + amount      + "\n";
    note += "Payment: " + payment;
    cell.setNote(note);

    if      (foodSession === "Breakfast") cell.setBackground("#C6EFCE");
    else if (foodSession === "Lunch")     cell.setBackground("#FFEB9C");
    else if (foodSession === "Dinner")    cell.setBackground("#F4CCCC");
  }
}

// ─────────────────────────────────────────────
// ON EDIT TRIGGER
// ─────────────────────────────────────────────

function onEdit(e) {
  var sheet = e.range.getSheet();
  var name  = sheet.getName();

  // Refresh Month View when Bookings is edited.
  if (name === "Bookings") {
    updateMonthView();
    return;
  }

  // Refresh Month View when month or year dropdown changes.
  if (name === "Month View") {
    var col = e.range.getColumn();
    var row = e.range.getRow();
    if (row === 2 && (col === 2 || col === 4)) {
      updateMonthView();
    }
  }
}

// ─────────────────────────────────────────────
// DATE UTILITIES
// ─────────────────────────────────────────────

/**
 * Accepts a JS Date object OR any of these strings:
 *   dd/MM/yyyy  |  dd-MM-yyyy  |  yyyy-MM-dd
 * Returns a JS Date, or null if unparseable.
 */
function parseDateFromAny(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  var text = String(value).trim();
  if (!text) return null;

  var parts, d;

  // dd/MM/yyyy
  parts = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (parts) {
    d = new Date(Number(parts[3]), Number(parts[2]) - 1, Number(parts[1]));
    return isNaN(d.getTime()) ? null : d;
  }

  // dd-MM-yyyy
  parts = text.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (parts) {
    d = new Date(Number(parts[3]), Number(parts[2]) - 1, Number(parts[1]));
    return isNaN(d.getTime()) ? null : d;
  }

  // yyyy-MM-dd
  parts = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (parts) {
    d = new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

function getMonthIndex(monthName) {
  var months = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];
  return months.indexOf(monthName); // -1 if not found → caught by caller
}
function onEdit(e) {
  // Only handle Month View dropdown changes here.
  // Bookings changes are handled by onBookingChange (installable trigger).
  var sheet = e.range.getSheet();
  var name  = sheet.getName();

  if (name === "Month View") {
    var col = e.range.getColumn();
    var row = e.range.getRow();
    if (row === 2 && (col === 2 || col === 4)) {
      updateMonthView();
    }
  }
}