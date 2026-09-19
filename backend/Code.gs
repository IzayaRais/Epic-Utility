/**
 * ============================================================================
 * Electrical Internal CAP Report - Production Google Apps Script Backend
 * ============================================================================
 * 
 * Architecture: ONE workbook per plant with date-wise tabs (YYYY-MM-DD)
 * 
 * Plant Workbooks:
 * - CIPL:    1Nui7xNg7OP8--Ngy_UPZE9Jkfn-3sN90UosJR-9Ms0o
 * - PGCL:    1PYH98QdeKzvj7gcNDwHzfNBsrxoD9CZhQhyVaXkHFls
 * - GTL:     1TuoTm37XEu-a9QznqFRccBnPsmINV99nOZfavt0boeA
 * - EGMCL 2: 1Ejx7YRY-QmoIzEFY6_KCC04b3celsrzDlshKDGTtN54
 * 
 * Master Data Google Sheet (Users, Logs, System_Config tabs):
 * - 1BT01JVkSxbYdJCuIwffxclGz_sW2e8cDAKpNyC3r28I
 * 
 * CAP Photo Root Folder:
 * - 146wZBm_yvNbEIXKfqrT-wXQnnbbfQ6_N
 */

const CONFIG = {
  MASTER_SPREADSHEET_ID: "1BT01JVkSxbYdJCuIwffxclGz_sW2e8cDAKpNyC3r28I",
  CAP_PHOTO_ROOT_FOLDER_ID: "146wZBm_yvNbEIXKfqrT-wXQnnbbfQ6_N",

  // One workbook per plant (memo §2.1, §3.1)
  PLANT_SPREADSHEETS: {
    "CIPL":    "1Nui7xNg7OP8--Ngy_UPZE9Jkfn-3sN90UosJR-9Ms0o",
    "PGCL":    "1PYH98QdeKzvj7gcNDwHzfNBsrxoD9CZhQhyVaXkHFls",
    "GTL":     "1TuoTm37XEu-a9QznqFRccBnPsmINV99nOZfavt0boeA",
    "EGMCL 2": "1Ejx7YRY-QmoIzEFY6_KCC04b3celsrzDlshKDGTtN54"
  },

  // Plant Drive folders for CAP photos
  PLANTS: {
    "EGMCL 2": "1cVlGvRf8ezIMEmMRzRjdSC2FanXbGcT7",
    "CIPL":    "13XyI1a5uFv2crHNhy-wYHI7i8jrP1X_6",
    "GTL":     "1T9mx0VPB6FtfKMlxDNJfY4ef44AbAof1",
    "PGCL":    "1qv7wsp1mk5MsNVkdbtZvu7WmMkNyimZl"
  },

  // Risk-to-deadline mapping (memo §8)
  RISK_DEADLINE_MAP: {
    "Priority 1": "7 Days",
    "Priority 2": "4 Days",
    "Priority 3": "3 Days"
  },

  TIMEZONE: "Asia/Dhaka",
  SESSION_TTL_SECONDS: 21600,

  // CAP Report A-K headers (Row 3 in each date tab)
  CAP_HEADERS: ["Sl", "Findings / Issues", "Recommendation", "Specific Location", "Risk Level", "General Location", "Pictorial Evidence", "Responsible", "Deadline", "Corrected Pictures", "Remarks"]
};

/**
 * ============================================================================
 * 1. ONE-CLICK INITIALIZATION & HEALTH CHECK
 * ============================================================================
 */
function setupMasterSpreadsheetAndFolders() {
  Logger.log("Starting CAP System Setup...");

  const ss = SpreadsheetApp.openById(CONFIG.MASTER_SPREADSHEET_ID);
  
  // 1. Users Sheet
  let usersSheet = ss.getSheetByName("Users");
  if (!usersSheet) {
    usersSheet = ss.insertSheet("Users");
    usersSheet.appendRow([
      "User ID", "Username", "Password Hash", "Name", "Role", "Plant", "Active", "Created At", "Last Login"
    ]);
    usersSheet.setFrozenRows(1);
    usersSheet.getRange("A1:I1").setFontWeight("bold").setBackground("#0078D4").setFontColor("#ffffff");
    
    usersSheet.appendRow(["USR-001", "admin", "admin123", "Central Utility Admin", "ADMIN", "ALL", true, new Date().toISOString(), ""]);
    usersSheet.appendRow(["USR-002", "cipl_user", "cipl123", "CIPL Field Inspector", "PLANT_USER", "CIPL", true, new Date().toISOString(), ""]);
    usersSheet.appendRow(["USR-003", "pgcl_user", "pgcl123", "PGCL Field Inspector", "PLANT_USER", "PGCL", true, new Date().toISOString(), ""]);
    usersSheet.appendRow(["USR-004", "gtl_user", "gtl123", "GTL Field Inspector", "PLANT_USER", "GTL", true, new Date().toISOString(), ""]);
    usersSheet.appendRow(["USR-005", "egmcl_user", "egmcl123", "EGMCL 2 Field Inspector", "PLANT_USER", "EGMCL 2", true, new Date().toISOString(), ""]);
    Logger.log("Users tab initialized.");
  }

  // 2. Logs Sheet
  let logsSheet = ss.getSheetByName("Logs");
  if (!logsSheet) {
    logsSheet = ss.insertSheet("Logs");
    logsSheet.appendRow([
      "Timestamp", "User", "Role", "Plant", "Action", "Report ID", "Record ID", "Status", "Message", "Device Info"
    ]);
    logsSheet.setFrozenRows(1);
    logsSheet.getRange("A1:J1").setFontWeight("bold").setBackground("#333333").setFontColor("#ffffff");
    Logger.log("Logs tab initialized.");
  }

  // 3. System_Config Sheet
  let configSheet = ss.getSheetByName("System_Config");
  if (!configSheet) {
    configSheet = ss.insertSheet("System_Config");
    configSheet.appendRow(["Key", "Value", "Description"]);
    configSheet.setFrozenRows(1);
    configSheet.getRange("A1:C1").setFontWeight("bold").setBackground("#005A9E").setFontColor("#ffffff");
    
    configSheet.appendRow(["MASTER_SPREADSHEET_ID", CONFIG.MASTER_SPREADSHEET_ID, "Master sheet holding Users and Logs"]);
    configSheet.appendRow(["CAP_PHOTO_ROOT_FOLDER_ID", CONFIG.CAP_PHOTO_ROOT_FOLDER_ID, "Root folder for 1:1 evidence photos"]);
    configSheet.appendRow(["TIMEZONE", CONFIG.TIMEZONE, "Official operating timezone"]);
    for (const [plant, sid] of Object.entries(CONFIG.PLANT_SPREADSHEETS)) {
      configSheet.appendRow(["PLANT_WORKBOOK_" + plant.replace(/\s+/g, "_").toUpperCase(), sid, "Workbook for " + plant]);
    }
    Logger.log("System_Config tab initialized.");
  }

  // 4. Verify Plant Workbooks & Drive Access
  try {
    for (const [plant, sheetId] of Object.entries(CONFIG.PLANT_SPREADSHEETS)) {
      const wb = SpreadsheetApp.openById(sheetId);
      Logger.log("Verified Plant Workbook: " + plant + " (" + wb.getName() + ")");
    }
    const photoFolder = DriveApp.getFolderById(CONFIG.CAP_PHOTO_ROOT_FOLDER_ID);
    Logger.log("Verified CAP Photo Folder: " + photoFolder.getName());
    for (const [plant, folderId] of Object.entries(CONFIG.PLANTS)) {
      const f = DriveApp.getFolderById(folderId);
      Logger.log("Verified Plant Drive Folder: " + plant + " (" + f.getName() + ")");
    }
  } catch (err) {
    Logger.log("Drive/Sheet Verification Note: " + err.message);
  }

  logEvent({
    user: "system_setup",
    role: "ADMIN",
    plant: "ALL",
    action: "SYSTEM_INITIALIZED",
    status: "SUCCESS",
    message: "Master sheets and plant workbooks configured successfully."
  });

  Logger.log("CAP System Setup Complete.");
}

