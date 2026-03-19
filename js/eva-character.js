(function() {
'use strict';

var pixiApp = null;
var live2dModel = null;
var currentState = 'idle';
var lipSyncActive = false;
var lipSyncPhase = 0;
var paramOverrides = {};
var idleLoopActive = false;

var MODEL_URL = 'https://cdn.jsdelivr.net/gh/guansss/pixi-live2d-display@master/test/assets/haru/haru_greeter_t03.model3.json';

var STATUS_LABELS = {
  idle:      'EN LIGNE',
  talking:   'PARLE...',
  listening: 'ÉCOUTE...',
  thinking:  'RÉFLÉCHIT...',
  happy:     'EN LIGNE'
};

function create(containerId) {
  var container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
<style>
#evaWrap {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

#live2dContainer {
  position: absolute;
  top: 0; left: 0;
  width: 100%;
  height: calc(100% - 32px);
  overflow: hidden;
}

#live2dContainer canvas {
  display: block;
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
}

.eva-bg-glow {
  position: absolute;
  bottom: 32px;
  left: 50%;
  transform: translateX(-50%);
  width: 200px;
  height: 80px;
  background: radial-gradient(ellipse, rgba(0,212,255,0.12) 0%, transparent 70%);
  animation: glowPulse 4s ease-in-out infinite;
  z-index: 0;
  pointer-events: none;
  border-radius: 50%;
}
@keyframes glowPulse {
  0%,100% { opacity: 0.5; transform: translateX(-50%) scaleX(1); }
  50%      { opacity: 1;   transform: translateX(-50%) scaleX(1.2); }
}

.eva-particles {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  overflow: hidden;
}
.eva-p {
  position: absolute;
  border-radius: 50%;
  background: #00d4ff;
  animation: pFloat linear infinite;
  opacity: 0;
}
@keyframes pFloat {
  0%   { opacity: 0; transform: translateY(0) scale(0); }
  8%   { opacity: 0.6; }
  90%  { opacity: 0.4; }
  100% { opacity: 0; transform: translateY(-120px) scale(1.8); }
}

.eva-status {
  position: absolute;
  bottom: 0; left: 0; right: 0;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  font-family: 'Space Mono', monospace;
  font-size: 0.62em;
  color: rgba(0,212,255,0.85);
  letter-spacing: 1.5px;
  text-transform: uppercase;
  z-index: 10;
  transition: color 0.3s ease;
}
.eva-status-dot {
  width: 5px; height: 5px;
  border-radius: 50%;
  background: #00d4ff;
  flex-shrink: 0;
  animation: sDot 2s ease-in-out infinite;
}
@keyframes sDot {
  0%,100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.35; transform: scale(0.6); }
}
.eva-status.talking   .eva-status-dot { background: #00ff88; animation: sDot 0.2s ease-in-out infinite; }
.eva-status.listening .eva-status-dot { background: #00ff88; animation: sDot 0.4s ease-in-out infinite; }
.eva-status.thinking  .eva-status-dot { background: #b794f6; animation: sDot 0.8s ease-in-out infinite; }
.eva-status.talking   { color: rgba(0,255,136,0.9); }
.eva-status.listening { color: rgba(0,255,136,0.9); }
.eva-status.thinking  { color: rgba(183,148,246,0.9); }

.eva-scan-line {
  position: absolute;
  left: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(0,212,255,0.4), transparent);
  animation: scanLine 6s ease-in-out infinite;
  z-index: 5;
  pointer-events: none;
}
@keyframes scanLine {
  0%   { bottom: 35px; opacity: 0; }
  6%   { opacity: 0.5; }
  94%  { opacity: 0.25; }
  100% { bottom: 100%; opacity: 0; }
}

.eva-hud-tl, .eva-hud-tr, .eva-hud-bl, .eva-hud-br {
  position: absolute;
  width: 12px; height: 12px;
  z-index: 6;
  pointer-events: none;
  opacity: 0.35;
}
.eva-hud-tl { top: 8px; left: 8px;  border-top: 1.5px solid #00d4ff; border-left:  1.5px solid #00d4ff; }
.eva-hud-tr { top: 8px; right: 8px; border-top: 1.5px solid #00d4ff; border-right: 1.5px solid #00d4ff; }
.eva-hud-bl { bottom: 36px; left: 8px;  border-bottom: 1.5px solid #00d4ff; border-left:  1.5px solid #00d4ff; }
.eva-hud-br { bottom: 36px; right: 8px; border-bottom: 1.5px solid #00d4ff; border-right: 1.5px solid #00d4ff; }

.eva-loading {
  position: absolute;
  top: 45%; left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  z-index: 10;
  color: rgba(0,212,255,0.6);
  font-family: 'Space Mono', monospace;
  font-size: 0.6em;
  letter-spacing: 2px;
  text-align: center;
}
.eva-loading-ring {
  width: 30px; height: 30px;
  border: 2px solid rgba(0,212,255,0.12);
  border-top-color: #00d4ff;
  border-radius: 50%;
  animation: loadSpin 0.9s linear infinite;
}
@keyframes loadSpin { to { transform: rotate(360deg); } }
</style>

<div id="evaWrap">
  <div class="eva-hud-tl"></div>
  <div class="eva-hud-tr"></div>
  <div class="eva-hud-bl"></div>
  <div class="eva-hud-br"></div>
  <div class="eva-scan-line"></div>
  <div class="eva-particles" id="evaParticles"></div>
  <div class="eva-bg-glow"></div>
  <div id="live2dContainer">
    <div class="eva-loading" id="evaLoading">
      <div class="eva-loading-ring"></div>
      <span>CHARGEMENT...</span>
    </div>
  </div>
  <div class="eva-status" id="evaStatusBar">
    <div class="eva-status-dot"></div>
    <span id="evaStatusTxt">EN LIGNE</span>
  </div>
</div>
  `;

  spawnParticles();
  waitForLibraries(function() { initLive2D(container); });
}

function waitForLibraries(cb) {
  var tries = 0;
  function check() {
    if (typeof PIXI !== 'undefined' && PIXI.live2d && PIXI.live2d.Live2DModel) {
      cb();
    } else if (tries < 50) {
      tries++;
      setTimeout(check, 200);
    } else {
      console.warn('[EVA] Libraries timeout');
      showFallback();
    }
  }
  check();
}

function initLive2D(container) {
  var liveContainer = document.getElementById('live2dContainer');
  if (!liveContainer) return;

  var w = container.offsetWidth  || 265;
  var h = Math.max((container.offsetHeight || 500) - 32, 200);

  try {
    pixiApp = new PIXI.Application({
      width: w,
      height: h,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1
    });
  } catch(e) {
    console.error('[EVA] PIXI error:', e);
    showFallback();
    return;
  }

  var canvas = pixiApp.view;
  canvas.style.bottom = '0';
  liveContainer.appendChild(canvas);

  console.log('[EVA] Loading Haru...');

  var loadTimeout = setTimeout(function() {
    if (!live2dModel) { console.warn('[EVA] Timeout'); showFallback(); }
  }, 25000);

  PIXI.live2d.Live2DModel.from(MODEL_URL, { autoInteract: false }).then(function(mdl) {
    clearTimeout(loadTimeout);
    live2dModel = mdl;
    pixiApp.stage.addChild(live2dModel);

    var origH = live2dModel.internalModel.originalHeight || live2dModel.height;
    var origW = live2dModel.internalModel.originalWidth  || live2dModel.width;

    var scale = (h / origH) * 1.05;
    live2dModel.scale.set(scale);

    live2dModel.x = (w - live2dModel.width) / 2;
    live2dModel.y = h - live2dModel.height + (live2dModel.height * 0.07);

    pixiApp.ticker.add(mainTick);

    var loading = document.getElementById('evaLoading');
    if (loading) loading.style.display = 'none';

    console.log('[EVA] Haru ready!');
    startIdleLoop();
  }).catch(function(err) {
    clearTimeout(loadTimeout);
    console.error('[EVA] Load error:', err);
    showFallback();
  });
}

function startIdleLoop() {
  if (!live2dModel || idleLoopActive) return;
  idleLoopActive = true;
  playIdleOnce();
}

function playIdleOnce() {
  if (!live2dModel) return;
  try {
    var priority = PIXI.live2d.MotionPriority ? PIXI.live2d.MotionPriority.IDLE : 1;
    live2dModel.motion('Idle', 0, priority);
    live2dModel.internalModel.motionManager.once('motionEnd', function() {
      if (idleLoopActive) {
        setTimeout(playIdleOnce, 50);
      }
    });
  } catch(e) {}
}

function mainTick() {
  if (!live2dModel) return;
  try {
    var core = live2dModel.internalModel.coreModel;

    if (lipSyncActive) {
      lipSyncPhase += 0.18 + Math.random() * 0.08;
      var mouthVal = Math.max(0, Math.min(1,
        Math.abs(Math.sin(lipSyncPhase)) * 0.75 + Math.random() * 0.25
      ));
      core.setParameterValueById('ParamMouthOpenY', mouthVal);
      core.setParameterValueById('ParamMouthForm', 0.3);
    } else {
      core.setParameterValueById('ParamMouthOpenY', 0);
    }

    var anX = paramOverrides.angleX || 0;
    var anY = paramOverrides.angleY || 0;
    if (currentState === 'thinking') {
      anX = Math.sin(Date.now() * 0.001) * 8;
      anY = -5 + Math.sin(Date.now() * 0.0007) * 3;
    }
    if (currentState === 'listening') {
      anY = 4;
    }
    if (anX !== 0) core.setParameterValueById('ParamAngleX', anX);
    if (anY !== 0) core.setParameterValueById('ParamAngleY', anY);

  } catch(e) {}
}

function setStatus(state) {
  currentState = state;
  var bar = document.getElementById('evaStatusBar');
  var txt = document.getElementById('evaStatusTxt');
  if (bar) bar.className = 'eva-status' + (state !== 'idle' && state !== 'happy' ? ' ' + state : '');
  if (txt) txt.textContent = STATUS_LABELS[state] || 'EN LIGNE';
}

function showFallback() {
  var loading = document.getElementById('evaLoading');
  if (loading) loading.innerHTML = '<span style="color:rgba(0,212,255,0.45);font-family:Space Mono,monospace;font-size:0.65em;letter-spacing:2px;">EVA<br>ONLINE</span>';
}

function spawnParticles() {
  var c = document.getElementById('evaParticles');
  if (!c) return;
  for (var i = 0; i < 14; i++) {
    var el = document.createElement('div');
    el.className = 'eva-p';
    el.style.left   = (10 + Math.random() * 240) + 'px';
    el.style.bottom = (35 + Math.random() * 280) + 'px';
    el.style.width  = el.style.height = (1 + Math.random() * 2.4) + 'px';
    el.style.animationDuration = (5 + Math.random() * 5) + 's';
    el.style.animationDelay   = (Math.random() * 7) + 's';
    if (Math.random() > 0.65) el.style.background = '#b794f6';
    c.appendChild(el);
  }
}

window.EvaCharacter = {
  create: create,

  setIdle: function() {
    setStatus('idle');
    paramOverrides = {};
  },

  setTalking: function() {
    setStatus('talking');
    paramOverrides = {};
    lipSyncActive = true;
    lipSyncPhase = 0;
  },

  startTalking: function() {
    window.EvaCharacter.setTalking();
  },

  stopTalking: function() {
    lipSyncActive = false;
    setStatus('idle');
    paramOverrides = {};
  },

  setListening: function() {
    setStatus('listening');
    paramOverrides = {};
    lipSyncActive = false;
  },

  setThinking: function() {
    setStatus('thinking');
    paramOverrides = {};
    lipSyncActive = false;
  },

  setHappy: function() {
    setStatus('happy');
    paramOverrides = {};
    lipSyncActive = false;
    setTimeout(function() {
      if (currentState === 'happy') window.EvaCharacter.setIdle();
    }, 3000);
  }
};

})();
