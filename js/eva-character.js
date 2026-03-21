(function() {
'use strict';

/* ═══════════════════════════════════════════════════════════
   EVA CHARACTER — Three.js + three-vrm  (VRM 0/1)
   Model: /models/eva.vrm  (~1.85 m tall)
   Libs:  /js/lib/  (served locally, cached immutably)
   ═══════════════════════════════════════════════════════════ */

var MODEL_PATH = '/models/eva.vrm';

/* ─── ENGINE ─────────────────────────────────────────────── */
var renderer, scene, camera, clock, vrm, animReq;

/* ─── RUNTIME STATE ──────────────────────────────────────── */
var state     = 'idle';   /* idle | talking | listening | thinking | happy */
var lipActive = false;
var time      = 0;        /* accumulated seconds */

/* ─── LIP SYNC ───────────────────────────────────────────── */
var mouthVal    = 0;
var syllTarget  = 0;
var syllTimer   = 0;

/* ─── BLINK ──────────────────────────────────────────────── */
var blinkT      = 3 + Math.random() * 2;  /* seconds until next blink */
var blinkVal    = 0;
var blinking    = false;
var blinkElap   = 0;

/* ─── STATUS TEXT ────────────────────────────────────────── */
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
  loadVRM();
}

/* ═══════════════════════════════════════════════════════════
   LOAD
   ═══════════════════════════════════════════════════════════ */
async function loadVRM() {
  var container = document.getElementById('vrmContainer');
  if (!container) return;

  /* ── Import Three.js libs from local /js/lib/ ── */
  var THREE, GLTFLoader, VRMLoaderPlugin, VRMUtils;
  try {
    var [m3, mG, mV] = await Promise.all([
      import('three'),
      import('three/examples/jsm/loaders/GLTFLoader.js'),
      import('@pixiv/three-vrm')
    ]);
    THREE           = m3;
    GLTFLoader      = mG.GLTFLoader;
    VRMLoaderPlugin = mV.VRMLoaderPlugin;
    VRMUtils        = mV.VRMUtils;
  } catch (e) {
    console.error('[EVA] Import error:', e);
    fallback(); return;
  }

  var W = container.offsetWidth  || 300;
  var H = container.offsetHeight || 520;

  /* ── Renderer ── */
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  } catch(e) { fallback(); return; }

  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(W, H);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  Object.assign(renderer.domElement.style, {
    position: 'absolute', bottom: '0', left: '50%',
    transform: 'translateX(-50%)', zIndex: '1'
  });
  container.appendChild(renderer.domElement);

  /* ── Scene & camera ──
     EVA is ~1.85 m.  Show from feet (Y=0) to above head (Y>1.85).
     Camera at Z=3.6, eye-level Y=0.9, looking at mid-body.          */
  scene  = new THREE.Scene();
  clock  = new THREE.Clock();

  camera = new THREE.PerspectiveCamera(30, W / H, 0.1, 20);
  camera.position.set(0, 0.9, 3.6);
  camera.lookAt(0, 0.75, 0);

  /* ── Lighting ── */
  scene.add(new THREE.AmbientLight(0xffffff, 1.2));
  var key = new THREE.DirectionalLight(0xffffff, 1.3);
  key.position.set(1, 2, 2);
  scene.add(key);
  var fill = new THREE.DirectionalLight(0xc0e0ff, 0.5);
  fill.position.set(-1.5, 1, 1);
  scene.add(fill);
  var rim = new THREE.PointLight(0x00d4ff, 1.6, 5);
  rim.position.set(-1, 1.8, -0.8);
  scene.add(rim);
  var rim2 = new THREE.PointLight(0x8b5cf6, 0.7, 3);
  rim2.position.set(1, 1, -0.5);
  scene.add(rim2);

  /* ── Resize handler ── */
  window.addEventListener('resize', function() {
    if (!renderer || !container) return;
    var nW = container.offsetWidth, nH = container.offsetHeight;
    if (!nW || !nH) return;
    renderer.setSize(nW, nH);
    camera.aspect = nW / nH;
    camera.updateProjectionMatrix();
  });

  /* ── Load VRM ── */
  var loadEl   = document.getElementById('evaLoading');
  var loadSpan = loadEl && loadEl.querySelector('span');

  var loader = new GLTFLoader();
  loader.register(p => new VRMLoaderPlugin(p));

  loader.load(MODEL_PATH,
    function onLoad(gltf) {
      vrm = gltf.userData.vrm;
      if (!vrm) { console.error('[EVA] No VRM in userData'); fallback(); return; }

      /* Optimise mesh */
      try { VRMUtils.removeUnnecessaryVertices(gltf.scene); } catch(_) {}
      try { VRMUtils.combineSkeletons(gltf.scene); }          catch(_) {}

      /* VRM0 models face -Z by default; rotate 180° to face camera */
      try {
        var v = vrm.meta && (vrm.meta.metaVersion || vrm.meta.specVersion || '0');
        if (String(v).charAt(0) === '0' || v === '0') {
          vrm.scene.rotation.y = Math.PI;
        }
      } catch(_) {}

      scene.add(vrm.scene);

      /* ── Debug: print what we have ── */
      var version = vrm.meta && (vrm.meta.metaVersion || vrm.meta.specVersion || '?');
      console.log('[EVA] VRM version:', version);

      if (vrm.expressionManager) {
        var exprs = Object.keys(vrm.expressionManager.expressionMap || {});
        console.log('[EVA] Expressions:', exprs.join(', ') || 'none');
      }

      var boneTest = ['head','neck','chest','upperChest','spine','hips',
                      'leftUpperArm','rightUpperArm','leftLowerArm','rightLowerArm'];
      var foundBones = boneTest.filter(function(b) {
        try { return !!vrm.humanoid.getNormalizedBoneNode(b); } catch(_) { return false; }
      });
      console.log('[EVA] Bones:', foundBones.join(', ') || 'NONE');

      /* ── Initial A-pose ── */
      applyAPose();

      if (loadEl) loadEl.style.display = 'none';
      setStatus('idle');
      startLoop(THREE);
    },
    function onProgress(xhr) {
      if (loadSpan && xhr.total)
        loadSpan.textContent = 'CHARGEMENT ' + Math.round(xhr.loaded / xhr.total * 100) + ' %';
    },
    function onError(err) {
      console.error('[EVA] Load failed:', err);
      fallback();
    }
  );
}

