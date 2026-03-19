/* ═══════════════════════════════════════════════════════════
   EVA V3 - SETTINGS-UI.JS
   Interface paramètres (modal Grok-like)
   ═══════════════════════════════════════════════════════════ */

import { getUserProfile, updateUserProfile } from '../core/auth.js';
import { AI_PROVIDERS, VOICE_PROVIDERS } from '../core/config.js';
import { toast } from '../core/utils.js';
import { getAvailableVoices, testVoice } from '../voice/tts.js';

let currentUser = null;
let currentSettings = null;

// ═══ INIT SETTINGS UI ═══
export async function initSettingsUI(user) {
  currentUser = user;
  
  setupSettingsNavigation();
  await loadUserSettings();
  
  console.log('✅ Settings UI initialized');
}

// ═══ SETUP SETTINGS NAVIGATION ═══
function setupSettingsNavigation() {
  const navItems = document.querySelectorAll('.settings-nav-item');
  
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      
      const section = item.getAttribute('data-section');
      showSettingsSection(section);
    });
  });
}

// ═══ SHOW SETTINGS SECTION ═══
function showSettingsSection(section) {
  const content = document.getElementById('settingsContent');
  if (!content) return;
  
  switch (section) {
    case 'account':
      content.innerHTML = renderAccountSection();
      break;
    case 'ai':
      content.innerHTML = renderAISection();
      break;
    case 'voice':
      content.innerHTML = renderVoiceSection();
      break;
    case 'dev':
      content.innerHTML = renderDevSection();
      break;
    default:
      content.innerHTML = '<p>Section non disponible</p>';
  }
  
  attachSectionEventListeners(section);
}

// ═══ LOAD USER SETTINGS ═══
async function loadUserSettings() {
  const result = await getUserProfile(currentUser.uid);
  
  if (result.success) {
    currentSettings = result.data;
    showSettingsSection('account'); // Show default section
  }
}

// ═══ RENDER ACCOUNT SECTION ═══
function renderAccountSection() {
  return `
    <div class="settings-section">
      <h3 class="settings-section-title">Compte utilisateur</h3>
      
      <div class="settings-field">
        <label class="settings-label">Nom complet</label>
        <input type="text" class="settings-input" id="settingsDisplayName" 
               value="${currentSettings?.displayName || ''}" placeholder="Jean Dupont">
      </div>
      
      <div class="settings-field">
        <label class="settings-label">Surnom</label>
        <input type="text" class="settings-input" id="settingsNickname" 
               value="${currentSettings?.nickname || ''}" placeholder="Jean">
        <p class="settings-description">Comment Eva doit vous appeler</p>
      </div>
      
      <div class="settings-field">
        <label class="settings-label">Email</label>
        <input type="email" class="settings-input" value="${currentUser.email}" disabled>
      </div>
      
      <button class="btn-primary" id="saveAccountBtn">Sauvegarder</button>
    </div>
  `;
}

// ═══ RENDER AI SECTION ═══
function renderAISection() {
  const currentProvider = currentSettings?.preferences?.aiProvider || 'qwen';
  
  return `
    <div class="settings-section">
      <h3 class="settings-section-title">Intelligence Artificielle</h3>
      
      <div class="settings-field">
        <label class="settings-label">Provider IA</label>
        <select class="settings-input" id="aiProviderSelect">
          ${Object.entries(AI_PROVIDERS).map(([key, provider]) => `
            <option value="${key}" ${key === currentProvider ? 'selected' : ''}>
              ${provider.name}
            </option>
          `).join('')}
        </select>
      </div>
      
      <div id="providerSettings"></div>
      
      <button class="btn-primary" id="saveAIBtn">Sauvegarder</button>
    </div>
  `;
}

// ═══ RENDER VOICE SECTION ═══
function renderVoiceSection() {
  const voices = getAvailableVoices();
  const currentVoice = currentSettings?.preferences?.selectedVoice || 'auto';
  
  return `
    <div class="settings-section">
      <h3 class="settings-section-title">Voix</h3>
      
      <div class="settings-field">
        <label class="settings-label">Voix française</label>
        <select class="settings-input" id="voiceSelect">
          <option value="auto" ${currentVoice === 'auto' ? 'selected' : ''}>
            Auto (Meilleure voix)
          </option>
          ${voices.map(voice => `
            <option value="${voice.name}" ${voice.name === currentVoice ? 'selected' : ''}>
              ${voice.name}
            </option>
          `).join('')}
        </select>
      </div>
      
      <div class="settings-field">
        <label class="settings-label">Vitesse</label>
        <input type="range" class="settings-range" id="speechRate" 
               min="0.5" max="2" step="0.1" 
               value="${currentSettings?.preferences?.speechRate || 1.0}">
        <span id="speechRateValue">${currentSettings?.preferences?.speechRate || 1.0}</span>
      </div>
      
      <button class="btn-outline" id="testVoiceBtn">🔊 Tester la voix</button>
      <button class="btn-primary" id="saveVoiceBtn">Sauvegarder</button>
    </div>
  `;
}

