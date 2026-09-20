/**
 * Epic Group - Electrical Internal CAP Report Field Inspector
 * Complete Enterprise Application Controller
 * 
 * Workflow Highlights:
 * 1. Landing View upon Login: Date-Wise CAP Reports Hub (sourced from Drive & Sheets)
 * 2. Full Sheet View: The whole report at once with live KPIs (Total, P1, P2, P3, Rectified, Pending)
 * 3. Rich Photo Gallery: Visual grid of all observations with quick inspection pop-ups
 * 4. Rectification Pop-Up: Quick camera/mobile photo capture for Column J with auto "Rectified" update
 * 5. Strict 1:1 center-crop + bottom watermark strip (never overlays photo area)
 * 6. Offline-first IndexedDB storage + automatic background Google Drive/Sheets synchronization
 * 7. Strict ADMIN-only enforcement for new inspections and findings (memo §4, §8)
 */

import { formatSerial, createPhotoRecord } from './recordModel.js';
import { CanvasEngine } from './canvasEngine.js';
import { dbInstance } from './db.js';
import { syncEngineInstance } from './syncEngine.js';
import { apiServiceInstance } from './apiService.js';
import { ICONS, withIcon } from './icons.js';

class EpicCAPApp {
  constructor() {
    this.mediaStream = null;
    this.rectifyStream = null;
    this.facingMode = 'environment';
    
    this.currentRawSource = null;
    this.currentRectifySource = null;
    
    this.currentUser = null;
    this.activePlant = 'CIPL';
    this.activeReportDate = new Date().toISOString().substring(0, 10);
    this.activeSpreadsheetUrl = null;

    this.reportsList = [];
    this.cachedObservations = [];
    this.activeGalleryFilter = 'ALL';
    this.activeTargetObs = null;

    this.dom = {
      // Login
      loginPortal: document.getElementById('loginPortal'),
      loginForm: document.getElementById('loginForm'),
      usernameInput: document.getElementById('usernameInput'),
      passwordInput: document.getElementById('passwordInput'),
      loginSubmitBtn: document.getElementById('loginSubmitBtn'),
      loginErrorAlert: document.getElementById('loginErrorAlert'),
      loginErrorMsg: document.getElementById('loginErrorMsg'),
      quickRoleChips: document.querySelectorAll('.quick-role-chip'),

      // Header
      mainAppShell: document.getElementById('mainAppShell'),
      plantSelector: document.getElementById('plantSelector'),
      lockedPlantBadge: document.getElementById('lockedPlantBadge'),
      reportDatePicker: document.getElementById('reportDatePicker'),
      userNameDisplay: document.getElementById('userNameDisplay'),
      userRoleBadge: document.getElementById('userRoleBadge'),
      networkToggleBtn: document.getElementById('networkToggleBtn'),
      networkStatusText: document.getElementById('networkStatusText'),
      openSettingsBtn: document.getElementById('openSettingsBtn'),
      logoutBtn: document.getElementById('logoutBtn'),

      // Nav Tabs
      tabs: document.querySelectorAll('.ms-tab'),
      tabPanes: document.querySelectorAll('.tab-pane'),
      reportsCountBadge: document.getElementById('reportsCountBadge'),
      sheetObsCountBadge: document.getElementById('sheetObsCountBadge'),
      galleryCountBadge: document.getElementById('galleryCountBadge'),

      // TAB 1: Reports Hub
      reportsHubPlantLabel: document.getElementById('reportsHubPlantLabel'),
      startNewInspectionBtn: document.getElementById('startNewInspectionBtn'),
      refreshReportsHubBtn: document.getElementById('refreshReportsHubBtn'),
      activeReportBanner: document.getElementById('activeReportBanner'),
      bannerReportName: document.getElementById('bannerReportName'),
      bannerReportDate: document.getElementById('bannerReportDate'),
      bannerViewSheetBtn: document.getElementById('bannerViewSheetBtn'),
      bannerViewGalleryBtn: document.getElementById('bannerViewGalleryBtn'),
      reportsGrid: document.getElementById('reportsGrid'),
      reportsGridEmpty: document.getElementById('reportsGridEmpty'),

      // TAB 2: Full Report Sheet View
      sheetReportTitle: document.getElementById('sheetReportTitle'),
      sheetReportDateText: document.getElementById('sheetReportDateText'),
      openGoogleSheetLink: document.getElementById('openGoogleSheetLink'),
      addNewObsFromSheetBtn: document.getElementById('addNewObsFromSheetBtn'),
      deleteReportBtn: document.getElementById('deleteReportBtn'),
      exportCsvBtn: document.getElementById('exportCsvBtn'),
      printReportBtn: document.getElementById('printReportBtn'),
      kpiTotalCount: document.getElementById('kpiTotalCount'),
      kpiP1Count: document.getElementById('kpiP1Count'),
      kpiP2Count: document.getElementById('kpiP2Count'),
      kpiP3Count: document.getElementById('kpiP3Count'),
      kpiRectifiedCount: document.getElementById('kpiRectifiedCount'),
      kpiPendingCount: document.getElementById('kpiPendingCount'),
      sheetReportTableBody: document.getElementById('sheetReportTableBody'),
      sheetTableEmpty: document.getElementById('sheetTableEmpty'),

      // TAB 3: Photo Gallery View
      galleryFilters: document.querySelectorAll('.gallery-filter-btn'),
      galleryFilterAllCount: document.getElementById('galleryFilterAllCount'),
      galleryFilterPendingCount: document.getElementById('galleryFilterPendingCount'),
      galleryFilterRectifiedCount: document.getElementById('galleryFilterRectifiedCount'),
      galleryGrid: document.getElementById('galleryGrid'),
      galleryEmpty: document.getElementById('galleryEmpty'),

      // TAB 4: Capture New Observation (Minimal Photo Intake)
      capturePromptBox: document.getElementById('capturePromptBox'),
      capturePreviewContainer: document.getElementById('capturePreviewContainer'),
      capturePreviewBox: document.getElementById('capturePreviewBox'),
      phoneCameraInput: document.getElementById('phoneCameraInput'),
      photoGalleryInput: document.getElementById('photoGalleryInput'),
      phoneCameraRetakeInput: document.getElementById('phoneCameraRetakeInput'),
      photoGalleryRetakeInput: document.getElementById('photoGalleryRetakeInput'),
      clearCapturePhotoBtn: document.getElementById('clearCapturePhotoBtn'),
      toggleWebcamBtn: document.getElementById('toggleWebcamBtn'),
      webcamControlsBar: document.getElementById('webcamControlsBar'),
      closeWebcamBtn: document.getElementById('closeWebcamBtn'),
      cameraViewport: document.getElementById('cameraViewport'),
      cameraVideo: document.getElementById('cameraVideo'),
      activePhotoPreviewImg: document.getElementById('activePhotoPreviewImg'),
      takeLivePhotoBtn: document.getElementById('takeLivePhotoBtn'),
      switchCameraBtn: document.getElementById('switchCameraBtn'),
      currentSerialDisplay: document.getElementById('currentSerialDisplay'),
      findingInput: document.getElementById('findingInput'),
      locationInput: document.getElementById('locationInput'),
      recommendationInput: document.getElementById('recommendationInput'),
      riskLevelSelect: document.getElementById('riskLevelSelect'),
      desktopLiveFilename: document.getElementById('desktopLiveFilename'),
      submitEvidenceBtn: document.getElementById('submitEvidenceBtn'),
      dualSaveNotice: document.getElementById('dualSaveNotice'),
      dualSaveNoticeText: document.getElementById('dualSaveNoticeText'),

      // TAB 5: Cloud Sync
      syncTargetDrivePath: document.getElementById('syncTargetDrivePath'),
      syncTargetSheetName: document.getElementById('syncTargetSheetName'),
      syncNowBtn: document.getElementById('syncNowBtn'),
      openBackendSettingsFromDriveBtn: document.getElementById('openBackendSettingsFromDriveBtn'),
      cloudFilesList: document.getElementById('cloudFilesList'),
      syncPendingCount: document.getElementById('syncPendingCount'),
      syncAttentionCount: document.getElementById('syncAttentionCount'),
      syncPendingPhotosCount: document.getElementById('syncPendingPhotosCount'),

      // MODAL 1: Photo Detail Modal
      photoDetailModal: document.getElementById('photoDetailModal'),
      closeDetailModalBtn: document.getElementById('closeDetailModalBtn'),
      detailModalCloseBtn: document.getElementById('detailModalCloseBtn'),
      detailModalImg: document.getElementById('detailModalImg'),
      detailModalSerial: document.getElementById('detailModalSerial'),
      detailModalStatusBadge: document.getElementById('detailModalStatusBadge'),
      detailModalFinding: document.getElementById('detailModalFinding'),
      detailModalLocation: document.getElementById('detailModalLocation'),
      detailModalRiskLevel: document.getElementById('detailModalRiskLevel'),
      detailModalTime: document.getElementById('detailModalTime'),
      detailRectifiedSection: document.getElementById('detailRectifiedSection'),
      detailModalCorrImg: document.getElementById('detailModalCorrImg'),
      detailModalRectifyBtn: document.getElementById('detailModalRectifyBtn'),
      detailModalDownloadLink: document.getElementById('detailModalDownloadLink'),

      // MODAL 2: Rectification Pop-Up Modal
      rectifyModal: document.getElementById('rectifyModal'),
      rectifyModalTitle: document.getElementById('rectifyModalTitle'),
      closeRectifyModalBtn: document.getElementById('closeRectifyModalBtn'),
      cancelRectifyBtn: document.getElementById('cancelRectifyBtn'),
      rectifyRefThumbWrap: document.getElementById('rectifyRefThumbWrap'),
      rectifyRefThumb: document.getElementById('rectifyRefThumb'),
      rectifyRefSerialBadge: document.getElementById('rectifyRefSerialBadge'),
      rectifyRefRiskBadge: document.getElementById('rectifyRefRiskBadge'),
      rectifyRefFinding: document.getElementById('rectifyRefFinding'),
      rectifyRefLocation: document.getElementById('rectifyRefLocation'),
      rectifyCapturePrompt: document.getElementById('rectifyCapturePrompt'),
      rectifyPhoneCameraInput: document.getElementById('rectifyPhoneCameraInput'),
      rectifyGalleryInput: document.getElementById('rectifyGalleryInput'),
      rectifyToggleWebcamBtn: document.getElementById('rectifyToggleWebcamBtn'),
      rectifyPreviewContainer: document.getElementById('rectifyPreviewContainer'),
      rectifyPreviewImg: document.getElementById('rectifyPreviewImg'),
      rectifyRetakeInput: document.getElementById('rectifyRetakeInput'),
      rectifyRemovePhotoBtn: document.getElementById('rectifyRemovePhotoBtn'),
      rectifyWebcamContainer: document.getElementById('rectifyWebcamContainer'),
      rectifyCameraViewport: document.getElementById('rectifyCameraViewport'),
      rectifyCameraVideo: document.getElementById('rectifyCameraVideo'),
      rectifyTakeLiveBtn: document.getElementById('rectifyTakeLiveBtn'),
      rectifyFlipBtn: document.getElementById('rectifyFlipBtn'),
      rectifyCloseWebcamBtn: document.getElementById('rectifyCloseWebcamBtn'),
      rectifyRemarksInput: document.getElementById('rectifyRemarksInput'),
      submitRectificationBtn: document.getElementById('submitRectificationBtn'),

      // MODAL: Edit Finding Modal (Admin)
      editFindingModal: document.getElementById('editFindingModal'),
      editFindingModalTitle: document.getElementById('editFindingModalTitle'),
      closeEditFindingModalBtn: document.getElementById('closeEditFindingModalBtn'),
      cancelEditFindingBtn: document.getElementById('cancelEditFindingBtn'),
      saveEditFindingBtn: document.getElementById('saveEditFindingBtn'),
      editFindingRowNumber: document.getElementById('editFindingRowNumber'),
      editFindingSerial: document.getElementById('editFindingSerial'),
      editFindingInput: document.getElementById('editFindingInput'),
      editLocationInput: document.getElementById('editLocationInput'),
      editRecommendationInput: document.getElementById('editRecommendationInput'),
      editRiskLevelSelect: document.getElementById('editRiskLevelSelect'),

      // Settings Modal
      settingsModal: document.getElementById('settingsModal'),
      closeSettingsBtn: document.getElementById('closeSettingsBtn'),
      connectionStatusBox: document.getElementById('connectionStatusBox'),
      connectionStatusText: document.getElementById('connectionStatusText'),
      connectionLatencyBadge: document.getElementById('connectionLatencyBadge'),
      connectionDetailText: document.getElementById('connectionDetailText'),
      serviceAccountEmailDisplay: document.getElementById('serviceAccountEmailDisplay'),
      testConnectionBtn: document.getElementById('testConnectionBtn'),
      saveSettingsBtn: document.getElementById('saveSettingsBtn'),

      // Cloud Storage Hub Directory & Modal
      cloudStorageHubBtn: document.getElementById('cloudStorageHubBtn'),
      storageHubBtnText: document.getElementById('storageHubBtnText'),
      storageScopeBadge: document.getElementById('storageScopeBadge'),
      storageDirectoryContainer: document.getElementById('storageDirectoryContainer'),
      storageDirectoryModal: document.getElementById('storageDirectoryModal'),
      modalStorageDirectoryContainer: document.getElementById('modalStorageDirectoryContainer'),
      closeStorageModalBtn: document.getElementById('closeStorageModalBtn'),
      doneStorageModalBtn: document.getElementById('doneStorageModalBtn')
    };
  }

