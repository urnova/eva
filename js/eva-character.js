(function() {
'use strict';

var pixiApp = null;
var live2dModel = null;
var currentState = 'idle';
var mouseX = 0;
var mouseY = 0;
var trackMouse = false;

var MODEL_URL = 'https://cdn.jsdelivr.net/gh/guansss/pixi-live2d-display@master/test/assets/shizuku/shizuku.model.json';

var MOTIONS = {
  idle:      { group: 'idle',      index: 0 },
  talking:   { group: 'tap_body',  index: 0 },
  listening: { group: 'idle',      index: 1 },
  thinking:  { group: 'flick_head',index: 0 },
  happy:     { group: 'tap_body',  index: 1 }
};

var STATUS_LABELS = {
  idle:      'EN LIGNE',
  talking:   'RÉPOND...',
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
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  overflow: hidden;
  padding-bottom: 8px;
}

#live2dContainer {
  position: absolute;
  top: 0; left: 0;
  width: 100%;
  height: calc(100% - 36px);
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

#live2dContainer canvas {
  display: block;
}

.eva-bg-glow {
  position: absolute;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  width: 200px;
  height: 200px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(0,212,255,0.12) 0%, transparent 70%);
  animation: glowPulse 4s ease-in-out infinite;
  z-index: 0;
  pointer-events: none;
}
@keyframes glowPulse {
  0%,100% { opacity: 0.6; transform: translateX(-50%) scale(1); }
  50%      { opacity: 1;   transform: translateX(-50%) scale(1.3); }
}

.eva-ground {
  position: absolute;
  bottom: 38px;
  left: 50%;
  transform: translateX(-50%);
  width: 150px;
  height: 16px;
  background: radial-gradient(ellipse, rgba(0,212,255,0.22) 0%, transparent 70%);
  border-radius: 50%;
  animation: groundPulse 5s ease-in-out infinite;
  z-index: 1;
  pointer-events: none;
}
@keyframes groundPulse {
  0%,100% { opacity: 0.9; transform: translateX(-50%) scaleX(1); }
  50%      { opacity: 0.4; transform: translateX(-50%) scaleX(0.7); }
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
  8%   { opacity: 0.7; }
  90%  { opacity: 0.5; }
  100% { opacity: 0; transform: translateY(-140px) scale(2); }
}

