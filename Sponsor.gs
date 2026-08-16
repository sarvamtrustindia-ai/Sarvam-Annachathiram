/**
 * ==========================================
 * SARVAM ANNA CHATHRAM
 * SPONSOR SHEET — Sponsor.gs
 *
 * Setup steps:
 * 1. Create a sheet named exactly "Sponsor" in your spreadsheet.
 * 2. Run setupSponsorSheet() once from the Apps Script editor.
 * 3. Run installChangeTrigger() once to enable deletion sync.
 *
 * Sponsor ID logic:
 *   - Each unique sponsor (name + phone) gets a permanent ID like SP001, SP002 ...
 *   - If the same sponsor books again, they keep the same Sponsor ID.
 *   - IDs are stored in the sheet itself (col A) so they never change on refresh.
 * ==========================================
 */

function setupSponsorSheet() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Sponsor");
  if (!sheet) {
    throw new Error('"Sponsor" sheet not found. Please create it manually first.');
  }
  installChangeTrigger();
  refreshSponsorSheet();
  Logger.log("SUCCESS: Sponsor sheet is ready.");
}

// ─────────────────────────────────────────────
// INSTALL onChange TRIGGER (run once)
// ─────────────────────────────────────────────

function installChangeTrigger() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Remove any existing onChange triggers to avoid duplicates
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "onChange") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  // Install a fresh one
  ScriptApp.newTrigger("onChange")
    .forSpreadsheet(ss)
    .onChange()
    .create();

  Logger.log("onChange trigger installed.");
}

// ─────────────────────────────────────────────
// ON EDIT — catches cell edits in Bookings
// ─────────────────────────────────────────────

function onEdit(e) {
  if (!e || !e.range) return;
  if (e.range.getSheet().getName() === "Bookings") {
    refreshSponsorSheet();
  }
}

// ─────────────────────────────────────────────
// ON CHANGE — catches row deletions/insertions
// Installed as an installable trigger via installChangeTrigger()
// ─────────────────────────────────────────────

function onChange(e) {
  if (!e) return;
  refreshSponsorSheet();
}

// ─────────────────────────────────────────────
// MAIN REFRESH FUNCTION
// ─────────────────────────────────────────────