/* ═══════════════════════════════════════════════════════════
   A-POSE  (lower arms from VRM0 T-pose)
   ═══════════════════════════════════════════════════════════ */
function applyAPose() {
  if (!vrm || !vrm.humanoid) return;
  var g = function(name) {
    try { return vrm.humanoid.getNormalizedBoneNode(name); } catch(_) { return null; }
  };
  var lUA = g('leftUpperArm'),  rUA = g('rightUpperArm');
  var lLA = g('leftLowerArm'),  rLA = g('rightLowerArm');
  /* Lower arms ~65° inward from T-pose horizontal */
  if (lUA) { lUA.rotation.x = 0; lUA.rotation.z =  1.15; lUA.rotation.y = 0; }
  if (rUA) { rUA.rotation.x = 0; rUA.rotation.z = -1.15; rUA.rotation.y = 0; }
  if (lLA) { lLA.rotation.z =  0.1; }
  if (rLA) { rLA.rotation.z = -0.1; }
  vrm.update(0);
}

/* ═══════════════════════════════════════════════════════════
   BONE HELPER
   ═══════════════════════════════════════════════════════════ */
function bone(name) {
  if (!vrm || !vrm.humanoid) return null;
  try { return vrm.humanoid.getNormalizedBoneNode(name); } catch(_) { return null; }
}

/* ═══════════════════════════════════════════════════════════
   EXPRESSION HELPER
   ═══════════════════════════════════════════════════════════ */
/* VRM0 preset names → VRM1 equivalents tried in order */
var EXPR = {
  blink:     ['blink', 'Blink', 'blinkLeft', 'BlinkL'],
  mouth:     ['aa',    'A',     'a',          'Aa'],
  happy:     ['happy', 'Joy',   'joy'],
  sad:       ['sad',   'Sorrow','sorrow'],
  angry:     ['angry', 'Angry'],
  surprised: ['surprised', 'Surprised']
};
function setExpr(key, val) {
  if (!vrm || !vrm.expressionManager) return;
  var mgr = vrm.expressionManager;
  var map = mgr.expressionMap || {};
  var names = EXPR[key] || [key];
  for (var i = 0; i < names.length; i++) {
    var n = names[i];
    if (map[n] !== undefined || map[n.toLowerCase()] !== undefined) {
      try { mgr.setValue(n, val); return; } catch(_) {}
      try { mgr.setValue(n.toLowerCase(), val); return; } catch(_) {}
    }
  }
  /* Last resort: try all silently */
  names.forEach(function(n) { try { mgr.setValue(n, val); } catch(_) {} });
}

/* ═══════════════════════════════════════════════════════════
   RENDER LOOP
   ═══════════════════════════════════════════════════════════ */
