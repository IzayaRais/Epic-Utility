# MASTER PROMPT

# Electrical Internal CAP Report — Offline-First Web Application

## ROLE

Act as a **Senior Full-Stack Engineer, Google Apps Script Architect, PWA/Offline-First Engineer, Google Sheets/Drive Automation Specialist, UI/UX Engineer, and Electrical Engineering Workflow Consultant**.

Build a complete production-ready **Electrical Internal CAP Report Web Application**.

This is not a generic dashboard or a simple CRUD application.

It is a practical field application for electrical engineers/utility personnel who inspect manufacturing plants, identify electrical issues, capture photographic evidence, create CAP observations, and later capture corrected evidence.

The application must prioritize:

* Speed
* Reliability
* Offline operation
* Mobile camera workflow
* Automatic synchronization
* Data integrity
* Simple field operation
* Preservation of the existing CAP Excel/report format
* Google Drive integration
* Google Sheets integration
* Secure plant-level access

The most important philosophy is:

> **The engineer should focus on finding and documenting electrical issues. The application should handle filenames, photo processing, storage, synchronization, report updates, and history automatically.**

---

# 1. TECHNOLOGY ARCHITECTURE

Build the first production version using:

### Frontend

* HTML
* CSS
* Vanilla JavaScript or a lightweight framework only if genuinely beneficial
* Responsive design
* Mobile-first camera interface
* PWA-style offline behavior
* IndexedDB for local storage
* Browser Camera API
* Canvas API for image processing
* Service Worker where appropriate

### Backend

Use:

* Google Apps Script Web App
* Google Sheets
* Google Drive

Google Apps Script will act as the secure backend/API layer.

The browser must NOT directly receive privileged Google Drive credentials.

### Future compatibility

Structure the code so that the frontend/backend architecture can later be migrated to:

* Vercel
* Node.js
* another API backend

without completely rewriting the frontend.

---

# 2. IMPORTANT DEVELOPMENT APPROACH

Before writing the final application:

### FIRST inspect the supplied CAP Excel/template.

Do not assume the spreadsheet structure.

Determine:

* Sheet names
* Summary sheet
* CAP Report sheet
* Header row
* Observation starting row
* Existing formulas
* Existing formulas for Risk Level
* Conditional formatting
* Data validation
* Dropdowns
* Merged cells
* Image cells
* Pictorial Evidence column
* Corrected Pictures column
* Responsible column
* Deadline column
* Remarks
* Existing formatting
* Print settings
* Hidden sheets
* Existing formulas/logic
* How Summary values are calculated

The supplied CAP template is the **authoritative report format**.

Do not replace it with a generic table.

Do not destroy its formulas or formatting.

Do not blindly clear the workbook.

Create a mapping layer between the application and the existing template.

---

# 3. PLANTS

The system must support these four plants:

```text
CIPL
PGCL
GTL
EGMCL 2
```

Each plant has its own authorized users.

An administrator can access all plants.

A plant user can only access the plant assigned to their account.

---

# 4. GOOGLE DRIVE CONFIGURATION

Use the exact supplied plant root folders.

## EGMCL 2

Folder ID:

```text
1cVlGvRf8ezIMEmMRzRjdSC2FanXbGcT7
```

## CIPL

Folder ID:

```text
13XyI1a5uFv2crHNhy-wYHI7i8jrP1X_6
```

## GTL

Folder ID:

```text
1T9mx0VPB6FtfKMlxDNJfY4ef44AbAof1
```

## PGCL

Folder ID:

```text
1qv7wsp1mk5MsNVkdbtZvu7WmMkNyimZl
```

---

# 5. CAP PHOTO ROOT FOLDER

Use this Google Drive root folder for CAP photographic evidence:

```text
146wZBm_yvNbEIXKfqrT-wXQnnbbfQ6_N
```

The application should automatically create:

```text
CAP Photos
│
├── CIPL
│   └── YYYY-MM-DD
│
├── PGCL
│   └── YYYY-MM-DD
│
├── GTL
│   └── YYYY-MM-DD
│
└── EGMCL 2
    └── YYYY-MM-DD
```

Do not require users to manually create folders.

---

# 6. MASTER DATA GOOGLE SHEET

Use this spreadsheet:

```text
1BT01JVkSxbYdJCuIwffxclGz_sW2e8cDAKpNyC3r28I
```

The Master Data spreadsheet should contain at minimum:

```text
Users
Logs
System_Config
```

Additional technical sheets may be created if required, but do not interfere with existing data.

---

# 7. USERS SHEET

Recommended structure:

```text
User ID
Username
Password Hash
Name
Role
Plant
Active
Created At
Last Login
```

Roles:

```text
ADMIN
PLANT_USER
```

Admin:

```text
Plant = ALL
```

Plant user:

```text
Plant = CIPL
Plant = PGCL
Plant = GTL
Plant = EGMCL 2
```

Do not store plaintext passwords if avoidable.

Authentication must be validated server-side.

---

# 8. LOGS SHEET

Recommended columns:

```text
Timestamp
User
Role
Plant
Action
Report ID
Record ID
Status
Message
Device Info
```

Possible actions:

```text
LOGIN_SUCCESS
LOGIN_FAILED
LOGOUT
REPORT_CREATED
REPORT_OPENED
OBSERVATION_CREATED
ORIGINAL_PHOTO_QUEUED
ORIGINAL_PHOTO_UPLOADED
CORRECTED_PHOTO_QUEUED
CORRECTED_PHOTO_UPLOADED
REPORT_UPDATED
SYNC_SUCCESS
SYNC_FAILED
```

Do not store image binaries in Logs.

---

# 9. SYSTEM CONFIG

Use System_Config for non-sensitive configuration such as:

```text
Template ID
CAP Photo Root Folder ID
Report Naming Pattern
Maximum Image Size
Image Quality
Session Duration
```

