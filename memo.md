# MEMO: Epic Group Electrical Internal CAP Report System

> Target Audience: Future AI agents and engineers maintaining or expanding this codebase.
> Last Updated: 2026-09-20
> System Name: Epic Group - Electrical Internal CAP Report Field Inspector
> Repository Root: `e:\Antigravity\Epic\@Utility\`

---

## 1. Executive Summary & Core Product Principle

The **Epic Group Electrical Internal CAP Report Field Inspector** is an offline-first web application for utility and compliance electrical engineers inspecting:

- CIPL
- PGCL
- GTL
- EGMCL 2

The complete operational workflow is controlled from the **frontend only**.

Users must be able to:

1. Log in.
2. Select/access the authorized plant.
3. View CAP reports by date.
4. Create a new CAP report from the frontend when authorized.
5. Add electrical findings from the frontend.
6. Capture or select photographic evidence.
7. Process photos into the required 1:1 format with a bottom watermark.
8. Save captures locally first.
9. Automatically synchronize when connectivity is available.
10. Update Google Sheets and Google Drive through Google Apps Script.
11. Complete rectification from the frontend.
12. View report summaries and galleries.

### Critical operating principle

**Users must never need to manually edit Google Sheets.**

**Users must never need to manually modify `backend/Code.gs` during normal operation.**

`Code.gs` is the stable backend/API engine. The frontend sends structured commands to it. `Code.gs` performs the corresponding Google Sheets and Google Drive operations.

```text
Frontend Web App
       |
       | HTTPS API
       v
Google Apps Script Code.gs
       |
       +------------------+
       |                  |
       v                  v
Google Sheets        Google Drive
Plant workbooks      CAP photos
Master Data          Original/corrected evidence
```

---

## 2. Authoritative Cloud Assets

### 2.1 Plant Google Sheets

The preferred storage model is **one Google Spreadsheet per plant**, with date-wise CAP report tabs inside the workbook.

The following spreadsheets are the supplied example/initial plant workbooks:

| Plant | Spreadsheet ID |
| :--- | :--- |
| PGCL | `1PYH98QdeKzvj7gcNDwHzfNBsrxoD9CZhQhyVaXkHFls` |
| GTL | `1TuoTm37XEu-a9QznqFRccBnPsmINV99nOZfavt0boeA` |
| EGMCL 2 | `1Ejx7YRY-QmoIzEFY6_KCC04b3celsrzDlshKDGTtN54` |
| CIPL | `1Nui7xNg7OP8--Ngy_UPZE9Jkfn-3sN90UosJR-9Ms0o` |

These workbooks are storage targets for application-generated data. Normal users do not edit them manually.

### 2.2 Master Data Spreadsheet

**ID:** `1BT01JVkSxbYdJCuIwffxclGz_sW2e8cDAKpNyC3r28I`

Expected tabs:

- `Users`
- `Logs`
- `System_Config`

The `Users` tab is authoritative for authentication, role, plant assignment, and account status.

### 2.3 Google Drive Photo Storage

**Root folder ID:** `146wZBm_yvNbEIXKfqrT-wXQnnbbfQ6_N`

Configured plant folders:

| Plant | Drive Folder ID |
| :--- | :--- |
| EGMCL 2 | `1cVlGvRf8ezIMEmMRzRjdSC2FanXbGcT7` |
| CIPL | `13XyI1a5uFv2crHNhy-wYHI7i8jrP1X_6` |
| GTL | `1T9mx0VPB6FtfKMlxDNJfY4ef44AbAof1` |
| PGCL | `1qv7wsp1mk5MsNVkdbtZvu7WmMkNyimZl` |

Recommended hierarchy:

```text
CAP Photos
  / CIPL
      / YYYY-MM-DD
  / PGCL
      / YYYY-MM-DD
  / GTL
      / YYYY-MM-DD
  / EGMCL 2
      / YYYY-MM-DD
```

### 2.4 Apps Script Web App

Current web app URL:

`https://script.google.com/macros/s/AKfycbzDpKIljJ1iNzSq59H0uVItcxfEfcrhIqQki9XRiwLMmPKU-NYRMAoqDPXehFcbuGsRTw/exec`

Backend source:

`backend/Code.gs`

Execution model:

