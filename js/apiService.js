/**
 * CAP Photo Evidence Utility - Google Apps Script Backend Client API
 * Connects frontend to the live Google Drive and Google Sheets backend.
 * 
 * API Actions per memo §18:
 * - auth_login, auth_validate, auth_logout
 * - list_authorized_plants, list_plant_reports, ensure_plant_report
 * - get_plant_report_info, get_report_summary
 * - create_finding, upload_evidence, rectify_finding
 * - sync_operation, write_log
 */

import { redisCache } from './cacheEngine.js';

const STORAGE_KEY_GAS_URL = 'cap_gas_api_url';
const STORAGE_KEY_ACTIVE_PLANT = 'cap_active_plant';
const STORAGE_KEY_CURRENT_USER = 'cap_current_user';
const STORAGE_KEY_SESSION_TOKEN = 'cap_session_token';
const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbzDpKIljJ1iNzSq59H0uVItcxfEfcrhIqQki9XRiwLMmPKU-NYRMAoqDPXehFcbuGsRTw/exec';

export class ApiService {
  constructor() {
    this.apiUrl = localStorage.getItem(STORAGE_KEY_GAS_URL) || DEFAULT_GAS_URL;
    this.activePlant = localStorage.getItem(STORAGE_KEY_ACTIVE_PLANT) || 'CIPL';
    this.currentUser = this.loadCurrentUser();
    this.sessionToken = localStorage.getItem(STORAGE_KEY_SESSION_TOKEN) || '';
  }

  isConfigured() {
    return Boolean(this.apiUrl && this.apiUrl.trim().startsWith('https://script.google.com/'));
  }

  getApiUrl() {
    return this.apiUrl;
  }

  setApiUrl(url) {
    this.apiUrl = (url || '').trim();
    localStorage.setItem(STORAGE_KEY_GAS_URL, this.apiUrl);
  }

  getActivePlant() {
    return this.activePlant;
  }

  setActivePlant(plant) {
    this.activePlant = plant;
    localStorage.setItem(STORAGE_KEY_ACTIVE_PLANT, plant);
  }

