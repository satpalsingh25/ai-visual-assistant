/**
 * AI Visual Assistant - Core Application Logic
 * Vanilla JavaScript implementation for camera capture, settings sync, and AI analysis.
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const videoElement = document.getElementById('camera-stream');
  const canvasElement = document.getElementById('capture-canvas');
  const analyzeBtn = document.getElementById('analyze-btn');
  const analyzeBtnText = document.getElementById('analyze-btn-text');
  
  // Viewport overlays
  const cameraLoadingOverlay = document.getElementById('camera-loading');
  const cameraFallbackOverlay = document.getElementById('camera-fallback');
  const fallbackReasonText = document.getElementById('fallback-reason');
  const toggleCameraBtn = document.getElementById('toggle-camera-btn');
  const frozenFrameOverlay = document.getElementById('frozen-frame-overlay');
  const frozenImage = document.getElementById('frozen-image');
  const scannerLine = document.getElementById('scanner-line');
  const fileInput = document.getElementById('image-file-input');
  const captureInput = document.getElementById('image-capture-input');
  
  // AI Response elements
  const analysisPanel = document.getElementById('analysis-panel');
  const analysisLoading = document.getElementById('analysis-loading');
  const analysisError = document.getElementById('analysis-error');
  const errorMessageText = document.getElementById('error-message-text');
  const retryBtn = document.getElementById('retry-btn');
  const demoFallbackBtn = document.getElementById('demo-fallback-btn');
  const resultsContent = document.getElementById('analysis-results-content');
  const confidenceBar = document.getElementById('confidence-bar');
  const confidenceVal = document.getElementById('confidence-val');
  const timestampVal = document.getElementById('timestamp-val');
  const summaryBox = document.getElementById('analysis-summary');
  const explanationBox = document.getElementById('analysis-explanation');
  const retakeBtn = document.getElementById('retake-btn');
  
  // Settings elements
  const qualitySelect = document.getElementById('quality-select');
  const autoCaptureToggle = document.getElementById('auto-capture-toggle');
  const demoModeToggle = document.getElementById('demo-mode-toggle');
  const statusLabelText = document.getElementById('status-label-text');
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const sunIcon = document.getElementById('theme-icon-sun');
  const moonIcon = document.getElementById('theme-icon-moon');

  // History elements
  const historyPlaceholder = document.getElementById('history-placeholder');
  const historyList = document.getElementById('history-list');
  const clearHistoryBtn = document.getElementById('clear-history-btn');

  // State Variables
  let mediaStream = null;
  let activeFacingMode = 'environment'; // Prefer rear camera on mobile
  let videoDevices = [];
  let currentDeviceIndex = 0;
  let isAnalyzing = false;
  let scanHistory = [];
  let autoCaptureTimer = null;

  let lastCapturedJpegBase64 = '';
  let lastCapturedThumbnailBase64 = '';
  let isCameraFallbackActive = false;

  // Max dimension for resizing thumbnails to protect localStorage quotas
  const MAX_STORAGE_IMAGE_DIM = 400;

  // Camera resolution configuration profiles
  const QUALITY_PROFILES = {
    high: { width: 1920, height: 1080, quality: 0.90 },
    medium: { width: 1280, height: 720, quality: 0.75 },
    low: { width: 640, height: 480, quality: 0.50 }
  };

  // --- Initialization ---

  init();

  function init() {
    loadSettings();
    setupEventListeners();
    loadHistory();
    startCamera();
    updateThemeUI();
    updateDemoLabel();
  }

  // --- Settings & Persistence ---

  function loadSettings() {
    // Quality preference
    const quality = localStorage.getItem('assistant_quality') || CONFIG.DEFAULT_QUALITY;
    qualitySelect.value = quality;

    // Auto Capture preference
    const autoCap = localStorage.getItem('assistant_auto_capture') === 'true' || CONFIG.DEFAULT_AUTO_CAPTURE;
    autoCaptureToggle.checked = autoCap;

    // Demo Mode preference
    const demoMode = localStorage.getItem('assistant_demo_mode') !== 'false'; // default true
    demoModeToggle.checked = demoMode;

    // Theme preference (Dark mode)
    const isDark = localStorage.getItem('assistant_dark_theme') === 'true';
    if (isDark) {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  }

  function setupEventListeners() {
    // Actions
    analyzeBtn.addEventListener('click', handleMainAction);
    retakeBtn.addEventListener('click', resetAnalysisState);
    clearHistoryBtn.addEventListener('click', clearAllHistory);
    
    // Retries
    retryBtn.addEventListener('click', () => {
      if (lastCapturedJpegBase64) sendImageToAI(lastCapturedJpegBase64);
    });
    demoFallbackBtn.addEventListener('click', () => {
      demoModeToggle.checked = true;
      updateDemoLabel();
      localStorage.setItem('assistant_demo_mode', 'true');
      if (lastCapturedJpegBase64) sendImageToAI(lastCapturedJpegBase64);
    });

    // Fallbacks
    fileInput.addEventListener('change', handleFileSelect);
    captureInput.addEventListener('change', handleFileSelect);

    // Camera Swapper
    toggleCameraBtn.addEventListener('click', switchCamera);

    // Settings adjustments
    qualitySelect.addEventListener('change', () => {
      localStorage.setItem('assistant_quality', qualitySelect.value);
      startCamera(); // Restart stream with new resolution constraints
    });

    autoCaptureToggle.addEventListener('change', () => {
      const active = autoCaptureToggle.checked;
      localStorage.setItem('assistant_auto_capture', active ? 'true' : 'false');
      toggleAutoCaptureLoop(active);
    });

    demoModeToggle.addEventListener('change', () => {
      updateDemoLabel();
      localStorage.setItem('assistant_demo_mode', demoModeToggle.checked ? 'true' : 'false');
    });

    themeToggleBtn.addEventListener('click', toggleTheme);
  }

  // --- Dark/Light Mode Theme Toggle ---

  function toggleTheme() {
    const isDark = document.body.classList.toggle('dark-theme');
    localStorage.setItem('assistant_dark_theme', isDark ? 'true' : 'false');
    updateThemeUI();
  }

  function updateThemeUI() {
    const isDark = document.body.classList.contains('dark-theme');
    if (isDark) {
      sunIcon.classList.remove('hidden');
      moonIcon.classList.add('hidden');
    } else {
      sunIcon.classList.add('hidden');
      moonIcon.classList.remove('hidden');
    }
  }

  function updateDemoLabel() {
    if (demoModeToggle.checked) {
      statusLabelText.textContent = 'Demo Mode';
      statusLabelText.style.background = 'rgba(99, 102, 241, 0.1)';
      statusLabelText.style.color = 'var(--accent-color)';
    } else {
      statusLabelText.textContent = 'Live Server';
      statusLabelText.style.background = 'rgba(239, 68, 68, 0.1)';
      statusLabelText.style.color = 'var(--error-color)';
    }
  }

  // --- Camera Operations ---

  /**
   * Request WebRTC media permissions and run the video feed
   */
  async function startCamera() {
    stopCamera();
    showCameraLoading(true);
    hideCameraFallback();
    isCameraFallbackActive = false;
    
    analyzeBtn.disabled = true;
    analyzeBtnText.textContent = 'Initializing Camera...';

    const profileName = qualitySelect.value;
    const profile = QUALITY_PROFILES[profileName] || QUALITY_PROFILES.medium;

    const constraints = {
      audio: false,
      video: {
        facingMode: activeFacingMode,
        width: { ideal: profile.width },
        height: { ideal: profile.height }
      }
    };

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      videoElement.srcObject = mediaStream;
      
      videoElement.onloadedmetadata = () => {
        showCameraLoading(false);
        analyzeBtn.disabled = false;
        analyzeBtnText.textContent = 'Analyze Current View';
        
        // Check for multiple video sources
        enumerateVideoDevices();
        
        // Kickoff auto-capture if turned on
        toggleAutoCaptureLoop(autoCaptureToggle.checked);
      };
    } catch (err) {
      console.warn("FacingMode camera stream failed. Retrying with generic stream...", err);
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoElement.srcObject = mediaStream;
        videoElement.onloadedmetadata = () => {
          showCameraLoading(false);
          analyzeBtn.disabled = false;
          analyzeBtnText.textContent = 'Analyze Current View';
          enumerateVideoDevices();
          toggleAutoCaptureLoop(autoCaptureToggle.checked);
        };
      } catch (fallbackErr) {
        console.error("Camera acquisition blocked:", fallbackErr);
        handleCameraError(fallbackErr);
      }
    }
  }

  function stopCamera() {
    if (mediaStream) {
      mediaStream.getTracks().forEach(track => track.stop());
      mediaStream = null;
    }
    videoElement.srcObject = null;
    toggleAutoCaptureLoop(false);
  }

  /**
   * Scan cameras to enable swapping on phones
   */
  async function enumerateVideoDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      if (videoDevices.length > 1) {
        toggleCameraBtn.classList.remove('hidden');
        
        // Find index of currently active device
        if (mediaStream) {
          const activeTrack = mediaStream.getVideoTracks()[0];
          if (activeTrack) {
            const settings = activeTrack.getSettings();
            const index = videoDevices.findIndex(d => d.deviceId === settings.deviceId);
            if (index !== -1) currentDeviceIndex = index;
          }
        }
      } else {
        toggleCameraBtn.classList.add('hidden');
      }
    } catch (err) {
      console.warn("Failed to list camera devices:", err);
    }
  }

  /**
   * Swap between front and rear cameras
   */
  async function switchCamera() {
    if (videoDevices.length <= 1) return;
    
    currentDeviceIndex = (currentDeviceIndex + 1) % videoDevices.length;
    const targetDevice = videoDevices[currentDeviceIndex];
    
    showCameraLoading(true);
    stopCamera();

    const constraints = {
      audio: false,
      video: { deviceId: { exact: targetDevice.deviceId } }
    };

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      videoElement.srcObject = mediaStream;
      videoElement.onloadedmetadata = () => {
        showCameraLoading(false);
        toggleAutoCaptureLoop(autoCaptureToggle.checked);
      };
      
      // Update our track label
      if (targetDevice.label.toLowerCase().includes('front') || 
          targetDevice.label.toLowerCase().includes('user')) {
        activeFacingMode = 'user';
      } else {
        activeFacingMode = 'environment';
      }
    } catch (err) {
      console.error("Camera index switch failed. Reverting to automated facingMode toggle:", err);
      activeFacingMode = activeFacingMode === 'environment' ? 'user' : 'environment';
      startCamera();
    }
  }

  /**
   * Handle permission denials or connection constraints
   */
  function handleCameraError(error) {
    showCameraLoading(false);
    isCameraFallbackActive = true;
    
    let message = "WebRTC direct camera streaming is sandboxed in this browser. You can capture a picture locally using the direct capture button.";
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      message = "Camera access was denied. Please change settings, or capture photos manually using the buttons below.";
    } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      message = "No integrated video cameras were found on this system.";
    }

    fallbackReasonText.textContent = message;
    cameraFallbackOverlay.classList.remove('hidden');

    analyzeBtn.disabled = false;
    analyzeBtnText.textContent = 'Take Photo / Scan';
  }

  function showCameraLoading(show) {
    if (show) {
      cameraLoadingOverlay.classList.remove('hidden');
    } else {
      cameraLoadingOverlay.classList.add('hidden');
    }
  }

  function hideCameraFallback() {
    cameraFallbackOverlay.classList.add('hidden');
  }

  // --- Auto-Capture Mechanism ---

  function toggleAutoCaptureLoop(enable) {
    if (autoCaptureTimer) {
      clearInterval(autoCaptureTimer);
      autoCaptureTimer = null;
    }

    if (enable && mediaStream && !isCameraFallbackActive) {
      autoCaptureTimer = setInterval(() => {
        if (!isAnalyzing && frozenFrameOverlay.classList.contains('hidden')) {
          console.log("Auto Capture loop triggered snapshot analysis...");
          captureAndAnalyze();
        }
      }, CONFIG.AUTO_CAPTURE_INTERVAL_MS);
    }
  }

  // --- Action Handlers ---

  function handleMainAction() {
    if (isCameraFallbackActive) {
      captureInput.click(); // Triggers iPhone/Android native camera selector
    } else {
      captureAndAnalyze();
    }
  }

  /**
   * Handles static picture capture uploads (when WebRTC is blocked)
   */
  function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
      const img = new Image();
      img.onload = function() {
        frozenImage.src = e.target.result;
        frozenFrameOverlay.classList.remove('hidden');
        processSelectedImage(img);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function processSelectedImage(img) {
    const ctx = canvasElement.getContext('2d');
    const profile = QUALITY_PROFILES[qualitySelect.value] || QUALITY_PROFILES.medium;
    
    // Scale for analysis
    let width = img.width;
    let height = img.height;
    if (width > profile.width || height > profile.height) {
      if (width > height) {
        height = Math.round((height * profile.width) / width);
        width = profile.width;
      } else {
        width = Math.round((width * profile.height) / height);
        height = profile.height;
      }
    }
    
    canvasElement.width = width;
    canvasElement.height = height;
    ctx.drawImage(img, 0, 0, width, height);
    
    const dataUrl = canvasElement.toDataURL('image/jpeg', profile.quality);
    lastCapturedJpegBase64 = dataUrl.split(',')[1];
    
    createThumbnail(img);
    captureAndAnalyze();
  }

  // --- Snapping & AI Requests ---

  /**
   * Snaps a video frame, starts line scanning animation, and sends payload
   */
  function captureAndAnalyze() {
    if (isAnalyzing) return;

    if (frozenFrameOverlay.classList.contains('hidden') && mediaStream) {
      const ctx = canvasElement.getContext('2d');
      const width = videoElement.videoWidth || 640;
      const height = videoElement.videoHeight || 480;
      
      canvasElement.width = width;
      canvasElement.height = height;
      ctx.drawImage(videoElement, 0, 0, width, height);

      const profile = QUALITY_PROFILES[qualitySelect.value] || QUALITY_PROFILES.medium;
      const dataUrl = canvasElement.toDataURL('image/jpeg', profile.quality);
      
      // Save pure Base64 without scheme header
      lastCapturedJpegBase64 = dataUrl.split(',')[1];
      
      frozenImage.src = dataUrl;
      frozenFrameOverlay.classList.remove('hidden');
      
      createThumbnail(videoElement);
    }

    // Toggle scanning layout states
    scannerLine.classList.remove('hidden');
    isAnalyzing = true;
    analyzeBtn.disabled = true;
    analyzeBtnText.textContent = 'Analyzing...';

    analysisPanel.classList.remove('hidden');
    analysisPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    showAnalysisLoader(true);
    hideAnalysisError();
    hideResults();

    sendImageToAI(lastCapturedJpegBase64);
  }

  function createThumbnail(sourceElement) {
    const thumbCanvas = document.createElement('canvas');
    const thumbCtx = thumbCanvas.getContext('2d');
    
    const sourceWidth = sourceElement.videoWidth || sourceElement.width || 300;
    const sourceHeight = sourceElement.videoHeight || sourceElement.height || 400;
    
    const targetWidth = MAX_STORAGE_IMAGE_DIM;
    const targetHeight = Math.round((sourceHeight * MAX_STORAGE_IMAGE_DIM) / sourceWidth);
    
    thumbCanvas.width = targetWidth;
    thumbCanvas.height = targetHeight;
    thumbCtx.drawImage(sourceElement, 0, 0, targetWidth, targetHeight);
    
    lastCapturedThumbnailBase64 = thumbCanvas.toDataURL('image/jpeg', 0.65);
  }

  /**
   * POST analysis request with timeout limits
   */
  function sendImageToAI(base64Image) {
    const isDemo = demoModeToggle.checked;
    
    if (isDemo) {
      setTimeout(() => {
        const mockResponse = getMockAIResult();
        renderAnalysisSuccess(mockResponse);
        saveToHistory(mockResponse, lastCapturedThumbnailBase64);
      }, 2000);
      return;
    }

    // AbortController manages request timeouts
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CONFIG.API_TIMEOUT_MS);

    fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        image: base64Image
      }),
      signal: controller.signal
    })
    .then(async (response) => {
      clearTimeout(timeoutId);
      if (!response.ok) {
        throw new Error(`API returned HTTP error status: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      if (data && data.summary && data.explanation && data.confidence !== undefined) {
        renderAnalysisSuccess(data);
        saveToHistory(data, lastCapturedThumbnailBase64);
      } else {
        throw new Error("Invalid API contract payload structure.");
      }
    })
    .catch((err) => {
      clearTimeout(timeoutId);
      console.error("AI engine traffic error:", err);
      let errorText = "The server connection failed or returned an invalid payload.";
      
      if (err.name === 'AbortError') {
        errorText = "The request timed out. The AI service did not reply in time.";
      } else if (!navigator.onLine) {
        errorText = "Your device is offline. Please check your internet connection.";
      }
      
      showAnalysisError(errorText);
    });
  }

  // --- UI Responses Rendering ---

  function showAnalysisLoader(show) {
    if (show) {
      analysisLoading.classList.remove('hidden');
    } else {
      analysisLoading.classList.add('hidden');
    }
  }

  function showAnalysisError(msg) {
    showAnalysisLoader(false);
    scannerLine.classList.add('hidden');
    isAnalyzing = false;
    analyzeBtn.disabled = false;
    analyzeBtnText.textContent = isCameraFallbackActive ? 'Take Photo / Scan' : 'Scan New Target';
    
    errorMessageText.textContent = msg;
    analysisError.classList.remove('hidden');
  }

  function hideAnalysisError() {
    analysisError.classList.add('hidden');
  }

  function showResults() {
    resultsContent.classList.remove('hidden');
  }

  function hideResults() {
    resultsContent.classList.add('hidden');
  }

  function renderAnalysisSuccess(data) {
    showAnalysisLoader(false);
    scannerLine.classList.add('hidden');
    isAnalyzing = false;
    analyzeBtn.disabled = false;
    analyzeBtnText.textContent = isCameraFallbackActive ? 'Take Photo / Scan' : 'Scan New Target';

    const confidencePct = Math.round(data.confidence * 100);
    confidenceBar.style.width = `${confidencePct}%`;
    confidenceVal.textContent = `${confidencePct}%`;

    // Visual score color coding
    if (confidencePct >= 80) {
      confidenceBar.style.background = 'var(--success-gradient)';
      confidenceVal.style.color = 'var(--success-color)';
    } else if (confidencePct >= 50) {
      confidenceBar.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
      confidenceVal.style.color = 'var(--warning-color)';
    } else {
      confidenceBar.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
      confidenceVal.style.color = 'var(--error-color)';
    }

    // Set timestamp
    const now = new Date();
    timestampVal.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + 
                             ` (${now.toLocaleDateString([], { month: 'short', day: 'numeric' })})`;

    summaryBox.textContent = data.summary;
    
    // Parse line breaks as paragraphs
    explanationBox.innerHTML = data.explanation
      .split('\n\n')
      .map(p => `<p style="margin-bottom: 0.65rem">${p}</p>`)
      .join('');

    showResults();
  }

  function resetAnalysisState() {
    isAnalyzing = false;
    lastCapturedJpegBase64 = '';
    lastCapturedThumbnailBase64 = '';
    
    frozenFrameOverlay.classList.add('hidden');
    frozenImage.src = '';
    scannerLine.classList.add('hidden');
    
    analysisPanel.classList.add('hidden');
    hideResults();
    hideAnalysisError();

    fileInput.value = '';
    captureInput.value = '';

    analyzeBtn.disabled = false;
    analyzeBtnText.textContent = isCameraFallbackActive ? 'Take Photo / Scan' : 'Analyze Current View';

    document.querySelectorAll('.history-item').forEach(el => el.classList.remove('active'));
    
    // Resume auto-capture loops if enabled
    toggleAutoCaptureLoop(autoCaptureToggle.checked);
  }

  // --- Scan History Management (Last 10 items) ---

  function loadHistory() {
    try {
      const stored = localStorage.getItem('assistant_history');
      if (stored) {
        scanHistory = JSON.parse(stored);
        renderHistoryList();
      }
    } catch (e) {
      console.warn("LocalStorage scan history load failed:", e);
    }
  }

  function saveToHistory(response, thumbnailData) {
    const now = new Date();
    const newItem = {
      id: Date.now().toString(),
      timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      dateLabel: now.toLocaleDateString([], { month: 'short', day: 'numeric' }),
      summary: response.summary,
      explanation: response.explanation,
      confidence: response.confidence,
      thumbnail: thumbnailData
    };

    scanHistory.unshift(newItem);

    // Limit history to 10 entries
    if (scanHistory.length > 10) {
      scanHistory = scanHistory.slice(0, 10);
    }

    try {
      localStorage.setItem('assistant_history', JSON.stringify(scanHistory));
    } catch (err) {
      console.warn("LocalStorage write failed. Retrying without thumbnails...", err);
      // Remove thumbnail if image hits storage limit quota
      newItem.thumbnail = '';
      scanHistory[0] = newItem;
      localStorage.setItem('assistant_history', JSON.stringify(scanHistory));
    }

    renderHistoryList();
  }

  function renderHistoryList() {
    if (scanHistory.length === 0) {
      historyPlaceholder.classList.remove('hidden');
      historyList.classList.add('hidden');
      return;
    }

    historyPlaceholder.classList.add('hidden');
    historyList.classList.remove('hidden');
    historyList.innerHTML = '';

    scanHistory.forEach(item => {
      const el = document.createElement('div');
      el.className = 'history-item';
      el.dataset.id = item.id;

      const pct = Math.round(item.confidence * 100);
      const img = item.thumbnail || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="%23374151"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>';

      el.innerHTML = `
        <div class="history-thumb-container">
          <img src="${img}" class="history-thumb" alt="Thumbnail">
        </div>
        <div class="history-meta">
          <h4>${item.summary}</h4>
          <div class="history-sub">
            <span>${item.dateLabel} at ${item.timestamp}</span>
            <span class="history-score">${pct}% Confidence</span>
          </div>
        </div>
      `;

      el.addEventListener('click', () => selectHistoryItem(item));
      historyList.appendChild(el);
    });
  }

  function selectHistoryItem(item) {
    document.querySelectorAll('.history-item').forEach(el => {
      if (el.dataset.id === item.id) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    // Populate Response Card
    renderAnalysisSuccess({
      summary: item.summary,
      explanation: item.explanation,
      confidence: item.confidence
    });
    
    // Inject the historical timestamp
    timestampVal.textContent = item.timestamp + ` (${item.dateLabel})`;

    analysisPanel.classList.remove('hidden');
    analysisPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // Show captured screen photo in viewpoint frame
    if (item.thumbnail) {
      frozenImage.src = item.thumbnail;
      frozenFrameOverlay.classList.remove('hidden');
    }
  }

  function clearAllHistory() {
    scanHistory = [];
    localStorage.removeItem('assistant_history');
    renderHistoryList();
    resetAnalysisState();
  }

  // --- Simulated Response Database (Demo Fallbacks) ---

  function getMockAIResult() {
    const mockDb = [
      {
        summary: "Printed Page: Physics Mechanics Problems",
        explanation: "The captured frame contains printed physics questions focusing on rotational mechanics. Specifically, it lists exercises regarding the moment of inertia for point masses: I = sum(m_i * r_i^2).\n\nSuggested steps for problem 3:\n1. Diagram the standard forces acting on the cylinder.\n2. Apply torque equations: Torque = I * alpha.\n3. Solve for angular acceleration (alpha) by linking tangential friction values.",
        confidence: 0.94
      },
      {
        summary: "Computer Screen: Javascript Async-Await Syntax",
        explanation: "The screenshot displays JavaScript script text defining asynchronous operations. The layout shows an async function querying a REST API client via fetch: 'const response = await fetch(url)'.\n\nNotes:\n- The code correctly handles JSON conversion with 'await response.json()'.\n- However, it lacks a try-catch block for network failures. Consider adding error boundaries.",
        confidence: 0.97
      },
      {
        summary: "Handwritten Note: Chemistry Compound Diagram",
        explanation: "The visual notes show ink sketches of chemical compound formulas. It identifies a Benzene ring structure coupled with a hydroxyl group, representing Phenol (C6H5OH).\n\nDetails:\n- The sketch outlines clear single and double bonds.\n- Scribbled notes below write: 'Acidic properties in water'. The ocr engine parsed the structures successfully.",
        confidence: 0.89
      },
      {
        summary: "Textbook Worksheet: Algebra Linear Equations",
        explanation: "The snapshot contains secondary math problems. Specifically, equations to solve for variables: '3x + 5 = 20'.\n\nMethod:\n1. Isolate the variable term: 3x = 20 - 5 = 15.\n2. Divide by the coefficient: x = 15 / 3 = 5.\nAll parsed metrics show values align perfectly.",
        confidence: 0.96
      },
      {
        summary: "Digital Layout: Agile Scrum Sprint Board",
        explanation: "Visual check shows a web page displaying a project backlog layout. It contains columns for 'To Do', 'In Progress', 'Code Review', and 'Done'.\n\nDetails:\n- Five user story cards are registered in the review state.\n- Colors mark priorities. Text is legible.",
        confidence: 0.92
      }
    ];

    const idx = Math.floor(Math.random() * mockDb.length);
    return mockDb[idx];
  }
});
