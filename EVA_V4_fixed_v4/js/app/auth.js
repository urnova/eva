/* ═══ AUTH ═══ */
function initAuth() {
  auth.onAuthStateChanged(function(user) {
    if (!user) { window.location.href = '/login'; return; }
    S.user = user;
    loadProfile(user.uid);
    initChatSession();
    loadConvs();
    setTimeout(function(){ loadReminders(); }, 2000);
    setTimeout(function(){ initFCM(); }, 3000);
    // Init wake word (stays off until user activates)
    if (window.EVAWakeWord) {
      window.EVAWakeWord.init({
        wakeWords: ['eva', 'éva', 'hey eva', 'e.v.a'],
        onCommand: function(cmd) {
          if (S.busy) return;
          if (window.EVASTS && window.EVASTS.getIsListening()) return;
          sendVoiceCommand(cmd);
          setTimeout(function() {
            if (S.wakeWordOn && window.EVAWakeWord && !S.busy) window.EVAWakeWord.start();
          }, 5000);
        }
      });
    }
  });
}

async function loadProfile(uid) {
  try {
    console.log('[loadProfile] Début chargement profil pour uid:', uid);
    var doc = await db.collection('users').doc(uid).get();
    console.log('[loadProfile] Réponse Firestore doc.exists:', doc.exists);
    if (doc.exists) {
      S.profile = doc.data() || {};
      if (S.profile.onboardingCompleted === false) {
        window.location.href = '/onboarding';
        return;
      }
      S.keyPersonality = S.profile.keyPersonality || null;
      S.adaptationEnabled = S.profile.adaptationEnabled !== false; // true par défaut
      S.evaMemory = S.profile.evaMemory || null;
      S._lastExtractTime = 0;

      // Nettoyage des liens corrompus (self-loops) et des doublons exacts
      if (S.evaMemory && S.evaMemory.links) {
          var initialLinkCount = S.evaMemory.links.length;
          // 1. Enlever les self-loops
          var cleanedLinks = S.evaMemory.links.filter(function(l) { return l.source !== l.target; });
          
          // 2. Supprimer les doublons stricts (même label, insensible à la casse)
          var uniqueLinks = [];
          cleanedLinks.forEach(function(l) {
             var existing = uniqueLinks.find(function(ex) {
                 var sameNodes = (ex.source === l.source && ex.target === l.target) || 
                                 (ex.source === l.target && ex.target === l.source);
                 var sameLabel = (ex.label || '').toLowerCase().trim() === (l.label || '').toLowerCase().trim();
                 return sameNodes && sameLabel;
             });
             if (!existing) {
                 uniqueLinks.push(l);
             }
          });
          
          S.evaMemory.links = uniqueLinks;
          
          if (S.evaMemory.links.length !== initialLinkCount) {
              try { db.collection('users').doc(S.user.uid).set({ evaMemory: S.evaMemory }, { merge: true }); } catch(e){}
          }
      }

      console.log('[loadProfile] Appel de renderUserUI...');
      renderUserUI(S.profile);
      if (S.profile.preferences) {
        /* Firebase gagne sur le cache localStorage — sync multi-appareils */
        S.config = Object.assign({}, S.config, S.profile.preferences);
        /* Migration : si l'ancien provider par défaut 'native' est stocké, passer à 'eva-custom' */
        if (!S.config.voiceProvider || S.config.voiceProvider === 'native') {
          S.config.voiceProvider = 'eva-custom';
        }
        /* Sync runtime state from merged config */
        if (S.config.ttsOn !== undefined) S.ttsOn = S.config.ttsOn !== false;
        if (S.config.wakeWordOn !== undefined) S.wakeWordOn = !!S.config.wakeWordOn;
        if (window.updateTtsBtn) window.updateTtsBtn();
        if (window.updateProviderBadge) window.updateProviderBadge();
        var wwBtn = document.getElementById('wakeWordBtn');
        if (wwBtn) wwBtn.classList.toggle('active', S.wakeWordOn);
        /* Re-apply panel pref now that Firebase config is loaded */
        if (typeof applyEvaPanelPreference === 'function') applyEvaPanelPreference();
        /* Persist merged config back to localStorage as cache */
        try { localStorage.setItem('eva_config', JSON.stringify(S.config)); } catch(e){}
      }
      if (typeof setupReportsAccess === 'function') { setupReportsAccess(); updateReportBadge(); }
      if (typeof initVisionModules === 'function') { initVisionModules(); }
      /* Signaler que l'auth + profil sont prêts (notamment pour le tutorial) */
      console.log('[loadProfile] Dispatch eva:authReady');
      document.dispatchEvent(new CustomEvent('eva:authReady'));
      /* Ouvrir la vue demandée par l'URL (ex: /chat/settings/profile) */
      if (window._initPathRouter) window._initPathRouter();
      /* Puter auto-check après chargement Firebase */
      if (window.puter) {
        setTimeout(async function() {
          try {
            var pu = await puter.auth.getUser();
            if (pu && pu.username) {
              S.config.puterUsername = pu.username;
              try { localStorage.setItem('eva_config', JSON.stringify(S.config)); } catch(e){}
            } else if (S.profile.puterUsername && S.config.aiProvider === 'puter') {
              /* Bannière reconnexion uniquement si l'utilisateur a choisi Puter comme provider actif */
              showPuterReconnectBanner(S.profile.puterUsername);
            }
          } catch(e) {
            /* Afficher la banniere UNIQUEMENT si Puter est le provider selectionne actuellement */
            if (S.profile.puterUsername && S.config.aiProvider === 'puter') {
              showPuterReconnectBanner(S.profile.puterUsername);
            }
          }
        }, 1500);
      }
    } else {
      console.log('[loadProfile] Profil inexistant, création en cours...');
      await createProfile(S.user);
    }
  } catch(e) { 
    console.error('[loadProfile] Erreur critique:', e); 
    // Fallback UI si Firestore échoue (offline ou panne)
    var el = document.getElementById('userNameText');
    if (el && el.textContent === 'Chargement...') {
      el.textContent = (S.user && S.user.email) ? S.user.email.split('@')[0] : 'Hors-ligne';
      el.style.color = '#f59e0b';
    }
    // Débloquer l'UI malgré l'erreur
    document.dispatchEvent(new CustomEvent('eva:authReady'));
    if (window._initPathRouter) window._initPathRouter();
  }
}

