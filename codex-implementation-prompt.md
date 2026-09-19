# Codex Implementation Prompt: Role-Based Plant Reports, Google Sheets Sync, and Drive Storage

You are working in the repository:

`E:\Antigravity\Epic@Utility`

Before changing code, read:

- `memo.md`
- `prompt.md`
- `backend/Code.gs`
- `js/app.js`
- `js/apiService.js`
- `js/syncEngine.js`
- `js/db.js`
- `js/recordModel.js`
- `index.html`
- `styles.css`

## Goal

Update the existing Electrical Internal CAP Report system so it supports a proper user database, role-based login, plant-level access control, Google Drive plant folders, date-wise CAP report files, CAP photo storage, and live frontend data served from Google Sheets.

The user has already built the base system and environment. Do not rebuild from scratch. Preserve the current offline-first CAP report/photo workflow, the existing Google Apps Script backend approach, and the existing Google Sheets/Drive integration.

## Roles and Access Rules

There are two user types:

1. `ADMIN`
2. `PLANT_USER`

Admin behavior:

- Admin can log in and access everything.
- Admin can create CAP reports.
- Admin can create or open date-wise report sheets.
- Admin can switch between all plants.
- Admin can view all plant reports, all plant folders, and all synced data.

Plant user behavior:

- Plant users can log in using credentials stored in the Master Data Spreadsheet.
- Plant users must be locked to their assigned plant.
- Plant users must only see their own plant data in the frontend.
- Plant users must not be able to view, request, open, or infer reports from other plants.
- Enforce this both in the frontend and in `backend/Code.gs`; frontend checks alone are not enough.

Plant users/plants:

- `CIPL`
- `EGMCL 2`
- `PGCL`
- `GTL`

## Master Data Spreadsheet

Use this spreadsheet as the authoritative user/login/config/log database:

`https://docs.google.com/spreadsheets/d/1BT01JVkSxbYdJCuIwffxclGz_sW2e8cDAKpNyC3r28I/edit?gid=0#gid=0`

Spreadsheet ID:

`1BT01JVkSxbYdJCuIwffxclGz_sW2e8cDAKpNyC3r28I`

Expected tabs:

- `Users`: stores username, password or password hash if implemented, role, assigned plant, active status.
- `Logs`: stores login attempts, successful logins, report creation/opening, sync activity, and important backend actions.
- `System_Config`: stores app-level config if already used by the codebase.

If these tabs do not exist or their headers differ, update the backend defensively:

- Create missing tabs when safe.
- Validate required headers.
- Return clear errors when the sheet structure is invalid.

## Google Drive Plant Report Folders

Date-wise, plant-wise report spreadsheets must be stored in the correct Google Drive folder.

Folder mapping:

- `EGMCL 2`: `https://drive.google.com/drive/folders/1cVlGvRf8ezIMEmMRzRjdSC2FanXbGcT7`
- `CIPL`: `https://drive.google.com/drive/folders/13XyI1a5uFv2crHNhy-wYHI7i8jrP1X_6`
- `GTL`: `https://drive.google.com/drive/folders/1T9mx0VPB6FtfKMlxDNJfY4ef44AbAof1`
- `PGCL`: `https://drive.google.com/drive/folders/1qv7wsp1mk5MsNVkdbtZvu7WmMkNyimZl`

Folder IDs:

- `EGMCL 2`: `1cVlGvRf8ezIMEmMRzRjdSC2FanXbGcT7`
- `CIPL`: `13XyI1a5uFv2crHNhy-wYHI7i8jrP1X_6`
- `GTL`: `1T9mx0VPB6FtfKMlxDNJfY4ef44AbAof1`
- `PGCL`: `1qv7wsp1mk5MsNVkdbtZvu7WmMkNyimZl`

Report naming format:

`{Plant Name}- Electrical Internal CAP Report - {Date}`

Example:

`CIPL- Electrical Internal CAP Report - 2026-09-19`

Use the existing authoritative template and preserve formatting/formulas. Do not create generic blank spreadsheets unless the existing implementation already intentionally does so as a fallback.

## CAP Photo Storage