/**
 * ============================================================================
 * 2. WEB API ENDPOINTS: doGet & doPost
 * ============================================================================
 */
function doGet(e) {
  return createJsonResponse({
    status: "online",
    service: "CAP Field Inspector Backend",
    version: "4.0.0",
    masterSpreadsheetId: CONFIG.MASTER_SPREADSHEET_ID,
    capPhotoRootFolderId: CONFIG.CAP_PHOTO_ROOT_FOLDER_ID,
    plants: Object.keys(CONFIG.PLANT_SPREADSHEETS),
    timestamp: new Date().toISOString()
  });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  
  try {
    lock.waitLock(30000);

    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({ error: "Empty request payload" }, 400);
    }

    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;

    switch (action) {
      case "ping":
        return createJsonResponse({ status: "ok", time: new Date().toISOString() });

      case "init_master_sheets":
        setupMasterSpreadsheetAndFolders();
        return createJsonResponse({ success: true, message: "Master sheets initialized." });

      case "auth_login":
        return handleAuthLogin(payload);

      case "auth_validate":
        return handleAuthValidate(payload);

      case "list_authorized_plants":
        return handleListAuthorizedPlants(payload);

      case "list_plant_reports":
        return handleListPlantReports(payload);

      case "ensure_plant_report":
        return handleEnsurePlantReport(payload);

      case "get_plant_report_info":
        return handleGetPlantReportInfo(payload);

      case "get_report_summary":
        return handleGetReportSummary(payload);

      case "create_finding":
        return handleCreateFinding(payload);

      case "upload_evidence":
        return handleUploadEvidence(payload);

      case "rectify_finding":
        return handleRectifyFinding(payload);

      case "sync_operation":
        return handleSyncOperation(payload);

      case "get_storage_locations":
        return handleGetStorageLocations(payload);

      case "write_log":
        return handleWriteLog(payload);

      default:
        return createJsonResponse({ error: "Unknown action: " + action }, 400);
    }

  } catch (err) {
    console.error("API Error:", err);
    return createJsonResponse({ error: err.message, stack: err.stack }, 500);
  } finally {
    try {
      lock.releaseLock();
    } catch (e) {}
  }
}

/**
 * ============================================================================
 * 3. AUTHENTICATION (Against Users sheet)
 * ============================================================================
 */
function handleAuthLogin(payload) {
  const username = (payload.username || "").trim();
  const password = (payload.password || "").trim();

  if (!username || !password) {
    return createJsonResponse({ error: "Username and password required." }, 400);
  }

  const ss = SpreadsheetApp.openById(CONFIG.MASTER_SPREADSHEET_ID);
  const usersSheet = ss.getSheetByName("Users");
  if (!usersSheet) {
    return createJsonResponse({ error: "Users sheet not initialized." }, 500);
  }

  const data = usersSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[1] == username && row[2] == password) {
      const active = row[6] === true || String(row[6]).toUpperCase() === "TRUE" || String(row[6]) === "1";
      if (!active) {
        logEvent({
          user: username,
          role: row[4],
          plant: row[5],
          action: "LOGIN_BLOCKED",
          status: "DENIED",
          message: "Disabled account attempted login."
        });
        return createJsonResponse({ error: "User account is disabled." }, 403);
      }

      usersSheet.getRange(i + 1, 9).setValue(new Date().toISOString());

      const user = {
        id: row[0],
        username: row[1],
        name: row[3],
        role: row[4],
        plant: normalizePlantName(row[5]) || row[5]
      };
      const sessionToken = createSessionToken(user);

      logEvent({
        user: username,
        role: row[4],
        plant: row[5],
        action: "LOGIN_SUCCESS",
        status: "SUCCESS",
        message: "User logged in successfully."
      });

      return createJsonResponse({
        success: true,
        user,
        sessionToken,
        expiresInSeconds: CONFIG.SESSION_TTL_SECONDS
      });
    }
  }

  logEvent({
    user: username,
    role: "UNKNOWN",
    plant: "UNKNOWN",
    action: "LOGIN_FAILED",
    status: "DENIED",
    message: "Invalid username or password."
  });

  return createJsonResponse({ error: "Invalid username or password." }, 401);
}

function handleAuthValidate(payload) {
  try {
    const session = validateSession(payload);
    return createJsonResponse({ success: true, valid: true, user: session });
  } catch (err) {
    return createJsonResponse({ success: false, valid: false, error: err.message });
  }
}

/**
 * ============================================================================
 * 3B. SESSION TOKENS & ROLE-BASED PLANT ACCESS
 * ============================================================================
 */
function getSessionSecret() {
  const props = PropertiesService.getScriptProperties();
  let secret = props.getProperty("CAP_SESSION_SECRET");
  if (!secret) {
    secret = Utilities.getUuid() + "-" + Utilities.getUuid();
    props.setProperty("CAP_SESSION_SECRET", secret);
  }
  return secret;
}

function createSessionToken(user) {
  const tokenPayload = {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    plant: user.plant,
    exp: Math.floor(Date.now() / 1000) + CONFIG.SESSION_TTL_SECONDS
  };
  const encodedPayload = Utilities.base64EncodeWebSafe(JSON.stringify(tokenPayload), Utilities.Charset.UTF_8);
  const signatureBytes = Utilities.computeHmacSha256Signature(encodedPayload, getSessionSecret());
  const encodedSignature = Utilities.base64EncodeWebSafe(signatureBytes);
  return encodedPayload + "." + encodedSignature;
}