- Executes as owner.
- Serves as the API layer.
- Protected operations require a valid session token.
- Every protected request is re-authorized server-side.

---

## 3. Final Google Sheets Architecture

### 3.1 One Workbook Per Plant

Use one long-term workbook per plant:

```text
CIPL CAP Workbook
  |
  +-- SUMMARY
  +-- 2026-09-20
  +-- 2026-09-27
  +-- 2026-10-05
  +-- ...

PGCL CAP Workbook
  |
  +-- SUMMARY
  +-- 2026-09-20
  +-- ...
```

The same structure applies to GTL and EGMCL 2.

### 3.2 Date-Wise Report Tabs

Each inspection date is a tab in the plant workbook.

Recommended tab naming:

```text
YYYY-MM-DD
```

Example:

```text
2026-09-20
```

The backend creates/reuses the tab automatically when ADMIN creates or opens a report from the frontend.

### 3.3 Summary Tab

Each plant workbook contains:

```text
SUMMARY
```

The Summary tab aggregates all date-wise report tabs for that plant.

Minimum metrics:

- Total Findings
- Priority 1
- Priority 2
- Priority 3
- Rectified
- Not Rectified
- Date-wise report totals

### 3.4 No Manual Date-Tab Creation

The user does not create date tabs in Google Sheets.

The frontend action:

```text
New CAP Report
```

causes:

```text
Frontend
  -> Code.gs
  -> plant workbook
  -> create/reuse YYYY-MM-DD tab
  -> return report metadata
```

Date-tab creation must be idempotent.

### 3.5 No Separate File for Every Date

Default design:

```text
ONE workbook per plant
+
ONE SUMMARY tab
+
ONE report tab per inspection date
```

A separate Google Sheet file per date is not required.

---

## 4. Roles and Access

### ADMIN

ADMIN can:

- See all four plants.
- Switch plants from the frontend.
- View all reports for the selected plant.
- Create a CAP report for a selected date.
- Open previous reports.
- Add new findings.
- Capture original evidence.
- Upload evidence.
- View galleries.
- Monitor rectification.
- View summaries and KPIs.

### PLANT_USER

A Plant User:

- Is permanently associated with one plant.
- Cannot switch plants.
- Can view only that plant's reports.
- Cannot create a report.
- Cannot create a finding.
- Cannot edit original CAP data.
- Cannot change findings, recommendations, locations, risk level, responsible person, deadline, or original evidence.
- Can perform rectification on existing findings.
- Can upload corrected evidence.
- Can update allowed rectification information.

### Security Invariant

A Plant User must never gain access to another plant by changing:

- URL parameters
- frontend state
- local storage
- request payloads
- report IDs
- plant values

The backend must verify:

```text
session token
role
assigned plant
requested plant
requested report
requested action
```

for every protected operation.

---

## 5. Frontend-Only Operational Model

The frontend is the user's complete interface.

Users do not:

- edit Google Sheets,
- paste Drive links,
- manually insert photos,
- change `Not Rectified` to `Rectified`,
- create date tabs,
- repair summary formulas,
- rename evidence files,
- edit Apps Script.

### Example: Create report

ADMIN clicks:

```text
New CAP Report
Plant: CIPL
Date: 2026-09-20
```

The frontend calls the backend.

`Code.gs`:

1. Authenticates the session.
2. Verifies ADMIN.
3. Verifies plant authorization.
4. Opens the CIPL workbook.
5. Checks for the date tab.
6. Creates it if missing.
7. Ensures `SUMMARY` remains intact.
8. Returns authoritative report metadata.

The user sees only the resulting report screen.

---

## 6. Login and Report Hub

### 6.1 Login

```text
Login Screen
    |
    v
auth_login
    |
    +-- valid -> session
    |
    +-- invalid -> error
```

Credentials are checked against Master Data.

Passwords are never stored in frontend source code and never logged.

### 6.2 Report Hub

After login, the user lands on:

```text
CAP Reports
```

ADMIN sees a plant selector.

PLANT_USER sees only the assigned plant.

Each report card should show:

- Audit Date
- Report Name
- Total Findings
- Priority 1
- Priority 2
- Priority 3
- Rectified
- Pending
- Progress
- Status

ADMIN can see:

```text
New CAP Report
```

Plant Users cannot.

---

## 7. CAP Report A-K Structure

Each date tab follows the established CAP layout:

| Column | Field | Behavior |
| :--- | :--- | :--- |
| A | Sl | Auto-generated serial |
| B | Findings / Issues | Finding description |
| C | Recommendation | Corrective recommendation |
| D | Specific Location | Exact inspection location |
| E | Risk Level | `Priority 1`, `Priority 2`, `Priority 3` |
| F | General Location | Plant name |
| G | Pictorial Evidence | Original photo |
| H | Responsible | `Utility In-Charge` or configured value |
| I | Deadline | P1=`7 Days`, P2=`4 Days`, P3=`3 Days` |
| J | Corrected Pictures | Corrected evidence |
| K | Remarks | `Not Rectified` / `Rectified` |

Headers and approved formatting must be preserved.

### Serial Rule

Display:

```text
001
002
003
...
```

The system, not the user, allocates serial numbers.

---

## 8. ADMIN New Finding Workflow

Only ADMIN can create new findings.

```text
Open Report
    ->
New Finding
    ->
Enter finding data
    ->
Capture/select original photo
    ->
Preview
    ->
Save locally
    ->
Queue
    ->
Automatic synchronization
    ->
Drive + Sheets
    ->
Return authoritative record
```

### Minimum finding data

```text
reportId
plant
inspectionDate
serial
finding
recommendation
specificLocation
riskLevel
generalLocation
responsible
deadline
originalPhoto
clientOperationId
createdAt
createdBy
```

### Risk-to-deadline mapping

```text
Priority 1 -> 7 Days
Priority 2 -> 4 Days
Priority 3 -> 3 Days
```

The frontend should derive the deadline immediately.

The backend must validate it.

---

## 9. Photo Capture, Processing and Storage

### 9.1 Capture Methods

Support:

- live browser viewfinder,
- native device camera,
- mobile/PC local file picker,
- mobile gallery selection.

### 9.2 Photo Processing

Every CAP photo must use:

```text
1:1 square photographic area
```

Then append a white watermark strip below the image.

The watermark must never overlay the evidence.

Original watermark:

```text
SERIAL | FINDINGS | LOCATION | DATE TIME
```

Corrected watermark:

```text
SERIAL | FINDINGS | LOCATION | DATE TIME | CORRECTED 01
```

### 9.3 Filename Rules

Original:

```text
{SERIAL}_{FINDINGS}_{LOCATION}_{YYYY-MM-DD}_{HH-mm-ss}.jpg
```

Corrected:

```text
{SERIAL}_{FINDINGS}_{LOCATION}_{YYYY-MM-DD}_{HH-mm-ss}_CORRECTED_{SEQ}.jpg
```

Filename components must be sanitized.

### 9.4 Drive Behavior

The frontend does not manipulate Drive directly.

`Code.gs` handles:

- folder lookup/creation,
- file upload,
- filename,
- MIME validation,
- Drive reference/URL,
- duplicate prevention.

---

## 10. Rectification Workflow

Only existing findings can be rectified.

```text
Open Report
    ->
Select Not Rectified Finding
    ->
Rectify
    ->
View original evidence
    ->
Capture corrected photo
    ->
Preview
    ->
Save locally
    ->
Queue
    ->
Sync
```

Default note:

```text
Rectified as per electrical safety standard
```

### Plant User restrictions

The following remain read-only:

- Findings / Issues
- Recommendation
- Specific Location
- Risk Level
- General Location
- Responsible
- Deadline
- Original Pictorial Evidence

The user may only interact with the approved rectification controls.

### Cloud confirmation rule

Selecting a local file does not by itself mean the finding is rectified.

After successful backend commit:

```text
Column J = corrected picture
Column K = Rectified
```

If the correction is still only local/pending:

```text
status = Pending Sync
```

The authoritative cloud state controls the final status.

### Multiple corrected photos

A finding may have multiple corrected pictures:

```text
CORRECTED 01
CORRECTED 02
CORRECTED 03
```

Existing corrected evidence must not be accidentally deleted or overwritten.

---

## 11. Summary and KPI Logic

### Report-level KPIs

Every report must expose:

```text
Total Findings
Priority 1
Priority 2
Priority 3
Rectified
Not Rectified
```