Do not expose privileged credentials to the browser.

---

# 10. AUTHENTICATION

Create a login screen.

Fields:

```text
Username
Password
```

After login:

### Plant user

Only see:

```text
Their assigned plant
Their authorized reports
Their observations
Their CAP photo gallery
```

### Admin

Can:

```text
Select any plant
Open any plant report
View all observations
View sync status
View logs
Manage users
```

The backend must validate plant authorization.

Never trust a frontend parameter such as:

```javascript
plant = "CIPL"
```

without server-side authorization.

---

# 11. MAIN APPLICATION

After login, show:

```text
CENTRAL UTILITY DEPARTMENT
Electrical Internal CAP Report
```

Dashboard should contain plant/report information.

For a plant:

```text
Plant Name
Current Date
Current Report
Open CAP Issues
Corrected Issues
Pending Sync
Last Updated
```

Main actions:

```text
OPEN CAP REPORT
ADD OBSERVATION
VIEW OBSERVATIONS
CORRECT ISSUE
SYNC CENTER
REPORT HISTORY
```

---

# 12. DATE-WISE REPORT SYSTEM

Reports are organized by:

```text
Plant + Date
```

Example:

```text
CIPL
2026-09-19
```

There must be one CAP report for each plant/date combination.

Suggested filename:

```text
CIPL - Electrical Internal CAP Report - 2026-09-19
```

Before creating a report:

```text
Search for existing report
        ↓
If exists → open it
If not → create from template
```

Never create duplicate reports because of:

* page refresh
* retry
* synchronization
* double-click
* temporary network failure

---

# 13. CAP REPORT TEMPLATE

The existing CAP report contains fields similar to:

```text
Sl
Findings/Issues
Recommendation
Specific Location
Risk Level
General Location
Pictorial Evidence
Responsible
Deadline
Corrected Pictures
Remarks
```

The application must preserve the existing template.

Do not redesign the spreadsheet unless necessary.

Do not replace formulas with hardcoded values.

---

# 14. SUMMARY SHEET

The existing Summary sheet must continue functioning.

If the template already calculates:

* Total Issues
* Completed
* Not Rectified
* Risk levels
* Priority
* Other summary statistics

preserve those formulas/logic.

When the web application creates or updates observations, the Summary must update accordingly.

---

# 15. OBSERVATION DATA MODEL

Each observation should have a stable internal ID.

Recommended:

```text
recordId
reportId
plant
reportDate
serial
findings
recommendation
specificLocation
generalLocation
riskLevel
responsible
deadline
remarks
originalPhotoId
correctedPhotoIds
createdBy
createdAt
updatedAt
status
```

The stable internal record ID must NOT depend only on the visible serial.

---

# 16. SERIAL NUMBER

Original CAP observations use:

```text
001
002
003
004
...
```

The frontend may display the next expected number.

However, the backend must assign/validate the final serial.

Use Apps Script `LockService` or equivalent concurrency protection.

If two users attempt to create:

```text
007
```

simultaneously, the backend must prevent duplicate serial numbers.

---

# 17. ORIGINAL PHOTO WORKFLOW

The field workflow must be extremely simple:

```text
ADD OBSERVATION
       ↓
OPEN CAMERA
       ↓
CAPTURE
       ↓
PHOTO PREVIEW
       ↓
AUTO SERIAL
       ↓
ENTER FINDINGS
       ↓
ENTER LOCATION
       ↓
OPTIONAL RECOMMENDATION
       ↓
RISK LEVEL
       ↓
SAVE
```

The user should immediately be able to capture another observation.

Do not make the user wait for cloud upload.

---

# 18. CAMERA INTERFACE

Camera screen should include:

```text
Live camera preview
1:1 framing guide
Capture
Retake
Submit
Flash
Front/Back camera
```

On supported devices:

* Pinch/zoom if available
* Flash control
* Camera switching

Use HTTPS because browser camera permissions require a secure context.

---

# 19. MANDATORY 1:1 PHOTO FORMAT

Every final CAP photo must have a:

> **1:1 SQUARE PHOTOGRAPHIC AREA**

The actual photo must not be stretched or distorted.

If the camera provides:

```text
4:3
16:9
```

the application must convert it to 1:1 using intelligent cropping.

Never stretch the image.

Prefer:

```text
center crop
```

while preserving the main subject.

---

# 20. WHITE WATERMARK AREA

The watermark must NOT be placed over the photographic evidence.

Instead:

```text
┌─────────────────────────────┐
│                             │
│                             │
│        1:1 PHOTO            │
│                             │
│                             │
│                             │
├─────────────────────────────┤
│ 001 | Finding | Location... │
│ 19-09-2026 14:32            │
└─────────────────────────────┘
```

The white strip is a separate area below the square photograph.

The photograph itself remains completely unobstructed.

Do not use:

* transparent watermark over photo
* black overlay
* white text over equipment
* watermark across the center
* watermark over the bottom portion of the photo

---

# 21. WATERMARK CONTENT

The watermark must include:

```text
Serial
Findings
Location
Date
Time
```

Preferred format:

```text
001 | Loose Cable Termination | MDB Room | 19-09-2026 14:32
```

For corrected photos:

```text
001 | Loose Cable Termination | MDB Room | 20-09-2026 10:15 | CORRECTED 01
```

Use a clean professional sans-serif font.

Use:

```text
White background
Dark text
Medium/Semibold weight
```

No decorative typography.

---

# 22. WATERMARK MUST REMAIN READABLE

The watermark should preferably be one line.

If text is too long:

1. Reduce font size within a safe limit.
2. Use intelligent truncation if necessary.
3. Preserve full metadata in the database/report.

Never allow:

* overflow
* clipped text
* text outside the canvas
* overlapping fields

The white strip should generally occupy around:

```text
10–15% of the square photo height
```

