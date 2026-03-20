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
var pixiApp  = null;
var model    = null;
var state    = 'idle';
var lipIds   = null;
var idleTimer = null;

/* ─── LIP SYNC ───────────────────────────────────────────── */
var lipActive    = false;
var lipPhase     = 0;
var syllTimer    = 0;
var syllTarget   = 0;
var syllDur      = 6;
var mouthCurrent = 0;   // manually lerped

/* ─── BLINK ──────────────────────────────────────────────── */
var blinkTimer    = 200;
var blinkProgress = 0;
var isBlinking    = false;

/* ─── THINKING SWAY ──────────────────────────────────────── */
var thinkPhase = 0;

/* ─── HEAD LERP (for smooth transitions between states) ───── */
var headX = 0, headXt = 0;
var headY = 2, headYt = 2;
var headZ = 0, headZt = 0;
var eyeX  = 0, eyeXt  = 0;
var eyeY  = 0, eyeYt  = 0;
var LERP_SPEED = 0.06;

function lerpVal(cur, tgt, spd) { return cur + (tgt - cur) * spd; }

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

  playMotion(MOTION.idle.group, MOTION.idle.index);

  idleTimer = setTimeout(function() {
    if (state === 'idle') {
      playMotion(MOTION.idle2.group, MOTION.idle2.index);
      idleTimer = setTimeout(function() {
        if (state === 'idle') startIdleLoop();
      }, 9000);
    }
  }, 9000);
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

/* ─── SET CORE PARAM ─────────────────────────────────────── */
function sp(id, val) {
  if (!model) return;
  try {
    var core = model.internalModel.coreModel;
    if (core) core.setParameterValueById(id, val);
  } catch(e) {}
}

/* ═══════════════════════════════════════════════════════════
   MAIN TICKER
   ═══════════════════════════════════════════════════════════ */
