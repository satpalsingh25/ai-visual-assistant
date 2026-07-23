/**
 * AI Visual Assistant - Configuration Settings
 * Feel free to update these configurations to point to your live backend.
 */
const CONFIG = {
  // The API endpoint where canvas images are sent via POST
  // On GitHub Pages, change this to your secure backend URL (e.g. 'https://api.yourdomain.com/analyze')
  API_URL: 'https://api.example.com/analyze',

  // Network request timeout limit in milliseconds
  API_TIMEOUT_MS: 15000,

  // Default camera quality mode. Options: 'low' (640x480), 'medium' (1280x720), 'high' (1920x1080)
  DEFAULT_QUALITY: 'medium',

  // Start with auto-capture disabled by default
  DEFAULT_AUTO_CAPTURE: false,

  // Auto capture scan check interval in milliseconds
  AUTO_CAPTURE_INTERVAL_MS: 5000,

  // Out-of-the-box demo mode defaults. If true, allows running simulated analyses
  // if no live backend is listening or if selected by the user.
  DEFAULT_DEMO_MODE: true
};
