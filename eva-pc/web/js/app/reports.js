/* ═══════════════════════════════════════════════════
   SYSTÈME DE RAPPORTS — COMPLET
═══════════════════════════════════════════════════ */

/* ── State ─────────────────────────────────── */
var RS = {
  selectedType: 'bug-conversation',
  selectedPrio: 'medium',
  allReports: [],
  currentFilter: 'all'
};

/* ── Vérifie si l'utilisateur est admin ────── */
function isAdminRole() {
  var role = ((S.profile && S.profile.role) || 'user').toLowerCase().trim();
  var label = ((S.profile && S.profile.devKeyLabel) || '').toLowerCase();
  var excluded = ['creator_wife', 'user', 'guest', 'epouse', 'épouse', 'wife'];
  if (excluded.indexOf(role) !== -1) return false;
  var adminTerms = ['creator', 'createur', 'créateur', 'developer', 'développeur', 'developpeur'];
  if (adminTerms.some(function(t) { return role === t || role.indexOf(t) !== -1; })) return true;
  var wifeTerms = ['femme', 'epouse', 'épouse', 'wife'];
  if (wifeTerms.some(function(t) { return label.indexOf(t) !== -1; })) return false;
  return adminTerms.some(function(t) { return label.indexOf(t) !== -1; });
}

/* ── Afficher section gold selon le rôle ──── */
function setupReportsAccess() {
  var role = ((S.profile && S.profile.role) || 'user').toLowerCase().trim();
  var lbl  = ((S.profile && S.profile.devKeyLabel) || '').toLowerCase();
  /* Vérifier épouse EN PREMIER : sinon "Épouse du Créateur" contient "créateur"
     et serait incorrectement détectée comme Créateur */
  var isCreatorWife = ['creator_wife','wife','femme','epouse','épouse'].some(function(t){ return role === t || lbl.indexOf(t) !== -1; });
  var isCreator     = !isCreatorWife && ['creator','createur','créateur'].some(function(t){ return role === t || lbl.indexOf(t) !== -1; });
  var isDeveloper   = !isCreatorWife && !isCreator && ['developer','développeur','developpeur'].some(function(t){ return role === t || role.indexOf(t) !== -1 || lbl.indexOf(t) !== -1; });

  var sec = document.getElementById('navGoldSection');
  var navR  = document.getElementById('navReports');
  var navVR = document.getElementById('navVisionRepair');
  var navVA = document.getElementById('navVisionAssist');

  /* Créateur : tout */
  if (isCreator) {
    if (sec) sec.classList.add('visible');
    if (navR)  navR.style.display  = '';
    if (navVR) navVR.style.display = '';
    if (navVA) navVA.style.display = '';
    return;
  }
  /* Développeur : rapports + visionAssist (pas visionRepair) */
  if (isDeveloper) {
    if (sec) sec.classList.add('visible');
    if (navR)  navR.style.display  = '';
    if (navVR) navVR.style.display = 'none';
    if (navVA) navVA.style.display = '';
    return;
  }
  /* Épouse créateur : visionAssist uniquement */
  if (isCreatorWife) {
    if (sec) sec.classList.add('visible');
    if (navR)  navR.style.display  = 'none';
    if (navVR) navVR.style.display = 'none';
    if (navVA) navVA.style.display = '';
    return;
  }
  /* Utilisateur normal : rien */
  if (sec) sec.classList.remove('visible');
  if (navR)  navR.style.display  = 'none';
  if (navVR) navVR.style.display = 'none';
  if (navVA) navVA.style.display = 'none';
}

/* ── setView override pour charger les rapports ─ */
var _origSetView = window.setView;
window.setView = function(name) {
  _origSetView(name);
  if (name === 'reports') loadReports();
};

/* ── Filtres rapports ──────────────────────── */
document.querySelectorAll('.rp-filter').forEach(function(btn) {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.rp-filter').forEach(function(b){ b.classList.remove('act'); });
    this.classList.add('act');
    RS.currentFilter = this.dataset.rfilter;
    renderReports();
  });
});

