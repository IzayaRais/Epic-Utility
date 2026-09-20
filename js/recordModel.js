/**
 * CAP Photo Evidence Utility - Record & Metadata Model
 * Implements strict canonical metadata generation, filename sanitization,
 * and watermark formatting according to specifications.
 */

/**
 * Format a number into standard 3-digit padded serial (e.g., 1 -> "001")
 * @param {number|string} num
 * @returns {string}
 */
export function formatSerial(num) {
  const n = parseInt(num, 10);
  if (isNaN(n)) return '001';
  return String(n).padStart(3, '0');
}

/**
 * Format correction sequence into 2-digit padded string (e.g., 1 -> "01")
 * @param {number|string} seq
 * @returns {string}
 */
export function formatCorrectionSequence(seq) {
  const s = parseInt(seq, 10);
  if (isNaN(s)) return '01';
  return String(s).padStart(2, '0');
}

/**
 * Sanitize text component for filesystem & Drive compatibility.
 * Replaces /, \, :, *, ?, ", <, >, |, and spaces with '-', collapses duplicates.
 * @param {string} text
 * @param {number} maxLength
 * @returns {string}
 */
export function sanitizeFilenamePart(text, maxLength = 60) {
  if (!text) return 'Unspecified';
  
  let clean = text
    .trim()
    // Replace problematic characters and whitespace with dash
    .replace(/[/\\:*?"<>|#%&{}\\<>*?/$!'":@+`|=]/g, '-')
    .replace(/\s+/g, '-')
    // Replace multiple consecutive dashes with single dash
    .replace(/-+/g, '-')
    // Remove leading or trailing dashes
    .replace(/^-+|-+$/g, '');

  if (clean.length > maxLength) {
    clean = clean.substring(0, maxLength).replace(/-+$/, '');
  }

  return clean || 'Unspecified';
}

/**
 * Format Date object into parts for filename and display
 * @param {Date} dateObj
 */
export function formatTimestamp(dateObj) {
  const d = dateObj instanceof Date ? dateObj : new Date(dateObj);
  
  const YYYY = d.getFullYear();
  const MM = String(d.getMonth() + 1).padStart(2, '0');
  const DD = String(d.getDate()).padStart(2, '0');
  const HH = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');

  return {
    // For canonical filename: YYYY-MM-DD_HH-mm-ss
    filenameDate: `${YYYY}-${MM}-${DD}`,
    filenameTime: `${HH}-${mm}-${ss}`,
    // For watermark: DD-MM-YYYY HH:mm
    watermarkDateTime: `${DD}-${MM}-${YYYY} ${HH}:${mm}`,
    watermarkFullTime: `${DD}-${MM}-${YYYY} ${HH}:${mm}:${ss}`,
    // Standard ISO string
    iso: d.toISOString(),
    // Standard readable date
    dateOnly: `${YYYY}-${MM}-${DD}`
  };
}

/**
 * Generate canonical filename per specifications:
 * Original:  {SERIAL}_{FINDINGS}_{LOCATION}_{YYYY-MM-DD}_{HH-mm-ss}.jpg
 * Corrected: {SERIAL}_{FINDINGS}_{LOCATION}_{YYYY-MM-DD}_{HH-mm-ss}_CORRECTED_{SEQUENCE}.jpg
 *
 * @param {Object} params
 * @returns {string}
 */
export function generateCanonicalFilename({
  serial,
  findings,
  location,
  captureTimestamp,
  photoType = 'ORIGINAL',
  correctionSequence = '01'
}) {
  const cleanFindings = sanitizeFilenamePart(findings, 50);
  const cleanLocation = sanitizeFilenamePart(location, 40);
  const timeParts = formatTimestamp(captureTimestamp);

  const baseName = `${serial}_${cleanFindings}_${cleanLocation}_${timeParts.filenameDate}_${timeParts.filenameTime}`;

  if (photoType === 'CORRECTED') {
    const seq = formatCorrectionSequence(correctionSequence);
    return `${baseName}_CORRECTED_${seq}.jpg`;
  }

  return `${baseName}.jpg`;
}

/**
 * Generate canonical watermark string:
 * Original:  SERIAL | FINDINGS | LOCATION | DATE & TIME
 * Corrected: SERIAL | FINDINGS | LOCATION | DATE & TIME | CORRECTED XX
 *
 * @param {Object} params
 * @returns {string}
 */
export function generateCanonicalWatermark({
  serial,
  findings,
  location,
  captureTimestamp,
  photoType = 'ORIGINAL',
  correctionSequence = '01',
  compactCorrection = false
}) {
  const cleanFindings = (findings || 'Observation').trim();
  const cleanLocation = (location || 'Site').trim();
  const timeParts = formatTimestamp(captureTimestamp);

  let watermark = `${serial} | ${cleanFindings} | ${cleanLocation} | ${timeParts.watermarkDateTime}`;

  if (photoType === 'CORRECTED') {
    const seq = formatCorrectionSequence(correctionSequence);
    const corrTag = compactCorrection ? `C${seq}` : `CORRECTED ${seq}`;
    watermark += ` | ${corrTag}`;
  }

  return watermark;
}

/**
 * Create a complete canonical photo record object.
 * This canonical record is the SINGLE SOURCE OF TRUTH for:
 * 1. Filename
 * 2. Canvas Watermark
 * 3. IndexedDB persistence
 * 4. Google Drive metadata
 * 5. CAP Audit Report entries
 *
 * @param {Object} options
 * @returns {Object} Canonical photo record
 */
export function createPhotoRecord({
  id = crypto.randomUUID ? crypto.randomUUID() : `cap-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
  plant = null,
  serial,
  rawSerial,
  parentSerial = null,
  parentId = null,
  findings,
  location,
  captureTimestamp = new Date(),
  photoType = 'ORIGINAL',
  correctionSequence = null,
  imageBlob = null,
  imageDataUrl = null,
  fileSizeBytes = 0,
  syncStatus = 'PENDING',
  driveFileId = null,
  driveLink = null
}) {
  const captureDate = captureTimestamp instanceof Date ? captureTimestamp : new Date(captureTimestamp);
  const timeMeta = formatTimestamp(captureDate);

  const formattedSerial = formatSerial(serial || rawSerial || 1);
  const formattedSeq = photoType === 'CORRECTED' ? formatCorrectionSequence(correctionSequence || 1) : null;
  
  // Display serial (e.g., "001" or "001-C01")
  const displaySerial = photoType === 'CORRECTED'
    ? `${parentSerial || formattedSerial}-C${formattedSeq}`
    : formattedSerial;

  const filename = generateCanonicalFilename({
    serial: parentSerial || formattedSerial,
    findings,
    location,
    captureTimestamp: captureDate,
    photoType,
    correctionSequence: formattedSeq
  });

  const watermarkText = generateCanonicalWatermark({
    serial: parentSerial || formattedSerial,
    findings,
    location,
    captureTimestamp: captureDate,
    photoType,
    correctionSequence: formattedSeq
  });

  return {
    id,
    plant: plant || null,
    serial: formattedSerial,
    displaySerial,
    rawSerial: parseInt(rawSerial || serial, 10) || 1,
    parentSerial,
    parentId,
    findings: (findings || '').trim(),
    location: (location || '').trim(),
    captureTimestamp: timeMeta.iso,
    reportDate: timeMeta.dateOnly,
    formattedDateTime: timeMeta.watermarkDateTime,
    photoType, // 'ORIGINAL' | 'CORRECTED'
    correctionSequence: formattedSeq,
    filename,
    watermarkText,
    syncStatus, // 'PENDING' | 'SYNCED' | 'FAILED'
    driveFileId,
    driveLink,
    syncedAt: null,
    fileSizeBytes,
    imageBlob,
    imageDataUrl,
    createdAt: new Date().toISOString()
  };
}