  /* User Session Management */
  loadCurrentUser() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_CURRENT_USER);
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      return null;
    }
  }

  saveCurrentUser(user, sessionToken = null) {
    this.currentUser = user;
    if (user) {
      localStorage.setItem(STORAGE_KEY_CURRENT_USER, JSON.stringify(user));
      if (sessionToken) {
        this.sessionToken = sessionToken;
        localStorage.setItem(STORAGE_KEY_SESSION_TOKEN, sessionToken);
      } else {
        this.sessionToken = '';
        localStorage.removeItem(STORAGE_KEY_SESSION_TOKEN);
      }
      if (user.plant && user.plant !== 'ALL') {
        this.setActivePlant(user.plant);
      }
    } else {
      localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
    }
  }

  clearCurrentUser() {
    this.currentUser = null;
    this.sessionToken = '';
    localStorage.removeItem(STORAGE_KEY_CURRENT_USER);
    localStorage.removeItem(STORAGE_KEY_SESSION_TOKEN);
    redisCache.clear();
  }

  getCurrentUser() {
    return this.currentUser;
  }

  getSessionToken() {
    return this.sessionToken;
  }

  /**
   * Real Authentication against Google Apps Script backend (Users sheet)
   */
  async login(username, password) {
    if (!this.isConfigured()) {
      // Local demo fallback
      if (username === 'admin') {
        const u = { id: 'USR-001', username: 'admin', name: 'Central Utility Admin', role: 'ADMIN', plant: 'ALL' };
        this.saveCurrentUser(u);
        return { success: true, user: u };
      }
      const plantMap = { cipl_user: 'CIPL', pgcl_user: 'PGCL', gtl_user: 'GTL', egmcl_user: 'EGMCL 2' };
      const assignedPlant = plantMap[username] || this.activePlant;
      const u = { id: 'USR-LOCAL', username, name: `${username.toUpperCase()} Field Inspector`, role: 'PLANT_USER', plant: assignedPlant };
      this.saveCurrentUser(u);
      return { success: true, user: u };
    }

    const payload = {
      action: 'auth_login',
      username: username.trim(),
      password: password.trim()
    };

    const res = await this.postRequest(payload);
    if (res && res.success && res.user) {
      if (!res.sessionToken && this.isConfigured()) {
        throw new Error('Backend login did not return a session token. Redeploy backend/Code.gs as a new Apps Script version.');
      }
      this.saveCurrentUser(res.user, res.sessionToken);
    }
    return res;
  }

  /**
   * Validate current session token
   */
  async validateSession() {
    if (!this.isConfigured() || !this.sessionToken) return false;
    try {
      const res = await this.postRequest({ action: 'auth_validate' });
      return res && res.valid;
    } catch (e) {
      return false;
    }
  }

  /**
   * Ping Google Apps Script backend to test connectivity
   */
  async testConnection(testUrl = null) {
    const url = testUrl || this.apiUrl;
    if (!url) {
      throw new Error('Google Apps Script Web App URL is not configured.');
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'ping' })
      });

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }

      const result = await response.json();
      return result.status === 'ok';
    } catch (err) {
      console.warn('Backend ping error:', err);
      throw err;
    }
  }

  /**
   * Initialize Master Sheets (Users, Logs, Config)
   */
  async initMasterSheets() {
    if (!this.isConfigured()) return null;

    return this.postRequest({
      action: 'init_master_sheets'
    });
  }

  /**
   * List all date-wise CAP reports available for a plant (tabs in workbook)
   * Cached via redisCache with 60s TTL for instant tab switching
   */
  async listPlantReports(plant = null) {
    const targetPlant = plant || this.activePlant || 'CIPL';

    if (!this.isConfigured()) {
      return { success: true, plant: targetPlant, reports: [] };
    }

    return redisCache.getOrFetch(`plant_reports:${targetPlant}`, async () => {
      try {
        return await this.postRequest({
          action: 'list_plant_reports',
          plant: targetPlant
        });
      } catch (err) {
        console.warn('[ApiService] Could not fetch remote plant reports:', err.message);
        return { success: false, plant: targetPlant, reports: [], error: err.message };
      }
    }, 60000);
  }

  /**
   * Create or open the date-wise CAP report tab in the plant workbook (ADMIN only)
   */
  async ensurePlantReport(plant = null, reportDate = null) {
    const targetPlant = plant || this.activePlant || 'CIPL';
    const targetDate = reportDate || new Date().toISOString().substring(0, 10);

    if (!this.isConfigured()) {
      return {
        success: true,
        simulated: true,
        plant: targetPlant,
        reportDate: targetDate,
        created: false,
        name: `${targetPlant}- Electrical Internal CAP Report - ${targetDate}`,
        url: null
      };
    }

    try {
      const res = await this.postRequest({
        action: 'ensure_plant_report',
        plant: targetPlant,
        reportDate: targetDate
      });
      redisCache.invalidatePattern(`plant_reports:${targetPlant}`);
      return res;
    } catch (err) {
      console.warn('[ApiService] Could not ensure remote plant report:', err.message);
      return {
        success: false,
        plant: targetPlant,
        reportDate: targetDate,
        name: `${targetPlant}- Electrical Internal CAP Report - ${targetDate}`,
        url: null,
        error: err.message
      };
    }
  }

  /**
   * Fetch existing plant observations from the date tab
   * Cached via redisCache with 45s TTL for high UI responsiveness
   */
  async getPlantReportInfo(plant = null, reportDate = null) {
    const targetPlant = plant || this.activePlant || 'CIPL';
    const targetDate = reportDate || new Date().toISOString().substring(0, 10);

    if (!this.isConfigured()) {
      return { found: false, plant: targetPlant, reportDate: targetDate, observations: [] };
    }

    return redisCache.getOrFetch(`report_info:${targetPlant}:${targetDate}`, async () => {
      try {
        return await this.postRequest({
          action: 'get_plant_report_info',
          plant: targetPlant,
          reportDate: targetDate
        });
      } catch (err) {
        console.warn('[ApiService] Could not fetch remote sheet observations:', err.message);
        return { found: false, plant: targetPlant, reportDate: targetDate, observations: [], error: err.message };
      }
    }, 45000);
  }

  /**
   * Get report summary for a plant (from SUMMARY tab)
   * Cached via redisCache with 60s TTL
   */
  async getReportSummary(plant = null) {
    const targetPlant = plant || this.activePlant || 'CIPL';

    if (!this.isConfigured()) {
      return { success: true, plant: targetPlant, overall: {}, dates: [] };
    }

    return redisCache.getOrFetch(`report_summary:${targetPlant}`, async () => {
      try {
        return await this.postRequest({
          action: 'get_report_summary',
          plant: targetPlant
        });
      } catch (err) {
        return { success: false, plant: targetPlant, overall: {}, dates: [], error: err.message };
      }
    }, 60000);
  }

  /**
   * Create a finding row in the date tab (ADMIN only, memo §8)
   */
  async createFinding({ plant, reportDate, finding, recommendation, specificLocation, riskLevel, clientOperationId }) {
    const targetPlant = plant || this.activePlant || 'CIPL';
    const targetDate = reportDate || new Date().toISOString().substring(0, 10);

    // Invalidate local cache for this plant
    redisCache.invalidatePattern(`report_info:${targetPlant}`);
    redisCache.invalidatePattern(`report_summary:${targetPlant}`);
    redisCache.invalidatePattern(`plant_reports:${targetPlant}`);

    if (!this.isConfigured()) {
      return {
        success: true,
        simulated: true,
        plant: targetPlant,
        reportDate: targetDate,
        serial: '001',
        finding
      };
    }

    const res = await this.postRequest({
      action: 'create_finding',
      plant: targetPlant,
      reportDate: targetDate,
      finding,
      recommendation: recommendation || 'Immediate rectification required as per electrical safety standard',
      specificLocation,
      riskLevel: riskLevel || 'Priority 2',
      clientOperationId: clientOperationId || this.generateOperationId()
    });

    redisCache.invalidatePattern(`report_info:${targetPlant}`);
    redisCache.invalidatePattern(`report_summary:${targetPlant}`);
    redisCache.invalidatePattern(`plant_reports:${targetPlant}`);
    return res;
  }

  /**
   * Rectify a finding (set Column K to Rectified, optionally upload corrected photo)
   */
  async rectifyFinding({ plant, reportDate, serial, remarks, base64Data, filename, clientOperationId }) {
    const targetPlant = plant || this.activePlant || 'CIPL';

    // Invalidate local cache for this plant
    redisCache.invalidatePattern(`report_info:${targetPlant}`);
    redisCache.invalidatePattern(`report_summary:${targetPlant}`);
    redisCache.invalidatePattern(`plant_reports:${targetPlant}`);

    if (!this.isConfigured()) {
      return {
        success: true,
        simulated: true,
        plant: targetPlant,
        reportDate,
        serial,
        remarks: 'Rectified'
      };
    }

    const res = await this.postRequest({
      action: 'rectify_finding',
      plant: targetPlant,
      reportDate,
      serial,
      remarks: remarks || 'Rectified as per electrical safety standard',
      base64Data,
      filename,
      clientOperationId: clientOperationId || this.generateOperationId()
    });

    redisCache.invalidatePattern(`report_info:${targetPlant}`);
    redisCache.invalidatePattern(`report_summary:${targetPlant}`);
    redisCache.invalidatePattern(`plant_reports:${targetPlant}`);
    return res;
  }

  /**
   * Upload 1:1 photographic evidence to Google Drive & Google Sheet
   */
  async uploadEvidenceToCloud(record, plant = null) {
    const targetPlant = plant || this.activePlant || 'CIPL';
    
    let base64Data = record.imageDataUrl;
    if (!base64Data && record.imageBlob) {
      base64Data = await this.blobToBase64(record.imageBlob);
    }

    const clientOperationId = record.clientOperationId || `${targetPlant}_${record.reportDate}_${record.serial}_${record.photoType}_${record.id}`;

    if (!this.isConfigured()) {
      console.info('[ApiService] GAS URL not configured. Simulating Google Drive upload.');
      await new Promise(r => setTimeout(r, 600));
      const simulatedDriveId = `1CAP_${record.id.replace(/[^a-zA-Z0-9]/g, '').substring(0, 16)}`;
      return {
        success: true,
        simulated: true,
        driveFileId: simulatedDriveId,
        driveFileUrl: `https://drive.google.com/file/d/${simulatedDriveId}/view?usp=sharing`,
        filename: record.filename,
        serial: record.serial
      };
    }

    const payload = {
      action: 'upload_evidence',
      plant: targetPlant,
      reportDate: record.reportDate,
      serial: record.serial,
      findings: record.findings,
      location: record.location,
      recommendation: record.recommendation,
      riskLevel: record.riskLevel,
      captureTimestamp: record.captureTimestamp,
      photoType: record.photoType,
      correctionSequence: record.correctionSequence,
      filename: record.filename,
      base64Data,
      clientOperationId,
      idempotencyKey: clientOperationId
    };

    const res = await this.postRequest(payload);
    redisCache.invalidatePattern(`report_info:${targetPlant}`);
    redisCache.invalidatePattern(`plant_reports:${targetPlant}`);
    return res;
  }

  /**
   * Generic sync operation (routes to appropriate backend handler)
   */
  async syncOperation(operation) {
    if (!this.isConfigured()) {
      await new Promise(r => setTimeout(r, 400));
      const simulatedDriveId = `1CAP_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      return {
        success: true,
        simulated: true,
        driveFileId: simulatedDriveId,
        driveFileUrl: `https://drive.google.com/file/d/${simulatedDriveId}/view?usp=sharing`,
        serial: operation.serial
      };
    }

    return this.postRequest({
      action: 'sync_operation',
      ...operation
    });
  }

  /**
   * Generate a unique client operation ID for idempotency
   */
  generateOperationId() {
    return `op_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  async postRequest(payload) {
    if (!this.apiUrl) {
      throw new Error('API URL is not set.');
    }

    const requestPayload = { ...payload };
    if (this.sessionToken && payload.action !== 'auth_login') {
      requestPayload.sessionToken = this.sessionToken;
    }

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(requestPayload)
    });

    if (!response.ok) {
      throw new Error(`Server returned HTTP ${response.status}`);
    }

    const json = await response.json();
    if (json.error) {
      throw new Error(json.error);
    }

    return json;
  }

  /**
   * Get cloud storage locations (Drives and Sheets)
   * ADMIN receives all locations; PLANT_USER receives their authorized plant only.
   * Cached via redisCache with 5min TTL
   */
  async getStorageLocations() {
    const role = this.currentUser ? this.currentUser.role : 'anon';
    const plant = (this.currentUser && this.currentUser.plant) || this.activePlant || 'CIPL';
    const cacheKey = `storage_locations:${role}:${plant}`;

    return redisCache.getOrFetch(cacheKey, async () => {
      if (!this.isConfigured()) {
        if (this.currentUser && this.currentUser.role === 'ADMIN') {
          return { success: true, role: 'ADMIN', ...STORAGE_LOCATIONS };
        }
        return {
          success: true,
          role: 'PLANT_USER',
          plant: STORAGE_LOCATIONS.plants[plant] || {
            plant,
            driveFolderUrl: '',
            spreadsheetUrl: ''
          }
        };
      }

      try {
        return await this.postRequest({ action: 'get_storage_locations' });
      } catch (e) {
        console.warn('[ApiService] Could not fetch remote storage locations, falling back to static directory:', e.message);
        if (this.currentUser && this.currentUser.role === 'ADMIN') {
          return { success: true, role: 'ADMIN', ...STORAGE_LOCATIONS };
        }
        return {
          success: true,
          role: 'PLANT_USER',
          plant: STORAGE_LOCATIONS.plants[plant]
        };
      }
    }, 300000);
  }

  blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}

export const STORAGE_LOCATIONS = {
  rootDrive: {
    id: "146wZBm_yvNbEIXKfqrT-wXQnnbbfQ6_N",
    url: "https://drive.google.com/drive/folders/146wZBm_yvNbEIXKfqrT-wXQnnbbfQ6_N",
    name: "CAP Photos (Central Root Folder)"
  },
  rootDriveFolder: {
    id: "146wZBm_yvNbEIXKfqrT-wXQnnbbfQ6_N",
    url: "https://drive.google.com/drive/folders/146wZBm_yvNbEIXKfqrT-wXQnnbbfQ6_N",
    name: "CAP Photos (Central Root Folder)"
  },
  masterSpreadsheet: {
    id: "1BT01JVkSxbYdJCuIwffxclGz_sW2e8cDAKpNyC3r28I",
    url: "https://docs.google.com/spreadsheets/d/1BT01JVkSxbYdJCuIwffxclGz_sW2e8cDAKpNyC3r28I/edit",
    name: "Master Spreadsheet (Users, Logs, Config)"
  },
  plants: {
    "CIPL": {
      plant: "CIPL",
      driveFolderId: "13XyI1a5uFv2crHNhy-wYHI7i8jrP1X_6",
      driveFolderUrl: "https://drive.google.com/drive/folders/13XyI1a5uFv2crHNhy-wYHI7i8jrP1X_6",
      spreadsheetId: "1Nui7xNg7OP8--Ngy_UPZE9Jkfn-3sN90UosJR-9Ms0o",
      spreadsheetUrl: "https://docs.google.com/spreadsheets/d/1Nui7xNg7OP8--Ngy_UPZE9Jkfn-3sN90UosJR-9Ms0o/edit"
    },
    "PGCL": {
      plant: "PGCL",
      driveFolderId: "1qv7wsp1mk5MsNVkdbtZvu7WmMkNyimZl",
      driveFolderUrl: "https://drive.google.com/drive/folders/1qv7wsp1mk5MsNVkdbtZvu7WmMkNyimZl",
      spreadsheetId: "1PYH98QdeKzvj7gcNDwHzfNBsrxoD9CZhQhyVaXkHFls",
      spreadsheetUrl: "https://docs.google.com/spreadsheets/d/1PYH98QdeKzvj7gcNDwHzfNBsrxoD9CZhQhyVaXkHFls/edit"
    },
    "GTL": {
      plant: "GTL",
      driveFolderId: "1T9mx0VPB6FtfKMlxDNJfY4ef44AbAof1",
      driveFolderUrl: "https://drive.google.com/drive/folders/1T9mx0VPB6FtfKMlxDNJfY4ef44AbAof1",
      spreadsheetId: "1TuoTm37XEu-a9QznqFRccBnPsmINV99nOZfavt0boeA",
      spreadsheetUrl: "https://docs.google.com/spreadsheets/d/1TuoTm37XEu-a9QznqFRccBnPsmINV99nOZfavt0boeA/edit"
    },
    "EGMCL 2": {
      plant: "EGMCL 2",
      driveFolderId: "1cVlGvRf8ezIMEmMRzRjdSC2FanXbGcT7",
      driveFolderUrl: "https://drive.google.com/drive/folders/1cVlGvRf8ezIMEmMRzRjdSC2FanXbGcT7",
      spreadsheetId: "1Ejx7YRY-QmoIzEFY6_KCC04b3celsrzDlshKDGTtN54",
      spreadsheetUrl: "https://docs.google.com/spreadsheets/d/1Ejx7YRY-QmoIzEFY6_KCC04b3celsrzDlshKDGTtN54/edit"
    }
  }
};

export const apiServiceInstance = new ApiService();
if (typeof window !== 'undefined') {
  window.redisCache = redisCache;
}
export { redisCache };
