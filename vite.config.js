import { defineConfig } from 'vite';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// Helper to load .env.local variables
function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  const env = { ...process.env };
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.substring(0, eqIdx).trim();
        let val = trimmed.substring(eqIdx + 1).trim();
        if (val.startsWith('"') && val.endsWith('"')) {
          val = val.slice(1, -1).replace(/\\n/g, '\n');
        }
        env[key] = val;
      }
    }
  }
  return env;
}

// In-memory token cache
let cachedToken = null;
let tokenExpiresAt = 0;

async function mintGoogleToken(clientEmail, privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const b64Url = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');
  const unsignedToken = `${b64Url(header)}.${b64Url(claimSet)}`;

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(unsignedToken);
  const signature = sign.sign(privateKey, 'base64url');
  const jwt = `${unsignedToken}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Google OAuth error: ${data.error_description || data.error || res.statusText}`);
  }

  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + ((data.expires_in || 3600) - 300) * 1000; // 5 min safety buffer
  return {
    access_token: cachedToken,
    expires_in: data.expires_in,
    client_email: clientEmail
  };
}

function googleApiPlugin() {
  return {
    name: 'google-api-dev-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || '';

        // 1. /api/google/token
        if (url === '/api/google/token' || url.startsWith('/api/google/token?')) {
          res.setHeader('Content-Type', 'application/json');
          try {
            const env = loadEnv();
            const clientEmail = env.GOOGLE_CLIENT_EMAIL;
            const privateKey = env.GOOGLE_PRIVATE_KEY;

            if (!clientEmail || !privateKey) {
              res.statusCode = 500;
              res.end(JSON.stringify({
                error: 'Google Service Account credentials are not configured in .env.local.'
              }));
              return;
            }

            if (cachedToken && Date.now() < tokenExpiresAt) {
              res.statusCode = 200;
              res.end(JSON.stringify({
                access_token: cachedToken,
                expires_in: Math.floor((tokenExpiresAt - Date.now()) / 1000),
                client_email: clientEmail
              }));
              return;
            }

            const tokenData = await mintGoogleToken(clientEmail, privateKey);
            res.statusCode = 200;
            res.end(JSON.stringify(tokenData));
          } catch (err) {
            console.error('[GoogleApiPlugin] Token minting error:', err);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
          return;
        }

        // 2. /api/google/health
        if (url === '/api/google/health' || url.startsWith('/api/google/health?')) {
          res.setHeader('Content-Type', 'application/json');
          const t0 = Date.now();
          try {
            const env = loadEnv();
            const clientEmail = env.GOOGLE_CLIENT_EMAIL;
            const privateKey = env.GOOGLE_PRIVATE_KEY;

            if (!clientEmail || !privateKey) {
              res.statusCode = 200;
              res.end(JSON.stringify({
                status: 'unconfigured',
                message: 'Google credentials not configured in .env.local'
              }));
              return;
            }

            let token = cachedToken;
            if (!token || Date.now() >= tokenExpiresAt) {
              const td = await mintGoogleToken(clientEmail, privateKey);
              token = td.access_token;
            }
            const tokenTime = Date.now() - t0;

            // Ping Sheets API
            const tSheets = Date.now();
            const masterId = env.GOOGLE_MASTER_SPREADSHEET_ID || '1BT01JVkSxbYdJCuIwffxclGz_sW2e8cDAKpNyC3r28I';
            const sheetRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${masterId}?fields=properties.title`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            const sheetsLatencyMs = Date.now() - tSheets;

            // Ping Drive API
            const tDrive = Date.now();
            const rootFolderId = env.GOOGLE_CAP_PHOTO_ROOT_FOLDER_ID || '146wZBm_yvNbEIXKfqrT-wXQnnbbfQ6_N';
            const driveRes = await fetch(`https://www.googleapis.com/drive/v3/files/${rootFolderId}?fields=id,name`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            const driveLatencyMs = Date.now() - tDrive;

            res.statusCode = 200;
            res.end(JSON.stringify({
              status: 'ok',
              clientEmail,
              tokenTimeMs: tokenTime,
              sheets: {
                status: sheetRes.status,
                ok: sheetRes.ok,
                latencyMs: sheetsLatencyMs,
                spreadsheetId: masterId
              },
              drive: {
                status: driveRes.status,
                ok: driveRes.ok,
                latencyMs: driveLatencyMs,
                folderId: rootFolderId
              },
              totalLatencyMs: Date.now() - t0,
              timestamp: new Date().toISOString()
            }));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({
              status: 'error',
              error: err.message,
              latencyMs: Date.now() - t0
            }));
          }
          return;
        }

        // 3. /api/google/config
        if (url === '/api/google/config' || url.startsWith('/api/google/config?')) {
          res.setHeader('Content-Type', 'application/json');
          const env = loadEnv();
          res.statusCode = 200;
          res.end(JSON.stringify({
            clientEmail: env.GOOGLE_CLIENT_EMAIL || null,
            isConfigured: Boolean(env.GOOGLE_CLIENT_EMAIL && env.GOOGLE_PRIVATE_KEY),
            masterSpreadsheetId: env.GOOGLE_MASTER_SPREADSHEET_ID || '1BT01JVkSxbYdJCuIwffxclGz_sW2e8cDAKpNyC3r28I',
            rootDriveFolderId: env.GOOGLE_CAP_PHOTO_ROOT_FOLDER_ID || '146wZBm_yvNbEIXKfqrT-wXQnnbbfQ6_N'
          }));
          return;
        }

        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [googleApiPlugin()],
  server: {
    port: 3000,
    host: true
  }
});