function showPuterReconnectBanner(username) {
  if (document.getElementById('puterReconnectBanner')) return;
  var banner = document.createElement('div');
  banner.id = 'puterReconnectBanner';
  banner.style.cssText = 'position:fixed;bottom:70px;left:50%;transform:translateX(-50%);z-index:9999;background:rgba(20,20,30,0.95);border:1px solid var(--cyan);border-radius:14px;padding:12px 18px;display:flex;align-items:center;gap:12px;font-size:0.78em;color:var(--text);box-shadow:0 4px 24px rgba(123,139,245,0.15);max-width:90vw;';
  banner.innerHTML =
    '<span style="color:var(--cyan);font-size:1.2em;">☁️</span>' +
    '<div><div style="font-weight:600;margin-bottom:2px;">Compte Puter détecté</div>' +
    '<div style="color:var(--text-muted);font-size:0.88em;">@'+username+' — Reconnectez-vous pour activer les fonctions Puter.</div></div>' +
    '<button onclick="connectPuter();document.getElementById(\'puterReconnectBanner\').remove();" style="background:var(--cyan);color:#000;border:none;border-radius:8px;padding:6px 12px;font-size:0.85em;font-weight:700;cursor:pointer;white-space:nowrap;">Se reconnecter</button>' +
    '<button onclick="this.closest(\'#puterReconnectBanner\').remove();" style="background:transparent;border:none;color:var(--text-muted);cursor:pointer;font-size:1.1em;padding:0 4px;">×</button>';
  document.body.appendChild(banner);
  setTimeout(function(){ if(banner.parentNode) banner.remove(); }, 12000);
}
window.showPuterReconnectBanner = showPuterReconnectBanner;

async function createProfile(user) {
  var name = user.displayName || user.email.split('@')[0];
  var p = {
    email: user.email, displayName: name,
    photoURL: user.photoURL || null,
    createdAt: window.timestamp(), role: 'user', onboardingCompleted: false,
    preferences: { aiProvider: 'pollinations', pollinationsModel: 'openai-large', voiceProvider: 'eva-custom', voiceLang: 'fr-FR' }
  };
  try {
    await db.collection('users').doc(user.uid).set(p);
    window.location.href = '/onboarding';
  } catch(e) {}
}

