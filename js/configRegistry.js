/**
 * Epic Group - Electrical Internal CAP Report Field Inspector
 * Authoritative Cloud Configuration & Dynamic Registry (memo.md)
 * 
 * Purpose:
 * Decouples the entire system from hardcoded backend Code.gs IDs.
 * All plant Google Spreadsheets, Drive folders, and master IDs from memo.md
 * are managed here and dynamically transmitted in API request payloads.
 * 
 * Users can reconfigure, add new plants, or update Google Sheet/Drive links
 * directly from the frontend without EVER needing to edit or redeploy Code.gs!
 */

const STORAGE_KEY_CONFIG = 'cap_cloud_config_registry';

export const DEFAULT_CONFIG = {
  masterSpreadsheetId: "1BT01JVkSxbYdJCuIwffxclGz_sW2e8cDAKpNyC3r28I",
  masterSpreadsheetUrl: "https://docs.google.com/spreadsheets/d/1BT01JVkSxbYdJCuIwffxclGz_sW2e8cDAKpNyC3r28I/edit",
  capPhotoRootFolderId: "146wZBm_yvNbEIXKfqrT-wXQnnbbfQ6_N",
  capPhotoRootFolderUrl: "https://drive.google.com/drive/folders/146wZBm_yvNbEIXKfqrT-wXQnnbbfQ6_N",
  plants: {
    "CIPL": {
      plant: "CIPL",
      spreadsheetId: "1Nui7xNg7OP8--Ngy_UPZE9Jkfn-3sN90UosJR-9Ms0o",
      spreadsheetUrl: "https://docs.google.com/spreadsheets/d/1Nui7xNg7OP8--Ngy_UPZE9Jkfn-3sN90UosJR-9Ms0o/edit",
      driveFolderId: "13XyI1a5uFv2crHNhy-wYHI7i8jrP1X_6",
      driveFolderUrl: "https://drive.google.com/drive/folders/13XyI1a5uFv2crHNhy-wYHI7i8jrP1X_6"
    },
    "PGCL": {
      plant: "PGCL",
      spreadsheetId: "1PYH98QdeKzvj7gcNDwHzfNBsrxoD9CZhQhyVaXkHFls",
      spreadsheetUrl: "https://docs.google.com/spreadsheets/d/1PYH98QdeKzvj7gcNDwHzfNBsrxoD9CZhQhyVaXkHFls/edit",
      driveFolderId: "1qv7wsp1mk5MsNVkdbtZvu7WmMkNyimZl",
      driveFolderUrl: "https://drive.google.com/drive/folders/1qv7wsp1mk5MsNVkdbtZvu7WmMkNyimZl"
    },
    "GTL": {
      plant: "GTL",
      spreadsheetId: "1TuoTm37XEu-a9QznqFRccBnPsmINV99nOZfavt0boeA",
      spreadsheetUrl: "https://docs.google.com/spreadsheets/d/1TuoTm37XEu-a9QznqFRccBnPsmINV99nOZfavt0boeA/edit",
      driveFolderId: "1T9mx0VPB6FtfKMlxDNJfY4ef44AbAof1",
      driveFolderUrl: "https://drive.google.com/drive/folders/1T9mx0VPB6FtfKMlxDNJfY4ef44AbAof1"
    },
    "EGMCL 2": {
      plant: "EGMCL 2",
      spreadsheetId: "1Ejx7YRY-QmoIzEFY6_KCC04b3celsrzDlshKDGTtN54",
      spreadsheetUrl: "https://docs.google.com/spreadsheets/d/1Ejx7YRY-QmoIzEFY6_KCC04b3celsrzDlshKDGTtN54/edit",
      driveFolderId: "1cVlGvRf8ezIMEmMRzRjdSC2FanXbGcT7",
      driveFolderUrl: "https://drive.google.com/drive/folders/1cVlGvRf8ezIMEmMRzRjdSC2FanXbGcT7"
    }
  }
};

export class ConfigRegistry {
  constructor() {
    this.config = this.loadConfig();
  }