// ═══ RENDER DEV SECTION ═══
function renderDevSection() {
  return `
    <div class="settings-section">
      <h3 class="settings-section-title">Clé développeur</h3>
      
      <div class="settings-field">
        <label class="settings-label">Code d'accès</label>
        <input type="text" class="settings-input" id="devKeyInput" 
               placeholder="ASTRAL-XXXXX-XXXXX">
        <p class="settings-description">
          Saisissez votre clé développeur pour accéder aux fonctionnalités avancées
        </p>
      </div>
      
      <div id="devKeyStatus"></div>
      
      <button class="btn-primary" id="activateDevKeyBtn">Activer</button>
    </div>
  `;
}

// ═══ ATTACH SECTION EVENT LISTENERS ═══
function attachSectionEventListeners(section) {
  switch (section) {
    case 'account':
      document.getElementById('saveAccountBtn')?.addEventListener('click', saveAccountSettings);
      break;
    case 'ai':
      document.getElementById('saveAIBtn')?.addEventListener('click', saveAISettings);
      document.getElementById('aiProviderSelect')?.addEventListener('change', updateProviderSettings);
      break;
    case 'voice':
      document.getElementById('saveVoiceBtn')?.addEventListener('click', saveVoiceSettings);
      document.getElementById('testVoiceBtn')?.addEventListener('click', testCurrentVoice);
      
      const rateSlider = document.getElementById('speechRate');
      const rateValue = document.getElementById('speechRateValue');
      rateSlider?.addEventListener('input', (e) => {
        rateValue.textContent = e.target.value;
      });
      break;
    case 'dev':
      document.getElementById('activateDevKeyBtn')?.addEventListener('click', activateDevKey);
      break;
  }
}

// ═══ SAVE ACCOUNT SETTINGS ═══
async function saveAccountSettings() {
  const displayName = document.getElementById('settingsDisplayName').value;
  const nickname = document.getElementById('settingsNickname').value;
  
  const result = await updateUserProfile(currentUser.uid, {
    displayName,
    nickname
  });
  
  if (result.success) {
    currentSettings.displayName = displayName;
    currentSettings.nickname = nickname;
    
    // Update UI
    document.getElementById('userName').textContent = displayName;
    
    toast('Profil sauvegardé', 'success');
  }
}

// ═══ SAVE AI SETTINGS ═══
async function saveAISettings() {
  const provider = document.getElementById('aiProviderSelect').value;
  
  const result = await updateUserProfile(currentUser.uid, {
    'preferences.aiProvider': provider
  });
  
  if (result.success) {
    toast('Paramètres IA sauvegardés', 'success');
  }
}

// ═══ SAVE VOICE SETTINGS ═══
async function saveVoiceSettings() {
  const voice = document.getElementById('voiceSelect').value;
  const rate = parseFloat(document.getElementById('speechRate').value);
  
  const result = await updateUserProfile(currentUser.uid, {
    'preferences.selectedVoice': voice,
    'preferences.speechRate': rate
  });
  
  if (result.success) {
    toast('Paramètres voix sauvegardés', 'success');
  }
}

// ═══ TEST CURRENT VOICE ═══
function testCurrentVoice() {
  const voice = document.getElementById('voiceSelect').value;
  const rate = parseFloat(document.getElementById('speechRate').value);
  
  testVoice({ selectedVoice: voice, speechRate: rate });
}

// ═══ UPDATE PROVIDER SETTINGS ═══
function updateProviderSettings() {
  // Update UI based on selected provider
  const provider = document.getElementById('aiProviderSelect').value;
  const container = document.getElementById('providerSettings');
  
  // Add provider-specific settings here if needed
  container.innerHTML = '';
}

// ═══ ACTIVATE DEV KEY ═══
async function activateDevKey() {
  const key = document.getElementById('devKeyInput').value.trim();
  
  if (!key) {
    toast('Veuillez saisir une clé', 'error');
    return;
  }
  
  // Validate key against Firestore
  // Implementation in dev-keys.js
  toast('Fonctionnalité en cours d\'implémentation', 'info');
}

export default {
  initSettingsUI,
  showSettingsSection
};
