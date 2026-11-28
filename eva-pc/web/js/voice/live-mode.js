/* ═══════════════════════════════════════════════════════════════════════
   EVA — LIVE-MODE.JS (D2)
   Mode conversation vocale en direct mains libres (PC + Web)
   Crée une session vocale dédiée (isVoiceSession: true) sans casser TTS/WakeWord
   ═══════════════════════════════════════════════════════════════════════ */
(function(w) {
  'use strict';

  var _active = false;
  var _state = 'idle'; // 'listening' | 'thinking' | 'speaking'
  var _wasWakeWordOn = false;
  var _muteMic = false;

  function _ensureUI() {
    var ov = document.getElementById('evaLiveOverlay');
    if (ov) return ov;
    ov = document.createElement('div');
    ov.id = 'evaLiveOverlay';
    ov.style.cssText = 'display:none;position:fixed;inset:0;z-index:999900;background:radial-gradient(circle at 50% 35%,rgba(19,19,31,0.98),rgba(13,13,20,0.99));backdrop-filter:blur(22px);flex-direction:column;align-items:center;justify-content:center;padding:24px;color:#eef2ff;font-family:"Inter",sans-serif;';
    ov.innerHTML =
      '<div style="position:relative;width:180px;height:180px;display:flex;align-items:center;justify-content:center;margin-bottom:26px;">' +
        '<div id="liveOrbRing" style="position:absolute;inset:0;border-radius:50%;border:2px solid transparent;border-top-color:#00d4ff;border-bottom-color:#8b5cf6;animation:splashSpin 3s linear infinite;"></div>' +
        '<div id="liveOrbCore" style="width:128px;height:128px;border-radius:50%;background:radial-gradient(circle at 35% 30%,rgba(0,212,255,0.45),rgba(139,92,246,0.3) 60%,#0d0d14);border:1px solid rgba(0,212,255,0.5);box-shadow:0 0 50px rgba(0,212,255,0.3);display:flex;align-items:center;justify-content:center;">' +
          '<img src="/assets/images/eva-logo.png" alt="EVA Live" style="width:62px;height:62px;object-fit:contain;">' +
        '</div>' +
      '</div>' +
      '<div id="liveStatusText" style="font-family:\'Orbitron\',sans-serif;font-size:1.05em;letter-spacing:2px;color:#00d4ff;margin-bottom:10px;">MODE LIVE ACTIF</div>' +
      '<div id="liveTranscriptBox" style="max-width:560px;min-height:54px;text-align:center;font-size:0.92em;color:#cbd5e1;line-height:1.6;margin-bottom:26px;padding:0 16px;">Parlez naturellement, E.V.A vous écoute…</div>' +
      '<div style="display:flex;gap:12px;align-items:center;">' +
        '<button type="button" id="liveMuteBtn" style="padding:11px 20px;border-radius:999px;border:1px solid rgba(255,255,255,0.16);background:rgba(26,26,46,0.9);color:#eef2ff;font-size:0.84em;font-weight:600;cursor:pointer;">🎙️ Couper micro</button>' +
        '<button type="button" id="liveStopSpeakBtn" style="padding:11px 20px;border-radius:999px;border:1px solid rgba(0,212,255,0.35);background:rgba(0,212,255,0.12);color:#00d4ff;font-size:0.84em;font-weight:600;cursor:pointer;">⏭️ Interrompre</button>' +
        '<button type="button" id="liveExitBtn" style="padding:11px 22px;border-radius:999px;border:none;background:linear-gradient(135deg,#ef4444,#b91c1c);color:#fff;font-size:0.84em;font-weight:700;cursor:pointer;">✕ Quitter Live</button>' +
      '</div>';
    document.body.appendChild(ov);
    ov.querySelector('#liveMuteBtn').onclick = function() {
      _muteMic = !_muteMic;
      this.textContent = _muteMic ? '🔇 Micro coupé' : '🎙️ Couper micro';
      if (_muteMic && w.EVASTS) w.EVASTS.stopListening();
      else if (_active) _listenNextTurn();
    };
    ov.querySelector('#liveStopSpeakBtn').onclick = function() {
      if (w.EVATTS) try { w.EVATTS.stopTTS(); } catch(_) {}
      if (_active && !_muteMic) setTimeout(_listenNextTurn, 250);
    };
    ov.querySelector('#liveExitBtn').onclick = closeLiveMode;
    return ov;
  }

  function _setLiveState(st, msg) {
    _state = st;
    var sEl = document.getElementById('liveStatusText');
    var tEl = document.getElementById('liveTranscriptBox');
    if (sEl) sEl.textContent = st === 'listening' ? '🎙️ À L\'ÉCOUTE...' : (st === 'thinking' ? '⚡ E.V.A RÉFLÉCHIT...' : '🔊 E.V.A PARLE');
    if (tEl && msg) tEl.textContent = msg;
  }

  async function _ensureLiveVoiceConversation() {
    if (w.S && w.S.convId) {
      var cur = (w.S.convs || []).find(function(c) { return c.id === w.S.convId; });
      if (cur && cur.isVoiceSession) return w.S.convId;
    }
    if (!w.S || !w.S.user || !w.db) return null;
    try {
      var now = w.timestamp ? w.timestamp() : new Date();
      var title = '🎙️ Session Live — ' + new Date().toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
      var ref = w.db.collection('users').doc(w.S.user.uid).collection('conversations').doc();
      var data = {
        title: title, lastMessage: 'Mode Live démarré', createdAt: now, updatedAt: now,
        aiProvider: (w.S.config && w.S.config.aiProvider) || 'pollinations', isVoiceSession: true
      };
      await ref.set(data);
      w.S.convId = ref.id;
      w.S.messages = [];
      if (!w.S.convs) w.S.convs = [];
      w.S.convs.unshift(Object.assign({ id: ref.id }, data));
      if (typeof w.renderConvs === 'function') w.renderConvs();
      return ref.id;
    } catch(e) { return null; }
  }

  function _listenNextTurn() {
    if (!_active || _muteMic || !w.EVASTS) return;
    _setLiveState('listening', 'À votre écoute…');
    var lastSpoken = '';
    var silenceTimer = null;
    w.EVASTS.startListening(
      function(txt, isFinal) {
        if (!_active) return;
        lastSpoken = String(txt || '').trim();
        var tEl = document.getElementById('liveTranscriptBox');
        if (tEl && lastSpoken) tEl.textContent = '« ' + lastSpoken + ' »';
        clearTimeout(silenceTimer);
        if (isFinal && lastSpoken.length > 1) {
          w.EVASTS.stopListening();
          _processLiveUtterance(lastSpoken);
        } else if (lastSpoken.length > 1) {
          silenceTimer = setTimeout(function() {
            if (_active && _state === 'listening' && lastSpoken.length > 1) {
              w.EVASTS.stopListening();
              _processLiveUtterance(lastSpoken);
            }
          }, 1600);
        }
      },
      function() {
        if (_active && _state === 'listening' && !_muteMic) setTimeout(_listenNextTurn, 500);
      }
    );
  }

  async function _processLiveUtterance(text) {
    if (!_active) return;
    _setLiveState('thinking', '« ' + text + ' »');
    try {
      await _ensureLiveVoiceConversation();
      if (!w.EVAChatHandler) throw new Error('ChatHandler indisponible');
      var r = await w.EVAChatHandler.sendMessage(text, { tone: (w.S && w.S.tone) || 'friendly' });
      var reply = (r && r.success && r.content) ? r.content : (r && r.fallbackMessage) || 'Désolée, je n\'ai pas compris.';
      if (!_active) return;
      _setLiveState('speaking', reply.slice(0, 220));
      if (typeof w.appendMsg === 'function') {
        w.appendMsg('user', text);
        w.appendMsg('eva', reply);
      }
      if (typeof w.saveConvMsg === 'function') w.saveConvMsg(text, reply).catch(function(){});
      if (w.EVATTS && typeof w.EVATTS.speakTextStreaming === 'function') {
        w.EVATTS.speakTextStreaming(reply, (w.S && w.S.config) || {});
        // Attendre la fin de lecture avant de reprendre l'écoute
        var checkDone = setInterval(function() {
          if (!_active) { clearInterval(checkDone); return; }
          var speaking = w.EVATTS.isSpeaking && w.EVATTS.isSpeaking();
          if (!speaking) {
            clearInterval(checkDone);
            setTimeout(_listenNextTurn, 350);
          }
        }, 400);
      } else {
        setTimeout(_listenNextTurn, 1200);
      }
    } catch(e) {
      if (_active) setTimeout(_listenNextTurn, 1000);
    }
  }

  async function openLiveMode() {
    if (_active) return;
    if (!w.EVASTS) {
      if (w.toast) w.toast('Reconnaissance vocale non disponible sur cet appareil', 'error');
      return;
    }
    var ok = await w.EVASTS.requestMicPermission();
    if (!ok) {
      if (w.toast) w.toast('Permission micro requise pour le Mode Live', 'error');
      return;
    }
    _active = true;
    _muteMic = false;
    _wasWakeWordOn = !!(w.S && w.S.wakeWordOn);
    if (_wasWakeWordOn && w.EVAWakeWord) try { w.EVAWakeWord.stop(); } catch(_) {}
    var btn = document.getElementById('liveModeBtn');
    if (btn) btn.classList.add('active');
    var ov = _ensureUI();
    ov.style.display = 'flex';
    _listenNextTurn();
  }

  function closeLiveMode() {
    _active = false;
    _state = 'idle';
    if (w.EVASTS) try { w.EVASTS.stopListening(); } catch(_) {}
    if (w.EVATTS) try { w.EVATTS.stopTTS(); } catch(_) {}
    var ov = document.getElementById('evaLiveOverlay');
    if (ov) ov.style.display = 'none';
    var btn = document.getElementById('liveModeBtn');
    if (btn) btn.classList.remove('active');
    if (_wasWakeWordOn && w.EVAWakeWord) setTimeout(function() { try { w.EVAWakeWord.start(); } catch(_) {} }, 500);
  }

  w.openLiveMode = openLiveMode;
  w.closeLiveMode = closeLiveMode;
  w.toggleLiveMode = function() {
    if (_active) closeLiveMode(); else openLiveMode();
  };
})(window);
