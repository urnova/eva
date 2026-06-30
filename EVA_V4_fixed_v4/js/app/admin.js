async function activateDevKeyDirect() {
  var inp = document.getElementById('sDevKey');
  if (!inp) return;
  var key = inp.value.trim();
  if (!key) { toast('Entrez une clé développeur', 'error'); return; }
  if (!S.user) { toast('Non connecté', 'error'); return; }
  var statusEl = document.getElementById('sDevKeyStatus');
  if (statusEl) statusEl.textContent = 'Vérification en cours...';
  try {
    var docRef = await db.collection('dev_keys_valid').doc(key).get();
    if (!docRef.exists || !docRef.data().active) {
      if (statusEl) statusEl.innerHTML = '<span style="color:var(--red)">❌ Clé invalide ou inactive</span>';
      toast('Clé invalide', 'error');
      return;
    }
    var data = docRef.data();
    var role = data.role || 'developer';
    var label = data.label || role;
    var keyPersonality = data.personality || null;
    var labelColor = data.labelColor || null;
    var labelEmoji = data.labelEmoji || null;
    var updateData = { role: role, devKey: key, devKeyLabel: label, keyPersonality: keyPersonality, devKeyColor: labelColor, devKeyEmoji: labelEmoji };
    await db.collection('users').doc(S.user.uid).set(updateData, { merge: true });
    S.profile = Object.assign(S.profile || {}, updateData);
    S.keyPersonality = keyPersonality;
    if (statusEl) statusEl.innerHTML = '<span style="color:var(--cyan)">✅ Clé activée : ' + esc(label) + '</span>';
    toast('Clé développeur activée : ' + label, 'success');
    setTimeout(function() { window.location.reload(); }, 1800);
  } catch(e) {
    console.error('activateDevKeyDirect:', e);
    if (statusEl) statusEl.innerHTML = '<span style="color:var(--red)">Erreur : ' + esc(e.message) + '</span>';
    toast('Erreur validation clé', 'error');
  }
}
window.activateDevKeyDirect = activateDevKeyDirect;

async function deactivateDevKeyDirect() {
  if (!S.user) return;
  if (!confirm('Désactiver la clé développeur et revenir au rôle utilisateur ?')) return;
  try {
    await db.collection('users').doc(S.user.uid).set({ role: 'user', devKey: null, devKeyLabel: null, devKeyColor: null, devKeyEmoji: null }, { merge: true });
    S.profile = Object.assign(S.profile || {}, { role: 'user', devKey: null, devKeyLabel: null, devKeyColor: null, devKeyEmoji: null });
    toast('Clé désactivée', 'info');
    setTimeout(function() { window.location.reload(); }, 1500);
  } catch(e) { toast('Erreur désactivation', 'error'); }
}
window.deactivateDevKeyDirect = deactivateDevKeyDirect;

/* ═══════════════════════════════════════════════════
   DELETE ACCOUNT
═══════════════════════════════════════════════════ */
async function deleteMyAccount() {
  if (!S.user || !auth.currentUser) { toast('Non connecté', 'error'); return; }
  var first = confirm('⛔ Supprimer définitivement votre compte E.V.A ?\n\nToutes vos données (conversations, notes, alarmes, événements) seront effacées. Cette action est IRRÉVERSIBLE.');
  if (!first) return;
  var second = confirm('Dernière confirmation : voulez-vous vraiment supprimer votre compte ? Tapez OK pour continuer.');
  if (!second) return;
  try {
    toast('Suppression du compte en cours...', 'info');
    var uid = S.user.uid;
    var cols = ['conversations', 'notes', 'alarms', 'events', 'reminders'];
    for (var i = 0; i < cols.length; i++) {
      var snap = await db.collection('users').doc(uid).collection(cols[i]).get();
      var batch = db.batch();
      snap.forEach(function(d){ batch.delete(d.ref); });
      if (!snap.empty) await batch.commit();
    }
    await db.collection('users').doc(uid).delete();
    await auth.currentUser.delete();
    toast('Compte supprimé', 'success');
    setTimeout(function(){ window.location.href = '/'; }, 1500);
  } catch(e) {
    console.error('deleteMyAccount:', e);
    if (e.code === 'auth/requires-recent-login') {
      toast('Pour des raisons de sécurité, reconnectez-vous avant de supprimer votre compte.', 'error');
    } else {
      toast('Erreur lors de la suppression : ' + e.message, 'error');
    }
  }
}
window.deleteMyAccount = deleteMyAccount;

/* ═══════════════════════════════════════════════════
   ABOUT MODAL — À propos d'EVA
═══════════════════════════════════════════════════ */
function openAboutModal() {
  var m = document.getElementById('aboutModal');
  if (!m) return;
  m.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}
function closeAboutModal() {
  var m = document.getElementById('aboutModal');
  if (!m) return;
  m.style.display = 'none';
  document.body.style.overflow = '';
}
window.openAboutModal = openAboutModal;
window.closeAboutModal = closeAboutModal;
document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    var m = document.getElementById('aboutModal');
    if (m && m.style.display === 'flex') closeAboutModal();
  }
});
document.addEventListener('click', function(e) {
  var m = document.getElementById('aboutModal');
  if (m && e.target === m) closeAboutModal();
});

/* ═══════════════════════════════════════════════════
   EVA PANEL TOGGLE
═══════════════════════════════════════════════════ */
function toggleEvaPanelSetting(show) {
  S.config.showEvaPanel = show;
  saveCfg();
  var panel = document.getElementById('evaPanel');
  if (!panel) return;
  if (show) {
    panel.classList.remove('collapsed');
    S.evaOpen = true;
    _loadEvaCharacter();
  } else {
    panel.classList.add('collapsed');
    S.evaOpen = false;
  }
  _syncQuickStrip(show);
  var btn = document.getElementById('evaToggleBtn');
  if (btn) btn.style.opacity = show ? '1' : '0.5';
}
window.toggleEvaPanelSetting = toggleEvaPanelSetting;

function applyEvaPanelPreference() {
  var show = S.config.showEvaPanel !== false;
  var panel = document.getElementById('evaPanel');
  if (!panel) return;
  if (!show) {
    panel.classList.add('collapsed');
    S.evaOpen = false;
    var btn = document.getElementById('evaToggleBtn');
    if (btn) btn.style.opacity = '0.5';
    _syncQuickStrip(false);
  }
}

function _syncQuickStrip() {
  /* Quick strip toujours visible — indépendant de l'état EVA */
}

/* ═══════════════════════════════════════════════════
   NOTES
═══════════════════════════════════════════════════ */