function startLoop(THREE) {
  function tick() {
    animReq = requestAnimationFrame(tick);
    var dt  = Math.min(clock.getDelta(), 0.05);
    time   += dt;
    animate(dt);
    vrm.update(dt);
    renderer.render(scene, camera);
  }
  tick();
}

/* ═══════════════════════════════════════════════════════════
   ANIMATION  — dt in seconds
   ═══════════════════════════════════════════════════════════ */
function animate(dt) {
  if (!vrm) return;

  /* ── BLINK ──────────────────────────────────────────────── */
  if (!blinking) {
    blinkT -= dt;
    if (blinkT <= 0) {
      blinking = true;
      blinkElap = 0;
      blinkT = 2.5 + Math.random() * 2.5;
    }
  } else {
    blinkElap += dt;
    /* 0→0.07s: close, 0.07→0.15s: hold, 0.15→0.30s: open */
    if      (blinkElap < 0.07) blinkVal = blinkElap / 0.07;
    else if (blinkElap < 0.15) blinkVal = 1;
    else if (blinkElap < 0.30) blinkVal = 1 - (blinkElap - 0.15) / 0.15;
    else { blinkVal = 0; blinking = false; }
    setExpr('blink', blinkVal);
  }

  /* ── LIP SYNC ───────────────────────────────────────────── */
  if (lipActive) {
    syllTimer -= dt;
    if (syllTimer <= 0) {
      var r = Math.random();
      if      (r < 0.20) { syllTarget = 0.05 + Math.random() * 0.10; syllTimer = 0.05 + Math.random() * 0.05; }
      else if (r < 0.55) { syllTarget = 0.30 + Math.random() * 0.35; syllTimer = 0.07 + Math.random() * 0.08; }
      else if (r < 0.85) { syllTarget = 0.65 + Math.random() * 0.30; syllTimer = 0.08 + Math.random() * 0.10; }
      else               { syllTarget = 0;                            syllTimer = 0.12 + Math.random() * 0.15; }
    }
    mouthVal += (syllTarget - mouthVal) * Math.min(dt * 20, 1);
  } else {
    mouthVal += (0 - mouthVal) * Math.min(dt * 15, 1);
  }
  setExpr('mouth', Math.max(0, Math.min(1, mouthVal)));

  /* ── HEAD / BODY BONES ──────────────────────────────────── */
  var hd   = bone('head');
  var nk   = bone('neck');
  var sp   = bone('upperChest') || bone('chest') || bone('spine');
  var lUA  = bone('leftUpperArm');
  var rUA  = bone('rightUpperArm');

  /* Arm base (A-pose) maintained every frame */
  var aL =  1.15, aR = -1.15;

  if (state === 'idle') {
    var s = time;
    var hx = Math.sin(s * 0.43) * 0.08;
    var hy = Math.sin(s * 0.61) * 0.10;
    var hz = Math.sin(s * 0.29) * 0.05;
    if (hd) { hd.rotation.x = hx; hd.rotation.y = hy; hd.rotation.z = hz; }
    if (nk) { nk.rotation.x = hx * 0.4; nk.rotation.y = hy * 0.4; }
    if (sp) { sp.rotation.z = Math.sin(s * 0.22) * 0.025; }
    if (lUA) lUA.rotation.z = aL + Math.sin(s * 0.38) * 0.04;
    if (rUA) rUA.rotation.z = aR - Math.sin(s * 0.38) * 0.04;

  } else if (state === 'talking') {
    var s = time;
    var hx = -0.04 + Math.sin(s * 1.10) * 0.12;
    var hy =         Math.sin(s * 0.75) * 0.15;
    var hz =         Math.sin(s * 0.55) * 0.07;
    if (hd) { hd.rotation.x = hx; hd.rotation.y = hy; hd.rotation.z = hz; }
    if (nk) { nk.rotation.x = hx * 0.45; nk.rotation.y = hy * 0.40; }
    if (sp) { sp.rotation.z = Math.sin(s * 0.65) * 0.03; }
    if (lUA) lUA.rotation.z = aL + Math.sin(s * 0.80) * 0.07;
    if (rUA) rUA.rotation.z = aR - Math.sin(s * 0.70) * 0.07;

  } else if (state === 'thinking') {
    var s = time;
    var hx = -0.14 + Math.sin(s * 0.55) * 0.05;
    var hy =  0.12 + Math.sin(s * 0.40) * 0.04;
    var hz =  0.09;
    if (hd) { hd.rotation.x = hx; hd.rotation.y = hy; hd.rotation.z = hz; }
    if (nk) { nk.rotation.x = hx * 0.4; nk.rotation.y = hy * 0.35; }
    if (lUA) lUA.rotation.z = aL;
    if (rUA) rUA.rotation.z = aR;

  } else if (state === 'listening') {
    var s = time;
    var hx = -0.05 + Math.sin(s * 0.40) * 0.03;
    var hy =         Math.sin(s * 0.30) * 0.05;
    if (hd) { hd.rotation.x = hx; hd.rotation.y = hy; hd.rotation.z = 0; }
    if (nk) { nk.rotation.x = hx * 0.35; nk.rotation.y = hy * 0.30; }
    if (lUA) lUA.rotation.z = aL;
    if (rUA) rUA.rotation.z = aR;

  } else { /* happy */
    var s = time;
    var hx =  Math.sin(s * 0.90) * 0.10;
    var hy =  Math.sin(s * 0.70) * 0.14;
    var hz = -0.02 + Math.sin(s * 0.50) * 0.06;
    if (hd) { hd.rotation.x = hx; hd.rotation.y = hy; hd.rotation.z = hz; }
    if (nk) { nk.rotation.x = hx * 0.40; nk.rotation.y = hy * 0.35; }
    if (lUA) lUA.rotation.z = aL + Math.sin(s * 0.85) * 0.09;
    if (rUA) rUA.rotation.z = aR - Math.sin(s * 0.85) * 0.09;
  }
}

