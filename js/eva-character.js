(function() {
'use strict';

/* ═══════════════════════════════════════════════════════════
   EVA CHARACTER — Three.js + three-vrm engine
   VRM model : /models/eva.vrm
   ═══════════════════════════════════════════════════════════ */

var MODEL_PATH = '/models/eva.vrm';

/* ─── ESM specifiers (resolved by importmap in chat.html) ── */
/* importmap maps 'three', 'three/examples/jsm/', '@pixiv/three-vrm' to CDN URLs */

/* ─── ENGINE STATE ───────────────────────────────────────── */
var renderer = null;
var scene    = null;
var camera   = null;
var vrm      = null;
var clock    = null;
var animReq  = null;
var state    = 'idle';

/* ─── ANIMATION STATE ────────────────────────────────────── */
var lipActive    = false;
var lipPhase     = 0;
var syllTimer    = 0;
var syllTarget   = 0;
var syllDur      = 6;
var mouthVal     = 0;

var blinkTimer    = 200;
var blinkProgress = 0;
var isBlinking    = false;

var idlePhase  = 0;
var talkPhase  = 0;
var thinkPhase = 0;
var listenPhase = 0;

/* ─── HEAD ROTATION (lerped) ─────────────────────────────── */
var hX = 0, hXt = 0;
var hY = 0, hYt = 0;
var hZ = 0, hZt = 0;
var LERP = 0.065;

function lerp(a, b, t) { return a + (b - a) * Math.min(t, 1); }

/* ─── VRM EXPRESSION ALIASES ─────────────────────────────── */
/* Three-vrm@2 converts VRM0 → VRM1 names automatically */
var EXPR_ALIASES = {
  blink: ['blink', 'Blink', 'blinkLeft', 'BlinkL', 'blink_l'],
  aa:    ['aa', 'A', 'a'],
  happy: ['happy', 'Joy', 'joy', 'smile'],
  sad:   ['sad', 'Sorrow', 'sorrow'],
  angry: ['angry', 'Angry'],
  surprised: ['surprised', 'Surprised']
};

/* ─── STATUS ─────────────────────────────────────────────── */
var STATUS = {
  idle:      'EN LIGNE',
  talking:   'PARLE...',
  listening: 'ÉCOUTE...',
  thinking:  'RÉFLÉCHIT...',
  happy:     'EN LIGNE'
};

/* ═══════════════════════════════════════════════════════════
   ENTRY POINT
   ═══════════════════════════════════════════════════════════ */
function create(containerId) {
  var wrap = document.getElementById(containerId);
  if (!wrap) return;
  wrap.innerHTML = buildHTML();
  spawnParticles();
  loadVRM().catch(function(e) {
    console.error('[EVA-VRM] Fatal:', e);
    showFallback();
  });
}

/* ═══════════════════════════════════════════════════════════
   VRM LOAD
   ═══════════════════════════════════════════════════════════ */
async function loadVRM() {
  var container = document.getElementById('vrmContainer');
  if (!container) return;

  /* Dynamic ESM imports — bare specifiers resolved by local importmap in chat.html.
     All files served from /js/lib/ (no CDN cold-start). */
  var THREE, GLTFLoader, VRMLoaderPlugin, VRMUtils;
  try {
    var [mod3, modGLTF, modVRM] = await Promise.all([
      import('three'),
      import('three/examples/jsm/loaders/GLTFLoader.js'),
      import('@pixiv/three-vrm')
    ]);
    THREE           = mod3;
    GLTFLoader      = modGLTF.GLTFLoader;
    VRMLoaderPlugin = modVRM.VRMLoaderPlugin;
    VRMUtils        = modVRM.VRMUtils;
  } catch(e) {
    console.error('[EVA-VRM] Import failed:', e);
    showFallback();
    return;
  }

  var W = container.offsetWidth  || 270;
  var H = container.offsetHeight || 460;

  /* Clock */
  clock = new THREE.Clock();

  /* Renderer — transparent background */
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  } catch(e) { showFallback(); return; }

  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = false;

  /* Canvas positioning */
  Object.assign(renderer.domElement.style, {
    position: 'absolute',
    bottom: '0',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: '1'
  });
  container.appendChild(renderer.domElement);

  /* Scene */
  scene = new THREE.Scene();

  /* Camera — full body framing with breathing room */
  camera = new THREE.PerspectiveCamera(35, W / H, 0.1, 20);
  camera.position.set(0, 0.9, 3.8);
  camera.lookAt(new THREE.Vector3(0, 0.75, 0));

  /* Lighting */
  var ambLight = new THREE.AmbientLight(0xffffff, 1.1);
  scene.add(ambLight);

  var keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
  keyLight.position.set(0.8, 2, 1.5);
  scene.add(keyLight);

  var fillLight = new THREE.DirectionalLight(0xc0d8ff, 0.5);
  fillLight.position.set(-1.2, 1, 0.8);
  scene.add(fillLight);

  /* Cyan rim light for EVA aesthetic */
  var rimLight = new THREE.PointLight(0x00d4ff, 1.4, 4);
  rimLight.position.set(-1, 1.6, -0.6);
  scene.add(rimLight);

  var rimLight2 = new THREE.PointLight(0x8b5cf6, 0.6, 3);
  rimLight2.position.set(1, 0.8, -0.5);
  scene.add(rimLight2);

  /* Load VRM */
  var loader = new GLTFLoader();
  loader.register(function(parser) { return new VRMLoaderPlugin(parser); });

  var loadingEl = document.getElementById('evaLoading');
  var loadingSpan = loadingEl ? loadingEl.querySelector('span') : null;

  loader.load(
    MODEL_PATH,
    function(gltf) {
      vrm = gltf.userData.vrm;
      if (!vrm) {
        console.error('[EVA-VRM] gltf.userData.vrm is null — not a valid VRM');
        showFallback();
        return;
      }

      /* Optional optimizations */
      try { VRMUtils.removeUnnecessaryVertices(gltf.scene); } catch(e) {}
      try { VRMUtils.combineSkeletons(gltf.scene); }          catch(e) {}

      /* VRM0 models need 180° Y rotation to face the camera */
      try {
        var meta = vrm.meta;
        var isVRM0 = meta && (meta.metaVersion === '0' || !meta.metaVersion);
        if (isVRM0) {
          vrm.scene.rotation.y = Math.PI;
        }
      } catch(e) {}

      scene.add(vrm.scene);

      /* Log available expressions for debugging */
      if (vrm.expressionManager) {
        var exprMap  = vrm.expressionManager.expressionMap || {};
        console.log('[EVA-VRM] Expressions:', Object.keys(exprMap).join(', ') || '(aucune)');
      }
      if (vrm.humanoid) {
        console.log('[EVA-VRM] Humanoid bones OK');
      }
      console.log('[EVA-VRM] VRM version:', (vrm.meta && vrm.meta.metaVersion) || 'unknown');

      if (loadingEl) loadingEl.style.display = 'none';

      startRenderLoop(THREE);
      setStatus('idle');
    },
    function(xhr) {
      if (loadingSpan && xhr.total) {
        var pct = Math.round(xhr.loaded / xhr.total * 100);
        loadingSpan.textContent = 'CHARGEMENT ' + pct + ' %';
      }
    },
    function(err) {
      console.error('[EVA-VRM] Load error:', err);
      showFallback();
    }
  );

  /* Resize handler */
  window.addEventListener('resize', function() {
    if (!renderer || !camera || !container) return;
    var nW = container.offsetWidth;
    var nH = container.offsetHeight;
    if (!nW || !nH) return;
    renderer.setSize(nW, nH);
    camera.aspect = nW / nH;
    camera.updateProjectionMatrix();
  });
}

/* ═══════════════════════════════════════════════════════════
   EXPRESSION HELPER
   ═══════════════════════════════════════════════════════════ */
function setExpr(name, value) {
  if (!vrm || !vrm.expressionManager) return;
  var mgr  = vrm.expressionManager;
  var map  = mgr.expressionMap || {};
  var aliases = EXPR_ALIASES[name] || [name];
  for (var i = 0; i < aliases.length; i++) {
    var n = aliases[i];
    if (map[n] !== undefined) {
      try { mgr.setValue(n, value); } catch(e) {}
      return;
    }
    /* Also try lowercase */
    var nl = n.toLowerCase();
    if (map[nl] !== undefined) {
      try { mgr.setValue(nl, value); } catch(e) {}
      return;
    }
  }
  /* Last resort — try all silently */
  for (var i = 0; i < aliases.length; i++) {
    try { mgr.setValue(aliases[i], value); } catch(e) {}
  }
}

/* ═══════════════════════════════════════════════════════════
   BONE HELPER
   ═══════════════════════════════════════════════════════════ */
function getBone(name) {
  if (!vrm || !vrm.humanoid) return null;
  try { return vrm.humanoid.getNormalizedBoneNode(name); } catch(e) { return null; }
}

/* ═══════════════════════════════════════════════════════════
   RENDER LOOP
   ═══════════════════════════════════════════════════════════ */
function startRenderLoop(THREE) {
  function tick() {
    animReq = requestAnimationFrame(tick);
    var dt  = Math.min(clock.getDelta(), 0.05); /* Cap to prevent big jumps */
    tickAnimation(dt);
    vrm.update(dt);
    renderer.render(scene, camera);
  }
  tick();
}

/* ═══════════════════════════════════════════════════════════
   ANIMATION TICK  (dt in seconds)
   ═══════════════════════════════════════════════════════════ */
function tickAnimation(dt) {
  if (!vrm) return;
  var u = dt * 60; /* Normalized to 60fps units */

  /* ── 1. BLINK ───────────────────────────────────────────── */
  blinkTimer -= u;
  if (!isBlinking && blinkTimer <= 0) {
    isBlinking    = true;
    blinkProgress = 0;
    blinkTimer    = 160 + Math.random() * 260;
  }
  if (isBlinking) {
    blinkProgress += u;
    var eyeOpen;
    if      (blinkProgress <= 4)  eyeOpen = 1 - blinkProgress / 4;
    else if (blinkProgress <= 7)  eyeOpen = 0;
    else if (blinkProgress <= 13) eyeOpen = (blinkProgress - 7) / 6;
    else { isBlinking = false; blinkProgress = 0; eyeOpen = 1; }
    setExpr('blink', Math.max(0, 1 - eyeOpen));
  }

  /* ── 2. LIP SYNC ────────────────────────────────────────── */
  if (lipActive) {
    syllTimer -= u;
    if (syllTimer <= 0) {
      var r = Math.random();
      if      (r < 0.22) { syllTarget = Math.random() * 0.10;           syllDur = 3  + Math.floor(Math.random() * 4);  }
      else if (r < 0.52) { syllTarget = 0.28 + Math.random() * 0.32;   syllDur = 5  + Math.floor(Math.random() * 7);  }
      else if (r < 0.82) { syllTarget = 0.62 + Math.random() * 0.33;   syllDur = 6  + Math.floor(Math.random() * 9);  }
      else               { syllTarget = 0;                              syllDur = 10 + Math.floor(Math.random() * 12); }
      syllTimer = syllDur;
    }
    mouthVal += (syllTarget - mouthVal) * Math.min(0.40 * u * 0.5, 1);
  } else {
    mouthVal += (0 - mouthVal) * Math.min(0.35 * u * 0.5, 1);
  }
  setExpr('aa', Math.max(0, Math.min(1, mouthVal)));

  /* ── 3. HEAD / NECK — STATE SPECIFIC ───────────────────── */
  var head  = getBone('head');
  var neck  = getBone('neck');
  var spine = getBone('upperChest') || getBone('chest') || getBone('spine');

  var lerpF = Math.min(LERP * u, 1);

  if (state === 'idle') {
    idlePhase += dt * 0.38;
    hXt = Math.sin(idlePhase * 0.70) * 0.030;
    hYt = Math.sin(idlePhase * 0.50) * 0.035;
    hZt = Math.sin(idlePhase * 0.35) * 0.020;

    hX = lerp(hX, hXt, lerpF);
    hY = lerp(hY, hYt, lerpF);
    hZ = lerp(hZ, hZt, lerpF);
    if (head)  { head.rotation.x = hX; head.rotation.y = hY; head.rotation.z = hZ; }
    if (neck)  { neck.rotation.x = hX * 0.30; neck.rotation.y = hY * 0.30; }
    if (spine) { spine.rotation.x = Math.sin(idlePhase * 0.28) * 0.008; }

  } else if (state === 'talking') {
    talkPhase += dt * 0.90;
    hXt = -0.015 + Math.sin(talkPhase * 0.88) * 0.055;
    hYt =          Math.sin(talkPhase * 0.58) * 0.065;
    hZt =          Math.sin(talkPhase * 0.44) * 0.038;

    hX = lerp(hX, hXt, lerpF);
    hY = lerp(hY, hYt, lerpF);
    hZ = lerp(hZ, hZt, lerpF);
    if (head) { head.rotation.x = hX; head.rotation.y = hY; head.rotation.z = hZ; }
    if (neck) { neck.rotation.x = hX * 0.40; neck.rotation.y = hY * 0.40; }

  } else if (state === 'thinking') {
    thinkPhase += dt * 0.42;
    hXt = -0.11 + Math.sin(thinkPhase * 0.68) * 0.038;
    hYt =  0.09 + Math.sin(thinkPhase * 0.48) * 0.030;
    hZt =  0.07 + Math.sin(thinkPhase * 0.38) * 0.022;

    hX = lerp(hX, hXt, lerpF);
    hY = lerp(hY, hYt, lerpF);
    hZ = lerp(hZ, hZt, lerpF);
    if (head) { head.rotation.x = hX; head.rotation.y = hY; head.rotation.z = hZ; }
    if (neck) { neck.rotation.x = hX * 0.38; neck.rotation.y = hY * 0.30; }

  } else if (state === 'listening') {
    listenPhase += dt * 0.25;
    hX = lerp(hX, hXt + Math.sin(listenPhase * 0.5) * 0.008, lerpF);
    hY = lerp(hY, hYt, lerpF);
    hZ = lerp(hZ, hZt, lerpF);
    if (head) { head.rotation.x = hX; head.rotation.y = hY; head.rotation.z = hZ; }
    if (neck) { neck.rotation.x = hX * 0.30; }

  } else { /* happy */
    idlePhase += dt * 0.55;
    hXt =  Math.sin(idlePhase * 0.80) * 0.040;
    hYt =  Math.sin(idlePhase * 0.60) * 0.050;
    hZt = -0.015 + Math.sin(idlePhase * 0.40) * 0.025;
    hX = lerp(hX, hXt, lerpF);
    hY = lerp(hY, hYt, lerpF);
    hZ = lerp(hZ, hZt, lerpF);
    if (head) { head.rotation.x = hX; head.rotation.y = hY; head.rotation.z = hZ; }
    if (neck) { neck.rotation.x = hX * 0.30; neck.rotation.y = hY * 0.30; }
  }
}

/* ═══════════════════════════════════════════════════════════
   STATUS BAR
   ═══════════════════════════════════════════════════════════ */
function setStatus(s) {
  state = s;
  var bar = document.getElementById('evaStatusBar');
  var txt = document.getElementById('evaStatusTxt');
  if (bar) bar.className = 'eva-status' + (['talking','listening','thinking'].includes(s) ? ' ' + s : '');
  if (txt) txt.textContent = STATUS[s] || 'EN LIGNE';
}

/* ═══════════════════════════════════════════════════════════
   FALLBACK
   ═══════════════════════════════════════════════════════════ */
function showFallback() {
  var el = document.getElementById('evaLoading');
  if (el) el.innerHTML = '<span style="color:rgba(0,212,255,0.4);font-family:monospace;font-size:0.7em;letter-spacing:2px;text-align:center;">EVA<br>ONLINE</span>';
}

/* ═══════════════════════════════════════════════════════════
   PARTICLES
   ═══════════════════════════════════════════════════════════ */
function spawnParticles() {
  var c = document.getElementById('evaParticles');
  if (!c) return;
  for (var i = 0; i < 16; i++) {
    var p = document.createElement('div');
    p.className = 'eva-p';
    p.style.cssText = [
      'left:'               + (8  + Math.random() * 240) + 'px',
      'bottom:'             + (35 + Math.random() * 300) + 'px',
      'width:'              + (1  + Math.random() * 2.5)  + 'px',
      'height:'             + (1  + Math.random() * 2.5)  + 'px',
      'animation-duration:' + (5  + Math.random() * 6)    + 's',
      'animation-delay:'    + (Math.random() * 8)          + 's',
      'background:'         + (Math.random() > 0.6 ? '#b794f6' : '#00d4ff')
    ].join(';');
    c.appendChild(p);
  }
}

/* ═══════════════════════════════════════════════════════════
   HTML TEMPLATE
   ═══════════════════════════════════════════════════════════ */
function buildHTML() {
  return `
<style>
#evaWrap{position:relative;width:100%;height:100%;overflow:hidden;}

#vrmContainer{
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
  <div id="vrmContainer">
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

/* ═══════════════════════════════════════════════════════════
   PUBLIC API  (same interface as Live2D version)
   ═══════════════════════════════════════════════════════════ */
window.EvaCharacter = {

  create: create,

  setIdle: function() {
    lipActive = false;
    mouthVal  = 0;
    idlePhase = 0;
    setStatus('idle');
    setExpr('happy', 0);
  },

  startTalking: function() { window.EvaCharacter.setTalking(); },

  setTalking: function() {
    lipActive    = true;
    syllTimer    = 0;
    syllTarget   = 0;
    mouthVal     = 0;
    talkPhase    = 0;
    setStatus('talking');
    setExpr('happy', 0);
  },

  stopTalking: function() {
    lipActive = false;
    mouthVal  = 0;
    idlePhase = 0;
    setStatus('idle');
  },

  setListening: function() {
    lipActive    = false;
    listenPhase  = 0;
    setStatus('listening');
    /* Slight attentive head turn */
    hXt =  0.035;
    hYt = -0.05;
    hZt = -0.025;
    setExpr('happy', 0);
  },

  setThinking: function() {
    lipActive  = false;
    thinkPhase = 0;
    setStatus('thinking');
    setExpr('happy', 0);
  },

  setHappy: function() {
    lipActive = false;
    mouthVal  = 0;
    idlePhase = 0;
    setStatus('happy');
    setExpr('happy', 1.0);
    setTimeout(function() {
      setExpr('happy', 0);
      if (state === 'happy') {
        setStatus('idle');
        idlePhase = 0;
      }
    }, 4000);
  }
};

})();