/* ════════════════════════════════════════════
   MODAL SIGNALER
════════════════════════════════════════════ */
function openReportModal() {
  resetReportModal();
  autoFillExcerpt();
  document.getElementById('reportOverlay').classList.add('active');
  setTimeout(function(){ document.getElementById('reportDesc').focus(); }, 100);
}
window.openReportModal = openReportModal;

function closeReportModal() {
  document.getElementById('reportOverlay').classList.remove('active');
}
window.closeReportModal = closeReportModal;

function resetReportModal() {
  RS.selectedType = 'bug-conversation';
  RS.selectedPrio = 'medium';
  document.querySelectorAll('.rtype-btn').forEach(function(b){ b.classList.remove('sel'); });
  var def = document.querySelector('.rtype-btn[data-rtype="bug-conversation"]');
  if (def) def.classList.add('sel');
  document.querySelectorAll('.rprio-btn').forEach(function(b){ b.classList.remove('sl','sm','sh','sc'); });
  var pm = document.querySelector('.rprio-btn[data-rprio="medium"]');
  if (pm) pm.classList.add('sm');
  document.getElementById('reportDesc').value = '';
  document.getElementById('reportExcerpt').value = '';
  updateReportTypeUI();
  var btn = document.getElementById('reportSubmitBtn');
  btn.disabled = false;
  btn.textContent = 'ENVOYER LE RAPPORT';
}

function autoFillExcerpt() {
  var msgs = [];
  document.querySelectorAll('#messagesList .msg-bubble').forEach(function(el) {
    var row = el.closest('.msg-row');
    var who = (row && row.classList.contains('eva')) ? 'EVA' : 'Vous';
    var content = (el.innerText || el.textContent || '').trim();
    if (content) msgs.push(who + ' : ' + content);
  });
  document.getElementById('reportExcerpt').value = msgs.slice(-10).join('\n');
}

function updateReportTypeUI() {
  var isBug = RS.selectedType === 'bug-conversation' || RS.selectedType === 'bug-general';
  var isConv = RS.selectedType === 'bug-conversation';
  document.getElementById('rprioSection').style.display = isBug ? 'block' : 'none';
  document.getElementById('rexcerptSection').style.display = isConv ? 'block' : 'none';
}

document.querySelectorAll('.rtype-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.rtype-btn').forEach(function(b){ b.classList.remove('sel'); });
    this.classList.add('sel');
    RS.selectedType = this.dataset.rtype;
    if (RS.selectedType === 'bug-conversation') autoFillExcerpt();
    else document.getElementById('reportExcerpt').value = '';
    updateReportTypeUI();
  });
});

document.querySelectorAll('.rprio-btn').forEach(function(btn) {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.rprio-btn').forEach(function(b){ b.classList.remove('sl','sm','sh','sc'); });
    RS.selectedPrio = this.dataset.rprio;
    var cls = {low:'sl',medium:'sm',high:'sh',critical:'sc'}[RS.selectedPrio];
    if (cls) this.classList.add(cls);
  });
});

document.getElementById('reportOverlay').addEventListener('click', function(e) {
  if (e.target === this) closeReportModal();
});