  loadConfig() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_CONFIG);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Deep merge with defaults to preserve new properties
        return {
          masterSpreadsheetId: parsed.masterSpreadsheetId || DEFAULT_CONFIG.masterSpreadsheetId,
          masterSpreadsheetUrl: parsed.masterSpreadsheetUrl || DEFAULT_CONFIG.masterSpreadsheetUrl,
          capPhotoRootFolderId: parsed.capPhotoRootFolderId || DEFAULT_CONFIG.capPhotoRootFolderId,
          capPhotoRootFolderUrl: parsed.capPhotoRootFolderUrl || DEFAULT_CONFIG.capPhotoRootFolderUrl,
          plants: Object.assign({}, DEFAULT_CONFIG.plants, parsed.plants || {})
        };
      }
    } catch (e) {
      console.warn('[ConfigRegistry] Failed to parse local config, using memo.md defaults:', e);
    }
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }

  getConfig() {
    return this.config;
  }

  saveConfig(newConfig) {
    this.config = Object.assign({}, this.config, newConfig);
    try {
      localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(this.config));
    } catch (e) {
      console.warn('[ConfigRegistry] Failed to save config to localStorage:', e);
    }
    return this.config;
  }

  resetToDefaults() {
    this.config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    localStorage.removeItem(STORAGE_KEY_CONFIG);
    return this.config;
  }

  getPlantSpreadsheetId(plant) {
    const p = this.config.plants[plant];
    return p ? p.spreadsheetId : '';
  }

  getPlantDriveFolderId(plant) {
    const p = this.config.plants[plant];
    return p ? p.driveFolderId : '';
  }

  getPlantSpreadsheetUrl(plant) {
    const p = this.config.plants[plant];
    return p ? p.spreadsheetUrl : '';
  }

  getPlantDriveFolderUrl(plant) {
    const p = this.config.plants[plant];
    return p ? p.driveFolderUrl : '';
  }

  updatePlant(plantName, { spreadsheetId, spreadsheetUrl, driveFolderId, driveFolderUrl }) {
    if (!this.config.plants[plantName]) {
      this.config.plants[plantName] = { plant: plantName };
    }
    const target = this.config.plants[plantName];
    if (spreadsheetId) {
      target.spreadsheetId = spreadsheetId.trim();
      target.spreadsheetUrl = spreadsheetUrl ? spreadsheetUrl.trim() : `https://docs.google.com/spreadsheets/d/${target.spreadsheetId}/edit`;
    }
    if (driveFolderId) {
      target.driveFolderId = driveFolderId.trim();
      target.driveFolderUrl = driveFolderUrl ? driveFolderUrl.trim() : `https://drive.google.com/drive/folders/${target.driveFolderId}`;
    }
    this.saveConfig(this.config);
    return target;
  }

  removePlant(plantName) {
    if (this.config.plants[plantName]) {
      delete this.config.plants[plantName];
      this.saveConfig(this.config);
    }
  }

  /**
   * Generates dynamic config payload injected into every Google Apps Script API request.
   * This guarantees Code.gs always operates on the exact IDs from the frontend!
   */
  exportApiPayload(targetPlant = null) {
    const plantSpreadsheets = {};
    const plantFolders = {};

    for (const [key, val] of Object.entries(this.config.plants)) {
      if (val.spreadsheetId) plantSpreadsheets[key] = val.spreadsheetId;
      if (val.driveFolderId) plantFolders[key] = val.driveFolderId;
    }

    const payload = {
      masterSpreadsheetId: this.config.masterSpreadsheetId,
      capPhotoRootFolderId: this.config.capPhotoRootFolderId,
      plantSpreadsheets,
      plantFolders
    };

    if (targetPlant && this.config.plants[targetPlant]) {
      const p = this.config.plants[targetPlant];
      if (p.spreadsheetId) payload.spreadsheetId = p.spreadsheetId;
      if (p.driveFolderId) payload.driveFolderId = p.driveFolderId;
    }

    return payload;
  }

  /**
   * Export storage locations format matching get_storage_locations schema
   */
  exportStorageLocations(role = 'ADMIN', userPlant = 'CIPL') {
    if (role === 'ADMIN') {
      const plants = {};
      for (const [key, val] of Object.entries(this.config.plants)) {
        plants[key] = {
          plant: key,
          driveFolderId: val.driveFolderId || '',
          driveFolderUrl: val.driveFolderUrl || (val.driveFolderId ? `https://drive.google.com/drive/folders/${val.driveFolderId}` : ''),
          spreadsheetId: val.spreadsheetId || '',
          spreadsheetUrl: val.spreadsheetUrl || (val.spreadsheetId ? `https://docs.google.com/spreadsheets/d/${val.spreadsheetId}/edit` : ''),
          accessLevel: "Public View (ANYONE_WITH_LINK)"
        };
      }

      return {
        success: true,
        role: "ADMIN",
        isPublic: true,
        rootDrive: {
          id: this.config.capPhotoRootFolderId,
          name: "Central CAP Photo Root Folder",
          url: this.config.capPhotoRootFolderUrl || `https://drive.google.com/drive/folders/${this.config.capPhotoRootFolderId}`,
          accessLevel: "Public View (ANYONE_WITH_LINK)"
        },
        masterSpreadsheet: {
          id: this.config.masterSpreadsheetId,
          name: "Master Configuration & Users Spreadsheet",
          url: this.config.masterSpreadsheetUrl || `https://docs.google.com/spreadsheets/d/${this.config.masterSpreadsheetId}/edit`,
          accessLevel: "Public View (ANYONE_WITH_LINK)"
        },
        plants
      };
    } else {
      const val = this.config.plants[userPlant] || { plant: userPlant };
      return {
        success: true,
        role: "PLANT_USER",
        isPublic: true,
        plant: {
          plant: userPlant,
          driveFolderId: val.driveFolderId || '',
          driveFolderUrl: val.driveFolderUrl || (val.driveFolderId ? `https://drive.google.com/drive/folders/${val.driveFolderId}` : ''),
          spreadsheetId: val.spreadsheetId || '',
          spreadsheetUrl: val.spreadsheetUrl || (val.spreadsheetId ? `https://docs.google.com/spreadsheets/d/${val.spreadsheetId}/edit` : ''),
          accessLevel: "Public View (ANYONE_WITH_LINK)"
        }
      };
    }
  }
}

export const configRegistry = new ConfigRegistry();
if (typeof window !== 'undefined') {
  window.configRegistry = configRegistry;
}