  async init() {
    await dbInstance.init();
    await dbInstance.cleanupOrphanPhotos();
    this.dom.reportDatePicker.value = this.activeReportDate;

    this.setupEventListeners();
    this.setupSyncSubscription();

    // Check existing auth session
    const savedUser = apiServiceInstance.getCurrentUser();
    if (savedUser && (!apiServiceInstance.isConfigured() || apiServiceInstance.getSessionToken())) {
      this.applyAuthenticatedUser(savedUser);
    } else {
      if (savedUser) {
        apiServiceInstance.clearCurrentUser();
      }
      this.showLoginPortal();
    }
  }

  /* ==========================================================================
     1. AUTHENTICATION & LANDING LOGIC
     ========================================================================== */

  showLoginPortal() {
    document.body.classList.remove('role-admin', 'role-plant-user');
    this.dom.loginPortal.classList.remove('hidden');
    this.dom.mainAppShell.classList.add('hidden');
    this.stopAllCameras();
  }

  applyAuthenticatedUser(user) {
    this.currentUser = user;
    this.dom.loginPortal.classList.add('hidden');
    this.dom.mainAppShell.classList.remove('hidden');

    this.dom.userNameDisplay.textContent = user.name || user.username;
    this.dom.userRoleBadge.textContent = user.role;

    if (user.role === 'ADMIN') {
      document.body.classList.remove('role-plant-user');
      document.body.classList.add('role-admin');
      this.dom.plantSelector.classList.remove('hidden');
      this.dom.lockedPlantBadge.classList.add('hidden');
      this.dom.plantSelector.value = apiServiceInstance.getActivePlant() || 'CIPL';
      this.activePlant = this.dom.plantSelector.value;
      if (this.dom.storageHubBtnText) this.dom.storageHubBtnText.textContent = 'Cloud Drives';
      if (this.dom.deleteReportBtn) this.dom.deleteReportBtn.classList.remove('hidden');
    } else {
      document.body.classList.remove('role-admin');
      document.body.classList.add('role-plant-user');
      this.dom.plantSelector.classList.add('hidden');
      this.dom.lockedPlantBadge.classList.remove('hidden');
      this.dom.lockedPlantBadge.textContent = user.plant;
      this.activePlant = user.plant;
      apiServiceInstance.setActivePlant(user.plant);
      if (this.dom.storageHubBtnText) this.dom.storageHubBtnText.textContent = `${user.plant} Drive`;
      if (this.dom.deleteReportBtn) this.dom.deleteReportBtn.classList.add('hidden');
    }

    this.dom.reportsHubPlantLabel.textContent = this.activePlant;
    this.updateTargetDriveLabels();
    this.renderStorageDirectory();

    // LANDING VIEW: First thing shown is the Reports Hub!
    this.switchTab('reports');
    this.loadPlantReportsHub();
    this.refreshSerial();
    this.updateSyncQueueStatus();
  }

  async handleLogin(username, password) {
    this.dom.loginErrorAlert.classList.add('hidden');
    this.dom.loginSubmitBtn.disabled = true;
    this.dom.loginSubmitBtn.innerHTML = '<span>Verifying credentials...</span>';

    try {
      const res = await apiServiceInstance.login(username, password);
      if (res && res.success && res.user) {
        this.applyAuthenticatedUser(res.user);
        this.showToast(`Welcome, ${res.user.name}!`);
      } else {
        throw new Error((res && res.error) || 'Invalid credentials');
      }
    } catch (err) {
      this.dom.loginErrorAlert.classList.remove('hidden');
      this.dom.loginErrorMsg.textContent = err.message || 'Login failed. Please check credentials.';
    } finally {
      this.dom.loginSubmitBtn.disabled = false;
      this.dom.loginSubmitBtn.innerHTML = '<span>Sign In</span>';
    }
  }

  handleLogout() {
    apiServiceInstance.clearCurrentUser();
    this.currentUser = null;
    this.showLoginPortal();
    this.showToast('Signed out.');
  }

  /* ==========================================================================
     2. REPORTS HUB: DATE-WISE CAP REPORTS (First View After Login)
     ========================================================================== */

