import crypto from 'node:crypto';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const t0 = Date.now();
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    res.status(200).json({
      status: 'unconfigured',
      message: 'GOOGLE_CLIENT_EMAIL or GOOGLE_PRIVATE_KEY not configured in Vercel environment'
    });
    return;
  }

  if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.slice(1, -1);
  }
  privateKey = privateKey.replace(/\\n/g, '\n');

  try {
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

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt
      })
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      res.status(tokenRes.status).json({ error: tokenData.error_description || tokenData.error });
      return;
    }

    const token = tokenData.access_token;
    const tokenTime = Date.now() - t0;

    // Ping Sheets API
    const tSheets = Date.now();
    const masterId = process.env.GOOGLE_MASTER_SPREADSHEET_ID || '1BT01JVkSxbYdJCuIwffxclGz_sW2e8cDAKpNyC3r28I';
    const sheetRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${masterId}?fields=properties.title`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const sheetsLatencyMs = Date.now() - tSheets;

    // Ping Drive API
    const tDrive = Date.now();
    const rootFolderId = process.env.GOOGLE_CAP_PHOTO_ROOT_FOLDER_ID || '146wZBm_yvNbEIXKfqrT-wXQnnbbfQ6_N';
    const driveRes = await fetch(`https://www.googleapis.com/drive/v3/files/${rootFolderId}?fields=id,name`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const driveLatencyMs = Date.now() - tDrive;

    res.status(200).json({
      status: 'ok',
      platform: 'Vercel Serverless',
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
    });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
}
