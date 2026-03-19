/* ═══════════════════════════════════════════════════════════
   EVA V3 - TTS.JS
   Text-to-Speech avec Microsoft Denise (voix féminine française)
   ═══════════════════════════════════════════════════════════ */

import { PREFERRED_FRENCH_VOICES } from '../core/config.js';
import { toast } from '../core/utils.js';

// Variables globales
let currentAudio = null;
let isMuted = false;
let availableVoices = [];

// ═══ INIT VOICES ═══
export function initVoices() {
  // Charger les voix disponibles
  availableVoices = speechSynthesis.getVoices();
  
  // iOS Safari needs this
  if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = () => {
      availableVoices = speechSynthesis.getVoices();
    };
  }
}

// ═══ GET AVAILABLE VOICES ═══
export function getAvailableVoices(lang = 'fr-FR') {
  const voices = speechSynthesis.getVoices();
  return voices.filter(voice => voice.lang.startsWith(lang.split('-')[0]));
}

// ═══ GET BEST FRENCH VOICE ═══
export function getBestFrenchVoice() {
  const voices = speechSynthesis.getVoices();
  
  // Chercher la meilleure voix dans l'ordre de préférence
  for (const preferred of PREFERRED_FRENCH_VOICES) {
    const voice = voices.find(v => 
      v.name.includes(preferred) || v.name === preferred
    );
    if (voice) {
      console.log('🎤 Voix sélectionnée:', voice.name);
      return voice;
    }
  }
  
  // Fallback: n'importe quelle voix française
  const frenchVoice = voices.find(v => v.lang.startsWith('fr'));
  if (frenchVoice) {
    console.log('🎤 Voix française fallback:', frenchVoice.name);
    return frenchVoice;
  }
  
  console.warn('⚠️ Aucune voix française trouvée');
  return null;
}

// ═══ GET VOICE BY NAME ═══
export function getVoiceByName(name) {
  const voices = speechSynthesis.getVoices();
  return voices.find(v => v.name === name);
}

// ═══ SPEAK (Web Speech API) ═══
export function speak(text, config = {}) {
  return new Promise((resolve, reject) => {
    if (isMuted) {
      resolve();
      return;
    }
    
    // Arrêter toute synthèse en cours
    stop();
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Sélectionner la voix
    let voice = null;
    if (config.selectedVoice && config.selectedVoice !== 'auto') {
      voice = getVoiceByName(config.selectedVoice);
    }
    
    if (!voice) {
      voice = getBestFrenchVoice();
    }
    
    if (voice) {
      utterance.voice = voice;
    }
    
    // Configuration
    utterance.lang = config.voiceLang || 'fr-FR';
    utterance.rate = config.speechRate || 1.0;
    utterance.pitch = config.speechPitch || 1.0;
    utterance.volume = 1.0;
    
    // Events
    utterance.onstart = () => {
      console.log('🗣️ Speaking:', text.substring(0, 50) + '...');
      setLogoSpeaking(true);
    };
    
    utterance.onend = () => {
      console.log('✅ Speech ended');
      setLogoSpeaking(false);
      resolve();
    };
    
    utterance.onerror = (error) => {
      console.error('❌ Speech error:', error);
      setLogoSpeaking(false);
      reject(error);
    };
    
    // Speak
    speechSynthesis.speak(utterance);
  });
}

// ═══ SPEAK WITH PUTER ═══
export async function speakWithPuter(text, config = {}) {
  if (typeof puter === 'undefined') {
    throw new Error('Puter not loaded');
  }
  
  try {
    setLogoSpeaking(true);
    
    const voice = config.puterVoice || 'nova';
    
    const audio = await puter.ai.txt2speech(text, {
      provider: 'openai',
      model: 'tts-1',
      voice
    });
    
    // Create audio element
    const blob = audio instanceof Blob ? audio : new Blob([audio], { type: 'audio/mpeg' });
    const url = URL.createObjectURL(blob);
    
    currentAudio = new Audio(url);
    
    currentAudio.onplay = () => {
      console.log('🗣️ Playing Puter TTS');
    };
    
    currentAudio.onended = () => {
      console.log('✅ Puter TTS ended');
      setLogoSpeaking(false);
      URL.revokeObjectURL(url);
    };
    
    currentAudio.onerror = (error) => {
      console.error('❌ Puter TTS error:', error);
      setLogoSpeaking(false);
      URL.revokeObjectURL(url);
    };
    
    await currentAudio.play();
  } catch (error) {
    setLogoSpeaking(false);
    throw error;
  }
}

// ═══ SPEAK (Main function) ═══
export async function speakText(text, config = {}) {
  try {
    const provider = config.voiceProvider || 'native';
    
    if (provider === 'puter' && typeof puter !== 'undefined') {
      await speakWithPuter(text, config);
    } else {
      // Fallback to native
      await speak(text, config);
    }
  } catch (error) {
    console.error('Speech error:', error);
    toast('Erreur de synthèse vocale', 'error');
    
    // Try fallback to native if Puter failed
    if (config.voiceProvider === 'puter') {
      try {
        await speak(text, { ...config, voiceProvider: 'native' });
      } catch (fallbackError) {
        console.error('Fallback speech error:', fallbackError);
      }
    }
  }
}

// ═══ STOP ═══
export function stop() {
  // Stop Web Speech API
  if (speechSynthesis.speaking) {
    speechSynthesis.cancel();
  }
  
  // Stop audio player (Puter)
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }
  
  setLogoSpeaking(false);
}

// ═══ PAUSE / RESUME ═══
export function pause() {
  if (speechSynthesis.speaking && !speechSynthesis.paused) {
    speechSynthesis.pause();
  }
  
  if (currentAudio && !currentAudio.paused) {
    currentAudio.pause();
  }
}

export function resume() {
  if (speechSynthesis.paused) {
    speechSynthesis.resume();
  }
  
  if (currentAudio && currentAudio.paused) {
    currentAudio.play();
  }
}

// ═══ MUTE / UNMUTE ═══
export function mute() {
  isMuted = true;
  stop();
}

export function unmute() {
  isMuted = false;
}

export function toggleMute() {
  isMuted = !isMuted;
  if (isMuted) {
    stop();
  }
  return isMuted;
}

export function isSpeaking() {
  return speechSynthesis.speaking || (currentAudio && !currentAudio.paused);
}

// ═══ SET LOGO SPEAKING STATE ═══
function setLogoSpeaking(speaking) {
  const logo = document.getElementById('evaLogo');
  const statusDot = document.getElementById('statusDot');
  
  if (speaking) {
    logo?.classList.add('speaking');
    statusDot?.classList.add('speaking');
  } else {
    logo?.classList.remove('speaking');
    statusDot?.classList.remove('speaking');
  }
}

// ═══ TEST VOICE ═══
export async function testVoice(config = {}) {
  const testText = "Bonjour ! Je suis Eva, votre assistante virtuelle. Comment puis-je vous aider aujourd'hui ?";
  
  try {
    await speakText(testText, config);
    toast('Test vocal réussi', 'success');
  } catch (error) {
    console.error('Voice test error:', error);
    toast('Erreur lors du test vocal', 'error');
  }
}

// Init on load
if (typeof window !== 'undefined') {
  window.addEventListener('load', initVoices);
  initVoices();
}

export default {
  initVoices,
  getAvailableVoices,
  getBestFrenchVoice,
  getVoiceByName,
  speak,
  speakWithPuter,
  speakText,
  stop,
  pause,
  resume,
  mute,
  unmute,
  toggleMute,
  isSpeaking,
  testVoice
};
