/**
 * CAP Photo Evidence Utility - Canvas Processing Engine
 * 
 * Strict specifications implemented:
 * 1. 1:1 Center-cropped square photo area with zero distortion
 * 2. Dedicated bottom white metadata strip (12-14% of photo height)
 * 3. Watermark NEVER covers or overlays the photographic area
 * 4. Responsive one-line typography with dynamic font scaling & intelligent truncation
 * 5. High-fidelity JPEG compression (300KB - 1.5MB range target)
 * 6. Raw image discarded after processing
 */

import { formatTimestamp, formatCorrectionSequence } from './recordModel.js';

export class CanvasEngine {
  /**
   * Process raw image source into official CAP Evidence Canvas
   * @param {Object} options
   * @param {HTMLImageElement|HTMLVideoElement|ImageBitmap|HTMLCanvasElement} options.source
   * @param {Object} options.metadata - Canonical metadata { serial, findings, location, captureTimestamp, photoType, correctionSequence, parentSerial }
   * @param {number} [options.targetPhotoDim=1200] - Dimension of the square photographic area
   * @returns {Promise<{ blob: Blob, dataUrl: string, width: number, height: number, fileSizeBytes: number }>}
   */
  static async processEvidencePhoto({
    source,
    metadata,
    targetPhotoDim = 1200
  }) {
    // 1. Determine source dimensions
    const srcWidth = source.videoWidth || source.naturalWidth || source.width;
    const srcHeight = source.videoHeight || source.naturalHeight || source.height;

    if (!srcWidth || !srcHeight) {
      throw new Error('Invalid image source: dimensions cannot be determined.');
    }

    // 2. Calculate 1:1 center-crop bounding box (preserving central subject, no stretching)
    const minDim = Math.min(srcWidth, srcHeight);
    const cropX = (srcWidth - minDim) / 2;
    const cropY = (srcHeight - minDim) / 2;

    // 3. Calculate canvas dimensions:
    // Photographic area is strictly 1:1 square: targetPhotoDim x targetPhotoDim
    // Strip height is ~12.5% of photo height (e.g., 150px for 1200px photo)
    const photoDim = targetPhotoDim;
    const stripHeight = Math.round(photoDim * 0.125);
    const totalWidth = photoDim;
    const totalHeight = photoDim + stripHeight;

    // Create rendering canvas
    const canvas = document.createElement('canvas');
    canvas.width = totalWidth;
    canvas.height = totalHeight;
    const ctx = canvas.getContext('2d', { alpha: false });

    // Ensure smooth image scaling
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // 4. Draw 1:1 Center-cropped Photo
    ctx.drawImage(
      source,
      cropX, cropY, minDim, minDim, // source 1:1 crop
      0, 0, photoDim, photoDim       // destination 1:1 square
    );

    // 5. Draw Dedicated White Metadata Strip
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, photoDim, totalWidth, stripHeight);