/* ── Soumission du rapport ──────────────────── */
async function submitReport() {
  var desc = (document.getElementById('reportDesc').value || '').trim();
  if (!desc) {
    toast('Veuillez écrire une description', 'error');
    document.getElementById('reportDesc').focus();
    return;
  }
  if (!S.user) {
    toast('Vous devez être connecté pour envoyer un rapport', 'error');
    return;
  }
  var btn = document.getElementById('reportSubmitBtn');
  btn.disabled = true;
  btn.textContent = 'ENVOI EN COURS...';
  try {
    var profile = S.profile || {};
    var excerpt = (document.getElementById('reportExcerpt').value || '').trim();
    var now = firebase.firestore.FieldValue.serverTimestamp();
    var reportData = {
      userId: S.user.uid,
      userName: profile.displayName || S.user.displayName || 'Utilisateur',
      userEmail: S.user.email || '',
      userRole: profile.role || 'user',
      type: RS.selectedType,
      priority: (RS.selectedType === 'bug-conversation' || RS.selectedType === 'bug-general') ? RS.selectedPrio : 'low',
      description: desc,
      conversationExcerpt: RS.selectedType === 'bug-conversation' ? excerpt : '',
      conversationId: RS.selectedType === 'bug-conversation' ? (S.convId || '') : '',
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      adminNotes: '',
      resolvedAt: null
    };
    await db.collection('reports').add(reportData);
    closeReportModal();
    toast('Rapport envoyé. Merci !', 'success');
    updateReportBadge();
  } catch(err) {
    console.error('[REPORT] submitReport error:', err.code, err.message);
    var msg = 'Erreur lors de l\'envoi';
    if (err.code === 'permission-denied') msg = 'Accès refusé — vérifiez les règles Firestore';
    toast(msg, 'error');
    btn.disabled = false;
    btn.textContent = 'ENVOYER LE RAPPORT';
  }
}
window.submitReport = submitReport;

/* ════════════════════════════════════════════
   TABLEAU DE BORD RAPPORTS (admin)
════════════════════════════════════════════ */
async function loadReports() {
  if (!isAdminRole()) return;
  var list = document.getElementById('reportsList');
  if (!list) return;
  list.innerHTML = '<div class="rp-loading">⏳ Chargement des rapports...</div>';
  try {
    /* Pas de orderBy → pas besoin d'index Firestore composite. Tri côté client. */
    var snap = await db.collection('reports').limit(300).get();
    RS.allReports = [];
    snap.forEach(function(d) {
      RS.allReports.push(Object.assign({ id: d.id }, d.data()));
    });
    /* Tri par date décroissante côté client */
    RS.allReports.sort(function(a, b) {
      var ta = a.createdAt ? (a.createdAt.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt).getTime()) : 0;
      var tb = b.createdAt ? (b.createdAt.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt).getTime()) : 0;
      return tb - ta;
    });
    updateReportStats();
    renderReports();
    updateReportBadge();
  } catch(err) {
    console.error('[REPORT] loadReports error:', err.code, err.message);
    var hint = '';
    if (err.code === 'permission-denied') {
      hint = '<div style="font-size:0.78em;color:var(--text-muted);margin-top:8px;">Publiez les règles Firestore dans la console Firebase.</div>';
    }
    list.innerHTML = '<div class="rp-empty"><div class="rp-empty-icon">⚠️</div>Erreur : ' + (err.code || 'inconnue') + hint + '</div>';
  }
}
window.loadReports = loadReports;

function updateReportStats() {
  var total = RS.allReports.length;
  var pend  = RS.allReports.filter(function(r){ return r.status === 'pending'; }).length;
  var prog  = RS.allReports.filter(function(r){ return r.status === 'in-progress'; }).length;
  var done  = RS.allReports.filter(function(r){ return r.status === 'resolved'; }).length;
  var els = { rstatAll: total, rstatPend: pend, rstatProg: prog, rstatDone: done };
  Object.keys(els).forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.textContent = els[id];
  });
}

async function updateReportBadge() {
  if (!isAdminRole()) return;
  try {
    /* Filtre côté client depuis les données déjà chargées, ou fetch simple */
    var pending = RS.allReports.filter(function(r){ return r.status === 'pending'; }).length;
    if (RS.allReports.length === 0) {
      /* Pas encore chargé — fetch léger sans orderBy */
      var snap = await db.collection('reports').get();
      pending = 0;
      snap.forEach(function(d){ if (d.data().status === 'pending') pending++; });
    }
    var badge = document.getElementById('reportBadge');
    if (!badge) return;
    if (pending > 0) { badge.textContent = pending; badge.style.display = 'inline'; }
    else badge.style.display = 'none';
  } catch(e) {
    console.warn('[REPORT] badge update failed:', e.code);
  }
}

