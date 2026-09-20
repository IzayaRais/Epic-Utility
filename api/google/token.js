import crypto from 'node:crypto';

let cachedToken = null;
let tokenExpiresAt = 0;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
  let privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    res.status(500).json({ error: 'GOOGLE_CLIENT_EMAIL or GOOGLE_PRIVATE_KEY not configured in Vercel environment.' });
    return;
  }

  if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
    privateKey = privateKey.slice(1, -1);
  }
  privateKey = privateKey.replace(/\\n/g, '\n');

  if (cachedToken && Date.now() < tokenExpiresAt) {
    res.status(200).json({
      access_token: cachedToken,
      expires_in: Math.floor((tokenExpiresAt - Date.now()) / 1000),
      client_email: clientEmail
    });
    return;
  }

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

    const data = await tokenRes.json();
    if (!tokenRes.ok) {
      res.status(tokenRes.status).json({ error: data.error_description || data.error || 'Token exchange failed' });
      return;
    }

    cachedToken = data.access_token;
    tokenExpiresAt = Date.now() + ((data.expires_in || 3600) - 300) * 1000;

    res.status(200).json({
      access_token: cachedToken,
      expires_in: data.expires_in,
      client_email: clientEmail
    });
  } catch (err) {
    console.error('Vercel token error:', err);
    res.status(500).json({ error: err.message });
  }
}
