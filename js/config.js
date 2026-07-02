/* ═══════════════════════════════════════════════════════
   Frontend API Configuration File
   ═══════════════════════════════════════════════════════ */

const CONFIG = {
  // Replace this with your actual separate Backend Vercel URL
  API_BASE_URL: 'https://stockmarket-backend.vercel.app'
};

// Check if running on localhost or locally via file system
const API_BASE_ORIGIN = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:')
  ? 'http://localhost:5000'
  : CONFIG.API_BASE_URL;

const API_BASE = API_BASE_ORIGIN + '/api';
window.API_BASE_ORIGIN = API_BASE_ORIGIN;
window.API_BASE = API_BASE;