function tick() {
  if (!model) return;

  /* ── 1. BLINK ─────────────────────────────────────────────
     Only set eye params while blinking to close then reopen.
     When not blinking: don't touch eye params — let motion handle them. */
  if (!isBlinking) {
    blinkTimer--;
    if (blinkTimer <= 0) {
      isBlinking    = true;
      blinkProgress = 0;
      blinkTimer    = 200 + Math.random() * 220;
    }
  } else {
    blinkProgress++;
    var eyeVal;
    if      (blinkProgress <= 4)  eyeVal = Math.max(0, 1 - blinkProgress / 4);
    else if (blinkProgress <= 7)  eyeVal = 0;
    else if (blinkProgress <= 13) eyeVal = (blinkProgress - 7) / 6;
    else { isBlinking = false; blinkProgress = 0; eyeVal = 1.0; }

    if (isBlinking || blinkProgress === 0) {
      sp('ParamEyeLOpen', eyeVal);
      sp('ParamEyeROpen', eyeVal);
    }
  }

  /* ── 2. LIP SYNC ──────────────────────────────────────────
     Syllable engine: picks consonants (0-0.1), short vowels
     (0.35-0.65), open vowels (0.70-1.0) and pauses randomly.
     Mouth value is manually lerped for smooth motion. */
  if (lipActive) {
    syllTimer--;
    if (syllTimer <= 0) {
      var r = Math.random();
      if (r < 0.20) {
        syllTarget = Math.random() * 0.08;
        syllDur    = 3 + Math.floor(Math.random() * 4);
      } else if (r < 0.48) {
        syllTarget = 0.35 + Math.random() * 0.30;
        syllDur    = 5 + Math.floor(Math.random() * 7);
      } else if (r < 0.80) {
        syllTarget = 0.70 + Math.random() * 0.28;
        syllDur    = 6 + Math.floor(Math.random() * 9);
      } else {
        syllTarget = 0;
        syllDur    = 10 + Math.floor(Math.random() * 12);
      }
      syllTimer = syllDur;
    }
    mouthCurrent += (syllTarget - mouthCurrent) * 0.40;
  } else {
    mouthCurrent += (0 - mouthCurrent) * 0.35;
  }

  var mv = Math.max(0, Math.min(1, mouthCurrent));
  for (var i = 0; i < lipIds.length; i++) sp(lipIds[i], mv);

  /* ── 3. HEAD / BODY — STATE SPECIFIC ─────────────────────
     Idle: do nothing — let the motion control the head.
     Thinking: gentle tilt oscillation.
     Talking: animated head following speech rhythm.
     Listening: static attentive pose (set on state entry). */

  if (state === 'thinking') {
    thinkPhase += 0.008;
    headXt = -10 + Math.sin(thinkPhase * 0.7) * 4;
    headYt =   7 + Math.sin(thinkPhase * 0.5) * 3;
    headZt =   5 + Math.sin(thinkPhase * 0.4) * 2;
    eyeXt  = -0.35 + Math.sin(thinkPhase * 0.9) * 0.10;
    eyeYt  =  0.30 + Math.sin(thinkPhase * 0.6) * 0.08;

    headX = lerpVal(headX, headXt, LERP_SPEED);
    headY = lerpVal(headY, headYt, LERP_SPEED);
    headZ = lerpVal(headZ, headZt, LERP_SPEED);
    eyeX  = lerpVal(eyeX,  eyeXt,  LERP_SPEED);
    eyeY  = lerpVal(eyeY,  eyeYt,  LERP_SPEED);

    sp('ParamAngleX',   headX);
    sp('ParamAngleY',   headY);
    sp('ParamAngleZ',   headZ);
    sp('ParamEyeBallX', eyeX);
    sp('ParamEyeBallY', eyeY);
    sp('ParamBrowLY',   0.30);
    sp('ParamBrowRY',  -0.10);

  } else if (state === 'talking') {
    lipPhase += 0.014;
    headXt =  Math.sin(lipPhase * 0.85) * 6;
    headYt = -1 + Math.sin(lipPhase * 0.55) * 4;
    headZt =  Math.sin(lipPhase * 0.45) * 3;
    eyeXt  =  Math.sin(lipPhase * 1.10) * 0.15;
    eyeYt  =  Math.sin(lipPhase * 0.70) * 0.08;

    headX = lerpVal(headX, headXt, LERP_SPEED);
    headY = lerpVal(headY, headYt, LERP_SPEED);
    headZ = lerpVal(headZ, headZt, LERP_SPEED);
    eyeX  = lerpVal(eyeX,  eyeXt,  LERP_SPEED);
    eyeY  = lerpVal(eyeY,  eyeYt,  LERP_SPEED);

    sp('ParamAngleX',   headX);
    sp('ParamAngleY',   headY);
    sp('ParamAngleZ',   headZ);
    sp('ParamEyeBallX', eyeX);
    sp('ParamEyeBallY', eyeY);

  } else if (state === 'listening') {
    /* Targets set on entry; just lerp smoothly toward them */
    headX = lerpVal(headX, headXt, LERP_SPEED);
    headY = lerpVal(headY, headYt, LERP_SPEED);
    headZ = lerpVal(headZ, headZt, LERP_SPEED);
    eyeX  = lerpVal(eyeX,  eyeXt,  0.04);
    eyeY  = lerpVal(eyeY,  eyeYt,  0.04);

    sp('ParamAngleX',   headX);
    sp('ParamAngleY',   headY);
    sp('ParamAngleZ',   headZ);
    sp('ParamEyeBallX', eyeX);
    sp('ParamEyeBallY', eyeY);
    sp('ParamBrowLY',   0.18);
    sp('ParamBrowRY',   0.18);
  }
  /* idle & happy: motion drives everything — we stay out of the way */
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
      'left:'               + (8 + Math.random() * 240) + 'px',
      'bottom:'             + (35 + Math.random() * 300) + 'px',
      'width:'              + (1 + Math.random() * 2.5) + 'px',
      'height:'             + (1 + Math.random() * 2.5) + 'px',
      'animation-duration:' + (5 + Math.random() * 6) + 's',
      'animation-delay:'    + (Math.random() * 8) + 's',
      'background:'         + (Math.random() > 0.6 ? '#b794f6' : '#00d4ff')
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
    lipActive    = true;
    syllTimer    = 0;
    syllTarget   = 0;
    mouthCurrent = 0;
    lipPhase     = 0;
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
    headXt =  3;
    headYt =  5;
    headZt = -1;
    eyeXt  =  0;
    eyeYt  =  0.2;
  },

  setThinking: function() {
    if (idleTimer) clearTimeout(idleTimer);
    lipActive = false;
    setStatus('thinking');
    thinkPhase = 0;
    playMotion(MOTION.flick.group, MOTION.flick.index);
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