### Plant Summary

Example:

| Date | Total | P1 | P2 | P3 | Rectified | Not Rectified |
| :--- | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-09-20 | 12 | 3 | 5 | 4 | 7 | 5 |
| 2026-09-27 | 8 | 2 | 3 | 3 | 5 | 3 |

Overall KPI area:

```text
TOTAL FINDINGS
P1
P2
P3
RECTIFIED
NOT RECTIFIED
```

When a finding or correction is committed:

- underlying report data changes,
- summary calculations update,
- frontend KPIs refresh,
- report card status refreshes.

No manual formula editing.

---

## 12. Spreadsheet-Like Frontend

The frontend report view should resemble the approved Google Sheets structure while adding application controls.

Required:

- A-K aligned table
- sticky headers where practical
- horizontal scrolling on mobile
- inline photo thumbnails
- click-to-preview
- risk badges
- rectification status
- read-only controls for Plant Users
- action controls for ADMIN
- responsive layout

The frontend is the operational view of the data; it is not a separate data source.

---

## 13. Photo Gallery

Provide a gallery for the active report and, where appropriate, the selected plant.

Filters:

```text
All Photos
Pending Rectification
Rectified
```

Photo detail should show:

- 1:1 evidence
- watermark
- serial
- finding
- location
- risk level
- date
- original/corrected state
- Drive reference/link when available
- rectification action when applicable

For rectified observations, show original and corrected images together where practical.

---

## 14. Offline-First Storage

Use IndexedDB:

```text
CAP_Evidence_DB
```

Recommended stores:

```text
reports
records
photos
queue
sessions
metadata
```

### Save-first rule

For every capture/mutation:

```text
User Action
   ->
Local validation
   ->
IndexedDB write
   ->
Queue operation
   ->
Attempt synchronization
```

The capture must not be lost because of temporary connectivity loss.

---

## 15. Offline Queue

The queue is the durable local pending-work buffer.

Each queued operation should contain:

```text
operationId
operationType
plant
reportDate
reportId
recordId
payload
createdAt
attemptCount
lastAttemptAt
status
error
```

Supported logical operations:

```text
CREATE_REPORT
CREATE_FINDING
UPLOAD_ORIGINAL
RECTIFY_FINDING
UPLOAD_CORRECTED
UPDATE_ALLOWED_FIELD
```

Operations may be consolidated internally, but each logical cloud mutation must have a stable operation ID.

---

## 16. Idempotency

Retries are expected.

Every cloud mutation must include:

```text
clientOperationId
```

If the browser sends the same operation multiple times, the backend must not create duplicate findings or unintended duplicate actions.

Example:

```text
CREATE_FINDING
operationId = abc123
```

Three retries must still produce one authoritative finding.

The backend should return the previous committed result when the operation has already succeeded.

This protects against:

- weak Wi-Fi,
- mobile network changes,
- repeated taps,
- browser refresh,
- upload retry,
- background sync.

---

## 17. Synchronization

Recommended processing order:

```text
1. Validate/renew session
2. CREATE_REPORT
3. CREATE_FINDING
4. Original evidence
5. Corrected evidence
6. Allowed updates/status
7. Refresh authoritative report
```

Where one logical operation requires both Drive and Sheets changes, `Code.gs` should perform the complete server-side workflow and return one authoritative result.

### Automatic sync triggers

Attempt sync on:

- application startup,
- login,
- browser `online`,
- page focus/visibility,
- periodic active-app checks,
- after successful operations when queue items remain.

### Failed queue entries

Do not silently discard failures.

Possible states:

```text
Pending Sync
Syncing
Synced
Needs Attention
```

---

## 18. API Contract

`js/apiService.js` communicates with the Apps Script web app.

Suggested action families:

### Authentication

```text
auth_login
auth_validate
auth_logout
```

### Plants/reports

```text
list_authorized_plants
list_plant_reports
ensure_plant_report
get_plant_report_info
get_report_summary
```

### Findings

```text
create_finding
get_finding
update_allowed_finding_fields
```

### Evidence

```text
upload_evidence
upload_corrected_evidence
```

### Rectification

```text
rectify_finding
get_rectification_history
```

### Synchronization

