/* ═══ CHAT SESSION ═══ */
function initChatSession() {
  var prov = S.config.aiProvider || 'puter';
  if (window.EVAChatHandler) {
    window.EVAChatHandler.initChatHandler(Object.assign({aiProvider:prov}, S.config));
  }
  updateProviderLabel(prov);
  updateModelSelectUI();
}

/* ═══ VISION CAPABILITY ═══
   Retourne true si le provider + modèle actuel accepte les images.
   Les modèles locaux (qwen, eva) ne peuvent PAS analyser des images.
   Tous les providers cloud acceptent les images, SAUF gpt-3.5-turbo. */
function _providerSupportsVision(prov, modelId) {
  if (prov === 'eva' || prov === 'qwen') return false;
  if (prov === 'openai') {
    /* gpt-3.5-turbo ne supporte pas la vision */
    return !modelId || !modelId.includes('gpt-3.5');
  }
  /* puter (gpt-4o, gpt-4o-mini, claude), claude, lmstudio, ollama — vision OK */
  return true;
}
window._providerSupportsVision = _providerSupportsVision;

/* Met à jour le fileInput.accept et le titre du bouton selon les capacités vision */
function updateAttachCapabilities(prov, modelId) {
  var fi  = document.getElementById('fileInput');
  var btn = document.getElementById('attachBtn');
  if (!fi || !btn) return;

  var canPhoto = _providerSupportsVision(prov, modelId);
  var DOC_EXT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv';

  if (canPhoto) {
    fi.accept = 'image/*,' + DOC_EXT;
    btn.title = 'Joindre une image ou un document (PDF, Word, Excel, PowerPoint, CSV, TXT)';
    btn.setAttribute('data-vision', 'true');
  } else {
    fi.accept = DOC_EXT;
    btn.title = 'Joindre un document (PDF, Word, Excel…) — images non disponibles avec ce modèle';
    btn.setAttribute('data-vision', 'false');
  }
}
window.updateAttachCapabilities = updateAttachCapabilities;

function updateProviderLabel(p) {
  var labels = {eva:'E.V.A — Officiel Astral',puter:'Puter (Gratuit)',qwen:'Local Privé',openai:'OpenAI GPT',claude:'Claude',lmstudio:'LM Studio',ollama:'Ollama'};
  var el = document.getElementById('providerName');
  if (el) el.textContent = labels[p] || p;
  /* Bannière d'avertissement mode local */
  var banner = document.getElementById('localModeBanner');
  if (banner) banner.style.display = (p === 'qwen' || p === 'eva') ? 'flex' : 'none';
  /* Bouton pièce jointe — toujours actif (les documents fonctionnent partout) */
  var btn = document.getElementById('attachBtn');
  if (btn) { btn.disabled = false; btn.style.opacity = ''; btn.style.cursor = ''; }
  /* Mettre à jour les capacités d'attachement selon le modèle actif */
  var modelId = getActiveModel ? getActiveModel() : '';
  updateAttachCapabilities(p, modelId);
}

/* ═══════════════════════════════════════════════════
   GESTION MODÈLE PAR CONVERSATION
═══════════════════════════════════════════════════ */
var CONV_MODELS = {
  eva: [
    { id:'EVA-Expert', label:'EVA Expert — 3B · Meilleure qualité' },
    { id:'EVA-Rapide', label:'EVA Rapide — 1B · Ultra-rapide' }
  ],
  puter: [
    { id:'gpt-4o-mini', label:'GPT-4o Mini — Rapide' },
    { id:'gpt-4o', label:'GPT-4o — Expert' },
    { id:'claude-3-5-sonnet', label:'Claude 3.5 Sonnet' }
  ],
  openai: [
    { id:'gpt-4o-mini', label:'GPT-4o Mini — Rapide' },
    { id:'gpt-4o', label:'GPT-4o — Expert' },
    { id:'gpt-4-turbo', label:'GPT-4 Turbo' },
    { id:'gpt-3.5-turbo', label:'GPT-3.5 — Économique (sans vision)' }
  ],
  claude: [
    { id:'claude-3-5-haiku-20241022', label:'Haiku — Rapide' },
    { id:'claude-3-5-sonnet-20241022', label:'Sonnet — Expert' },
    { id:'claude-3-opus-20240229', label:'Opus — Ultra' }
  ],
  qwen: [
    { id:'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', label:'Qwen2.5 1.5B — Léger (~900 MB)' },
    { id:'Qwen2.5-3B-Instruct-q4f16_1-MLC',   label:'Qwen2.5 3B — Équilibré (~1.8 GB)' },
    { id:'Llama-3.2-3B-Instruct-q4f16_1-MLC', label:'Llama 3.2 3B — Recommandé (~1.8 GB)' },
    { id:'Phi-3.5-mini-instruct-q4f16_1-MLC', label:'Phi 3.5 Mini — Meilleur (~2.2 GB)' },
    { id:'Qwen2.5-7B-Instruct-q4f16_1-MLC',   label:'Qwen2.5 7B — Puissant (~4 GB)' }
  ]
};

function getActiveProvider() {
  return (S.conv && S.conv.provider) ? S.conv.provider : (S.config.aiProvider || 'puter');
}

function getActiveModel() {
  if (S.conv && S.conv.model) return S.conv.model;
  var prov = getActiveProvider();
  var mk = {eva:'evaModel',puter:'puterModel',openai:'openaiModel',claude:'claudeModel',qwen:'qwenModel'}[prov];
  var fromCfg = mk && S.config[mk];
  var models = CONV_MODELS[prov];
  return fromCfg || (models && models[0] && models[0].id) || '';
}
window.getActiveModel = getActiveModel;

