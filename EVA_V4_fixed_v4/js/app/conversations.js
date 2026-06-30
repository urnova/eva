async function loadConvs() {
  if (!S.user) return;
  try {
    var snap = await db.collection('users').doc(S.user.uid)
      .collection('conversations').orderBy('updatedAt','desc').limit(30).get();
    S.convs = [];
    snap.forEach(function(d){ S.convs.push(Object.assign({id:d.id},d.data())); });
    renderConvs();
  } catch(e) { console.error('loadConvs:',e); }
}

function renderConvs(filter) {
  var list = document.getElementById('convList');
  if (!list) return;
  var convs = S.convs;
  if (filter) {
    var f = filter.toLowerCase();
    convs = convs.filter(function(c){ return (c.title||'').toLowerCase().includes(f); });
  }
  if (!convs.length) {
    list.innerHTML = '<div class="conv-empty">Aucune conversation</div>';
    return;
  }
  var _svgDots = '<svg viewBox="0 0 24 24" width="14" height="14"><circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/></svg>';
  var _svgPen  = '<svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';
  var _svgTrash= '<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';

  list.innerHTML = convs.map(function(c) {
    var act = c.id === S.convId;
    return '<div class="conv-item'+(act?' active':'')+'" data-id="'+c.id+'">' +
      '<div class="conv-icon"><svg viewBox="0 0 24 24" style="width:13px;height:13px;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></div>' +
      '<div class="conv-body"><div class="conv-title">'+esc(c.title||'Conversation')+'</div><div class="conv-preview">'+esc(c.lastMessage||'')+'</div></div>' +
      '<div class="conv-menu-wrap">' +
        '<button class="conv-menu-btn" data-id="'+c.id+'" title="Options" aria-label="Options">'+_svgDots+'</button>' +
        '<div class="conv-dropdown">' +
          '<button class="conv-dropdown-item conv-rename-trigger" data-id="'+c.id+'">'+_svgPen+'Renommer</button>' +
          '<button class="conv-dropdown-item danger conv-del-trigger" data-id="'+c.id+'">'+_svgTrash+'Supprimer</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join('');

  /* Clic sur la conversation — ouvrir sauf si c'est le menu */
  list.querySelectorAll('.conv-item').forEach(function(el) {
    el.addEventListener('click', function(e) {
      if (e.target.closest('.conv-menu-wrap')) return;
      loadConv(this.dataset.id);
    });
  });

  /* Bouton ⋮ — toggle dropdown */
  list.querySelectorAll('.conv-menu-btn').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      var wrap = this.closest('.conv-menu-wrap');
      var dd   = wrap.querySelector('.conv-dropdown');
      var isOpen = dd.classList.contains('open');
      /* Fermer tous les autres */
      list.querySelectorAll('.conv-dropdown.open').forEach(function(d){ d.classList.remove('open'); });
      if (!isOpen) dd.classList.add('open');
    });
  });

  /* Renommer */
  list.querySelectorAll('.conv-rename-trigger').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      this.closest('.conv-dropdown').classList.remove('open');
      renameConv(this.dataset.id);
    });
  });

  /* Supprimer */
  list.querySelectorAll('.conv-del-trigger').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      this.closest('.conv-dropdown').classList.remove('open');
      delConv(this.dataset.id);
    });
  });
}

function filterConvs(q) { renderConvs(q); }

async function newConv() {
  S.convId = null; S.messages = []; S.conv = {};
  if (window.EVAChatHandler) window.EVAChatHandler.clearContext();
  document.getElementById('messagesList').innerHTML = '';
  document.getElementById('chatWelcome').style.display = '';
  document.getElementById('convTitleHeader').textContent = 'Nouvelle conversation';
  document.querySelectorAll('.conv-item').forEach(function(el){el.classList.remove('active');});
  setView('chat');
  closeSidebar();
  if (window.EvaCharacter) window.EvaCharacter.setIdle();
  updateModelSelectUI();
}

