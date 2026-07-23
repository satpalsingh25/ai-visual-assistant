# AI Visual Assistant

A complete, production-ready single-page AI vision client designed to capture and analyze printed documents, screens, equations, textbooks, and handwritten notes. Optimized for modern mobile browsers (iOS Safari, Android Chrome) and desktops.

This client can be hosted entirely on **GitHub Pages** (which provides required HTTPS hosting out-of-the-box) and connects to any backend API endpoint.

---

## 📁 Folder Structure

```
/
├── index.html       # Structural HTML5 template and viewport overlays
├── style.css        # Responsive stylesheet with Dark Mode variables and CSS animations
├── script.js        # Core WebRTC controller, capture engines, settings, and local cache
├── config.js        # Configurable API URLs, request timeouts, and default app settings
├── README.md        # Documentation and deployment guides
├── assets/          
│   ├── logo.png     # Logo image asset
│   └── loading.gif  # Loading spinner fallback gif asset
```

---

## 🚀 How to Deploy on GitHub Pages

Because camera hardware streaming APIs (`navigator.mediaDevices.getUserMedia`) require a **Secure Context (HTTPS)**, hosting on GitHub Pages is the easiest way to test this on actual mobile devices.

### Step 1: Create a GitHub Repository
1. Log in to [GitHub](https://github.com).
2. Create a new public repository (e.g., `ai-visual-assistant`).
3. Leave "Initialize with a README" unchecked.

### Step 2: Upload Files
Initialize Git locally in your project folder and push to GitHub:
```bash
# Initialize repository
git init

# Add remote address
git remote add origin https://github.com/your-username/ai-visual-assistant.git

# Stage and commit all files
git add .
git commit -m "Initialize AI Visual Assistant client codebase"

# Push to main branch
git branch -M main
git push -u origin main
```

*(Alternatively, you can upload files manually by clicking "Upload files" on the GitHub repository page).*

### Step 3: Enable GitHub Pages
1. Go to your repository settings on GitHub.
2. In the left navigation menu, click **Pages**.
3. Under **Build and deployment**, set the source to **Deploy from a branch**.
4. Choose the `main` branch and directory `/ (root)`, and click **Save**.
5. After a minute, refresh. GitHub will provide your live HTTPS URL (e.g., `https://your-username.github.io/ai-visual-assistant/`).

---

## ⚙️ How to Configure the Backend API URL

The application reads configurations from `config.js`. 

1. Open `config.js` in a text editor.
2. Change the `API_URL` value to match your backend endpoint:
   ```javascript
   const CONFIG = {
     API_URL: 'https://api.yourdomain.com/analyze', // Replace with your backend HTTPS URL
     API_TIMEOUT_MS: 15000,
     // ...
   };
   ```
3. Commit and push the changes back to GitHub. The live site will automatically read the new URL.

### Backend API Contract Specification
The configured backend endpoint must accept and return the following JSON schemas:

* **Request Format (POST):**
  ```json
  {
    "image": "<base64_encoded_jpeg_string_without_scheme_headers>"
  }
  ```

* **Response Format (JSON):**
  ```json
  {
    "summary": "Printed Text: Calculus Worksheet",
    "explanation": "Identifies derivatives. Formula lists d/dx(x^n) = n*x^(n-1).",
    "confidence": 0.96
  }
  ```

---

## 📱 How to Use the Application

1. **Boot Camera:** When opening the website on your phone, you will be prompted to grant camera access. The app will open your **rear camera** in portrait mode automatically.
2. **Scan/Analyze:** Aim at a document and tap **Analyze Current View**. The view freezes, a laser scan sweeps the page, and the loading indicator fires.
3. **Review AI Breakdown:** The summary, full explanation, and color-coded confidence score display instantly below the viewport.
4. **Settings:** Adjust camera quality profile (High, Medium, Low), toggle Dark Mode, or turn on **Auto Capture** to scan and submit automatically every 5 seconds.
5. **View History:** Scroll down to browse past scans (caches the last 10 entries locally in `localStorage` with small image previews). Click any item to load it back onto the viewport.
6. **Clear / Reset:** Tap **Clear / Retake** to clear current results and reboot the live video feed.

---

## 🛠️ Troubleshooting & Compatibility

| Issue | Cause | Fix |
| :--- | :--- | :--- |
| **"Camera Connection Blocked"** | Browser lacks secure context (HTTPS) or user denied permissions. | Open the app using an HTTPS URL (like GitHub Pages). If on iPhone, open in Safari/Chrome and accept the prompt. |
| **iOS Chrome Camera Blank** | Sandboxing prevents Chrome WebRTC local file streaming. | The app handles this automatically by switching to **"Direct Capture" mode**. Clicking the button opens your native iOS system camera, letting you snap a photo that processes instantly in Chrome! |
| **"Analysis Failed" / Network Error** | Backend server is offline, CORS is blocked, or request timed out. | Check the console logs. Make sure your server is listening and has **CORS headers enabled** (`Access-Control-Allow-Origin: *`). Turn on **Demo Mode** in Settings to run simulated results. |
| **History items disappearing** | Browser storage space limits reached. | The app automatically compresses images down to a max dimension of 400px before writing to `localStorage` to fit within the browser's 5MB quota. Tap **Delete History** to free up space. |

### Browser Compatibility Matrix
- **iOS Safari / iOS Chrome:** Supported (v13+). Camera switching and direct photo fallbacks operational.
- **Android Chrome:** Fully Supported. Auto-requests camera permission and handles multiple sensors.
- **Desktop Chrome / Safari / Edge / Firefox:** Fully Supported (falls back to webcam/file upload).