function validateSession(payload) {
  const token = payload.sessionToken || "";
  const parts = token.split(".");
  if (parts.length !== 2) {
    throw new Error("Authentication required. Please sign in again.");
  }

  const expectedBytes = Utilities.computeHmacSha256Signature(parts[0], getSessionSecret());
  const expectedSignature = Utilities.base64EncodeWebSafe(expectedBytes);
  if (parts[1] !== expectedSignature) {
    throw new Error("Invalid session. Please sign in again.");
  }

  const json = Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString();
  const session = JSON.parse(json);
  if (!session.exp || session.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Session expired. Please sign in again.");
  }

  return getActiveUserFromMaster(session.username);
}

function getActiveUserFromMaster(username) {
  const ss = SpreadsheetApp.openById(CONFIG.MASTER_SPREADSHEET_ID);
  const usersSheet = ss.getSheetByName("Users");
  if (!usersSheet) {
    throw new Error("Users sheet not initialized.");
  }

  const data = usersSheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (String(row[1] || "").trim() === username) {
      const active = row[6] === true || String(row[6]).toUpperCase() === "TRUE" || String(row[6]) === "1";
      if (!active) {
        throw new Error("User account is disabled.");
      }
      return {
        id: row[0],
        username: row[1],
        name: row[3],
        role: row[4],
        plant: normalizePlantName(row[5]) || row[5]
      };
    }
  }

  throw new Error("User account no longer exists.");
}

function normalizePlantName(plant) {
  const raw = String(plant || "").trim();
  if (!raw) return "";
  if (CONFIG.PLANT_SPREADSHEETS[raw] || raw === "ALL") return raw;

  const canonical = raw.toUpperCase().replace(/\s+/g, " ");
  if (canonical === "CIPL") return "CIPL";
  if (canonical === "PGCL") return "PGCL";
  if (canonical === "GTL") return "GTL";
  if (canonical === "EGMCL 2" || canonical === "EGMCL2" || canonical === "EGMCL-2" || canonical === "ETMCL 2") {
    return "EGMCL 2";
  }

  for (const key of Object.keys(CONFIG.PLANT_SPREADSHEETS)) {
    if (key.toUpperCase() === canonical) return key;
  }
  return "";
}

function resolveAuthorizedPlant(payload, session) {
  const requestedPlant = normalizePlantName(payload.plant);

  if (session.role === "ADMIN") {
    if (!requestedPlant || !CONFIG.PLANT_SPREADSHEETS[requestedPlant]) {
      throw new Error("Invalid plant: " + (payload.plant || ""));
    }
    return requestedPlant;
  }

  if (session.role !== "PLANT_USER") {
    throw new Error("Unauthorized role: " + session.role);
  }

  const assignedPlant = normalizePlantName(session.plant);
  if (!assignedPlant || !CONFIG.PLANT_SPREADSHEETS[assignedPlant]) {
    throw new Error("User is not assigned to a valid plant.");
  }

  if (requestedPlant && requestedPlant !== assignedPlant) {
    logEvent({
      user: session.username,
      role: session.role,
      plant: assignedPlant,
      action: "PLANT_ACCESS_DENIED",
      status: "DENIED",
      message: "Requested unauthorized plant: " + requestedPlant
    });
    throw new Error("Access denied for plant: " + requestedPlant);
  }

  return assignedPlant;
}

/**
 * Require ADMIN role or throw
 */
function requireAdmin(session) {
  if (session.role !== "ADMIN") {
    throw new Error("This action requires ADMIN privileges.");
  }
}

/**
 * ============================================================================
 * 4. PLANT WORKBOOK HELPERS (One workbook per plant, date-wise tabs)
 * ============================================================================
 */

/**
 * Open the plant workbook by plant name
 */
function openPlantWorkbook(plant) {
  const sheetId = CONFIG.PLANT_SPREADSHEETS[plant];
  if (!sheetId) {
    throw new Error("No workbook configured for plant: " + plant);
  }
  return SpreadsheetApp.openById(sheetId);
}

/**
 * Get or create a date tab in the plant workbook (idempotent, memo §3.4)
 * Tab name format: YYYY-MM-DD
 */
function ensureDateTab(workbook, reportDate, plant) {
  let tab = workbook.getSheetByName(reportDate);
  if (tab) {
    return { tab, created: false };
  }

  // Create new date tab
  tab = workbook.insertSheet(reportDate);

  // Row 1: Title
  tab.getRange("A1").setValue(plant + " - Electrical Internal CAP Report");
  tab.getRange("A1:K1").merge().setFontWeight("bold").setFontSize(12)
    .setBackground("#002060").setFontColor("#ffffff").setHorizontalAlignment("center");

  // Row 2: Metadata
  tab.getRange("A2").setValue("Unit:");
  tab.getRange("B2").setValue(plant);
  tab.getRange("B2").setFontWeight("bold");
  tab.getRange("I2").setValue("Date:");
  tab.getRange("J2").setValue(reportDate);
  tab.getRange("J2").setFontWeight("bold");
  tab.getRange("A2:K2").setBackground("#E8F0FE");

  // Row 3: Column Headers (A-K per memo §7)
  const headers = CONFIG.CAP_HEADERS;
  for (let c = 0; c < headers.length; c++) {
    tab.getRange(3, c + 1).setValue(headers[c]);
  }
  tab.getRange("A3:K3").setFontWeight("bold").setBackground("#0078D4").setFontColor("#ffffff")
    .setHorizontalAlignment("center").setVerticalAlignment("middle");
  tab.setFrozenRows(3);

  // Set column widths for readability
  tab.setColumnWidth(1, 40);   // A: Sl
  tab.setColumnWidth(2, 220);  // B: Findings
  tab.setColumnWidth(3, 200);  // C: Recommendation
  tab.setColumnWidth(4, 150);  // D: Specific Location
  tab.setColumnWidth(5, 90);   // E: Risk Level
  tab.setColumnWidth(6, 100);  // F: General Location
  tab.setColumnWidth(7, 130);  // G: Pictorial Evidence
  tab.setColumnWidth(8, 110);  // H: Responsible
  tab.setColumnWidth(9, 80);   // I: Deadline
  tab.setColumnWidth(10, 130); // J: Corrected Pictures
  tab.setColumnWidth(11, 100); // K: Remarks

  return { tab, created: true };
}

/**
 * Ensure the SUMMARY tab exists and is updated
 */