async function loadConv(id) {
  S.convId = id;
  var expWrap = document.getElementById('hdrExportWrap');
  if (expWrap) expWrap.style.display = id ? '' : 'none';
  setView('chat');
  closeSidebar();
  try {
    var conv = S.convs.find(function(c){return c.id===id;});
    if (conv) document.getElementById('convTitleHeader').textContent = conv.title || 'Conversation';
    /* Restaurer provider/modèle de cette conversation */
    S.conv = {};
    if (conv && conv.aiProvider) S.conv.provider = conv.aiProvider;
    if (conv && conv.aiModel) S.conv.model = conv.aiModel;
    if (S.conv.provider || S.conv.model) {
      var restProv = S.conv.provider || S.config.aiProvider;
      var mk = {eva:'evaModel',puter:'puterModel',openai:'openaiModel',claude:'claudeModel',qwen:'qwenModel'}[restProv];
      if (mk && S.conv.model) S.config[mk] = S.conv.model;
      if (window.EVAChatHandler) {
        window.EVAChatHandler.initChatHandler(Object.assign({aiProvider:restProv},S.config));
      }
      updateProviderLabel(restProv);
    }
    updateModelSelectUI();
    var snap = await db.collection('users').doc(S.user.uid)
      .collection('conversations').doc(id)
      .collection('messages').orderBy('timestamp','asc').limit(100).get();
    S.messages = [];
    var ctx = [];
    snap.forEach(function(d) {
      var m = Object.assign({id:d.id}, d.data());
      S.messages.push(m);
      ctx.push({role: m.role === 'eva' ? 'assistant' : 'user', content: m.content});
    });
    if (window.EVAChatHandler) window.EVAChatHandler.setContext(ctx);
    renderMsgs();
    document.getElementById('chatWelcome').style.display = 'none';
  } catch(e) { console.error('loadConv:',e); }
  renderConvs();
}

async function delConv(id) {
  if (!confirm('Supprimer cette conversation ?')) return;
  try {
    await db.collection('users').doc(S.user.uid).collection('conversations').doc(id).delete();
    if (S.convId === id) newConv();
    S.convs = S.convs.filter(function(c){return c.id!==id;});
    renderConvs();
  } catch(e) { toast('Erreur suppression','error'); }
}

function renameConv(id) {
  var item = document.querySelector('.conv-item[data-id="'+id+'"]');
  if (!item) return;
  var titleEl = item.querySelector('.conv-title');
  var current = titleEl ? titleEl.textContent : 'Conversation';
  var inp = document.createElement('input');
  inp.className = 'conv-rename-input';
  inp.value = current;
  inp.maxLength = 80;
  if (titleEl) {
    titleEl.replaceWith(inp);
  }
  inp.focus();
  inp.select();
  var done = false;
  async function save() {
    if (done) return;
    done = true;
    var newTitle = inp.value.trim() || current;
    var newTitleEl = document.createElement('div');
    newTitleEl.className = 'conv-title';
    newTitleEl.textContent = newTitle;
    inp.replaceWith(newTitleEl);
    if (newTitle === current) return;
    var conv = S.convs.find(function(c){return c.id===id;});
    if (conv) conv.title = newTitle;
    if (S.convId === id) document.getElementById('convTitleHeader').textContent = newTitle;
    try {
      await db.collection('users').doc(S.user.uid).collection('conversations').doc(id).update({title:newTitle});
    } catch(e) { toast('Erreur renommage','error'); }
  }
  inp.addEventListener('blur', save);
  inp.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { e.preventDefault(); inp.blur(); }
    if (e.key === 'Escape') { inp.value = current; inp.blur(); }
  });
}
window.renameConv = renameConv;

async function saveConvMsg(userMsg, evaMsg) {
  if (!S.user) return;
  try {
    var ref;
    if (!S.convId) {
      var title = userMsg.slice(0,52);
      ref = db.collection('users').doc(S.user.uid).collection('conversations').doc();
      S.convId = ref.id;
      var expWrap = document.getElementById('hdrExportWrap');
      if (expWrap) expWrap.style.display = '';
      var data = {title:title, lastMessage:evaMsg.slice(0,80), createdAt:window.timestamp(), updatedAt:window.timestamp(), aiProvider:getActiveProvider(), aiModel:getActiveModel()};
      await ref.set(data);
      S.convs.unshift(Object.assign({id:ref.id},data));
      document.getElementById('convTitleHeader').textContent = title;
    } else {
      ref = db.collection('users').doc(S.user.uid).collection('conversations').doc(S.convId);
      await ref.update({lastMessage:evaMsg.slice(0,80), updatedAt:window.timestamp()});
      var c = S.convs.find(function(x){return x.id===S.convId;});
      if (c) c.lastMessage = evaMsg.slice(0,80);
    }
    var msgs = ref.collection('messages');
    await msgs.add({role:'user', content:userMsg, timestamp:window.timestamp()});
    await msgs.add({role:'eva', content:evaMsg, timestamp:window.timestamp()});
    renderConvs();
    /* Mémoire Évolutive — extraction à chaque échange (arrière-plan, non-bloquant) */
    if (S.adaptationEnabled) {
      var _now = Date.now();
      /* Throttle : max 1 extraction par minute pour éviter les appels excessifs */
      if (!S._lastExtractTime || (_now - S._lastExtractTime) > 60000) {
        S._lastExtractTime = _now;
        extractUserInsights(userMsg, evaMsg);
      }
    }
  } catch(e) { console.error('saveConvMsg:',e); }
}
