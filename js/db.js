/**
 * CAP Photo Evidence Utility - IndexedDB Storage Layer
 * Manages local persistence of photos, reports, offline queue,
 * serial sequences, sessions, and metadata.
 * 
 * Stores (memo §14):
 * - photos:   1:1 evidence images and metadata
 * - reports:  cached report metadata
 * - records:  finding records
 * - queue:    offline sync queue (memo §15)
 * - sessions: session cache
 * - metadata: app metadata and serial counters
 */

import { formatSerial } from './recordModel.js';

const DB_NAME = 'CAP_Evidence_DB';
// Bumped to 3 to ensure all stores are created even if user opened DB_VERSION 2 previously
const DB_VERSION = 3;

export class EvidenceDB {
  constructor() {
    this.db = null;
    this.initPromise = null;
  }

  async init() {
    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // 1. Photos store
        if (!db.objectStoreNames.contains('photos')) {
          const photoStore = db.createObjectStore('photos', { keyPath: 'id' });
          photoStore.createIndex('serial', 'serial', { unique: false });
          photoStore.createIndex('parentSerial', 'parentSerial', { unique: false });
          photoStore.createIndex('photoType', 'photoType', { unique: false });
          photoStore.createIndex('captureTimestamp', 'captureTimestamp', { unique: false });
          photoStore.createIndex('syncStatus', 'syncStatus', { unique: false });
          photoStore.createIndex('plant', 'plant', { unique: false });
          photoStore.createIndex('reportDate', 'reportDate', { unique: false });
        } else {
          const photoStore = event.target.transaction.objectStore('photos');
          if (!photoStore.indexNames.contains('plant')) {
            photoStore.createIndex('plant', 'plant', { unique: false });
          }
          if (!photoStore.indexNames.contains('reportDate')) {
            photoStore.createIndex('reportDate', 'reportDate', { unique: false });
          }
        }

        // 2. Settings / Serial counter store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }

        // 3. Reports store - cached report metadata
        if (!db.objectStoreNames.contains('reports')) {
          const reportsStore = db.createObjectStore('reports', { keyPath: 'id' });
          reportsStore.createIndex('plant', 'plant', { unique: false });
          reportsStore.createIndex('reportDate', 'reportDate', { unique: false });
        }

        // 4. Records store - finding records
        if (!db.objectStoreNames.contains('records')) {
          const recordsStore = db.createObjectStore('records', { keyPath: 'id' });
          recordsStore.createIndex('plant', 'plant', { unique: false });
          recordsStore.createIndex('reportDate', 'reportDate', { unique: false });
          recordsStore.createIndex('serial', 'serial', { unique: false });
        }

        // 5. Queue store - offline sync queue (memo §15)
        if (!db.objectStoreNames.contains('queue')) {
          const queueStore = db.createObjectStore('queue', { keyPath: 'operationId' });
          queueStore.createIndex('status', 'status', { unique: false });
          queueStore.createIndex('operationType', 'operationType', { unique: false });
          queueStore.createIndex('createdAt', 'createdAt', { unique: false });
          queueStore.createIndex('plant', 'plant', { unique: false });
        }

        // 6. Sessions store
        if (!db.objectStoreNames.contains('sessions')) {
          db.createObjectStore('sessions', { keyPath: 'key' });
        }

        // 7. Metadata store
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('IndexedDB error:', event.target.error);
        reject(event.target.error);
      };
    });

    return this.initPromise;
  }

  async getTransaction(storeName, mode = 'readonly') {
    const db = await this.init();
    return db.transaction(storeName, mode).objectStore(storeName);
  }

  /* =========================================================================
     SERIAL HELPERS
     ========================================================================= */

  /**
   * Get current next serial number (formatted as "001") without incrementing
   */
  async peekNextSerial() {
    try {
      const store = await this.getTransaction('settings', 'readonly');
      return new Promise((resolve) => {
        const req = store.get('nextSerial');
        req.onsuccess = () => {
          const val = req.result ? req.result.value : 1;
          resolve(formatSerial(val));
        };
        req.onerror = () => resolve('001');
      });
    } catch (e) {
      return '001';
    }
  }

  /**
   * Allocate and increment the next serial number
   * @returns {Promise<string>} 3-digit padded serial string, e.g. "001"
   */
  async allocateNextSerial() {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('settings', 'readwrite');
      const store = tx.objectStore('settings');
      const req = store.get('nextSerial');

      req.onsuccess = () => {
        const current = req.result ? req.result.value : 1;
        store.put({ key: 'nextSerial', value: current + 1 });
        resolve(formatSerial(current));
      };

      req.onerror = (e) => reject(e);
    });
  }

  /**
   * Reset next serial to a specific number
   */
  async setNextSerial(num) {
    const store = await this.getTransaction('settings', 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.put({ key: 'nextSerial', value: parseInt(num, 10) || 1 });
      req.onsuccess = () => resolve(true);
      req.onerror = (e) => reject(e);
    });
  }

  /**
   * Determine next correction sequence for a parent observation
   * @param {string} parentSerial 
   * @returns {Promise<number>} e.g. 1 for first correction, 2 for second
   */
  async getNextCorrectionSequence(parentSerial) {
    const all = await this.getAllPhotos();
    const corrections = all.filter(
      p => p.photoType === 'CORRECTED' && (p.parentSerial === parentSerial || p.serial === parentSerial)
    );
    return corrections.length + 1;
  }

  /* =========================================================================
     PHOTOS STORE
     ========================================================================= */

  /**
   * Save official CAP evidence photo record to IndexedDB
   */
  async savePhoto(record) {
    const store = await this.getTransaction('photos', 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.put(record);
      req.onsuccess = () => resolve(record);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Retrieve all photo records ordered by capture timestamp descending
   */
  async getAllPhotos() {
    const store = await this.getTransaction('photos', 'readonly');
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const records = req.result || [];
        records.sort((a, b) => new Date(b.captureTimestamp) - new Date(a.captureTimestamp));
        resolve(records);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Retrieve single photo by ID
   */
  async getPhotoById(id) {
    const store = await this.getTransaction('photos', 'readonly');
    return new Promise((resolve, reject) => {
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Update specific fields of a photo record (e.g. syncStatus, driveLink)
   */
  async updatePhoto(id, updates) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('photos', 'readwrite');
      const store = tx.objectStore('photos');
      const req = store.get(id);

      req.onsuccess = () => {
        const existing = req.result;
        if (!existing) {
          // If photo was referenced by serial or not found by ID, search by serial
          resolve(null);
          return;
        }
        const updated = { ...existing, ...updates };
        const putReq = store.put(updated);
        putReq.onsuccess = () => resolve(updated);
        putReq.onerror = (err) => reject(err.target.error);
      };

      req.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Update photo by Serial and Type
   */
  async updatePhotoBySerial(serial, photoType, updates) {
    const photos = await this.getAllPhotos();
    const target = photos.find(p => p.serial === serial && (!photoType || p.photoType === photoType));
    if (target) {
      return this.updatePhoto(target.id, updates);
    }
    return null;
  }

  /**
   * Delete photo record by ID
   */
  async deletePhoto(id) {
    const store = await this.getTransaction('photos', 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve(true);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /* =========================================================================
     QUEUE STORE (Offline sync queue, memo §15)
     ========================================================================= */

  /**
   * Enqueue an operation for offline sync
   * @param {Object} operation - { operationId, operationType, plant, reportDate, reportId, recordId, payload, status }
   */
  async enqueueOperation(operation) {
    const entry = {
      operationId: operation.operationId || `op_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      operationType: operation.operationType,
      plant: operation.plant || '',
      reportDate: operation.reportDate || '',
      reportId: operation.reportId || '',
      recordId: operation.recordId || '',
      payload: operation.payload || {},
      createdAt: new Date().toISOString(),
      attemptCount: 0,
      lastAttemptAt: null,
      status: 'PENDING',
      error: null
    };

    const store = await this.getTransaction('queue', 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.put(entry);
      req.onsuccess = () => resolve(entry);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Alias for enqueueOperation to support both naming conventions
   */
  async addQueueOperation(operation) {
    return this.enqueueOperation(operation);
  }

  /**
   * Get all pending queue operations ordered by creation time
   */
  async getPendingOperations() {
    const store = await this.getTransaction('queue', 'readonly');
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const all = req.result || [];
        const pending = all.filter(op => op.status === 'PENDING' || op.status === 'NEEDS_ATTENTION');
        pending.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        resolve(pending);
      };
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Update a queue operation
   */
  async updateQueueOperation(operationId, updates) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('queue', 'readwrite');
      const store = tx.objectStore('queue');
      const req = store.get(operationId);

      req.onsuccess = () => {
        const existing = req.result;
        if (!existing) {
          resolve(null);
          return;
        }
        const updated = { ...existing, ...updates };
        const putReq = store.put(updated);
        putReq.onsuccess = () => resolve(updated);
        putReq.onerror = (err) => reject(err.target.error);
      };

      req.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Remove a queue operation (after successful sync)
   */
  async removeQueueOperation(operationId) {
    const store = await this.getTransaction('queue', 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.delete(operationId);
      req.onsuccess = () => resolve(true);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Get all queue operations (for status display)
   */
  async getAllQueueOperations() {
    const store = await this.getTransaction('queue', 'readonly');
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /* =========================================================================
     REPORTS STORE (cached report metadata)
     ========================================================================= */

  async saveReport(report) {
    const store = await this.getTransaction('reports', 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.put(report);
      req.onsuccess = () => resolve(report);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  async getReportsByPlant(plant) {
    const store = await this.getTransaction('reports', 'readonly');
    return new Promise((resolve, reject) => {
      const index = store.index('plant');
      const req = index.getAll(plant);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /* =========================================================================
     UTILITY
     ========================================================================= */

  /**
   * Clear all records (useful for test reset)
   */
  async clearAll() {
    const db = await this.init();
    const storeNames = ['photos', 'settings', 'reports', 'records', 'queue', 'sessions', 'metadata'];
    for (const name of storeNames) {
      try {
        const tx = db.transaction(name, 'readwrite');
        const store = tx.objectStore(name);
        store.clear();
      } catch (e) {
        // Store may not exist in older DB versions
      }
    }
    return true;
  }
}

export const dbInstance = new EvidenceDB();
