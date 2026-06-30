/* ═══════════════════════════════════════════════════════════
   EVA V4 - SETTINGS-UI.JS
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

// ═══ HELPERS — badges & sélecteurs ═══
function _tierBadge(tier) {
  const map = {
    free:  { label: 'GRATUIT',         bg: 'rgba(74,222,128,0.18)', fg: '#4ade80' },
    quota: { label: 'GRATUIT (quota)', bg: 'rgba(123,139,245,0.18)', fg: '#7b8bf5' },
    local: { label: 'LOCAL — gratuit illimité', bg: 'rgba(74,222,128,0.18)', fg: '#4ade80' },
    paid:  { label: 'PAYANT',          bg: 'rgba(255,170,0,0.18)',   fg: '#ffaa00' }
  };
  const b = map[tier] || map.quota;
  return `<span style="display:inline-block;padding:2px 8px;border-radius:6px;background:${b.bg};color:${b.fg};font-size:0.7em;font-weight:700;letter-spacing:0.5px;">${b.label}</span>`;
}

function _recommendedBadge() {
  return `<span style="display:inline-block;padding:2px 8px;border-radius:6px;background:rgba(123,139,245,0.25);color:#7b8bf5;font-size:0.7em;font-weight:700;letter-spacing:0.5px;margin-left:6px;">⭐ RECOMMANDÉ</span>`;
}

function _modelOptions(provider, currentModelId) {
  if (!provider.models || !provider.models.length) return '';
  return provider.models.map(m => {
    // Supporter ancien format (string) et nouveau (objet)
    if (typeof m === 'string') {
      return `<option value="${m}" ${m === currentModelId ? 'selected' : ''}>${m}</option>`;
    }
    const tag = m.tier === 'free'  ? ''
              : m.tier === 'paid'  ? ' — payant'
              : m.tier === 'local' ? ' — local'
              : ' — quota (limité)';
    return `<option value="${m.id}" ${m.id === currentModelId ? 'selected' : ''}>${m.label}${tag}</option>`;
  }).join('');
}

// ═══ RENDER AI SECTION ═══
function renderAISection() {
  const currentProvider = currentSettings?.preferences?.aiProvider || 'puter';

  const recommendedKeys = Object.keys(AI_PROVIDERS).filter(k => AI_PROVIDERS[k].recommended);
  const otherKeys       = Object.keys(AI_PROVIDERS).filter(k => !AI_PROVIDERS[k].recommended);

  function optionHtml(key) {
    const p = AI_PROVIDERS[key];
    const reco = AI_PROVIDERS[key].recommended ? '  ⭐ RECOMMANDÉ' : '';
    return `<option value="${key}" ${key === currentProvider ? 'selected' : ''}>${p.name}${reco}</option>`;
  }

  return `
    <div class="settings-section">
      <h3 class="settings-section-title">Intelligence Artificielle</h3>

      <div style="font-size:0.78em;color:#7b8bf5;margin-bottom:8px;padding:8px 12px;background:rgba(123,139,245,0.10);border:1px solid rgba(123,139,245,0.25);border-radius:8px;">
        ⭐ <strong>Recommandé pour démarrer :</strong> Puter Cloud — gratuit, sans clé API, accès à GPT-4o et Claude Sonnet via quota partagé.
      </div>

      <div class="settings-field">
        <label class="settings-label">Provider IA</label>
        <select class="settings-input" id="aiProviderSelect">
          <optgroup label="⭐ Recommandé">
            ${recommendedKeys.map(optionHtml).join('')}
          </optgroup>
          <optgroup label="Autres providers">
            ${otherKeys.map(optionHtml).join('')}
          </optgroup>
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
  const currentVoiceProvider = currentSettings?.preferences?.voiceProvider || 'piper';
  const currentVoice = currentSettings?.preferences?.selectedVoice || 'auto';

  const recommendedVoiceKeys = Object.keys(VOICE_PROVIDERS).filter(k => VOICE_PROVIDERS[k].recommended);
  const otherVoiceKeys       = Object.keys(VOICE_PROVIDERS).filter(k => !VOICE_PROVIDERS[k].recommended);

  function voiceOptHtml(key) {
    const p = VOICE_PROVIDERS[key];
    const reco = VOICE_PROVIDERS[key].recommended ? '  ⭐ RECOMMANDÉ' : '';
    return `<option value="${key}" ${key === currentVoiceProvider ? 'selected' : ''}>${p.name}${reco}</option>`;
  }

  return `
    <div class="settings-section">
      <h3 class="settings-section-title">Voix</h3>

      <div style="font-size:0.78em;color:#7b8bf5;margin-bottom:8px;padding:8px 12px;background:rgba(123,139,245,0.10);border:1px solid rgba(123,139,245,0.25);border-radius:8px;">
        ⭐ <strong>Recommandé pour démarrer :</strong> Piper TTS — voix française féminine neuronale, 100 % locale dans votre navigateur, sans clé API.
      </div>

      <div class="settings-field">
        <label class="settings-label">Moteur de voix</label>
        <select class="settings-input" id="voiceProviderSelect">
          <optgroup label="⭐ Recommandé">
            ${recommendedVoiceKeys.map(voiceOptHtml).join('')}
          </optgroup>
          <optgroup label="Autres moteurs">
            ${otherVoiceKeys.map(voiceOptHtml).join('')}
          </optgroup>
        </select>
      </div>

      <div id="voiceProviderSettings"></div>

      <div class="settings-field">
        <label class="settings-label">Voix navigateur (uniquement si moteur = Web Speech API)</label>
        <select class="settings-input" id="voiceSelect">
          <option value="auto" ${currentVoice === 'auto' ? 'selected' : ''}>Auto (Meilleure voix)</option>
          ${voices.map(voice => `
            <option value="${voice.name}" ${voice.name === currentVoice ? 'selected' : ''}>${voice.name}</option>
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

// ═══ RENDER PROVIDER PANEL (IA) ═══
function renderAIProviderPanel(providerKey) {
  const p = AI_PROVIDERS[providerKey];
  if (!p) return '';
  const currentModel =
    (providerKey === 'openai' && currentSettings?.openaiModel) ||
    (providerKey === 'claude' && currentSettings?.claudeModel) ||
    (providerKey === 'puter'  && currentSettings?.puterModel)  ||
    (providerKey === 'qwen'   && currentSettings?.qwenModel)   || '';

  const currentKey =
    (providerKey === 'openai' && (currentSettings?.openaiApiKey || '')) ||
    (providerKey === 'claude' && (currentSettings?.claudeApiKey || '')) || '';

  let html = '<div style="background:rgba(123,139,245,0.04);border:1px solid rgba(123,139,245,0.18);border-radius:12px;padding:14px 16px;margin:10px 0;">';

  // Header : nom + badges
  html += `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px;">`;
  html += `<strong style="font-size:0.95em;">${p.name}</strong>`;
  html += _tierBadge(p.tier);
  if (p.recommended) html += _recommendedBadge();
  html += `</div>`;

  html += `<div style="font-size:0.78em;color:var(--text-muted,#71717a);margin-bottom:10px;line-height:1.45;">${p.description}</div>`;

  if (p.quotaInfo) {
    html += `<div style="font-size:0.74em;color:var(--text-muted,#71717a);margin-bottom:10px;padding:8px 10px;background:rgba(255,255,255,0.02);border-radius:8px;"><strong>Quota :</strong> ${p.quotaInfo}</div>`;
  }

  // Clé API
  if (p.requiresApiKey) {
    html += `<div style="font-weight:600;font-size:0.8em;margin-bottom:6px;">Clé API</div>`;
    html += `<input type="password" autocomplete="off" class="settings-input" id="aiKeyInput" value="${currentKey}" placeholder="Coller votre clé ici" style="margin-bottom:8px;">`;

    if (p.apiKeyUrl) {
      html += `<div style="font-size:0.75em;margin-bottom:10px;">`;
      html += `<a href="${p.apiKeyUrl}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:5px;color:#7b8bf5;text-decoration:none;font-weight:600;padding:5px 10px;border:1px solid rgba(123,139,245,0.4);border-radius:6px;background:rgba(123,139,245,0.08);">`;
      html += `<span style="font-size:1.1em;">🔑</span> Obtenir ma clé gratuite sur Google AI Studio`;
      html += `</a>`;
      if (p.apiKeyHelp) {
        html += `<div style="margin-top:10px;padding:10px 12px;background:rgba(255,255,255,0.03);border-left:3px solid rgba(123,139,245,0.5);border-radius:0 6px 6px 0;color:var(--text-muted,#a1a1aa);">${p.apiKeyHelp}</div>`;
      }
      html += `</div>`;
    }
  }

  // Sélecteur de modèle
  if (p.models && p.models.length) {
    html += `<div style="font-weight:600;font-size:0.8em;margin-bottom:6px;">Modèle</div>`;
    html += `<select class="settings-input" id="aiModelSelect" style="margin-bottom:6px;">`;
    html += _modelOptions(p, currentModel || (p.models[0] && (p.models[0].id || p.models[0])));
    html += `</select>`;
    html += `<div style="font-size:0.72em;color:var(--text-muted,#71717a);margin-bottom:4px;">Astuce : le modèle <strong>rapide</strong> est sans quota gênant. Les modèles "expert/pro" ont un quota journalier — utilisez-les ponctuellement.</div>`;
  }

  html += '</div>';
  return html;
}

// ═══ RENDER PROVIDER PANEL (VOIX) ═══
function renderVoiceProviderPanel(providerKey) {
  const p = VOICE_PROVIDERS[providerKey];
  if (!p) return '';

  const currentPiperVoice = currentSettings?.piperVoice || 'fr_FR-siwis-medium';

  let html = '<div style="background:rgba(123,139,245,0.04);border:1px solid rgba(123,139,245,0.18);border-radius:12px;padding:14px 16px;margin:10px 0;">';

  html += `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px;">`;
  html += `<strong style="font-size:0.95em;">${p.name}</strong>`;
  html += _tierBadge(p.tier);
  if (p.recommended) html += _recommendedBadge();
  html += `</div>`;

  html += `<div style="font-size:0.78em;color:var(--text-muted,#71717a);margin-bottom:10px;line-height:1.45;">${p.description}</div>`;

  if (p.quotaInfo) {
    html += `<div style="font-size:0.74em;color:var(--text-muted,#71717a);margin-bottom:10px;padding:8px 10px;background:rgba(255,255,255,0.02);border-radius:8px;"><strong>Quota :</strong> ${p.quotaInfo}</div>`;
  }

  if (providerKey === 'piper') {
    html += `<div style="font-size:0.74em;color:var(--text-muted,#a1a1aa);margin-bottom:10px;padding:10px 12px;background:rgba(255,255,255,0.03);border-left:3px solid rgba(123,139,245,0.5);border-radius:0 6px 6px 0;">
      <strong>100 % local — aucune clé requise.</strong><br>
      Au premier usage, le navigateur télécharge le modèle français (~63 Mo) et le met en cache.
      Les fois suivantes, tout est instantané, et ça fonctionne même hors-ligne.
    </div>`;
    html += `<div style="font-weight:600;font-size:0.8em;margin-bottom:6px;">Voix</div>`;
    html += `<select class="settings-input" id="voiceModelSelect" style="margin-bottom:6px;">`;
    (p.voices || []).forEach(v => {
      const id = typeof v === 'string' ? v : v.id;
      const label = typeof v === 'string' ? v : v.label;
      html += `<option value="${id}" ${id === currentPiperVoice ? 'selected' : ''}>${label}</option>`;
    });
    html += `</select>`;
  } else if (p.requiresApiKey && p.apiKeyUrl) {
    html += `<div style="font-size:0.75em;margin-bottom:10px;">`;
    html += `<a href="${p.apiKeyUrl}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:5px;color:#7b8bf5;text-decoration:none;font-weight:600;padding:5px 10px;border:1px solid rgba(123,139,245,0.4);border-radius:6px;background:rgba(123,139,245,0.08);">`;
    html += `<span style="font-size:1.1em;">🔑</span> Obtenir ma clé API`;
    html += `</a>`;
    if (p.apiKeyHelp) {
      html += `<div style="margin-top:10px;padding:10px 12px;background:rgba(255,255,255,0.03);border-left:3px solid rgba(123,139,245,0.5);border-radius:0 6px 6px 0;color:var(--text-muted,#a1a1aa);">${p.apiKeyHelp}</div>`;
    }
    html += `</div>`;
  }

  html += '</div>';
  return html;
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
    case 'ai': {
      document.getElementById('saveAIBtn')?.addEventListener('click', saveAISettings);
      const sel = document.getElementById('aiProviderSelect');
      sel?.addEventListener('change', updateProviderSettings);
      // Afficher tout de suite le panneau du provider courant
      if (sel) updateProviderSettings();
      break;
    }
    case 'voice': {
      document.getElementById('saveVoiceBtn')?.addEventListener('click', saveVoiceSettings);
      document.getElementById('testVoiceBtn')?.addEventListener('click', testCurrentVoice);
      const vsel = document.getElementById('voiceProviderSelect');
      vsel?.addEventListener('change', updateVoiceProviderSettings);
      if (vsel) updateVoiceProviderSettings();

      const rateSlider = document.getElementById('speechRate');
      const rateValue = document.getElementById('speechRateValue');
      rateSlider?.addEventListener('input', (e) => {
        rateValue.textContent = e.target.value;
      });
      break;
    }
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
  const meta = AI_PROVIDERS[provider] || {};
  const apiKey = (document.getElementById('aiKeyInput')?.value || '').trim();
  const model  = document.getElementById('aiModelSelect')?.value || '';

  const update = { 'preferences.aiProvider': provider };

  // Modèle (champ par provider — on garde la convention existante)
  if (model) {
    if (provider === 'openai') update.openaiModel = model;
    else if (provider === 'claude') update.claudeModel = model;
    else if (provider === 'puter')  update.puterModel  = model;
    else if (provider === 'qwen')   update.qwenModel   = model;
  }

  // Clé API
  if (apiKey && meta.requiresApiKey) {
    if (provider === 'openai') update.openaiApiKey = apiKey;
    else if (provider === 'claude')   update.claudeApiKey = apiKey;
  }

  const result = await updateUserProfile(currentUser.uid, update);
  if (result.success) toast('Paramètres IA sauvegardés', 'success');
}

// ═══ SAVE VOICE SETTINGS ═══
async function saveVoiceSettings() {
  const provider = document.getElementById('voiceProviderSelect')?.value
                || currentSettings?.preferences?.voiceProvider || 'piper';
  const voice = document.getElementById('voiceSelect')?.value || 'auto';
  const rate  = parseFloat(document.getElementById('speechRate')?.value || '1');

  const update = {
    'preferences.voiceProvider': provider,
    'preferences.selectedVoice': voice,
    'preferences.speechRate': rate
  };

  if (provider === 'piper') {
    const v = document.getElementById('voiceModelSelect')?.value || 'fr_FR-siwis-medium';
    update.piperVoice = v;
    // Préchauffage : télécharge et initialise le modèle Piper en arrière-plan
    if (window.PiperTTS && window.PiperTTS.warmup) {
      window.PiperTTS.warmup({ piperVoice: v });
    }
  }

  const result = await updateUserProfile(currentUser.uid, update);
  if (result.success) toast('Paramètres voix sauvegardés', 'success');
}

// ═══ TEST CURRENT VOICE ═══
function testCurrentVoice() {
  const voice = document.getElementById('voiceSelect')?.value || 'auto';
  const rate  = parseFloat(document.getElementById('speechRate')?.value || '1');
  testVoice({ selectedVoice: voice, speechRate: rate });
}

// ═══ UPDATE PROVIDER SETTINGS PANELS ═══
function updateProviderSettings() {
  const provider = document.getElementById('aiProviderSelect').value;
  const container = document.getElementById('providerSettings');
  if (!container) return;
  container.innerHTML = renderAIProviderPanel(provider);
}

function updateVoiceProviderSettings() {
  const provider = document.getElementById('voiceProviderSelect').value;
  const container = document.getElementById('voiceProviderSettings');
  if (!container) return;
  container.innerHTML = renderVoiceProviderPanel(provider);
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