/* Icônes par provider pour le dropdown modèle */
var MODEL_ICONS = {
  eva:'✨', puter:'🤖', openai:'🟢', claude:'🔷', qwen:'⚡', lmstudio:'🔧', ollama:'🦙'
};

function updateModelSelectUI() {
  var wrap    = document.getElementById('convModelWrap');
  var sel     = document.getElementById('convModelSelect'); // caché, pour compat
  var btn     = document.getElementById('convModelBtn');
  var iconEl  = document.getElementById('convModelIcon');
  var labelEl = document.getElementById('convModelLabel');
  var dropdown= document.getElementById('modelDropdown');
  if (!sel || !dropdown) return;
  var prov   = getActiveProvider();
  var models = CONV_MODELS[prov];
  if (!models || models.length === 0) {
    if (wrap) wrap.style.display = 'none';
    return;
  }
  if (wrap) wrap.style.display = '';
  var cur = getActiveModel();
  var icon = MODEL_ICONS[prov] || '🤖';

  /* Peupler le <select> caché */
  sel.innerHTML = models.map(function(m) {
    return '<option value="'+m.id+'"'+(m.id===cur?' selected':'')+'>'+m.label+'</option>';
  }).join('');

  /* Peupler le dropdown stylisé */
  dropdown.innerHTML = models.map(function(m) {
    var active = (m.id === cur);
    return '<button class="tone-option'+(active?' active':'')+'" data-model="'+m.id+'"'
      +' onclick="selectModelOption(this)" role="menuitem">'
      +'<span class="tone-opt-icon">'+icon+'</span>'
      +'<span class="tone-opt-label">'+m.label+'</span>'
      +'</button>';
  }).join('');

  /* Mettre à jour le bouton */
  var curModel = models.find(function(m){ return m.id === cur; }) || models[0];
  if (iconEl)  iconEl.textContent  = icon;
  if (labelEl) labelEl.textContent = curModel ? curModel.label : '';

  /* Mettre à jour les capacités d'attachement selon le modèle sélectionné */
  updateAttachCapabilities(prov, cur);
}

function selectModelOption(el) {
  var modelId = el.getAttribute('data-model');
  /* Mettre à jour l'UI du bouton */
  var dropdown = document.getElementById('modelDropdown');
  if (dropdown) {
    dropdown.querySelectorAll('.tone-option').forEach(function(b){ b.classList.remove('active'); });
    el.classList.add('active');
    var iconEl  = document.getElementById('convModelIcon');
    var labelEl = document.getElementById('convModelLabel');
    var prov    = getActiveProvider();
    if (iconEl)  iconEl.textContent  = MODEL_ICONS[prov] || '🤖';
    if (labelEl) labelEl.textContent = el.querySelector('.tone-opt-label').textContent;
  }
  /* Sync le <select> caché */
  var sel = document.getElementById('convModelSelect');
  if (sel) sel.value = modelId;
  /* Fermer le dropdown */
  var btn = document.getElementById('convModelBtn');
  if (btn) { btn.classList.remove('open'); btn.setAttribute('aria-expanded','false'); }
  dropdown.classList.remove('open');
  /* Appliquer le modèle */
  changeConvModel(modelId);
}
window.selectModelOption = selectModelOption;

function toggleModelMenu(e) {
  e.stopPropagation();
  var btn      = document.getElementById('convModelBtn');
  var dropdown = document.getElementById('modelDropdown');
  var isOpen   = btn.classList.contains('open');
  /* Fermer aussi le dropdown de ton si ouvert */
  var toneBtn  = document.getElementById('toneSelectBtn');
  var toneDd   = document.getElementById('toneDropdown');
  if (toneBtn) { toneBtn.classList.remove('open'); toneBtn.setAttribute('aria-expanded','false'); }
  if (toneDd)  toneDd.classList.remove('open');
  if (isOpen) {
    btn.classList.remove('open'); btn.setAttribute('aria-expanded','false');
    dropdown.classList.remove('open');
  } else {
    btn.classList.add('open'); btn.setAttribute('aria-expanded','true');
    dropdown.classList.add('open');
  }
}
window.toggleModelMenu = toggleModelMenu;

function changeConvModel(modelId) {
  if (!S.conv) S.conv = {};
  S.conv.model = modelId;
  var prov = getActiveProvider();
  var mk = {eva:'evaModel',puter:'puterModel',openai:'openaiModel',claude:'claudeModel',qwen:'qwenModel'}[prov];
  if (mk) S.config[mk] = modelId;
  if (window.EVAChatHandler) {
    window.EVAChatHandler.initChatHandler(Object.assign({aiProvider:prov},S.config));
  }
  /* Mettre à jour les capacités d'attachement pour le nouveau modèle */
  updateAttachCapabilities(prov, modelId);
  if (S.convId && S.user) {
    db.collection('users').doc(S.user.uid).collection('conversations').doc(S.convId)
      .update({ aiProvider: prov, aiModel: modelId }).catch(function(e){ console.warn('[CONV] model save:',e); });
    var c = S.convs.find(function(x){return x.id===S.convId;});
    if (c) { c.aiProvider = prov; c.aiModel = modelId; }
  }
}
window.changeConvModel = changeConvModel;