function getFilteredReports() {
  var f = RS.currentFilter;
  if (f === 'all') return RS.allReports;
  if (['pending','in-progress','resolved','rejected'].indexOf(f) !== -1) {
    return RS.allReports.filter(function(r){ return r.status === f; });
  }
  return RS.allReports.filter(function(r){ return r.type === f; });
}

function renderReports() {
  var list = document.getElementById('reportsList');
  if (!list) return;
  var filtered = getFilteredReports();
  if (filtered.length === 0) {
    list.innerHTML = '<div class="rp-empty"><div class="rp-empty-icon">📭</div>Aucun rapport pour ce filtre.</div>';
    return;
  }
  list.innerHTML = filtered.map(function(r){ return buildReportCard(r); }).join('');

  list.querySelectorAll('.rp-card').forEach(function(card) {
    card.addEventListener('click', function(e) {
      if (e.target.closest('.rp-actions')) return;
      this.classList.toggle('expanded');
    });
  });
  list.querySelectorAll('.rp-status-select').forEach(function(sel) {
    sel.addEventListener('change', function(e) {
      e.stopPropagation();
      updateReportStatus(this.dataset.rid, this.value, this);
    });
  });
  list.querySelectorAll('.btn-rp-save').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      var id = this.dataset.rid;
      var notesEl = list.querySelector('.rp-admin-notes[data-rid="'+id+'"]');
      if (notesEl) saveAdminNotes(id, notesEl.value, this);
    });
  });
  list.querySelectorAll('.btn-rp-del').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      var id = this.dataset.rid;
      if (confirm('Supprimer ce rapport définitivement ?')) deleteReport(id);
    });
  });
}

function buildReportCard(r) {
  var typeLabels = {'bug-conversation':'🐛 Bug conv.','bug-general':'🔧 Bug général','feature':'💡 Suggestion','autre':'💬 Autre'};
  var typeCls    = {'bug-conversation':'bc','bug-general':'bg','feature':'ft','autre':'au'};
  var statusLabels = {'pending':'⏳ En attente','in-progress':'🔄 En cours','resolved':'✅ Résolu','rejected':'🚫 Rejeté'};
  var statusCls    = {'pending':'sp','in-progress':'si','resolved':'sr','rejected':'sj'};
  var prioCls    = {'low':'pl','medium':'pm','high':'ph','critical':'pc'};
  var prioLabels = {'low':'🟢 Basse','medium':'🟡 Normale','high':'🔴 Haute','critical':'🟣 Critique'};
  var roleColors = {creator:'#ffd700',developer:'var(--cyan)',creator_wife:'#ff69b4',user:'#aaa'};

  var dt = r.createdAt ? (r.createdAt.toDate ? r.createdAt.toDate() : new Date(r.createdAt)) : new Date();
  var dateStr = dt.toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});
  var roleColor = roleColors[r.userRole] || '#aaa';
  var shortDesc = (r.description || '').substring(0, 90) + ((r.description||'').length > 90 ? '…' : '');
  var hasPrio = r.type === 'bug-conversation' || r.type === 'bug-general';
  var prioHtml = hasPrio && r.priority ? '<span class="pbadge '+prioCls[r.priority]+'">'+prioLabels[r.priority]+'</span>' : '';
  var excerptHtml = r.conversationExcerpt
    ? '<div class="rp-detail-section"><div class="rp-detail-lbl">Extrait de conversation</div><div class="rp-excerpt-box">'+esc(r.conversationExcerpt)+'</div></div>'
    : '';
  var statusOptions = ['pending','in-progress','resolved','rejected'].map(function(s){
    return '<option value="'+s+'"'+(r.status===s?' selected':'')+'>'+statusLabels[s]+'</option>';
  }).join('');

  return [
    '<div class="rp-card" data-rid="'+r.id+'">',
      '<div class="rp-card-top">',
        '<span class="tbadge '+(typeCls[r.type]||'au')+'">'+(typeLabels[r.type]||'💬 Autre')+'</span>',
        '<span class="sbadge '+(statusCls[r.status]||'sp')+'">'+(statusLabels[r.status]||'⏳ En attente')+'</span>',
        prioHtml,
        '<span class="rp-card-title">'+esc(shortDesc)+'</span>',
      '</div>',
      '<div class="rp-card-meta">',
        '<div class="rp-user-dot" style="background:linear-gradient(135deg,'+roleColor+','+roleColor+'88)">'+esc((r.userName||'?').charAt(0).toUpperCase())+'</div>',
        '<span style="color:'+roleColor+'">'+esc(r.userName||'Inconnu')+'</span>',
        '<span>'+esc(r.userEmail||'')+'</span>',
        '<span>•</span><span>'+dateStr+'</span>',
      '</div>',
      '<div class="rp-detail">',
        '<div class="rp-detail-section"><div class="rp-detail-lbl">Description</div><div class="rp-detail-text">'+esc(r.description||'')+'</div></div>',
        excerptHtml,
        '<div class="rp-actions">',
          '<span style="font-size:0.71em;color:var(--text-muted);">Statut :</span>',
          '<select class="rp-status-select" data-rid="'+r.id+'">'+statusOptions+'</select>',
        '</div>',
        '<div class="rp-detail-lbl" style="margin-top:10px;">Notes admin</div>',
        '<textarea class="rp-admin-notes" data-rid="'+r.id+'" placeholder="Notes internes...">'+esc(r.adminNotes||'')+'</textarea>',
        '<button class="btn-rp-save" data-rid="'+r.id+'">💾 Sauvegarder</button>',
        '<button class="btn-rp-del" data-rid="'+r.id+'">🗑 Supprimer</button>',
      '</div>',
    '</div>'
  ].join('');
}

