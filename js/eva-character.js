(function() {
'use strict';

/* ─── CONFIG ───────────────────────────────────────────── */
var MODEL_URL = 'https://cdn.jsdelivr.net/gh/Eikanya/Live2d-model@master/Live2D/Senko_Normals/senko.model3.json';

var MOTION = {
  idle:     { group: 'Idle',    index: 0 },
  anim:     { group: 'Tap',     index: 0 },
  sing:     { group: 'Taphead', index: 0 },
  sleep:    { group: 'Taphead', index: 1 }
};

var STATUS = {
  idle:      'EN LIGNE',
  talking:   'PARLE...',
  listening: 'ÉCOUTE...',
  thinking:  'RÉFLÉCHIT...',
  happy:     'EN LIGNE'
};

/* ─── STATE ─────────────────────────────────────────────── */
var pixiApp    = null;
var model      = null;
var state      = 'idle';
var lipActive  = false;
var lipPhase   = 0;
var lipIds     = null;   // fetched from model's LipSync group
var blinkTimer = 0;
var blinkState = 0;      // 0=open 1=closing 2=open-wait
var blinkVal   = 0;

/* ─── ENTRY POINT ───────────────────────────────────────── */
function create(containerId) {
  var wrap = document.getElementById(containerId);
  if (!wrap) return;

  wrap.innerHTML = buildHTML();
  spawnParticles();
  waitForLibs(function() { initPixi(wrap); });
}

/* ─── WAIT FOR PIXI + LIVE2D ───────────────────────────── */
function waitForLibs(cb) {
  var n = 0;
  (function poll() {
    if (typeof PIXI !== 'undefined' && PIXI.live2d && PIXI.live2d.Live2DModel) return cb();
    if (++n < 60) return setTimeout(poll, 200);
    console.warn('[EVA] Library timeout');
    showFallback();
  })();
}

/* ─── PIXI + MODEL INIT ─────────────────────────────────── */
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
  canvas.style.position = 'absolute';
  canvas.style.bottom   = '0';
  canvas.style.left     = '50%';
  canvas.style.transform = 'translateX(-50%)';
  lc.appendChild(canvas);

  console.log('[EVA] Loading Senko...');

  var timer = setTimeout(function() { if (!model) showFallback(); }, 20000);

  PIXI.live2d.Live2DModel.from(MODEL_URL, { autoInteract: false })
    .then(function(mdl) {
      clearTimeout(timer);
      model = mdl;
      pixiApp.stage.addChild(model);

      fitModel(W, H);

      /* collect lip-sync parameter IDs from model */
      try {
        var ids = model.internalModel.motionManager.lipSyncIds;
        if (ids && ids.length) lipIds = ids;
      } catch(e) {}
      if (!lipIds) lipIds = ['ParamMouthOpenY'];

      /* start main ticker */
      pixiApp.ticker.add(tick);

      /* play idle — it has Loop:true so it runs forever */
      playMotion('Idle', 0);

      var loading = document.getElementById('evaLoading');
      if (loading) loading.style.display = 'none';

      console.log('[EVA] Senko ready! lipIds:', lipIds);
    })
    .catch(function(e) {
      clearTimeout(timer);
      console.error('[EVA]', e);
      showFallback();
    });
}

/* ─── FIT MODEL ─────────────────────────────────────────── */
function fitModel(W, H) {
  if (!model) return;
  var oh = model.internalModel.originalHeight || model.height;
  var ow = model.internalModel.originalWidth  || model.width;

  /* fill ~100% of height; bottom-anchor with ~6% feet crop */
  var scale = (H / oh) * 1.02;
  model.scale.set(scale);
  model.x = (W - model.width) / 2;
  model.y = H - model.height + model.height * 0.06;
}

/* ─── PLAY MOTION ───────────────────────────────────────── */
function playMotion(group, index, priority) {
  if (!model) return;
  var p = priority !== undefined ? priority
        : (PIXI.live2d.MotionPriority ? PIXI.live2d.MotionPriority.FORCE : 3);
  try { model.motion(group, index, p); } catch(e) {}
}

/* ─── MAIN TICKER ───────────────────────────────────────── */
function tick() {
  if (!model) return;
  var core = model.internalModel.coreModel;
  if (!core) return;

  /* ── lip sync ─────────────────────────────────────────── */
  if (lipActive) {
    lipPhase += 0.22 + Math.random() * 0.12;
    var mv = Math.max(0, Math.min(1,
      Math.abs(Math.sin(lipPhase)) * 0.80 + Math.random() * 0.22
    ));
    for (var i = 0; i < lipIds.length; i++) {
      try { core.setParameterValueById(lipIds[i], mv); } catch(e) {}
    }
  } else {
    for (var j = 0; j < lipIds.length; j++) {
      try { core.setParameterValueById(lipIds[j], 0); } catch(e) {}
    }
  }

  /* ── subtle head sway for thinking ───────────────────── */
  if (state === 'thinking') {
    var t = Date.now() * 0.001;
    try { core.setParameterValueById('ParamAngleX', Math.sin(t * 1.1) * 7); } catch(e) {}
    try { core.setParameterValueById('ParamAngleY', Math.sin(t * 0.7) * 4 - 4); } catch(e) {}
  }

  /* ── listening: slight upward gaze ───────────────────── */
  if (state === 'listening') {
    try { core.setParameterValueById('ParamAngleY', 5); } catch(e) {}
    try { core.setParameterValueById('ParamEyeBallY', 0.5); } catch(e) {}
  }
}

/* ─── STATUS BAR ────────────────────────────────────────── */
function setStatus(s) {
  state = s;
  var bar = document.getElementById('evaStatusBar');
  var txt = document.getElementById('evaStatusTxt');
  if (bar) bar.className = 'eva-status' + (['talking','listening','thinking'].includes(s) ? ' '+s : '');
  if (txt) txt.textContent = STATUS[s] || 'EN LIGNE';
}

/* ─── FALLBACK ──────────────────────────────────────────── */
function showFallback() {
  var el = document.getElementById('evaLoading');
  if (el) el.innerHTML = '<span style="color:rgba(0,212,255,0.4);font-family:monospace;font-size:0.7em;letter-spacing:2px;text-align:center;">EVA<br>ONLINE</span>';
}

/* ─── PARTICLES ─────────────────────────────────────────── */
function spawnParticles() {
  var c = document.getElementById('evaParticles');
  if (!c) return;
  for (var i = 0; i < 16; i++) {
    var p = document.createElement('div');
    p.className = 'eva-p';
    p.style.cssText = [
      'left:' + (8 + Math.random() * 240) + 'px',
      'bottom:' + (35 + Math.random() * 300) + 'px',
      'width:' + (1 + Math.random() * 2.5) + 'px',
      'height:' + (1 + Math.random() * 2.5) + 'px',
      'animation-duration:' + (5 + Math.random() * 6) + 's',
      'animation-delay:' + (Math.random() * 8) + 's',
      'background:' + (Math.random() > 0.6 ? '#b794f6' : '#00d4ff')
    ].join(';');
    c.appendChild(p);
  }
}

/* ─── HTML TEMPLATE ─────────────────────────────────────── */
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

/* ─── PUBLIC API ────────────────────────────────────────── */
window.EvaCharacter = {
  create: create,

  setIdle: function() {
    lipActive = false;
    setStatus('idle');
  },

  setTalking: function() {
    lipActive = true;
    lipPhase  = 0;
    setStatus('talking');
    /* play the animated motion (loops naturally) */
    playMotion('Tap', 0);
  },

  startTalking: function() { window.EvaCharacter.setTalking(); },

  stopTalking: function() {
    lipActive = false;
    setStatus('idle');
    /* return to idle loop */
    playMotion('Idle', 0);
  },

  setListening: function() {
    lipActive = false;
    setStatus('listening');
  },

  setThinking: function() {
    lipActive = false;
    setStatus('thinking');
  },

  setHappy: function() {
    lipActive = false;
    setStatus('happy');
    /* brief sing animation then back to idle */
    playMotion('Taphead', 0);
    setTimeout(function() {
      if (state === 'happy') {
        setStatus('idle');
        playMotion('Idle', 0);
      }
    }, 4000);
  }
};

})();