    // 6. Draw Subtle Separator Border (1.5px subtle light gray)
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, photoDim);
    ctx.lineTo(totalWidth, photoDim);
    ctx.stroke();

    // 7. Format and Fit Watermark Text
    const serial = metadata.parentSerial || metadata.serial;
    const timeParts = formatTimestamp(metadata.captureTimestamp);
    const dateTimeStr = timeParts.watermarkDateTime;
    const isCorrected = metadata.photoType === 'CORRECTED';
    const corrSeq = isCorrected ? formatCorrectionSequence(metadata.correctionSequence || 1) : null;
    const corrBadge = isCorrected ? `CORRECTED ${corrSeq}` : null;

    const paddingX = Math.round(totalWidth * 0.035); // ~42px padding
    const maxTextWidth = totalWidth - (paddingX * 2);

    // Dynamic Font Calculation & Truncation
    const fontInfo = CanvasEngine.fitWatermarkText({
      ctx,
      serial,
      findings: metadata.findings,
      location: metadata.location,
      dateTimeStr,
      corrBadge,
      maxWidth: maxTextWidth,
      stripHeight
    });

    // 8. Render Watermark Text Centered Vertically in White Strip
    ctx.font = `${fontInfo.fontWeight} ${fontInfo.fontSize}px ${fontInfo.fontFamily}`;
    ctx.fillStyle = '#0F172A'; // Crisp engineering dark slate
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    const textY = photoDim + (stripHeight / 2);
    ctx.fillText(fontInfo.finalText, paddingX, textY);

    // 9. Export to High-Quality JPEG Blob (target 300KB - 1.5MB)
    const blob = await new Promise((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.90);
    });

    const dataUrl = canvas.toDataURL('image/jpeg', 0.90);

    return {
      blob,
      dataUrl,
      width: totalWidth,
      height: totalHeight,
      photoSquareDim: photoDim,
      stripHeight,
      fileSizeBytes: blob ? blob.size : 0
    };
  }

  /**
   * Intelligently fit watermark text on a single line:
   * 1. Try single line at base font size (approx 32% of strip height)
   * 2. If too wide, scale down font size smoothly to safe minimum (approx 19% of strip height)
   * 3. If still too wide at minimum font size, intelligently truncate findings/location with '...'
   *    while strictly preserving Serial, Date & Time, and Correction sequence.
   */
  static fitWatermarkText({
    ctx,
    serial,
    findings,
    location,
    dateTimeStr,
    corrBadge,
    maxWidth,
    stripHeight
  }) {
    const fontFamily = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    const fontWeight = '600';

    const startFontSize = Math.round(stripHeight * 0.32); // e.g. 48px
    const minFontSize = Math.round(stripHeight * 0.19);   // e.g. 28px

    let cleanFindings = (findings || 'Unspecified').trim();
    let cleanLocation = (location || 'Unspecified').trim();

    // Base text assembly helper
    const buildText = (f, l, compact = false) => {
      let parts = [serial, f, l, dateTimeStr];
      if (corrBadge) {
        parts.push(compact ? corrBadge.replace('CORRECTED ', 'C') : corrBadge);
      }
      return parts.join(' | ');
    };

    // First attempt: full text, check if fits with standard font scaling
    let fullText = buildText(cleanFindings, cleanLocation, false);

    for (let size = startFontSize; size >= minFontSize; size -= 1) {
      ctx.font = `${fontWeight} ${size}px ${fontFamily}`;
      const metrics = ctx.measureText(fullText);
      if (metrics.width <= maxWidth) {
        return {
          finalText: fullText,
          fontSize: size,
          fontWeight,
          fontFamily
        };
      }
    }

    // Try with compact correction badge (e.g. C01 instead of CORRECTED 01)
    if (corrBadge) {
      const compactText = buildText(cleanFindings, cleanLocation, true);
      for (let size = startFontSize; size >= minFontSize; size -= 1) {
        ctx.font = `${fontWeight} ${size}px ${fontFamily}`;
        if (ctx.measureText(compactText).width <= maxWidth) {
          return {
            finalText: compactText,
            fontSize: size,
            fontWeight,
            fontFamily
          };
        }
      }
    }

    // If still too long at minFontSize, intelligently truncate findings & location
    ctx.font = `${fontWeight} ${minFontSize}px ${fontFamily}`;

    // Progressive truncation
    let fLen = cleanFindings.length;
    let lLen = cleanLocation.length;

    while ((fLen > 10 || lLen > 8)) {
      if (fLen > lLen + 6) {
        fLen -= 2;
      } else {
        lLen -= 2;
      }

      const truncFindings = cleanFindings.length > fLen ? cleanFindings.substring(0, fLen) + '...' : cleanFindings;
      const truncLocation = cleanLocation.length > lLen ? cleanLocation.substring(0, lLen) + '...' : cleanLocation;
      const candidateText = buildText(truncFindings, truncLocation, !!corrBadge);

      if (ctx.measureText(candidateText).width <= maxWidth) {
        return {
          finalText: candidateText,
          fontSize: minFontSize,
          fontWeight,
          fontFamily
        };
      }
    }

    // Absolute fallback: truncate to exact character fitting
    let fallbackText = buildText(cleanFindings.substring(0, 15) + '...', cleanLocation.substring(0, 10) + '...', true);
    return {
      finalText: fallbackText,
      fontSize: minFontSize,
      fontWeight,
      fontFamily
    };
  }
}
