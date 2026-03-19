/* ═══════════════════════════════════════════════════════════
   EVA V3 - UTILS.JS
   Fonctions utilitaires globales
   ═══════════════════════════════════════════════════════════ */

// ═══ TOAST NOTIFICATIONS ═══
let toastTimeout = null;

export function showToast(message, type = 'info', duration = 3000) {
  // Remove existing toast
  const existing = document.getElementById('toast');
  if (existing) existing.remove();
  
  // Clear timeout
  if (toastTimeout) clearTimeout(toastTimeout);
  
  // Create toast
  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.className = `toast ${type}`;
  toast.textContent = message;
  
  document.body.appendChild(toast);
  
  // Auto remove
  toastTimeout = setTimeout(() => {
    toast.remove();
  }, duration);
}

export function toast(message, type = 'info') {
  showToast(message, type);
}

// ═══ FORMAT DATE ═══
export function formatDate(date) {
  if (!date) return '';
  
  const d = date instanceof Date ? date : date.toDate ? date.toDate() : new Date(date);
  
  const now = new Date();
  const diff = now - d;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (seconds < 60) return 'À l\'instant';
  if (minutes < 60) return `Il y a ${minutes}min`;
  if (hours < 24) return `Il y a ${hours}h`;
  if (days < 7) return `Il y a ${days}j`;
  
  return d.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
  });
}

// ═══ FORMAT TIME ═══
export function formatTime(date) {
  if (!date) return '';
  
  const d = date instanceof Date ? date : date.toDate ? date.toDate() : new Date(date);
  
  return d.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

// ═══ FORMAT DATETIME ═══
export function formatDateTime(date) {
  if (!date) return '';
  
  const d = date instanceof Date ? date : date.toDate ? date.toDate() : new Date(date);
  
  return d.toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// ═══ DEBOUNCE ═══
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// ═══ THROTTLE ═══
export function throttle(func, limit) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// ═══ SANITIZE HTML ═══
export function sanitizeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ═══ ESCAPE REGEX ═══
export function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ═══ GENERATE ID ═══
export function generateId(prefix = '') {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 9);
  return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
}

// ═══ COPY TO CLIPBOARD ═══
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Copié dans le presse-papier', 'success');
    return true;
  } catch (error) {
    console.error('Copy failed:', error);
    showToast('Erreur de copie', 'error');
    return false;
  }
}

// ═══ DOWNLOAD FILE ═══
export function downloadFile(content, filename, type = 'text/plain') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ═══ FORMAT FILE SIZE ═══
export function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// ═══ VALIDATE EMAIL ═══
export function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// ═══ VALIDATE URL ═══
export function isValidURL(string) {
  try {
    new URL(string);
    return true;
  } catch {
    return false;
  }
}

// ═══ TRUNCATE STRING ═══
export function truncate(str, maxLength, suffix = '...') {
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength - suffix.length) + suffix;
}

// ═══ CAPITALIZE ═══
export function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ═══ PLURAL ═══
export function plural(count, singular, plural) {
  return count === 1 ? singular : (plural || singular + 's');
}

// ═══ SLEEP ═══
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ═══ RETRY WITH BACKOFF ═══
export async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      const delay = baseDelay * Math.pow(2, i);
      await sleep(delay);
    }
  }
}

// ═══ LOCAL STORAGE HELPERS ═══
export function getLocalStorage(key, defaultValue = null) {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

export function setLocalStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeLocalStorage(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

// ═══ DETECT DEVICE ═══
export function isMobile() {
  return window.innerWidth < 768;
}

export function isTablet() {
  return window.innerWidth >= 768 && window.innerWidth < 1024;
}

export function isDesktop() {
  return window.innerWidth >= 1024;
}

export function getDeviceType() {
  if (isMobile()) return 'mobile';
  if (isTablet()) return 'tablet';
  return 'desktop';
}

// ═══ DETECT BROWSER ═══
export function getBrowser() {
  const ua = navigator.userAgent;
  
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Safari')) return 'Safari';
  if (ua.includes('Edge')) return 'Edge';
  if (ua.includes('Opera')) return 'Opera';
  
  return 'Unknown';
}

// ═══ DETECT OS ═══
export function getOS() {
  const ua = navigator.userAgent;
  
  if (ua.includes('Win')) return 'Windows';
  if (ua.includes('Mac')) return 'macOS';
  if (ua.includes('Linux')) return 'Linux';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
  
  return 'Unknown';
}

// ═══ GET SYSTEM INFO ═══
export function getSystemInfo() {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    browser: getBrowser(),
    os: getOS(),
    deviceType: getDeviceType(),
    timestamp: new Date().toISOString()
  };
}

// ═══ SCROLL TO ELEMENT ═══
export function scrollToElement(element, behavior = 'smooth') {
  if (typeof element === 'string') {
    element = document.querySelector(element);
  }
  
  if (element) {
    element.scrollIntoView({ behavior, block: 'start' });
  }
}

// ═══ CONFETTI (Fun) ═══
export function confetti() {
  // Simple confetti effect
  const duration = 3000;
  const animationEnd = Date.now() + duration;
  const colors = ['#00d4ff', '#00ff88', '#ff69b4', '#ffaa00'];
  
  const frame = () => {
    const timeLeft = animationEnd - Date.now();
    
    if (timeLeft <= 0) return;
    
    const particleCount = 2;
    
    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      particle.style.position = 'fixed';
      particle.style.left = Math.random() * 100 + '%';
      particle.style.top = '-10px';
      particle.style.width = '10px';
      particle.style.height = '10px';
      particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      particle.style.borderRadius = '50%';
      particle.style.pointerEvents = 'none';
      particle.style.zIndex = '9999';
      particle.style.transition = 'all 3s ease-out';
      
      document.body.appendChild(particle);
      
      setTimeout(() => {
        particle.style.top = '100vh';
        particle.style.opacity = '0';
      }, 10);
      
      setTimeout(() => particle.remove(), 3000);
    }
    
    requestAnimationFrame(frame);
  };
  
  frame();
}

// ═══ EXPORTS ═══
export default {
  showToast,
  toast,
  formatDate,
  formatTime,
  formatDateTime,
  debounce,
  throttle,
  sanitizeHTML,
  escapeRegex,
  generateId,
  copyToClipboard,
  downloadFile,
  formatFileSize,
  isValidEmail,
  isValidURL,
  truncate,
  capitalize,
  plural,
  sleep,
  retryWithBackoff,
  getLocalStorage,
  setLocalStorage,
  removeLocalStorage,
  isMobile,
  isTablet,
  isDesktop,
  getDeviceType,
  getBrowser,
  getOS,
  getSystemInfo,
  scrollToElement,
  confetti
};
