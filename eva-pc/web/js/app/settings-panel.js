/* ═══════════════════════════════════════════════════
   SETTINGS
═══════════════════════════════════════════════════ */
function openSettings(section) {
  var sec = section || 'profile';
  document.getElementById('settingsModal').classList.add('open');
  document.querySelectorAll('.settings-nav').forEach(function(n){
    n.classList.toggle('active', n.dataset.section === sec);
  });
  if (S.profile) renderUserUI(S.profile);
  renderSettings(sec);
  pushRoute('/chat/settings/' + sec);
}
window.openSettings = openSettings;

function closeSettings() {
  document.getElementById('settingsModal').classList.remove('open');
  var view = window._currentView || 'chat';
  pushRoute(view === 'chat' ? '/chat' : '/chat/' + view);
}

function renderSettings(section) {
  var c = document.getElementById('settingsContent');
  if (!c) return;
  var p = S.profile || {};
  var cfg = S.config;

  if (section === 'profile') {
    var roleLabels = {creator:'👑 Créateur',developer:'⚙️ Développeur',creator_wife:'💎 Épouse du créateur',user:'👤 Utilisateur'};
    var _pInitials = (p.displayName||'?').split(' ').map(function(n){return n[0]||'';}).join('').toUpperCase().slice(0,2)||'?';
    var _pPhoto = p.photoURL || '';
    c.innerHTML =
      '<div class="settings-section">' +
      '<div class="settings-section-title">Profil Utilisateur</div>' +
      /* ── Photo de profil ── */
      '<div class="settings-ava-wrap">' +
      '<div class="settings-ava" id="sAvaPreview" onclick="document.getElementById(\'sAvaFile\').click()" title="Cliquer pour changer la photo">' +
      (_pPhoto ? '<img src="'+_pPhoto+'" alt="Photo de profil">' : '<span id="sAvaInitials">'+_pInitials+'</span>') +
      '<div class="settings-ava-overlay">CHANGER</div>' +
      '</div>' +
      '<input type="file" id="sAvaFile" accept="image/*" style="display:none" onchange="_settingsHandleAvaFile(event)">' +
      '<div class="settings-ava-hint">Cliquer pour changer la photo de profil</div>' +
      '<div class="settings-ava-actions">' +
      '<button class="btn btn-secondary" style="font-size:0.73em;padding:4px 12px;" onclick="document.getElementById(\'sAvaFile\').click()">Choisir une photo</button>' +
      (_pPhoto ? '<button class="btn btn-secondary" style="font-size:0.73em;padding:4px 12px;border-color:rgba(239,68,68,0.4);color:#ef4444;" onclick="_settingsRemovePhoto()">Supprimer</button>' : '') +
      '</div>' +
      '</div>' +
      '<div class="form-field"><label class="form-label">Nom affiché</label>' +
      '<input type="text" class="form-input" id="sDisplayName" value="'+esc(p.displayName||'')+'" placeholder="Votre nom complet" oninput="_settingsUpdateInitials()"></div>' +
      '<div class="form-field"><label class="form-label">Surnom</label>' +
      '<input type="text" class="form-input" id="sNickname" value="'+esc(p.nickname||'')+'" placeholder="Comment EVA vous appellera — ex: Alex, Sofia...">' +
      '<div style="font-size:0.7em;color:var(--text-muted);margin-top:4px">EVA utilisera ce surnom dans ses réponses pour une expérience personnalisée.</div></div>' +
      '<div class="form-field"><label class="form-label">Bio / Contexte personnel</label>' +
      '<textarea class="form-textarea" id="sBio" placeholder="Dites à EVA qui vous êtes : vos intérêts, votre profession, vos préférences... Elle s\'en souviendra." style="min-height:80px">'+esc(p.bio||'')+'</textarea></div>' +
      '<div class="form-field"><label class="form-label">Langue préférée</label>' +
      '<select class="form-select" id="sLang">' +
      '<option value="fr"'+((!p.lang||p.lang==='fr')?' selected':'')+'>🇫🇷 Français</option>' +
      '<option value="en"'+(p.lang==='en'?' selected':'')+'>🇬🇧 English</option>' +
      '<option value="es"'+(p.lang==='es'?' selected':'')+'>🇪🇸 Español</option>' +
      '</select></div>' +
      '<div class="settings-row mobile-stack" style="padding:10px 0;border-top:1px solid var(--border);margin-top:8px">' +
      '<div><div class="settings-row-label">Email</div><div style="font-size:0.76em;color:var(--text-muted);word-break:break-all">'+esc((S.user&&S.user.email)||'—')+'</div></div>' +
      '<div><div class="settings-row-label">Rôle</div>' + (function(){
        var dLabel = p.devKeyLabel || null;
        var dColor = p.devKeyColor || null;
        var dEmoji = p.devKeyEmoji || null;
        if (dLabel && dColor) {
          var lt = (dEmoji ? dEmoji + ' ' : '') + dLabel;
          return '<div style="margin-top:3px;display:inline-flex;align-items:center;border:1.5px solid '+dColor+';color:'+dColor+';border-radius:20px;padding:1px 10px 2px 8px;font-size:0.78em;font-weight:700;letter-spacing:0.03em;box-shadow:0 0 7px '+dColor+'44;white-space:nowrap;">'+esc(lt)+'</div>';
        } else if (dLabel && dEmoji) {
          return '<div style="font-size:0.78em;color:var(--cyan)">'+esc(dEmoji+' '+dLabel)+'</div>';
        }
        return '<div style="font-size:0.78em;color:var(--cyan)">'+esc(roleLabels[(p.role||'user').toLowerCase()]||dLabel||p.role||roleLabels.user)+'</div>';
      })() + '</div>' +
      '</div>' +
      '<div class="settings-row" style="padding:10px 0;border-top:1px solid var(--border)">' +
      '<div><div class="settings-row-label" style="display:flex;align-items:center;gap:6px;">🔮 Orbe E.V.A <span style="font-size:0.68em;background:linear-gradient(135deg,#b08a5a,#e8c490);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;font-weight:700;letter-spacing:1px;">AVATAR</span></div><div class="settings-row-sub">Active l\'orbe holographique d\'E.V.A visible à droite du chat. Désactiver libère des ressources sur les appareils moins puissants.</div></div>' +
      '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;"><input type="checkbox" id="sEvaPanel"'+(S.config.showEvaPanel!==false?' checked':'')+' style="accent-color:var(--cyan);width:16px;height:16px;" onchange="toggleEvaPanelSetting(this.checked)"> <span style="font-size:0.78em;color:var(--text-muted)">Activé</span></label>' +
      '</div>' +
      '</div>' +
      '<div style="display:flex;gap:8px"><button class="btn btn-primary" onclick="saveProfileSettings()">Sauvegarder le profil</button></div>';

  } else if (section === 'appearance') {
    c.innerHTML =
      '<div class="settings-section">' +
      '<div class="settings-section-title">Apparence</div>' +
      '<div style="padding:16px;background:var(--surface2);border-radius:12px;border:1px solid var(--border);display:flex;align-items:center;gap:14px;">' +
      '<div style="font-size:2em;">🌙</div>' +
      '<div>' +
      '<div style="font-size:0.82em;font-weight:700;color:var(--text);margin-bottom:4px;">Mode sombre</div>' +
      '<div style="font-size:0.7em;color:var(--text-muted);">E.V.A utilise un thème sombre optimisé pour réduire la fatigue visuelle.</div>' +
      '</div>' +
      '</div>' +
      '</div>';

  } else if (section === 'ai') {
    var cur = cfg.aiProvider || 'pollinations';
    var provDefs = {
      eva:      { label:'E.V.A', icon:'', tag:'LOCAL', tagColor:'#a855f7', desc:'Modèles officiels E.V.A par Astral Technologie. 100% local, 100% privé. Propulsé par WebLLM — téléchargement automatique et mise en cache navigateur.', models:[{id:'EVA-Expert',label:'EVA Expert — 3B · Meilleure qualité'},{id:'EVA-Rapide',label:'EVA Rapide — 1B · Ultra-rapide'}], modelKey:'evaModel' },
      puter:    { label:'Puter Cloud', icon:'☁️', tag:'GRATUIT', tagColor:'#06b6d4', desc:'Accès gratuit via Puter.com. Modèles GPT-4o disponibles. Quota : ~50 à 100 messages par jour et par compte.', models:[{id:'gpt-4o-mini',label:'GPT-4o Mini — Rapide'},{id:'gpt-4o',label:'GPT-4o — Expert'}], modelKey:'puterModel' },
      pollinations: { label:'Pollinations', icon:'🌸', tag:'GRATUIT', tagColor:'#06b6d4', desc:'100% gratuit, sans compte ni clé API. Accès à GPT-4o, Gemini, DeepSeek, Llama. Quota : 1 message toutes les 10 secondes environ.', models:[{id:'openai',label:'GPT-4o Mini — Rapide'},{id:'openai-large',label:'GPT-4o — Expert'},{id:'mistral',label:'Mistral Nemo — Puissant'},{id:'llama',label:'Llama 3.3 70B — Open Source'},{id:'deepseek',label:'DeepSeek-V3 — Très performant'},{id:'gemini',label:'Gemini Flash 2.0 — Google'},{id:'gemini-thinking',label:'Gemini 2.0 Thinking — Raisonnement'}], modelKey:'pollinationsModel' },
      openai:   { label:'OpenAI',      icon:'🤖', tag:'PAYANT',  tagColor:'#10b981', desc:'GPT-4o, GPT-4 Turbo. Nécessite une clé API OpenAI. Supporte la vision (analyse d\'images).', models:[{id:'gpt-4o-mini',label:'GPT-4o Mini — Rapide'},{id:'gpt-4o',label:'GPT-4o — Expert'},{id:'gpt-4-turbo',label:'GPT-4 Turbo — Puissant'},{id:'gpt-3.5-turbo',label:'GPT-3.5 Turbo — Économique'}], modelKey:'openaiModel' },
      claude:   { label:'Claude',      icon:'🧠', tag:'PAYANT',  tagColor:'#10b981', desc:'Claude Haiku et Opus d\'Anthropic. Excellent pour le raisonnement et l\'analyse. Supporte la vision.', models:[{id:'claude-3-5-haiku-20241022',label:'Haiku — Rapide'},{id:'claude-3-opus-20240229',label:'Opus — Ultra'}], modelKey:'claudeModel' },
      qwen:     { label:'Local Privé', icon:'🖥️', tag:'LOCAL',   tagColor:'#f59e0b', desc:'Modèle IA local, 100% privé. Fonctionne sans internet. Analyse d\'images via Puter (connexion requise pour la vision). ⚠️ Performances limitées selon le modèle choisi.', models:[{id:'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',label:'Qwen2.5 1.5B — Léger (~900 MB)'},{id:'Qwen2.5-3B-Instruct-q4f16_1-MLC',label:'Qwen2.5 3B — Équilibré (~1.8 GB)'},{id:'Llama-3.2-3B-Instruct-q4f16_1-MLC',label:'Llama 3.2 3B — Recommandé (~1.8 GB)'},{id:'Phi-3.5-mini-instruct-q4f16_1-MLC',label:'Phi 3.5 Mini — Meilleur (~2.2 GB)'},{id:'Qwen2.5-7B-Instruct-q4f16_1-MLC',label:'Qwen2.5 7B — Puissant (~4 GB)'}], modelKey:'qwenModel' },
      lmstudio: { label:'LM Studio',  icon:'💻', tag:'LOCAL',   tagColor:'#f59e0b', desc:'Serveur local via LM Studio. Nécessite LM Studio installé sur votre machine.', models:[], modelKey:'customModel' },
      ollama:   { label:'Ollama',      icon:'🦙', tag:'LOCAL',   tagColor:'#f59e0b', desc:'Serveur local Ollama. Complètement privé, fonctionne sans internet.', models:[], modelKey:'ollamaModel' }
    };
    var curDef = provDefs[cur] || provDefs.puter;
    var curModel = cfg[curDef.modelKey] || (curDef.models[0] && curDef.models[0].id) || '';

    function buildModelOpts(provKey, selModel) {
      var def = provDefs[provKey]; if (!def || !def.models.length) return '';
      return def.models.map(function(m){ return '<option value="'+m.id+'"'+(m.id===selModel?' selected':'')+'>'+m.label+'</option>'; }).join('');
    }

    function cardStyle(key) {
      var active = key === cur;
      return 'cursor:pointer;border-radius:14px;padding:16px 14px;border:2px solid '+(active?'var(--cyan)':'rgba(255,255,255,0.08)')+';background:'+(active?'rgba(0,220,220,0.07)':'rgba(255,255,255,0.02)')+';transition:all 0.2s;text-align:center;position:relative;';
    }
    function tagBadge(d) {
      return '<span style="font-size:0.55em;font-weight:700;letter-spacing:0.06em;background:'+d.tagColor+';color:#000;border-radius:4px;padding:2px 6px;position:absolute;top:10px;right:10px;">'+d.tag+'</span>';
    }
    function checkMark(key) {
      return cur===key ? '<div style="position:absolute;top:10px;left:10px;color:var(--cyan);font-size:0.9em;">✓</div>' : '';
    }

    c.innerHTML =
      '<div class="settings-section">' +
      '<div class="settings-section-title">Intelligence Artificielle</div>' +

      /* Hidden input — lu par saveAISettings() */
      '<input type="hidden" id="sProvider" value="'+cur+'">' +

      /* === RECOMMANDÉS === */
      '<div style="font-size:0.65em;color:var(--text-muted);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:10px;">⭐ Recommandés</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(128px,1fr));gap:12px;margin-bottom:20px;">' +

      /* Pollinations card — EN PREMIER, badge DÉFAUT */
      '<div id="aicard-pollinations" style="'+cardStyle('pollinations')+'" onclick="window._selectAIProv(\'pollinations\')">' +
        checkMark('pollinations') +
        '<span style="font-size:0.5em;font-weight:800;letter-spacing:0.05em;background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;border-radius:4px;padding:2px 7px;position:absolute;top:10px;right:10px;">DÉFAUT</span>' +
        '<div style="font-size:1.6em;margin-bottom:6px;">🌸</div>' +
        '<div style="font-weight:700;font-size:0.85em;margin-bottom:4px;">Pollinations</div>' +
        '<div style="font-size:0.65em;color:var(--text-muted);line-height:1.4;">Sans compte ni clé<br>Gratuit · Multi-modèles<br>1 msg / 10 sec.</div>' +
      '</div>' +

      /* E.V.A card — officiel Astral */
      '<div id="aicard-eva" style="'+cardStyle('eva')+'" onclick="window._selectAIProv(\'eva\')">' +
        checkMark('eva') +
        '<span style="font-size:0.55em;font-weight:700;letter-spacing:0.06em;background:#a855f7;color:#fff;border-radius:4px;padding:2px 6px;position:absolute;top:10px;right:10px;">LOCAL</span>' +
        '<div style="margin-bottom:6px;display:flex;align-items:center;justify-content:center;"><img src="/assets/images/eva-logo.png" alt="E.V.A" style="height:32px;width:auto;object-fit:contain;" onerror="this.style.display=\'none\';this.nextSibling.style.display=\'block\'"><span style="display:none;font-size:1.5em;">🌌</span></div>' +
        '<div style="font-weight:700;font-size:0.85em;margin-bottom:4px;">E.V.A</div>' +
        '<div style="font-size:0.68em;color:var(--text-muted);line-height:1.4;">Officiel Astral<br>100% local · Privé<br>Cache navigateur</div>' +
      '</div>' +

      /* Puter card */
      '<div id="aicard-puter" style="'+cardStyle('puter')+'" onclick="window._selectAIProv(\'puter\')">' +
        checkMark('puter') + tagBadge(provDefs.puter) +
        '<div style="font-size:1.6em;margin-bottom:6px;">☁️</div>' +
        '<div style="font-weight:700;font-size:0.85em;margin-bottom:4px;">Puter Cloud</div>' +
        '<div style="font-size:0.68em;color:var(--text-muted);line-height:1.4;">Gratuit avec connexion<br>~50 à 100 msgs / jour<br>GPT-4o disponible</div>' +
      '</div>' +

      /* Local card */
      '<div id="aicard-qwen" style="'+cardStyle('qwen')+'" onclick="window._selectAIProv(\'qwen\')">' +
        checkMark('qwen') + tagBadge(provDefs.qwen) +
        '<div style="font-size:1.6em;margin-bottom:6px;">🖥️</div>' +
        '<div style="font-weight:700;font-size:0.85em;margin-bottom:4px;">Local Privé</div>' +
        '<div style="font-size:0.68em;color:var(--text-muted);line-height:1.4;">100% privé · Offline<br>Téléchargement requis<br>Performances limitées</div>' +
      '</div>' +
      '</div>' +

      /* === AUTRES FOURNISSEURS === */
      '<div style="font-size:0.65em;color:var(--text-muted);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:10px;">Autres fournisseurs</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(128px,1fr));gap:10px;margin-bottom:20px;">' +

      /* OpenAI */
      '<div id="aicard-openai" style="'+cardStyle('openai')+'" onclick="window._selectAIProv(\'openai\')">' +
        checkMark('openai') + tagBadge(provDefs.openai) +
        '<div style="font-size:1.3em;margin-bottom:5px;">🤖</div>' +
        '<div style="font-weight:700;font-size:0.8em;margin-bottom:3px;">OpenAI</div>' +
        '<div style="font-size:0.64em;color:var(--text-muted);">GPT-4o · Vision<br>Clé API requise</div>' +
      '</div>' +

      /* Claude */
      '<div id="aicard-claude" style="'+cardStyle('claude')+'" onclick="window._selectAIProv(\'claude\')">' +
        checkMark('claude') + tagBadge(provDefs.claude) +
        '<div style="font-size:1.3em;margin-bottom:5px;">🧠</div>' +
        '<div style="font-weight:700;font-size:0.8em;margin-bottom:3px;">Claude</div>' +
        '<div style="font-size:0.64em;color:var(--text-muted);">Anthropic · Vision<br>Clé API requise</div>' +
      '</div>' +

      /* LM Studio */
      '<div id="aicard-lmstudio" style="'+cardStyle('lmstudio')+'" onclick="window._selectAIProv(\'lmstudio\')">' +
        checkMark('lmstudio') + tagBadge(provDefs.lmstudio) +
        '<div style="font-size:1.3em;margin-bottom:5px;">💻</div>' +
        '<div style="font-weight:700;font-size:0.8em;margin-bottom:3px;">LM Studio</div>' +
        '<div style="font-size:0.64em;color:var(--text-muted);">Local · Serveur perso<br>LM Studio requis</div>' +
      '</div>' +

      /* Ollama */
      '<div id="aicard-ollama" style="'+cardStyle('ollama')+'" onclick="window._selectAIProv(\'ollama\')">' +
        checkMark('ollama') + tagBadge(provDefs.ollama) +
        '<div style="font-size:1.3em;margin-bottom:5px;">🦙</div>' +
        '<div style="font-weight:700;font-size:0.8em;margin-bottom:3px;">Ollama</div>' +
        '<div style="font-size:0.64em;color:var(--text-muted);">Local · 100% privé<br>Ollama requis</div>' +
      '</div>' +
      '</div>' +

      /* === AVERTISSEMENT QWEN === */
      '<div id="qwenWarningBox" style="'+(cur==='qwen'?'':'display:none;')+'background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.4);border-radius:10px;padding:10px 14px;margin-bottom:16px;font-size:0.72em;color:#fbbf24;line-height:1.5;">' +
        '⚠️ <strong>Mode local activé</strong> — Les performances dépendent du modèle choisi. Les petits modèles (&lt;3B) peuvent ignorer le rôle d\'EVA ou donner des réponses génériques. Pour une meilleure expérience, choisissez <strong>Llama 3.2 3B</strong> ou <strong>Phi 3.5 Mini</strong>.' +
      '</div>' +

      /* === CONFIG DYNAMIQUE === */
      '<div id="aiDynConfig">' +

      /* E.V.A config — modèles locaux WebLLM */
      '<div id="apiKeyFieldEva" style="'+(cur==='eva'?'':'display:none')+'">' +
        '<div style="background:rgba(168,85,247,0.08);border:1px solid rgba(168,85,247,0.35);border-radius:10px;padding:12px 14px;">' +
          '<div style="font-size:0.74em;font-weight:700;color:#c084fc;margin-bottom:6px;font-family:Orbitron,monospace;letter-spacing:0.05em;">⚡ E.V.A — MODÈLES LOCAUX ASTRAL</div>' +
          '<div style="font-size:0.7em;color:rgba(192,132,252,0.85);line-height:1.6;">100% local · 100% privé · Aucun serveur<br>Propulsé par WebLLM — téléchargement automatique dans le cache navigateur.</div>' +
        '</div>' +
      '</div>' +

      /* Puter connect */
      '<div id="puterConnectField" style="'+(cur==='puter'?'':'display:none')+'">'+
        '<div class="puter-connect-block" id="puterConnectBlock">' +
          '<div id="puterConnectStatus" style="font-size:0.78em;color:var(--text-muted);margin-bottom:10px">Vérification du statut Puter...</div>' +
          '<div id="puterConnectButtons"></div>' +
        '</div>' +
      '</div>' +

      /* Modèle sélectionnable */
      '<div class="form-field" id="sModelField" style="'+(curDef.models.length?'':'display:none')+'"><label class="form-label">Modèle</label>' +
        '<select class="form-select" id="sModel">'+buildModelOpts(cur,curModel)+'</select>' +
        '<div style="font-size:0.66em;color:var(--text-muted);margin-top:4px">Le modèle peut aussi être changé directement dans la barre de chat.</div>' +
      '</div>' +

      /* OpenAI key */
      '<div class="form-field" id="apiKeyFieldOpenAI" style="'+(cur==='openai'?'':'display:none')+'">' +
        '<label class="form-label">Clé API OpenAI</label>' +
        '<input type="password" class="form-input" id="sApiKeyOpenAI" placeholder="sk-..." value="'+esc(cfg.openaiApiKey||'')+'">' +
        '<div style="font-size:0.66em;color:var(--text-muted);margin-top:4px">Disponible sur <strong>platform.openai.com</strong> · Service payant à l\'usage</div>' +
      '</div>' +

      /* Claude key */
      '<div class="form-field" id="apiKeyFieldClaude" style="'+(cur==='claude'?'':'display:none')+'">' +
        '<label class="form-label">Clé API Anthropic (Claude)</label>' +
        '<input type="password" class="form-input" id="sApiKeyClaude" placeholder="sk-ant-..." value="'+esc(cfg.claudeApiKey||'')+'">' +
        '<div style="font-size:0.66em;color:var(--text-muted);margin-top:4px">Disponible sur <strong>console.anthropic.com</strong> · Service payant à l\'usage</div>' +
      '</div>' +

      /* LM Studio */
      '<div class="form-field" id="apiKeyFieldLMStudio" style="'+(cur==='lmstudio'?'':'display:none')+'">' +
        '<label class="form-label">URL LM Studio</label>' +
        '<input type="text" class="form-input" id="sLMStudioURL" placeholder="http://localhost:1234" value="'+esc(cfg.lmstudioUrl||'http://localhost:1234')+'">' +
      '</div>' +

      /* Ollama */
      '<div class="form-field" id="apiKeyFieldOllama" style="'+(cur==='ollama'?'':'display:none')+'">' +
        '<label class="form-label">URL Ollama</label>' +
        '<input type="text" class="form-input" id="sOllamaURL" placeholder="http://localhost:11434" value="'+esc(cfg.ollamaUrl||'http://localhost:11434')+'">' +
        '<label class="form-label" style="margin-top:8px">Modèle Ollama</label>' +
        '<input type="text" class="form-input" id="sOllamaModel" placeholder="ex: llama3, mistral..." value="'+esc(cfg.ollamaModel||'')+'">' +
      '</div>' +

      '</div>' + /* fin aiDynConfig */

      /* Contexte */
      '<div class="form-field"><label class="form-label">Contexte mémorisé (messages)</label>' +
        '<div style="display:flex;align-items:center;gap:10px"><input type="range" min="4" max="40" step="2" id="sContextLen" value="'+(cfg.contextLength||10)+'" style="flex:1;accent-color:var(--cyan)">' +
        '<span id="sContextLenVal" style="font-size:0.75em;color:var(--cyan);min-width:30px">'+(cfg.contextLength||10)+'</span>' +
        '</div>' +
      '</div>' +
      '</div>' + /* fin settings-section */
      '<div style="display:flex;gap:8px"><button class="btn btn-primary" id="applyAIBtn" onclick="saveAISettings()">Appliquer</button></div>';

    setTimeout(function() {
      var sl = document.getElementById('sContextLen');
      var sv = document.getElementById('sContextLenVal');
      if (sl && sv) sl.addEventListener('input', function(){ sv.textContent = this.value; });

      window._selectAIProv = function(v) {
        /* Mettre à jour le hidden input */
        var hi = document.getElementById('sProvider'); if(hi) hi.value = v;

        /* Mettre à jour l'apparence des cartes */
        ['eva','puter','pollinations','openai','claude','qwen','lmstudio','ollama'].forEach(function(k) {
          var card = document.getElementById('aicard-'+k);
          if (!card) return;
          var active = k === v;
          card.style.border = '2px solid '+(active?'var(--cyan)':'rgba(255,255,255,0.08)');
          card.style.background = active?'rgba(0,220,220,0.07)':'rgba(255,255,255,0.02)';
          /* check mark */
          var existing = card.querySelector('.aicard-check');
          if (active && !existing) {
            var chk = document.createElement('div');
            chk.className = 'aicard-check';
            chk.style.cssText = 'position:absolute;top:10px;left:10px;color:var(--cyan);font-size:0.9em;';
            chk.textContent = '✓';
            card.appendChild(chk);
          } else if (!active && existing) {
            existing.remove();
          }
        });

        /* Avertissement Qwen */
        var warn = document.getElementById('qwenWarningBox');
        if (warn) warn.style.display = v==='qwen' ? '' : 'none';

        /* Champs API/URL */
        ['Eva','OpenAI','Claude','LMStudio','Ollama'].forEach(function(x){
          var f = document.getElementById('apiKeyField'+x); if(f) f.style.display='none';
        });
        var puterF = document.getElementById('puterConnectField');
        if (puterF) puterF.style.display = v==='puter' ? '' : 'none';
        var apiShow = {eva:'Eva',openai:'OpenAI',claude:'Claude',lmstudio:'LMStudio',ollama:'Ollama'}[v];
        if (apiShow) { var f=document.getElementById('apiKeyField'+apiShow); if(f) f.style.display=''; }

        /* Modèles */
        var modelField = document.getElementById('sModelField');
        var modelSel = document.getElementById('sModel');
        var def = provDefs[v] || {};
        if (def.models && def.models.length) {
          var selModel = cfg[def.modelKey] || (def.models[0] && def.models[0].id) || '';
          if (modelSel) modelSel.innerHTML = def.models.map(function(m){ return '<option value="'+m.id+'"'+(m.id===selModel?' selected':'')+'>'+m.label+'</option>'; }).join('');
          if (modelField) modelField.style.display = '';
        } else {
          if (modelField) modelField.style.display = 'none';
        }
        if (v==='puter') refreshPuterStatusUI();
      };

      if (cur==='puter') refreshPuterStatusUI();
    }, 50);

  } else if (section === 'voice') {
    var curTTSProv = cfg.voiceProvider || 'eva-custom';
    if (curTTSProv === 'piper') curTTSProv = 'eva-custom';
    var provLabels = {'eva-custom':'🎤 EVA Voice Personnalisée',native:'🎙 Navigateur (Web Speech)',eva:'🌟 EVA TTS — Kokoro',elevenlabs:'⚡ ElevenLabs',openai:'🤖 OpenAI TTS'};
    var curProvLabel = provLabels[curTTSProv] || curTTSProv;
    function ttsCardSt(key) {
      var a = key === curTTSProv;
      return 'cursor:pointer;border-radius:14px;padding:16px 12px;border:2px solid '+(a?'var(--cyan)':'rgba(255,255,255,0.08)')+';background:'+(a?'rgba(0,220,220,0.07)':'rgba(255,255,255,0.02)')+';transition:all 0.2s;text-align:center;position:relative;';
    }
    function ttsTag(color, lbl) {
      return '<span style="font-size:0.53em;font-weight:700;letter-spacing:0.06em;background:'+color+';color:#000;border-radius:4px;padding:2px 5px;position:absolute;top:8px;right:8px;">'+lbl+'</span>';
    }
    function ttsDualTag(c1, l1, c2, l2) {
      return '<div style="position:absolute;top:6px;right:6px;display:flex;flex-direction:column;gap:2px;align-items:flex-end;">' +
        '<span style="font-size:0.5em;font-weight:800;letter-spacing:0.05em;background:'+c1+';color:#fff;border-radius:4px;padding:1px 5px;">'+l1+'</span>' +
        '<span style="font-size:0.5em;font-weight:800;letter-spacing:0.05em;background:'+c2+';color:#000;border-radius:4px;padding:1px 5px;">'+l2+'</span>' +
      '</div>';
    }
    function ttsChk(key) {
      return curTTSProv===key?'<div class="tts-chk" style="position:absolute;top:8px;left:8px;color:var(--cyan);font-size:0.85em;">✓</div>':'';
    }

    c.innerHTML =
      '<div class="settings-section">' +
      '<div class="settings-section-title">Voix & Audio</div>' +

      /* Toggles */
      '<div class="settings-row" style="padding:10px 0;border-bottom:1px solid var(--border)">' +
        '<div><div class="settings-row-label">Synthèse vocale</div><div class="settings-row-sub">EVA vous répond à voix haute</div></div>' +
        '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;"><input type="checkbox" id="sTTS"'+(S.ttsOn?' checked':'')+' style="accent-color:var(--cyan);width:16px;height:16px;"> <span style="font-size:0.78em;color:var(--text-muted)">Activé</span></label>' +
      '</div>' +
      '<div class="settings-row" style="padding:10px 0;border-bottom:1px solid var(--border)">' +
        '<div><div class="settings-row-label">Wake Word</div><div class="settings-row-sub">Activation par "Hey Eva"</div></div>' +
        '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;"><input type="checkbox" id="sWakeWord"'+(S.wakeWordOn?' checked':'')+' style="accent-color:var(--cyan);width:16px;height:16px;"> <span style="font-size:0.78em;color:var(--text-muted)">Activé</span></label>' +
      '</div>' +

      /* Vitesse */
      '<div class="form-field"><label class="form-label">Vitesse de parole</label>' +
        '<div style="display:flex;align-items:center;gap:10px">' +
          '<input type="range" min="0.5" max="2" step="0.1" id="sSpeechRate" value="'+(cfg.speechRate||1.0)+'" style="flex:1;accent-color:var(--cyan)">' +
          '<span id="sSpeechRateVal" style="font-size:0.78em;color:var(--cyan);min-width:30px">'+(cfg.speechRate||1.0)+'x</span>' +
        '</div>' +
      '</div>' +

      /* Hidden select pour saveVoiceSettings() */
      '<input type="hidden" id="sTTSProvider" value="'+curTTSProv+'">' +

      /* === SERVICE DE VOIX — RECOMMANDÉS === */
      '<div style="font-size:0.65em;color:var(--text-muted);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:10px;">⭐ Recommandés</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(125px,1fr));gap:12px;margin-bottom:16px;">' +

        /* Piper TTS — recommandé : voix neuronale française locale, sans clé */
        '<div id="ttscard-piper" style="'+ttsCardSt('piper')+'" onclick="window._selectTTS(\'piper\')">' +
          ttsChk('piper') + ttsDualTag('#a855f7','LOCAL','#06b6d4','GRATUIT') +
          '<div style="font-size:1.5em;margin-bottom:5px;">🇫🇷</div>' +
          '<div style="font-weight:700;font-size:0.82em;margin-bottom:3px;">Piper TTS</div>' +
          '<div style="font-size:0.66em;color:var(--text-muted);line-height:1.4;">Voix française féminine<br>100% local · sans clé</div>' +
        '</div>' +

        /* Navigateur */
        '<div id="ttscard-native" style="'+ttsCardSt('native')+'" onclick="window._selectTTS(\'native\')">' +
          ttsChk('native') + ttsDualTag('#4ade80','LOCAL','#06b6d4','GRATUIT') +
          '<div style="font-size:1.5em;margin-bottom:5px;">🖥️</div>' +
          '<div style="font-weight:700;font-size:0.82em;margin-bottom:3px;">Navigateur</div>' +
          '<div style="font-size:0.66em;color:var(--text-muted);line-height:1.4;">Web Speech API<br>Aucune configuration</div>' +
        '</div>' +

        /* EVA TTS Kokoro */
        '<div id="ttscard-eva" style="'+ttsCardSt('eva')+'" onclick="window._selectTTS(\'eva\')">' +
          ttsChk('eva') + ttsDualTag('#a855f7','LOCAL','#4ade80','GRATUIT') +
          '<div style="font-size:1.5em;margin-bottom:5px;">🧠</div>' +
          '<div style="font-weight:700;font-size:0.82em;margin-bottom:3px;">Kokoro Neural</div>' +
          '<div style="font-size:0.66em;color:var(--text-muted);line-height:1.4;">MMS féminin · Local<br>100% gratuit · ~30Mo</div>' +
        '</div>' +
      '</div>' +

      /* === AUTRES SERVICES === */
      '<div style="font-size:0.65em;color:var(--text-muted);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:10px;">Autres services</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(125px,1fr));gap:10px;margin-bottom:16px;">' +

        /* ElevenLabs */
        '<div id="ttscard-elevenlabs" style="'+ttsCardSt('elevenlabs')+'" onclick="window._selectTTS(\'elevenlabs\')">' +
          ttsChk('elevenlabs') + ttsTag('#10b981','PAYANT') +
          '<div style="font-size:1.3em;margin-bottom:4px;">⚡</div>' +
          '<div style="font-weight:700;font-size:0.78em;margin-bottom:2px;">ElevenLabs</div>' +
          '<div style="font-size:0.63em;color:var(--text-muted);">Voix ultra-réaliste<br>Clé API requise</div>' +
        '</div>' +

        /* OpenAI TTS */
        '<div id="ttscard-openai" style="'+ttsCardSt('openai')+'" onclick="window._selectTTS(\'openai\')">' +
          ttsChk('openai') + ttsTag('#10b981','PAYANT') +
          '<div style="font-size:1.3em;margin-bottom:4px;">🤖</div>' +
          '<div style="font-weight:700;font-size:0.78em;margin-bottom:2px;">OpenAI TTS</div>' +
          '<div style="font-size:0.63em;color:var(--text-muted);">Voix GPT<br>Clé API requise</div>' +
        '</div>' +

      '</div>' +

      /* Options dynamiques du provider sélectionné */
      '<div id="sTTSProvOpts"></div>' +
      '</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
        '<button class="btn btn-secondary" onclick="testVoice()">🔊 Tester la voix</button>' +
        '<button class="btn btn-primary" onclick="saveVoiceSettings()">Sauvegarder</button>' +
      '</div>';

    setTimeout(function() {
      var sl = document.getElementById('sSpeechRate');
      var sv = document.getElementById('sSpeechRateVal');
      if (sl && sv) sl.addEventListener('input', function(){ sv.textContent = parseFloat(this.value).toFixed(1) + 'x'; });

      window._selectTTS = function(v) {
        var hi = document.getElementById('sTTSProvider'); if(hi) hi.value = v;
        /* Application immédiate sans clic Sauvegarder */
        if (S.config) S.config.voiceProvider = v;
        saveCfg();
        ['native','eva','elevenlabs','openai','piper','eva-custom'].forEach(function(k) {
          var card = document.getElementById('ttscard-'+k);
          if (!card) return;
          var active = k === v;
          card.style.border = '2px solid '+(active?'var(--cyan)':'rgba(255,255,255,0.08)');
          card.style.background = active?'rgba(0,220,220,0.07)':'rgba(255,255,255,0.02)';
          var existing = card.querySelector('.tts-chk');
          if (active && !existing) {
            var chk = document.createElement('div');
            chk.className = 'tts-chk';
            chk.style.cssText = 'position:absolute;top:8px;left:8px;color:var(--cyan);font-size:0.85em;';
            chk.textContent = '✓'; card.appendChild(chk);
          } else if (!active && existing) { existing.remove(); }
        });
        renderTTSProvOpts(v);
      };

      renderTTSProvOpts(curTTSProv);
    }, 50);

  } else if (section === 'usage') {
    c.innerHTML = '<div class="settings-section" style="text-align:center;padding:40px;"><div class="loader" style="margin:0 auto;"></div><div style="margin-top:10px;font-size:0.8em;color:var(--text-muted);">Chargement des statistiques CloudWorks...</div></div>';

    // Provider actuel
    var _curProv = (S.config && S.config.aiProvider) || '?';
    var _curModel = (S.config && (S.config.pollinationsModel || S.config.puterModel || S.config.openaiModel)) || '—';
    var _provLabel = { pollinations:'🌸 Pollinations', puter:'☁️ Puter Cloud', openai:'🤖 OpenAI', claude:'🧠 Claude', qwen:'🖥️ Local Privé', eva:'✨ E.V.A', lmstudio:'💻 LM Studio', ollama:'🦙 Ollama' }[_curProv] || _curProv;

    // Date d'inscription
    var _joinDate = '—';
    try {
      if (S.profile && S.profile.createdAt && S.profile.createdAt.toDate) {
        _joinDate = S.profile.createdAt.toDate().toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' });
      } else if (S.profile && S.profile.createdAt && S.profile.createdAt.seconds) {
        _joinDate = new Date(S.profile.createdAt.seconds * 1000).toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' });
      }
    } catch(e) {}

    // Fetch from Firestore
    if (!S.user || typeof db === 'undefined') {
      c.innerHTML = '<div class="settings-section" style="text-align:center;color:var(--red);">Vous devez être connecté à un compte pour voir vos statistiques.</div>';
      return;
    }

    db.collection('users').doc(S.user.uid).collection('stats').doc('global').get().then(function(doc) {
      var _msgCount = 0, _userCount = 0, _evaCount = 0, _tokensEst = 0;
      if (doc.exists) {
        var data = doc.data();
        _msgCount = data.msgCount || 0;
        _userCount = data.userCount || 0;
        _evaCount = data.evaCount || 0;
        _tokensEst = data.tokensEst || 0;
      }
      
      var _tokensStr = _tokensEst > 1000 ? ((_tokensEst / 1000).toFixed(1) + 'K') : String(_tokensEst);

      function _statCard(icon, val, label, color) {
        return '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px 10px;text-align:center;">' +
          '<div style="font-size:1.4em;margin-bottom:4px;">' + icon + '</div>' +
          '<div style="font-size:1.1em;font-weight:800;color:' + (color||'var(--cyan)') + ';font-family:Orbitron,monospace;">' + val + '</div>' +
          '<div style="font-size:0.6em;color:var(--text-muted);margin-top:2px;text-transform:uppercase;">' + label + '</div>' +
        '</div>';
      }

      var html = 
        '<div class="settings-section">' +
        '<div class="settings-section-title">Statistiques CloudWorks</div>' +
        
        '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px;">' +
          _statCard('💬', _msgCount || '0', 'Messages', 'var(--cyan)') +
          _statCard('👤', _userCount || '0', 'Vous', '#a855f7') +
          _statCard('🤖', _evaCount  || '0', 'E.V.A', '#06b6d4') +
          _statCard('🔤', _tokensStr, 'Tokens', '#10b981') +
        '</div>' +

        '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:16px;position:relative;height:160px;">' +
          '<canvas id="usageChart"></canvas>' +
        '</div>' +

        /* Provider actif */
        '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:14px 16px;margin-bottom:16px;">' +
          '<div style="font-size:0.62em;letter-spacing:2px;text-transform:uppercase;color:var(--cyan);margin-bottom:10px;font-family:Orbitron,monospace;">⚡ Session Actuelle</div>' +
          '<div style="display:flex;flex-direction:column;gap:8px;">' +
            '<div style="display:flex;align-items:center;justify-content:space-between;">' +
              '<span style="font-size:0.75em;color:var(--text-muted);">Provider IA actif</span>' +
              '<span style="font-size:0.78em;font-weight:700;color:var(--text);">' + _provLabel + '</span>' +
            '</div>' +
            '<div style="display:flex;align-items:center;justify-content:space-between;">' +
              '<span style="font-size:0.75em;color:var(--text-muted);">Modèle utilisé</span>' +
              '<span style="font-size:0.75em;color:var(--cyan);">' + esc(_curModel) + '</span>' +
            '</div>' +
            '<div style="display:flex;align-items:center;justify-content:space-between;">' +
              '<span style="font-size:0.75em;color:var(--text-muted);">Membre depuis</span>' +
              '<span style="font-size:0.75em;color:var(--text-muted);">' + _joinDate + '</span>' +
            '</div>' +
          '</div>' +
        '</div>' +

        /* Explication */
        '<div style="background:rgba(168,85,247,0.06);border:1px solid rgba(168,85,247,0.15);border-radius:10px;padding:12px 14px;font-size:0.72em;color:var(--text-muted);line-height:1.65;">' +
          '<strong style="color:#a855f7;">☁️ Connecté à CloudWorks</strong><br>' +
          'Vos statistiques d\'utilisation sont désormais synchronisées de manière sécurisée et globale via votre compte CloudWorks/Firebase.' +
        '</div>' +

        '</div>';

      c.innerHTML = html;

      // Draw Chart with Promise.all on direct document IDs (no composite index needed)
      if (window.Chart) {
        var ctx = document.getElementById('usageChart').getContext('2d');

        // Build the 7 day IDs and labels
        var datesMap = {};
        var dayDocIds = [];
        for (var i = 6; i >= 0; i--) {
          var _d = new Date();
          _d.setDate(_d.getDate() - i);
          var _yy = _d.getFullYear();
          var _mm = String(_d.getMonth() + 1).padStart(2, '0');
          var _dd = String(_d.getDate()).padStart(2, '0');
          var _ds = _yy + '-' + _mm + '-' + _dd;
          var _docId = 'daily_' + _yy + _mm + _dd;
          datesMap[_docId] = { label: _dd + '/' + _mm, msg: 0 };
          dayDocIds.push(_docId);
        }

        var statsRef2 = db.collection('users').doc(S.user.uid).collection('stats');
        var fetchPromises = dayDocIds.map(function(docId) {
          return statsRef2.doc(docId).get().then(function(snap) {
            if (snap.exists) {
              datesMap[docId].msg = snap.data().msgCount || 0;
            }
          }).catch(function() {});
        });

        Promise.all(fetchPromises).then(function() {
          var labels = [];
          var dataMessages = [];
          dayDocIds.forEach(function(id) {
            labels.push(datesMap[id].label);
            dataMessages.push(datesMap[id].msg);
          });

          new Chart(ctx, {
            type: 'line',
            data: {
              labels: labels,
              datasets: [{
                label: 'Messages',
                data: dataMessages,
                borderColor: '#7b8bf5',
                backgroundColor: 'rgba(123,139,245,0.12)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#7b8bf5',
                pointBorderColor: '#1a1a2e',
                pointRadius: 4,
                pointHoverRadius: 6
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                tooltip: {
                  mode: 'index',
                  intersect: false,
                  backgroundColor: 'rgba(15,15,30,0.9)',
                  borderColor: 'rgba(123,139,245,0.3)',
                  borderWidth: 1,
                  titleColor: '#7b8bf5',
                  bodyColor: '#c4c4d4',
                  callbacks: {
                    label: function(ctx) { return ' ' + ctx.parsed.y + ' message(s)'; }
                  }
                }
              },
              scales: {
                x: {
                  grid: { color: 'rgba(255,255,255,0.04)' },
                  ticks: { color: '#88889a', font: { family: "'Space Mono', monospace", size: 9 } }
                },
                y: {
                  grid: { color: 'rgba(255,255,255,0.04)' },
                  ticks: { color: '#88889a', font: { family: "'Space Mono', monospace", size: 9 }, precision: 0 },
                  beginAtZero: true
                }
              }
            }
          });
        }).catch(function(e) {
          console.error('[EVA Stats] Chart render error:', e);
          var chartWrap = document.getElementById('usageChart');
          if (chartWrap) chartWrap.parentElement.innerHTML = '<div style="color:var(--text-muted);font-size:0.8em;text-align:center;line-height:160px;">Graphe indisponible</div>';
        });
      }

    }).catch(function(e) {
      console.error('[EVA Stats] global fetch error:', e);
      c.innerHTML = '<div class="settings-section" style="color:var(--text-muted);text-align:center;padding:30px;">Erreur lors de la récupération des statistiques :<br><code style="font-size:0.8em;color:#ef4444;">' + e.message + '</code></div>';
    });

  } else if (section === 'brain') {
    c.innerHTML =
      '<div class="settings-section">' +
      '<div class="settings-section-title">Cartographie Neuronale</div>' +
      '<div style="font-size:0.74em;color:var(--text-muted);margin-bottom:12px;line-height:1.5">Visualisation de la mémoire adaptative d\'EVA. Les nœuds représentent les concepts et les préférences mémorisés au fil de vos conversations.</div>' +
      '<div id="brainMapContainer" style="width:100%;height:220px;background:rgba(10,15,30,0.8);border:1px solid rgba(123,139,245,0.3);border-radius:12px;position:relative;overflow:hidden;margin-bottom:15px;box-shadow:inset 0 0 20px rgba(0,0,0,0.5);">' +
      '<canvas id="brainCanvas" style="position:absolute;top:0;left:0;width:100%;height:100%;"></canvas>' +
      '</div>' +
      '<div class="settings-row">' +
        '<div><div class="settings-row-label">Apprentissage adaptatif</div>' +
        '<div class="settings-row-sub">Activer la mémorisation automatique des préférences</div></div>' +
        '<label class="alarm-toggle"><input type="checkbox" id="sAdaptation"' + (S.adaptationEnabled ? ' checked' : '') + ' onchange="toggleAdaptation(this.checked)"><span class="alarm-slider"></span></label>' +
      '</div>' +
      (S.evaMemory && S.evaMemory.nodes && S.evaMemory.nodes.length > 0 ?
        '<div style="font-size:0.74em;color:var(--text-muted);margin-top:8px;"><strong>' + S.evaMemory.nodes.length + '</strong> nœuds et <strong>' + (S.evaMemory.links ? S.evaMemory.links.length : 0) + '</strong> connexions.<br><span style="font-size:0.8em;color:var(--text-dim)">Dernière mise à jour: ' + (S.evaMemory.lastUpdated ? new Date(S.evaMemory.lastUpdated).toLocaleDateString('fr-FR') : '') + '</span></div>'
      : '<div style="font-size:0.74em;color:var(--text-muted);margin-top:8px;font-style:italic">Le réseau neuronal est vide. Il se construira en conversant avec EVA.</div>') +
      '</div>' +
      '<div class="settings-section">' +
      '<div class="settings-section-title">Gestion des données</div>' +
      '<div style="display:flex;gap:10px;margin-bottom:10px">' +
      '<button class="btn btn-secondary" onclick="exportEvaMemory()" style="flex:1">💾 Exporter</button>' +
      '<button class="btn btn-secondary" onclick="document.getElementById(\'importMemoryInput\').click()" style="flex:1">📂 Importer</button>' +
      '<input type="file" id="importMemoryInput" accept=".json" style="display:none" onchange="importEvaMemory(event)">' +
      '</div>' +
      '<button class="btn btn-danger" onclick="resetEvaMemory()" style="width:100%;margin-top:5px" '+(S.evaMemory && S.evaMemory.nodes ? '':'disabled')+'>🗑️ Effacer la mémoire neuronale</button>' +
      '</div>';
      setTimeout(renderBrainMap, 100);

  } else if (section === 'account') {
    var isGoogleUser = S.user && S.user.providerData && S.user.providerData.some(function(p){return p.providerId==='google.com';});
    var hasPassword = S.user && S.user.providerData && S.user.providerData.some(function(p){return p.providerId==='password';});
    var isGoogleOnly = isGoogleUser && !hasPassword;
    var connLabel = isGoogleUser && hasPassword ? '🔵 Google + 🔑 Mot de passe' : isGoogleUser ? '🔵 Google' : '📧 Email/Mot de passe';
    c.innerHTML =
      '<form style="display:none" aria-hidden="true"><input type="text" name="fake_email_to_prevent_autofill"><input type="password" name="fake_password_to_prevent_autofill"></form>' +
      '<div class="settings-section">' +
      '<div class="settings-section-title">Mon Compte</div>' +
      '<div class="settings-row"><div class="settings-row-label">Email actuel</div><div style="font-size:0.78em;color:var(--text-muted)">'+esc((S.user&&S.user.email)||'—')+'</div></div>' +
      '<div class="settings-row"><div class="settings-row-label">Rôle</div><div style="color:var(--cyan);font-size:0.82em">'+esc({creator:'👑 Créateur',developer:'⚙️ Développeur',creator_wife:'💎 Épouse du créateur',user:'👤 Utilisateur'}[(p.role||'user').toLowerCase()]||p.role||'user')+'</div></div>' +
      '<div class="settings-row"><div class="settings-row-label">Connexion</div><div style="font-size:0.76em;color:var(--text-muted)">'+connLabel+'</div></div>' +
      '</div>' +
      (!isGoogleUser ?
        '<div class="settings-section">' +
        '<div class="settings-section-title">Changer l\'adresse email</div>' +
        '<div class="form-field"><label class="form-label">Nouvel email</label><input type="email" class="form-input" id="sNewEmail" placeholder="nouveau@email.com"></div>' +
        '<div class="form-field"><label class="form-label">Mot de passe actuel (confirmation)</label><input type="password" class="form-input" id="sEmailPassword" placeholder="••••••••"></div>' +
        '<button class="btn btn-secondary" onclick="changeEmail()" style="margin-top:4px">Mettre à jour l\'email</button>' +
        '</div>'
      : '') +
      '<div class="settings-section">' +
      '<div class="settings-section-title">'+(isGoogleOnly ? 'Créer un mot de passe' : 'Changer le mot de passe')+'</div>' +
      '<div style="font-size:0.74em;color:var(--text-muted);margin-bottom:10px">'+(isGoogleOnly ? 'Ajoutez un mot de passe à votre compte Google pour pouvoir vous connecter sans Google.' : '')+'</div>' +
      (isGoogleOnly ? '' : '<div class="form-field"><label class="form-label">Mot de passe actuel</label><input type="password" class="form-input" id="sCurPassword" placeholder="••••••••"></div>') +
      '<div class="form-field"><label class="form-label">Nouveau mot de passe</label><input type="password" class="form-input" id="sNewPassword" placeholder="Minimum 6 caractères"></div>' +
      '<div class="form-field"><label class="form-label">Confirmer le mot de passe</label><input type="password" class="form-input" id="sConfPassword" placeholder="Idem ci-dessus"></div>' +
      '<button class="btn btn-secondary" onclick="changePassword()" style="margin-top:4px">'+(isGoogleOnly ? 'Créer le mot de passe' : 'Mettre à jour le mot de passe')+'</button>' +
        '</div>' +
        '<div class="settings-section">' +
        '<div class="settings-section-title">Sessions Actives</div>' +
        '<div id="sessionsListContainer"><div class="loader"></div></div>' +
        '</div>' +
        '<div class="settings-section">' +
        '<div class="settings-section-title">Danger zone</div>' +
      '<div style="display:flex;flex-direction:column;gap:8px">' +
      '<button class="btn btn-secondary" onclick="auth.signOut().then(function(){window.location.href=\'/\';})">🚪 Se déconnecter</button>' +
      '<button class="btn btn-danger" onclick="if(confirm(\'Supprimer toutes les conversations ? Cette action est irréversible.\'))clearAllConvs()">🗑️ Effacer toutes les conversations</button>' +
      '<button class="btn btn-danger" onclick="deleteMyAccount()" style="margin-top:4px">⛔ Supprimer mon compte</button>' +
      '</div>' +
      '<div style="font-size:0.68em;color:var(--text-dim);margin-top:8px">La suppression du compte est irréversible. Toutes vos données seront effacées définitivement.</div>' +
      '</div>';

    setTimeout(loadSessions, 100);
  } else if (section === 'notifications') {
    var notifPerm = ('Notification' in window) ? Notification.permission : 'unavailable';
    var _svgCheck   = '<svg viewBox="0 0 24 24" width="13" height="13" style="display:inline-block;vertical-align:middle;margin-right:3px;stroke:#4ade80;fill:none;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round"><polyline points="20 6 9 17 4 12"/></svg>';
    var _svgCross   = '<svg viewBox="0 0 24 24" width="13" height="13" style="display:inline-block;vertical-align:middle;margin-right:3px;stroke:#f87171;fill:none;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    var _svgClock   = '<svg viewBox="0 0 24 24" width="13" height="13" style="display:inline-block;vertical-align:middle;margin-right:3px;stroke:var(--text-muted);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>';
    var _svgWarn    = '<svg viewBox="0 0 24 24" width="13" height="13" style="display:inline-block;vertical-align:middle;margin-right:3px;stroke:var(--text-dim);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
    var permLabel = {granted:_svgCheck+'Autorisées', denied:_svgCross+'Bloquées', default:_svgClock+'Non configurées', unavailable:_svgWarn+'Non supporté'}[notifPerm] || notifPerm;
    var permColor = {granted:'var(--cyan)', denied:'#ff4d6d', default:'var(--text-muted)', unavailable:'var(--text-dim)'}[notifPerm] || 'var(--text-muted)';
    var hasFcmToken = !!_fcmToken;
    /* Construire la liste unifiée : fcmDevices (objets) + orphelins dans fcmTokens */
    var _knownDevices = (S.profile && Array.isArray(S.profile.fcmDevices)) ? S.profile.fcmDevices.filter(function(d){ return d && d.token; }) : [];
    var _knownTokenSet = new Set(_knownDevices.map(function(d){ return d.token; }));
    var _legacyTokens = (S.profile && Array.isArray(S.profile.fcmTokens)) ? S.profile.fcmTokens.filter(function(t){ return t && !_knownTokenSet.has(t); }) : [];
    var _allDevices = _knownDevices.concat(_legacyTokens.map(function(t){ return { token: t, name: 'Appareil inconnu', ip: '—', registeredAt: null, legacy: true }; }));
    var fcmDeviceCount = _allDevices.length || (hasFcmToken ? 1 : 0);
    var _svgActive = '<svg viewBox="0 0 24 24" width="12" height="12" style="display:inline-block;vertical-align:middle;margin-right:3px;stroke:#4ade80;fill:none;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round"><polyline points="20 6 9 17 4 12"/></svg>';
    var _svgRefresh = '<svg viewBox="0 0 24 24" width="12" height="12" style="display:inline-block;vertical-align:middle;margin-right:3px;stroke:var(--text-muted);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>';
    var fcmStatus = notifPerm === 'granted' && hasFcmToken
      ? _svgActive + 'Push actif' + (fcmDeviceCount > 1 ? ' — ' + fcmDeviceCount + ' appareils' : '')
      : notifPerm === 'granted' ? _svgRefresh + 'Navigateur seulement' : '—';
    var fcmColor  = notifPerm === 'granted' && hasFcmToken ? 'var(--cyan)' : notifPerm === 'granted' ? 'var(--text-muted)' : 'var(--text-dim)';
    c.innerHTML =
      '<div class="settings-section">' +
      '<div class="settings-section-title">Notifications</div>' +
      '<div style="background:rgba(123,139,245,0.08);border:1px solid rgba(123,139,245,0.25);border-radius:10px;padding:10px 14px;margin-bottom:12px;font-size:0.72em;color:var(--text-muted);line-height:1.5;">' +
        '<svg viewBox="0 0 24 24" width="13" height="13" style="display:inline-block;vertical-align:middle;margin-right:5px;stroke:#7b8bf5;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' +
        '<strong style="color:#7b8bf5">Nouveau :</strong> Grâce à la technologie Vercel Serverless, vous recevez vos alertes push en temps réel, <strong>même si l’application est fermée</strong> !' +
      '</div>' +
      '<div class="settings-row">' +
        '<div><div class="settings-row-label">Permission navigateur</div><div class="settings-row-sub">Chrome, Edge, Firefox, Opera</div></div>' +
        '<div style="color:'+permColor+';font-size:0.82em;font-weight:600">'+permLabel+'</div>' +
      '</div>' +
      '<div class="settings-row">' +
        '<div><div class="settings-row-label">Statut Serverless</div><div class="settings-row-sub">Actives en arrière-plan (Cloud Push)</div></div>' +
        '<div style="color:'+fcmColor+';font-size:0.80em;font-weight:600">'+fcmStatus+'</div>' +
      '</div>' +
      (notifPerm !== 'granted' && notifPerm !== 'denied' && notifPerm !== 'unavailable' ?
        '<button class="btn btn-primary" onclick="activateNotifications()" style="margin-top:10px;width:100%;display:flex;align-items:center;justify-content:center;gap:6px"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>Activer les notifications</button>' +
        '<div style="font-size:0.71em;color:var(--text-muted);margin-top:8px">Recevez vos alarmes et rappels <strong>en toutes circonstances</strong> — fonctionne nativement sur PC et Android.</div>'
      : notifPerm === 'granted' ?
        '<div style="display:flex;gap:8px;margin-top:10px">' +
        '<button class="btn btn-secondary" onclick="deactivateNotifications()" style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13.73 21a2 2 0 0 1-3.46 0"/><path d="M18.63 13A17.89 17.89 0 0 1 18 8"/><path d="M6.26 6.26A5.86 5.86 0 0 0 6 8c0 7-3 9-3 9h14"/><path d="M18 8a6 6 0 0 0-9.33-5"/><line x1="2" y1="2" x2="22" y2="22"/></svg>Désactiver</button>' +
        (hasFcmToken ? '' : '<button class="btn btn-primary" onclick="activateNotifications()" style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>Re-enregistrer</button>') +
        '</div>' +
        '<button class="btn btn-primary" onclick="testNotification()" style="margin-top:8px;width:100%;background:rgba(123,139,245,0.12);border-color:var(--cyan);display:flex;align-items:center;justify-content:center;gap:6px"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>Tester une notification</button>' +
        '<div style="font-size:0.71em;color:var(--text-muted);margin-top:8px;display:flex;align-items:center;gap:5px">' +
        (hasFcmToken ? '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="var(--cyan)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>Push Serverless actif — Vous recevrez des alertes même site fermé.' : '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="var(--text-muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>Notifications non enregistrées. Cliquez sur Re-enregistrer.') +
        '</div>'
      : notifPerm === 'denied' ?
        '<div style="background:rgba(255,77,109,0.1);border:1px solid rgba(255,77,109,0.3);border-radius:10px;padding:12px;margin-top:10px;font-size:0.78em;color:var(--text-muted);display:flex;gap:8px;align-items:flex-start">' +
        '<svg viewBox="0 0 24 24" width="14" height="14" flex-shrink:0;margin-top:1px fill="none" stroke="#f87171" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:1px"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' +
        '<span>Les notifications ont été bloquées par votre navigateur. Pour les réactiver, cliquez sur l\'icône de cadenas dans la barre d\'adresse et autorisez les notifications pour E.V.A.</span>' +
        '</div>'
      : '') +
      '</div>' +
      '<div class="settings-section">' +
      '<div class="settings-section-title">Types de notifications</div>' +
      '<div class="settings-row">' +
        '<div style="display:flex;align-items:center;gap:8px"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="var(--cyan)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg><div><div class="settings-row-label">Alarmes</div><div class="settings-row-sub">Alerte + boutons Arrêter / Reporter (arrière-plan)</div></div></div>' +
        '<span style="color:var(--cyan);font-size:0.75em">Auto</span>' +
      '</div>' +
      '<div class="settings-row">' +
        '<div style="display:flex;align-items:center;gap:8px"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="var(--cyan)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg><div><div class="settings-row-label">Rappels</div><div class="settings-row-sub">Notification à l\'heure exacte (arrière-plan)</div></div></div>' +
        '<span style="color:var(--cyan);font-size:0.75em">Auto</span>' +
      '</div>' +
      '<div class="settings-row">' +
        '<div style="display:flex;align-items:center;gap:8px"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="var(--cyan)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><div><div class="settings-row-label">Événements calendrier</div><div class="settings-row-sub">Alerte 15 min avant (arrière-plan)</div></div></div>' +
        '<span style="color:var(--cyan);font-size:0.75em">Auto</span>' +
      '</div>' +
      '</div>' +
      '<div class="settings-section">' +
      '<div class="settings-section-title">Appareils enregistrés</div>' +
      (_allDevices.length === 0 ?
        '<div style="font-size:0.78em;color:var(--text-muted);padding:8px 0">Aucun appareil enregistré. Activez les notifications push pour enregistrer cet appareil.</div>'
      : _allDevices.map(function(d) {
          var isCurrent = d.token === _fcmToken;
          var dateStr = d.registeredAt ? new Date(d.registeredAt).toLocaleDateString('fr-FR', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
          var nameHtml = '<span style="font-weight:600">' + esc(d.name || 'Appareil inconnu') + '</span>' +
            (isCurrent ? ' <span style="color:var(--cyan);font-size:0.82em">(cet appareil)</span>' : '') +
            (d.legacy ? ' <span style="color:var(--text-dim);font-size:0.75em;font-style:italic">ancien token</span>' : '');
          return '<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">' +
            '<div style="flex:1;min-width:0">' +
              '<div style="font-size:0.82em;color:var(--text)">' + nameHtml + '</div>' +
              '<div style="font-size:0.71em;color:var(--text-muted);margin-top:2px">' +
                (d.ip && d.ip !== '—' ? 'IP : ' + esc(d.ip) + ' · ' : '') + dateStr +
              '</div>' +
            '</div>' +
            '<button class="btn btn-danger" style="padding:4px 10px;font-size:0.75em;flex-shrink:0" onclick="revokeDevice(this.dataset.token)" data-token="' + esc(d.token) + '">Révoquer</button>' +
          '</div>';
        }).join('')) +
      '</div>' +
      '<div class="settings-section">' +
      '<div class="settings-section-title">Compatibilité</div>' +
      '<div style="font-size:0.75em;color:var(--text-muted);line-height:2.1">' +
      (function(){
        var ok = '<svg viewBox="0 0 24 24" width="12" height="12" style="display:inline-block;vertical-align:middle;margin-right:5px;stroke:#4ade80;fill:none;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round"><polyline points="20 6 9 17 4 12"/></svg>';
        var no = '<svg viewBox="0 0 24 24" width="12" height="12" style="display:inline-block;vertical-align:middle;margin-right:5px;stroke:#f87171;fill:none;stroke-width:2.5;stroke-linecap:round;stroke-linejoin:round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
        return ok+'Chrome PC &amp; Android<br>'+ok+'Edge PC &amp; Android<br>'+ok+'Firefox PC &amp; Android<br>'+ok+'Opera PC &amp; Android<br>'+ok+'Safari iOS 16.4+ (iPad &amp; iPhone)<br>'+no+'<span style="color:var(--text-dim)">Safari macOS (non supporté)</span>';
      })() +
      '</div>' +
      '</div>';

  } else if (section === 'dev') {
    var devKey = (S.profile && S.profile.devKey) || '';
    var devLabel = (S.profile && S.profile.devKeyLabel) || '';
    var devRole = (S.profile && S.profile.role) || 'user';
    var roleColors = {creator:'#ffd700',developer:'var(--cyan)',creator_wife:'#ff69b4',user:'#aaa'};
    var roleLabels = {creator:'👑 Créateur',developer:'⚙️ Développeur',creator_wife:'💎 Épouse du créateur',user:'👤 Utilisateur'};
    c.innerHTML =
      '<div class="settings-section">' +
      '<div class="settings-section-title">Clés Développeur</div>' +
      '<div class="settings-row" style="padding:10px 0;border-bottom:1px solid var(--border);margin-bottom:12px">' +
      '<div><div class="settings-row-label">Rôle actuel</div></div>' +
      '<div style="font-size:0.82em;color:'+esc(roleColors[devRole.toLowerCase()]||roleColors[devRole]||'#aaa')+'">'+esc(roleLabels[devRole.toLowerCase()]||roleLabels[devRole]||devLabel||devRole)+'</div>' +
      '</div>' +
      (devKey ?
        '<div style="font-size:0.76em;color:var(--text-muted);margin-bottom:12px">Clé active : <code style="color:var(--cyan)">'+esc(devKey)+'</code>' +
        (devLabel ? ' — ' + esc(devLabel) : '') + '</div>' : ''
      ) +
      '<div class="form-field"><label class="form-label">Entrer une clé d\'accès</label>' +
      '<input type="text" class="form-input" id="sDevKey" placeholder="ASTRAL-XXXXX-XXXXX" value="'+esc(devKey)+'" autocomplete="off" spellcheck="false">' +
      '<div class="settings-row-sub" style="margin-top:4px">Permet de débloquer les rôles Développeur, Créateur ou Épouse du créateur. Les clés sont fournies par Astral Technologie.</div></div>' +
      '<div id="sDevKeyStatus" style="margin:6px 0;font-size:0.8em;min-height:18px"></div>' +
      '</div>' +
      '<div style="display:flex;gap:8px">' +
      '<button class="btn btn-primary" onclick="activateDevKeyDirect()">🔑 Activer la clé</button>' +
      (devKey ? '<button class="btn btn-secondary" onclick="deactivateDevKeyDirect()">Désactiver</button>' : '') +
      '</div>';

  } else if (section === 'tutorial') {
    c.innerHTML =
      '<div class="settings-section">' +
        '<div class="settings-section-title">Revoir le tutoriel</div>' +
        '<div style="font-size:0.8em;color:var(--text-muted);margin-bottom:20px;line-height:1.6;">Chaque version du tutoriel est adaptée à son interface. Lancez celui qui correspond à l\'appareil sur lequel vous consultez E.V.A.</div>' +

        /* PC card */
        '<div style="display:flex;flex-direction:column;gap:12px;">' +
          '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:14px;padding:18px;display:flex;align-items:center;gap:16px;">' +
            '<div style="width:48px;height:48px;border-radius:12px;background:rgba(123,139,245,0.1);border:1px solid rgba(123,139,245,0.25);display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
              '<svg viewBox="0 0 24 24" style="width:22px;height:22px;stroke:var(--cyan);fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>' +
            '</div>' +
            '<div style="flex:1;min-width:0;">' +
              '<div style="font-weight:700;color:var(--text);font-size:0.9em;margin-bottom:3px;">Tutoriel Web (Ordinateur)</div>' +
              '<div style="font-size:0.74em;color:var(--text-muted);line-height:1.5;">8 étapes · Interface complète, raccourcis clavier, header, tones, contrôle média, paramètres avancés.</div>' +
            '</div>' +
            '<button class="btn btn-secondary" style="flex-shrink:0;" onclick="closeSettings();setTimeout(showTutorialPC,200);">Lancer</button>' +
          '</div>' +

          /* Mobile card */
          '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:14px;padding:18px;display:flex;align-items:center;gap:16px;">' +
            '<div style="width:48px;height:48px;border-radius:12px;background:rgba(124,92,255,0.1);border:1px solid rgba(124,92,255,0.25);display:flex;align-items:center;justify-content:center;flex-shrink:0;">' +
              '<svg viewBox="0 0 24 24" style="width:22px;height:22px;stroke:#7c5cff;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;"><rect x="5" y="2" width="14" height="20" rx="2"/><circle cx="12" cy="17" r="1" fill="#7c5cff" stroke="none"/></svg>' +
            '</div>' +
            '<div style="flex:1;min-width:0;">' +
              '<div style="font-weight:700;color:var(--text);font-size:0.9em;margin-bottom:3px;">Tutoriel Mobile</div>' +
              '<div style="font-size:0.74em;color:var(--text-muted);line-height:1.5;">6 étapes · Gestes tactiles, voix mains libres, menu hamburger, modules en vue mobile.</div>' +
            '</div>' +
            '<button class="btn btn-secondary" style="flex-shrink:0;" onclick="closeSettings();setTimeout(showTutorialMobile,200);">Lancer</button>' +
          '</div>' +
        '</div>' +

        '<div style="margin-top:20px;padding:12px 14px;background:rgba(123,139,245,0.05);border:1px solid rgba(123,139,245,0.15);border-radius:10px;font-size:0.75em;color:var(--text-muted);line-height:1.6;">' +
          'Le tutoriel s\'affiche automatiquement à la première connexion en détectant votre type d\'appareil. Vous pouvez le relancer ici autant de fois que vous voulez.' +
        '</div>' +
      '</div>';
  }
}

/* ── Photo de profil — état temporaire dans les paramètres ── */
var _sNewPhotoDataURL = null; // null = pas de changement, '' = suppression, string = nouvelle photo

function _compressImage(file, maxSize, quality, callback) {
  var reader = new FileReader();
  reader.onload = function(e) {
    var img = new Image();
    img.onload = function() {
      var w = img.width, h = img.height;
      if (w > maxSize || h > maxSize) {
        if (w > h) { h = Math.round(h * maxSize / w); w = maxSize; }
        else       { w = Math.round(w * maxSize / h); h = maxSize; }
      }
      var canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      callback(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function _settingsHandleAvaFile(event) {
  var file = event.target.files[0];
  if (!file) return;
  _compressImage(file, 260, 0.80, function(dataURL) {
    _sNewPhotoDataURL = dataURL;
    var preview = document.getElementById('sAvaPreview');
    if (!preview) return;
    preview.innerHTML = '<img src="'+dataURL+'" alt="Photo de profil"><div class="settings-ava-overlay">CHANGER</div>';
    /* Afficher bouton Supprimer si pas déjà là */
    var actions = preview.parentElement.querySelector('.settings-ava-actions');
    if (actions && !actions.querySelector('[data-del]')) {
      var delBtn = document.createElement('button');
      delBtn.className = 'btn btn-secondary';
      delBtn.setAttribute('data-del','1');
      delBtn.style.cssText = 'font-size:0.73em;padding:4px 12px;border-color:rgba(239,68,68,0.4);color:#ef4444;';
      delBtn.textContent = 'Supprimer';
      delBtn.onclick = _settingsRemovePhoto;
      actions.appendChild(delBtn);
    }
    toast('Photo prête — cliquez sur Sauvegarder', 'info');
  });
}

function _settingsRemovePhoto() {
  _sNewPhotoDataURL = '';
  var preview = document.getElementById('sAvaPreview');
  if (!preview) return;
  var name = (document.getElementById('sDisplayName')||{}).value || (S.profile && S.profile.displayName) || '?';
  var initials = name.split(' ').map(function(n){return n[0]||'';}).join('').toUpperCase().slice(0,2) || '?';
  preview.innerHTML = '<span id="sAvaInitials">'+initials+'</span><div class="settings-ava-overlay">CHANGER</div>';
  var delBtn = preview.parentElement && preview.parentElement.querySelector('[data-del]');
  if (delBtn) delBtn.remove();
  toast('Photo supprimée — cliquez sur Sauvegarder', 'info');
}

function _settingsUpdateInitials() {
  if (_sNewPhotoDataURL !== null) return; /* photo déjà sélectionnée */
  var iniEl = document.getElementById('sAvaInitials');
  if (!iniEl) return;
  var name = (document.getElementById('sDisplayName')||{}).value || '?';
  iniEl.textContent = name.split(' ').map(function(n){return n[0]||'';}).join('').toUpperCase().slice(0,2) || '?';
}
window._settingsHandleAvaFile = _settingsHandleAvaFile;
window._settingsRemovePhoto   = _settingsRemovePhoto;
window._settingsUpdateInitials = _settingsUpdateInitials;

async function saveProfileSettings() {
  var name = document.getElementById('sDisplayName').value.trim();
  var nick = document.getElementById('sNickname').value.trim();
  var bio = (document.getElementById('sBio') || {}).value || '';
  var lang = (document.getElementById('sLang') || {}).value || 'fr';
  if (!S.user) return;
  try {
    var upd = {displayName:name, nickname:nick, bio:bio.trim(), lang:lang};
    /* Photo : null = pas changée, '' = supprimée, string = nouvelle */
    if (_sNewPhotoDataURL !== null) {
      upd.photoURL = _sNewPhotoDataURL || null;
    }
    await db.collection('users').doc(S.user.uid).set(upd, {merge:true});
    S.profile = Object.assign(S.profile||{}, upd);
    _sNewPhotoDataURL = null; /* réinitialiser l'état */
    renderUserUI(S.profile);
    if (bio.trim()) { window._userBio = bio.trim(); }
    toast('Profil mis à jour ✓','success');
  } catch(e) { toast('Erreur sauvegarde','error'); }
}

async function saveAISettings() {
  /* Feedback immédiat sur le bouton */
  var applyBtn = document.getElementById('applyAIBtn');
  if (applyBtn) {
    applyBtn.textContent = '⏳ Application...';
    applyBtn.disabled = true;
    applyBtn.style.opacity = '0.8';
  }

  var prov = document.getElementById('sProvider').value;
  S.config.aiProvider = prov;
  var k;
  /* Modèle sélectionné pour ce provider */
  var modelSel = document.getElementById('sModel');
  if (modelSel && modelSel.value) {
    var mk = {eva:'evaModel',puter:'puterModel',pollinations:'pollinationsModel',openai:'openaiModel',claude:'claudeModel',qwen:'qwenModel'}[prov];
    if (mk) S.config[mk] = modelSel.value;
  }
  k = document.getElementById('sApiKeyOpenAI'); if(k) S.config.openaiApiKey = k.value.trim();
  k = document.getElementById('sApiKeyClaude'); if(k) S.config.claudeApiKey = k.value.trim();
  k = document.getElementById('sLMStudioURL'); if(k && k.value.trim()) S.config.lmstudioUrl = k.value.trim();
  k = document.getElementById('sOllamaURL'); if(k && k.value.trim()) S.config.ollamaUrl = k.value.trim();
  k = document.getElementById('sOllamaModel'); if(k && k.value.trim()) S.config.ollamaModel = k.value.trim();
  k = document.getElementById('sContextLen'); if(k) S.config.contextLength = parseInt(k.value);

  /* Sauvegarde locale */
  saveCfg();

  /* Sauvegarde locale uniquement pour PC (Pas de Firebase) */
  // if (S.user && S.user.uid) {
  //   try {
  //     await db.collection('users').doc(S.user.uid).set(
  //       { preferences: S.config },
  //       { merge: true }
  //     );
  //   } catch(e) { console.warn('[EVA] Firebase AI prefs save:', e); }
  // }

  /* Réinitialiser le conv state pour que la nouvelle conv utilise le nouveau provider */
  if (!S.convId) S.conv = {};

  /* Pour Qwen : ne pas initialiser maintenant (téléchargement lourd, se fait au 1er message) */
  if (prov !== 'qwen') {
    if (window.EVAChatHandler) {
      await window.EVAChatHandler.initChatHandler(Object.assign({aiProvider:prov},S.config));
    }
  } else {
    /* Réinitialiser l'état du provider Qwen pour forcer re-téléchargement si modèle changé */
    if (window.EVAChatHandler) {
      window.EVAChatHandler.initChatHandler(Object.assign({aiProvider:prov},S.config));
    }
  }

  updateProviderLabel(prov);
  updateModelSelectUI();

  /* Feedback bouton — Appliqué */
  if (applyBtn) {
    applyBtn.textContent = '✓ Appliqué';
    applyBtn.disabled = false;
    applyBtn.style.opacity = '1';
    applyBtn.style.background = '#00c853';
    applyBtn.style.borderColor = '#00c853';
  }

  /* Noms lisibles */
  var provNames = {puter:'Puter Cloud',openai:'OpenAI',claude:'Claude (Anthropic)',qwen:'Qwen Local',lmstudio:'LM Studio',ollama:'Ollama'};
  var provLabel = provNames[prov] || prov;
  toast('✓ Fournisseur IA appliqué : ' + provLabel, 'success');

  /* Fermer après 1.5s */
  setTimeout(closeSettings, 1500);
}

/* ─── Render TTS provider sub-options ─────────────────────── */
function renderTTSProvOpts(provider) {
  var el = document.getElementById('sTTSProvOpts');
  if (!el) return;
  var c = S.config;

  var keyInputStyle = 'font-family:monospace;font-size:0.78em;letter-spacing:0.05em;';
  var hintStyle = 'font-size:0.67em;color:var(--text-muted);margin-top:3px;line-height:1.4;';

  if (provider === 'eva') {
    el.innerHTML =
      '<div style="background:rgba(168,85,247,0.07);border:1px solid rgba(168,85,247,0.25);border-radius:8px;padding:10px 12px;margin-bottom:10px;font-size:0.69em;color:rgba(192,132,252,0.9);line-height:1.5;">' +
      '🧠 <strong>Kokoro Neural</strong> — Voix française <strong>féminine</strong> via Piper VITS (~63 Mo, mis en cache au 1er usage). Identique sur tous les navigateurs.' +
      '</div>' +
      '<div style="font-size:0.7em;color:var(--text-muted);line-height:1.5;">Aucun choix de voix nécessaire.</div>';

  } else if (provider === 'native') {
    el.innerHTML =
      '<div class="form-field"><label class="form-label">Langue</label>' +
      '<select class="form-select" id="sTTSLang">' +
      '<option value="fr-FR"'+((c.voiceLang||'fr-FR')==='fr-FR'?' selected':'')+'>🇫🇷 Français (France)</option>' +
      '<option value="fr-BE"'+(c.voiceLang==='fr-BE'?' selected':'')+'>🇧🇪 Français (Belgique)</option>' +
      '<option value="fr-CA"'+(c.voiceLang==='fr-CA'?' selected':'')+'>🇨🇦 Français (Canada)</option>' +
      '<option value="en-US"'+(c.voiceLang==='en-US'?' selected':'')+'>🇺🇸 English (US)</option>' +
      '<option value="en-GB"'+(c.voiceLang==='en-GB'?' selected':'')+'>🇬🇧 English (UK)</option>' +
      '</select></div>';

  } else if (provider === 'elevenlabs') {
    /* IMPORTANT: type="text" pas "password" — les champs password peuvent être vidés par le navigateur avant lecture */
    var maskedKey = c.elevenLabsApiKey ? c.elevenLabsApiKey : '';
    var savedVoiceId = c.elevenLabsVoiceId || '';
    el.innerHTML =
      '<div class="form-field">' +
      '<label class="form-label">Clé API ElevenLabs <span style="color:var(--cyan);font-size:0.8em">'+(maskedKey?'✓ configurée':'✗ manquante')+'</span></label>' +
      '<input type="text" class="form-input" id="sElevenLabsKey" style="'+keyInputStyle+'" value="'+esc(maskedKey)+'" placeholder="sk_... (votre clé ElevenLabs)" autocomplete="off" spellcheck="false">' +
      '<div style="'+hintStyle+'">Disponible sur <em>elevenlabs.io</em> → Profil → API Keys</div></div>' +
      '<div class="form-field">' +
      '<label class="form-label">ID de voix <span style="color:var(--text-muted);font-size:0.8em">optionnel</span></label>' +
      '<input type="text" class="form-input" id="sElevenLabsVoiceId" style="'+keyInputStyle+'" value="'+esc(savedVoiceId)+'" placeholder="ex: 21m00Tcm4TlvDq8ikWAM  (laisser vide = voix Rachel par défaut)" autocomplete="off" spellcheck="false">' +
      '<div style="'+hintStyle+'">Sur <em>elevenlabs.io</em> → Mes Voix → cliquer sur ta voix → l\'ID est dans l\'URL ou dans l\'onglet ID</div></div>';

  } else if (provider === 'piper') {
    var piperVoice = c.piperVoice || 'fr_FR-siwis-medium';
    var piperVoices = [
      { id:'fr_FR-siwis-medium', label:'Siwis (féminine, classique) ⭐' },
      { id:'fr_FR-upmc-medium',  label:'UPMC (féminine, autre timbre)' }
    ];
    /* Voix retirées :
       • *-low (siwis-low, gilles-low, mls_1840-low) → vocab 130 trop petit
         pour le phonémiseur piper-phonemize@1.0.0 (crash ONNX)
       • masculines (tom-medium) et multi-locuteurs (mls-medium) →
         retirées sur demande, EVA est une voix féminine. */
    el.innerHTML =
      '<div style="background:rgba(74,222,128,0.07);border:1px solid rgba(74,222,128,0.25);border-radius:8px;padding:10px 12px;margin-bottom:10px;font-size:0.69em;color:rgba(167,243,208,0.95);line-height:1.5;">' +
      '🇫🇷 <strong>Piper TTS</strong> — Synthèse vocale neuronale 100 % locale (WebAssembly). Voix française féminine claire et naturelle. Aucune clé requise. Au premier usage, ~63 Mo se téléchargent puis tout fonctionne hors-ligne.' +
      '</div>' +
      '<div class="form-field"><label class="form-label">Voix française</label>' +
      '<select class="form-select" id="sPiperVoice">' +
      piperVoices.map(function(v){
        return '<option value="'+v.id+'"'+(piperVoice===v.id?' selected':'')+'>'+v.label+'</option>';
      }).join('') +
      '</select></div>';

  } else if (provider === 'openai') {
    var oaiKey = c.openAITTSApiKey || c.openaiApiKey || '';
    el.innerHTML =
      '<div class="form-field">' +
      '<label class="form-label">Clé API OpenAI <span style="color:var(--cyan);font-size:0.8em">'+(oaiKey?'✓ configurée':'✗ manquante')+'</span></label>' +
      '<input type="text" class="form-input" id="sOpenAITTSKey" style="'+keyInputStyle+'" value="'+esc(oaiKey)+'" placeholder="sk-... (votre clé OpenAI)" autocomplete="off" spellcheck="false">' +
      '<div style="'+hintStyle+'">Même clé que votre provider IA si vous utilisez OpenAI.</div></div>' +
      '<div class="form-field"><label class="form-label">Voix</label>' +
      '<select class="form-select" id="sOpenAITTSVoice">' +
      ['nova','alloy','shimmer','echo','onyx','fable'].map(function(v){
        return '<option value="'+v+'"'+((c.openAITTSVoice||'nova')===v?' selected':'')+'>'+v+'</option>';
      }).join('') +
      '</select></div>';

  } else {
    el.innerHTML = '';
  }
}
window.renderTTSProvOpts = renderTTSProvOpts;

async function saveVoiceSettings() {
  /* TTS on/off */
  var ttsCb = document.getElementById('sTTS');
  if (ttsCb) { S.ttsOn = ttsCb.checked; S.config.ttsOn = S.ttsOn; }

  /* Vitesse */
  var srEl = document.getElementById('sSpeechRate');
  if (srEl) S.config.speechRate = parseFloat(srEl.value) || 1.0;

  /* Provider — lecture directe du select */
  var provSel = document.getElementById('sTTSProvider');
  if (provSel) {
    S.config.voiceProvider = provSel.value;
    console.log('[VOICE] saveVoiceSettings — provider sélectionné:', provSel.value);
  } else {
    console.warn('[VOICE] saveVoiceSettings — #sTTSProvider introuvable');
  }

  /* Sous-options — lire systématiquement (sans condition sur valeur vide) */
  var k;
  k = document.getElementById('sTTSLang');
  if (k) S.config.voiceLang = k.value;

  /* Clé ElevenLabs — lire sans condition ; vide = effacer la clé */
  k = document.getElementById('sElevenLabsKey');
  if (k) {
    var elKey = k.value.trim();
    S.config.elevenLabsApiKey = elKey;
    console.log('[VOICE] elevenLabsApiKey:', elKey ? '✓ présente ('+elKey.length+' car.)' : '✗ vide');
  }
  /* Voice ID ElevenLabs */
  k = document.getElementById('sElevenLabsVoiceId');
  if (k) {
    var elVoiceId = k.value.trim();
    S.config.elevenLabsVoiceId = elVoiceId;
    console.log('[VOICE] elevenLabsVoiceId:', elVoiceId || '(défaut Rachel)');
  }

  /* Clé OpenAI TTS */
  k = document.getElementById('sOpenAITTSKey');
  if (k) {
    var oaiKey = k.value.trim();
    if (oaiKey) S.config.openAITTSApiKey = oaiKey;
  }

  k = document.getElementById('sOpenAITTSVoice');
  if (k) S.config.openAITTSVoice = k.value;

  /* Voix Piper TTS — locale, sans clé */
  k = document.getElementById('sPiperVoice');
  if (k && k.value) {
    S.config.piperVoice = k.value;
    /* Pré-chargement du modèle dès la sauvegarde pour éviter la latence au premier message */
    if (window.PiperTTS && window.PiperTTS.warmup) {
      try { window.PiperTTS.warmup({ piperVoice: k.value }); } catch(e) {}
    }
  }

  /* EVA Voice */
  k = document.getElementById('sEvaVoice');
  if (k) S.config.evaVoice = k.value;

  /* Wake word */
  var ww = document.getElementById('sWakeWord');
  if (ww) {
    S.wakeWordOn = ww.checked;
    S.config.wakeWordOn = S.wakeWordOn;
    var wwBtn = document.getElementById('wakeWordBtn');
    if (wwBtn) wwBtn.classList.toggle('active', S.wakeWordOn);
    if (S.wakeWordOn) { if (window.EVAWakeWord) window.EVAWakeWord.start(); }
    else              { if (window.EVAWakeWord) window.EVAWakeWord.stop();  }
  }

  /* Sauvegarde locale */
  saveCfg();
  if (window.updateTtsBtn) window.updateTtsBtn();

  /* Mise à jour du badge provider dans l'UI */
  updateProviderBadge();

  /* Sauvegarde locale uniquement pour PC (Pas de Firebase) */
  // if (S.user && S.user.uid) {
  //   try {
  //     await db.collection('users').doc(S.user.uid).set(
  //       { preferences: S.config },
  //       { merge: true }
  //     );
  //   } catch(e) { console.warn('[EVA] Firebase voice prefs save:', e); }
  // }

  var provLabel = {'eva-custom':'EVA Voice Perso','native':'Navigateur','eva':'Kokoro Neural','elevenlabs':'ElevenLabs','openai':'OpenAI TTS','piper':'Piper TTS (FR)'}[S.config.voiceProvider||'piper'] || S.config.voiceProvider;
  toast('✓ Paramètres audio sauvegardés — provider : ' + provLabel, 'success');

  /* Re-render les options pour afficher l'état mis à jour des clés */
  if (provSel) setTimeout(function(){ renderTTSProvOpts(provSel.value); }, 100);
}
window.saveVoiceSettings = saveVoiceSettings;

/* Badge compact sous le bouton TTS indiquant le provider actif */
function updateProviderBadge() { /* badge supprimé */ }
window.updateProviderBadge = updateProviderBadge;

/* ══════════════════ EXPORT CONVERSATIONS ══════════════════ */
function toggleExportMenu() {
  var m = document.getElementById('exportMenu');
  if (m) m.classList.toggle('open');
}
document.addEventListener('click', function(e) {
  var wrap = document.getElementById('hdrExportWrap');
  if (wrap && !wrap.contains(e.target)) {
    var m = document.getElementById('exportMenu');
    if (m) m.classList.remove('open');
  }
});

async function exportCurrentConv(fmt) {
  document.getElementById('exportMenu').classList.remove('open');
  if (!S.convId || !S.user) { toast('Aucune conversation active','error'); return; }
  try {
    var convRef = db.collection('users').doc(S.user.uid).collection('conversations').doc(S.convId);
    var convDoc = await convRef.get();
    var msgsSnap = await convRef.collection('messages').orderBy('timestamp').get();
    var msgs = msgsSnap.docs.map(function(d){ return d.data(); });
    var convData = convDoc.data() || {};
    var title = (convData.title || 'Conversation').replace(/[^a-zA-Z0-9\u00C0-\u024F\s_-]/g,'').trim();
    var date = new Date().toLocaleDateString('fr-FR').replace(/\//g,'-');
    var filename = 'EVA_' + title.slice(0,30) + '_' + date;
    var content, type, ext;
    if (fmt === 'json') {
      content = JSON.stringify({ conversation: convData, messages: msgs }, null, 2);
      type = 'application/json'; ext = '.json';
    } else {
      content = '=== CONVERSATION E.V.A ===\n';
      content += 'Titre : ' + (convData.title || 'Sans titre') + '\n';
      content += 'Exportée le : ' + new Date().toLocaleString('fr-FR') + '\n';
      content += '═'.repeat(50) + '\n\n';
      msgs.forEach(function(m) {
        var who = m.role === 'user' ? 'Vous' : 'EVA';
        var ts = m.createdAt && m.createdAt.toDate ? m.createdAt.toDate().toLocaleTimeString('fr-FR') : '';
        content += '[' + ts + '] ' + who + ' :\n' + (m.content || '') + '\n\n';
      });
      type = 'text/plain'; ext = '.txt';
    }
    var blob = new Blob([content], {type: type});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename + ext;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
    toast('Conversation exportée ✓', 'success');
  } catch(e) { console.error(e); toast('Erreur export','error'); }
}

/* ══════════════════ PUTER AUTH ══════════════════ */
async function getPuterStatus() {
  if (!window.puter) return null;
  try { return await puter.auth.getUser(); } catch(e) { return null; }
}
function connectPuter() {
  if (!window.puter) { toast('Puter non disponible','error'); return; }
  var authPromise;
  try {
    authPromise = puter.auth.signIn();
  } catch(err) {
    console.error('[EVA] puter.auth.signIn() error immédiate:', err);
    toast("Impossible d'ouvrir la fenêtre Puter", "error");
    return;
  }

  // On gère la suite de manière asynchrone
  authPromise.then(function() {
    return puter.auth.getUser();
  }).then(function(user) {
    if (user && user.username) {
      S.config.puterUsername = user.username;
      saveCfg();
      if (S.user) {
        db.collection('users').doc(S.user.uid).set({puterUsername: user.username}, {merge:true}).catch(function(){});
      }
      toast('Puter connecté : ' + user.username, 'success');
      renderSettings('ai');
    } else {
      toast('Connexion Puter annulée','error');
    }
  }).catch(function(err) {
    console.error('[EVA] Erreur détaillée connexion Puter:', err); 
    var msg = (err && err.message) ? err.message : (err && err.error) ? err.error : 'inconnue';
    toast('Connexion Puter échouée (' + msg + ')','error'); 
  });
}
async function refreshPuterStatusUI() {
  var statusEl = document.getElementById('puterConnectStatus');
  var btnsEl = document.getElementById('puterConnectButtons');
  if (!statusEl || !btnsEl) return;
  statusEl.textContent = 'Vérification...';
  var user = await getPuterStatus();
  if (user && user.username) {
    statusEl.innerHTML = '<span class="puter-connected">✓ Connecté en tant que <strong>'+esc(user.username)+'</strong></span>';
    btnsEl.innerHTML = '<button class="btn btn-secondary" style="margin-top:6px;font-size:0.78em" onclick="disconnectPuter()">🔌 Déconnecter Puter</button>';
  } else {
    statusEl.innerHTML = '<span class="puter-disconnected">⚠️ Non connecté à Puter. La connexion est requise pour utiliser ce provider.</span>';
    btnsEl.innerHTML = '<button class="btn btn-primary" style="margin-top:6px;font-size:0.78em" onclick="connectPuter()">🔗 Se connecter à Puter</button>';
  }
}

async function disconnectPuter() {
  if (!window.puter) return;
  try {
    await puter.auth.signOut();
    S.config.puterUsername = null;
    saveCfg();
    if (S.user) {
      await db.collection('users').doc(S.user.uid).set({puterUsername: null}, {merge:true});
    }
    toast('Puter déconnecté','info');
    renderSettings('ai');
  } catch(e) {}
}

/* ══════════════════ ACCOUNT — CHANGE EMAIL / PASSWORD ══════════════════ */
async function changeEmail() {
  var newEmail = (document.getElementById('sNewEmail') || {}).value.trim();
  var pass = (document.getElementById('sEmailPassword') || {}).value;
  if (!newEmail || !pass) { toast('Renseignez l\'email et votre mot de passe','error'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) { toast('Adresse email invalide','error'); return; }
  if (!auth.currentUser) return;
  try {
    var cred = firebase.auth.EmailAuthProvider.credential(auth.currentUser.email, pass);
    await auth.currentUser.reauthenticateWithCredential(cred);
    await auth.currentUser.updateEmail(newEmail);
    // Sync email in Firestore user document
    if (S.user && S.user.uid) {
      await db.collection('users').doc(S.user.uid).update({ email: newEmail });
    }
    if (S.profile) S.profile.email = newEmail;
    toast('Email mis à jour ✓','success');
    document.getElementById('sNewEmail').value = '';
    document.getElementById('sEmailPassword').value = '';
    renderSettings('account');
setTimeout(window.renderSessionsList, 100);
  } catch(e) {
    var msg = e.code === 'auth/wrong-password' ? 'Mot de passe incorrect'
      : e.code === 'auth/email-already-in-use' ? 'Email déjà utilisé'
      : e.code === 'auth/invalid-email' ? 'Format d\'email invalide'
      : e.code === 'auth/requires-recent-login' ? 'Session expirée, reconnectez-vous'
      : 'Erreur : ' + e.message;
    toast(msg,'error');
  }
}
async function changePassword() {
  var newPass = (document.getElementById('sNewPassword') || {}).value;
  var confPass = (document.getElementById('sConfPassword') || {}).value;
  if (!newPass || !confPass) { toast('Renseignez les champs mot de passe','error'); return; }
  if (newPass !== confPass) { toast('Les mots de passe ne correspondent pas','error'); return; }
  if (newPass.length < 6) { toast('Minimum 6 caractères requis','error'); return; }
  if (!auth.currentUser) return;

  var isGoogleOnly = auth.currentUser.providerData &&
    auth.currentUser.providerData.some(function(p){return p.providerId==='google.com';}) &&
    !auth.currentUser.providerData.some(function(p){return p.providerId==='password';});

  if (isGoogleOnly) {
    try {
      var cred = firebase.auth.EmailAuthProvider.credential(auth.currentUser.email, newPass);
      await auth.currentUser.linkWithCredential(cred);
      toast('Mot de passe créé avec succès ✓','success');
      document.getElementById('sNewPassword').value = '';
      document.getElementById('sConfPassword').value = '';
      renderSettings('account');
    } catch(e) {
      var msg = e.code === 'auth/provider-already-linked' ? 'Un mot de passe existe déjà — rechargez la page'
        : e.code === 'auth/weak-password' ? 'Mot de passe trop faible (minimum 6 caractères)'
        : 'Erreur : ' + e.message;
      toast(msg,'error');
    }
  } else {
    var curPass = (document.getElementById('sCurPassword') || {}).value;
    if (!curPass) { toast('Renseignez le mot de passe actuel','error'); return; }
    if (newPass === curPass) { toast('Le nouveau mot de passe doit être différent','error'); return; }
    try {
      var cred2 = firebase.auth.EmailAuthProvider.credential(auth.currentUser.email, curPass);
      await auth.currentUser.reauthenticateWithCredential(cred2);
      await auth.currentUser.updatePassword(newPass);
      toast('Mot de passe mis à jour ✓','success');
      document.getElementById('sCurPassword').value = '';
      document.getElementById('sNewPassword').value = '';
      document.getElementById('sConfPassword').value = '';
    } catch(e) {
      var msg = e.code === 'auth/wrong-password' ? 'Mot de passe actuel incorrect'
        : e.code === 'auth/weak-password' ? 'Mot de passe trop faible (minimum 6 caractères)'
        : e.code === 'auth/requires-recent-login' ? 'Session expirée — reconnectez-vous'
        : 'Erreur : ' + e.message;
      toast(msg,'error');
    }
  }
}

/* ── Mémoire Évolutive : toggle & reset ── */
async function toggleAdaptation(enabled) {
  if (!S.user) return;
  S.adaptationEnabled = enabled;
  if (S.profile) S.profile.adaptationEnabled = enabled;
  try {
    await db.collection('users').doc(S.user.uid).set({ adaptationEnabled: enabled }, { merge: true });
    toast(enabled ? '🧠 Mémoire Évolutive activée' : 'Mémoire Évolutive désactivée', 'success');
  } catch(e) { toast('Erreur sauvegarde', 'error'); }
}
window.toggleAdaptation = toggleAdaptation;

async function resetEvaMemory() {
  if (!S.user) return;
  if (!confirm('EFFACEMENT NEURONAL : Effacer toute la mémoire qu\'EVA a apprise sur vous ? Cette action est irréversible.')) return;
  try {
    await db.collection('users').doc(S.user.uid).set({ evaMemory: null }, { merge: true });
    S.evaMemory = null;
    if (S.profile) S.profile.evaMemory = null;
    S._msgSinceExtract = 0;
    toast('Mémoire effacée', 'success');
    renderSettings('brain');
  } catch(e) { toast('Erreur', 'error'); }
}
window.resetEvaMemory = resetEvaMemory;

window.exportEvaMemory = function() {
  if (!S.evaMemory) return toast('Aucune mémoire à exporter', 'warning');
  var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(S.evaMemory, null, 2));
  var downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute("href", dataStr);
  downloadAnchorNode.setAttribute("download", "eva_cerveau_" + Date.now() + ".json");
  document.body.appendChild(downloadAnchorNode);
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
  toast('🧠 Cerveau exporté avec succès', 'success');
};

window.importEvaMemory = function(event) {
  var file = event.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function(e) {
    try {
      var data = JSON.parse(e.target.result);
      if (!data || !data.nodes || !Array.isArray(data.nodes)) throw new Error("Fichier invalide");
      if (confirm('Voulez-vous remplacer la mémoire actuelle par celle de ce fichier ?')) {
        S.evaMemory = data;
        if (S.user && typeof db !== 'undefined') {
          db.collection('users').doc(S.user.uid).set({ evaMemory: data }, { merge: true });
        }
        toast('🧠 Cerveau importé et fusionné !', 'success');
        renderSettings('brain');
      }
    } catch(err) {
      toast("Erreur d'importation : fichier invalide", 'error');
    }
    event.target.value = '';
  };
  reader.readAsText(file);
};

function renderBrainMap() {
  var canvas = document.getElementById('brainCanvas');
  var container = document.getElementById('brainMapContainer');
  if (!canvas || !container) return;
  var ctx = canvas.getContext('2d');
  var w = canvas.width = canvas.offsetWidth;
  var h = canvas.height = canvas.offsetHeight;

  // Création du popup
  var oldPopup = document.getElementById('brainPopup');
  if(oldPopup) oldPopup.remove();
  var popup = document.createElement('div');
  popup.id = 'brainPopup';
  popup.style.cssText = 'position:absolute;top:10px;left:10px;right:10px;bottom:10px;background:rgba(10,15,30,0.95);border:1px solid var(--cyan);border-radius:10px;padding:15px;display:none;flex-direction:column;backdrop-filter:blur(5px);z-index:10;animation:fadeUp 0.3s;box-shadow:0 10px 30px rgba(0,0,0,0.8);';
  popup.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;border-bottom:1px solid rgba(123,139,245,0.2);padding-bottom:5px;"><strong style="color:var(--cyan);font-family:\'Orbitron\',monospace;font-size:1.1em;letter-spacing:1px;" id="brainPopupTitle">Titre</strong><button id="brainPopupClose" style="background:none;border:none;color:var(--text-muted);font-size:1.2em;cursor:pointer;transition:color 0.2s;">✕</button></div><div id="brainPopupDesc" style="font-size:0.82em;color:var(--text);line-height:1.6;overflow-y:auto;flex:1;"></div>';
  container.appendChild(popup);

  document.getElementById('brainPopupClose').onclick = function() {
    popup.style.display = 'none';
  };

  var nodesData = (S.evaMemory && Array.isArray(S.evaMemory.nodes)) ? S.evaMemory.nodes : [];
  var linksData = (S.evaMemory && Array.isArray(S.evaMemory.links)) ? S.evaMemory.links : [];

  var simNodes = [];
  var nodeMap = {};

  if (nodesData.length === 0) {
    for (var i = 0; i < 5; i++) {
      simNodes.push({ id: 'fake'+i, label: '???', details: 'Mémoire vide.', x: Math.random()*w, y: Math.random()*h, vx: 0, vy: 0, r: 6, phase: Math.random()*Math.PI*2 });
    }
  } else {
    nodesData.forEach(function(n) {
      var sn = {
        id: n.id,
        label: n.label,
        details: n.details,
        x: Math.random() * w,
        y: Math.random() * h,
        vx: 0, vy: 0,
        r: (n.id && String(n.id).toLowerCase() === 'utilisateur') || (n.id && String(n.id).toLowerCase() === 'user') ? 14 : 9,
        phase: Math.random() * Math.PI * 2
      };
      simNodes.push(sn);
      nodeMap[n.id] = sn;
    });
  }

  var simLinks = [];
  var linkCounts = {};
  linksData.forEach(function(l) {
    if (nodeMap[l.source] && nodeMap[l.target]) {
      simLinks.push({ source: nodeMap[l.source], target: nodeMap[l.target], label: l.label });
      linkCounts[l.source] = (linkCounts[l.source] || 0) + 1;
      linkCounts[l.target] = (linkCounts[l.target] || 0) + 1;
    }
  });

  // Schéma Radial : Trouver le hub et positionner
  var hubNode = null;
  var maxLinks = -1;
  simNodes.forEach(function(n) {
    var c = linkCounts[n.id] || 0;
    if (c > maxLinks) { maxLinks = c; hubNode = n; }
    // Start everyone at center for the entrance animation
    n.x = w/2;
    n.y = h/2;
  });

  if (hubNode && simNodes.length > 1) {
    hubNode.r = 14;
    hubNode.targetX = w/2;
    hubNode.targetY = h/2;
    var satellites = simNodes.filter(function(n) { return n !== hubNode; });
    var R = 150; // Rayon de base
    satellites.forEach(function(n, i) {
      var layer = Math.floor(i / 12);
      var currentR = R + layer * 100;
      var itemsInLayer = Math.min(satellites.length - layer * 12, 12);
      var angle = ((i % 12) / itemsInLayer) * Math.PI * 2;
      n.targetX = w/2 + currentR * Math.cos(angle);
      n.targetY = h/2 + currentR * Math.sin(angle);
    });
  } else {
    // Si aucun lien ou graphe vide
    simNodes.forEach(function(n, i) {
      n.targetX = w/2;
      n.targetY = h/2;
      if (simNodes.length > 1) {
        var angle = (i / simNodes.length) * Math.PI * 2;
        n.targetX = w/2 + 100 * Math.cos(angle);
        n.targetY = h/2 + 100 * Math.sin(angle);
      }
    });
  }

  var isPanning = false;
  var hasMoved = false;
  var lastX = 0;
  var lastY = 0;
  var offsetX = 0;
  var offsetY = 0;

  canvas.onmousedown = function(e) {
    var rect = canvas.getBoundingClientRect();
    lastX = e.clientX - rect.left;
    lastY = e.clientY - rect.top;
    isPanning = true;
    hasMoved = false;
  };
  
  canvas.onmousemove = function(e) {
    var rect = canvas.getBoundingClientRect();
    var mx = e.clientX - rect.left;
    var my = e.clientY - rect.top;
    
    // Hover effect (en tenant compte de l'offset)
    var hovering = false;
    for (var i=0; i<simNodes.length; i++) {
      if (Math.hypot(simNodes[i].x - (mx - offsetX), simNodes[i].y - (my - offsetY)) < simNodes[i].r + 15) {
        hovering = true; break;
      }
    }
    canvas.style.cursor = isPanning && hasMoved ? 'grabbing' : (hovering ? 'pointer' : 'grab');

    if (isPanning) {
      var dx = mx - lastX;
      var dy = my - lastY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        hasMoved = true;
      }
      offsetX += dx;
      offsetY += dy;
      lastX = mx;
      lastY = my;
    }
  };
  
  canvas.onmouseup = function(e) {
    if (!hasMoved) {
      // C'est un clic !
      var rect = canvas.getBoundingClientRect();
      var mx = e.clientX - rect.left;
      var my = e.clientY - rect.top;
      for (var i=0; i<simNodes.length; i++) {
        var n = simNodes[i];
        if (Math.hypot(n.x - (mx - offsetX), n.y - (my - offsetY)) < n.r + 20) {
          document.getElementById('brainPopupTitle').innerText = n.label || n.id;
          document.getElementById('brainPopupDesc').innerText = n.details || "Aucune information supplémentaire enregistrée.";
          popup.style.display = 'flex';
          break;
        }
      }
    }
    isPanning = false;
    canvas.style.cursor = 'grab';
  };
  
  canvas.onmouseleave = function() {
    isPanning = false;
    canvas.style.cursor = 'grab';
  };
  
  // Set default cursor
  canvas.style.cursor = 'grab';

  var time = 0;

  function draw() {
    if (!document.getElementById('brainCanvas')) return;
    time += 0.05; 
    
    // Schema Animation (Lerp)
    simNodes.forEach(function(n) {
      // Lerp smooth movement vers la position cible
      n.x += (n.targetX - n.x) * 0.04;
      n.y += (n.targetY - n.y) * 0.04;
    });

    // Render
    ctx.clearRect(0, 0, w, h);
    
    ctx.save();
    ctx.translate(offsetX, offsetY);
    
    // Edges
    ctx.lineWidth = 2;
    simLinks.forEach(function(l) {
      ctx.beginPath();
      ctx.moveTo(l.source.x, l.source.y);
      ctx.lineTo(l.target.x, l.target.y);
      var pulse = (Math.sin(time + l.source.phase) + 1) / 2;
      ctx.strokeStyle = 'rgba(123, 139, 245, ' + (0.3 + pulse * 0.3) + ')';
      ctx.stroke();

      var dx = l.target.x - l.source.x;
      var dy = l.target.y - l.source.y;
      var angle = Math.atan2(dy, dx);
      var targetR = l.target.r + 6;
      var arrowX = l.target.x - targetR * Math.cos(angle);
      var arrowY = l.target.y - targetR * Math.sin(angle);
      
      ctx.beginPath();
      ctx.moveTo(arrowX, arrowY);
      ctx.lineTo(arrowX - 8 * Math.cos(angle - Math.PI/7), arrowY - 8 * Math.sin(angle - Math.PI/7));
      ctx.lineTo(arrowX - 8 * Math.cos(angle + Math.PI/7), arrowY - 8 * Math.sin(angle + Math.PI/7));
      ctx.fillStyle = ctx.strokeStyle;
      ctx.fill();

      if (l.label) {
        var mx = l.source.x + dx * 0.4;
        var my = l.source.y + dy * 0.4;
        
        ctx.font = '10px sans-serif';
        var textW = ctx.measureText(l.label).width;
        
        ctx.fillStyle = 'rgba(10, 15, 30, 0.85)';
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(mx - textW/2 - 6, my - 8, textW + 12, 16, 8);
        } else {
            ctx.fillRect(mx - textW/2 - 6, my - 8, textW + 12, 16);
        }
        ctx.fill();
        ctx.strokeStyle = 'rgba(123, 139, 245, 0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.textAlign = 'center';
        ctx.fillText(l.label, mx, my + 3);
      }
    });

    // Nodes
    simNodes.forEach(function(n) {
      ctx.beginPath();
      var rPulse = n.r + Math.sin(time * 2 + n.phase) * 1.5;
      ctx.arc(n.x, n.y, Math.max(1, rPulse), 0, Math.PI * 2);
      ctx.fillStyle = n.r > 9 ? '#06b6d4' : '#7b8bf5';
      ctx.shadowBlur = 12 + Math.sin(time * 3 + n.phase) * 8;
      ctx.shadowColor = ctx.fillStyle;
      ctx.fill();
      ctx.shadowBlur = 0;

      if (n.label) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(n.label, n.x, n.y - rPulse - 6);
      }
    });

    ctx.restore();

    if (!S.adaptationEnabled) {
      ctx.fillStyle = 'rgba(10, 15, 30, 0.7)';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ef4444';
      ctx.font = '14px Orbitron';
      ctx.textAlign = 'center';
      ctx.fillText('APPRENTISSAGE DÉSACTIVÉ', w/2, h/2);
    }

    requestAnimationFrame(draw);
  }
  draw();
}
window.renderBrainMap = renderBrainMap;
function testVoice() {
  if (!window.EVATTS) return;
  /* Débloquer AudioContext immédiatement pendant le geste utilisateur (avant tout await) */
  try {
    if (!window._evaAudioCtx || window._evaAudioCtx.state === 'closed') {
      window._evaAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (window._evaAudioCtx.state === 'suspended') window._evaAudioCtx.resume().catch(function(){});
    /* Transmettre le contexte débloqué à Kokoro si disponible */
    if (window.KokoroTTS && window.KokoroTTS._setCtx) window.KokoroTTS._setCtx(window._evaAudioCtx);
  } catch(e) {}
  var rate    = parseFloat((document.getElementById('sSpeechRate')||{}).value) || 1;
  var provSel = document.getElementById('sTTSProvider');
  var testCfg = Object.assign({}, S.config, {
    voiceProvider: provSel ? provSel.value : (S.config.voiceProvider || 'eva-custom'),
    speechRate: rate
  });
  /* Lire les champs de la section ouverte */
  var k;
  k = document.getElementById('sTTSLang');       if(k) testCfg.voiceLang = k.value;
  k = document.getElementById('sElevenLabsKey'); if(k) testCfg.elevenLabsApiKey = k.value.trim();
  k = document.getElementById('sOpenAITTSKey');  if(k) testCfg.openAITTSApiKey  = k.value.trim();
  k = document.getElementById('sOpenAITTSVoice'); if(k) testCfg.openAITTSVoice = k.value;
  k = document.getElementById('sEvaVoice');      if(k) testCfg.evaVoice = k.value;
  console.log('[testVoice] provider:', testCfg.voiceProvider, '| elevenKey:', testCfg.elevenLabsApiKey ? '✓' : '✗');
  window.EVATTS.speakText("Bonjour ! Je suis E.V.A, votre assistante virtuelle. Ravie de vous parler !", testCfg);
}
window.testVoice = testVoice;

async function clearAllConvs() {
  if (!S.user) return;
  try {
    var snap = await db.collection('users').doc(S.user.uid).collection('conversations').get();
    var batch = db.batch();
    snap.forEach(function(d){ batch.delete(d.ref); });
    await batch.commit();
    S.convs = []; S.convId = null; S.messages = [];
    renderConvs();
    document.getElementById('messagesList').innerHTML = '';
    document.getElementById('chatWelcome').style.display = '';
    toast('Conversations effacées','success');
    closeSettings();
  } catch(e) { toast('Erreur','error'); }
}
window.clearAllConvs = clearAllConvs;
window.saveProfileSettings = saveProfileSettings;
window.saveAISettings = saveAISettings;
window.saveVoiceSettings = saveVoiceSettings;

// Ecouteur pour la connexion Puter via proxy Desktop
if (window.eva && window.eva.onPuterCallback) {
  window.eva.onPuterCallback(function(data) {
    if (data && data.token) {
      if (window.puter) {
        window.puter.auth.signIn(data.token);
      }
      localStorage.setItem('puter_auth_token', data.token);
      S.config.puterUsername = "Connecté (Desktop)";
      saveCfg();
      toast('Puter connecté avec succès', 'success');
      renderSettings('ai');
    }
  });
}

window.revokeSession = async function(sid) {
  if(!confirm("Déconnecter cet appareil ?")) return;
  try {
    await db.collection('users').doc(S.user.uid).collection('sessions').doc(sid).update({ revoked: true });
    toast("Appareil déconnecté", "success");
  } catch(e) {
    toast("Erreur", "error");
  }
};

window.renderSessionsList = function() {
  var c = document.getElementById('sessionsListContainer');
  if(!c) return;
  if(!S.user) return;
  db.collection('users').doc(S.user.uid).collection('sessions').orderBy('lastSeen', 'desc').get().then(function(snap) {
    if(!document.getElementById('sessionsListContainer')) return;
    var html = '';
    snap.forEach(function(doc) {
      var d = doc.data();
      if (d.revoked) return;
      var isMe = doc.id === S.sessionId;
      var dateStr = d.lastSeen && d.lastSeen.toDate ? d.lastSeen.toDate().toLocaleString('fr-FR') : 'Inconnu';
      html += '<div style="background:rgba(255,255,255,0.05);padding:10px;border-radius:8px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;">' +
        '<div>' +
          '<div style="font-weight:bold;font-size:0.9em;color:'+(d.online ? '#4ade80' : 'var(--text-color)')+'">' + (d.device || 'Inconnu') + (isMe ? ' (Cet appareil)' : '') + '</div>' +
          '<div style="font-size:0.75em;color:var(--text-muted)">' + (d.browser || '?') + ' sur ' + (d.os || '?') + '</div>' +
          '<div style="font-size:0.7em;color:var(--text-dim)">Dernière activité: ' + dateStr + '</div>' +
        '</div>' +
        (isMe ? '' : '<button class="btn btn-secondary" style="padding:4px 10px;font-size:0.75em" onclick="revokeSession(\''+doc.id+'\')">Déconnecter</button>') +
      '</div>';
    });
    if(!html) html = '<div style="font-size:0.8em;color:var(--text-muted)">Aucune autre session active.</div>';
    document.getElementById('sessionsListContainer').innerHTML = html;
  });
};



window.loadSessions = function() {
  var c = document.getElementById('sessionsListContainer');
  if(!c) return;
  db.collection('users').doc(S.user.uid).collection('sessions').orderBy('lastSeen', 'desc').onSnapshot(function(snap) {
    if(!document.getElementById('sessionsListContainer')) return;
    c.innerHTML = '';
    if(snap.empty) {
      c.innerHTML = '<div style="color:var(--text-muted);font-size:0.8em;text-align:center;">Aucune session trouvée.</div>';
      return;
    }
    snap.forEach(function(doc) {
      var d = doc.data();
      if(d.revoke) return;
      var isCurrent = (S.sessionId === doc.id);
      
      var lastSeenDate = d.lastSeen && d.lastSeen.toDate ? d.lastSeen.toDate() : new Date();
      var diffMins = Math.floor((new Date() - lastSeenDate) / 60000);
      var isOnline = diffMins < 6 || d.online;
      
      var connDateStr = d.connectedAt && d.connectedAt.toDate ? d.connectedAt.toDate().toLocaleDateString('fr-FR', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'}) : 'Inconnu';
      
      var div = document.createElement('div');
      div.style.cssText = 'background:var(--surface2);border:1px solid ' + (isCurrent ? 'rgba(123,139,245,0.4)' : 'var(--border)') + ';border-radius:10px;padding:12px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;';
      
      var left = '<div style="display:flex;flex-direction:column;">' +
        '<div style="font-weight:700;color:var(--text);font-size:0.9em;display:flex;align-items:center;gap:6px;">' +
        (d.device==='Application PC'?'💻':(d.device==='Mobile'?'📱':'🌐')) + ' ' + (d.os || 'Inconnu') + ' - ' + (d.browser || 'Inconnu') +
        (isCurrent ? '<span style="font-size:0.65em;background:var(--cyan);color:#000;padding:2px 6px;border-radius:4px;">ACTUELLE</span>' : '') +
        '</div>' +
        '<div style="font-size:0.7em;color:var(--text-muted);margin-top:4px;">Connecté le: ' + connDateStr + '</div>' +
        '<div style="font-size:0.7em;color:' + (isOnline ? 'var(--green)' : 'var(--text-dim)') + ';margin-top:2px;">' + 
        (isOnline ? '🟢 En ligne' : '⚪ Hors ligne (Vu il y a ' + (diffMins>60 ? Math.floor(diffMins/60)+'h' : diffMins+'m') + ')') + 
        '</div>' +
      '</div>';
      
      var right = isCurrent ? '' : '<button class="btn btn-danger" style="padding:6px 10px;font-size:0.75em;" onclick="revokeSession(\''+doc.id+'\')">Retirer</button>';
      
      div.innerHTML = left + right;
      c.appendChild(div);
    });
  }, function(e) {
    c.innerHTML = '<div style="color:#ff4d6d;font-size:0.8em;text-align:center;">Erreur de lecture</div>';
  });
};

window.revokeSession = function(sid) {
  if(confirm('Voulez-vous déconnecter cet appareil ?')) {
    db.collection('users').doc(S.user.uid).collection('sessions').doc(sid).update({ revoke: true }).catch(function(e){
      console.error(e);
      alert('Erreur: ' + e.message);
    });
  }
};