/* ═══════════════════════════════════════════════════════════
   STATUS BAR
   ═══════════════════════════════════════════════════════════ */
function setStatus(s) {
  state = s;
  var bar = document.getElementById('evaStatusBar');
  var txt = document.getElementById('evaStatusTxt');
  var cls = 'eva-status' + (s === 'talking' || s === 'listening' ? ' ' + s
                           : s === 'thinking' ? ' thinking' : '');
  if (bar) bar.className = cls;
  if (txt) txt.textContent = STATUS[s] || 'EN LIGNE';
}

/* ═══════════════════════════════════════════════════════════
   FALLBACK
   ═══════════════════════════════════════════════════════════ */
function fallback() {
  var el = document.getElementById('evaLoading');
  if (el) el.innerHTML = '<span style="color:rgba(0,212,255,0.5);font-family:monospace;font-size:0.65em;letter-spacing:3px">EVA<br>ONLINE</span>';
}

/* ═══════════════════════════════════════════════════════════
   PARTICLES
   ═══════════════════════════════════════════════════════════ */
function spawnParticles() {
  var c = document.getElementById('evaParticles');
  if (!c) return;
  for (var i = 0; i < 14; i++) {
    var p = document.createElement('div');
    p.className = 'eva-p';
    p.style.cssText = [
      'left:'                + (6 + Math.random() * 88) + '%',
      'bottom:'              + (10 + Math.random() * 60) + '%',
      'width:'               + (1 + Math.random() * 2)   + 'px',
      'height:'              + (1 + Math.random() * 2)   + 'px',
      'animation-duration:'  + (5 + Math.random() * 7)   + 's',
      'animation-delay:'     + (Math.random() * 10)       + 's',
      'background:'          + (Math.random() > 0.55 ? '#b794f6' : '#00d4ff')
    ].join(';');
    c.appendChild(p);
  }
}

/* ═══════════════════════════════════════════════════════════
   HTML TEMPLATE
   ═══════════════════════════════════════════════════════════ */
