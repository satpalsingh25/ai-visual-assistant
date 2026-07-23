/**
 * MCQ Solver - AI Visual Assistant Script
 * Core camera controller and option explanation parser
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
  const resultsContent = document.getElementById('analysis-results-content');
  const retakeBtn = document.getElementById('retake-btn');
  
  // MCQ Specific Output Elements
  const correctAnswerBadge = document.getElementById('correct-answer-badge');
  const explanationA = document.getElementById('option-explanation-a');
  const explanationB = document.getElementById('option-explanation-b');
  const explanationC = document.getElementById('option-explanation-c');
  const explanationD = document.getElementById('option-explanation-d');
  
  const appStatusLabel = document.getElementById('app-status');
  const demoModeToggle = document.getElementById('demo-mode-toggle'); // Fallback check from config

  // Global State
  let mediaStream = null;
  let activeFacingMode = 'environment'; // Prefer rear camera on mobile
  let videoDevices = [];
  let currentDeviceIndex = 0;
  let isAnalyzing = false;
  let lastCapturedJpegBase64 = '';
  let isCameraFallbackActive = false;

  // Initialize
  init();

  function init() {
    setupEventListeners();
    startCamera();
    updateStatusIndicator();
  }

  function setupEventListeners() {
    analyzeBtn.addEventListener('click', handleMainAction);
    retakeBtn.addEventListener('click', resetAnalysisState);
    retryBtn.addEventListener('click', () => {
      if (lastCapturedJpegBase64) sendImageToAI(lastCapturedJpegBase64);
    });

    // Mobile file captures
    fileInput.addEventListener('change', handleFileSelect);
    captureInput.addEventListener('change', handleFileSelect);

    // Switch camera
    toggleCameraBtn.addEventListener('click', switchCamera);
  }

  function updateStatusIndicator() {
    const isDemo = CONFIG.DEFAULT_DEMO_MODE;
    appStatusLabel.textContent = isDemo ? 'Demo Mode' : 'Live Server';
    appStatusLabel.style.background = isDemo ? 'rgba(99, 102, 241, 0.1)' : 'rgba(239, 68, 68, 0.1)';
    appStatusLabel.style.color = isDemo ? 'var(--accent-color)' : 'var(--error-color)';
  }

  // --- Camera Operations ---

  /**
   * Automatically query and start the rear camera feed
   */
  async function startCamera() {
    stopCamera();
    showCameraLoading(true);
    hideCameraFallback();
    isCameraFallbackActive = false;
    
    analyzeBtn.disabled = true;
    analyzeBtnText.textContent = 'Initializing...';

    const constraints = {
      audio: false,
      video: {
        facingMode: activeFacingMode,
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    };

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      videoElement.srcObject = mediaStream;
      
      videoElement.onloadedmetadata = () => {
        showCameraLoading(false);
        analyzeBtn.disabled = false;
        analyzeBtnText.textContent = 'Capture & Solve';
        
        enumerateVideoDevices();
      };
    } catch (err) {
      console.warn("FacingMode stream failed, trying generic video fallback...", err);
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoElement.srcObject = mediaStream;
        videoElement.onloadedmetadata = () => {
          showCameraLoading(false);
          analyzeBtn.disabled = false;
          analyzeBtnText.textContent = 'Capture & Solve';
          enumerateVideoDevices();
        };
      } catch (fallbackErr) {
        console.error("Camera acquisition failed:", fallbackErr);
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
  }

  /**
   * Query device list to show camera swapper
   */
  async function enumerateVideoDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      if (videoDevices.length > 1) {
        toggleCameraBtn.classList.remove('hidden');
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
      console.warn("Error listing cameras:", err);
    }
  }

  /**
   * Cycles between front and rear cameras
   */
  async function switchCamera() {
    if (videoDevices.length <= 1) return;
    
    currentDeviceIndex = (currentDeviceIndex + 1) % videoDevices.length;
    const targetDevice = videoDevices[currentDeviceIndex];
    
    showCameraLoading(true);
    stopCamera();

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { deviceId: { exact: targetDevice.deviceId } }
      });
      videoElement.srcObject = mediaStream;
      videoElement.onloadedmetadata = () => {
        showCameraLoading(false);
      };
      
      if (targetDevice.label.toLowerCase().includes('front') || 
          targetDevice.label.toLowerCase().includes('user')) {
        activeFacingMode = 'user';
      } else {
        activeFacingMode = 'environment';
      }
    } catch (err) {
      console.error("Camera switch failed, using generic facingMode swap:", err);
      activeFacingMode = activeFacingMode === 'environment' ? 'user' : 'environment';
      startCamera();
    }
  }

  function handleCameraError(error) {
    showCameraLoading(false);
    isCameraFallbackActive = true;
    
    let message = "Secure HTTPS context required for live streaming. Tap 'Take Photo' to snapshot using your phone camera.";
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      message = "Camera access denied. Please allow permissions, or use native capture below.";
    }

    fallbackReasonText.textContent = message;
    cameraFallbackOverlay.classList.remove('hidden');

    analyzeBtn.disabled = false;
    analyzeBtnText.textContent = 'Take Photo / Scan';
  }

  function showCameraLoading(show) {
    cameraLoadingOverlay.classList.toggle('hidden', !show);
  }

  function hideCameraFallback() {
    cameraFallbackOverlay.classList.add('hidden');
  }

  // --- Snapshot Handlers ---

  function handleMainAction() {
    if (isCameraFallbackActive) {
      captureInput.click();
    } else {
      captureAndAnalyze();
    }
  }

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
    const maxDim = 1080;
    
    let width = img.width;
    let height = img.height;
    if (width > maxDim || height > maxDim) {
      if (width > height) {
        height = Math.round((height * maxDim) / width);
        width = maxDim;
      } else {
        width = Math.round((width * maxDim) / height);
        height = maxDim;
      }
    }
    
    canvasElement.width = width;
    canvasElement.height = height;
    ctx.drawImage(img, 0, 0, width, height);
    
    const dataUrl = canvasElement.toDataURL('image/jpeg', 0.80);
    lastCapturedJpegBase64 = dataUrl.split(',')[1];
    
    captureAndAnalyze();
  }

  function captureAndAnalyze() {
    if (isAnalyzing) return;

    if (frozenFrameOverlay.classList.contains('hidden') && mediaStream) {
      const ctx = canvasElement.getContext('2d');
      const width = videoElement.videoWidth || 640;
      const height = videoElement.videoHeight || 480;
      
      canvasElement.width = width;
      canvasElement.height = height;
      ctx.drawImage(videoElement, 0, 0, width, height);

      const dataUrl = canvasElement.toDataURL('image/jpeg', 0.75);
      lastCapturedJpegBase64 = dataUrl.split(',')[1];
      
      frozenImage.src = dataUrl;
      frozenFrameOverlay.classList.remove('hidden');
    }

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

  // --- Network Traffic and AI Parsing ---

  function sendImageToAI(base64Image) {
    const isDemo = CONFIG.DEFAULT_DEMO_MODE;
    
    if (isDemo) {
      // Simulated radar solve delay
      setTimeout(() => {
        const mockResponse = getMockMCQResult();
        renderAnalysisSuccess(mockResponse);
      }, 2000);
      return;
    }

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
        throw new Error(`Server returned HTTP ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      if (data && data.summary && data.explanation) {
        renderAnalysisSuccess(data);
      } else {
        throw new Error("Invalid API response format");
      }
    })
    .catch((err) => {
      clearTimeout(timeoutId);
      console.error("MCQ Solver API failed:", err);
      let errorText = "Unable to contact the AI visual assistant. Make sure your server is online.";
      
      if (err.name === 'AbortError') {
        errorText = "Request timed out. The AI model took too long to respond.";
      } else if (!navigator.onLine) {
        errorText = "Your device is offline. Please check your internet connection.";
      }
      
      showAnalysisError(errorText);
    });
  }

  function showAnalysisLoader(show) {
    analysisLoading.classList.toggle('hidden', !show);
  }

  function showAnalysisError(msg) {
    showAnalysisLoader(false);
    scannerLine.classList.add('hidden');
    isAnalyzing = false;
    analyzeBtn.disabled = false;
    analyzeBtnText.textContent = isCameraFallbackActive ? 'Take Photo / Scan' : 'Capture & Solve';
    
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

  /**
   * Render answer and parse standard option lines
   */
  function renderAnalysisSuccess(data) {
    showAnalysisLoader(false);
    scannerLine.classList.add('hidden');
    isAnalyzing = false;
    analyzeBtn.disabled = false;
    analyzeBtnText.textContent = isCameraFallbackActive ? 'Take Photo / Scan' : 'Capture & Solve';

    // Correct Option Header Badge
    correctAnswerBadge.textContent = data.summary;

    // Parse the explanations (which can be structured or a string containing A, B, C, D lines)
    const explanations = parseMCQExplanations(data.explanation);

    // Populate rows
    explanationA.textContent = explanations.A;
    explanationB.textContent = explanations.B;
    explanationC.textContent = explanations.C;
    explanationD.textContent = explanations.D;

    showResults();
  }

  /**
   * Helper parser that extracts explanations for options A, B, C, D
   * and guarantees each explanation has exactly 2 lines of details.
   */
  function parseMCQExplanations(explanationText) {
    const results = { A: '', B: '', C: '', D: '' };
    
    // Regular expression to look for starts like A: or A.
    const regex = /(?:^|\n|\r)\s*([A-D])\s*[:\.\)-]\s*([^\n\r]+)/gi;
    let match;
    let foundCount = 0;
    
    while ((match = regex.exec(explanationText)) !== null) {
      const option = match[1].toUpperCase();
      const text = match[2].trim();
      results[option] = text;
      foundCount++;
    }
    
    // Fallback parser if regex fails: split by newlines
    if (foundCount < 4) {
      const lines = explanationText.split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0 && !l.startsWith('#'));
      
      const keys = ['A', 'B', 'C', 'D'];
      keys.forEach((key, idx) => {
        results[key] = lines[idx] || `No explanation provided for Option ${key}. Please verify source document image.`;
      });
    }

    // Ensure they fit exactly 2 lines of text (approx 2 sentences, padding if too short)
    const keys = ['A', 'B', 'C', 'D'];
    keys.forEach(key => {
      let content = results[key];
      // If it doesn't look like it contains two distinct statements/lines, format it:
      if (!content.includes('.') && content.length > 10) {
        content = `${content}. Verify equation values.`;
      }
      results[key] = content;
    });

    return results;
  }

  function resetAnalysisState() {
    isAnalyzing = false;
    lastCapturedJpegBase64 = '';
    
    frozenFrameOverlay.classList.add('hidden');
    frozenImage.src = '';
    scannerLine.classList.add('hidden');
    
    analysisPanel.classList.add('hidden');
    hideResults();
    hideAnalysisError();

    fileInput.value = '';
    captureInput.value = '';

    analyzeBtn.disabled = false;
    analyzeBtnText.textContent = isCameraFallbackActive ? 'Take Photo / Scan' : 'Capture & Solve';
  }

  // --- Realistic Simulated Response Database (MCQ Solving Mode) ---

  function getMockMCQResult() {
    const mockDb = [
      {
        summary: "Option B",
        explanation: "A: Incorrect. This equation computes gravitational potential energy (m*g*h), not rotational kinetic energy of the cylinder.\nB: Correct. Rotational kinetic energy equals 1/2 * I * w^2. This matches the textbook derivatives perfectly.\nC: Incorrect. This measures linear work done by friction (f * d) and neglects rotational forces.\nD: Incorrect. This formula calculates angular momentum (I * w) instead of kinetic motion energy."
      },
      {
        summary: "Option D",
        explanation: "A: Incorrect. A primary key does not permit null values and must uniquely identify database records.\nB: Incorrect. Foreign keys establish relational bindings and are not required to hold unique values.\nC: Incorrect. Candidate keys are superkey subsets but are not the final assigned relational key.\nD: Correct. Unique constraints permit a single NULL value while guaranteeing all non-null inputs are distinct."
      },
      {
        summary: "Option A",
        explanation: "A: Correct. Mitosis results in two genetically identical diploid daughter cells for body growth.\nB: Incorrect. Meiosis produces four non-identical haploid gametes for sexual cell reproduction.\nC: Incorrect. Binary fission occurs in prokaryotes, while the textbook question specifies eukaryotic cells.\nD: Incorrect. Budding is asexual duplication and does not yield standard symmetric diploid daughters."
      },
      {
        summary: "Option C",
        explanation: "A: Incorrect. The quicksort algorithm has an average runtime of O(n log n) but worst-case is O(n^2).\nB: Incorrect. Mergesort is a stable divide-and-conquer sorter but requires extra O(n) memory space.\nC: Correct. Heapsort performs in-place sorting within O(n log n) worst-case time without extra buffers.\nD: Incorrect. Bubblesort runs at O(n^2) average complexity, which is highly inefficient for lists."
      }
    ];

    const idx = Math.floor(Math.random() * mockDb.length);
    return mockDb[idx];
  }
});
