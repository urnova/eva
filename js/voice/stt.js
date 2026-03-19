/* ═══════════════════════════════════════════════════════════
   EVA V3 - STT.JS
   Speech-to-Text (Reconnaissance vocale)
   ═══════════════════════════════════════════════════════════ */

import { toast } from '../core/utils.js';

// Variables globales
let recognition = null;
let isListening = false;
let isContinuous = false;
let onResultCallback = null;
let onEndCallback = null;

// ═══ INIT SPEECH RECOGNITION ═══
export function initSpeechRecognition(config = {}) {
  // Check browser support
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    console.error('❌ Speech Recognition not supported');
    return { success: false, error: 'Speech Recognition not supported in this browser' };
  }
  
  try {
    recognition = new SpeechRecognition();
    
    // Configuration
    recognition.lang = config.lang || 'fr-FR';
    recognition.continuous = config.continuous || false;
    recognition.interimResults = config.interimResults !== false; // true par défaut
    recognition.maxAlternatives = 1;
    
    isContinuous = config.continuous || false;
    
    // Events
    recognition.onstart = () => {
      console.log('🎤 Listening...');
      isListening = true;
      setLogoListening(true);
    };
    
    recognition.onresult = (event) => {
      const last = event.results.length - 1;
      const result = event.results[last];
      const transcript = result[0].transcript;
      const isFinal = result.isFinal;
      
      console.log('📝 Transcript:', transcript, isFinal ? '(final)' : '(interim)');
      
      if (onResultCallback) {
        onResultCallback({
          transcript,
          isFinal,
          confidence: result[0].confidence
        });
      }
    };
    
    recognition.onerror = (event) => {
      console.error('❌ Recognition error:', event.error);
      isListening = false;
      setLogoListening(false);
      
      let errorMessage = 'Erreur de reconnaissance vocale';
      
      if (event.error === 'no-speech') {
        errorMessage = 'Aucune voix détectée';
      } else if (event.error === 'audio-capture') {
        errorMessage = 'Microphone non disponible';
      } else if (event.error === 'not-allowed') {
        errorMessage = 'Permission microphone refusée';
      }
      
      toast(errorMessage, 'error');
    };
    
    recognition.onend = () => {
      console.log('🛑 Recognition ended');
      isListening = false;
      setLogoListening(false);
      
      if (onEndCallback) {
        onEndCallback();
      }
      
      // Auto-restart si mode continu
      if (isContinuous && recognition) {
        setTimeout(() => {
          try {
            recognition.start();
          } catch (e) {
            // Ignore si déjà démarré
          }
        }, 100);
      }
    };
    
    console.log('✅ Speech Recognition initialized');
    return { success: true };
  } catch (error) {
    console.error('Init recognition error:', error);
    return { success: false, error: error.message };
  }
}

// ═══ START LISTENING ═══
export function startListening(callbacks = {}) {
  if (!recognition) {
    const init = initSpeechRecognition();
    if (!init.success) return init;
  }
  
  if (isListening) {
    console.warn('⚠️ Already listening');
    return { success: false, error: 'Already listening' };
  }
  
  try {
    onResultCallback = callbacks.onResult;
    onEndCallback = callbacks.onEnd;
    
    recognition.start();
    
    return { success: true };
  } catch (error) {
    console.error('Start listening error:', error);
    return { success: false, error: error.message };
  }
}

// ═══ STOP LISTENING ═══
export function stopListening() {
  if (!recognition || !isListening) {
    return { success: false, error: 'Not listening' };
  }
  
  try {
    recognition.stop();
    isContinuous = false;
    return { success: true };
  } catch (error) {
    console.error('Stop listening error:', error);
    return { success: false, error: error.message };
  }
}

// ═══ TOGGLE LISTENING ═══
export function toggleListening(callbacks = {}) {
  if (isListening) {
    return stopListening();
  } else {
    return startListening(callbacks);
  }
}

// ═══ START CONTINUOUS LISTENING ═══
export function startContinuousListening(callbacks = {}) {
  if (!recognition) {
    initSpeechRecognition({ continuous: true });
  } else {
    recognition.continuous = true;
  }
  
  isContinuous = true;
  return startListening(callbacks);
}

// ═══ STOP CONTINUOUS LISTENING ═══
export function stopContinuousListening() {
  isContinuous = false;
  return stopListening();
}

// ═══ IS LISTENING ═══
export function getIsListening() {
  return isListening;
}

// ═══ SET LANGUAGE ═══
export function setLanguage(lang) {
  if (recognition) {
    recognition.lang = lang;
  }
}

// ═══ CHECK BROWSER SUPPORT ═══
export function checkBrowserSupport() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  return !!SpeechRecognition;
}

// ═══ REQUEST MICROPHONE PERMISSION ═══
export async function requestMicrophonePermission() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(track => track.stop());
    return { success: true };
  } catch (error) {
    console.error('Microphone permission error:', error);
    
    let errorMessage = 'Permission microphone refusée';
    
    if (error.name === 'NotAllowedError') {
      errorMessage = 'Vous devez autoriser l\'accès au microphone';
    } else if (error.name === 'NotFoundError') {
      errorMessage = 'Aucun microphone trouvé';
    }
    
    toast(errorMessage, 'error');
    return { success: false, error: error.message };
  }
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

// ═══ LISTEN ONCE (Pour un seul message) ═══
export function listenOnce(callbacks = {}) {
  return new Promise((resolve, reject) => {
    let finalTranscript = '';
    
    startListening({
      onResult: (result) => {
        if (callbacks.onResult) {
          callbacks.onResult(result);
        }
        
        if (result.isFinal) {
          finalTranscript = result.transcript;
        }
      },
      onEnd: () => {
        if (callbacks.onEnd) {
          callbacks.onEnd();
        }
        
        if (finalTranscript) {
          resolve(finalTranscript);
        } else {
          reject(new Error('No speech detected'));
        }
      }
    });
  });
}

// ═══ GET AVAILABLE LANGUAGES ═══
export function getAvailableLanguages() {
  // Liste des langues couramment supportées
  return [
    { code: 'fr-FR', label: 'Français (France)' },
    { code: 'fr-CA', label: 'Français (Canada)' },
    { code: 'en-US', label: 'English (US)' },
    { code: 'en-GB', label: 'English (UK)' },
    { code: 'es-ES', label: 'Español' },
    { code: 'de-DE', label: 'Deutsch' },
    { code: 'it-IT', label: 'Italiano' },
    { code: 'pt-PT', label: 'Português' },
    { code: 'ru-RU', label: 'Русский' },
    { code: 'ja-JP', label: '日本語' },
    { code: 'zh-CN', label: '中文' }
  ];
}

export default {
  initSpeechRecognition,
  startListening,
  stopListening,
  toggleListening,
  startContinuousListening,
  stopContinuousListening,
  getIsListening,
  setLanguage,
  checkBrowserSupport,
  requestMicrophonePermission,
  listenOnce,
  getAvailableLanguages
};