async function updateReportStatus(id, newStatus, selectEl) {
  try {
    var now = firebase.firestore.FieldValue.serverTimestamp();
    var upd = { status: newStatus, updatedAt: now };
    if (newStatus === 'resolved') upd.resolvedAt = now;
    await db.collection('reports').doc(id).update(upd);
    var r = RS.allReports.find(function(x){ return x.id === id; });
    if (r) { r.status = newStatus; }
    updateReportStats();
    updateReportBadge();
    toast('Statut mis à jour', 'success');
  } catch(e) {
    console.error('[REPORT] updateStatus:', e.code, e.message);
    toast('Erreur mise à jour : ' + (e.code || e.message), 'error');
  }
}

async function saveAdminNotes(id, notes, btn) {
  try {
    await db.collection('reports').doc(id).update({
      adminNotes: notes,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    var r = RS.allReports.find(function(x){ return x.id === id; });
    if (r) r.adminNotes = notes;
    btn.textContent = '✅ Sauvegardé';
    setTimeout(function(){ btn.textContent = '💾 Sauvegarder'; }, 1800);
  } catch(e) {
    console.error('[REPORT] saveNotes:', e.code, e.message);
    toast('Erreur sauvegarde', 'error');
  }
}

async function deleteReport(id) {
  try {
    await db.collection('reports').doc(id).delete();
    RS.allReports = RS.allReports.filter(function(r){ return r.id !== id; });
    updateReportStats();
    renderReports();
    updateReportBadge();
    toast('Rapport supprimé', 'success');
  } catch(e) {
    console.error('[REPORT] deleteReport:', e.code, e.message);
    toast('Erreur suppression', 'error');
  }
}

/* ── Observateur : relancer setupReportsAccess quand le profil est chargé ── */
(function() {
  var done = false;
  function trySetup() {
    if (done || !isAdminRole()) return;
    done = true;
    setupReportsAccess();
    updateReportBadge();
  }
  var badge = document.getElementById('userBadgeText');
  if (badge) {
    var obs = new MutationObserver(function() { trySetup(); });
    obs.observe(badge, { childList: true, subtree: true, characterData: true });
  }
  /* Tentative après 3s au cas où le profil est déjà chargé */
  setTimeout(trySetup, 3000);
})();

/* ── Fermer le modal avec Escape ─────────── */
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') closeReportModal();
});