and must not visually dominate the photo.

---

# 23. PHOTO PROCESSING PIPELINE

The final image must be generated before cloud upload.

Pipeline:

```text
CAMERA
 ↓
RAW IMAGE
 ↓
ORIENTATION CORRECTION
 ↓
1:1 CROP
 ↓
IMAGE RESIZE
 ↓
IMAGE COMPRESSION
 ↓
CREATE WHITE METADATA STRIP
 ↓
RENDER WATERMARK
 ↓
FINAL CAP IMAGE
 ↓
SAVE TO INDEXEDDB
 ↓
UPLOAD TO DRIVE
```

---

# 24. IMAGE COMPRESSION

Do not upload unnecessarily huge camera images.

Use client-side compression.

Recommended starting point:

```text
Maximum photo width/height:
1600–2000 px

JPEG quality:
0.80–0.88

Typical target:
300 KB–1.5 MB
```

These are starting values, not absolute limits.

If an electrical label or meter reading requires more quality, preserve it.

Do not over-compress evidence.

---

# 25. RAW IMAGE HANDLING

The raw camera image should be used temporarily during processing.

After the final CAP image has been successfully generated and persisted locally, do not unnecessarily retain the raw camera image in IndexedDB.

The final processed evidence image is the official CAP photo.

If raw archival is implemented later, it must be a separate optional feature.

---

# 26. PHOTO FILENAME

The official filename must be automatically generated as:

```text
{SERIAL}_{FINDINGS}_{LOCATION}_{YYYY-MM-DD}_{HH-mm-ss}.jpg
```

Example:

```text
001_Loose-Cable-Termination_MDB-Room_2026-09-19_14-32-15.jpg
```

Do not make the user type the filename.

---

# 27. FILENAME SANITIZATION

Replace filesystem-invalid characters:

```text
/
\
:
*
?
"
<
>
|
```

with safe characters such as:

```text
-
```

Remove unnecessary whitespace.

Example:

```text
Loose / Exposed Cable
```

becomes:

```text
Loose-Exposed-Cable
```

The visible watermark may retain the human-readable text.

---

# 28. LONG FILENAMES

If Findings or Location is very long:

* Keep the full value in the database/report.
* Normalize the filename.
* Apply a reasonable maximum filename length.
* Preserve enough information to identify the photograph.

Never let the filename become so long that Drive/filesystem handling becomes unreliable.

---

# 29. TIMESTAMP

The filename and watermark must use the **capture timestamp**, not the upload timestamp.

Example:

Photo captured:

```text
2026-09-19 14:32:15
```

Internet returns:

```text
2026-09-19 17:45:02
```

The photo must still show:

```text
19-09-2026 14:32
```

The synchronization time can be stored separately.

For offline operation, capture timestamp must be generated locally and retained with the queue record.

---

# 30. ORIGINAL PHOTO EXAMPLE

Filename:

```text
001_Loose-Cable-Termination_MDB-Room_2026-09-19_14-32-15.jpg
```

Watermark:

```text
001 | Loose Cable Termination | MDB Room | 19-09-2026 14:32
```

Photo structure:

```text
┌────────────────────────────────┐
│                                │
│                                │
│          ACTUAL PHOTO          │
│                                │
│                                │
│                                │
├────────────────────────────────┤
│ 001 | Loose Cable Termination  │
│ MDB Room | 19-09-2026 14:32    │
└────────────────────────────────┘
```

The photographic area remains square.

---

# 31. CORRECTED PHOTO WORKFLOW

Users must be able to view existing CAP observations in a gallery.

Gallery:

```text
001
Loose Cable Termination
MDB Room
Corrected: No

[VIEW]
```

When the user opens it:

```text
Original Photo
Zoom
Pan
Fullscreen
CORRECT
```

Pressing:

```text
CORRECT
```

must immediately open the camera.

---

# 32. CORRECTED PHOTO DATA

The user must NOT re-enter:

* Serial
* Findings
* Recommendation
* Location
* Plant
* Report date

These values come automatically from the selected observation.

The selected observation becomes the parent record.

Corrected photos are child evidence records.

---

# 33. MULTIPLE CORRECTED PHOTOS

One observation can have:

```text
001
 ├── Original
 ├── Corrected 01
 ├── Corrected 02
 └── Corrected 03
```

Never overwrite the original.

Never delete previous corrected photos.

Never replace corrected history.

---

# 34. CORRECTED PHOTO FILENAME

Use:

```text
{SERIAL}_{FINDINGS}_{LOCATION}_{DATE}_{TIME}_CORRECTED_{SEQUENCE}.jpg
```

Example:

```text
001_Loose-Cable-Termination_MDB-Room_2026-09-20_10-15-21_CORRECTED_01.jpg
```

Second correction:

```text
001_Loose-Cable-Termination_MDB-Room_2026-09-21_09-42-17_CORRECTED_02.jpg
```

---

# 35. CORRECTED PHOTO WATERMARK

Example:

```text
001 | Loose Cable Termination | MDB Room | 20-09-2026 10:15 | CORRECTED 01
```

The correction sequence must be generated automatically.

The server must validate it.

---

# 36. CAP REPORT PHOTO LINKS

The:

```text
Pictorial Evidence
```

field should reference the original Drive photo.

The:

```text
Corrected Pictures
```

field should reference all corrected photos belonging to that observation.

If multiple corrected photos exist, append them rather than replacing previous links.

Example:

```text
Corrected 01
Corrected 02
Corrected 03
```

The spreadsheet should remain readable.

---

# 37. OFFLINE-FIRST ARCHITECTURE

This is one of the most important requirements.

The application must work even if internet connectivity is:

* weak
* intermittent
* temporarily unavailable

The user must still be able to capture photos and create observations.

The architecture is:

```text
CAPTURE
 ↓
LOCAL PROCESSING
 ↓
INDEXEDDB
 ↓
USER CAN CONTINUE
 ↓
BACKGROUND SYNC
 ↓
GOOGLE DRIVE
 ↓
CAP REPORT
```

---

# 38. INDEXEDDB

Use IndexedDB.

Do NOT use localStorage for image blobs.

Recommended stores:

```text
photos
observations
syncQueue
reports
settings
```

Each queued photo should contain approximately:

```text
localId
recordId
reportId
plant
reportDate
observationSerial
photoType
correctionSequence
imageBlob
findings
recommendation
specificLocation
riskLevel
createdAt
createdBy
syncStatus
syncAttempts
lastSyncAttempt
lastSyncError
driveFileId
driveFileUrl
reportUpdated
idempotencyKey
```

---

# 39. LOCAL-FIRST SAVE

When a photo is captured:

```text
CAPTURE
 ↓
COMPRESS
 ↓
GENERATE FINAL 1:1 IMAGE
 ↓
ADD WATERMARK
 ↓
SAVE TO INDEXEDDB
 ↓
CONFIRM TRANSACTION
 ↓
SHOW "SAVED"
 ↓
START CLOUD SYNC
```

Never tell the user:

```text
Photo Saved
```

until the local persistence operation has actually succeeded.

---

# 40. ONLINE MODE

When internet is available:

```text
Capture
 ↓
Local Save
 ↓
Upload in background
 ↓
Drive success
 ↓
CAP report update
 ↓
Mark SYNCED
```

The user should not need to wait for the cloud process.

---

# 41. OFFLINE MODE

When offline:

```text
Capture
 ↓
Local Save
 ↓
Status = WAITING FOR SYNC
```

Display:

> Photo saved on this device — waiting for connection.

The user must NOT have to:

* retake the photo
* save manually to gallery
* copy a file
* re-enter data

---

# 42. AUTOMATIC SYNCHRONIZATION

Automatically attempt synchronization when:

* application loads
* user logs in
* browser comes online
* page becomes active
* user returns to application
* periodic retry timer triggers
* user presses `SYNC NOW`

Use:

```javascript
window.addEventListener("online", ...)
```

and periodic retry.

Background Sync API may be used when supported but must not be a hard dependency.

---

# 43. SYNC CENTER

Create:

```text
SYNC CENTER
```

Show:

```text
Pending Uploads
Currently Syncing
Successfully Synced
Failed
```

Example:

```text
SYNC CENTER

Pending: 3
Syncing: 1
Synced: 42
Failed: 1

[ SYNC NOW ]

001 Original       ✓ Synced
002 Corrected      ↻ Syncing
003 Original       ⏳ Waiting
004 Corrected      ! Failed

[ RETRY FAILED ]
```

---

# 44. SYNC STATUS

Each record should support:

```text
LOCAL
WAITING
SYNCING
SYNCED
FAILED
```

Use clear visual indicators.

Do not expose complicated technical errors to normal users.

---

# 45. RETRY STRATEGY

Use exponential backoff.

Example:

```text
Failure 1 → 5 seconds
Failure 2 → 15 seconds
Failure 3 → 30 seconds
Failure 4 → 1 minute
Failure 5 → 5 minutes
```

After repeated failures:

```text
NEEDS ATTENTION
```

but never delete the local photo.

---

# 46. PARTIAL FAILURE

Handle this case carefully:

```text
Drive upload = SUCCESS
CAP report update = FAILED
```

Store:

```text
driveFileId
driveFileUrl
```

Then retry only the CAP report update.

Do not upload the photo again.

Similarly:

```text
CAP report update = SUCCESS
client response lost
```

must not cause duplicate report entries.

---

# 47. IDEMPOTENCY

Every operation must have a unique idempotency key.

Original:

```text
CIPL_20260919_001_ORIGINAL_<UUID>
```

Corrected:

```text
CIPL_20260919_001_CORRECTED_01_<UUID>
```

The backend must check whether the key has already been processed.

If it has:

```text
Do not create duplicate Drive file.
Do not create duplicate observation.
Do not create duplicate corrected entry.
Return existing result.
```

This protects against:

* double-clicks
* network retries
* page refresh
* connection drops
* duplicate synchronization

---

# 48. SERVER-SIDE SERIAL ASSIGNMENT

The frontend may display:

```text
Next Serial: 007
```

but final assignment must be server-side.

Use Apps Script:

```text
LockService
```

or equivalent locking.

Never depend solely on client-side counters.

---

# 49. PHOTO QUEUE

Example:

```text
PHOTO QUEUE

001  Original   ✓ Synced
002  Original   ⏳ Waiting
003  Corrected  ↻ Uploading
004  Original   ! Failed
```

Users should be able to continue their work while this queue processes.

---

# 50. PHOTO VIEWER

Implement:

```text
Zoom In
Zoom Out
Reset
Pan
Fullscreen
Close
```

On mobile:

```text
Pinch to zoom
Drag to pan
Double tap zoom
```

Load thumbnails in the gallery.

Load full-resolution evidence only when opened.

---

# 51. GALLERY PERFORMANCE

Do not load every original photo when opening the gallery.

Use:

```text
thumbnail
```

for gallery cards.

Lazy-load older items.

Load the full photo only after selection.

This is especially important for mobile networks.

---

# 52. CLIENT-SIDE CACHING

Cache:

* Plant metadata
* Report metadata
* Observation metadata
* Thumbnails
* Sync state

Do not store passwords.

---

# 53. DOUBLE-SUBMISSION PROTECTION

Prevent accidental duplicate operations.

For:

```text
SAVE
SUBMIT
CORRECT
```

disable duplicate interaction while the operation is being processed.

However, the local-first architecture must still ensure that even repeated requests cannot create duplicate cloud records.

---

# 54. CANONICAL PHOTO METADATA

Create one canonical metadata object before generating the photo.