function buildHTML() {
  return `<style>
#evaWrap{position:relative;width:100%;height:100%;overflow:hidden;}
#vrmContainer{position:absolute;inset:0 0 32px;overflow:hidden;}
.eva-bg-glow{
  position:absolute;bottom:32px;left:50%;transform:translateX(-50%);
  width:80%;height:80px;border-radius:50%;z-index:0;pointer-events:none;
  background:radial-gradient(ellipse,rgba(0,212,255,0.12) 0%,transparent 70%);
  animation:glowA 4s ease-in-out infinite;
}
@keyframes glowA{0%,100%{opacity:.5;transform:translateX(-50%) scaleX(1);}50%{opacity:1;transform:translateX(-50%) scaleX(1.3);}}
.eva-particles{position:absolute;inset:0;pointer-events:none;z-index:0;overflow:hidden;}
.eva-p{position:absolute;border-radius:50%;animation:pF linear infinite;opacity:0;}
@keyframes pF{0%{opacity:0;transform:translateY(0) scale(0);}8%{opacity:.6;}90%{opacity:.2;}100%{opacity:0;transform:translateY(-120px) scale(2);}}
.eva-scan{position:absolute;left:0;right:0;height:1px;z-index:5;pointer-events:none;
  background:linear-gradient(90deg,transparent,rgba(0,212,255,.35),transparent);
  animation:scan 8s ease-in-out infinite;}
@keyframes scan{0%{bottom:35px;opacity:0;}6%{opacity:.45;}94%{opacity:.15;}100%{bottom:100%;opacity:0;}}
.eva-c{position:absolute;width:10px;height:10px;z-index:6;pointer-events:none;opacity:.3;}
.eva-c.tl{top:8px;left:8px;border-top:1.5px solid #00d4ff;border-left:1.5px solid #00d4ff;}
.eva-c.tr{top:8px;right:8px;border-top:1.5px solid #00d4ff;border-right:1.5px solid #00d4ff;}
.eva-c.bl{bottom:36px;left:8px;border-bottom:1.5px solid #00d4ff;border-left:1.5px solid #00d4ff;}
.eva-c.br{bottom:36px;right:8px;border-bottom:1.5px solid #00d4ff;border-right:1.5px solid #00d4ff;}
.eva-status{
  position:absolute;bottom:0;left:0;right:0;height:32px;
  display:flex;align-items:center;justify-content:center;gap:7px;
  font-family:'Space Mono',monospace;font-size:.58em;letter-spacing:1.5px;
  text-transform:uppercase;color:rgba(0,212,255,.85);z-index:10;transition:color .4s;
}
.eva-dot{width:5px;height:5px;border-radius:50%;background:#00d4ff;flex-shrink:0;animation:dot 2s ease-in-out infinite;}
@keyframes dot{0%,100%{opacity:1;transform:scale(1);}50%{opacity:.25;transform:scale(.5);}}
.eva-status.talking .eva-dot,.eva-status.listening .eva-dot{background:#00ff88;animation:dot .2s ease-in-out infinite;}
.eva-status.thinking .eva-dot{background:#b794f6;animation:dot .8s ease-in-out infinite;}
.eva-status.talking{color:rgba(0,255,136,.9);}
.eva-status.listening{color:rgba(0,255,136,.9);}
.eva-status.thinking{color:rgba(183,148,246,.9);}
.eva-loading{
  position:absolute;top:45%;left:50%;transform:translate(-50%,-50%);
  display:flex;flex-direction:column;align-items:center;gap:10px;
  z-index:10;color:rgba(0,212,255,.6);
  font-family:'Space Mono',monospace;font-size:.58em;letter-spacing:2px;text-align:center;
}
.eva-ring{width:26px;height:26px;border:2px solid rgba(0,212,255,.12);border-top-color:#00d4ff;border-radius:50%;animation:spin .9s linear infinite;}
@keyframes spin{to{transform:rotate(360deg);}}
</style>
<div id="evaWrap">
  <div class="eva-c tl"></div><div class="eva-c tr"></div>
  <div class="eva-c bl"></div><div class="eva-c br"></div>
  <div class="eva-scan"></div>
  <div class="eva-particles" id="evaParticles"></div>
  <div class="eva-bg-glow"></div>
  <div id="vrmContainer">
    <div class="eva-loading" id="evaLoading">
      <div class="eva-ring"></div>
      <span>CHARGEMENT...</span>
    </div>
  </div>
  <div class="eva-status" id="evaStatusBar">
    <div class="eva-dot"></div>
    <span id="evaStatusTxt">EN LIGNE</span>
  </div>
</div>`;
}

/* ═══════════════════════════════════════════════════════════
   PUBLIC API
   ═══════════════════════════════════════════════════════════ */
window.EvaCharacter = {
  create: create,

  setIdle: function() {
    lipActive = false; mouthVal = 0;
    setStatus('idle');
    setExpr('happy', 0);
  },

  startTalking: function() { window.EvaCharacter.setTalking(); },

  setTalking: function() {
    lipActive = true; syllTimer = 0; syllTarget = 0; mouthVal = 0;
    setStatus('talking');
    setExpr('happy', 0);
  },

  stopTalking: function() {
    lipActive = false; mouthVal = 0;
    setStatus('idle');
  },

  setListening: function() {
    lipActive = false; mouthVal = 0;
    setStatus('listening');
  },

  setThinking: function() {
    lipActive = false; mouthVal = 0;
    setStatus('thinking');
  },

  setHappy: function() {
    setStatus('happy');
    setExpr('happy', 0.8);
    setTimeout(function() {
      setExpr('happy', 0);
      setStatus('idle');
    }, 4000);
  }
};

})();