function refreshSponsorSheet() {
  var ss           = SpreadsheetApp.getActiveSpreadsheet();
  var bookingSheet = ss.getSheetByName("Bookings");
  var sponsorSheet = ss.getSheetByName("Sponsor");

  if (!bookingSheet) { Logger.log("Bookings sheet not found."); return; }
  if (!sponsorSheet) { Logger.log("Sponsor sheet not found.");  return; }

  // ── Read existing Sponsor IDs already assigned ────────────────────────────
  // So that SP001 for "Suresh|9894255633" never changes between refreshes.
  var existingIdMap = {};   // key → "SP001"
  var maxExistingId = 0;

  var existingLastRow = sponsorSheet.getLastRow();
  if (existingLastRow > 1) {
    var existingData = sponsorSheet
      .getRange(2, 1, existingLastRow - 1, 2)
      .getValues();
    for (var e = 0; e < existingData.length; e++) {
      var exId  = String(existingData[e][0] || "").trim();  // col A — Sponsor ID
      var exKey = String(existingData[e][1] || "").trim();  // col B — hidden key
      if (exId && exKey) {
        existingIdMap[exKey] = exId;
        var num = parseInt(exId.replace("SP", ""), 10);
        if (!isNaN(num) && num > maxExistingId) maxExistingId = num;
      }
    }
  }

  // ── Read bookings ─────────────────────────────────────────────────────────
  var lastRow = bookingSheet.getLastRow();
  if (lastRow < 2) {
    // Clear and write headers only.
    sponsorSheet.clearContents();
    sponsorSheet.clearFormats();
    writeHeaders(sponsorSheet);
    Logger.log("No bookings found.");
    return;
  }

  var data = bookingSheet.getRange(2, 1, lastRow - 1, 11).getValues();

  // ── Build sponsor map ─────────────────────────────────────────────────────
  var sponsorMap = {};
  var keyOrder   = [];

  for (var i = 0; i < data.length; i++) {
    var row         = data[i];
    var sponsorName = String(row[2] || "").trim();  // col C
    var phone       = String(row[4] || "").trim();  // col E
    var rawDate     = row[6];                        // col G
    var amount      = Number(row[8]) || 0;           // col I

    if (!sponsorName) continue;

    var key    = sponsorName + "|" + phone;
    var parsed = parseDate(rawDate);

    if (!sponsorMap[key]) {
      keyOrder.push(key);
      sponsorMap[key] = {
        name:     sponsorName,
        phone:    phone,
        count:    0,
        lastDate: null,
        total:    0
      };
    }

    sponsorMap[key].count += 1;
    sponsorMap[key].total += amount;

    if (parsed) {
      if (!sponsorMap[key].lastDate || parsed > sponsorMap[key].lastDate) {
        sponsorMap[key].lastDate = parsed;
      }
    }
  }

  // ── Assign Sponsor IDs ────────────────────────────────────────────────────
  // Reuse existing IDs; assign new ones only for new sponsors.
  var nextId = maxExistingId;
  for (var k = 0; k < keyOrder.length; k++) {
    var key2 = keyOrder[k];
    if (!existingIdMap[key2]) {
      nextId += 1;
      var padded = "SP" + String(nextId).padStart(3, "0");
      existingIdMap[key2] = padded;
    }
  }

  // ── Build output rows ─────────────────────────────────────────────────────
  var outputRows = [];
  for (var j = 0; j < keyOrder.length; j++) {
    var k3      = keyOrder[j];
    var rec     = sponsorMap[k3];
    var sid     = existingIdMap[k3];
    var dateStr = rec.lastDate
      ? Utilities.formatDate(rec.lastDate, Session.getScriptTimeZone(), "dd/MM/yyyy")
      : "";
    outputRows.push([
      String(sid),          // col A — Sponsor ID
      String(k3),           // col B — hidden key (name|phone) used for ID persistence
      String(rec.name),     // col C — Sponsor Name
      String(rec.phone),    // col D — Phone
      String(rec.count),    // col E — Total Sponsorships
      String(dateStr),      // col F — Last Sponsored
      String(rec.total)     // col G — Total Amount
    ]);
  }

  // Sort by Sponsor ID so order is stable.
  outputRows.sort(function(a, b) {
    return a[0].localeCompare(b[0]);
  });

  // ── Clear and rewrite sheet ───────────────────────────────────────────────
  sponsorSheet.clearContents();
  sponsorSheet.clearFormats();
  writeHeaders(sponsorSheet);

  if (outputRows.length > 0) {
    var dataRange = sponsorSheet.getRange(2, 1, outputRows.length, 7);
    dataRange.setNumberFormat("@");
    dataRange.setValues(outputRows);

    // Hide col B (the key column) — it's internal only.
    sponsorSheet.hideColumns(2);
  }

  Logger.log("Sponsor sheet updated: " + outputRows.length + " sponsors.");
}

// ─────────────────────────────────────────────
// WRITE HEADERS
// ─────────────────────────────────────────────

function writeHeaders(sheet) {
  var headers = [
    "Sponsor ID",
    "Key",               // hidden column — used for ID persistence
    "Sponsor Name",
    "Phone",
    "Total Sponsorships",
    "Last Sponsored",
    "Total Amount"
  ];
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setNumberFormat("@");
  headerRange.setValues([headers]);
  headerRange.setFontWeight("bold");
  sheet.setFrozenRows(1);
}

// ─────────────────────────────────────────────
// DATE PARSER
// Handles: JS Date | dd/MM/yyyy | dd-MM-yyyy | yyyy-MM-dd
// ─────────────────────────────────────────────

function parseDate(value) {
  if (!value) return null;

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  var text = String(value).trim();
  if (!text) return null;

  var p, d;

  p = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (p) {
    d = new Date(Number(p[3]), Number(p[2]) - 1, Number(p[1]));
    return isNaN(d.getTime()) ? null : d;
  }

  p = text.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (p) {
    d = new Date(Number(p[3]), Number(p[2]) - 1, Number(p[1]));
    return isNaN(d.getTime()) ? null : d;
  }

  p = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (p) {
    d = new Date(Number(p[1]), Number(p[2]) - 1, Number(p[3]));
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}