```text
sync_operation
sync_batch
get_operation_status
```

### Logs

```text
write_log
```

The actions can be consolidated into a secure dispatcher, but permissions must remain explicit.

---

## 19. Stable Backend Design

`backend/Code.gs` must be written as a stable backend service.

It should centralize:

- configuration,
- authorization,
- validation,
- Sheets operations,
- Drive operations,
- idempotency,
- JSON responses,
- errors,
- logging.

### Data-driven configuration

Do not hardcode daily dates or report-specific IDs.

Configuration should cover:

```text
plant
spreadsheetId
driveFolderId
date format
sheet name rule
risk/deadline map
master data spreadsheet
photo root
```

Use `System_Config` where appropriate so configuration changes do not require business-logic rewrites.

### One-time deployment principle

After the final backend is deployed, operational actions do not require backend source changes.

These must work without editing `Code.gs`:

- new inspection date,
- new report,
- new finding,
- new photo,
- corrected photo,
- rectification,
- summary update.

A backend code change is needed only when the application's backend capability itself changes, such as a new API capability, security fix, schema migration, integration, or bug fix.

---

## 20. Logging

Use the Master Data `Logs` tab for important system events.

Example actions:

```text
LOGIN_SUCCESS
LOGIN_FAILED
REPORT_CREATED
REPORT_OPENED
FINDING_CREATED
ORIGINAL_PHOTO_UPLOADED
RECTIFICATION_STARTED
CORRECTED_PHOTO_UPLOADED
FINDING_RECTIFIED
SYNC_FAILED
SYNC_RETRIED
ACCESS_DENIED
```

Suggested log fields:

```text
timestamp
username
role
plant
action
reportDate
recordId
operationId
result
message
```

Never log passwords.

---

## 21. Data Authority

Differentiate:

### Local Draft

Only in IndexedDB.

### Pending Sync

In IndexedDB and queue, not yet committed to cloud.

### Cloud Authoritative

Successfully written to Google Sheets/Drive.

The frontend must never describe a local draft as cloud-saved.

Google Sheets and Google Drive are authoritative after successful synchronization.

IndexedDB is the safety buffer.

---

## 22. Error Handling

The system should distinguish:

```text
Authentication Error
Authorization Error
Validation Error
Network Error
Drive Error
Sheet Error
Duplicate/Idempotent Result
Permanent Rejection
```

Errors shown to users should be understandable.

Example:

```text
Your photo is safely stored on this device and is waiting for synchronization.
```

instead of exposing raw technical errors.

---

## 23. UI and Visual Rules

Use a clean enterprise Microsoft/Fluent-style interface.

Use:

```text
js/icons.js
```

for inline SVG icons.

### Zero Emojis

UI must contain no emojis.

Use SVG icons for:

- reports
- camera
- gallery
- upload
- correction
- synchronization
- status
- navigation
- settings
- errors

---

## 24. Codebase Architecture

```text
e:/Antigravity/Epic@Utility/

├── backend/
│   ├── Code.gs
│   ├── appsscript.json
│   └── DEPLOYMENT_GUIDE.md
│
├── js/
│   ├── app.js
│   ├── icons.js
│   ├── apiService.js
│   ├── canvasEngine.js
│   ├── recordModel.js
│   ├── db.js
│   └── syncEngine.js
│
├── src/
│   └── image/
│       ├── logo.png
│       └── logo 1.png
│
├── index.html
├── styles.css
├── prompt.md
├── codex-implementation-prompt.md
├── memo.md
└── package.json
```

### Responsibilities

`app.js`
- application controller
- routing/views
- login
- plant selection
- report hub
- report table
- finding form
- rectification
- gallery
- summary
- UI state

`icons.js`
- SVG icon dictionary

`apiService.js`
- Apps Script API calls
- token/session handling
- JSON serialization
- retry/error normalization

`canvasEngine.js`
- 1:1 crop
- watermark
- JPEG generation

`recordModel.js`
- record schema
- serial helpers
- deadline rules
- filename rules
- status helpers

`db.js`
- IndexedDB storage

`syncEngine.js`
- queue processing
- retry
- connectivity
- idempotent synchronization

`Code.gs`
- authentication
- authorization
- Master Data access
- plant workbook access
- report creation
- report reads
- finding writes
- Drive uploads
- rectification
- logging
- validation
- idempotency