CAP photos must be stored under this root Drive folder:

`https://drive.google.com/drive/folders/146wZBm_yvNbEIXKfqrT-wXQnnbbfQ6_N`

Folder ID:

`146wZBm_yvNbEIXKfqrT-wXQnnbbfQ6_N`

Inside this root, the system must create or reuse folders by plant, then date:

`CAP Photos/{Plant}/{YYYY-MM-DD}/`

The photo workflow must continue to:

- Save original pictorial evidence.
- Save corrected/rectified photos.
- Write Drive image links back into the correct Google Sheet columns.
- Keep the 1:1 image crop and watermark behavior already described in `memo.md`.

## Frontend Behavior

After login:

- The user should land on the CAP Reports/report hub view.
- Admin sees all plants and can filter/switch plants.
- Plant users see only their assigned plant.
- The report list should load from Google Drive/Sheets through the Apps Script backend.
- Each report card should show meaningful summary data where available:
  - report date
  - report name
  - plant
  - total findings
  - rectified count
  - pending/not rectified count
  - sync/open status if already supported

When a report is opened:

- The frontend should show the whole report data served from the linked Google Sheet.
- Data must stay synced with the Google Sheet.
- New observations and rectification updates must update both local/offline state and the Google Sheet when sync is available.
- Do not allow plant users to select or pass another plant manually from the browser to bypass access.

## Backend Behavior

Update `backend/Code.gs` as needed so every API action validates:

- user identity/session payload
- role
- assigned plant
- requested plant/report access

Required backend capabilities:

- login against the `Users` tab
- log login success/failure to `Logs`
- list reports for allowed plant(s)
- create/open date-wise report files in the proper plant folder
- read full report rows from the selected report spreadsheet
- write new CAP observations to the selected report spreadsheet
- write rectification photo links and remarks back to the selected report spreadsheet
- save or locate CAP photo folders by plant/date
- return structured JSON responses with clear `success`, `error`, and data fields

Security rule:

Never trust a plant value supplied by the frontend unless the backend confirms that the logged-in user is allowed to access that plant.

## Data Sync Rules

The Google Sheet is the shared source of truth for reports once synced.

The frontend may cache data in IndexedDB for offline work, but when online:

- report lists come from Drive/Sheets via Apps Script
- full report rows come from the report spreadsheet
- newly captured CAP records sync back to Sheets
- rectification status syncs back to Sheets
- frontend UI updates after successful sync

Avoid breaking the existing offline queue. If offline, store pending work locally and sync later.

## Important Existing Invariants

Preserve these existing system rules:

- Use the existing CAP template as authoritative.
- Do not overwrite template formulas or formatting.
- Keep existing Summary formulas working.
- Keep row/column mapping from `memo.md`.
- Preserve strict plant isolation.
- Preserve existing IndexedDB/offline-first behavior.
- Preserve photo processing, 1:1 crop, and watermark strip behavior.
- Keep the current Google Apps Script Web App deployment pattern.
- Do not introduce a separate server unless explicitly requested.

## Acceptance Criteria

The work is complete when:

1. Admin can log in and view/create/open reports for all four plants.
2. A CIPL user can only view CIPL reports and cannot access EGMCL 2, PGCL, or GTL data.
3. An EGMCL 2 user can only view EGMCL 2 reports.
4. A PGCL user can only view PGCL reports.
5. A GTL user can only view GTL reports.
6. Report files are saved in the correct plant Drive folder.
7. CAP photos are saved under the CAP Photos root folder by plant/date.
8. The frontend report hub is populated from Google Drive/Sheets through Apps Script.
9. Opening a report shows the full report from the Google Sheet.
10. Creating observations and submitting rectification photos updates the Google Sheet.
11. Login attempts and important actions are written to the `Logs` tab.
12. Offline behavior still works and pending work syncs when online.

## Implementation Notes

Prefer small, focused changes that follow the current codebase style.

After changes:

- run any available build/check command, likely `npm run build`
- inspect browser console/runtime behavior if running locally
- update `memo.md` if new endpoints, tabs, data structures, or deployment steps change
- document any manual Apps Script redeployment step required

