/* ═══════════════════════════════════════════════════════════
   EVA V3 - WAKE-WORD.JS
   Détection du wake word "Hey Eva"
   ═══════════════════════════════════════════════════════════ */

import { startListening, stopListening } from './stt.js';
import { toast } from '../core/utils.js';

// Variables globales
let isWakeWordActive = false;
let wakeWords = ['hey eva', 'e.v.a', 'eva'];
let onWakeWordCallback = null;
let recognition = null;

// ═══ INIT WAKE WORD DETECTION ═══
export function initWakeWordDetection(config = {}) {
  wakeWords = config.wakeWords || ['hey eva', 'e.v.a', 'eva'];
  onWakeWordCallback = config.onDetected;
  
  console.log('✅ Wake word detection initialized');
  console.log('🎤 Wake words:', wakeWords.join(', '));
  
  return { success: true };
}

// ═══ START WAKE WORD DETECTION ═══
export function startWakeWordDetection() {
  if (isWakeWordActive) {
    console.warn('⚠️ Wake word detection already active');
    return { success: false, error: 'Already active' };
  }
  
  isWakeWordActive = true;
  
  // Start continuous listening
  startListening({
    continuous: true,
    onResult: (result) => {
      if (!result.isFinal) return;
      
      const transcript = result.transcript.toLowerCase().trim();
      console.log('🎤 Transcript:', transcript);
      
      // Check if any wake word is detected
      const detected = wakeWords.some(wakeWord => 
        transcript.includes(wakeWord)
      );
      
      if (detected) {
        console.log('✅ Wake word detected!');
        handleWakeWordDetected();
      }
    },
    onEnd: () => {
      // Auto-restart if still active
      if (isWakeWordActive) {
        setTimeout(() => {
          startListening({ continuous: true });
        }, 100);
      }
    }
  });
  
  toast('Écoute activée - Dis "Hey Eva"', 'info');
  setLogoListening(true);
  
  return { success: true };
}

// ═══ STOP WAKE WORD DETECTION ═══
export function stopWakeWordDetection() {
  if (!isWakeWordActive) {
    return { success: false, error: 'Not active' };
  }
  
  isWakeWordActive = false;
  stopListening();
  setLogoListening(false);
  
  toast('Écoute désactivée', 'info');
  
  return { success: true };
}

// ═══ TOGGLE WAKE WORD DETECTION ═══
export function toggleWakeWordDetection() {
  if (isWakeWordActive) {
    return stopWakeWordDetection();
  } else {
    return startWakeWordDetection();
  }
}

// ═══ HANDLE WAKE WORD DETECTED ═══
function handleWakeWordDetected() {
  // Play sound or visual feedback
  playWakeWordSound();
  
  // Callback
  if (onWakeWordCallback) {
    onWakeWordCallback();
  }
  
  // Show feedback
  showWakeWordFeedback();
}

// ═══ PLAY WAKE WORD SOUND ═══
function playWakeWordSound() {
  try {
    const audio = new Audio('assets/sounds/notification.mp3');
    audio.volume = 0.5;
    audio.play().catch(() => {
      // Ignore errors (user interaction may be required)
    });
  } catch (error) {
    console.error('Play sound error:', error);
  }
}

// ═══ SHOW WAKE WORD FEEDBACK ═══
function showWakeWordFeedback() {
  const logo = document.getElementById('evaLogo');
  if (logo) {
    logo.style.filter = 'drop-shadow(0 0 30px var(--green))';
    setTimeout(() => {
      logo.style.filter = '';
    }, 500);
  }
  
  toast('👋 Je t\'écoute !', 'success');
}

// ═══ SET LOGO LISTENING STATE ═══
function setLogoListening(listening) {
  const logo = document.getElementById('evaLogo');
  const statusDot = document.getElementById('statusDot');
  
  if (listening) {
    logo?.classList.add('listening');
    statusDot?.classList.add('listening');
  } else {
    logo?.classList.remove('listening');
    statusDot?.classList.remove('listening');
  }
}

// ═══ IS WAKE WORD ACTIVE ═══
export function isWakeWordDetectionActive() {
  return isWakeWordActive;
}

// ═══ SET WAKE WORDS ═══
export function setWakeWords(words) {
  wakeWords = words;
  console.log('🎤 Wake words updated:', wakeWords.join(', '));
}

// ═══ GET WAKE WORDS ═══
export function getWakeWords() {
  return [...wakeWords];
}

export default {
  initWakeWordDetection,
  startWakeWordDetection,
  stopWakeWordDetection,
  toggleWakeWordDetection,
  isWakeWordDetectionActive,
  setWakeWords,
  getWakeWords
};
