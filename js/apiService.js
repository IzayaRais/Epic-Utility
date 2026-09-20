/**
 * CAP Photo Evidence Utility - Direct Google Cloud API Service
 * 
 * Replaces Google Apps Script backend with direct communication with:
 * - Google Sheets API v4 (reading/writing findings, users, summaries)
 * - Google Drive API v3 (multipart image evidence uploads)
 * 
 * Maintained with 100% backward-compatible API surface for syncEngine.js and app.js.
 */

import { redisCache } from './cacheEngine.js';
import { googleApiServiceInstance, GoogleApiService, STORAGE_LOCATIONS } from './googleApiService.js';

export class ApiService {
  constructor() {
    this.engine = googleApiServiceInstance;
  }

  isConfigured() {
    return this.engine.isConfigured();
  }

  getApiUrl() {
    return this.engine.getApiUrl();
  }

  setApiUrl(url) {
    this.engine.setApiUrl(url);
  }

  getActivePlant() {
    return this.engine.getActivePlant();
  }

  setActivePlant(plant) {
    this.engine.setActivePlant(plant);
  }

  loadCurrentUser() {
    return this.engine.loadCurrentUser();
  }

  saveCurrentUser(user, sessionToken = null) {
    return this.engine.saveCurrentUser(user, sessionToken);
  }

  clearCurrentUser() {
    return this.engine.clearCurrentUser();
  }

  getCurrentUser() {
    return this.engine.getCurrentUser();
  }

  getSessionToken() {
    return this.engine.getSessionToken();
  }

  async login(username, password) {
    return this.engine.login(username, password);
  }

  async validateSession() {
    return this.engine.validateSession();
  }

  async testConnection() {
    return this.engine.testConnection();
  }

  async initMasterSheets() {
    return { success: true, message: "Direct Google Cloud API active." };
  }

  async listPlantReports(plant = null) {
    return this.engine.listPlantReports(plant);
  }

  async ensurePlantReport(plant = null, reportDate = null) {
    return this.engine.ensurePlantReport(plant, reportDate);
  }

  async getPlantReportInfo(plant = null, reportDate = null) {
    return this.engine.getPlantReportInfo(plant, reportDate);
  }

  async getReportSummary(plant = null) {
    return this.engine.getReportSummary(plant);
  }

  async createFinding(params) {
    return this.engine.createFinding(params);
  }

  async rectifyFinding(params) {
    return this.engine.rectifyFinding(params);
  }

  async uploadEvidenceToCloud(record, plant = null) {
    return this.engine.uploadEvidenceToCloud(record, plant);
  }

  async syncOperation(operation) {
    return this.engine.syncOperation(operation);
  }

  async getStorageLocations() {
    return this.engine.getStorageLocations();
  }

  async writeLog(entry) {
    return this.engine.writeLog(entry);
  }

  async deleteFinding(plant, reportDate, rowNumber) {
    return this.engine.deleteFinding(plant, reportDate, rowNumber);
  }

  async updateFinding(plant, reportDate, rowNumber, fields) {
    return this.engine.updateFinding(plant, reportDate, rowNumber, fields);
  }

  async deletePlantReport(plant, reportDate) {
    return this.engine.deletePlantReport(plant, reportDate);
  }

  generateOperationId() {
    return `op_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

export const apiServiceInstance = new ApiService();
if (typeof window !== 'undefined') {
  window.redisCache = redisCache;
  window.apiService = apiServiceInstance;
  window.googleApiService = googleApiServiceInstance;
}

export { redisCache, STORAGE_LOCATIONS, googleApiServiceInstance };
