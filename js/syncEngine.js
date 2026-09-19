/**
 * CAP Photo Evidence Utility - Cloud Sync Engine
 * 
 * Handles offline detection, sync queue processing, and integration with
 * Google Apps Script (Google Drive & Google Sheets).
 * 
 * Queue processing order (memo §17):
 * 1. Validate/renew session
 * 2. CREATE_REPORT
 * 3. CREATE_FINDING
 * 4. Original evidence
 * 5. Corrected evidence
 * 6. Allowed updates/status
 * 7. Refresh authoritative report
 * 
 * Automatic sync triggers (memo §17):
 * - Application startup
 * - Login
 * - Browser 'online' event
 * - Page focus/visibility
 * - Periodic active-app checks
 * - After successful operations when queue items remain
 */

import { dbInstance } from './db.js';
import { apiServiceInstance } from './apiService.js';

// Processing order for operation types (lower = higher priority)
const OPERATION_PRIORITY = {
  'CREATE_REPORT': 1,
  'CREATE_FINDING': 2,
  'UPLOAD_ORIGINAL': 3,
  'RECTIFY_FINDING': 4,
  'UPLOAD_CORRECTED': 5,
  'UPDATE_ALLOWED_FIELD': 6
};

export class SyncEngine {
  constructor() {
    this.isOnline = navigator.onLine;
    this.simulatedOffline = false;
    this.isSyncing = false;
    this.listeners = new Set();
    this.periodicTimer = null;
    this.initNetworkListeners();
    this.initVisibilityListener();
    this.startPeriodicCheck();
  }

  initNetworkListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.notifyListeners('network_change', { isOnline: this.effectiveOnline });
      if (this.effectiveOnline) {
        this.processQueue();
      }
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.notifyListeners('network_change', { isOnline: false });
    });
  }

  /**
   * Sync on page focus/visibility (memo §17)
   */
  initVisibilityListener() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.effectiveOnline) {
        this.processQueue();
      }
    });

    window.addEventListener('focus', () => {
      if (this.effectiveOnline) {
        this.processQueue();
      }
    });
  }

  /**
   * Periodic active-app check (memo §17)
   */
  startPeriodicCheck() {
    this.periodicTimer = setInterval(() => {
      if (this.effectiveOnline && !this.isSyncing) {
        this.processQueue();
      }
    }, 120000); // Every 2 minutes
  }

  get effectiveOnline() {
    return this.isOnline && !this.simulatedOffline;
  }

  toggleSimulatedOffline(forceValue) {
    if (typeof forceValue === 'boolean') {
      this.simulatedOffline = forceValue;
    } else {
      this.simulatedOffline = !this.simulatedOffline;
    }
    this.notifyListeners('network_change', { isOnline: this.effectiveOnline, simulated: this.simulatedOffline });
    if (this.effectiveOnline) {
      this.processQueue();
    }
    return this.simulatedOffline;
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notifyListeners(type, data) {
    for (const listener of this.listeners) {
      try {
        listener(type, data);
      } catch (err) {
        console.error('Error in sync listener:', err);
      }
    }
  }

  /**
   * Process all pending uploads in IndexedDB
   * Handles both legacy photo-based sync and new queue-based sync
   */
  async processQueue() {
    if (this.isSyncing || !this.effectiveOnline) {
      return;
    }

    this.isSyncing = true;
    this.notifyListeners('sync_start', {});

    let syncedCount = 0;

    try {
      // 1. Process queue operations (new structured queue)
      const queueOps = await dbInstance.getPendingOperations();

      if (queueOps.length > 0) {
        // Sort by priority
        queueOps.sort((a, b) => {
          const pa = OPERATION_PRIORITY[a.operationType] || 99;
          const pb = OPERATION_PRIORITY[b.operationType] || 99;
          if (pa !== pb) return pa - pb;
          return new Date(a.createdAt) - new Date(b.createdAt);
        });

        for (const op of queueOps) {
          if (!this.effectiveOnline) break;

          try {
            await dbInstance.updateQueueOperation(op.operationId, {
              status: 'SYNCING',
              attemptCount: op.attemptCount + 1,
              lastAttemptAt: new Date().toISOString()
            });

            this.notifyListeners('sync_progress', {
              operationId: op.operationId,
              operationType: op.operationType,
              status: 'SYNCING'
            });

            const syncResult = await apiServiceInstance.syncOperation({
              ...op.payload,
              operationType: op.operationType,
              clientOperationId: op.operationId
            });

            // Update photo record in IndexedDB with Drive file details
            const driveFileId = syncResult && syncResult.driveFileId;
            const driveLink = syncResult && (syncResult.driveFileUrl || syncResult.driveLink);
            const syncedAt = new Date().toISOString();

            if (op.recordId) {
              await dbInstance.updatePhoto(op.recordId, {
                syncStatus: 'SYNCED',
                driveFileId: driveFileId || undefined,
                driveLink: driveLink || undefined,
                syncedAt
              });
            } else if (op.payload && op.payload.serial) {
              const photoType = (op.operationType && (op.operationType.includes('CORRECTED') || op.operationType === 'RECTIFY_FINDING')) ? 'CORRECTED' : 'ORIGINAL';
              await dbInstance.updatePhotoBySerial(op.payload.serial, photoType, {
                syncStatus: 'SYNCED',
                driveFileId: driveFileId || undefined,
                driveLink: driveLink || undefined,
                syncedAt
              });
            }

            await dbInstance.removeQueueOperation(op.operationId);
            syncedCount++;

          } catch (err) {
            console.error('Queue sync error for', op.operationId, err);
            const newStatus = op.attemptCount >= 3 ? 'NEEDS_ATTENTION' : 'PENDING';
            await dbInstance.updateQueueOperation(op.operationId, {
              status: newStatus,
              error: err.message
            });
          }
        }
      }

      // 2. Process legacy pending photo uploads
      const allPhotos = await dbInstance.getAllPhotos();
      const pending = allPhotos.filter(p => p.syncStatus === 'PENDING');

      if (pending.length > 0) {
        for (let i = 0; i < pending.length; i++) {
          if (!this.effectiveOnline) break;

          const photo = pending[i];
          this.notifyListeners('sync_progress', {
            current: i + 1,
            total: pending.length,
            filename: photo.filename
          });

          try {
            const uploadResult = await apiServiceInstance.uploadEvidenceToCloud(photo);

            const driveFileId = uploadResult.driveFileId;
            const driveLink = uploadResult.driveFileUrl;
            const syncedAt = new Date().toISOString();

            await dbInstance.updatePhoto(photo.id, {
              syncStatus: 'SYNCED',
              driveFileId,
              driveLink,
              syncedAt
            });

            syncedCount++;
          } catch (err) {
            console.error('Photo sync error for', photo.filename, err);
            await dbInstance.updatePhoto(photo.id, {
              syncStatus: 'FAILED',
              syncError: err.message
            });
          }
        }
      }

      this.notifyListeners('sync_complete', { count: syncedCount });
    } catch (err) {
      console.error('Cloud sync failure:', err);
      this.notifyListeners('sync_error', { error: err.message });
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Get current queue status summary
   */
  async getQueueStatus() {
    try {
      const ops = await dbInstance.getAllQueueOperations();
      const photos = await dbInstance.getAllPhotos();
      const pendingPhotos = photos.filter(p => p.syncStatus === 'PENDING');

      return {
        pendingOperations: ops.filter(o => o.status === 'PENDING').length,
        syncingOperations: ops.filter(o => o.status === 'SYNCING').length,
        needsAttention: ops.filter(o => o.status === 'NEEDS_ATTENTION').length,
        pendingPhotos: pendingPhotos.length,
        totalPending: ops.filter(o => o.status === 'PENDING').length + pendingPhotos.length
      };
    } catch (e) {
      return { pendingOperations: 0, syncingOperations: 0, needsAttention: 0, pendingPhotos: 0, totalPending: 0 };
    }
  }
}

export const syncEngineInstance = new SyncEngine();