function ensureSummaryTab(workbook, plant) {
  let summary = workbook.getSheetByName("SUMMARY");
  if (!summary) {
    summary = workbook.insertSheet("SUMMARY", 0);

    summary.getRange("A1").setValue(plant + " - CAP Report Summary");
    summary.getRange("A1:G1").merge().setFontWeight("bold").setFontSize(14)
      .setBackground("#002060").setFontColor("#ffffff").setHorizontalAlignment("center");

    summary.getRange("A2").setValue("Plant:");
    summary.getRange("B2").setValue(plant);
    summary.getRange("B2").setFontWeight("bold");

    // Header row
    const summHeaders = ["Date", "Total", "P1", "P2", "P3", "Rectified", "Not Rectified"];
    for (let c = 0; c < summHeaders.length; c++) {
      summary.getRange(4, c + 1).setValue(summHeaders[c]);
    }
    summary.getRange("A4:G4").setFontWeight("bold").setBackground("#0078D4").setFontColor("#ffffff")
      .setHorizontalAlignment("center");
    summary.setFrozenRows(4);

    summary.setColumnWidth(1, 120);
    summary.setColumnWidth(2, 70);
    summary.setColumnWidth(3, 60);
    summary.setColumnWidth(4, 60);
    summary.setColumnWidth(5, 60);
    summary.setColumnWidth(6, 80);
    summary.setColumnWidth(7, 100);
  }

  return summary;
}

/**
 * Refresh SUMMARY tab with data from all date tabs
 */
function refreshSummaryTab(workbook, plant) {
  const summary = ensureSummaryTab(workbook, plant);

  // Clear existing data rows (Row 5+)
  const lastRow = summary.getLastRow();
  if (lastRow >= 5) {
    summary.getRange(5, 1, lastRow - 4, 7).clearContent();
  }

  // Gather all date tabs
  const sheets = workbook.getSheets();
  const dateSheets = [];
  for (const s of sheets) {
    const name = s.getName();
    if (name === "SUMMARY") continue;
    // Validate it looks like a date tab YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(name)) {
      dateSheets.push(s);
    }
  }

  // Sort descending
  dateSheets.sort((a, b) => b.getName().localeCompare(a.getName()));

  let grandTotal = 0, grandP1 = 0, grandP2 = 0, grandP3 = 0, grandRect = 0, grandNotRect = 0;

  for (let i = 0; i < dateSheets.length; i++) {
    const ds = dateSheets[i];
    const dateName = ds.getName();
    const lr = ds.getLastRow();

    let total = 0, p1 = 0, p2 = 0, p3 = 0, rect = 0, notRect = 0;

    if (lr >= 4) {
      const values = ds.getRange(4, 1, lr - 3, 11).getValues();
      for (const row of values) {
        if (!row[0] && !row[1]) continue;
        total++;
        const risk = String(row[4] || "").trim();
        if (risk === "Priority 1") p1++;
        else if (risk === "Priority 3") p3++;
        else p2++;

        const remarks = String(row[10] || "").toLowerCase();
        if (remarks.indexOf("rectified") !== -1 && remarks.indexOf("not") === -1) {
          rect++;
        } else {
          notRect++;
        }
      }
    }

    const rowIdx = 5 + i;
    summary.getRange(rowIdx, 1).setValue(dateName);
    summary.getRange(rowIdx, 2).setValue(total);
    summary.getRange(rowIdx, 3).setValue(p1);
    summary.getRange(rowIdx, 4).setValue(p2);
    summary.getRange(rowIdx, 5).setValue(p3);
    summary.getRange(rowIdx, 6).setValue(rect);
    summary.getRange(rowIdx, 7).setValue(notRect);

    grandTotal += total;
    grandP1 += p1;
    grandP2 += p2;
    grandP3 += p3;
    grandRect += rect;
    grandNotRect += notRect;
  }

  // Overall totals in Row 3
  summary.getRange("A3").setValue("OVERALL");
  summary.getRange("B3").setValue(grandTotal);
  summary.getRange("C3").setValue(grandP1);
  summary.getRange("D3").setValue(grandP2);
  summary.getRange("E3").setValue(grandP3);
  summary.getRange("F3").setValue(grandRect);
  summary.getRange("G3").setValue(grandNotRect);
  summary.getRange("A3:G3").setFontWeight("bold").setBackground("#E8F0FE");
}

/**
 * ============================================================================
 * 5. ENSURE PLANT REPORT (Create/reuse date tab, memo §3.4)
 * ============================================================================
 */
function handleEnsurePlantReport(payload) {
  const session = validateSession(payload);
  requireAdmin(session);
  const plant = resolveAuthorizedPlant(payload, session);
  const reportDate = payload.reportDate || Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd");

  const workbook = openPlantWorkbook(plant);
  const result = ensureDateTab(workbook, reportDate, plant);

  // Ensure SUMMARY exists
  ensureSummaryTab(workbook, plant);

  logEvent({
    user: session.username,
    role: session.role,
    plant,
    action: result.created ? "REPORT_CREATED" : "REPORT_OPENED",
    reportId: reportDate,
    status: "SUCCESS",
    message: workbook.getName() + " / " + reportDate
  });

  return createJsonResponse({
    success: true,
    plant,
    reportDate,
    created: result.created,
    id: workbook.getId(),
    name: plant + " - Electrical Internal CAP Report - " + reportDate,
    url: workbook.getUrl() + "#gid=" + result.tab.getSheetId(),
    sheetName: reportDate
  });
}

/**
 * ============================================================================
 * 6. LIST ALL DATE-WISE CAP REPORTS FOR A PLANT (Tabs in workbook)
 * ============================================================================
 */
function handleListPlantReports(payload) {
  const session = validateSession(payload);
  const plant = resolveAuthorizedPlant(payload, session);

  const workbook = openPlantWorkbook(plant);
  const sheets = workbook.getSheets();
  const reports = [];

  for (const s of sheets) {
    const name = s.getName();
    if (name === "SUMMARY") continue;
    // Accept YYYY-MM-DD format tabs
    if (!/^\d{4}-\d{2}-\d{2}$/.test(name)) continue;

    let totalObs = 0, rectifiedCount = 0, p1 = 0, p2 = 0, p3 = 0;
    const lr = s.getLastRow();

    if (lr >= 4) {
      const values = s.getRange(4, 1, lr - 3, 11).getValues();
      for (const row of values) {
        if (!row[0] && !row[1]) continue;
        totalObs++;
        const risk = String(row[4] || "").trim();
        if (risk === "Priority 1") p1++;
        else if (risk === "Priority 3") p3++;
        else p2++;

        const rem = String(row[10] || "").toLowerCase();
        if (rem.indexOf("rectified") !== -1 && rem.indexOf("not") === -1) {
          rectifiedCount++;
        }
      }
    }

    reports.push({
      id: workbook.getId() + "_" + name,
      name: plant + " - Electrical Internal CAP Report - " + name,
      url: workbook.getUrl() + "#gid=" + s.getSheetId(),
      reportDate: name,
      totalObservations: totalObs,
      rectifiedCount: rectifiedCount,
      pendingCount: Math.max(0, totalObs - rectifiedCount),
      p1: p1,
      p2: p2,
      p3: p3
    });
  }

  reports.sort((a, b) => (b.reportDate || "").localeCompare(a.reportDate || ""));

  return createJsonResponse({
    success: true,
    plant,
    reports
  });
}

