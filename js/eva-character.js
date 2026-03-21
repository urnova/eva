(function () {
'use strict';

/* ═══════════════════════════════════════════════════════════════════════════
   EVA CHARACTER ENGINE v4
   ─ Three.js + @pixiv/three-vrm (local /js/lib/)
   ─ Full state machine: idle · listening · thinking · talking · happy
   ─ Procedural layers: breathing · weight-shift · head-look · blink · lip-sync
   ─ Smooth lerp transitions between every state
   ─ Graceful fallback on WebGL failure (mobile safe)
   ═══════════════════════════════════════════════════════════════════════════ */

/* ─── PATH ──────────────────────────────────────────────────────────────── */
var MODEL_PATH = '/models/eva.vrm?v=3';

/* ─── ENGINE ────────────────────────────────────────────────────────────── */
var R, scene, cam, clock, vrm, raf;           // renderer, scene, camera, clock, vrm, animFrame
var loaded = false;

/* ─── GLOBAL TIME & STATE ───────────────────────────────────────────────── */
var T        = 0;                             // seconds since VRM loaded
var curState = 'idle';
var lipOn    = false;

/* ═══════════════════════════════════════════════════════════════════════════
   SMOOTH VALUE SYSTEM
   Every animated parameter has a "current" and "target".
   The main loop lerps current → target at a configured speed each frame.
   ═══════════════════════════════════════════════════════════════════════════ */
function mkV(v) { return { cur: v, tgt: v }; }
function lerpV(v, dt, speed) {
  var k = 1 - Math.pow(1 - speed, dt * 60);  // frame-rate independent lerp
  v.cur += (v.tgt - v.cur) * k;
}

var P = {
  /* Head */
  hX: mkV(0), hY: mkV(0), hZ: mkV(0),
  /* Neck */
  nX: mkV(0), nY: mkV(0),
  /* Spine */
  sX: mkV(0), sZ: mkV(0),
  /* Hips */
  hipZ: mkV(0), hipX: mkV(0),
  /* Arms upper — NEGATIVE Z lowers left arm, POSITIVE Z lowers right arm */
  lAZ: mkV(-1.50), rAZ: mkV(1.50),
  lAX: mkV(0),     rAX: mkV(0),
  /* Elbows */
  lEZ: mkV(-0.10), rEZ: mkV(0.10),
  /* Upper legs (thighs) */
  lLZ: mkV(0), rLZ: mkV(0),
  lLX: mkV(0), rLX: mkV(0),
  /* Expressions */
  blink: mkV(0), mouth: mkV(0),
  happy: mkV(0), angry: mkV(0), sad: mkV(0), sur: mkV(0)
};

/* Speed constants – fraction of gap closed per frame at 60 fps */
var SPD = {
  head: 0.10, neck: 0.12, spine: 0.08, hip: 0.06,
  arm: 0.06,  elbow: 0.08,
  expr: 0.18, mouth: 0.30, blink: 0.55
};

/* ─── PROCEDURAL OVERLAYS (add on top of state targets) ─────────────────── */
/* Breathing: 1 cycle ≈ 4 s */
var breathAmp   = 0.022;
/* Weight shift */
var wShiftSide  = 1;          /* +1 = right,  -1 = left */
var wShiftTimer = 0;          /* seconds until next shift */
var wShiftAmp   = 0.038;      /* spine Z lean — more visible sway */
var wShiftCur   = mkV(0);     /* current lean value (smooth) */

/* Gaze "look-around" during idle */
var gazeTimer = 0;
var gazeYtgt  = 0;
var gazeXtgt  = 0;

/* Blink */
var blinkTimer    = 2 + Math.random() * 2;
var blinkPhase    = 0;        /* 0 = idle, 1 = closing, 2 = hold, 3 = opening */
var blinkElap     = 0;

/* Head-nod (listening) */
var nodTimer  = 0;
var nodBurst  = 0;            /* how many nods remain in current burst */
var nodPhase  = 0;

/* ═══════════════════════════════════════════════════════════════════════════
   ENTRY POINT
   ═══════════════════════════════════════════════════════════════════════════ */
function create(containerId) {
  var wrap = document.getElementById(containerId);
  if (!wrap) return;
  wrap.innerHTML = buildHTML();
  spawnParticles();
  loadVRM();
}

/* ═══════════════════════════════════════════════════════════════════════════
   LOAD
   ═══════════════════════════════════════════════════════════════════════════ */
async function loadVRM() {
  var container = document.getElementById('vrmContainer');
  if (!container) return;

  /* ── Import (bare specifiers resolved by local importmap) ── */
  var THREE, GLTFLoader, VRMLoaderPlugin, VRMUtils;
  try {
    var [m3, mG, mV] = await Promise.all([
      import('three'),
      import('three/examples/jsm/loaders/GLTFLoader.js'),
      import('@pixiv/three-vrm')
    ]);
    THREE = m3; GLTFLoader = mG.GLTFLoader;
    VRMLoaderPlugin = mV.VRMLoaderPlugin; VRMUtils = mV.VRMUtils;
  } catch (e) {
    console.error('[EVA] import error:', e);
    fallback(); return;
  }

  /* ── Renderer — WebGL with alpha, antialias ── */
  try {
    R = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  } catch (e) { fallback(); return; }

  var W = container.offsetWidth  || 300;
  var H = container.offsetHeight || 520;

  R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5)); /* cap for mobile perf */
  R.setSize(W, H);
  R.outputColorSpace = THREE.SRGBColorSpace;
  R.setClearColor(0x000000, 0);
  Object.assign(R.domElement.style, {
    position: 'absolute', bottom: '0', left: '50%',
    transform: 'translateX(-50%)', zIndex: '1'
  });
  container.appendChild(R.domElement);

  /* ── Scene ── */
  scene = new THREE.Scene();
  clock = new THREE.Clock();

  /* ── Camera — low angle, see full body + ground space below feet ── */
  cam = new THREE.PerspectiveCamera(32, W / H, 0.1, 20);
  cam.position.set(0, 0.60, 3.6);
  cam.lookAt(0, 0.90, 0);

  /* ── Lighting ── */
  scene.add(new THREE.AmbientLight(0xffffff, 1.1));
  var key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(0.8, 2.5, 2); scene.add(key);
  var fill = new THREE.DirectionalLight(0xb0d0ff, 0.5);
  fill.position.set(-1.5, 1, 1); scene.add(fill);
  var rim = new THREE.PointLight(0x00d4ff, 1.8, 5);
  rim.position.set(-0.8, 2.0, -0.9); scene.add(rim);
  var rim2 = new THREE.PointLight(0x8b5cf6, 0.8, 3.5);
  rim2.position.set(1, 1.2, -0.6); scene.add(rim2);

  /* ── Ground glow disc (3D — perspectively correct under feet) ── */
  var gc_ = document.createElement('canvas');
  gc_.width = gc_.height = 256;
  var gc = gc_.getContext('2d');
  var gg = gc.createRadialGradient(128, 128, 0, 128, 128, 128);
  gg.addColorStop(0,    'rgba(0,212,255,0.95)');
  gg.addColorStop(0.25, 'rgba(0,212,255,0.70)');
  gg.addColorStop(0.55, 'rgba(0,212,255,0.28)');
  gg.addColorStop(1,    'rgba(0,212,255,0)');
  gc.fillStyle = gg; gc.fillRect(0, 0, 256, 256);
  var glowTex  = new THREE.CanvasTexture(gc_);
  var glowMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.85, 0.85),
    new THREE.MeshBasicMaterial({
      map: glowTex, transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    })
  );
  glowMesh.rotation.x = -Math.PI / 2;
  glowMesh.position.set(0, 0.008, 0);
  scene.add(glowMesh);
  /* Gentle pulse stored on object for animation loop */
  glowMesh.userData.pulse = 0;

  /* ── Resize ── */
  window.addEventListener('resize', function () {
    if (!R || !container) return;
    var nW = container.offsetWidth, nH = container.offsetHeight;
    if (!nW || !nH) return;
    R.setSize(nW, nH); cam.aspect = nW / nH; cam.updateProjectionMatrix();
  });

  /* ── Load VRM ── */
  var loadEl   = document.getElementById('evaLoading');
  var loadSpan = loadEl && loadEl.querySelector('span');

  var loader = new GLTFLoader();
  loader.register(function (p) { return new VRMLoaderPlugin(p); });

  loader.load(MODEL_PATH,
    function onLoad(gltf) {
      vrm = gltf.userData.vrm;
      if (!vrm) { console.error('[EVA] no VRM in userData'); fallback(); return; }

      try { VRMUtils.removeUnnecessaryVertices(gltf.scene); } catch (_) {}
      try { VRMUtils.combineSkeletons(gltf.scene); }          catch (_) {}

      /* VRM0 faces -Z; rotate 180° to face camera */
      try {
        var ver = vrm.meta && (vrm.meta.metaVersion || vrm.meta.specVersion || '0');
        if (String(ver)[0] === '0') vrm.scene.rotation.y = Math.PI;
      } catch (_) {}

      scene.add(vrm.scene);

      /* Debug */
      var exprs = vrm.expressionManager
        ? Object.keys(vrm.expressionManager.expressionMap || {})
        : [];
      console.log('[EVA] Expressions:', exprs.join(', ') || 'none');

      var testBones = ['head','neck','chest','upperChest','spine','hips',
                       'leftUpperArm','rightUpperArm','leftLowerArm','rightLowerArm'];
      var found = testBones.filter(function (b) {
        try { return !!vrm.humanoid.getNormalizedBoneNode(b); } catch (_) { return false; }
      });
      console.log('[EVA] Bones:', found.join(', ') || 'NONE');

      /* Initial A-pose */
      applyAPose();

      loaded = true;
      if (loadEl) loadEl.style.display = 'none';
      setStatus('idle');
      resetWeightShift();
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

/* ═══════════════════════════════════════════════════════════════════════════
   A-POSE  (lower arms ~65° from VRM0 T-pose horizontal)
   ═══════════════════════════════════════════════════════════════════════════ */
function applyAPose() {
  setBone('leftUpperArm',  { z: -1.50, x: 0, y: 0 });
  setBone('rightUpperArm', { z:  1.50, x: 0, y: 0 });
  setBone('leftLowerArm',  { z: -0.10 });
  setBone('rightLowerArm', { z:  0.10 });
  vrm.update(0);
}

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS
   ═══════════════════════════════════════════════════════════════════════════ */
function getBone(name) {
  if (!vrm || !vrm.humanoid) return null;
  try { return vrm.humanoid.getNormalizedBoneNode(name); } catch (_) { return null; }
}
function setBone(name, rot) {
  var b = getBone(name); if (!b) return;
  if (rot.x !== undefined) b.rotation.x = rot.x;
  if (rot.y !== undefined) b.rotation.y = rot.y;
  if (rot.z !== undefined) b.rotation.z = rot.z;
}

var EMAP = {
  blink: ['blink','Blink','blinkLeft','BlinkL'],
  mouth: ['aa','A','a','Aa'],
  happy: ['happy','Joy','joy'],
  angry: ['angry','Angry'],
  sad:   ['sad','Sorrow','sorrow'],
  sur:   ['surprised','Surprised']
};
function setExpr(key, val) {
  if (!vrm || !vrm.expressionManager) return;
  var mgr = vrm.expressionManager;
  var map = mgr.expressionMap || {};
  var names = EMAP[key] || [key];
  for (var i = 0; i < names.length; i++) {
    var n = names[i];
    if (map[n] !== undefined) { try { mgr.setValue(n, val); return; } catch (_) {} }
    var nl = n.toLowerCase();
    if (map[nl] !== undefined) { try { mgr.setValue(nl, val); return; } catch (_) {} }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   RENDER LOOP
   ═══════════════════════════════════════════════════════════════════════════ */
function startLoop(THREE) {
  /* capture glowMesh from scene for pulse animation */
  var gm = scene.children.find(function (c) { return c.userData && c.userData.pulse !== undefined; });
  function tick() {
    raf = requestAnimationFrame(tick);
    var dt = Math.min(clock.getDelta(), 0.05);
    T += dt;
    tick_procedural(dt);
    tick_state(dt);
    tick_apply(dt);
    /* Ground glow pulse */
    if (gm && gm.material) {
      var pulse = 0.78 + Math.sin(T * 1.8) * 0.12;
      gm.material.opacity = pulse;
      var sc = 0.95 + Math.sin(T * 1.1) * 0.05;
      gm.scale.set(sc, 1, sc);
    }
    vrm.update(dt);
    R.render(scene, cam);
  }
  tick();
}

/* ═══════════════════════════════════════════════════════════════════════════
   PROCEDURAL SYSTEMS  (run every frame, state-independent)
   ═══════════════════════════════════════════════════════════════════════════ */
function tick_procedural(dt) {

  /* ── 1. BLINK ─────────────────────────────────────────────────────────── */
  if (blinkPhase === 0) {
    blinkTimer -= dt;
    if (blinkTimer <= 0) {
      blinkPhase = 1; blinkElap = 0;
      blinkTimer = 2.5 + Math.random() * 3;
    }
  } else {
    blinkElap += dt;
    var bv;
    if      (blinkPhase === 1) { bv = Math.min(blinkElap / 0.07, 1);   if (blinkElap >= 0.07) { blinkPhase = 2; blinkElap = 0; } }
    else if (blinkPhase === 2) { bv = 1;                                if (blinkElap >= 0.08) { blinkPhase = 3; blinkElap = 0; } }
    else                       { bv = Math.max(1 - blinkElap / 0.14,0);if (blinkElap >= 0.14) { blinkPhase = 0; bv = 0; } }
    P.blink.tgt = bv;
  }

  /* ── 2. BREATHING (spine / upperChest X tilt) ─────────────────────────── */
  /* 1 breath ≈ 4 s. Sine-based, very subtle chest rise */
  var breath = Math.sin(T * Math.PI / 2) * breathAmp;

  /* ── 3. WEIGHT SHIFT (idle sway L/R every 10-15 s) ───────────────────── */
  if (curState === 'idle' || curState === 'happy') {
    wShiftTimer -= dt;
    if (wShiftTimer <= 0) {
      wShiftSide  = -wShiftSide;
      wShiftTimer = 10 + Math.random() * 5;
    }
    wShiftCur.tgt = wShiftSide * wShiftAmp;
  } else {
    wShiftCur.tgt = 0;
  }
  lerpV(wShiftCur, dt, 0.012); /* very slow */

  /* ── 4. GAZE DRIFT (idle look-around) ────────────────────────────────── */
  if (curState === 'idle' || curState === 'happy') {
    gazeTimer -= dt;
    if (gazeTimer <= 0) {
      var r = Math.random();
      if (r < 0.4) { gazeYtgt = 0; gazeXtgt = 0; }         /* look at camera */
      else if (r < 0.65) { gazeYtgt = (Math.random() - 0.5) * 0.18; gazeXtgt = (Math.random() - 0.5) * 0.06; }
      gazeTimer = 2 + Math.random() * 4;
    }
  } else {
    gazeYtgt = 0; gazeXtgt = 0; /* all other states: eyes on camera */
  }

  /* Store breath and wShift for tick_apply */
  procedural.breath    = breath;
  procedural.wShift    = wShiftCur.cur;
  procedural.gazeY     = gazeYtgt;
  procedural.gazeX     = gazeXtgt;
}

var procedural = { breath: 0, wShift: 0, gazeY: 0, gazeX: 0 };

/* ═══════════════════════════════════════════════════════════════════════════
   STATE MACHINE  — sets P.*.tgt each frame
   ═══════════════════════════════════════════════════════════════════════════ */
function tick_state(dt) {
  switch (curState) {

    /* ── IDLE ────────────────────────────────────────────────────────────── */
    case 'idle': {
      /* Head: gentle ambient sway (slow, organic) */
      var s = T;
      P.hX.tgt = procedural.gazeX + Math.sin(s * 0.31) * 0.04;
      P.hY.tgt = procedural.gazeY + Math.sin(s * 0.47) * 0.06 + Math.sin(s * 0.19) * 0.03;
      P.hZ.tgt = Math.sin(s * 0.23) * 0.03;
      P.nX.tgt = P.hX.tgt * 0.4;
      P.nY.tgt = P.hY.tgt * 0.4;
      /* Spine: breathing + very subtle forward-back */
      P.sX.tgt = procedural.breath + Math.sin(T * 0.25) * 0.008;
      P.sZ.tgt = procedural.wShift;
      P.hipZ.tgt = procedural.wShift * 0.5;
      /* Arms: hang down, gentle swing follows weight-shift */
      var ws = procedural.wShift;
      P.lAZ.tgt = -1.50 + Math.sin(T * 0.35) * 0.07 +  ws * 0.15;
      P.rAZ.tgt =  1.50 + Math.sin(T * 0.35) * 0.07 -  ws * 0.15;
      P.lAX.tgt = Math.sin(T * 0.28) * 0.04;
      P.rAX.tgt = Math.sin(T * 0.28 + 1.0) * 0.04;
      P.lEZ.tgt = -0.10; P.rEZ.tgt =  0.10;
      /* Legs: follow weight shift (thighs rock with hips) */
      P.lLZ.tgt =  ws *  0.12;   /* left thigh shifts opposite to hip lean */
      P.rLZ.tgt =  ws * -0.12;
      P.lLX.tgt = Math.sin(T * 0.22) * 0.02;
      P.rLX.tgt = Math.sin(T * 0.22 + 0.8) * 0.02;
      /* Expressions: neutral */
      P.happy.tgt = 0; P.angry.tgt = 0; P.sad.tgt = 0;
      break;
    }

    /* ── LISTENING ───────────────────────────────────────────────────────── */
    case 'listening': {
      /* Body slightly forward, engaged */
      P.sX.tgt = 0.035 + procedural.breath * 0.5;
      P.sZ.tgt = 0;
      P.hipZ.tgt = 0;
      /* Head: contact visuel, légère inclinaison côté droit, petits hochements */
      nodTimer -= dt;
      if (nodTimer <= 0) {
        nodBurst = 2 + Math.floor(Math.random() * 3); /* 2-4 nods */
        nodTimer = 3 + Math.random() * 4;
        nodPhase = 0;
      }
      nodPhase += dt * 4;
      var nod = nodBurst > 0 ? Math.max(0, Math.sin(nodPhase) * 0.06) : 0;
      if (nodBurst > 0 && nodPhase > Math.PI) { nodPhase = 0; nodBurst--; }

      P.hX.tgt = -0.04 + nod;
      P.hY.tgt = procedural.gazeY * 0.3;
      P.hZ.tgt =  0.06;          /* head tilt — empathic lean */
      P.nX.tgt =  P.hX.tgt * 0.45;
      P.nY.tgt =  P.hY.tgt * 0.35;
      /* Arms: hanging naturally, relaxed */
      P.lAZ.tgt = -1.46; P.rAZ.tgt =  1.46;
      P.lAX.tgt = 0.02; P.rAX.tgt = -0.02;
      P.lEZ.tgt = -0.10; P.rEZ.tgt =  0.10;
      /* Legs: neutral, engaged stance */
      P.lLZ.tgt = 0; P.rLZ.tgt = 0;
      P.lLX.tgt = 0; P.rLX.tgt = 0;
      /* Expression */
      P.happy.tgt = 0; P.angry.tgt = 0; P.sad.tgt = 0;
      break;
    }

    /* ── THINKING ────────────────────────────────────────────────────────── */
    case 'thinking': {
      /* Body upright, slightly less breath visible */
      P.sX.tgt = procedural.breath * 0.7;
      P.sZ.tgt = 0; P.hipZ.tgt = 0;
      /* Head: regard détaché, yeux vers haut-droite, légère inclinaison */
      var s = T;
      P.hX.tgt = -0.10 + Math.sin(s * 0.45) * 0.03;
      P.hY.tgt =  0.14 + Math.sin(s * 0.32) * 0.03;   /* look up-right */
      P.hZ.tgt =  0.07;
      P.nX.tgt =  P.hX.tgt * 0.4;
      P.nY.tgt =  P.hY.tgt * 0.35;
      /* Arms: right hand toward chin, left arm forward as support */
      P.lAZ.tgt = -0.70;   /* left arm partially raised, crossing in front */
      P.lAX.tgt = -0.22;   /* slightly forward */
      P.lEZ.tgt = -0.30;   /* light elbow bend */
      P.rAZ.tgt = -0.18;   /* right arm raised above horizontal */
      P.rAX.tgt = -0.48;   /* arm comes forward toward face */
      P.rEZ.tgt =  0.65;   /* elbow bends, forearm points toward chin */
      /* Legs: weight shifted slightly back, contemplative stance */
      P.lLZ.tgt = -0.04; P.rLZ.tgt =  0.04;
      P.lLX.tgt =  0.02; P.rLX.tgt =  0.02;
      /* Expression: concentration */
      P.angry.tgt = 0.15; P.happy.tgt = 0; P.sad.tgt = 0;
      break;
    }

    /* ── TALKING ─────────────────────────────────────────────────────────── */
    case 'talking': {
      var s = T;
      /* Body: energetic, slight forward lean */
      P.sX.tgt = 0.02 + procedural.breath * 0.6 + Math.sin(s * 0.85) * 0.015;
      P.sZ.tgt = Math.sin(s * 0.60) * 0.015;
      P.hipZ.tgt = P.sZ.tgt * -0.5;
      /* Head: expressive, dynamic */
      P.hX.tgt = -0.03 + Math.sin(s * 1.10) * 0.10 + Math.sin(s * 0.65) * 0.04;
      P.hY.tgt =          Math.sin(s * 0.78) * 0.14 + Math.sin(s * 0.43) * 0.05;
      P.hZ.tgt =          Math.sin(s * 0.55) * 0.07;
      P.nX.tgt =  P.hX.tgt * 0.45;
      P.nY.tgt =  P.hY.tgt * 0.40;
      /* Arms: expressive gestural movement — bigger swings during speech */
      P.lAZ.tgt = -1.42 + Math.sin(s * 0.82) * 0.14 + Math.sin(s * 1.35) * 0.06;
      P.rAZ.tgt =  1.42 - Math.sin(s * 0.70) * 0.14 - Math.sin(s * 1.20) * 0.05;
      P.lAX.tgt =  Math.sin(s * 0.60) * 0.08;
      P.rAX.tgt = -Math.sin(s * 0.60) * 0.08;
      P.lEZ.tgt = -0.10 + Math.sin(s * 0.90) * 0.06;
      P.rEZ.tgt =  0.10 + Math.sin(s * 0.75) * 0.06;
      /* Legs: subtle alive movement while talking */
      P.lLZ.tgt = Math.sin(s * 0.55) * 0.04;
      P.rLZ.tgt = Math.sin(s * 0.55 + 0.8) * 0.04;
      P.lLX.tgt = 0; P.rLX.tgt = 0;
      /* Expression: slight happy */
      P.happy.tgt = 0.20; P.angry.tgt = 0; P.sad.tgt = 0;
      break;
    }

    /* ── HAPPY ───────────────────────────────────────────────────────────── */
    case 'happy': {
      var s = T;
      P.sX.tgt = procedural.breath + Math.sin(s * 0.70) * 0.015;
      P.sZ.tgt = procedural.wShift;
      P.hipZ.tgt = procedural.wShift * 0.5;
      /* Head: bouncy, expressive */
      P.hX.tgt = Math.sin(s * 0.90) * 0.09;
      P.hY.tgt = Math.sin(s * 0.70) * 0.13 + Math.sin(s * 1.10) * 0.04;
      P.hZ.tgt = Math.sin(s * 0.50) * 0.07 - 0.02;
      P.nX.tgt = P.hX.tgt * 0.40;
      P.nY.tgt = P.hY.tgt * 0.35;
      /* Arms: cheerful, bounce with body */
      P.lAZ.tgt = -1.38 + Math.sin(s * 0.88) * 0.16;
      P.rAZ.tgt =  1.38 - Math.sin(s * 0.88) * 0.16;
      P.lAX.tgt = Math.sin(s * 0.70) * 0.06;
      P.rAX.tgt = Math.sin(s * 0.70 + 1.0) * 0.06;
      P.lEZ.tgt = -0.10 + Math.sin(s * 0.80) * 0.08;
      P.rEZ.tgt =  0.10 - Math.sin(s * 0.80) * 0.08;
      /* Legs: bounce / happy little shift */
      var ws2 = procedural.wShift;
      P.lLZ.tgt =  ws2 * 0.10 + Math.sin(s * 1.0) * 0.03;
      P.rLZ.tgt = -ws2 * 0.10 + Math.sin(s * 1.0 + 0.5) * 0.03;
      P.lLX.tgt = 0; P.rLX.tgt = 0;
      P.happy.tgt = 0.85; P.angry.tgt = 0; P.sad.tgt = 0;
      break;
    }
  }

  /* ── LIP SYNC (talking only) ─────────────────────────────────────────── */
  if (lipOn) {
    /* Drive mouth target externally in startTalking loop */
  } else {
    P.mouth.tgt = 0;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   APPLY  — lerp all P values then write to bones/expressions
   ═══════════════════════════════════════════════════════════════════════════ */
function tick_apply(dt) {
  /* Lerp all parameters */
  lerpV(P.hX,    dt, SPD.head);  lerpV(P.hY,    dt, SPD.head);  lerpV(P.hZ,    dt, SPD.head);
  lerpV(P.nX,    dt, SPD.neck);  lerpV(P.nY,    dt, SPD.neck);
  lerpV(P.sX,    dt, SPD.spine); lerpV(P.sZ,    dt, SPD.spine);
  lerpV(P.hipZ,  dt, SPD.hip);    lerpV(P.hipX,  dt, SPD.hip);
  lerpV(P.lAZ,   dt, SPD.arm);   lerpV(P.rAZ,   dt, SPD.arm);
  lerpV(P.lAX,   dt, SPD.arm);   lerpV(P.rAX,   dt, SPD.arm);
  lerpV(P.lEZ,   dt, SPD.elbow); lerpV(P.rEZ,   dt, SPD.elbow);
  lerpV(P.lLZ,   dt, SPD.hip);   lerpV(P.rLZ,   dt, SPD.hip);
  lerpV(P.lLX,   dt, SPD.hip);   lerpV(P.rLX,   dt, SPD.hip);
  lerpV(P.blink, dt, SPD.blink);
  lerpV(P.mouth, dt, SPD.mouth);
  lerpV(P.happy, dt, SPD.expr);  lerpV(P.angry, dt, SPD.expr);
  lerpV(P.sad,   dt, SPD.expr);  lerpV(P.sur,   dt, SPD.expr);

  /* Bones */
  var hd  = getBone('head');
  var nk  = getBone('neck');
  var sp  = getBone('upperChest') || getBone('chest') || getBone('spine');
  var hip = getBone('hips');
  var lUA = getBone('leftUpperArm'),  rUA = getBone('rightUpperArm');
  var lLA = getBone('leftLowerArm'),  rLA = getBone('rightLowerArm');
  var lUL = getBone('leftUpperLeg'),  rUL = getBone('rightUpperLeg');

  if (hd)  { hd.rotation.x  = P.hX.cur;  hd.rotation.y  = P.hY.cur;  hd.rotation.z  = P.hZ.cur; }
  if (nk)  { nk.rotation.x  = P.nX.cur;  nk.rotation.y  = P.nY.cur; }
  if (sp)  { sp.rotation.x  = P.sX.cur;  sp.rotation.z  = P.sZ.cur; }
  if (hip) { hip.rotation.z = P.hipZ.cur; hip.rotation.x = P.hipX.cur; }
  if (lUA) { lUA.rotation.z = P.lAZ.cur; lUA.rotation.x = P.lAX.cur; }
  if (rUA) { rUA.rotation.z = P.rAZ.cur; rUA.rotation.x = P.rAX.cur; }
  if (lLA) { lLA.rotation.z = P.lEZ.cur; }
  if (rLA) { rLA.rotation.z = P.rEZ.cur; }
  if (lUL) { lUL.rotation.z = P.lLZ.cur; lUL.rotation.x = P.lLX.cur; }
  if (rUL) { rUL.rotation.z = P.rLZ.cur; rUL.rotation.x = P.rLX.cur; }

  /* Expressions */
  setExpr('blink', Math.max(0, Math.min(1, P.blink.cur)));
  setExpr('mouth', Math.max(0, Math.min(1, P.mouth.cur)));
  setExpr('happy', Math.max(0, Math.min(1, P.happy.cur)));
  setExpr('angry', Math.max(0, Math.min(1, P.angry.cur)));
  setExpr('sad',   Math.max(0, Math.min(1, P.sad.cur)));
}

/* ═══════════════════════════════════════════════════════════════════════════
   LIP SYNC ENGINE  (driven by setTalking loop)
   ═══════════════════════════════════════════════════════════════════════════ */
var lipSyllTimer = 0;
var lipSyllTgt   = 0;
var lipInterval  = null;

function startLipSync() {
  if (lipInterval) return;
  lipInterval = setInterval(function () {
    if (!lipOn) { P.mouth.tgt = 0; return; }
    var r = Math.random();
    if      (r < 0.20) lipSyllTgt = 0.05 + Math.random() * 0.10;
    else if (r < 0.55) lipSyllTgt = 0.28 + Math.random() * 0.35;
    else if (r < 0.85) lipSyllTgt = 0.62 + Math.random() * 0.32;
    else               lipSyllTgt = 0;
    P.mouth.tgt = lipSyllTgt;
  }, 80 + Math.random() * 70);  /* every ~80-150 ms */
}
function stopLipSync() {
  clearInterval(lipInterval); lipInterval = null;
  P.mouth.tgt = 0;
}

/* ═══════════════════════════════════════════════════════════════════════════
   WEIGHT SHIFT RESET
   ═══════════════════════════════════════════════════════════════════════════ */
function resetWeightShift() {
  wShiftSide  = Math.random() > 0.5 ? 1 : -1;
  wShiftTimer = 5 + Math.random() * 5;
}

/* ═══════════════════════════════════════════════════════════════════════════
   STATUS BAR
   ═══════════════════════════════════════════════════════════════════════════ */
var STATUS_TXT = {
  idle: 'EN LIGNE', talking: 'PARLE...', listening: 'ÉCOUTE...',
  thinking: 'RÉFLÉCHIT...', happy: 'EN LIGNE'
};
function setStatus(s) {
  curState = s;
  var bar = document.getElementById('evaStatusBar');
  var txt = document.getElementById('evaStatusTxt');
  var cls = 'eva-status';
  if (s === 'talking' || s === 'listening') cls += ' ' + s;
  else if (s === 'thinking') cls += ' thinking';
  if (bar) bar.className = cls;
  if (txt) txt.textContent = STATUS_TXT[s] || 'EN LIGNE';
}

/* ═══════════════════════════════════════════════════════════════════════════
   FALLBACK
   ═══════════════════════════════════════════════════════════════════════════ */
function fallback() {
  var el = document.getElementById('evaLoading');
  if (el) el.innerHTML = '<span style="color:rgba(0,212,255,.5);font-family:monospace;font-size:.65em;letter-spacing:3px;text-align:center;display:block">EVA<br>ONLINE</span>';
}

/* ═══════════════════════════════════════════════════════════════════════════
   PARTICLES
   ═══════════════════════════════════════════════════════════════════════════ */
function spawnParticles() {
  var c = document.getElementById('evaParticles');
  if (!c) return;
  for (var i = 0; i < 14; i++) {
    var p = document.createElement('div');
    p.className = 'eva-p';
    p.style.cssText = [
      'left:'               + (4 + Math.random() * 92)   + '%',
      'bottom:'             + (8 + Math.random() * 65)   + '%',
      'width:'              + (1 + Math.random() * 2)     + 'px',
      'height:'             + (1 + Math.random() * 2)     + 'px',
      'animation-duration:' + (5 + Math.random() * 8)    + 's',
      'animation-delay:'    + (Math.random() * 10)        + 's',
      'background:'         + (Math.random() > 0.5 ? '#b794f6' : '#00d4ff')
    ].join(';');
    c.appendChild(p);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   HTML TEMPLATE
   ═══════════════════════════════════════════════════════════════════════════ */
function buildHTML() {
  return `<style>
#evaWrap{position:relative;width:100%;height:100%;overflow:hidden;}
#vrmContainer{position:absolute;inset:0 0 32px;overflow:hidden;}
.eva-bg-glow{
  position:absolute;bottom:32px;left:50%;transform:translateX(-50%);
  width:75%;height:70px;border-radius:50%;z-index:0;pointer-events:none;
  background:radial-gradient(ellipse,rgba(0,212,255,0.13) 0%,transparent 70%);
  animation:evaGlow 4s ease-in-out infinite;
}
@keyframes evaGlow{
  0%,100%{opacity:.45;transform:translateX(-50%) scaleX(1);}
  50%{opacity:.9;transform:translateX(-50%) scaleX(1.35);}
}
.eva-particles{position:absolute;inset:0;pointer-events:none;z-index:0;overflow:hidden;}
.eva-p{position:absolute;border-radius:50%;animation:evaP linear infinite;opacity:0;}
@keyframes evaP{
  0%{opacity:0;transform:translateY(0) scale(0);}
  8%{opacity:.55;}90%{opacity:.15;}
  100%{opacity:0;transform:translateY(-110px) scale(1.8);}
}
.eva-scan{
  position:absolute;left:0;right:0;height:1px;z-index:5;pointer-events:none;
  background:linear-gradient(90deg,transparent,rgba(0,212,255,.3),transparent);
  animation:evaScan 9s ease-in-out infinite;
}
@keyframes evaScan{
  0%{bottom:35px;opacity:0;}7%{opacity:.4;}93%{opacity:.12;}100%{bottom:100%;opacity:0;}
}
.eva-c{position:absolute;width:9px;height:9px;z-index:6;pointer-events:none;opacity:.28;}
.eva-c.tl{top:7px;left:7px;border-top:1.5px solid #00d4ff;border-left:1.5px solid #00d4ff;}
.eva-c.tr{top:7px;right:7px;border-top:1.5px solid #00d4ff;border-right:1.5px solid #00d4ff;}
.eva-c.bl{bottom:37px;left:7px;border-bottom:1.5px solid #00d4ff;border-left:1.5px solid #00d4ff;}
.eva-c.br{bottom:37px;right:7px;border-bottom:1.5px solid #00d4ff;border-right:1.5px solid #00d4ff;}
.eva-status{
  position:absolute;bottom:0;left:0;right:0;height:32px;
  display:flex;align-items:center;justify-content:center;gap:6px;
  font-family:'Space Mono',monospace;font-size:.57em;letter-spacing:1.5px;
  text-transform:uppercase;color:rgba(0,212,255,.85);z-index:10;transition:color .5s;
}
.eva-dot{
  width:5px;height:5px;border-radius:50%;background:#00d4ff;flex-shrink:0;
  animation:evaDot 2s ease-in-out infinite;
}
@keyframes evaDot{0%,100%{opacity:1;transform:scale(1);}50%{opacity:.2;transform:scale(.45);}}
.eva-status.talking .eva-dot,.eva-status.listening .eva-dot{background:#00ff88;animation:evaDot .22s ease-in-out infinite;}
.eva-status.thinking .eva-dot{background:#b794f6;animation:evaDot .85s ease-in-out infinite;}
.eva-status.talking{color:rgba(0,255,136,.9);}
.eva-status.listening{color:rgba(0,255,136,.9);}
.eva-status.thinking{color:rgba(183,148,246,.9);}
.eva-loading{
  position:absolute;top:45%;left:50%;transform:translate(-50%,-50%);
  display:flex;flex-direction:column;align-items:center;gap:10px;z-index:10;
  color:rgba(0,212,255,.6);font-family:'Space Mono',monospace;
  font-size:.57em;letter-spacing:2px;text-align:center;
}
.eva-ring{
  width:26px;height:26px;border-radius:50%;
  border:2px solid rgba(0,212,255,.1);border-top-color:#00d4ff;
  animation:evaSpin .9s linear infinite;
}
@keyframes evaSpin{to{transform:rotate(360deg);}}
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

/* ═══════════════════════════════════════════════════════════════════════════
   PUBLIC API
   ═══════════════════════════════════════════════════════════════════════════ */
window.EvaCharacter = {
  create: create,

  setIdle: function () {
    lipOn = false; stopLipSync();
    P.mouth.tgt = 0;
    setStatus('idle');
    P.happy.tgt = 0;
  },

  startTalking: function () { window.EvaCharacter.setTalking(); },

  setTalking: function () {
    lipOn = true;
    setStatus('talking');
    startLipSync();
  },

  stopTalking: function () {
    lipOn = false; stopLipSync();
    P.mouth.tgt = 0;
    setStatus('idle');
  },

  setListening: function () {
    lipOn = false; stopLipSync();
    P.mouth.tgt = 0;
    nodTimer = 0; nodBurst = 0; nodPhase = 0; /* reset nod system */
    setStatus('listening');
  },

  setThinking: function () {
    lipOn = false; stopLipSync();
    P.mouth.tgt = 0;
    setStatus('thinking');
  },

  setHappy: function () {
    setStatus('happy');
    P.happy.tgt = 0.85;
    setTimeout(function () {
      P.happy.tgt = 0;
      setStatus('idle');
    }, 4000);
  }
};

})();