  async loadPlantReportsHub() {
    this.dom.reportsHubPlantLabel.textContent = this.activePlant;
    this.dom.reportsGrid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 2rem; color: var(--ms-text-secondary);" class="icon-label">
        ${ICONS.refresh}
        <span>Loading date-wise CAP reports directly from Google Sheets...</span>
      </div>
    `;

    try {
      // 1. Fetch remote reports directly from Google Sheets for this plant
      let remoteReports = [];
      try {
        const res = await apiServiceInstance.listPlantReports(this.activePlant);
        if (res && res.reports) {
          remoteReports = res.reports;
        }
      } catch (e) {
        console.warn('Could not fetch remote plant reports list:', e);
      }

      this.reportsList = remoteReports;

      // 2. If no reports found on Google Sheets, check for plant-isolated local pending items
      if (this.reportsList.length === 0) {
        const localPlantPhotos = await dbInstance.getPhotosByPlant(this.activePlant);
        const dateMap = new Map();
        for (const p of localPlantPhotos) {
          const d = p.reportDate || this.activeReportDate;
          if (d) {
            if (!dateMap.has(d)) dateMap.set(d, []);
            dateMap.get(d).push(p);
          }
        }

        for (const [d, photos] of dateMap.entries()) {
          const origPhotos = photos.filter(p => p.photoType === 'ORIGINAL');
          const corrCount = photos.filter(p => p.photoType === 'CORRECTED').length;
          const p1Local = origPhotos.filter(p => p.riskLevel === 'Priority 1').length;
          const p2Local = origPhotos.filter(p => p.riskLevel === 'Priority 2' || !p.riskLevel).length;
          const p3Local = origPhotos.filter(p => p.riskLevel === 'Priority 3').length;

          this.reportsList.push({
            id: `local-${d}`,
            tabName: d,
            reportDate: d,
            name: `${this.activePlant}- Electrical Internal CAP Report - ${d}`,
            url: null,
            totalObservations: origPhotos.length,
            p1Count: p1Local,
            p2Count: p2Local,
            p3Count: p3Local,
            rectifiedCount: corrCount,
            pendingCount: Math.max(0, origPhotos.length - corrCount),
            source: 'LOCAL'
          });
        }
      }

      this.reportsList.sort((a, b) => b.reportDate.localeCompare(a.reportDate));

      if (this.dom.reportsCountBadge) {
        this.dom.reportsCountBadge.textContent = this.reportsList.length;
      }

      this.renderReportsGrid();

      // Select latest report by default
      if (this.reportsList.length > 0) {
        const latest = this.reportsList[0];
        this.setActiveReport(latest.reportDate, latest.name, latest.url, latest.tabName);
      } else {
        if (this.dom.reportsGridEmpty) this.dom.reportsGridEmpty.classList.remove('hidden');
      }

    } catch (err) {
      console.error('Failed to load reports hub:', err);
      this.dom.reportsGrid.innerHTML = `<div style="grid-column:1/-1; color: var(--ms-danger); padding: 1rem;">Failed to load reports: ${err.message}</div>`;
    }
  }

  renderReportsGrid() {
    this.dom.reportsGrid.innerHTML = '';

    if (this.reportsList.length === 0) {
      this.dom.reportsGridEmpty.classList.remove('hidden');
      return;
    }
    this.dom.reportsGridEmpty.classList.add('hidden');

    for (const report of this.reportsList) {
      const card = document.createElement('div');
      card.className = 'report-card';
      const pct = report.totalObservations > 0 
        ? Math.round((report.rectifiedCount / report.totalObservations) * 100) 
        : 0;

      card.innerHTML = `
        <div class="report-card-header">
          <span class="report-date-badge icon-label">
            ${ICONS.calendar}
            <span>${report.reportDate}</span>
          </span>
          <span style="font-size: 0.72rem; color: var(--ms-text-muted); font-weight: 600;" class="icon-label">
            ${report.source === 'GOOGLE_DRIVE' ? `${ICONS.cloud} <span>Drive Sheet</span>` : `${ICONS.reports} <span>Local CAP</span>`}
          </span>
        </div>

        <div class="report-card-title">${report.name}</div>

        <div class="report-metrics-row">
          <span class="metric-pill total">Total: ${report.totalObservations}</span>
          <span class="metric-pill rectified icon-label">${ICONS.check} <span>Rectified: ${report.rectifiedCount}</span></span>
          <span class="metric-pill pending icon-label">${ICONS.warning} <span>Pending: ${report.pendingCount}</span></span>
        </div>

        <div class="report-card-kpis">
          <span class="report-card-kpi p1">P1: ${report.p1Count || 0}</span>
          <span class="report-card-kpi p2">P2: ${report.p2Count || 0}</span>
          <span class="report-card-kpi p3">P3: ${report.p3Count || 0}</span>
          <span class="report-card-kpi rect">Rectified: ${report.rectifiedCount || 0}</span>
          <span class="report-card-kpi pend">Pending: ${report.pendingCount || 0}</span>
        </div>

        <div class="report-progress-bar" title="${pct}% Rectified" style="margin-top: 0.6rem;">
          <div class="report-progress-fill" style="width: ${pct}%;"></div>
        </div>

        <div class="report-card-actions">
          <button class="ms-btn-secondary open-sheet-btn btn-icon-wrap" style="flex: 1; font-size: 0.75rem; font-weight: 700;">
            ${ICONS.sheet}
            <span>Open Report</span>
          </button>
          <button class="ms-btn-secondary open-gallery-btn btn-icon-wrap" style="flex: 1; font-size: 0.75rem; font-weight: 700;">
            ${ICONS.gallery}
            <span>View Gallery</span>
          </button>
        </div>
      `;

      card.querySelector('.open-sheet-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.setActiveReport(report.reportDate, report.name, report.url, report.tabName);
        this.switchTab('sheet');
      });

      card.querySelector('.open-gallery-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.setActiveReport(report.reportDate, report.name, report.url, report.tabName);
        this.switchTab('gallery');
      });

      card.addEventListener('click', () => {
        this.setActiveReport(report.reportDate, report.name, report.url, report.tabName);
        this.switchTab('sheet');
      });

      this.dom.reportsGrid.appendChild(card);
    }
  }

  setActiveReport(reportDate, name = null, sheetUrl = null, tabName = null) {
    this.activeReportDate = reportDate;
    this.activeReportTabName = tabName || reportDate;
    this.activeSpreadsheetUrl = sheetUrl;
    this.dom.reportDatePicker.value = reportDate;

    const reportName = name || `${this.activePlant}- Electrical Internal CAP Report - ${reportDate}`;
    this.dom.bannerReportName.textContent = reportName;
    this.dom.bannerReportDate.textContent = `Audit Date: ${reportDate}`;
    this.dom.sheetReportTitle.textContent = reportName;
    this.dom.sheetReportDateText.textContent = reportDate;

    if (sheetUrl) {
      this.dom.openGoogleSheetLink.href = sheetUrl;
      this.dom.openGoogleSheetLink.classList.remove('hidden');
    } else {
      this.dom.openGoogleSheetLink.classList.add('hidden');
    }

    this.updateTargetDriveLabels();
    this.loadActiveReportObservations();
  }

  /* ==========================================================================
     3. FULL REPORT VIEW (The Whole Report at Once)
     ========================================================================== */

  async loadActiveReportObservations() {
    try {
      // 1. Fetch remote observation records directly from the Google Sheet tab
      let remoteObs = [];
      try {
        const res = await apiServiceInstance.getPlantReportInfo(this.activePlant, this.activeReportTabName || this.activeReportDate);
        if (res && res.found && res.observations) {
          remoteObs = res.observations;
          if (res.sheetUrl) {
            this.activeSpreadsheetUrl = res.sheetUrl;
            this.dom.openGoogleSheetLink.href = res.sheetUrl;
            this.dom.openGoogleSheetLink.classList.remove('hidden');
          }
        }
      } catch (e) {
        console.warn('Could not fetch remote sheet observations:', e);
      }

      // 2. Fetch strictly plant-isolated pending local photos
      const localPhotos = await dbInstance.getPhotosByPlant(this.activePlant);
      const dateLocalPhotos = localPhotos.filter(
        p => (p.reportDate === this.activeReportDate || p.tabName === this.activeReportTabName) && p.syncStatus === 'PENDING'
      );

      // Merge observations directly from authoritative Google Sheet
      const obsMap = new Map();

      // Seed with remote observations from Google Sheet
      for (const r of remoteObs) {
        const s = formatSerial(r.serial);
        const isRect = String(r.remarks).toLowerCase().indexOf('rectified') !== -1 && String(r.remarks).toLowerCase().indexOf('not') === -1;
        obsMap.set(s, {
          serial: s,
          rowNumber: r.rowNumber || (parseInt(s, 10) + 3),
          findings: r.findings || r.finding || `Finding #${s}`,
          recommendation: r.recommendation || 'Immediate rectification required as per electrical safety standard',
          location: r.location || 'Site',
          riskLevel: r.riskLevel || 'Priority 2',
          generalLocation: r.generalLocation || this.activePlant,
          pictorialEvidenceUrl: r.pictorialEvidenceUrl,
          responsible: r.responsible || 'Utility In-Charge',
          deadline: r.deadline || (r.riskLevel === 'Priority 1' ? '7 Days' : r.riskLevel === 'Priority 3' ? '3 Days' : '4 Days'),
          correctedPictureUrl: r.correctedPictureUrl,
          remarks: r.remarks || 'Not Rectified',
          isRectified: isRect,
          imageDataUrl: r.pictorialEvidenceUrl,
          correctedDataUrl: r.correctedPictureUrl,
          source: 'GOOGLE_SHEET'
        });
      }

      // Pass 1: Seed any pending local ORIGINAL observations strictly for this plant
      for (const p of dateLocalPhotos) {
        if (p.photoType === 'ORIGINAL') {
          const s = formatSerial(p.serial);
          const existing = obsMap.get(s) || {
            serial: s,
            rowNumber: (parseInt(s, 10) || 1) + 3,
            findings: p.findings,
            recommendation: p.recommendation || 'Immediate rectification required as per electrical safety standard',
            location: p.location,
            riskLevel: p.riskLevel || 'Priority 2',
            generalLocation: p.plant || this.activePlant,
            pictorialEvidenceUrl: p.driveLink,
            responsible: 'Utility In-Charge',
            deadline: p.riskLevel === 'Priority 1' ? '7 Days' : p.riskLevel === 'Priority 3' ? '3 Days' : '4 Days',
            correctedPictureUrl: null,
            remarks: 'Not Rectified',
            isRectified: false
          };
          existing.findings = p.findings || existing.findings;
          existing.location = p.location || existing.location;
          existing.riskLevel = p.riskLevel || existing.riskLevel;
          existing.imageDataUrl = p.imageDataUrl || existing.imageDataUrl;
          existing.driveLink = p.driveLink || existing.driveLink;
          existing.captureTimestamp = p.captureTimestamp || existing.captureTimestamp;
          obsMap.set(s, existing);
        }
      }

      // Pass 2: Attach all CORRECTED photos to their parent observations
      for (const p of dateLocalPhotos) {
        if (p.photoType === 'CORRECTED') {
          const parentS = formatSerial(p.parentSerial || p.serial);
          if (obsMap.has(parentS)) {
            const parent = obsMap.get(parentS);
            parent.correctedPictureUrl = p.driveLink || parent.correctedPictureUrl;
            parent.correctedDataUrl = p.imageDataUrl || parent.correctedDataUrl;
            parent.isRectified = true;
            parent.remarks = 'Rectified';
          } else {
            obsMap.set(parentS, {
              serial: parentS,
              findings: p.findings || 'Observation',
              recommendation: 'Immediate rectification required as per electrical safety standard',
              location: p.location || 'Site',
              riskLevel: p.riskLevel || 'Priority 2',
              generalLocation: p.plant || this.activePlant,
              pictorialEvidenceUrl: null,
              responsible: 'Utility In-Charge',
              deadline: '4 Days',
              correctedPictureUrl: p.driveLink,
              correctedDataUrl: p.imageDataUrl,
              remarks: 'Rectified',
              isRectified: true,
              imageDataUrl: null,
              source: 'LOCAL'
            });
          }
        }
      }

      this.cachedObservations = Array.from(obsMap.values()).sort((a, b) => a.serial.localeCompare(b.serial));

      if (this.dom.sheetObsCountBadge) {
        this.dom.sheetObsCountBadge.textContent = this.cachedObservations.length;
      }
      if (this.dom.galleryCountBadge) {
        this.dom.galleryCountBadge.textContent = this.cachedObservations.length;
      }

      this.updateKPICards();
      this.renderSheetTable();
      this.renderGalleryGrid();

    } catch (err) {
      console.error('Error loading active report observations:', err);
    }
  }

  updateKPICards() {
    let total = this.cachedObservations.length;
    let p1 = 0, p2 = 0, p3 = 0, rect = 0;

    for (const o of this.cachedObservations) {
      if (o.riskLevel === 'Priority 1') p1++;
      else if (o.riskLevel === 'Priority 3') p3++;
      else p2++; // Priority 2 default

      if (o.isRectified) rect++;
    }

    this.dom.kpiTotalCount.textContent = total;
    this.dom.kpiP1Count.textContent = p1;
    this.dom.kpiP2Count.textContent = p2;
    this.dom.kpiP3Count.textContent = p3;
    this.dom.kpiRectifiedCount.textContent = rect;
    this.dom.kpiPendingCount.textContent = Math.max(0, total - rect);
  }

  renderSheetTable() {
    this.dom.sheetReportTableBody.innerHTML = '';

    if (this.cachedObservations.length === 0) {
      this.dom.sheetTableEmpty.classList.remove('hidden');
      return;
    }
    this.dom.sheetTableEmpty.classList.add('hidden');

    for (const obs of this.cachedObservations) {
      const tr = document.createElement('tr');

      // Col G: Pictorial Evidence
      const imgG = obs.imageDataUrl 
        ? `<img src="${obs.imageDataUrl}" class="table-img-thumb open-photo-thumb" title="Click to view 1:1 proof">` 
        : (obs.pictorialEvidenceUrl ? `<a href="${obs.pictorialEvidenceUrl}" target="_blank" class="ms-btn-secondary btn-icon-wrap" style="font-size: 0.7rem; padding: 0.2rem 0.4rem;">${ICONS.external}<span>Drive</span></a>` : '<span style="color:var(--ms-text-muted); font-size:0.75rem;">Pending</span>');

      // Col J: Corrected Pictures
      let imgJ = '';
      if (obs.isRectified) {
        const srcJ = obs.correctedDataUrl || obs.correctedPictureUrl;
        imgJ = srcJ 
          ? `<img src="${srcJ}" class="table-img-thumb open-corr-thumb" title="Click to view corrected proof">` 
          : `<span class="status-badge rectified icon-label">${ICONS.check} <span>Rectified</span></span>`;
      } else {
        imgJ = `<span style="font-size: 0.72rem; color: var(--ms-text-secondary); font-style: italic;">Not Uploaded</span>`;
      }

      const deadline = obs.deadline || (obs.riskLevel === 'Priority 1' ? '7 Days' : obs.riskLevel === 'Priority 3' ? '3 Days' : '4 Days');
      const responsible = obs.responsible || 'Utility In-Charge';
      const genLoc = obs.generalLocation || this.activePlant;
      const isAdmin = this.currentUser && this.currentUser.role === 'ADMIN';

      tr.innerHTML = `
        <td style="font-family: var(--font-mono); font-weight: 700; text-align: center;">${obs.serial}</td>
        <td style="font-weight: 600;">${obs.findings}</td>
        <td style="font-size: 0.75rem; color: var(--ms-text-secondary);">${obs.recommendation}</td>
        <td><span class="icon-label">${ICONS.location} <span>${obs.location}</span></span></td>
        <td style="text-align: center;"><span class="role-badge" style="background:#e1dfdd; color:#201f1e;">${obs.riskLevel}</span></td>
        <td style="text-align: center; font-size: 0.8rem; font-weight: 500;">${genLoc}</td>
        <td style="text-align: center;">${imgG}</td>
        <td style="text-align: center; font-size: 0.8rem;">${responsible}</td>
        <td style="text-align: center; font-size: 0.8rem; font-weight: 600;">${deadline}</td>
        <td style="text-align: center;">${imgJ}</td>
        <td style="text-align: center;">
          <span class="status-badge ${obs.isRectified ? 'rectified' : 'not-rectified'} icon-label">
            ${obs.isRectified ? `${ICONS.check} <span>Rectified</span>` : `${ICONS.warning} <span>Not Rectified</span>`}
          </span>
        </td>
        <td style="text-align: center;">
          <div style="display: flex; gap: 0.25rem; justify-content: center; align-items: center; flex-wrap: wrap;">
            <button class="ms-btn-secondary inspect-row-btn btn-icon-wrap" style="font-size: 0.72rem; padding: 0.25rem 0.45rem;" title="View Details">
              ${ICONS.eye}
              <span>View</span>
            </button>
            ${!obs.isRectified ? `
              <button class="ms-btn-secondary rectify-table-btn btn-icon-wrap" style="font-size: 0.72rem; padding: 0.25rem 0.45rem; background: #ffb900; color: #000; font-weight: 700;" title="Rectify Finding">
                ${ICONS.rectify}
                <span>Rectify</span>
              </button>
            ` : ''}
            ${isAdmin ? `
              <button class="ms-btn-secondary edit-row-btn btn-icon-wrap" title="Edit Finding">
                ${ICONS.edit}
                <span>Edit</span>
              </button>
              <button class="ms-btn-secondary delete-row-btn btn-icon-wrap" title="Delete Row">
                ${ICONS.trash}
                <span>Delete</span>
              </button>
            ` : ''}
          </div>
        </td>
      `;

      // Event listeners
      const thumbG = tr.querySelector('.open-photo-thumb');
      if (thumbG) thumbG.addEventListener('click', () => this.openPhotoDetail(obs));

      const thumbJ = tr.querySelector('.open-corr-thumb');
      if (thumbJ) thumbJ.addEventListener('click', () => this.openPhotoDetail(obs));

      const rectBtn = tr.querySelector('.rectify-table-btn');
      if (rectBtn) rectBtn.addEventListener('click', () => this.openRectifyModal(obs));

      const editBtn = tr.querySelector('.edit-row-btn');
      if (editBtn) editBtn.addEventListener('click', () => this.openEditFindingModal(obs));

      const delBtn = tr.querySelector('.delete-row-btn');
      if (delBtn) delBtn.addEventListener('click', () => this.handleDeleteFinding(obs));

      tr.querySelector('.inspect-row-btn').addEventListener('click', () => this.openPhotoDetail(obs));

      this.dom.sheetReportTableBody.appendChild(tr);
    }
  }

  /* ==========================================================================
     4. PHOTO GALLERY VIEW (Rich Visual Grid)
     ========================================================================== */

  renderGalleryGrid() {
    this.dom.galleryGrid.innerHTML = '';

    const all = this.cachedObservations;
    const pending = all.filter(o => !o.isRectified);
    const rectified = all.filter(o => o.isRectified);

    this.dom.galleryFilterAllCount.textContent = all.length;
    this.dom.galleryFilterPendingCount.textContent = pending.length;
    this.dom.galleryFilterRectifiedCount.textContent = rectified.length;

    let displayList = all;
    if (this.activeGalleryFilter === 'PENDING') displayList = pending;
    else if (this.activeGalleryFilter === 'RECTIFIED') displayList = rectified;

    if (displayList.length === 0) {
      this.dom.galleryEmpty.classList.remove('hidden');
      return;
    }
    this.dom.galleryEmpty.classList.add('hidden');

    for (const obs of displayList) {
      const card = document.createElement('div');
      card.className = 'gallery-item';

      const imgSrc = obs.imageDataUrl || obs.pictorialEvidenceUrl || './src/image/logo.png';

      card.innerHTML = `
        <div class="gallery-thumb-wrap">
          <img src="${imgSrc}" alt="${obs.findings}" class="gallery-thumb-img">
          <span class="gallery-serial-badge">${obs.serial}</span>
          <span class="gallery-status-badge status-badge ${obs.isRectified ? 'rectified' : 'not-rectified'} icon-label">
            ${obs.isRectified ? `${ICONS.check} <span>Rectified</span>` : `${ICONS.warning} <span>Not Rectified</span>`}
          </span>
        </div>
        <div class="gallery-info-box">
          <div class="gallery-finding" title="${obs.findings}">${obs.findings}</div>
          <div class="gallery-location icon-label">${ICONS.location} <span>${obs.location}</span></div>
        </div>
      `;

      card.addEventListener('click', () => this.openPhotoDetail(obs));
      this.dom.galleryGrid.appendChild(card);
    }
  }

  openPhotoDetail(obs) {
    this.activeTargetObs = obs;
    this.dom.detailModalSerial.textContent = `Serial: ${obs.serial}`;
    this.dom.detailModalFinding.textContent = obs.findings;
    this.dom.detailModalLocation.innerHTML = `<span class="icon-label">${ICONS.location} <span>${obs.location}</span></span>`;
    this.dom.detailModalRiskLevel.textContent = obs.riskLevel;
    this.dom.detailModalTime.textContent = obs.captureTimestamp || this.activeReportDate;

    this.dom.detailModalStatusBadge.innerHTML = obs.isRectified 
      ? `${ICONS.check} <span>Rectified</span>` 
      : `${ICONS.warning} <span>Not Rectified</span>`;
    this.dom.detailModalStatusBadge.className = obs.isRectified ? 'status-badge rectified icon-label' : 'status-badge not-rectified icon-label';

    this.dom.detailModalImg.src = obs.imageDataUrl || obs.pictorialEvidenceUrl || '';
    this.dom.detailModalDownloadLink.href = obs.imageDataUrl || '#';
    this.dom.detailModalDownloadLink.download = `${obs.serial}_${this.activePlant}_Evidence.jpg`;

    if (obs.isRectified) {
      this.dom.detailRectifiedSection.classList.remove('hidden');
      this.dom.detailModalCorrImg.src = obs.correctedDataUrl || obs.correctedPictureUrl || '';
      this.dom.detailModalRectifyBtn.classList.add('hidden');
    } else {
      this.dom.detailRectifiedSection.classList.add('hidden');
      this.dom.detailModalRectifyBtn.classList.remove('hidden');
    }

    this.dom.photoDetailModal.classList.remove('hidden');
  }

  /* ==========================================================================
     5. RECTIFICATION POP-UP WORKFLOW (Column J in Sheet)
     ========================================================================== */

  openRectifyModal(obs) {
    this.activeTargetObs = obs;
    this.dom.photoDetailModal.classList.add('hidden');

    this.dom.rectifyModalTitle.innerHTML = `<span class="icon-label">${ICONS.rectify} <span>Rectify Observation: ${obs.serial}</span></span>`;
    this.dom.rectifyRefThumb.src = obs.imageDataUrl || obs.pictorialEvidenceUrl || '';
    if (this.dom.rectifyRefSerialBadge) {
      this.dom.rectifyRefSerialBadge.textContent = `Finding #${obs.serial}`;
    }
    if (this.dom.rectifyRefRiskBadge) {
      const risk = obs.riskLevel || 'Priority 2';
      this.dom.rectifyRefRiskBadge.textContent = risk;
      this.dom.rectifyRefRiskBadge.className = `risk-badge ${risk === 'Priority 1' ? 'risk-high' : risk === 'Priority 3' ? 'risk-low' : 'risk-med'}`;
    }
    this.dom.rectifyRefFinding.textContent = obs.findings;
    this.dom.rectifyRefLocation.innerHTML = `<span class="icon-label">${ICONS.location} <span>${obs.location}</span></span>`;

    // Reset capture / preview UI states
    this.clearRectifySourcePreview();
    if (this.dom.rectifyRemarksInput) {
      this.dom.rectifyRemarksInput.value = 'Rectified as per electrical safety standard';
    }

    this.dom.rectifyModal.classList.remove('hidden');
  }

  async startRectifyCamera() {
    try {
      if (this.rectifyStream) {
        this.rectifyStream.getTracks().forEach(t => t.stop());
      }
      const constraints = {
        video: { facingMode: this.facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      };
      this.rectifyStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.dom.rectifyCameraVideo.srcObject = this.rectifyStream;
    } catch (err) {
      console.warn('Rectify camera stream unavailable, using upload fallback:', err);
      this.showToast('Webcam stream unavailable. Please use Phone Camera or Files.');
    }
  }

  takeRectifyLivePhoto() {
    if (!this.rectifyStream || !this.dom.rectifyCameraVideo.videoWidth) {
      this.showToast('Camera feed not ready.');
      return;
    }

    this.dom.rectifyCameraViewport.style.filter = 'brightness(2.5)';
    setTimeout(() => { this.dom.rectifyCameraViewport.style.filter = ''; }, 100);

    const video = this.dom.rectifyCameraVideo;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    this.currentRectifySource = canvas;
    this.dom.rectifyPreviewImg.src = canvas.toDataURL('image/jpeg', 0.95);
    if (this.dom.rectifyPreviewContainer) this.dom.rectifyPreviewContainer.classList.remove('hidden');
    if (this.dom.rectifyCapturePrompt) this.dom.rectifyCapturePrompt.classList.add('hidden');
    if (this.dom.rectifyWebcamContainer) {
      this.dom.rectifyWebcamContainer.classList.add('hidden');
      if (this.rectifyStream) {
        this.rectifyStream.getTracks().forEach(t => t.stop());
        this.rectifyStream = null;
      }
    }
    this.showToast('Corrected photo snapped.');
  }

  handleRectifyFileInput(file) {
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      this.currentRectifySource = img;
      this.dom.rectifyPreviewImg.src = img.src;
      if (this.dom.rectifyPreviewContainer) this.dom.rectifyPreviewContainer.classList.remove('hidden');
      if (this.dom.rectifyCapturePrompt) this.dom.rectifyCapturePrompt.classList.add('hidden');
      if (this.dom.rectifyWebcamContainer) {
        this.dom.rectifyWebcamContainer.classList.add('hidden');
        if (this.rectifyStream) {
          this.rectifyStream.getTracks().forEach(t => t.stop());
          this.rectifyStream = null;
        }
      }
      this.showToast('Corrected photo ready.');
    };
    img.src = URL.createObjectURL(file);
  }

  clearRectifySourcePreview() {
    this.currentRectifySource = null;
    if (this.dom.rectifyPreviewImg) {
      this.dom.rectifyPreviewImg.src = '';
    }
    if (this.dom.rectifyPreviewContainer) {
      this.dom.rectifyPreviewContainer.classList.add('hidden');
    }
    if (this.dom.rectifyCapturePrompt) {
      this.dom.rectifyCapturePrompt.classList.remove('hidden');
    }
    if (this.dom.rectifyWebcamContainer) {
      this.dom.rectifyWebcamContainer.classList.add('hidden');
    }
    if (this.rectifyStream) {
      this.rectifyStream.getTracks().forEach(t => t.stop());
      this.rectifyStream = null;
    }
  }

  async submitRectification() {
    if (!this.activeTargetObs) {
      this.showToast('No observation selected for rectification.');
      return;
    }

    const obs = this.activeTargetObs;
    let sourceElement = this.currentRectifySource;

    if (!sourceElement) {
      if (this.rectifyStream && this.dom.rectifyCameraVideo.videoWidth) {
        sourceElement = this.dom.rectifyCameraVideo;
      } else {
        this.showToast('Please snap a corrected photo or choose an image file first.');
        return;
      }
    }

    try {
      this.dom.submitRectificationBtn.disabled = true;
      this.dom.submitRectificationBtn.innerHTML = `<span class="icon-label">${ICONS.refresh} <span>Processing 1:1 Correction...</span></span>`;

      const captureTimestamp = new Date();

      // Create Canonical Corrected Record
      const record = createPhotoRecord({
        plant: this.activePlant,
        serial: obs.serial,
        parentSerial: obs.serial,
        findings: obs.findings,
        location: obs.location,
        captureTimestamp,
        photoType: 'CORRECTED',
        correctionSequence: '01'
      });

      record.plant = this.activePlant;
      record.reportDate = this.activeReportTabName || this.activeReportDate;
      record.riskLevel = obs.riskLevel;

      // 1:1 Canvas center crop + bottom white strip with CORRECTED 01 tag
      const composition = await CanvasEngine.processEvidencePhoto({
        source: sourceElement,
        metadata: record,
        targetPhotoDim: 1200
      });

      record.imageBlob = composition.blob;
      record.imageDataUrl = composition.dataUrl;
      record.fileSizeBytes = composition.fileSizeBytes;

      // 1. Save to local IndexedDB
      await dbInstance.savePhoto(record);

      // 2. Queue RECTIFY_FINDING operation for offline resilience
      try {
        await dbInstance.addQueueOperation({
          operationId: `RECT_${this.activePlant}_${this.activeReportDate}_${obs.serial}_${Date.now()}`,
          operationType: 'RECTIFY_FINDING',
          plant: this.activePlant,
          reportDate: this.activeReportDate,
          recordId: record.id,
          payload: {
            serial: obs.serial,
            remarks: (this.dom.rectifyRemarksInput.value || 'Rectified as per electrical safety standard').trim(),
            base64Data: composition.dataUrl,
            filename: record.filename,
            plant: this.activePlant,
            reportDate: this.activeReportDate
          }
        });
      } catch (qErr) {
        console.warn('Queue operation add error:', qErr);
      }

      // 3. Update local memory observation
      obs.isRectified = true;
      obs.remarks = 'Rectified';
      obs.correctedDataUrl = composition.dataUrl;

      // 4. Queue / trigger sync to Column J in Google Sheet
      if (syncEngineInstance.effectiveOnline) {
        syncEngineInstance.processQueue();
      }

      this.showToast(`Rectification saved for Serial ${obs.serial}! Syncing to Column J.`);

      // 5. Close modal & refresh views
      this.dom.rectifyModal.classList.add('hidden');
      this.clearRectifySourcePreview();
      this.updateKPICards();
      this.renderSheetTable();
      this.renderGalleryGrid();
      this.loadPlantReportsHub();
      this.updateSyncQueueStatus();

    } catch (err) {
      console.error('Rectification failed:', err);
      this.showToast(`Error: ${err.message}`);
    } finally {
      this.dom.submitRectificationBtn.disabled = false;
      this.dom.submitRectificationBtn.innerHTML = `${ICONS.check}<span>Submit Correction (Save to Sheet Col J)</span>`;
    }
  }

  /* ==========================================================================
     5b. ADMIN FINDINGS & REPORT MANAGEMENT (Edit, Delete Finding, Delete Report)
     ========================================================================== */

  openEditFindingModal(obs) {
    if (!this.currentUser || this.currentUser.role !== 'ADMIN') {
      this.showToast('Permission denied: Only ADMIN can edit findings.');
      return;
    }
    if (!obs) return;

    this.dom.editFindingRowNumber.value = obs.rowNumber || (parseInt(obs.serial, 10) + 3);
    this.dom.editFindingSerial.value = obs.serial;
    this.dom.editFindingModalTitle.textContent = `Edit Finding #${obs.serial} (${this.activePlant} - ${this.activeReportDate})`;
    this.dom.editFindingInput.value = obs.findings || obs.finding || '';
    this.dom.editLocationInput.value = obs.location || '';
    this.dom.editRecommendationInput.value = obs.recommendation || '';
    this.dom.editRiskLevelSelect.value = obs.riskLevel || 'Priority 2';

    this.dom.editFindingModal.classList.remove('hidden');
  }

  closeEditFindingModal() {
    this.dom.editFindingModal.classList.add('hidden');
  }

  async handleSaveEditFinding() {
    if (!this.currentUser || this.currentUser.role !== 'ADMIN') {
      this.showToast('Permission denied: Only ADMIN can edit findings.');
      return;
    }

    const rowNumber = parseInt(this.dom.editFindingRowNumber.value, 10);
    const serial = this.dom.editFindingSerial.value;
    const finding = (this.dom.editFindingInput.value || '').trim();
    const location = (this.dom.editLocationInput.value || '').trim();
    const recommendation = (this.dom.editRecommendationInput.value || '').trim();
    const riskLevel = this.dom.editRiskLevelSelect.value || 'Priority 2';

    if (!finding) {
      this.showToast('Please enter Finding / Observation.');
      this.dom.editFindingInput.focus();
      return;
    }
    if (!location) {
      this.showToast('Please enter Location / Facility.');
      this.dom.editLocationInput.focus();
      return;
    }

    try {
      this.dom.saveEditFindingBtn.disabled = true;
      this.dom.saveEditFindingBtn.innerHTML = `<span class="icon-label">${ICONS.refresh} <span>Saving to Sheet...</span></span>`;

      await apiServiceInstance.updateFinding(this.activePlant, this.activeReportTabName || this.activeReportDate, rowNumber, {
        finding,
        recommendation,
        location,
        riskLevel
      });

      this.showToast(`Finding #${serial} updated in Google Sheet.`);
      this.closeEditFindingModal();
      await this.loadActiveReportObservations();
    } catch (err) {
      console.error('Failed to update finding:', err);
      this.showToast(`Error updating finding: ${err.message}`);
    } finally {
      this.dom.saveEditFindingBtn.disabled = false;
      this.dom.saveEditFindingBtn.innerHTML = `<svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg><span>Save Changes to Sheet</span>`;
    }
  }

  async handleDeleteFinding(obs) {
    if (!this.currentUser || this.currentUser.role !== 'ADMIN') {
      this.showToast('Permission denied: Only ADMIN can delete findings.');
      return;
    }

    const desc = obs.findings || obs.finding || `Finding #${obs.serial}`;
    const confirmed = window.confirm(`Are you sure you want to delete finding #${obs.serial}: "${desc}"?\n\nThis will remove the row from the ${this.activePlant} spreadsheet (${this.activeReportDate}).`);
    if (!confirmed) return;

    try {
      this.showToast(`Deleting finding #${obs.serial}...`);
      const rowNumber = obs.rowNumber || (parseInt(obs.serial, 10) + 3);
      await apiServiceInstance.deleteFinding(this.activePlant, this.activeReportTabName || this.activeReportDate, rowNumber);

      // Also clean up local photos if any
      const allPhotos = await dbInstance.getAllPhotos();
      for (const p of allPhotos) {
        if (p.plant === this.activePlant && (p.reportDate === this.activeReportDate || p.tabName === this.activeReportTabName) && formatSerial(p.serial) === obs.serial) {
          await dbInstance.deletePhoto(p.id);
        }
      }

      this.showToast(`Finding #${obs.serial} deleted successfully.`);
      await this.loadActiveReportObservations();
    } catch (err) {
      console.error('Failed to delete finding:', err);
      this.showToast(`Error deleting finding: ${err.message}`);
    }
  }

  async handleDeleteReport() {
    if (!this.currentUser || this.currentUser.role !== 'ADMIN') {
      this.showToast('Permission denied: Only ADMIN can delete entire reports.');
      return;
    }

    const confirmed = window.confirm(`WARNING: Are you sure you want to permanently delete the entire report for ${this.activePlant} on date ${this.activeReportDate}?\n\nThis will remove the date tab from the Google Sheet.`);
    if (!confirmed) return;

    try {
      this.showToast(`Deleting report tab ${this.activeReportDate} from ${this.activePlant}...`);
      await apiServiceInstance.deletePlantReport(this.activePlant, this.activeReportTabName || this.activeReportDate);
      this.showToast(`Report ${this.activeReportDate} deleted.`);

      // Switch to Reports Hub and refresh
      this.switchTab('reports');
      await this.loadPlantReportsHub();
    } catch (err) {
      console.error('Failed to delete report:', err);
      this.showToast(`Error deleting report: ${err.message}`);
    }
  }

  /* ==========================================================================
     6. CAPTURE NEW FINDING (Column G Pictorial Evidence)
     ========================================================================== */

  async refreshSerial() {
    const nextSerial = await dbInstance.peekNextSerial();
    this.dom.currentSerialDisplay.textContent = nextSerial;
    this.updateDesktopPreview();
  }

  updateDesktopPreview() {
    if (!this.dom.desktopLiveFilename) return;
    const serial = this.dom.currentSerialDisplay.textContent || '001';
    const findings = (this.dom.findingInput.value || 'Observation').trim();
    const location = (this.dom.locationInput.value || 'Site').trim();
    const tempRecord = createPhotoRecord({
      serial,
      findings,
      location,
      captureTimestamp: new Date(),
      photoType: 'ORIGINAL'
    });
    this.dom.desktopLiveFilename.textContent = `Filename: ${tempRecord.filename}`;
  }

  async startCamera() {
    try {
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(t => t.stop());
      }
      const constraints = {
        video: { facingMode: this.facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      };
      this.mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      this.dom.cameraVideo.srcObject = this.mediaStream;
      if (this.dom.cameraPlaceholder) this.dom.cameraPlaceholder.classList.add('hidden');
      this.dom.cameraVideo.classList.remove('hidden');
    } catch (err) {
      console.warn('Camera stream unavailable, switching to phone upload fallback:', err);
      if (this.dom.cameraPlaceholder) this.dom.cameraPlaceholder.classList.remove('hidden');
      this.dom.cameraVideo.classList.add('hidden');
    }
  }

  takeLivePhoto() {
    if (!this.mediaStream || !this.dom.cameraVideo.videoWidth) {
      this.showToast('Camera feed not ready.');
      return;
    }
    this.dom.cameraViewport.style.filter = 'brightness(2.5)';
    setTimeout(() => { this.dom.cameraViewport.style.filter = ''; }, 100);

    const video = this.dom.cameraVideo;
    const snapCanvas = document.createElement('canvas');
    snapCanvas.width = video.videoWidth;
    snapCanvas.height = video.videoHeight;
    const ctx = snapCanvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    this.currentRawSource = snapCanvas;
    this.dom.activePhotoPreviewImg.src = snapCanvas.toDataURL('image/jpeg', 0.95);
    this.dom.activePhotoPreviewImg.classList.remove('hidden');
    if (this.dom.capturePromptBox) this.dom.capturePromptBox.classList.add('hidden');
    if (this.dom.capturePreviewContainer) this.dom.capturePreviewContainer.classList.remove('hidden');
    if (this.dom.cameraViewport) this.dom.cameraViewport.classList.add('hidden');
    if (this.dom.webcamControlsBar) this.dom.webcamControlsBar.classList.add('hidden');
    this.showToast('Photo captured.');
  }

  handleFileInput(file, label = 'Photo') {
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      this.currentRawSource = img;
      this.dom.activePhotoPreviewImg.src = img.src;
      this.dom.activePhotoPreviewImg.classList.remove('hidden');
      if (this.dom.capturePromptBox) this.dom.capturePromptBox.classList.add('hidden');
      if (this.dom.capturePreviewContainer) this.dom.capturePreviewContainer.classList.remove('hidden');
      if (this.dom.cameraViewport) this.dom.cameraViewport.classList.add('hidden');
      if (this.dom.webcamControlsBar) this.dom.webcamControlsBar.classList.add('hidden');
      this.showToast(`${label} ready.`);
    };
    img.src = URL.createObjectURL(file);
  }

  clearRawSourcePreview() {
    this.currentRawSource = null;
    if (this.dom.activePhotoPreviewImg) {
      this.dom.activePhotoPreviewImg.classList.add('hidden');
      this.dom.activePhotoPreviewImg.src = '';
    }
    if (this.dom.capturePromptBox) this.dom.capturePromptBox.classList.remove('hidden');
    if (this.dom.capturePreviewContainer) this.dom.capturePreviewContainer.classList.add('hidden');
  }

  async handleNewObservationSubmit() {
    const findings = (this.dom.findingInput.value || '').trim();
    const location = (this.dom.locationInput.value || '').trim();
    const recommendation = 'Immediate rectification required as per electrical safety standard';
    const riskLevel = 'Priority 2';

    if (!findings) {
      this.showToast('Please enter Finding / Observation.');
      this.dom.findingInput.focus();
      return;
    }
    if (!location) {
      this.showToast('Please enter Location / Facility.');
      this.dom.locationInput.focus();
      return;
    }

    let sourceElement = this.currentRawSource;
    if (!sourceElement) {
      if (this.mediaStream && this.dom.cameraVideo.videoWidth) {
        sourceElement = this.dom.cameraVideo;
      } else {
        this.showToast('Please snap a photo or choose an image file first.');
        return;
      }
    }

    try {
      this.dom.submitEvidenceBtn.disabled = true;
      this.dom.submitEvidenceBtn.innerHTML = `<span class="icon-label">${ICONS.refresh} <span>Processing 1:1 Image...</span></span>`;

      const allocatedSerial = this.dom.currentSerialDisplay.textContent;
      const captureTimestamp = new Date();

      const record = createPhotoRecord({
        plant: this.activePlant,
        serial: allocatedSerial,
        findings,
        location,
        captureTimestamp,
        photoType: 'ORIGINAL'
      });

      record.plant = this.activePlant;
      record.reportDate = this.activeReportTabName || this.activeReportDate;
      record.recommendation = recommendation;
      record.riskLevel = riskLevel;

      const composition = await CanvasEngine.processEvidencePhoto({
        source: sourceElement,
        metadata: record,
        targetPhotoDim: 1200
      });

      record.imageBlob = composition.blob;
      record.imageDataUrl = composition.dataUrl;
      record.fileSizeBytes = composition.fileSizeBytes;

      this.clearRawSourcePreview();

      // Allocate next serial in DB & save
      await dbInstance.allocateNextSerial();
      await dbInstance.savePhoto(record);

      // Add to offline queue for structured sync
      try {
        await dbInstance.addQueueOperation({
          operationId: `FIND_${this.activePlant}_${this.activeReportDate}_${allocatedSerial}_${Date.now()}`,
          operationType: 'UPLOAD_ORIGINAL',
          plant: this.activePlant,
          reportDate: this.activeReportDate,
          recordId: record.id,
          payload: {
            serial: allocatedSerial,
            findings,
            location,
            recommendation,
            riskLevel,
            captureTimestamp: captureTimestamp.toISOString(),
            filename: record.filename,
            base64Data: composition.dataUrl,
            plant: this.activePlant,
            reportDate: this.activeReportDate
          }
        });
      } catch (qErr) {
        console.warn('Queue operation add error:', qErr);
      }

      this.dom.dualSaveNotice.classList.remove('hidden');
      this.dom.dualSaveNoticeText.textContent = `Evidence ${record.displaySerial} saved & syncing to Column G.`;

      this.showToast(`Saved: ${record.filename}`);

      if (syncEngineInstance.effectiveOnline) {
        syncEngineInstance.processQueue();
      }

      await this.refreshSerial();
      await this.loadActiveReportObservations();

      this.dom.findingInput.value = '';
      this.dom.locationInput.value = '';

      // Switch to sheet tab so user can see their new finding in the report!
      this.switchTab('sheet');
      this.updateSyncQueueStatus();

    } catch (err) {
      console.error('Submit failed:', err);
      this.showToast(`Error: ${err.message}`);
    } finally {
      this.dom.submitEvidenceBtn.disabled = false;
      this.dom.submitEvidenceBtn.innerHTML = `
        <svg class="svg-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
        <span>Submit (Save & Sync to Pictorial Evidence)</span>
      `;
    }
  }

  /* ==========================================================================
     7. GENERAL NAVIGATION & HELPERS
     ========================================================================== */

  switchTab(tabKey) {
    this.dom.tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabKey));
    this.dom.tabPanes.forEach(p => p.classList.toggle('active', p.id === `${tabKey}Tab`));

    if (tabKey !== 'capture') {
      this.stopCaptureCamera();
    }

    if (tabKey === 'reports') {
      this.loadPlantReportsHub();
    } else if (tabKey === 'sheet' || tabKey === 'gallery') {
      this.loadActiveReportObservations();
    } else if (tabKey === 'drive') {
      this.renderCloudFiles();
      this.renderStorageDirectory();
      this.updateSyncQueueStatus();
    }
  }

  stopCaptureCamera() {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
  }

  stopAllCameras() {
    this.stopCaptureCamera();
    if (this.rectifyStream) {
      this.rectifyStream.getTracks().forEach(t => t.stop());
      this.rectifyStream = null;
    }
  }

  updateTargetDriveLabels() {
    this.dom.syncTargetDrivePath.textContent = `/CAP Photos/${this.activePlant}/${this.activeReportDate}/`;
    this.dom.syncTargetSheetName.textContent = `${this.activePlant} Workbook / ${this.activeReportDate} Tab`;
  }

  async updateSyncQueueStatus() {
    try {
      const status = await syncEngineInstance.getQueueStatus();
      if (this.dom.syncPendingCount) {
        this.dom.syncPendingCount.textContent = status.pendingOperations;
      }
      if (this.dom.syncAttentionCount) {
        this.dom.syncAttentionCount.textContent = status.needsAttention;
      }
      if (this.dom.syncPendingPhotosCount) {
        this.dom.syncPendingPhotosCount.textContent = status.pendingPhotos;
      }
    } catch (e) {
      console.warn('Could not update sync queue status:', e);
    }
  }

  async renderCloudFiles() {
    const all = await dbInstance.getAllPhotos();
    const plantPhotos = all.filter(p => !p.plant || p.plant === this.activePlant);
    this.dom.cloudFilesList.innerHTML = '';

    const synced = plantPhotos.filter(p => p.syncStatus === 'SYNCED');
    if (synced.length === 0) {
      this.dom.cloudFilesList.innerHTML = `
        <div style="text-align: center; color: var(--ms-text-secondary); padding: 1.5rem; font-size: 0.85rem;">
          No photos synced to Google Drive yet for ${this.activePlant}.
        </div>
      `;
      return;
    }

    for (const p of synced) {
      const item = document.createElement('div');
      item.style.cssText = 'border: 1px solid var(--ms-border-subtle); padding: 0.6rem; border-radius: 2px; display: flex; justify-content: space-between; align-items: center; background: #faf9f8;';
      item.innerHTML = `
        <div style="overflow: hidden;">
          <div style="font-family: var(--font-mono); font-size: 0.75rem; font-weight: 600; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${p.filename}</div>
          <div style="font-size: 0.7rem; color: var(--ms-text-secondary);">Type: ${p.photoType} • Date: ${p.reportDate} • Synced</div>
        </div>
        <div style="display: flex; gap: 0.3rem;">
          ${p.driveLink ? `<a href="${p.driveLink}" target="_blank" class="ms-btn-secondary btn-icon-wrap" style="font-size: 0.7rem; padding: 0.3rem 0.5rem; color: var(--epic-navy); font-weight: 700;">${ICONS.external}<span>Drive</span></a>` : ''}
          <a href="${p.imageDataUrl}" download="${p.filename}" class="ms-btn-secondary btn-icon-wrap" style="font-size: 0.7rem; padding: 0.3rem 0.5rem;">${ICONS.download}<span>Download</span></a>
        </div>
      `;
      this.dom.cloudFilesList.appendChild(item);
    }
  }

  /* ==========================================================================
     CLOUD STORAGE DIRECTORY & HUB
     ========================================================================== */

  async renderStorageDirectory(targetContainer = null) {
    const containers = targetContainer 
      ? [targetContainer] 
      : [this.dom.storageDirectoryContainer, this.dom.modalStorageDirectoryContainer].filter(Boolean);

    if (!containers.length) return;

    containers.forEach(c => {
      c.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 1.25rem; color: var(--ms-text-secondary);" class="icon-label">
          ${ICONS.refresh}
          <span>Loading verified cloud storage locations...</span>
        </div>
      `;
    });

    try {
      const data = await apiServiceInstance.getStorageLocations();
      const isAdmin = (this.currentUser && this.currentUser.role === 'ADMIN') || data.role === 'ADMIN';

      if (this.dom.storageScopeBadge) {
        this.dom.storageScopeBadge.textContent = isAdmin 
          ? 'ADMIN (Global Access - All Plants)' 
          : `${(this.currentUser && this.currentUser.plant) || this.activePlant} (Plant Scoped)`;
        this.dom.storageScopeBadge.className = isAdmin ? 'badge badge-info' : 'badge badge-warning';
      }

      let html = '';

      if (isAdmin) {
        // 1. Central CAP Root Drive Card
        const rootDrive = data.rootDrive || data.rootDriveFolder;
        if (rootDrive) {
          html += `
            <div class="storage-card storage-card-root">
              <div class="storage-card-header">
                <div>
                  <h4 class="storage-card-title">${ICONS.folder}<span>Central Root Drive</span></h4>
                  <div style="font-size: 0.7rem; color: var(--ms-text-secondary); margin-top: 0.1rem;">Parent folder for all Plant CAP photo directories</div>
                </div>
                <span class="storage-card-badge badge-root">Root Drive</span>
              </div>
              <div class="storage-card-body">
                <div class="storage-meta-row">
                  <span class="storage-meta-label">Folder ID:</span>
                  <span class="storage-meta-id" title="${rootDrive.id}">${rootDrive.id}</span>
                </div>
                <div class="storage-public-note">${ICONS.check}<span>Public View (Anyone with link)</span></div>
              </div>
              <div class="storage-card-actions">
                <a href="${rootDrive.url}" target="_blank" rel="noopener noreferrer" class="storage-link-btn btn-drive">
                  ${ICONS.external}<span>Open Root Drive</span>
                </a>
                <button class="storage-copy-btn copy-storage-url" data-url="${rootDrive.url}" title="Copy Drive Folder URL">
                  ${ICONS.copy}<span>Copy</span>
                </button>
              </div>
            </div>
          `;
        }

        // 2. Master Config & Users Spreadsheet Card
        if (data.masterSpreadsheet) {
          html += `
            <div class="storage-card storage-card-master">
              <div class="storage-card-header">
                <div>
                  <h4 class="storage-card-title">${ICONS.table}<span>Master Spreadsheet</span></h4>
                  <div style="font-size: 0.7rem; color: var(--ms-text-secondary); margin-top: 0.1rem;">Users, Logs & Global System Config</div>
                </div>
                <span class="storage-card-badge badge-master">Admin Master</span>
              </div>
              <div class="storage-card-body">
                <div class="storage-meta-row">
                  <span class="storage-meta-label">Sheet ID:</span>
                  <span class="storage-meta-id" title="${data.masterSpreadsheet.id}">${data.masterSpreadsheet.id}</span>
                </div>
                <div class="storage-public-note">${ICONS.check}<span>Public View (Anyone with link)</span></div>
              </div>
              <div class="storage-card-actions">
                <a href="${data.masterSpreadsheet.url}" target="_blank" rel="noopener noreferrer" class="storage-link-btn btn-sheet">
                  ${ICONS.external}<span>Open Master Sheet</span>
                </a>
                <button class="storage-copy-btn copy-storage-url" data-url="${data.masterSpreadsheet.url}" title="Copy Spreadsheet URL">
                  ${ICONS.copy}<span>Copy</span>
                </button>
              </div>
            </div>
          `;
        }

        // 3. Plant Workbooks & Dedicated Drive Folders
        const plants = data.plants || {};
        const plantKeys = ['CIPL', 'PGCL', 'GTL', 'EGMCL 2'];

        plantKeys.forEach(pk => {
          const pData = plants[pk] || {};
          const driveUrl = pData.driveFolderUrl || (pData.driveFolderId ? `https://drive.google.com/drive/folders/${pData.driveFolderId}` : '#');
          const sheetUrl = pData.spreadsheetUrl || (pData.spreadsheetId ? `https://docs.google.com/spreadsheets/d/${pData.spreadsheetId}/edit` : '#');
          const isCurrentActive = pk === this.activePlant;

          html += `
            <div class="storage-card storage-card-plant" style="${isCurrentActive ? 'border-color: #2563eb; background: #f0f7ff;' : ''}">
              <div class="storage-card-header">
                <div>
                  <h4 class="storage-card-title">
                    ${ICONS.factory}
                    <span>${pk} Storage</span>
                    ${isCurrentActive ? '<span style="font-size: 0.65rem; color: #2563eb; font-weight: 700;">(Selected)</span>' : ''}
                  </h4>
                  <div style="font-size: 0.7rem; color: var(--ms-text-secondary); margin-top: 0.1rem;">Dedicated Workbook & Drive Folder</div>
                </div>
                <span class="storage-card-badge badge-plant">${pk}</span>
              </div>
              <div class="storage-card-body">
                <div class="storage-meta-row">
                  <span class="storage-meta-label">Drive Folder:</span>
                  <span class="storage-meta-id" title="${pData.driveFolderId || ''}">${pData.driveFolderId || 'Configured'}</span>
                </div>
                <div class="storage-meta-row">
                  <span class="storage-meta-label">Workbook:</span>
                  <span class="storage-meta-id" title="${pData.spreadsheetId || ''}">${pData.spreadsheetId || 'Configured'}</span>
                </div>
                <div class="storage-public-note">${ICONS.check}<span>Public View (Anyone with link)</span></div>
              </div>
              <div class="storage-card-actions">
                <a href="${driveUrl}" target="_blank" rel="noopener noreferrer" class="storage-link-btn btn-drive" title="Open ${pk} Google Drive Folder in new tab">
                  ${ICONS.external}<span>Open Drive</span>
                </a>
                <a href="${sheetUrl}" target="_blank" rel="noopener noreferrer" class="storage-link-btn btn-sheet" title="Open ${pk} Google Spreadsheet in new tab">
                  ${ICONS.external}<span>Open Sheet</span>
                </a>
                <button class="storage-copy-btn copy-storage-url" data-url="${driveUrl}" title="Copy ${pk} Drive Folder URL">
                  ${ICONS.copy}
                </button>
              </div>
            </div>
          `;
        });
      } else {
        // PLANT USER: Strictly isolate! Cannot see any other plants, cannot see root drive or master sheets.
        const userPlant = (this.currentUser && this.currentUser.plant) || this.activePlant || 'CIPL';
        const pData = data.plant || (data.plants && data.plants[userPlant]) || {};
        const driveUrl = pData.driveFolderUrl || (pData.driveFolderId ? `https://drive.google.com/drive/folders/${pData.driveFolderId}` : '#');
        const sheetUrl = pData.spreadsheetUrl || (pData.spreadsheetId ? `https://docs.google.com/spreadsheets/d/${pData.spreadsheetId}/edit` : '#');

        html += `
          <div class="storage-isolation-alert">
            <svg class="svg-icon svg-icon-sm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #2563eb; flex-shrink: 0;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            <div>
              <strong>Plant Storage Scoped to ${userPlant}</strong>
              <div style="font-size: 0.72rem; margin-top: 0.2rem; opacity: 0.9;">
                You are signed in as plant inspector for <strong>${userPlant}</strong>. Data from other plants and master administration drives is strictly isolated per enterprise security.
              </div>
            </div>
          </div>

          <div class="storage-card storage-card-plant" style="grid-column: 1 / -1; max-width: 500px; margin: 0 auto; width: 100%;">
            <div class="storage-card-header">
              <div>
                <h4 class="storage-card-title">${ICONS.factory}<span>${userPlant} Official Cloud Storage</span></h4>
                <div style="font-size: 0.7rem; color: var(--ms-text-secondary); margin-top: 0.1rem;">Dedicated Drive Folder & Inspection Sheet</div>
              </div>
              <span class="storage-card-badge badge-plant">${userPlant}</span>
            </div>
            <div class="storage-card-body">
              <div class="storage-meta-row">
                <span class="storage-meta-label">Drive Folder:</span>
                <span class="storage-meta-id" title="${pData.driveFolderId || ''}">${pData.driveFolderId || 'Configured'}</span>
              </div>
              <div class="storage-meta-row">
                <span class="storage-meta-label">Spreadsheet:</span>
                <span class="storage-meta-id" title="${pData.spreadsheetId || ''}">${pData.spreadsheetId || 'Configured'}</span>
              </div>
              <div class="storage-public-note">${ICONS.check}<span>Public View (Anyone with link)</span></div>
            </div>
            <div class="storage-card-actions">
              <a href="${driveUrl}" target="_blank" rel="noopener noreferrer" class="storage-link-btn btn-drive">
                ${ICONS.external}<span>Open ${userPlant} Drive</span>
              </a>
              <a href="${sheetUrl}" target="_blank" rel="noopener noreferrer" class="storage-link-btn btn-sheet">
                ${ICONS.external}<span>Open ${userPlant} Sheet</span>
              </a>
              <button class="storage-copy-btn copy-storage-url" data-url="${driveUrl}" title="Copy Drive URL">
                ${ICONS.copy}<span>Copy</span>
              </button>
            </div>
          </div>
        `;
      }

      containers.forEach(c => {
        c.innerHTML = html;

        c.querySelectorAll('.copy-storage-url').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const url = btn.dataset.url;
            if (url && url !== '#') {
              navigator.clipboard.writeText(url).then(() => {
                this.showToast('Storage link copied to clipboard!');
              }).catch(() => {
                prompt('Copy URL:', url);
              });
            }
          });
        });
      });

    } catch (err) {
      console.error('Failed to render storage directory:', err);
      containers.forEach(c => {
        c.innerHTML = `
          <div style="grid-column: 1/-1; padding: 1rem; color: var(--ms-danger); font-size: 0.8rem; text-align: center;">
            Could not load storage directory: ${err.message}
          </div>
        `;
      });
    }
  }

  openStorageModal() {
    if (this.dom.storageDirectoryModal) {
      this.dom.storageDirectoryModal.classList.remove('hidden');
      this.renderStorageDirectory(this.dom.modalStorageDirectoryContainer);
    }
  }

  closeStorageModal() {
    if (this.dom.storageDirectoryModal) {
      this.dom.storageDirectoryModal.classList.add('hidden');
    }
  }

  setupSyncSubscription() {
    const updateQueue = () => this.updateSyncQueueStatus();

    syncEngineInstance.subscribe((event, data) => {
      if (event === 'network_change') {
        const isOnline = syncEngineInstance.effectiveOnline;
        this.dom.networkStatusText.textContent = isOnline ? 'Online' : 'Offline';
        this.showToast(isOnline ? 'Online. Cloud sync active.' : 'Offline mode.');
        updateQueue();
      } else if (event === 'sync_complete') {
        this.loadActiveReportObservations();
        updateQueue();
        if (data.count > 0) {
          this.showToast(`Synced ${data.count} items to Google Drive & Sheets.`);
        }
      } else if (event === 'sync_start' || event === 'sync_progress' || event === 'sync_error') {
        updateQueue();
      }
    });

    this.dom.networkToggleBtn.addEventListener('click', () => {
      const isSim = syncEngineInstance.toggleSimulatedOffline();
      this.showToast(`Offline mode: ${isSim ? 'ON' : 'OFF'}`);
      updateQueue();
    });

    this.dom.syncNowBtn.addEventListener('click', () => {
      syncEngineInstance.processQueue();
      updateQueue();
    });

    updateQueue();
  }

  setupEventListeners() {
    // Auth Form
    this.dom.loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleLogin(this.dom.usernameInput.value, this.dom.passwordInput.value);
    });

    this.dom.quickRoleChips.forEach(chip => {
      chip.addEventListener('click', () => {
        this.dom.usernameInput.value = chip.dataset.user;
        this.dom.passwordInput.value = chip.dataset.pass;
        this.handleLogin(chip.dataset.user, chip.dataset.pass);
      });
    });

    this.dom.logoutBtn.addEventListener('click', () => this.handleLogout());

    // Navigation Tabs
    this.dom.tabs.forEach(tab => {
      tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
    });

    // Plant Selector (Admin only)
    this.dom.plantSelector.addEventListener('change', (e) => {
      if (!this.currentUser || this.currentUser.role !== 'ADMIN') {
        e.target.value = this.activePlant;
        return;
      }
      this.activePlant = e.target.value;
      apiServiceInstance.setActivePlant(this.activePlant);
      this.activeReportDate = null;
      this.activeReportTabName = null;
      this.activeSpreadsheetUrl = null;
      this.reportsList = [];
      this.updateTargetDriveLabels();
      this.loadPlantReportsHub();
      this.renderStorageDirectory();
      this.showToast(`Active Plant: ${this.activePlant}`);
    });

    // Report Date Picker
    this.dom.reportDatePicker.addEventListener('change', (e) => {
      this.activeReportDate = e.target.value || new Date().toISOString().substring(0, 10);
      this.updateTargetDriveLabels();
      this.loadActiveReportObservations();
      this.showToast(`Report Date: ${this.activeReportDate}`);
    });

    // Reports Hub Actions
    this.dom.refreshReportsHubBtn.addEventListener('click', () => this.loadPlantReportsHub());
    this.dom.startNewInspectionBtn.addEventListener('click', async () => {
      if (this.currentUser && this.currentUser.role !== 'ADMIN') {
        this.showToast('Only ADMIN can create new inspections.');
        return;
      }
      const selectedDate = this.dom.reportDatePicker.value || new Date().toISOString().substring(0, 10);
      this.dom.startNewInspectionBtn.disabled = true;
      try {
        const res = await apiServiceInstance.ensurePlantReport(this.activePlant, selectedDate);
        this.setActiveReport(selectedDate, res.name, res.url);
        this.switchTab('capture');
        this.showToast(`${res.created ? 'Created' : 'Opened'} ${this.activePlant} inspection for ${selectedDate}.`);
        this.loadPlantReportsHub();
      } catch (err) {
        console.warn('Could not create/open remote report before capture:', err);
        this.setActiveReport(selectedDate);
        this.switchTab('capture');
        this.showToast(`Started local inspection for ${selectedDate}. It will sync when backend is available.`);
      } finally {
        this.dom.startNewInspectionBtn.disabled = false;
      }
    });

    this.dom.bannerViewSheetBtn.addEventListener('click', () => this.switchTab('sheet'));
    this.dom.bannerViewGalleryBtn.addEventListener('click', () => this.switchTab('gallery'));

    // Sheet View Actions
    this.dom.addNewObsFromSheetBtn.addEventListener('click', () => {
      this.switchTab('capture');
    });

    if (this.dom.deleteReportBtn) {
      this.dom.deleteReportBtn.addEventListener('click', () => this.handleDeleteReport());
    }

    // Gallery Filters
    this.dom.galleryFilters.forEach(btn => {
      btn.addEventListener('click', () => {
        this.dom.galleryFilters.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeGalleryFilter = btn.dataset.filter;
        this.renderGalleryGrid();
      });
    });

    // Photo Detail Modal
    this.dom.closeDetailModalBtn.addEventListener('click', () => this.dom.photoDetailModal.classList.add('hidden'));
    this.dom.detailModalCloseBtn.addEventListener('click', () => this.dom.photoDetailModal.classList.add('hidden'));
    this.dom.detailModalRectifyBtn.addEventListener('click', () => {
      if (this.activeTargetObs) this.openRectifyModal(this.activeTargetObs);
    });

    // Rectification Modal Actions
    this.dom.closeRectifyModalBtn.addEventListener('click', () => {
      this.dom.rectifyModal.classList.add('hidden');
      if (this.rectifyStream) {
        this.rectifyStream.getTracks().forEach(t => t.stop());
        this.rectifyStream = null;
      }
    });
    this.dom.cancelRectifyBtn.addEventListener('click', () => {
      this.dom.rectifyModal.classList.add('hidden');
      if (this.rectifyStream) {
        this.rectifyStream.getTracks().forEach(t => t.stop());
        this.rectifyStream = null;
      }
    });

    if (this.dom.rectifyRefThumbWrap) {
      this.dom.rectifyRefThumbWrap.addEventListener('click', () => {
        if (this.activeTargetObs) {
          this.openPhotoDetailModal(this.activeTargetObs);
        }
      });
    }

    if (this.dom.rectifyToggleWebcamBtn) {
      this.dom.rectifyToggleWebcamBtn.addEventListener('click', () => {
        if (this.dom.rectifyCapturePrompt) this.dom.rectifyCapturePrompt.classList.add('hidden');
        if (this.dom.rectifyWebcamContainer) this.dom.rectifyWebcamContainer.classList.remove('hidden');
        this.startRectifyCamera();
      });
    }

    if (this.dom.rectifyCloseWebcamBtn) {
      this.dom.rectifyCloseWebcamBtn.addEventListener('click', () => {
        if (this.rectifyStream) {
          this.rectifyStream.getTracks().forEach(t => t.stop());
          this.rectifyStream = null;
        }
        if (this.dom.rectifyWebcamContainer) this.dom.rectifyWebcamContainer.classList.add('hidden');
        if (this.dom.rectifyCapturePrompt) this.dom.rectifyCapturePrompt.classList.remove('hidden');
      });
    }

    if (this.dom.rectifyTakeLiveBtn) {
      this.dom.rectifyTakeLiveBtn.addEventListener('click', () => this.takeRectifyLivePhoto());
    }

    if (this.dom.rectifyPhoneCameraInput) {
      this.dom.rectifyPhoneCameraInput.addEventListener('change', (e) => {
        this.handleRectifyFileInput(e.target.files[0]);
        e.target.value = '';
      });
    }

    if (this.dom.rectifyGalleryInput) {
      this.dom.rectifyGalleryInput.addEventListener('change', (e) => {
        this.handleRectifyFileInput(e.target.files[0]);
        e.target.value = '';
      });
    }

    if (this.dom.rectifyRetakeInput) {
      this.dom.rectifyRetakeInput.addEventListener('change', (e) => {
        this.handleRectifyFileInput(e.target.files[0]);
        e.target.value = '';
      });
    }

    if (this.dom.rectifyRemovePhotoBtn) {
      this.dom.rectifyRemovePhotoBtn.addEventListener('click', () => {
        this.clearRectifySourcePreview();
      });
    }

    if (this.dom.rectifyFlipBtn) {
      this.dom.rectifyFlipBtn.addEventListener('click', () => {
        this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
        this.startRectifyCamera();
      });
    }

    this.dom.submitRectificationBtn.addEventListener('click', () => this.submitRectification());

    // Capture New Finding Actions (Minimal Hardware Cam & Local Files)
    if (this.dom.phoneCameraInput) {
      this.dom.phoneCameraInput.addEventListener('change', (e) => {
        this.handleFileInput(e.target.files[0], 'Phone Camera');
        e.target.value = '';
      });
    }
    if (this.dom.photoGalleryInput) {
      this.dom.photoGalleryInput.addEventListener('change', (e) => {
        this.handleFileInput(e.target.files[0], 'Device File');
        e.target.value = '';
      });
    }
    if (this.dom.phoneCameraRetakeInput) {
      this.dom.phoneCameraRetakeInput.addEventListener('change', (e) => {
        this.handleFileInput(e.target.files[0], 'Phone Camera');
        e.target.value = '';
      });
    }
    if (this.dom.photoGalleryRetakeInput) {
      this.dom.photoGalleryRetakeInput.addEventListener('change', (e) => {
        this.handleFileInput(e.target.files[0], 'Device File');
        e.target.value = '';
      });
    }
    if (this.dom.clearCapturePhotoBtn) {
      this.dom.clearCapturePhotoBtn.addEventListener('click', () => {
        this.clearRawSourcePreview();
      });
    }
    if (this.dom.toggleWebcamBtn) {
      this.dom.toggleWebcamBtn.addEventListener('click', () => {
        if (this.dom.cameraViewport) this.dom.cameraViewport.classList.remove('hidden');
        if (this.dom.webcamControlsBar) this.dom.webcamControlsBar.classList.remove('hidden');
        if (this.dom.capturePromptBox) this.dom.capturePromptBox.classList.add('hidden');
        this.startCamera();
      });
    }
    if (this.dom.closeWebcamBtn) {
      this.dom.closeWebcamBtn.addEventListener('click', () => {
        if (this.mediaStream) {
          this.mediaStream.getTracks().forEach(t => t.stop());
          this.mediaStream = null;
        }
        if (this.dom.cameraViewport) this.dom.cameraViewport.classList.add('hidden');
        if (this.dom.webcamControlsBar) this.dom.webcamControlsBar.classList.add('hidden');
        if (this.dom.capturePromptBox) this.dom.capturePromptBox.classList.remove('hidden');
      });
    }
    if (this.dom.takeLivePhotoBtn) {
      this.dom.takeLivePhotoBtn.addEventListener('click', () => {
        this.takeLivePhoto();
        if (this.mediaStream) {
          this.mediaStream.getTracks().forEach(t => t.stop());
          this.mediaStream = null;
        }
        if (this.dom.cameraViewport) this.dom.cameraViewport.classList.add('hidden');
        if (this.dom.webcamControlsBar) this.dom.webcamControlsBar.classList.add('hidden');
      });
    }
    if (this.dom.switchCameraBtn) {
      this.dom.switchCameraBtn.addEventListener('click', () => {
        this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
        this.startCamera();
      });
    }

    if (this.dom.findingInput) this.dom.findingInput.addEventListener('input', () => this.updateDesktopPreview());
    if (this.dom.locationInput) this.dom.locationInput.addEventListener('input', () => this.updateDesktopPreview());
    if (this.dom.submitEvidenceBtn) this.dom.submitEvidenceBtn.addEventListener('click', () => this.handleNewObservationSubmit());

    // Edit Finding Modal Listeners
    if (this.dom.closeEditFindingModalBtn) {
      this.dom.closeEditFindingModalBtn.addEventListener('click', () => this.closeEditFindingModal());
    }
    if (this.dom.cancelEditFindingBtn) {
      this.dom.cancelEditFindingBtn.addEventListener('click', () => this.closeEditFindingModal());
    }
    if (this.dom.saveEditFindingBtn) {
      this.dom.saveEditFindingBtn.addEventListener('click', () => this.handleSaveEditFinding());
    }

    // Google Cloud Direct API Settings Modal
    const openSettings = () => {
      this.dom.connectionStatusText.textContent = 'Direct Google Cloud API Ready';
      if (this.dom.connectionDetailText) {
        this.dom.connectionDetailText.textContent = 'REST endpoints: sheets.googleapis.com & googleapis.com/upload/drive/v3';
      }
      this.dom.settingsModal.classList.remove('hidden');
    };

    if (this.dom.openSettingsBtn) this.dom.openSettingsBtn.addEventListener('click', openSettings);
    if (this.dom.openBackendSettingsFromDriveBtn) this.dom.openBackendSettingsFromDriveBtn.addEventListener('click', openSettings);
    this.dom.closeSettingsBtn.addEventListener('click', () => this.dom.settingsModal.classList.add('hidden'));

    this.dom.saveSettingsBtn.addEventListener('click', () => {
      this.dom.settingsModal.classList.add('hidden');
      this.showToast('Google Cloud settings saved.');
      syncEngineInstance.processQueue();
    });

    this.dom.testConnectionBtn.addEventListener('click', async () => {
      this.dom.connectionStatusText.textContent = 'Pinging Google Sheets & Drive APIs...';
      if (this.dom.connectionLatencyBadge) this.dom.connectionLatencyBadge.textContent = '';
      if (this.dom.connectionDetailText) this.dom.connectionDetailText.textContent = '';
      
      try {
        const res = await apiServiceInstance.testConnection();
        this.dom.connectionStatusText.innerHTML = `<span class="icon-label" style="color: var(--ms-success);">${ICONS.check} <span>Connected & Operational</span></span>`;
        if (this.dom.connectionLatencyBadge) {
          this.dom.connectionLatencyBadge.textContent = `Total: ${res.totalLatencyMs}ms`;
        }
        if (this.dom.connectionDetailText) {
          this.dom.connectionDetailText.innerHTML = `<strong>Sheets API:</strong> ${res.sheetsLatencyMs}ms | <strong>Drive API:</strong> ${res.driveLatencyMs}ms`;
        }
      } catch (err) {
        this.dom.connectionStatusText.innerHTML = `<span class="icon-label" style="color: #a80000;">${ICONS.alert} <span>Attention Needed</span></span>`;
        if (this.dom.connectionDetailText) {
          this.dom.connectionDetailText.textContent = err.message;
        }
      }
    });

    // Cloud Storage Directory Modal Listeners
    if (this.dom.cloudStorageHubBtn) {
      this.dom.cloudStorageHubBtn.addEventListener('click', () => this.openStorageModal());
    }
    if (this.dom.closeStorageModalBtn) {
      this.dom.closeStorageModalBtn.addEventListener('click', () => this.closeStorageModal());
    }
    if (this.dom.doneStorageModalBtn) {
      this.dom.doneStorageModalBtn.addEventListener('click', () => this.closeStorageModal());
    }
    if (this.dom.storageDirectoryModal) {
      this.dom.storageDirectoryModal.addEventListener('click', (e) => {
        if (e.target === this.dom.storageDirectoryModal) this.closeStorageModal();
      });
    }

    // Reports Export (All A-K columns)
    this.dom.exportCsvBtn.addEventListener('click', () => this.exportCsv());
    this.dom.printReportBtn.addEventListener('click', () => window.print());
  }

  exportCsv() {
    if (this.cachedObservations.length === 0) {
      this.showToast('No records to export.');
      return;
    }
    const headers = [
      'Sl',
      'Findings / Issues',
      'Recommendation',
      'Specific Location',
      'Risk Level',
      'General Location',
      'Pictorial Evidence',
      'Responsible',
      'Deadline',
      'Corrected Pictures',
      'Remarks'
    ];
    const rows = this.cachedObservations.map(o => [
      `"${o.serial}"`,
      `"${(o.findings || '').replace(/"/g, '""')}"`,
      `"${(o.recommendation || '').replace(/"/g, '""')}"`,
      `"${(o.location || '').replace(/"/g, '""')}"`,
      `"${o.riskLevel}"`,
      `"${o.generalLocation || this.activePlant}"`,
      `"${o.pictorialEvidenceUrl || o.driveLink || ''}"`,
      `"${o.responsible || 'Utility In-Charge'}"`,
      `"${o.deadline || (o.riskLevel === 'Priority 1' ? '7 Days' : o.riskLevel === 'Priority 3' ? '3 Days' : '4 Days')}"`,
      `"${o.correctedPictureUrl || ''}"`,
      `"${o.remarks || (o.isRectified ? 'Rectified' : 'Not Rectified')}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Epic_CAP_${this.activePlant}_${this.activeReportDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast('CSV Exported.');
  }

  showToast(msg) {
    const existing = document.querySelector('.ms-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'ms-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 200);
    }, 2800);
  }

  generateSampleIndustrialScene(findings, location) {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 900;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#2b2e33';
    ctx.fillRect(0, 0, 1200, 900);

    ctx.fillStyle = '#4e545c';
    ctx.fillRect(150, 80, 900, 740);
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 4;
    ctx.strokeRect(150, 80, 900, 740);

    ctx.fillStyle = '#d83b01';
    ctx.fillRect(200, 140, 200, 90);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px "Segoe UI", sans-serif';
    ctx.fillText('DANGER 415V', 215, 195);

    ctx.strokeStyle = '#ff8c00';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(250, 400);
    ctx.bezierCurveTo(350, 480, 450, 320, 600, 460);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px "Segoe UI", sans-serif';
    ctx.fillText(`EPIC GROUP: ${this.activePlant} - ${location.toUpperCase()}`, 200, 700);
    ctx.fillStyle = '#ffb900';
    ctx.font = 'bold 22px "Segoe UI", sans-serif';
    ctx.fillText(`FINDING: ${findings.toUpperCase()}`, 200, 740);

    return canvas;
  }
}

window.addEventListener('DOMContentLoaded', () => {
  const app = new EpicCAPApp();
  app.init();
});