/**
 * ============================================================================
 * 7. LIST AUTHORIZED PLANTS
 * ============================================================================
 */
function handleListAuthorizedPlants(payload) {
  const session = validateSession(payload);

  if (session.role === "ADMIN") {
    return createJsonResponse({
      success: true,
      plants: Object.keys(CONFIG.PLANT_SPREADSHEETS)
    });
  }

  const assignedPlant = normalizePlantName(session.plant);
  if (assignedPlant && CONFIG.PLANT_SPREADSHEETS[assignedPlant]) {
    return createJsonResponse({
      success: true,
      plants: [assignedPlant]
    });
  }

  return createJsonResponse({ success: true, plants: [] });
}

/**
 * ============================================================================
 * 8. FETCH PLANT REPORT OBSERVATIONS (Read from date tab)
 * ============================================================================
 */
function handleGetPlantReportInfo(payload) {
  const session = validateSession(payload);
  const plant = resolveAuthorizedPlant(payload, session);
  const reportDate = payload.reportDate || Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd");

  const workbook = openPlantWorkbook(plant);
  const tab = workbook.getSheetByName(reportDate);

  if (!tab) {
    return createJsonResponse({
      found: false,
      plant,
      reportDate,
      sheetUrl: workbook.getUrl(),
      observations: []
    });
  }

  const lastRow = tab.getLastRow();
  const observations = [];

  if (lastRow >= 4) {
    const values = tab.getRange(4, 1, lastRow - 3, 11).getValues();
    const formulas = tab.getRange(4, 1, lastRow - 3, 11).getFormulas();

    for (let i = 0; i < values.length; i++) {
      const rowVal = values[i];
      const rowForm = formulas[i];
      if (!rowVal[0] && !rowVal[1]) continue;

      const serialNum = String(i + 1).padStart(3, '0');
      
      // Extract URL from HYPERLINK formula if present
      let pictorialEvidenceUrl = "";
      const formulaG = rowForm[6] || "";
      const matchG = formulaG.match(/HYPERLINK\("([^"]+)"/i);
      if (matchG) {
        pictorialEvidenceUrl = matchG[1];
      }

      let correctedPictureUrl = "";
      const formulaJ = rowForm[9] || "";
      const matchJ = formulaJ.match(/HYPERLINK\("([^"]+)"/i);
      if (matchJ) {
        correctedPictureUrl = matchJ[1];
      }

      observations.push({
        serial: serialNum,
        rowNumber: i + 4,
        finding: rowVal[1] || "",
        recommendation: rowVal[2] || "",
        location: rowVal[3] || "",
        riskLevel: rowVal[4] || "",
        generalLocation: rowVal[5] || plant,
        pictorialEvidenceUrl,
        responsible: rowVal[7] || "",
        deadline: rowVal[8] || "",
        correctedPictureUrl,
        remarks: rowVal[10] || "Not Rectified"
      });
    }
  }

  return createJsonResponse({
    found: true,
    plant,
    reportDate,
    sheetUrl: workbook.getUrl() + "#gid=" + tab.getSheetId(),
    sheetName: reportDate,
    observations
  });
}

/**
 * ============================================================================
 * 9. GET REPORT SUMMARY (from SUMMARY tab)
 * ============================================================================
 */
function handleGetReportSummary(payload) {
  const session = validateSession(payload);
  const plant = resolveAuthorizedPlant(payload, session);

  const workbook = openPlantWorkbook(plant);
  refreshSummaryTab(workbook, plant);

  const summary = workbook.getSheetByName("SUMMARY");
  const result = {
    success: true,
    plant,
    overall: { total: 0, p1: 0, p2: 0, p3: 0, rectified: 0, notRectified: 0 },
    dates: []
  };

  if (summary) {
    // Row 3: overall
    const overall = summary.getRange("A3:G3").getValues()[0];
    result.overall = {
      total: overall[1] || 0,
      p1: overall[2] || 0,
      p2: overall[3] || 0,
      p3: overall[4] || 0,
      rectified: overall[5] || 0,
      notRectified: overall[6] || 0
    };

    // Row 5+: date rows
    const lr = summary.getLastRow();
    if (lr >= 5) {
      const rows = summary.getRange(5, 1, lr - 4, 7).getValues();
      for (const r of rows) {
        if (!r[0]) continue;
        result.dates.push({
          date: r[0],
          total: r[1] || 0,
          p1: r[2] || 0,
          p2: r[3] || 0,
          p3: r[4] || 0,
          rectified: r[5] || 0,
          notRectified: r[6] || 0
        });
      }
    }
  }

  return createJsonResponse(result);
}

/**
 * ============================================================================
 * 10. CREATE FINDING (ADMIN only, memo §8)
 * ============================================================================
 */
function handleCreateFinding(payload) {
  const session = validateSession(payload);
  requireAdmin(session);
  const plant = resolveAuthorizedPlant(payload, session);
  const reportDate = payload.reportDate || Utilities.formatDate(new Date(), CONFIG.TIMEZONE, "yyyy-MM-dd");

  const clientOperationId = payload.clientOperationId || "";

  // Idempotency check
  if (clientOperationId) {
    const existing = checkIdempotency(clientOperationId);
    if (existing) {
      return createJsonResponse({
        success: true,
        idempotentDuplicate: true,
        message: "Previously processed.",
        serial: existing.serial
      });
    }
  }

  const workbook = openPlantWorkbook(plant);
  const { tab } = ensureDateTab(workbook, reportDate, plant);

  // Find next empty row (Row 4+)
  const lastRow = tab.getLastRow();
  const targetRow = Math.max(4, lastRow + 1);
  const serialNumber = targetRow - 3;
  const serialStr = String(serialNumber).padStart(3, '0');

  const finding = payload.finding || "";
  const recommendation = payload.recommendation || "Immediate rectification required as per electrical safety standard";
  const location = payload.specificLocation || payload.location || "";
  const riskLevel = payload.riskLevel || "Priority 2";
  const deadline = CONFIG.RISK_DEADLINE_MAP[riskLevel] || "7 Days";

  // Write A-K
  tab.getRange(targetRow, 1).setFormula("=ROW()-3");  // A: Sl
  tab.getRange(targetRow, 2).setValue(finding);         // B: Findings
  tab.getRange(targetRow, 3).setValue(recommendation);  // C: Recommendation
  tab.getRange(targetRow, 4).setValue(location);         // D: Specific Location
  tab.getRange(targetRow, 5).setValue(riskLevel);        // E: Risk Level
  tab.getRange(targetRow, 6).setValue(plant);            // F: General Location
  // G: Pictorial Evidence - will be set by upload_evidence
  tab.getRange(targetRow, 8).setValue("Utility In-Charge");  // H: Responsible
  tab.getRange(targetRow, 9).setValue(deadline);              // I: Deadline
  // J: Corrected Pictures - empty initially
  tab.getRange(targetRow, 11).setValue("Not Rectified");     // K: Remarks

  tab.setRowHeight(targetRow, 115);

  // Log
  logEvent({
    user: session.username,
    role: session.role,
    plant,
    action: "FINDING_CREATED",
    reportId: reportDate,
    recordId: clientOperationId || serialStr,
    status: "SUCCESS",
    message: "Serial " + serialStr + ": " + finding
  });

  // Refresh summary
  try {
    refreshSummaryTab(workbook, plant);
  } catch (e) {
    console.warn("Summary refresh error:", e);
  }

  return createJsonResponse({
    success: true,
    plant,
    reportDate,
    serial: serialStr,
    rowNumber: targetRow,
    finding,
    recommendation,
    location,
    riskLevel,
    deadline,
    remarks: "Not Rectified"
  });
}