.eva-status {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 5px 14px;
  background: rgba(0,212,255,0.07);
  border: 1px solid rgba(0,212,255,0.18);
  border-radius: 20px;
  font-family: 'Space Mono', monospace;
  font-size: 0.68em;
  color: rgba(0,212,255,0.85);
  letter-spacing: 1.5px;
  text-transform: uppercase;
  margin-top: 4px;
  z-index: 3;
  position: relative;
  transition: all 0.3s ease;
  white-space: nowrap;
}
.eva-status-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: #00d4ff;
  flex-shrink: 0;
  animation: sDot 2s ease-in-out infinite;
}
@keyframes sDot {
  0%,100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.35; transform: scale(0.65); }
}
.eva-status.talking   .eva-status-dot { background: #00ff88; animation: sDot 0.25s ease-in-out infinite; }
.eva-status.listening .eva-status-dot { background: #00ff88; animation: sDot 0.45s ease-in-out infinite; }
.eva-status.thinking  .eva-status-dot { background: #b794f6; animation: sDot 0.9s ease-in-out infinite; }
.eva-status.happy     .eva-status-dot { background: #ffd700; animation: sDot 0.5s ease-in-out infinite; }

.eva-scan-line {
  position: absolute;
  left: 16px; right: 16px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(0,212,255,0.5), transparent);
  animation: scanLine 5s ease-in-out infinite;
  z-index: 5;
  pointer-events: none;
}
@keyframes scanLine {
  0%   { bottom: 45px; opacity: 0; }
  8%   { opacity: 0.55; }
  92%  { opacity: 0.35; }
  100% { bottom: 95%; opacity: 0; }
}

.eva-hud-tl, .eva-hud-tr, .eva-hud-bl, .eva-hud-br {
  position: absolute;
  width: 14px; height: 14px;
  z-index: 6;
  pointer-events: none;
  opacity: 0.4;
}
.eva-hud-tl { top: 10px; left: 10px;  border-top: 1.5px solid #00d4ff; border-left:  1.5px solid #00d4ff; }
.eva-hud-tr { top: 10px; right: 10px; border-top: 1.5px solid #00d4ff; border-right: 1.5px solid #00d4ff; }
.eva-hud-bl { bottom: 50px; left: 10px;  border-bottom: 1.5px solid #00d4ff; border-left:  1.5px solid #00d4ff; }
.eva-hud-br { bottom: 50px; right: 10px; border-bottom: 1.5px solid #00d4ff; border-right: 1.5px solid #00d4ff; }

.eva-loading {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  z-index: 10;
  color: rgba(0,212,255,0.7);
  font-family: 'Space Mono', monospace;
  font-size: 0.62em;
  letter-spacing: 2px;
}
.eva-loading-ring {
  width: 36px; height: 36px;
  border: 2px solid rgba(0,212,255,0.15);
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
      <span>CHARGEMENT EVA...</span>
    </div>
  </div>
  <div class="eva-ground"></div>
  <div class="eva-status" id="evaStatusBar">
    <div class="eva-status-dot"></div>
    <span id="evaStatusTxt">EN LIGNE</span>
  </div>
</div>
  `;

  spawnParticles();
  initLive2D(container);

  document.addEventListener('mousemove', function(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });
}

function initLive2D(container) {
  if (typeof PIXI === 'undefined' || !PIXI.live2d) {
    console.warn('[EVA] Live2D or PIXI not loaded');
    showFallback();
    return;
  }

  var liveContainer = document.getElementById('live2dContainer');
  if (!liveContainer) return;

  var w = container.offsetWidth  || 265;
  var h = (container.offsetHeight || 500) - 36;

  pixiApp = new PIXI.Application({
    width: w,
    height: h,
    backgroundAlpha: 0,
    antialias: true,
    autoDensity: true,
    resolution: window.devicePixelRatio || 1
  });

  liveContainer.appendChild(pixiApp.view);

  console.log('[EVA] Loading Live2D model...');

  var loadTimeout = setTimeout(function() {
    if (!live2dModel) {
      console.warn('[EVA] Model load timeout — using fallback');
      showFallback();
    }
  }, 20000);

  PIXI.live2d.Live2DModel.from(MODEL_URL).then(function(mdl) {
    clearTimeout(loadTimeout);
    live2dModel = mdl;
    pixiApp.stage.addChild(live2dModel);

    var scale = Math.min(w / live2dModel.internalModel.originalWidth, h / live2dModel.internalModel.originalHeight) * 0.88;
    live2dModel.scale.set(scale);
    live2dModel.x = (w - live2dModel.width) / 2;
    live2dModel.y = (h - live2dModel.height) / 2 + h * 0.04;

    live2dModel.interactive = false;

    trackMouse = true;
    pixiApp.ticker.add(mouseLookTick);

    var loading = document.getElementById('evaLoading');
    if (loading) loading.style.display = 'none';

    console.log('[EVA] Live2D model ready!');
    playMotion('idle');
  }).catch(function(err) {
    clearTimeout(loadTimeout);
    console.error('[EVA] Live2D model load failed:', err);
    showFallback();
  });
}

function mouseLookTick() {
  if (!live2dModel || !trackMouse) return;
  var canvas = pixiApp.view;
  var rect = canvas.getBoundingClientRect();
  var cx = rect.left + rect.width / 2;
  var cy = rect.top  + rect.height / 2;
  var dx = (mouseX - cx) / (rect.width  / 2);
  var dy = (mouseY - cy) / (rect.height / 2);
  dx = Math.max(-1, Math.min(1, dx));
  dy = Math.max(-1, Math.min(1, dy));
  try {
    live2dModel.internalModel.coreModel.setParameterValueById('ParamAngleX', dx * 25);
    live2dModel.internalModel.coreModel.setParameterValueById('ParamAngleY', -dy * 20);
    live2dModel.internalModel.coreModel.setParameterValueById('ParamBodyAngleX', dx * 8);
    live2dModel.internalModel.coreModel.setParameterValueById('ParamEyeBallX', dx * 0.9);
    live2dModel.internalModel.coreModel.setParameterValueById('ParamEyeBallY', -dy * 0.9);
  } catch(e) {}
}

function playMotion(state) {
  if (!live2dModel) return;
  var m = MOTIONS[state] || MOTIONS.idle;
  try {
    live2dModel.motion(m.group, m.index, PIXI.live2d.MotionPriority.NORMAL);
  } catch(e) {
    try { live2dModel.motion('Idle', 0, PIXI.live2d.MotionPriority.NORMAL); } catch(_) {}
  }
}

function setStatus(state) {
  currentState = state;
  var bar = document.getElementById('evaStatusBar');
  var txt = document.getElementById('evaStatusTxt');
  if (bar) {
    bar.className = 'eva-status ' + (state !== 'idle' ? state : '');
  }
  if (txt) txt.textContent = STATUS_LABELS[state] || 'EN LIGNE';
}

function showFallback() {
  var loading = document.getElementById('evaLoading');
  if (loading) loading.innerHTML = '<span style="color:rgba(0,212,255,0.5);font-family:Space Mono,monospace;font-size:0.65em;letter-spacing:2px;">EVA ONLINE</span>';
}

function spawnParticles() {
  var c = document.getElementById('evaParticles');
  if (!c) return;
  for (var i = 0; i < 16; i++) {
    var el = document.createElement('div');
    el.className = 'eva-p';
    el.style.left   = (20 + Math.random() * 220) + 'px';
    el.style.bottom = (40 + Math.random() * 260) + 'px';
    el.style.width  = el.style.height = (1.2 + Math.random() * 2.6) + 'px';
    el.style.animationDuration = (4 + Math.random() * 5) + 's';
    el.style.animationDelay   = (Math.random() * 6) + 's';
    if (Math.random() > 0.7) el.style.background = '#b794f6';
    c.appendChild(el);
  }
}

window.EvaCharacter = {
  create: create,

  setIdle: function() {
    setStatus('idle');
    playMotion('idle');
  },

  setTalking: function() {
    setStatus('talking');
    playMotion('talking');
  },

  setListening: function() {
    setStatus('listening');
    playMotion('listening');
  },

  setThinking: function() {
    setStatus('thinking');
    playMotion('thinking');
  },

  setHappy: function() {
    setStatus('happy');
    playMotion('happy');
    setTimeout(function() {
      if (currentState === 'happy') window.EvaCharacter.setIdle();
    }, 3000);
  }
};

})();