Example:

```javascript
const photoMetadata = {
  serial,
  findings,
  location,
  reportDate,
  captureTimestamp,
  photoType,
  correctionSequence
};
```

Use the same metadata for:

```text
Filename
Watermark
IndexedDB
Google Drive
CAP Report
Audit Log
```

This prevents inconsistencies.

---

# 55. SECURITY

All Google Drive and Google Sheets operations must occur server-side.

Do not expose:

* credentials
* privileged tokens
* admin passwords
* private spreadsheet credentials

to the frontend.

Server must validate:

```text
User
Role
Plant
Report
Observation
Photo Type
Authorization
```

A user must never gain access to another plant by changing request parameters.

---

# 56. GOOGLE DRIVE UPLOAD

The backend should:

1. Validate session.
2. Validate plant authorization.
3. Validate report.
4. Validate observation.
5. Locate/create correct Drive folder.
6. Check idempotency key.
7. Upload file.
8. Store Drive file ID.
9. Update CAP report.
10. Write audit log.
11. Return success.

---

# 57. DRIVE FOLDER STRUCTURE

Original and corrected photos should remain within:

```text
CAP Photos
    ↓
Plant
    ↓
Date
```

Example:

```text
CAP Photos
└── CIPL
    └── 2026-09-19
        ├── 001_Loose-Cable-Termination_MDB-Room_2026-09-19_14-32-15.jpg
        ├── 002_Damaged-Insulation_MDB-Room_2026-09-19_14-45-03.jpg
        └── 001_Loose-Cable-Termination_MDB-Room_2026-09-20_10-15-21_CORRECTED_01.jpg
```

---

# 58. REPORT CREATION

When opening a plant/date report:

```text
Check whether report already exists.
```

If it exists:

```text
Open it.
```

If it does not:

```text
Copy/create from the supplied CAP template.
```

Do not create duplicates.

---

# 59. REPORT ID

Use:

```text
{PLANT}_{YYYY-MM-DD}
```

Example:

```text
CIPL_2026-09-19
```

Use this internally to identify the report.

---

# 60. OBSERVATION ID

Use a stable internal ID such as:

```text
{REPORT_ID}_{SERIAL}
```

plus an internal UUID where necessary.

Example:

```text
CIPL_2026-09-19_001_<UUID>
```

---

# 61. CORRECTED PHOTO ID

Use:

```text
{OBSERVATION_ID}_CORRECTED_{SEQUENCE}_{UUID}
```

This ensures that corrected evidence remains linked to its parent observation.

---

# 62. ORIGINAL PHOTO MUST NEVER BE OVERWRITTEN

Strict requirement.

Once uploaded:

```text
Original Photo
```

must remain unchanged.

Corrections are additional evidence.

Never replace the original with the corrected photograph.

---

# 63. CORRECTION HISTORY

The gallery should show:

```text
Original
Corrected 01
Corrected 02
Corrected 03
```

with timestamps.

Example:

```text
001 — Loose Cable Termination

Original
19 Sep 2026 14:32

Corrected 01
20 Sep 2026 10:15

Corrected 02
21 Sep 2026 09:42
```

---

# 64. OBSERVATION GALLERY

Gallery card:

```text
┌──────────────────────┐
│      Thumbnail       │
├──────────────────────┤
│ #001                 │
│ Loose Cable...       │
│ MDB Room             │
│ Risk: High           │
│ Corrected: Yes       │
│                      │
│ [ VIEW ] [ CORRECT ] │
└──────────────────────┘
```

Do not load full images until requested.

---

# 65. FIELD-FRIENDLY UX

The application is intended for real field engineers.

Therefore:

* Large touch targets
* Minimal typing
* High readability
* Fast navigation
* Camera-first workflow
* Clear status indicators
* Minimal unnecessary dialogs
* No complex menus
* No decorative animations that slow the application
* Responsive desktop/mobile layout

Do not make it look like a generic AI-generated dashboard.

It should look like a serious internal engineering tool.

---

# 66. VISUAL DESIGN

Use:

* Clean engineering dashboard
* Professional typography
* Clear hierarchy
* Neutral background
* Strong contrast
* Compact cards
* Large buttons for field use
* Responsive tables
* Mobile bottom actions where appropriate

Avoid:

* excessive gradients
* excessive glassmorphism
* oversized decorative elements
* unnecessary animations
* generic marketing website appearance

---

# 67. ORIGINAL OBSERVATION FORM

Recommended form:

```text
ADD OBSERVATION

[ CAMERA ]

Photo Preview

Serial
001

Findings / Issues
[____________________________]

Recommendation
[____________________________]

Specific Location
[____________________________]

General Location
[____________________________]

Risk Level
[ LOW ▼ ]

Responsible
[____________________________]

Deadline
[____________________________]

Remarks
[____________________________]

[ SAVE OBSERVATION ]
```

Only make required fields mandatory where the existing CAP template requires them.

---

# 68. CAP OBSERVATION VIEW

When opening an observation:

```text
Serial
Findings
Recommendation
Location
Risk Level
Responsible
Deadline
Original Photo
Corrected Photos
Remarks
Sync Status
History
```

Actions:

```text
CORRECT
VIEW PHOTO
VIEW HISTORY
```

---

# 69. REPORT HISTORY

Provide access to previous date-wise reports.

Example:

```text
CIPL

19 Sep 2026
18 Sep 2026
17 Sep 2026
16 Sep 2026
```

Opening a historical report should not accidentally create a new report.

---

# 70. ADMIN FEATURES

Admin should have:

```text
Plant Selection
Report Selection
Observation Gallery
Sync Center
User Management
System Logs
Report History
```

Admin can inspect synchronization failures and operational logs.

---

# 71. PLANT USER RESTRICTIONS

Plant user must NOT:

* open another plant's report
* upload another plant's photo
* modify another plant's observation
* modify another plant's corrected evidence

Even if they manipulate frontend JavaScript or API parameters.

All authorization must be checked server-side.

---

# 72. OFFLINE SECURITY

Local IndexedDB contains potentially sensitive operational information.

Therefore:

* Do not store passwords.
* Store only necessary report/photo information.
* Provide logout.
* Consider clearing sensitive session data on logout.
* Do not expose internal Drive credentials.
* Do not display private Drive information unnecessarily.

---

# 73. ERROR HANDLING

Handle:

### Camera permission denied

Show:

> Camera access is required to capture photographic evidence. Please allow camera access in your browser settings.

### Storage unavailable

Show a clear warning before allowing the user to assume the photo is safely saved.

### Internet unavailable

Show:

> Offline — photos will be synchronized automatically when connection returns.

### Drive failure

Show:

> Photo saved safely on this device. Cloud synchronization will retry automatically.

### Report update failure

Keep the Drive file ID and retry the report update.

---

# 74. NEVER CLAIM A PHOTO IS SAVED IF IT IS NOT

The UI must distinguish:

```text
Captured
```

from:

```text
Saved Locally
```

from:

```text
Uploaded
```

from:

```text
Report Updated
```

Only show:

> **Fully Synced**

after both the Drive upload and CAP report update are confirmed.

---

# 75. SYNC TRANSACTION

Preferred sequence:

```text
1. Capture
2. Process
3. Save locally
4. Create queue record
5. Upload to Drive
6. Store Drive file ID
7. Update CAP report
8. Verify
9. Mark queue item SYNCED
```

If step 5 fails:

```text
Retry step 5
```

If step 7 fails:

```text
Do not repeat step 5
Retry step 7
```

---

# 76. PERFORMANCE OPTIMIZATION

Optimize for:

* Android phones
* Chrome
* Mobile networks
* Weak Wi-Fi
* Intermittent connectivity
* Low-to-mid-range devices

Avoid unnecessary JavaScript libraries.

Compress images before upload.

Lazy-load images.

Cache thumbnails.

Avoid large initial bundles.

Do not reload the entire report after every observation.

Update only the required UI state.

---

# 77. FAST OBSERVATION ENTRY

After saving observation #001, the user should be able to immediately start #002.

Do not force:

```text
Upload completed
Report refreshed
Drive synchronized
```

before allowing the next capture.

Ideal experience:

```text
001 Capture
 ↓
Local Save
 ↓
Next
 ↓
002 Capture
 ↓
Local Save
 ↓
Next
 ↓
003 Capture
```

Meanwhile:

```text
Background Sync
001 → Drive
002 → Drive
003 → Drive
```

---

# 78. SYNC NOW

Provide a visible:

```text
SYNC NOW
```

button.

When pressed:

```text
Process all pending queue items
```

with safe concurrency.

Do not upload the same record twice.

---

# 79. SYNC CONCURRENCY

Do not launch unlimited simultaneous uploads.

Use a small controlled number of concurrent operations.

For example:

```text
2–3 uploads at a time
```

or adapt based on connection quality.

This prevents:

* mobile bandwidth saturation
* browser memory problems
* Apps Script request overload

---

# 80. PHOTO WATERMARK RENDERING

Use Canvas API or equivalent client-side image processing.

The process should:

1. Read final square image.
2. Create expanded canvas.
3. Draw square image at top.
4. Draw white strip at bottom.
5. Draw separator.
6. Calculate text width.
7. Fit metadata text.
8. Draw metadata.
9. Export final JPEG.
10. Save final Blob to IndexedDB.

Never modify the original photograph pixels to place the watermark over the scene.

---

# 81. PHOTO CANVAS STRUCTURE

Conceptually:

```text
Canvas Width = Photo Width

Photo Height = Photo Width

Watermark Height = dynamically calculated

Canvas Height =
Photo Height + Watermark Height
```

Therefore:

```text
Photographic area = 1:1
```

while the complete exported image includes the metadata strip.

---

# 82. WATERMARK QUALITY

Ensure:

* No pixelation
* No clipped text
* No overflow
* No overlapping
* Good contrast
* Consistent margins
* Consistent font
* Consistent separator
* Consistent formatting across all plants

Use appropriate font scaling based on image resolution.

---

# 83. CANONICAL DATE/TIME FORMAT

Filename:

```text
YYYY-MM-DD_HH-mm-ss
```

Example:

```text
2026-09-19_14-32-15
```

Visible watermark:

```text
19-09-2026 14:32
```

Use the configured local timezone for the plant/report.

For Bangladesh operations, default to:

```text
Asia/Dhaka
```

unless the application configuration explicitly specifies otherwise.

---

# 84. PHOTO METADATA EXAMPLE

Original:

```text
Serial:
001

Findings:
Loose Cable Termination

Location:
MDB Room

Capture:
19 September 2026
14:32:15
```

Filename:

```text
001_Loose-Cable-Termination_MDB-Room_2026-09-19_14-32-15.jpg
```

Watermark:

```text
001 | Loose Cable Termination | MDB Room | 19-09-2026 14:32
```

---

# 85. CORRECTED METADATA EXAMPLE

Original serial:

```text
001
```

Correction:

```text
01
```

Filename:

```text
001_Loose-Cable-Termination_MDB-Room_2026-09-20_10-15-21_CORRECTED_01.jpg
```

Watermark:

```text
001 | Loose Cable Termination | MDB Room | 20-09-2026 10:15 | CORRECTED 01
```

---

# 86. DATA CONSISTENCY

The same observation metadata must be used everywhere.

For example:

```text
Finding:
Loose Cable Termination

Location:
MDB Room
```

must not become:

```text
Filename:
Loose-Cable-Termination

Watermark:
Cable Issue

Spreadsheet:
Loose Cable Problem
```