/**
 * ============================================================================
 * 11. UPLOAD EVIDENCE (Photo to Drive + Sheet cell)
 * ============================================================================
 */
function handleUploadEvidence(payload) {
  const session = validateSession(payload);
  const plant = resolveAuthorizedPlant(payload, session);

  // ADMIN-only for ORIGINAL photos (memo §8, §10)
  if (payload.photoType === "ORIGINAL") {
    requireAdmin(session);
  }
  // PLANT_USER can upload CORRECTED photos for rectification (memo §10)

  const {
    idempotencyKey,
    clientOperationId,
    reportDate,
    serial,
    findings,
    location,
    recommendation,
    riskLevel,
    captureTimestamp,
    photoType,
    correctionSequence,
    filename,
    base64Data
  } = payload;

  if (!base64Data) {
    return createJsonResponse({ error: "Missing image base64 data" }, 400);
  }

  // Idempotency Check
  const opId = clientOperationId || idempotencyKey || "";
  if (opId) {
    const existing = checkIdempotency(opId);
    if (existing) {
      return createJsonResponse({
        success: true,
        idempotentDuplicate: true,
        message: "Previously processed. Returning stored record.",
        driveFileId: existing.driveFileId,
        serial
      });
    }
  }

  // Drive Photo Hierarchy: Root -> {Plant} -> {YYYY-MM-DD}
  const rootCapFolder = DriveApp.getFolderById(CONFIG.CAP_PHOTO_ROOT_FOLDER_ID);
  const plantFolder = getOrCreateSubfolder(rootCapFolder, plant);
  const dateFolder = getOrCreateSubfolder(plantFolder, reportDate);

  // Save image to Drive
  let driveFile;
  const existingFiles = dateFolder.getFilesByName(filename);

  if (existingFiles.hasNext()) {
    driveFile = existingFiles.next();
  } else {
    const cleanBase64 = base64Data.replace(/^data:image\/(jpeg|png|jpg);base64,/, "");
    const decodedBytes = Utilities.base64Decode(cleanBase64);
    const blob = Utilities.newBlob(decodedBytes, "image/jpeg", filename);
    driveFile = dateFolder.createFile(blob);

    try {
      driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (e) {
      console.warn("Could not set view permissions:", e);
    }
  }

  const driveFileId = driveFile.getId();
  const driveFileUrl = "https://drive.google.com/file/d/" + driveFileId + "/view?usp=sharing";
  const directThumbnailUrl = "https://drive.google.com/thumbnail?id=" + driveFileId + "&sz=w400";

  // Update the date tab in the plant workbook
  let sheetResult = { success: false };
  try {
    sheetResult = writeEvidenceToDateTab({
      plant,
      reportDate,
      serial,
      findings,
      location,
      recommendation: recommendation || "Immediate rectification required as per electrical safety standard",
      riskLevel: riskLevel || "Priority 2",
      captureTimestamp,
      photoType,
      correctionSequence,
      driveFileUrl,
      directThumbnailUrl,
      filename
    });
  } catch (sheetErr) {
    console.error("CAP Sheet update error:", sheetErr);
  }

  // Log
  logEvent({
    user: session.username,
    role: session.role,
    plant,
    action: photoType === "CORRECTED" ? "CORRECTED_PHOTO_UPLOADED" : "ORIGINAL_PHOTO_UPLOADED",
    reportId: reportDate,
    recordId: opId || filename,
    status: "SUCCESS",
    message: driveFileId
  });

  // Refresh summary
  try {
    const workbook = openPlantWorkbook(plant);
    refreshSummaryTab(workbook, plant);
  } catch (e) {
    console.warn("Summary refresh error:", e);
  }

  return createJsonResponse({
    success: true,
    driveFileId,
    driveFileUrl,
    filename,
    serial,
    reportUpdateSuccess: sheetResult.success,
    sheetUrl: sheetResult.sheetUrl,
    sheetName: sheetResult.sheetName,
    timestamp: new Date().toISOString()
  });
}

/**
 * Write evidence photo reference to the date tab in the plant workbook
 */
function writeEvidenceToDateTab(params) {
  const {
    plant,
    reportDate,
    serial,
    findings,
    location,
    recommendation,
    riskLevel,
    captureTimestamp,
    photoType,
    correctionSequence,
    driveFileUrl,
    directThumbnailUrl,
    filename
  } = params;

  const workbook = openPlantWorkbook(plant);
  const { tab } = ensureDateTab(workbook, reportDate, plant);

  const serialNumber = parseInt(serial, 10) || 1;

  // Find row by serial or calculate directly: Row 4 = Serial 1
  let targetRowIndex = -1;
  const maxSearchRows = Math.max(20, tab.getLastRow());

  if (maxSearchRows >= 4) {
    const data = tab.getRange(4, 1, maxSearchRows - 3, 2).getValues();
    for (let i = 0; i < data.length; i++) {
      const valA = data[i][0];
      if (String(valA) === String(serialNumber) || (i + 1) === serialNumber) {
        if (data[i][1] || String(valA) === String(serialNumber)) {
          targetRowIndex = i + 4;
          break;
        }
      }
    }
  }

  if (targetRowIndex === -1) {
    targetRowIndex = 3 + serialNumber;
  }

  const inCellImageFormula = '=HYPERLINK("' + driveFileUrl + '", IMAGE("' + directThumbnailUrl + '", 1))';

  tab.setRowHeight(targetRowIndex, 115);

  if (photoType === "ORIGINAL") {
    tab.getRange(targetRowIndex, 1).setFormula("=ROW()-3");       // A: Sl
    tab.getRange(targetRowIndex, 2).setValue(findings);             // B: Findings
    tab.getRange(targetRowIndex, 3).setValue(recommendation);       // C: Recommendation
    tab.getRange(targetRowIndex, 4).setValue(location);             // D: Specific Location
    tab.getRange(targetRowIndex, 5).setValue(riskLevel);            // E: Risk Level
    tab.getRange(targetRowIndex, 6).setValue(plant);                // F: General Location
    tab.getRange(targetRowIndex, 7).setFormula(inCellImageFormula); // G: Pictorial Evidence

    if (!tab.getRange(targetRowIndex, 8).getValue()) {
      tab.getRange(targetRowIndex, 8).setValue("Utility In-Charge"); // H: Responsible
    }
    if (!tab.getRange(targetRowIndex, 9).getValue()) {
      tab.getRange(targetRowIndex, 9).setValue(CONFIG.RISK_DEADLINE_MAP[riskLevel] || "7 Days"); // I: Deadline
    }

    tab.getRange(targetRowIndex, 11).setValue("Not Rectified");    // K: Remarks

  } else {
    // CORRECTED PHOTO
    tab.getRange(targetRowIndex, 10).setFormula(inCellImageFormula); // J: Corrected Pictures
    tab.getRange(targetRowIndex, 11).setValue("Rectified");          // K: Remarks
  }

  return {
    success: true,
    sheetId: workbook.getId(),
    sheetUrl: workbook.getUrl() + "#gid=" + tab.getSheetId(),
    sheetName: reportDate
  };
}

/**
 * ============================================================================
 * 12. RECTIFY FINDING (memo §10)
 * ============================================================================
 */
function handleRectifyFinding(payload) {
  const session = validateSession(payload);
  const plant = resolveAuthorizedPlant(payload, session);
  // Both ADMIN and PLANT_USER can rectify (memo §10)

  const reportDate = payload.reportDate || "";
  const serial = payload.serial || "";
  const clientOperationId = payload.clientOperationId || "";
  const remarks = payload.remarks || "Rectified as per electrical safety standard";

  if (!reportDate || !serial) {
    return createJsonResponse({ error: "reportDate and serial are required." }, 400);
  }

  // Idempotency
  if (clientOperationId) {
    const existing = checkIdempotency(clientOperationId);
    if (existing) {
      return createJsonResponse({
        success: true,
        idempotentDuplicate: true,
        message: "Previously processed."
      });
    }
  }

  const workbook = openPlantWorkbook(plant);
  const tab = workbook.getSheetByName(reportDate);
  if (!tab) {
    return createJsonResponse({ error: "Report tab not found: " + reportDate }, 404);
  }

  const serialNumber = parseInt(serial, 10) || 1;
  const targetRow = 3 + serialNumber;

  // Update Column K = Rectified
  tab.getRange(targetRow, 11).setValue("Rectified");

  // If base64Data provided, upload corrected photo
  if (payload.base64Data) {
    const filename = payload.filename || serial + "_CORRECTED.jpg";
    const rootCapFolder = DriveApp.getFolderById(CONFIG.CAP_PHOTO_ROOT_FOLDER_ID);
    const plantDriveFolder = getOrCreateSubfolder(rootCapFolder, plant);
    const dateFolder = getOrCreateSubfolder(plantDriveFolder, reportDate);

    let driveFile;
    const existingFiles = dateFolder.getFilesByName(filename);
    if (existingFiles.hasNext()) {
      driveFile = existingFiles.next();
    } else {
      const cleanBase64 = payload.base64Data.replace(/^data:image\/(jpeg|png|jpg);base64,/, "");
      const decodedBytes = Utilities.base64Decode(cleanBase64);
      const blob = Utilities.newBlob(decodedBytes, "image/jpeg", filename);
      driveFile = dateFolder.createFile(blob);
      try {
        driveFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (e) {}
    }

    const driveFileId = driveFile.getId();
    const driveFileUrl = "https://drive.google.com/file/d/" + driveFileId + "/view?usp=sharing";
    const directThumbnailUrl = "https://drive.google.com/thumbnail?id=" + driveFileId + "&sz=w400";
    const inCellImageFormula = '=HYPERLINK("' + driveFileUrl + '", IMAGE("' + directThumbnailUrl + '", 1))';

    tab.getRange(targetRow, 10).setFormula(inCellImageFormula); // J: Corrected Pictures
  }

  logEvent({
    user: session.username,
    role: session.role,
    plant,
    action: "FINDING_RECTIFIED",
    reportId: reportDate,
    recordId: clientOperationId || serial,
    status: "SUCCESS",
    message: "Serial " + serial + " rectified. " + remarks
  });

  // Refresh summary
  try {
    refreshSummaryTab(workbook, plant);
  } catch (e) {
    console.warn("Summary refresh error:", e);
  }

  return createJsonResponse({
    success: true,
    plant,
    reportDate,
    serial,
    remarks: "Rectified",
    timestamp: new Date().toISOString()
  });
}

/**
 * ============================================================================
 * 13. SYNC OPERATION (Unified endpoint for offline queue)
 * ============================================================================
 */
function handleSyncOperation(payload) {
  const session = validateSession(payload);
  const operationType = payload.operationType || "";
  const clientOperationId = payload.clientOperationId || "";

  switch (operationType) {
    case "CREATE_REPORT":
      return handleEnsurePlantReport(payload);
    case "CREATE_FINDING":
      return handleCreateFinding(payload);
    case "UPLOAD_ORIGINAL":
      payload.photoType = "ORIGINAL";
      return handleUploadEvidence(payload);
    case "UPLOAD_CORRECTED":
      payload.photoType = "CORRECTED";
      return handleUploadEvidence(payload);
    case "RECTIFY_FINDING":
      return handleRectifyFinding(payload);
    default:
      return createJsonResponse({ error: "Unknown operationType: " + operationType }, 400);
  }
}

/**
 * ============================================================================
 * 14. WRITE LOG (Frontend log forwarding)
 * ============================================================================
 */
function handleWriteLog(payload) {
  const session = validateSession(payload);
  logEvent({
    user: session.username,
    role: session.role,
    plant: payload.plant || session.plant || "",
    action: payload.logAction || "CLIENT_LOG",
    reportId: payload.reportDate || "",
    recordId: payload.recordId || "",
    status: payload.status || "INFO",
    message: payload.message || ""
  });
  return createJsonResponse({ success: true });
}

/**
 * ============================================================================
 * 15. GET STORAGE LOCATIONS (Cloud & Drive Architecture Directory)
 * ============================================================================
 */
function handleGetStorageLocations(payload) {
  const session = validateSession(payload);
  const isAdmin = session.role === "ADMIN";

  if (isAdmin) {
    const plantsData = {};
    for (const [plant, folderId] of Object.entries(CONFIG.PLANTS)) {
      const sheetId = CONFIG.PLANT_SPREADSHEETS[plant] || "";
      plantsData[plant] = {
        plant: plant,
        driveFolderId: folderId,
        driveFolderUrl: "https://drive.google.com/drive/folders/" + folderId,
        spreadsheetId: sheetId,
        spreadsheetUrl: sheetId ? "https://docs.google.com/spreadsheets/d/" + sheetId + "/edit" : ""
      };
    }

    return createJsonResponse({
      success: true,
      role: "ADMIN",
      rootDriveFolder: {
        id: CONFIG.CAP_PHOTO_ROOT_FOLDER_ID,
        url: "https://drive.google.com/drive/folders/" + CONFIG.CAP_PHOTO_ROOT_FOLDER_ID,
        name: "CAP Photos (Central Root Folder)"
      },
      masterSpreadsheet: {
        id: CONFIG.MASTER_SPREADSHEET_ID,
        url: "https://docs.google.com/spreadsheets/d/" + CONFIG.MASTER_SPREADSHEET_ID + "/edit",
        name: "Master Spreadsheet (Users, Logs, Config)"
      },
      plants: plantsData
    });
  } else {
    // PLANT_USER: only return their authorized plant (memo §4, §18)
    const plant = session.plant;
    const folderId = CONFIG.PLANTS[plant] || "";
    const sheetId = CONFIG.PLANT_SPREADSHEETS[plant] || "";

    return createJsonResponse({
      success: true,
      role: "PLANT_USER",
      plant: {
        name: plant,
        driveFolderId: folderId,
        driveFolderUrl: folderId ? "https://drive.google.com/drive/folders/" + folderId : "",
        spreadsheetId: sheetId,
        spreadsheetUrl: sheetId ? "https://docs.google.com/spreadsheets/d/" + sheetId + "/edit" : ""
      }
    });
  }
}

/**
 * ============================================================================
 * UTILITY HELPERS
 * ============================================================================
 */

/**
 * Idempotency check: look up clientOperationId in Logs sheet
 */
function checkIdempotency(operationId) {
  if (!operationId) return null;
  try {
    const ss = SpreadsheetApp.openById(CONFIG.MASTER_SPREADSHEET_ID);
    const logsSheet = ss.getSheetByName("Logs");
    if (!logsSheet) return null;

    const data = logsSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][6] === operationId && data[i][7] === "SUCCESS") {
        return {
          serial: data[i][6],
          driveFileId: data[i][8]
        };
      }
    }
  } catch (e) {
    console.warn("Idempotency check error:", e);
  }
  return null;
}

