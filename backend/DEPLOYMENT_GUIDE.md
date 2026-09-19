# Google Apps Script Setup & Deployment Guide

This guide walks you through setting up the Apps Script backend to connect the web application directly to your Google Drive plant folders and Master Data Google Sheet.

---

## 1. Configured Google Drive & Google Sheets Resources

The backend in [`backend/Code.gs`](file:///e:/Antigravity/Epic@Utility/backend/Code.gs) is configured with your exact resources:

### Plant Google Drive Folders (where Plant & Date-wise CAP Sheets are stored):
- **EGMCL 2**: [https://drive.google.com/drive/folders/1cVlGvRf8ezIMEmMRzRjdSC2FanXbGcT7](https://drive.google.com/drive/folders/1cVlGvRf8ezIMEmMRzRjdSC2FanXbGcT7)
- **CIPL**: [https://drive.google.com/drive/folders/13XyI1a5uFv2crHNhy-wYHI7i8jrP1X_6](https://drive.google.com/drive/folders/13XyI1a5uFv2crHNhy-wYHI7i8jrP1X_6)
- **GTL**: [https://drive.google.com/drive/folders/1T9mx0VPB6FtfKMlxDNJfY4ef44AbAof1](https://drive.google.com/drive/folders/1T9mx0VPB6FtfKMlxDNJfY4ef44AbAof1)
- **PGCL**: [https://drive.google.com/drive/folders/1qv7wsp1mk5MsNVkdbtZvu7WmMkNyimZl](https://drive.google.com/drive/folders/1qv7wsp1mk5MsNVkdbtZvu7WmMkNyimZl)

*In these folders, Date-wise and Plant-name-wise files are automatically saved from the template, e.g.:*
`Plant Name- Electrical Internal CAP Report - Date` (e.g. `CIPL- Electrical Internal CAP Report - 2026-09-19`).

---

### Master Data Google Sheet (Users, Logs, System_Config tabs):
- **Link**: [https://docs.google.com/spreadsheets/d/1BT01JVkSxbYdJCuIwffxclGz_sW2e8cDAKpNyC3r28I/edit](https://docs.google.com/spreadsheets/d/1BT01JVkSxbYdJCuIwffxclGz_sW2e8cDAKpNyC3r28I/edit)
- **Tabs created**:
  - `Users` (User ID, Username, Password Hash, Name, Role, Plant, Active, Last Login)
  - `Logs` (Timestamp, User, Role, Plant, Action, Report ID, Record ID, Status, Message, Device Info)
  - `System_Config` (Key, Value, Description)

---

### CAP Photo Evidence Root Folder:
- **Link**: [https://drive.google.com/drive/folders/146wZBm_yvNbEIXKfqrT-wXQnnbbfQ6_N](https://drive.google.com/drive/folders/146wZBm_yvNbEIXKfqrT-wXQnnbbfQ6_N)
- Subfolders are created automatically in this structure:
  ```text
  CAP Photos (146wZBm_yvNbEIXKfqrT-wXQnnbbfQ6_N)
  │
  ├── CIPL
  │   └── 2026-09-19
  │       └── 001_Finding_Location_Date_Time.jpg
  ├── PGCL
  ├── GTL
  └── EGMCL 2
  ```

---

## 2. Setting Up Google Apps Script (2 Minutes)

### Option A: Bound to the Master Spreadsheet (Recommended)
1. Open your Master Google Sheet: [https://docs.google.com/spreadsheets/d/1BT01JVkSxbYdJCuIwffxclGz_sW2e8cDAKpNyC3r28I/edit](https://docs.google.com/spreadsheets/d/1BT01JVkSxbYdJCuIwffxclGz_sW2e8cDAKpNyC3r28I/edit).
2. Click **Extensions** ➔ **Apps Script**.
3. Replace all code in `Code.gs` with the code in [`backend/Code.gs`](file:///e:/Antigravity/Epic@Utility/backend/Code.gs).

### Option B: Standalone Apps Script
1. Go to [script.google.com](https://script.google.com) and click **New Project**.
2. Replace `Code.gs` with [`backend/Code.gs`](file:///e:/Antigravity/Epic@Utility/backend/Code.gs).

---

## 3. Run One-Click Initialization

1. In the Apps Script toolbar, select the function:
   `setupMasterSpreadsheetAndFolders`
2. Click **Run**.
3. Grant permissions when prompted (click "Review Permissions" ➔ your Google Account ➔ "Advanced" ➔ "Go to CAP_Report_Backend (unsafe)" ➔ "Allow").
4. Check the Execution Log: It will confirm that the `Users`, `Logs`, and `System_Config` tabs are created and the Drive folders are verified!

---

## 4. Deploy as a Web App

1. Click **Deploy** (top right) ➔ **New deployment**.
2. Click the gear icon next to "Select type" and choose **Web app**.
3. Set the fields:
   - **Description**: `CAP Field Inspector API v2`
   - **Execute as**: `Me (your account)`
   - **Who has access**: `Anyone` *(required for mobile PWA/field browsers)*
4. Click **Deploy**.
5. Copy the **Web App URL** (e.g. `https://script.google.com/macros/s/.../exec`).

---

## 5. Connect in the Web Application

1. Open the CAP Field Inspector app: [http://localhost:3000/](http://localhost:3000/).
2. Click the **⚙** button in the header (or in the **Cloud Sync** tab).
3. Paste the **Web App URL** into the box.
4. Click **Test Connection** ➔ then **Save Settings**.
5. Everything is now live! Photos, spreadsheets, and audit logs will automatically synchronize to Google Drive and Google Sheets!