unless the user actually edited the underlying record.

All representations must derive from the same canonical record.

---

# 87. DATABASE/REPORT UPDATE

When a photo is successfully synchronized:

For original:

```text
Pictorial Evidence
```

must be updated.

For corrected:

```text
Corrected Pictures
```

must be appended/updated.

Do not erase previous corrected evidence.

---

# 88. TECHNICAL METADATA

Maintain technical metadata internally:

```text
recordId
idempotencyKey
driveFileId
driveFileUrl
localId
createdAt
uploadedAt
syncStatus
syncAttempts
lastSyncError
```

This may be stored in:

* Master Data technical sheet
* hidden technical sheet
* backend metadata

depending on the safest implementation.

Do not disrupt the visible CAP report format.

---

# 89. GOOGLE SHEETS WRITE SAFETY

Do not rewrite the entire spreadsheet for every photo.

Perform targeted updates where possible.

Avoid unnecessary:

```text
getDataRange()
setValues()
```

operations on huge sheets.

Use precise ranges.

Batch operations where practical.

---

# 90. GOOGLE DRIVE WRITE SAFETY

Before creating a folder:

```text
Check whether it already exists.
```

Before creating a report:

```text
Check whether it already exists.
```

Before uploading a photo:

```text
Check idempotency key.
```

Avoid duplicate Drive files.

---

# 91. REPORT TEMPLATE SAFETY

Never modify the master template itself when creating a new daily report.

Create a copy.

Example conceptual process:

```text
MASTER TEMPLATE
       ↓
COPY
       ↓
PLANT + DATE REPORT
```

The master template must remain untouched.

---

# 92. TESTING REQUIREMENTS

Before considering the application complete, test:

### Authentication

* Correct login
* Wrong password
* Disabled user
* Plant authorization
* Admin access

### Original photos

* Capture
* Retake
* 1:1 crop
* Watermark
* Filename
* Drive upload
* Report update

### Corrected photos

* Select observation
* View original
* Zoom
* Correct
* Capture
* Watermark
* Corrected filename
* Multiple corrections

### Offline

* Capture while offline
* Save locally
* Refresh page
* Close browser
* Reopen
* Reconnect
* Automatic sync
* Manual sync

### Failure recovery

* Drive upload failure
* Sheet update failure
* Network drop during upload
* Duplicate submit
* Duplicate sync
* Browser refresh during sync

### Concurrency

* Two observations simultaneously
* Serial collision prevention
* Corrected sequence collision prevention

### Template

* Existing formulas
* Summary
* Formatting
* Conditional formatting
* Dropdowns
* Images
* Print layout

---

# 93. ACCEPTANCE TEST

The following scenario must work:

### Scenario

User logs into CIPL.

Opens:

```text
19 September 2026
```

Takes a photo.

The camera captures the image.

The application converts it to 1:1.

The user enters:

```text
Finding:
Loose Cable Termination

Location:
MDB Room
```

The application generates:

```text
001_Loose-Cable-Termination_MDB-Room_2026-09-19_14-32-15.jpg
```

The final photo contains:

```text
1:1 photographic area
+
white bottom strip
+
001 | Loose Cable Termination | MDB Room | 19-09-2026 14:32
```

The image is saved locally.

The user immediately captures observation #002.

Internet is unavailable.

#001 and #002 remain safely queued.

Internet returns.

The application automatically uploads both.

The CAP report receives the correct Pictorial Evidence links.

Later the user opens #001.

Presses:

```text
CORRECT
```

Camera opens immediately.

User captures the corrected condition.

Application generates:

```text
001_Loose-Cable-Termination_MDB-Room_2026-09-20_10-15-21_CORRECTED_01.jpg
```

Watermark:

```text
001 | Loose Cable Termination | MDB Room | 20-09-2026 10:15 | CORRECTED 01
```

The corrected photo is saved locally and uploaded automatically.

The CAP report's Corrected Pictures field is updated.

The original photo remains untouched.

---

# 94. FAILURE TEST

Simulate:

```text
Capture
 ↓
Local Save
 ↓
Internet OFF
 ↓
Capture 5 photos
 ↓
Close browser
 ↓
Reopen application
 ↓
Login
 ↓
Internet ON
```

All five photos must still exist in the local queue and eventually synchronize.

No photo may disappear.

No duplicate Drive files may be created.

---

# 95. UI STATUS EXAMPLE

At the top of the application:

```text
CIPL
19 September 2026

● ONLINE
✓ 12 Synced
⏳ 2 Pending
```

When offline:

```text
CIPL
19 September 2026

● OFFLINE
⏳ 5 Waiting for Sync
```

When synchronization starts:

```text
↻ Syncing 2 of 5
```

After success:

```text
✓ All Photos Synced
```

---

# 96. NO MANUAL FILE MANAGEMENT

The user must never need to:

* Open Google Drive
* Create folders
* Rename photos
* Copy URLs
* Upload files manually
* Open the spreadsheet to enter a photo
* Search for the correct report
* Re-enter observation information for correction

The application must automate all of this.

---

# 97. IMPLEMENTATION QUALITY

Write maintainable production-quality code.

Separate:

```text
Authentication
Configuration
Camera
Image Processing
IndexedDB
Sync Queue
Drive API
Sheets API
Report Management
Observation Management
Gallery
Photo Viewer
Logging
Authorization
```

Do not create one enormous JavaScript file containing every operation if modular organization is practical.

Add comments around complex synchronization and idempotency logic.

---

# 98. CONFIGURATION

Keep infrastructure configuration centralized.

Conceptually:

```javascript
const CONFIG = {
  MASTER_SPREADSHEET_ID:
    "1BT01JVkSxbYdJCuIwffxclGz_sW2e8cDAKpNyC3r28I",

  CAP_PHOTO_ROOT_FOLDER_ID:
    "146wZBm_yvNbEIXKfqrT-wXQnnbbfQ6_N",

  PLANTS: {
    "EGMCL 2":
      "1cVlGvRf8ezIMEmMRzRjdSC2FanXbGcT7",

    "CIPL":
      "13XyI1a5uFv2crHNhy-wYHI7i8jrP1X_6",

    "GTL":
      "1T9mx0VPB6FtfKMlxDNJfY4ef44AbAof1",

    "PGCL":
      "1qv7wsp1mk5MsNVkdbtZvu7WmMkNyimZl"
  }
};
```

Do not expose privileged configuration unnecessarily to the frontend.

---

# 99. DEPLOYMENT

First make the application fully functional as:

```text
Google Apps Script Web App
```

Verify:

* HTTPS
* Camera permission
* Authentication
* Drive
* Sheets
* Offline storage
* Synchronization
* Report creation
* Photo processing

After the system is stable, structure the frontend so it can later be hosted on:

```text
Vercel
```

with Apps Script or another backend providing API functionality.

Do not compromise the working system merely to force immediate Vercel deployment.

---

# 100. FINAL PRODUCT DEFINITION

The finished application should effectively work as:

> **An offline-first Electrical CAP Field Inspection and Corrective Evidence Management System.**

The engineer should be able to:

```text
LOGIN
 ↓
SELECT/OPEN PLANT REPORT
 ↓
TAKE PHOTO
 ↓
PHOTO AUTOMATICALLY BECOMES 1:1
 ↓
WHITE METADATA STRIP ADDED
 ↓
SERIAL/FINDING/LOCATION/DATE/TIME DISPLAYED
 ↓
AUTOMATIC FILENAME GENERATED
 ↓
PHOTO SAVED LOCALLY
 ↓
OBSERVATION SAVED
 ↓
NEXT OBSERVATION
```

while the system automatically handles:

```text
Image compression
Image processing
Watermark generation
Filename generation
IndexedDB storage
Offline queue
Automatic synchronization
Google Drive folder creation
Google Drive upload
CAP report update
Summary update
Corrected evidence
Correction history
Duplicate prevention
Serial management
Audit logging
Retry
Error recovery
```

---

# 101. MOST IMPORTANT RULES

The following rules override convenience:

### RULE 1

**Never lose a captured photo.**

### RULE 2

**Never require internet connectivity for basic photo capture.**

### RULE 3

**Save locally before claiming success.**

### RULE 4

**Never overwrite original CAP evidence.**

### RULE 5

**Never create duplicate cloud records during retries.**

### RULE 6

**Never cover the photographic evidence with the watermark.**

### RULE 7

**The photographic area must be 1:1.**

### RULE 8

**The watermark must be a separate white strip below the photo.**

### RULE 9

**Filename and watermark must come from the same canonical metadata.**

### RULE 10

**The user should never manually manage Drive files or spreadsheet photo links.**

### RULE 11

**Plant authorization must be enforced server-side.**

### RULE 12

**The existing CAP template, formulas, Summary, formatting, and reporting logic must be preserved.**

---

# 102. FINAL USER EXPERIENCE GOAL

The entire system should feel like this:

```text
                 FIELD ENGINEER
                       │
                       ▼
                 FIND AN ISSUE
                       │
                       ▼
                  TAKE PHOTO
                       │
                       ▼
                ENTER FINDING
                       │
                       ▼
                 ENTER LOCATION
                       │
                       ▼
                     SAVE
                       │
                       ▼
             IMMEDIATELY MOVE ON
                       │
                       ▼
              NEXT OBSERVATION
```

At the same time, invisibly in the background:

```text
                 CAPTURED IMAGE
                       │
                       ▼
                 1:1 PROCESSING
                       │
                       ▼
              WATERMARK GENERATION
                       │
                       ▼
                FILE NAME GENERATION
                       │
                       ▼
                 INDEXEDDB SAVE
                       │
                       ▼
                  SYNC QUEUE
                       │
                       ▼
                GOOGLE DRIVE
                       │
                       ▼
                 CAP REPORT
                       │
                       ▼
                   SUMMARY
                       │
                       ▼
                  AUDIT LOG
```

The system should therefore behave like a **reliable field inspection tool**, not like a spreadsheet with a camera attached.

---

# 103. IMPLEMENTATION INSTRUCTION TO ANTIGRAVITY

Do not immediately start generating random files.

First:

1. Inspect the supplied CAP template.
2. Identify the exact report structure.
3. Identify formulas and Summary logic.
4. Identify where observation rows are written.
5. Design the data mapping.
6. Design the authentication model.
7. Design the IndexedDB schema.
8. Design the synchronization state machine.
9. Design the photo processing pipeline.
10. Design the Drive/report synchronization process.
11. Then implement the application.

After implementation:

1. Test online capture.
2. Test offline capture.
3. Test browser refresh.
4. Test browser restart.
5. Test automatic synchronization.
6. Test failed uploads.
7. Test duplicate retries.
8. Test corrected photos.
9. Test multiple corrected photos.
10. Test concurrent serial assignment.
11. Test Google Drive folder creation.
12. Test CAP report updates.
13. Test Summary calculations.
14. Test mobile camera behavior.
15. Test final image dimensions and watermark.
16. Test all four plants.
17. Test plant authorization.
18. Test admin access.

Do not consider the project complete until the complete workflow works end-to-end.

## FINAL OBJECTIVE

Build a reliable, fast, offline-first, mobile-friendly **Electrical Internal CAP Report and Corrective Evidence System** where the field engineer can capture evidence in seconds and continue working, while the application automatically handles photo formatting, 1:1 processing, watermarking, intelligent filenames, local storage, synchronization, Google Drive organization, CAP report updates, correction history, and audit logging.

The application must prioritize **field usability, evidence integrity, speed, and reliability above unnecessary UI complexity.**