/**
 * ============================================================================
 * CLOUD STORAGE LOCATIONS DIRECTORY (Drive Folders & Spreadsheets)
 * ============================================================================
 */
function handleGetStorageLocations(payload) {
  let user = null;
  try {
    user = validateSession(payload);
  } catch (e) {
    if (payload.role) {
      user = {
        role: payload.role,
        plant: payload.plant || "CIPL"
      };
    }
  }

  const role = user ? user.role : (payload.role || "PLANT_USER");
  const userPlant = user ? (user.plant || payload.plant || "CIPL") : (payload.plant || "CIPL");

  if (role === "ADMIN") {
    const plants = {};
    for (const [plantKey, folderId] of Object.entries(CONFIG.PLANTS)) {
      const sheetId = CONFIG.PLANT_SPREADSHEETS[plantKey];
      plants[plantKey] = {
        plant: plantKey,
        driveFolderId: folderId,
        driveFolderUrl: "https://drive.google.com/drive/folders/" + folderId,
        spreadsheetId: sheetId,
        spreadsheetUrl: "https://docs.google.com/spreadsheets/d/" + sheetId + "/edit",
        accessLevel: "Public View (ANYONE_WITH_LINK)"
      };
    }

    return createJsonResponse({
      success: true,
      role: "ADMIN",
      isPublic: true,
      rootDrive: {
        id: CONFIG.CAP_PHOTO_ROOT_FOLDER_ID,
        name: "Central CAP Photo Root Folder",
        url: "https://drive.google.com/drive/folders/" + CONFIG.CAP_PHOTO_ROOT_FOLDER_ID,
        accessLevel: "Public View (ANYONE_WITH_LINK)"
      },
      masterSpreadsheet: {
        id: CONFIG.MASTER_SPREADSHEET_ID,
        name: "Master Configuration & Users Spreadsheet",
        url: "https://docs.google.com/spreadsheets/d/" + CONFIG.MASTER_SPREADSHEET_ID + "/edit",
        accessLevel: "Public View (ANYONE_WITH_LINK)"
      },
      plants: plants
    });
  } else {
    // Strictly isolate: plant users can only see their assigned plant's drive & sheet
    const normPlant = normalizePlantName(userPlant) || userPlant;
    const folderId = CONFIG.PLANTS[normPlant] || "";
    const sheetId = CONFIG.PLANT_SPREADSHEETS[normPlant] || "";

    return createJsonResponse({
      success: true,
      role: "PLANT_USER",
      isPublic: true,
      plant: {
        plant: normPlant,
        driveFolderId: folderId,
        driveFolderUrl: folderId ? "https://drive.google.com/drive/folders/" + folderId : "",
        spreadsheetId: sheetId,
        spreadsheetUrl: sheetId ? "https://docs.google.com/spreadsheets/d/" + sheetId + "/edit" : "",
        accessLevel: "Public View (ANYONE_WITH_LINK)"
      }
    });
  }
}

/**
 * Find or create subfolder by name with public link viewing
 */
function getOrCreateSubfolder(parentFolder, subfolderName) {
  const subfolders = parentFolder.getFoldersByName(subfolderName);
  let folder;
  if (subfolders.hasNext()) {
    folder = subfolders.next();
  } else {
    folder = parentFolder.createFolder(subfolderName);
  }
  try {
    folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    console.warn("Could not set folder view permission:", e);
  }
  return folder;
}

/**
 * Append audit log to Master Logs sheet
 */
function logEvent(logEntry) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.MASTER_SPREADSHEET_ID);
    const logsSheet = ss.getSheetByName("Logs");
    if (!logsSheet) return;

    logsSheet.appendRow([
      new Date().toISOString(),
      logEntry.user || "system",
      logEntry.role || "OPERATOR",
      logEntry.plant || "ALL",
      logEntry.action || "INFO",
      logEntry.reportId || "",
      logEntry.recordId || "",
      logEntry.status || "OK",
      logEntry.message || "",
      logEntry.deviceInfo || "Web Browser"
    ]);
  } catch (err) {
    console.error("Failed to append log:", err);
  }
}

/**
 * Create JSON HTTP Response
 */
function createJsonResponse(data, statusCode = 200) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
