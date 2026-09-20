export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  res.status(200).json({
    clientEmail: process.env.GOOGLE_CLIENT_EMAIL || null,
    isConfigured: Boolean(process.env.GOOGLE_CLIENT_EMAIL && process.env.GOOGLE_PRIVATE_KEY),
    masterSpreadsheetId: process.env.GOOGLE_MASTER_SPREADSHEET_ID || '1BT01JVkSxbYdJCuIwffxclGz_sW2e8cDAKpNyC3r28I',
    rootDriveFolderId: process.env.GOOGLE_CAP_PHOTO_ROOT_FOLDER_ID || '146wZBm_yvNbEIXKfqrT-wXQnnbbfQ6_N'
  });
}
