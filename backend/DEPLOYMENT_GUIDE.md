# Google Cloud Direct API Architecture Guide (Retiring Apps Script)

> **Notice:** Google Apps Script (`backend/Code.gs`) is **retired and no longer used**. The application connects directly to **Google Sheets API v4** and **Google Drive API v3**, cutting response times from 3–8 seconds down to **~150–250ms**.

---

## 1. Cloud Assets Directory

### Plant Google Spreadsheets (Workbooks with Date-wise Tabs):
- **CIPL**: [https://docs.google.com/spreadsheets/d/1Nui7xNg7OP8--Ngy_UPZE9Jkfn-3sN90UosJR-9Ms0o/edit](https://docs.google.com/spreadsheets/d/1Nui7xNg7OP8--Ngy_UPZE9Jkfn-3sN90UosJR-9Ms0o/edit)
- **PGCL**: [https://docs.google.com/spreadsheets/d/1PYH98QdeKzvj7gcNDwHzfNBsrxoD9CZhQhyVaXkHFls/edit](https://docs.google.com/spreadsheets/d/1PYH98QdeKzvj7gcNDwHzfNBsrxoD9CZhQhyVaXkHFls/edit)
- **GTL**: [https://docs.google.com/spreadsheets/d/1TuoTm37XEu-a9QznqFRccBnPsmINV99nOZfavt0boeA/edit](https://docs.google.com/spreadsheets/d/1TuoTm37XEu-a9QznqFRccBnPsmINV99nOZfavt0boeA/edit)
- **EGMCL 2**: [https://docs.google.com/spreadsheets/d/1Ejx7YRY-QmoIzEFY6_KCC04b3celsrzDlshKDGTtN54/edit](https://docs.google.com/spreadsheets/d/1Ejx7YRY-QmoIzEFY6_KCC04b3celsrzDlshKDGTtN54/edit)

### Master Data Spreadsheet (Users, Logs, Config):
- **Master Sheet**: [https://docs.google.com/spreadsheets/d/1BT01JVkSxbYdJCuIwffxclGz_sW2e8cDAKpNyC3r28I/edit](https://docs.google.com/spreadsheets/d/1BT01JVkSxbYdJCuIwffxclGz_sW2e8cDAKpNyC3r28I/edit)

### Google Drive Photo Storage Root Folder:
- **CAP Photos Root**: [https://drive.google.com/drive/folders/146wZBm_yvNbEIXKfqrT-wXQnnbbfQ6_N](https://drive.google.com/drive/folders/146wZBm_yvNbEIXKfqrT-wXQnnbbfQ6_N)

---

## 2. One-Time Setup: Share Assets with Service Account

To allow the direct Google Cloud API to read and write without any Apps Script intermediate, share the resources with the service account:

- **Service Account Email**: `photo-75@photo-logger-506516.iam.gserviceaccount.com`
- **Role**: **Editor**

### Sharing Steps:
1. Open the [Root Drive Folder (146wZBm...)](https://drive.google.com/drive/folders/146wZBm_yvNbEIXKfqrT-wXQnnbbfQ6_N).
2. Click **Share** -> Add `photo-75@photo-logger-506516.iam.gserviceaccount.com` -> Select **Editor** -> Click **Send**.
3. Open each spreadsheet ([Master Sheet](https://docs.google.com/spreadsheets/d/1BT01JVkSxbYdJCuIwffxclGz_sW2e8cDAKpNyC3r28I/edit), [CIPL](https://docs.google.com/spreadsheets/d/1Nui7xNg7OP8--Ngy_UPZE9Jkfn-3sN90UosJR-9Ms0o/edit), [PGCL](https://docs.google.com/spreadsheets/d/1PYH98QdeKzvj7gcNDwHzfNBsrxoD9CZhQhyVaXkHFls/edit), [GTL](https://docs.google.com/spreadsheets/d/1TuoTm37XEu-a9QznqFRccBnPsmINV99nOZfavt0boeA/edit), [EGMCL 2](https://docs.google.com/spreadsheets/d/1Ejx7YRY-QmoIzEFY6_KCC04b3celsrzDlshKDGTtN54/edit)).
4. Click **Share** -> Add `photo-75@photo-logger-506516.iam.gserviceaccount.com` as **Editor**.

*(Sharing the root Drive folder automatically propagates permissions to all plant and date folders inside it!)*

---

## 3. How It Works (Zero-Apps-Script Architecture)

1. **Token Minting**: When the application runs via `npm run dev` (Vite) or production server, `vite.config.js` securely mints an OAuth 2.0 access token in **<5ms** using RS256 JWT assertion from `.env.local`.
2. **Direct REST API Calls**: The client calls:
   - `https://sheets.googleapis.com/v4/spreadsheets/...` directly to read user records, list date tabs, format headers, append observations, and update rectification status.
   - `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart` directly to upload 1:1 square photo evidence.
3. **No Apps Script URLs**: You never have to deploy `Code.gs`, copy web app URLs, or test connection links again.