---

## 25. Critical Invariants

1. Users operate the system from the frontend.
2. No normal operational task requires manual `Code.gs` editing.
3. No normal operational task requires manual Google Sheet editing.
4. One workbook per plant is the default repository.
5. Each inspection date is a date-wise tab.
6. Each plant workbook has a `SUMMARY` tab.
7. Plant Users are isolated to their assigned plant.
8. Only ADMIN can switch plants.
9. Only ADMIN can create reports.
10. Only ADMIN can create new findings.
11. Plant Users cannot change original CAP data.
12. Plant Users can perform rectification only.
13. Every capture is stored locally before cloud synchronization.
14. Queue entries are durable.
15. Queue retries are idempotent.
16. Original evidence goes to Column G.
17. Corrected evidence goes to Column J.
18. Cloud-confirmed rectification sets Column K to `Rectified`.
19. Risk/deadline mapping is P1=7 Days, P2=4 Days, P3=3 Days.
20. The photographic area is strictly 1:1.
21. The watermark strip is below the photograph.
22. Watermark never overlays evidence.
23. Filename conventions are preserved.
24. Historical reports must not be overwritten accidentally.
25. Date-tab creation is idempotent.
26. Protected backend actions re-authorize every request.
27. Passwords are not stored in frontend source code.
28. Passwords are never logged.
29. UI contains zero emojis.
30. Summary values update from authoritative report data.

---

## 26. Required Screens

Minimum views:

```text
1. Login
2. Report Hub
3. Plant Selector (ADMIN)
4. Create Report
5. Full Report
6. New Finding
7. Finding Detail
8. Rectification
9. Photo Gallery
10. Photo Detail
11. Offline/Sync Status
12. User/Profile
```

Optional protected administration views:

```text
13. User Administration
14. System Configuration
15. Activity Logs
```

All operational actions still go through the frontend and protected backend.

---

## 27. End-to-End Acceptance Scenarios

### Scenario A: ADMIN creates a CIPL report

```text
ADMIN Login
  ->
Select CIPL
  ->
New CAP Report
  ->
Select date
  ->
Frontend request
  ->
Code.gs authorization
  ->
Create/reuse date tab
  ->
Return report
```

No manual Sheet action.

### Scenario B: ADMIN creates a finding offline

```text
Open report
  ->
New Finding
  ->
Enter data
  ->
Capture photo
  ->
1:1 + watermark
  ->
IndexedDB
  ->
Queue
  ->
Network unavailable
  ->
Pending Sync
  ->
Network returns
  ->
syncEngine
  ->
Code.gs
  ->
Drive + Sheet
  ->
Authoritative refresh
```

### Scenario C: Plant User rectifies

```text
PLANT_USER Login
  ->
Assigned plant
  ->
Open report
  ->
Select finding
  ->
Rectify
  ->
Capture corrected photo
  ->
IndexedDB
  ->
Queue
  ->
Backend authorization
  ->
Drive upload
  ->
Column J update
  ->
Column K = Rectified
  ->
Summary refresh
```

### Scenario D: Unauthorized plant access

```text
CIPL Plant User
  ->
tries PGCL request
  ->
Code.gs checks assignment
  ->
reject
  ->
no PGCL data returned
```

---

## 28. Final Product Definition

The final product is a **frontend-operated CAP inspection system**.

From the user's perspective:

```text
LOGIN
  ->
PLANT / REPORTS
  ->
CREATE / OPEN REPORT
  ->
ADD FINDING OR RECTIFY
  ->
CAPTURE PHOTO
  ->
SAVE LOCALLY
  ->
AUTO SYNC
  ->
GOOGLE DRIVE + GOOGLE SHEETS
  ->
LIVE SUMMARY
```

The user thinks of the web application as the system.

Google Sheets and Google Drive are the underlying data/storage layers.

Google Apps Script `Code.gs` is the stable service connecting those layers.

### Final rule

> **Everything that can be controlled from the frontend must be controlled from the frontend.**
>
> **Every required backend change must happen automatically through the deployed `Code.gs`.**
>
> **No user should need to manually edit Google Sheets or manually modify `Code.gs` to operate the CAP system.**
