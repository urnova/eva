(function() {
'use strict';

/* ─── CONFIG ─────────────────────────────────────────────── */
var MODEL_URL = 'https://cdn.jsdelivr.net/gh/guansss/pixi-live2d-display@master/test/assets/haru/haru_greeter_t03.model3.json';

var MOTION = {
  idle:   { group: 'Idle',      index: 0 },
  idle2:  { group: 'Idle',      index: 1 },
  talk1:  { group: 'TapBody',   index: 0 },
  talk2:  { group: 'TapBody',   index: 1 },
  talk3:  { group: 'TapBody',   index: 2 },
  flick:  { group: 'FlickHead', index: 0 }
};

var STATUS = {
  idle:      'EN LIGNE',
  talking:   'PARLE...',
  listening: 'ÉCOUTE...',
  thinking:  'RÉFLÉCHIT...',
  happy:     'EN LIGNE'
};

/* ─── ENGINE STATE ───────────────────────────────────────── */
var pixiApp   = null;
var model     = null;
var state     = 'idle';
var lipIds    = null;
var idleTimer = null;

/* ═══════════════════════════════════════════════════════════
   SMOOTH PARAMETER SYSTEM
   Each parameter has v (current), t (target), s (lerp speed).
   step() moves v toward t every frame — no hard jumps ever.
   ═══════════════════════════════════════════════════════════ */
var P = {
  mouth:  { v: 0,   t: 0,   s: 0.28 },
  angX:   { v: 0,   t: 0,   s: 0.055 },
  angY:   { v: 2,   t: 2,   s: 0.055 },
  angZ:   { v: 0,   t: 0,   s: 0.055 },
  eyeX:   { v: 0,   t: 0,   s: 0.065 },
  eyeY:   { v: 0,   t: 0,   s: 0.065 },
  eyeL:   { v: 1,   t: 1,   s: 0.20  },
  eyeR:   { v: 1,   t: 1,   s: 0.20  },
  browL:  { v: 0,   t: 0,   s: 0.08  },
  browR:  { v: 0,   t: 0,   s: 0.08  },
  breath: { v: 0,   t: 0.5, s: 0.007 },
  bodyX:  { v: 0,   t: 0,   s: 0.038 }
};

function step(p) {
  p.v += (p.t - p.v) * p.s;
  return p.v;
}

/* ─── LIP SYNC STATE ─────────────────────────────────────── */
var lipActive    = false;
var syllTimer    = 0;
var syllTarget   = 0;
var syllDuration = 8;

/* ─── BLINK STATE ────────────────────────────────────────── */
var blinkTimer    = 180;
var blinkProgress = 0;
var isBlinking    = false;

/* ─── PHASE COUNTERS (continuous oscillators) ────────────── */
var breathPhase = 0;
var thinkPhase  = 0;
var listenPhase = 0;
var talkPhase   = 0;
var idlePhase   = 0;

/* ─── ENTRY POINT ────────────────────────────────────────── */
function create(containerId) {
  var wrap = document.getElementById(containerId);
  if (!wrap) return;
  wrap.innerHTML = buildHTML();
  spawnParticles();
  waitForLibs(function() { initPixi(wrap); });
}

/* ─── WAIT FOR PIXI + LIVE2D ─────────────────────────────── */
function waitForLibs(cb) {
  var n = 0;
  (function poll() {
    if (typeof PIXI !== 'undefined' && PIXI.live2d && PIXI.live2d.Live2DModel) return cb();
    if (++n < 60) return setTimeout(poll, 200);
    console.warn('[EVA] Library timeout');
    showFallback();
  })();
}

/* ─── PIXI + MODEL INIT ──────────────────────────────────── */
function initPixi(wrap) {
  var lc = document.getElementById('live2dContainer');
  if (!lc) return;

  var W = wrap.offsetWidth  || 270;
  var H = Math.max((wrap.offsetHeight || 500) - 32, 200);

  try {
    pixiApp = new PIXI.Application({
      width: W, height: H,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2)
    });
  } catch(e) { showFallback(); return; }

  var canvas = pixiApp.view;
  canvas.style.position  = 'absolute';
  canvas.style.bottom    = '0';
  canvas.style.left      = '50%';
  canvas.style.transform = 'translateX(-50%)';
  lc.appendChild(canvas);

  var timer = setTimeout(function() { if (!model) showFallback(); }, 20000);

  PIXI.live2d.Live2DModel.from(MODEL_URL, { autoInteract: false })
    .then(function(mdl) {
      clearTimeout(timer);
      model = mdl;
      pixiApp.stage.addChild(model);
      fitModel(W, H);

      try {
        var ids = model.internalModel.motionManager.lipSyncIds;
        if (ids && ids.length) lipIds = ids;
      } catch(e) {}
      if (!lipIds) lipIds = ['ParamMouthOpenY'];

      blinkTimer = 180 + Math.random() * 180;

      pixiApp.ticker.add(tick);
      startIdleLoop();

      var loading = document.getElementById('evaLoading');
      if (loading) loading.style.display = 'none';

      console.log('[EVA] Ready! lipIds:', lipIds);
    })
    .catch(function(e) {
      clearTimeout(timer);
      console.error('[EVA]', e);
      showFallback();
    });
}

/* ─── IDLE LOOP ──────────────────────────────────────────── */
function startIdleLoop() {
  if (idleTimer) clearTimeout(idleTimer);
  if (state !== 'idle') return;

  var useIdle2 = Math.random() < 0.4;
  playMotion(
    useIdle2 ? MOTION.idle2.group : MOTION.idle.group,
    useIdle2 ? MOTION.idle2.index : MOTION.idle.index
  );

  idleTimer = setTimeout(function() {
    if (state === 'idle') startIdleLoop();
  }, 7000 + Math.random() * 5000);
}

/* ─── FIT MODEL ──────────────────────────────────────────── */
function fitModel(W, H) {
  if (!model) return;
  var oh = model.internalModel.originalHeight || model.height;
  var scale = (H / oh) * 1.02;
  model.scale.set(scale);
  model.x = (W - model.width) / 2;
  model.y = H - model.height + model.height * 0.06;
}

/* ─── PLAY MOTION ────────────────────────────────────────── */
function playMotion(group, index, priority) {
  if (!model) return;
  var p = priority !== undefined ? priority
        : (PIXI.live2d.MotionPriority ? PIXI.live2d.MotionPriority.FORCE : 3);
  try { model.motion(group, index, p); } catch(e) {}
}

/* ─── SET PARAM (silent fail) ────────────────────────────── */
function sp(id, val) {
  if (!model) return;
  try { model.internalModel.coreModel.setParameterValueById(id, val); } catch(e) {}
}

/* ═══════════════════════════════════════════════════════════
   MAIN TICKER — runs every frame (~60fps)
   ═══════════════════════════════════════════════════════════ */
function tick() {
  if (!model) return;

  /* ── 1. BREATHING ─────────────────────────────────────────
     Slow sinusoidal respiration visible on angY + breath param.
     Always active regardless of state. */
  breathPhase += 0.013;
  var breathSin = Math.sin(breathPhase);
  var breathVal = (breathSin + 1) * 0.5;
  P.breath.t = breathVal;
  sp('ParamBreath', step(P.breath));
  var breathNudge = breathSin * 0.9; // slight vertical nudge on head

  /* ── 2. NATURAL BLINK ─────────────────────────────────────
     Random blinks every 3–7 seconds. 5 frames close, 3 hold,
     6 open. Eyes always smoothly return to 1.0 after blink. */
  var eyeBlinkFactor = 1.0;
  if (!isBlinking) {
    blinkTimer--;
    if (blinkTimer <= 0) {
      isBlinking    = true;
      blinkProgress = 0;
      blinkTimer    = 180 + Math.random() * 240;
    }
  } else {
    blinkProgress++;
    if      (blinkProgress <= 5)  eyeBlinkFactor = Math.max(0, 1 - blinkProgress / 5);
    else if (blinkProgress <= 8)  eyeBlinkFactor = 0;
    else if (blinkProgress <= 14) eyeBlinkFactor = (blinkProgress - 8) / 6;
    else { isBlinking = false; blinkProgress = 0; eyeBlinkFactor = 1.0; }
  }

  /* ── 3. LIP SYNC ──────────────────────────────────────────
     Syllable-based: randomly picks consonant / short vowel /
     long vowel / pause targets, mouth lerps toward each.
     Driven by TTS onstart → lipActive = true. */
  if (lipActive) {
    syllTimer--;
    if (syllTimer <= 0) {
      var r = Math.random();
      if (r < 0.22) {
        syllTarget   = Math.random() * 0.12;
        syllDuration = 4 + Math.floor(Math.random() * 5);
      } else if (r < 0.52) {
        syllTarget   = 0.25 + Math.random() * 0.35;
        syllDuration = 5 + Math.floor(Math.random() * 8);
      } else if (r < 0.80) {
        syllTarget   = 0.55 + Math.random() * 0.40;
        syllDuration = 7 + Math.floor(Math.random() * 10);
      } else {
        syllTarget   = 0;
        syllDuration = 12 + Math.floor(Math.random() * 14);
      }
      syllTimer = syllDuration;
    }
    P.mouth.t = syllTarget;
  } else {
    P.mouth.t = 0;
  }
  var mouthVal = Math.max(0, Math.min(1, step(P.mouth)));
  for (var i = 0; i < lipIds.length; i++) sp(lipIds[i], mouthVal);

  /* ── 4. STATE-SPECIFIC HEAD + BODY TARGETS ────────────────
     Each state drives its own oscillating targets.
     The lerp system in step() makes all transitions smooth. */

  if (state === 'idle') {
    /* Gentle alive feel: subtle sway, no stiff pose */
    idlePhase += 0.007;
    P.angX.t  = Math.sin(idlePhase * 0.8)  * 3;
    P.angY.t  = 2 + Math.sin(idlePhase * 0.5) * 2.5;
    P.angZ.t  = Math.sin(idlePhase * 0.35) * 1.5;
    P.eyeX.t  = Math.sin(idlePhase * 1.1)  * 0.12;
    P.eyeY.t  = Math.sin(idlePhase * 0.6)  * 0.10;
    P.browL.t = 0;
    P.browR.t = 0;
    P.bodyX.t = Math.sin(idlePhase * 0.3)  * 3;
    P.eyeL.t  = 1;
    P.eyeR.t  = 1;

  } else if (state === 'thinking') {
    /* Head tilted, eyes up-left as if searching memory.
       One brow slightly raised. Slow wandering gaze. */
    thinkPhase += 0.009;
    P.angX.t  = -11 + Math.sin(thinkPhase * 0.7) * 4;
    P.angY.t  =   7 + Math.sin(thinkPhase * 0.5) * 3;
    P.angZ.t  =   5 + Math.sin(thinkPhase * 0.4) * 2;
    P.eyeX.t  = -0.35 + Math.sin(thinkPhase * 0.9) * 0.12;
    P.eyeY.t  =  0.30 + Math.sin(thinkPhase * 0.6) * 0.08;
    P.browL.t =  0.35 + Math.sin(thinkPhase * 0.8) * 0.10;
    P.browR.t = -0.10;
    P.bodyX.t =  Math.sin(thinkPhase * 0.28) * 4.5;
    P.eyeL.t  =  1;
    P.eyeR.t  =  0.92;

  } else if (state === 'listening') {
    /* Attentive, slight forward-leaning energy.
       Eye contact maintained, eyebrows slightly raised. */
    listenPhase += 0.007;
    P.angX.t  =  4 + Math.sin(listenPhase * 0.55) * 2.5;
    P.angY.t  =  5 + Math.sin(listenPhase * 0.40) * 2;
    P.angZ.t  = -1.5 + Math.sin(listenPhase * 0.30) * 1;
    P.eyeX.t  =  Math.sin(listenPhase * 0.70) * 0.10;
    P.eyeY.t  =  0.22 + Math.sin(listenPhase * 0.45) * 0.06;
    P.browL.t =  0.20;
    P.browR.t =  0.20;
    P.bodyX.t =  Math.sin(listenPhase * 0.22) * 2.5;
    P.eyeL.t  =  1;
    P.eyeR.t  =  1;

  } else if (state === 'talking') {
    /* Head bobs naturally with speech, body sways gently.
       More energetic than idle — she's engaged. */
    talkPhase += 0.014;
    P.angX.t  =  Math.sin(talkPhase * 0.85) * 7;
    P.angY.t  = -2 + Math.sin(talkPhase * 0.60) * 5;
    P.angZ.t  =  Math.sin(talkPhase * 0.50) * 3.5;
    P.eyeX.t  =  Math.sin(talkPhase * 1.10) * 0.18;
    P.eyeY.t  =  Math.sin(talkPhase * 0.75) * 0.10;
    P.browL.t =  Math.abs(Math.sin(talkPhase * 0.42)) * 0.22;
    P.browR.t =  Math.abs(Math.sin(talkPhase * 0.42)) * 0.22;
    P.bodyX.t =  Math.sin(talkPhase * 0.38) * 6;
    P.eyeL.t  =  1;
    P.eyeR.t  =  1;

  } else if (state === 'happy') {
    /* Upright, bright, open — joyful posture.
       Eyes wide, eyebrows lifted, positive energy. */
    idlePhase += 0.010;
    P.angX.t  =  Math.sin(idlePhase * 1.0) * 4;
    P.angY.t  = -1 + Math.sin(idlePhase * 0.7) * 3;
    P.angZ.t  =  Math.sin(idlePhase * 0.5) * 2;
    P.eyeX.t  =  Math.sin(idlePhase * 1.2) * 0.15;
    P.eyeY.t  =  0.15;
    P.browL.t =  0.30;
    P.browR.t =  0.30;
    P.bodyX.t =  Math.sin(idlePhase * 0.4) * 5;
    P.eyeL.t  =  1;
    P.eyeR.t  =  1;
  }

  /* ── 5. APPLY ALL PARAMS ──────────────────────────────────
     All values smoothly lerped — never a hard jump. */
  sp('ParamAngleX',    step(P.angX));
  sp('ParamAngleY',    step(P.angY) + breathNudge);
  sp('ParamAngleZ',    step(P.angZ));
  sp('ParamEyeBallX',  step(P.eyeX));
  sp('ParamEyeBallY',  step(P.eyeY));
  sp('ParamEyeLOpen',  step(P.eyeL) * eyeBlinkFactor);
  sp('ParamEyeROpen',  step(P.eyeR) * eyeBlinkFactor);
  sp('ParamBrowLY',    step(P.browL));
  sp('ParamBrowRY',    step(P.browR));
  sp('ParamBodyAngleX', step(P.bodyX));
}

/* ─── STATUS BAR ─────────────────────────────────────────── */
function setStatus(s) {
  state = s;
  var bar = document.getElementById('evaStatusBar');
  var txt = document.getElementById('evaStatusTxt');
  if (bar) bar.className = 'eva-status' + (['talking','listening','thinking'].includes(s) ? ' '+s : '');
  if (txt) txt.textContent = STATUS[s] || 'EN LIGNE';
}

/* ─── FALLBACK ───────────────────────────────────────────── */
function showFallback() {
  var el = document.getElementById('evaLoading');
  if (el) el.innerHTML = '<span style="color:rgba(0,212,255,0.4);font-family:monospace;font-size:0.7em;letter-spacing:2px;text-align:center;">EVA<br>ONLINE</span>';
}

/* ─── PARTICLES ──────────────────────────────────────────── */
function spawnParticles() {
  var c = document.getElementById('evaParticles');
  if (!c) return;
  for (var i = 0; i < 16; i++) {
    var p = document.createElement('div');
    p.className = 'eva-p';
    p.style.cssText = [
      'left:'             + (8 + Math.random() * 240) + 'px',
      'bottom:'           + (35 + Math.random() * 300) + 'px',
      'width:'            + (1 + Math.random() * 2.5) + 'px',
      'height:'           + (1 + Math.random() * 2.5) + 'px',
      'animation-duration:' + (5 + Math.random() * 6) + 's',
      'animation-delay:'  + (Math.random() * 8) + 's',
      'background:'       + (Math.random() > 0.6 ? '#b794f6' : '#00d4ff')
    ].join(';');
    c.appendChild(p);
  }
}

/* ─── HTML TEMPLATE ──────────────────────────────────────── */
function buildHTML() {
  return `
<style>
#evaWrap{position:relative;width:100%;height:100%;overflow:hidden;}

#live2dContainer{
  position:absolute;top:0;left:0;
  width:100%;height:calc(100% - 32px);
  overflow:hidden;
}

.eva-bg-glow{
  position:absolute;bottom:32px;left:50%;
  transform:translateX(-50%);
  width:220px;height:90px;
  background:radial-gradient(ellipse,rgba(0,212,255,0.1) 0%,transparent 70%);
  animation:glowP 4s ease-in-out infinite;
  z-index:0;pointer-events:none;border-radius:50%;
}
@keyframes glowP{
  0%,100%{opacity:0.5;transform:translateX(-50%) scaleX(1);}
  50%{opacity:1;transform:translateX(-50%) scaleX(1.25);}
}

.eva-particles{position:absolute;inset:0;pointer-events:none;z-index:0;overflow:hidden;}
.eva-p{
  position:absolute;border-radius:50%;
  animation:pFloat linear infinite;opacity:0;
}
@keyframes pFloat{
  0%{opacity:0;transform:translateY(0) scale(0);}
  8%{opacity:0.6;}
  90%{opacity:0.3;}
  100%{opacity:0;transform:translateY(-130px) scale(2);}
}

.eva-status{
  position:absolute;bottom:0;left:0;right:0;height:32px;
  display:flex;align-items:center;justify-content:center;gap:7px;
  font-family:'Space Mono',monospace;font-size:0.6em;
  color:rgba(0,212,255,0.85);letter-spacing:1.5px;
  text-transform:uppercase;z-index:10;transition:color 0.4s ease;
}
.eva-status-dot{
  width:5px;height:5px;border-radius:50%;
  background:#00d4ff;flex-shrink:0;
  animation:sDot 2s ease-in-out infinite;
}
@keyframes sDot{0%,100%{opacity:1;transform:scale(1);}50%{opacity:0.3;transform:scale(0.55);}}
.eva-status.talking   .eva-status-dot{background:#00ff88;animation:sDot 0.18s ease-in-out infinite;}
.eva-status.listening .eva-status-dot{background:#00ff88;animation:sDot 0.38s ease-in-out infinite;}
.eva-status.thinking  .eva-status-dot{background:#b794f6;animation:sDot 0.75s ease-in-out infinite;}
.eva-status.talking  {color:rgba(0,255,136,0.9);}
.eva-status.listening{color:rgba(0,255,136,0.9);}
.eva-status.thinking {color:rgba(183,148,246,0.9);}

.eva-scan-line{
  position:absolute;left:0;right:0;height:1px;
  background:linear-gradient(90deg,transparent,rgba(0,212,255,0.4),transparent);
  animation:scan 7s ease-in-out infinite;z-index:5;pointer-events:none;
}
@keyframes scan{
  0%{bottom:35px;opacity:0;}6%{opacity:0.5;}94%{opacity:0.2;}100%{bottom:100%;opacity:0;}
}

.eva-corner{position:absolute;width:11px;height:11px;z-index:6;pointer-events:none;opacity:0.3;}
.eva-corner.tl{top:8px;left:8px;border-top:1.5px solid #00d4ff;border-left:1.5px solid #00d4ff;}
.eva-corner.tr{top:8px;right:8px;border-top:1.5px solid #00d4ff;border-right:1.5px solid #00d4ff;}
.eva-corner.bl{bottom:36px;left:8px;border-bottom:1.5px solid #00d4ff;border-left:1.5px solid #00d4ff;}
.eva-corner.br{bottom:36px;right:8px;border-bottom:1.5px solid #00d4ff;border-right:1.5px solid #00d4ff;}

.eva-loading{
  position:absolute;top:45%;left:50%;
  transform:translate(-50%,-50%);
  display:flex;flex-direction:column;align-items:center;gap:10px;
  z-index:10;color:rgba(0,212,255,0.6);
  font-family:'Space Mono',monospace;font-size:0.6em;letter-spacing:2px;text-align:center;
}
.eva-loading-ring{
  width:28px;height:28px;
  border:2px solid rgba(0,212,255,0.1);
  border-top-color:#00d4ff;border-radius:50%;
  animation:spin 0.85s linear infinite;
}
@keyframes spin{to{transform:rotate(360deg);}}
</style>

<div id="evaWrap">
  <div class="eva-corner tl"></div>
  <div class="eva-corner tr"></div>
  <div class="eva-corner bl"></div>
  <div class="eva-corner br"></div>
  <div class="eva-scan-line"></div>
  <div class="eva-particles" id="evaParticles"></div>
  <div class="eva-bg-glow"></div>
  <div id="live2dContainer">
    <div class="eva-loading" id="evaLoading">
      <div class="eva-loading-ring"></div>
      <span>INITIALISATION...</span>
    </div>
  </div>
  <div class="eva-status" id="evaStatusBar">
    <div class="eva-status-dot"></div>
    <span id="evaStatusTxt">EN LIGNE</span>
  </div>
</div>`;
}

/* ─── PUBLIC API ─────────────────────────────────────────── */
window.EvaCharacter = {
  create: create,

  setIdle: function() {
    lipActive = false;
    setStatus('idle');
    startIdleLoop();
  },

  setTalking: function() {
    if (idleTimer) clearTimeout(idleTimer);
    lipActive  = true;
    syllTimer  = 0;
    syllTarget = 0;
    setStatus('talking');
    var motions = [MOTION.talk1, MOTION.talk2, MOTION.talk3];
    var m = motions[Math.floor(Math.random() * motions.length)];
    playMotion(m.group, m.index);
  },

  startTalking: function() { window.EvaCharacter.setTalking(); },

  stopTalking: function() {
    lipActive = false;
    setStatus('idle');
    startIdleLoop();
  },

  setListening: function() {
    if (idleTimer) clearTimeout(idleTimer);
    lipActive = false;
    setStatus('listening');
  },

  setThinking: function() {
    if (idleTimer) clearTimeout(idleTimer);
    lipActive = false;
    setStatus('thinking');
    if (Math.random() < 0.4) playMotion(MOTION.flick.group, MOTION.flick.index);
  },

  setHappy: function() {
    if (idleTimer) clearTimeout(idleTimer);
    lipActive = false;
    setStatus('happy');
    playMotion(MOTION.talk2.group, MOTION.talk2.index);
    setTimeout(function() {
      if (state === 'happy') {
        setStatus('idle');
        startIdleLoop();
      }
    }, 4000);
  }
};

})();