/* ═══ RÉSOLUTION DU LABEL DE RÔLE ═══
   Prend les données du profil Firestore et retourne {text, color, emoji}
   Gère tous les cas : clé dev avec couleur/emoji, rôle string long, rôle clé courte, fallback.
*/
function resolveRoleLabel(p) {
  if (!p) return { text: '👤 Utilisateur', color: null, emoji: null };

  var roleKey = (p.role || 'user').toLowerCase().trim();
  var devLabel = p.devKeyLabel || null;
  var devColor = p.devKeyColor || null;
  var devEmoji = p.devKeyEmoji || null;

  /* Cas 1 : clé dev avec label + couleur (cas nominal après activateDevKeyDirect) */
  if (devLabel && devColor) {
    return { text: (devEmoji ? devEmoji + ' ' : '') + devLabel, color: devColor, emoji: devEmoji };
  }

  /* Cas 2 : clé dev avec label + emoji (sans couleur) */
  if (devLabel && devEmoji) {
    return { text: devEmoji + ' ' + devLabel, color: null, emoji: devEmoji };
  }

  /* Cas 3 : clé dev avec label seulement (pas de couleur ni emoji) */
  if (devLabel) {
    return { text: devLabel, color: null, emoji: null };
  }

  /* Cas 4 : rôle clé courte standard */
  var rolesMap = {
    creator:       '👑 Créateur — PDG Astral',
    createur:      '👑 Créateur — PDG Astral',
    créateur:      '👑 Créateur — PDG Astral',
    developer:     '⚙️ Développeur',
    developpeur:   '⚙️ Développeur',
    développeur:   '⚙️ Développeur',
    creator_wife:  '💎 Épouse du Créateur',
    admin:         '🛡 Admin',
    premium:       '⭐ Premium',
    user:          '👤 Utilisateur'
  };
  if (rolesMap[roleKey]) {
    return { text: rolesMap[roleKey], color: null, emoji: null };
  }

  /* Cas 5 : rôle est une chaîne longue arbitraire (ex: "Créateur — PDG Astral")
     → l'afficher directement avec une couleur or si ça ressemble à un rôle élevé */
  if (p.role && p.role !== 'user') {
    var roleLower = p.role.toLowerCase();
    var isHighRole = roleLower.indexOf('créateur') !== -1 || roleLower.indexOf('createur') !== -1 ||
                     roleLower.indexOf('pdg') !== -1 || roleLower.indexOf('fondateur') !== -1;
    return {
      text: (isHighRole ? '👑 ' : '') + p.role,
      color: isHighRole ? '#FFD700' : null,
      emoji: isHighRole ? '👑' : null
    };
  }

  return { text: '👤 Utilisateur', color: null, emoji: null };
}
window.resolveRoleLabel = resolveRoleLabel;

function renderUserUI(p) {
  if (!p) return;
  var name = p.displayName || p.email || 'Utilisateur';
  var el = document.getElementById('userNameText');
  if (el) el.textContent = name;

  var badge = document.getElementById('userBadgeText');
  if (badge) {
    var resolved = resolveRoleLabel(p);
    if (resolved.color) {
      badge.innerHTML =
        '<span style="display:inline-flex;align-items:center;gap:3px;' +
        'border:1.5px solid ' + resolved.color + ';' +
        'color:' + resolved.color + ';' +
        'border-radius:20px;padding:1px 9px 2px 7px;font-size:0.95em;font-weight:700;letter-spacing:0.03em;' +
        'box-shadow:0 0 7px ' + resolved.color + '44;white-space:nowrap;">' +
        esc(resolved.text) + '</span>';
    } else {
      badge.textContent = resolved.text;
      badge.removeAttribute('style');
    }
  }

  var ava = document.getElementById('userAvatar');
  if (ava) {
    if (p.photoURL) {
      ava.innerHTML = '<img src="'+p.photoURL+'" alt="avatar">';
    } else {
      ava.textContent = name.split(' ').map(function(n){return n[0]||'';}).join('').toUpperCase().slice(0,2);
    }
  }
}
/* ── Wrapper pour l'auth Puter (Popup Native) ── */
window.evaSafePuterSignIn = async function() {
  return await puter.auth.signIn();
};
