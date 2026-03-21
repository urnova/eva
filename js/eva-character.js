(function () {
'use strict';

/* ═══════════════════════════════════════════════════════════════════════════
   EVA CHARACTER ENGINE v5
   ─ Three.js + @pixiv/three-vrm
   ─ Philosophie : bras TOUJOURS au repos (≈ -1.50 / +1.50)
     Toute l'expressivité passe par la tête, le cou et le buste.
   ─ Physique de ressort (spring) sur chaque paramètre → transitions
     organiques, jamais mécaniques.
   ─ Mouvements de tête par marche aléatoire : naturel, non-répétitif.
   ═══════════════════════════════════════════════════════════════════════════ */

/* ─── PATH ─────────────────────────────────────────────────────────────── */
var MODEL_PATH = '/models/eva.vrm?v=4';

/* ─── ENGINE ───────────────────────────────────────────────────────────── */
var R, scene, cam, clock, vrm, raf;
var loaded  = false;
var T       = 0;
var curState = 'idle';
var lipOn   = false;

/* ═══════════════════════════════════════════════════════════════════════════
   SPRING PHYSICS
   Chaque valeur animée a : cur (position), vel (vitesse), tgt (cible)
   springStep() = ressort amorti : lisse, naturel, sans oscillation.
   ═══════════════════════════════════════════════════════════════════════════ */
function mkS(v) { return { cur: v, vel: 0, tgt: v }; }

/**
 * Pas de ressort amorti.
 * @param {object} s  objet {cur, vel, tgt}
 * @param {number} dt deltaTime (s)
 * @param {number} f  fréquence angulaire — rigidité (rad/s). Plus grand = plus vif.
 * @param {number} d  amortissement. 1.0 = critique (zéro oscillation). > 1 = over-damped.
 */
function springStep(s, dt, f, d) {
  var k     = f * f;
  var c     = 2 * f * d;
  var force = k * (s.tgt - s.cur) - c * s.vel;
  s.vel += force * dt;
  s.cur += s.vel * dt;
}

/* Paramètres animés */
var P = {
  /* Tête */
  hX: mkS(0), hY: mkS(0), hZ: mkS(0),
  /* Cou */
  nX: mkS(0), nY: mkS(0),
  /* Buste / colonne */
  sX: mkS(0), sZ: mkS(0),
  /* Hanches */
  hipZ: mkS(0), hipX: mkS(0),
  /* Bras supérieurs — convention :
     lAZ NÉGATIF = bras gauche vers le bas (repos ≈ -1.50)
     rAZ POSITIF = bras droit vers le bas  (repos ≈ +1.50)
     ← Les bras ne dépassent JAMAIS lAZ > -1.10 ou rAZ < 1.10 */
  lAZ: mkS(-1.50), rAZ: mkS(1.50),
  lAX: mkS(0),     rAX: mkS(0),
  /* Avant-bras (coudes) */
  lEZ: mkS(-0.08), rEZ: mkS(0.08),
  /* Cuisses */
  lLZ: mkS(0), rLZ: mkS(0),
  lLX: mkS(0), rLX: mkS(0),
  /* Expressions */
  blink: mkS(0), mouth: mkS(0),
  happy: mkS(0), angry: mkS(0), sad: mkS(0), sur: mkS(0)
};

/* Fréquences de ressort par groupe — plus f est grand, plus la transition est vive */
var FREQ = {
  head:  3.5,   /* tête — vif mais organique */
  neck:  3.0,
  spine: 2.0,   /* buste — lent, inertiel */
  hip:   1.8,
  arm:   1.4,   /* bras — très inertiel, lourds */
  elbow: 2.0,
  expr:  4.0,   /* expressions — réactives */
  mouth: 14.0,  /* lèvres — très rapides (lip sync) */
  blink: 18.0   /* clignement — quasi-instantané */
};

var DAMP = {
  head: 0.88, neck: 0.90, spine: 0.92, hip: 0.95,
  arm: 0.96, elbow: 0.88, expr: 0.82, mouth: 0.75, blink: 1.20
};

/* ═══════════════════════════════════════════════════════════════════════════
   MARCHE ALÉATOIRE — tête + buste
   Au lieu de sinus fixes (répétitifs), on tire une nouvelle cible toutes
   les N secondes et on y spring. Résultat : organique, jamais identique.
   ═══════════════════════════════════════════════════════════════════════════ */
var rw = {
  /* Tête */
  hX: { val: 0, timer: 0, next: 1.5 },   /* pitch (haut/bas) */
  hY: { val: 0, timer: 0, next: 1.5 },   /* yaw   (gauche/droite) */
  hZ: { val: 0, timer: 0, next: 2.0 },   /* roll  (inclinaison) */
  /* Épaules / buste */
  sZ: { val: 0, timer: 0, next: 6.0 }    /* déport latéral du buste */
};

function rwTick(dt) {
  rwStep(rw.hX, dt, -0.06,  0.08, 1.0, 3.0);
  rwStep(rw.hY, dt, -0.12,  0.12, 1.2, 4.0);
  rwStep(rw.hZ, dt, -0.05,  0.05, 1.5, 3.5);
  rwStep(rw.sZ, dt, -0.018, 0.018, 5.0, 12.0);
}

function rwStep(r, dt, lo, hi, tMin, tMax) {
  r.timer -= dt;
  if (r.timer <= 0) {
    r.val   = lo + Math.random() * (hi - lo);
    r.timer = tMin + Math.random() * (tMax - tMin);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   SYSTÈMES PROCÉDURAUX
   ═══════════════════════════════════════════════════════════════════════════ */

/* Respiration */
var BREATH_AMP = 0.016;   /* amplitude très subtile */

/* Déport de poids */
var wSide  = 1;           /* +1 droite, -1 gauche */
var wTimer = 0;
var wAmp   = 0.022;
var wCur   = mkS(0);

/* Clignement */
var blinkTimer = 2 + Math.random() * 2;
var blinkPhase = 0;
var blinkElap  = 0;

/* Hochements (écoute) */
var nodTimer = 3;
var nodBurst = 0;
var nodPhase = 0;

var proc = { breath: 0, wShift: 0 };

function tick_procedural(dt) {

  /* ── Respiration ──────────────────────────────────────────────────────── */
  proc.breath = Math.sin(T * Math.PI * 0.45) * BREATH_AMP;   /* ~0.45 Hz ≈ 1 cycle / 2.2 s */

  /* ── Déport de poids ──────────────────────────────────────────────────── */
  if (curState === 'idle' || curState === 'happy' || curState === 'listening') {
    wTimer -= dt;
    if (wTimer <= 0) {
      wSide  = -wSide;
      wTimer = 12 + Math.random() * 8;  /* 12-20 s entre chaque déport */
    }
    wCur.tgt = wSide * wAmp;
  } else {
    wCur.tgt = 0;
  }
  springStep(wCur, dt, 0.8, 1.2);  /* très lent, inertiel */
  proc.wShift = wCur.cur;

  /* ── Marche aléatoire ─────────────────────────────────────────────────── */
  rwTick(dt);

  /* ── Clignement ───────────────────────────────────────────────────────── */
  if (blinkPhase === 0) {
    blinkTimer -= dt;
    if (blinkTimer <= 0) {
      blinkPhase = 1; blinkElap = 0;
      blinkTimer = 2.5 + Math.random() * 3.5;
    }
  } else {
    blinkElap += dt;
    var bv;
    if      (blinkPhase === 1) { bv = Math.min(blinkElap / 0.065, 1);    if (blinkElap >= 0.065) { blinkPhase = 2; blinkElap = 0; } }
    else if (blinkPhase === 2) { bv = 1;                                  if (blinkElap >= 0.06)  { blinkPhase = 3; blinkElap = 0; } }
    else                       { bv = Math.max(1 - blinkElap / 0.12, 0); if (blinkElap >= 0.12)  { blinkPhase = 0; bv = 0; } }
    P.blink.tgt = bv;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   MACHINE D'ÉTATS — cibles P.*.tgt

   RÈGLE D'OR DES BRAS :
     Gauche : lAZ dans [-1.58, -1.25] → bras ne monte JAMAIS
     Droit  : rAZ dans [+1.25, +1.58] → bras ne monte JAMAIS
     lAX / rAX : max ±0.06 (micro-balancement naturel)
   ═══════════════════════════════════════════════════════════════════════════ */
function tick_state(dt) {
  var s = T;

  switch (curState) {

    /* ── IDLE ────────────────────────────────────────────────────────────── */
    case 'idle': {
      /* Buste : respiration + très léger balancement */
      P.sX.tgt  = proc.breath + Math.sin(s * 0.17) * 0.006;
      P.sZ.tgt  = proc.wShift * 0.8;
      P.hipZ.tgt = proc.wShift * 0.4;
      P.hipX.tgt = 0;

      /* Tête : marche aléatoire + léger regard caméra */
      P.hX.tgt = rw.hX.val * 0.5;                /* regarder légèrement caméra = hX proche de 0 */
      P.hY.tgt = rw.hY.val;
      P.hZ.tgt = rw.hZ.val + proc.wShift * 0.25; /* compensation naturelle du déport */
      P.nX.tgt = P.hX.tgt * 0.38;
      P.nY.tgt = P.hY.tgt * 0.35;

      /* Bras : repos naturel, micro-balancement avec le corps */
      var ws = proc.wShift;
      P.lAZ.tgt = -1.50 + ws * 0.08;    /* bras suit légèrement le déport de poids */
      P.rAZ.tgt =  1.50 - ws * 0.08;
      P.lAX.tgt = Math.sin(s * 0.23) * 0.03;
      P.rAX.tgt = Math.sin(s * 0.23 + 1.1) * 0.03;
      P.lEZ.tgt = -0.08; P.rEZ.tgt = 0.08;

      /* Cuisses */
      P.lLZ.tgt =  ws * 0.10;
      P.rLZ.tgt = -ws * 0.10;
      P.lLX.tgt = 0; P.rLX.tgt = 0;

      /* Expressions */
      P.happy.tgt = 0; P.angry.tgt = 0; P.sad.tgt = 0;
      break;
    }

    /* ── LISTENING ───────────────────────────────────────────────────────── */
    case 'listening': {
      /* Buste : légèrement en avant, attentif */
      P.sX.tgt  = 0.025 + proc.breath * 0.6;
      P.sZ.tgt  = proc.wShift * 0.5;
      P.hipZ.tgt = proc.wShift * 0.3;
      P.hipX.tgt = 0;

      /* Hochements de tête */
      nodTimer -= dt;
      if (nodTimer <= 0) {
        nodBurst = 2 + Math.floor(Math.random() * 3);
        nodTimer = 2.5 + Math.random() * 4;
        nodPhase = 0;
      }
      nodPhase += dt * 3.8;
      var nod = nodBurst > 0 ? Math.max(0, Math.sin(nodPhase) * 0.055) : 0;
      if (nodBurst > 0 && nodPhase > Math.PI) { nodPhase = 0; nodBurst--; }

      /* Tête : contact visuel, légère inclinaison empathique */
      P.hX.tgt = -0.03 + nod + rw.hX.val * 0.3;
      P.hY.tgt = rw.hY.val * 0.5;               /* regard centré sur l'utilisateur */
      P.hZ.tgt = 0.07 + rw.hZ.val * 0.4;        /* inclinaison légère droite = empathie */
      P.nX.tgt = P.hX.tgt * 0.40;
      P.nY.tgt = P.hY.tgt * 0.35;

      /* Bras : repos, identique à idle */
      var ws2 = proc.wShift;
      P.lAZ.tgt = -1.50 + ws2 * 0.06;
      P.rAZ.tgt =  1.50 - ws2 * 0.06;
      P.lAX.tgt = 0.02;  P.rAX.tgt = -0.02;
      P.lEZ.tgt = -0.08; P.rEZ.tgt =  0.08;
      P.lLZ.tgt = 0; P.rLZ.tgt = 0;
      P.lLX.tgt = 0; P.rLX.tgt = 0;

      P.happy.tgt = 0; P.angry.tgt = 0; P.sad.tgt = 0;
      break;
    }

    /* ── THINKING ────────────────────────────────────────────────────────── */
    case 'thinking': {
      /* Buste : légèrement en retrait, concentré */
      P.sX.tgt  = proc.breath * 0.5;
      P.sZ.tgt  = -0.008;    /* très léger recul */
      P.hipZ.tgt = 0;
      P.hipX.tgt = 0;

      /* Tête : regard vers haut-droite (chercher l'information) + oscillation lente */
      P.hX.tgt = -0.09 + Math.sin(s * 0.38) * 0.025;   /* légèrement relevée */
      P.hY.tgt =  0.12 + Math.sin(s * 0.27) * 0.028;   /* tournée à droite */
      P.hZ.tgt =  0.06 + Math.sin(s * 0.21) * 0.015;   /* inclinaison droite */
      P.nX.tgt = P.hX.tgt * 0.40;
      P.nY.tgt = P.hY.tgt * 0.38;

      /* Bras : REPOS — aucun geste de bras, naturel */
      P.lAZ.tgt = -1.50;  P.rAZ.tgt = 1.50;
      P.lAX.tgt =  0.01;  P.rAX.tgt = -0.01;
      P.lEZ.tgt = -0.10;  P.rEZ.tgt =  0.10;
      P.lLZ.tgt = -0.02;  P.rLZ.tgt = 0.02;
      P.lLX.tgt =  0.01;  P.rLX.tgt = 0.01;

      /* Expression : très légère concentration */
      P.angry.tgt = 0.08; P.happy.tgt = 0; P.sad.tgt = 0;
      break;
    }

    /* ── TALKING ─────────────────────────────────────────────────────────── */
    case 'talking': {
      /* Buste : léger élan en avant, vivant */
      P.sX.tgt  = 0.018 + proc.breath * 0.55 + Math.sin(s * 0.72) * 0.010;
      P.sZ.tgt  = Math.sin(s * 0.48) * 0.010;
      P.hipZ.tgt = P.sZ.tgt * -0.5;
      P.hipX.tgt = 0;

      /* Tête : dynamique, expressif — c'est le visage qui parle */
      P.hX.tgt = -0.02 + Math.sin(s * 0.95) * 0.075 + Math.sin(s * 0.54) * 0.030;
      P.hY.tgt =          Math.sin(s * 0.68) * 0.105 + Math.sin(s * 1.23) * 0.030;
      P.hZ.tgt =          Math.sin(s * 0.44) * 0.055 + Math.sin(s * 0.82) * 0.015;
      P.nX.tgt = P.hX.tgt * 0.40;
      P.nY.tgt = P.hY.tgt * 0.38;

      /* Bras : micro-balancement très subtil — naturel, jamais levé */
      P.lAZ.tgt = -1.50 + Math.sin(s * 0.55) * 0.055 + Math.sin(s * 0.88) * 0.025;
      P.rAZ.tgt =  1.50 - Math.sin(s * 0.55) * 0.055 - Math.sin(s * 0.88) * 0.025;
      P.lAX.tgt = Math.sin(s * 0.47) * 0.04;
      P.rAX.tgt = Math.sin(s * 0.47 + 1.2) * 0.04;
      P.lEZ.tgt = -0.08 + Math.sin(s * 0.65) * 0.04;
      P.rEZ.tgt =  0.08 + Math.sin(s * 0.65) * 0.04;

      /* Cuisses : légère vie, suit le corps */
      P.lLZ.tgt = Math.sin(s * 0.42) * 0.03;
      P.rLZ.tgt = Math.sin(s * 0.42 + 0.9) * 0.03;
      P.lLX.tgt = 0; P.rLX.tgt = 0;

      P.happy.tgt = 0.15; P.angry.tgt = 0; P.sad.tgt = 0;
      break;
    }

    /* ── HAPPY ───────────────────────────────────────────────────────────── */
    case 'happy': {
      /* Buste : léger rebond de joie */
      P.sX.tgt  = proc.breath + Math.sin(s * 0.65) * 0.012;
      P.sZ.tgt  = proc.wShift * 0.7;
      P.hipZ.tgt = proc.wShift * 0.4;
      P.hipX.tgt = 0;

      /* Tête : vive, lumineuse, regard caméra */
      P.hX.tgt = -0.02 + Math.sin(s * 0.80) * 0.065;
      P.hY.tgt =          Math.sin(s * 0.60) * 0.095 + Math.sin(s * 1.05) * 0.025;
      P.hZ.tgt =          Math.sin(s * 0.44) * 0.050;
      P.nX.tgt = P.hX.tgt * 0.38;
      P.nY.tgt = P.hY.tgt * 0.35;

      /* Bras : REPOS avec micro-rebond harmonique — PAS de levée */
      var ws3 = proc.wShift;
      P.lAZ.tgt = -1.50 + ws3 * 0.08 + Math.sin(s * 0.75) * 0.04;
      P.rAZ.tgt =  1.50 - ws3 * 0.08 - Math.sin(s * 0.75) * 0.04;
      P.lAX.tgt = Math.sin(s * 0.58) * 0.035;
      P.rAX.tgt = Math.sin(s * 0.58 + 1.0) * 0.035;
      P.lEZ.tgt = -0.09; P.rEZ.tgt = 0.09;

      /* Cuisses : léger balancement joyeux */
      P.lLZ.tgt =  ws3 * 0.10 + Math.sin(s * 0.85) * 0.025;
      P.rLZ.tgt = -ws3 * 0.10 + Math.sin(s * 0.85 + 0.6) * 0.025;
      P.lLX.tgt = 0; P.rLX.tgt = 0;

      P.happy.tgt = 0.80; P.angry.tgt = 0; P.sad.tgt = 0;
      break;
    }
  }

  /* ── Lip sync ─────────────────────────────────────────────────────────── */
  if (!lipOn) P.mouth.tgt = 0;
}

/* ═══════════════════════════════════════════════════════════════════════════
   APPLY — spring step sur tous les paramètres → os + expressions
   ═══════════════════════════════════════════════════════════════════════════ */
function tick_apply(dt) {
  /* Tête */
  springStep(P.hX, dt, FREQ.head,  DAMP.head);
  springStep(P.hY, dt, FREQ.head,  DAMP.head);
  springStep(P.hZ, dt, FREQ.head,  DAMP.head);
  /* Cou */
  springStep(P.nX, dt, FREQ.neck,  DAMP.neck);
  springStep(P.nY, dt, FREQ.neck,  DAMP.neck);
  /* Buste */
  springStep(P.sX, dt, FREQ.spine, DAMP.spine);
  springStep(P.sZ, dt, FREQ.spine, DAMP.spine);
  /* Hanches */
  springStep(P.hipZ, dt, FREQ.hip, DAMP.hip);
  springStep(P.hipX, dt, FREQ.hip, DAMP.hip);
  /* Bras */
  springStep(P.lAZ, dt, FREQ.arm,   DAMP.arm);
  springStep(P.rAZ, dt, FREQ.arm,   DAMP.arm);
  springStep(P.lAX, dt, FREQ.arm,   DAMP.arm);
  springStep(P.rAX, dt, FREQ.arm,   DAMP.arm);
  /* Coudes */
  springStep(P.lEZ, dt, FREQ.elbow, DAMP.elbow);
  springStep(P.rEZ, dt, FREQ.elbow, DAMP.elbow);
  /* Cuisses */
  springStep(P.lLZ, dt, FREQ.hip,   DAMP.hip);
  springStep(P.rLZ, dt, FREQ.hip,   DAMP.hip);
  springStep(P.lLX, dt, FREQ.hip,   DAMP.hip);
  springStep(P.rLX, dt, FREQ.hip,   DAMP.hip);
  /* Expressions */
  springStep(P.blink, dt, FREQ.blink, DAMP.blink);
  springStep(P.mouth, dt, FREQ.mouth, DAMP.mouth);
  springStep(P.happy, dt, FREQ.expr,  DAMP.expr);
  springStep(P.angry, dt, FREQ.expr,  DAMP.expr);
  springStep(P.sad,   dt, FREQ.expr,  DAMP.expr);

  /* ── Écriture dans les os ─────────────────────────────────────────────── */
  var hd  = getBone('head');
  var nk  = getBone('neck');
  var sp  = getBone('upperChest') || getBone('chest') || getBone('spine');
  var hip = getBone('hips');
  var lUA = getBone('leftUpperArm'),  rUA = getBone('rightUpperArm');
  var lLA = getBone('leftLowerArm'),  rLA = getBone('rightLowerArm');
  var lUL = getBone('leftUpperLeg'),  rUL = getBone('rightUpperLeg');

  if (hd)  { hd.rotation.x = P.hX.cur;   hd.rotation.y = P.hY.cur;   hd.rotation.z = P.hZ.cur; }
  if (nk)  { nk.rotation.x = P.nX.cur;   nk.rotation.y = P.nY.cur; }
  if (sp)  { sp.rotation.x = P.sX.cur;   sp.rotation.z = P.sZ.cur; }
  if (hip) { hip.rotation.z = P.hipZ.cur; hip.rotation.x = P.hipX.cur; }
  if (lUA) { lUA.rotation.z = P.lAZ.cur; lUA.rotation.x = P.lAX.cur; }
  if (rUA) { rUA.rotation.z = P.rAZ.cur; rUA.rotation.x = P.rAX.cur; }
  if (lLA) { lLA.rotation.z = P.lEZ.cur; }
  if (rLA) { rLA.rotation.z = P.rEZ.cur; }
  if (lUL) { lUL.rotation.z = P.lLZ.cur; lUL.rotation.x = P.lLX.cur; }
  if (rUL) { rUL.rotation.z = P.rLZ.cur; rUL.rotation.x = P.rLX.cur; }

  /* ── Expressions ──────────────────────────────────────────────────────── */
  setExpr('blink', clamp01(P.blink.cur));
  setExpr('mouth', clamp01(P.mouth.cur));
  setExpr('happy', clamp01(P.happy.cur));
  setExpr('angry', clamp01(P.angry.cur));
  setExpr('sad',   clamp01(P.sad.cur));
}

function clamp01(v) { return Math.max(0, Math.min(1, v)); }

/* ═══════════════════════════════════════════════════════════════════════════
   LIP SYNC
   ═══════════════════════════════════════════════════════════════════════════ */
var lipInterval = null;

function startLipSync() {
  if (lipInterval) return;
  lipInterval = setInterval(function () {
    if (!lipOn) { P.mouth.tgt = 0; return; }
    var r = Math.random();
    if      (r < 0.18) P.mouth.tgt = 0.04 + Math.random() * 0.08;
    else if (r < 0.52) P.mouth.tgt = 0.25 + Math.random() * 0.32;
    else if (r < 0.83) P.mouth.tgt = 0.58 + Math.random() * 0.35;
    else               P.mouth.tgt = 0;
  }, 75 + Math.random() * 65);
}

function stopLipSync() {
  clearInterval(lipInterval);
  lipInterval = null;
  P.mouth.tgt = 0;
}

/* ═══════════════════════════════════════════════════════════════════════════
   BOUCLE PRINCIPALE
   ═══════════════════════════════════════════════════════════════════════════ */
function startLoop(THREE) {
  var gm = scene.children.find(function (c) { return c.userData && c.userData.pulse !== undefined; });
  function tick() {
    raf = requestAnimationFrame(tick);
    var dt = Math.min(clock.getDelta(), 0.05);
    T += dt;
    tick_procedural(dt);
    tick_state(dt);
    tick_apply(dt);
    /* Glow pulsant au sol */
    if (gm && gm.material) {
      gm.material.opacity = 0.76 + Math.sin(T * 1.6) * 0.14;
      var sc = 0.94 + Math.sin(T * 0.95) * 0.06;
      gm.scale.set(sc, 1, sc);
    }
    vrm.update(dt);
    R.render(scene, cam);
  }
  tick();
}

/* ═══════════════════════════════════════════════════════════════════════════
   ENTRÉE / CHARGEMENT
   ═══════════════════════════════════════════════════════════════════════════ */
function create(containerId) {
  var wrap = document.getElementById(containerId);
  if (!wrap) return;
  wrap.innerHTML = buildHTML();
  spawnParticles();
  loadVRM();
}

async function loadVRM() {
  var container = document.getElementById('vrmContainer');
  if (!container) return;

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

  try {
    R = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  } catch (e) { fallback(); return; }

  var W = container.offsetWidth  || 300;
  var H = container.offsetHeight || 520;

  R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  R.setSize(W, H);
  R.outputColorSpace = THREE.SRGBColorSpace;
  R.setClearColor(0x000000, 0);
  Object.assign(R.domElement.style, {
    position: 'absolute', bottom: '0', left: '50%',
    transform: 'translateX(-50%)', zIndex: '1'
  });
  container.appendChild(R.domElement);

  scene = new THREE.Scene();
  clock = new THREE.Clock();

  /* Caméra : angle bas, cadrage corps entier */
  cam = new THREE.PerspectiveCamera(32, W / H, 0.1, 20);
  cam.position.set(0, 0.60, 3.6);
  cam.lookAt(0, 0.90, 0);

  /* Éclairage */
  scene.add(new THREE.AmbientLight(0xffffff, 1.0));
  var key = new THREE.DirectionalLight(0xffffff, 1.5);
  key.position.set(0.8, 2.5, 2); scene.add(key);
  var fill = new THREE.DirectionalLight(0xb0d8ff, 0.55);
  fill.position.set(-1.5, 1, 1); scene.add(fill);
  var rim = new THREE.PointLight(0x00d4ff, 2.0, 5);
  rim.position.set(-0.8, 2.0, -0.9); scene.add(rim);
  var rim2 = new THREE.PointLight(0x8b5cf6, 0.9, 3.5);
  rim2.position.set(1, 1.2, -0.6); scene.add(rim2);

  /* Halo au sol */
  var gc_ = document.createElement('canvas');
  gc_.width = gc_.height = 256;
  var gc = gc_.getContext('2d');
  var gg = gc.createRadialGradient(128, 128, 0, 128, 128, 128);
  gg.addColorStop(0,    'rgba(0,212,255,0.95)');
  gg.addColorStop(0.25, 'rgba(0,212,255,0.65)');
  gg.addColorStop(0.55, 'rgba(0,212,255,0.22)');
  gg.addColorStop(1,    'rgba(0,212,255,0)');
  gc.fillStyle = gg; gc.fillRect(0, 0, 256, 256);
  var glowTex  = new THREE.CanvasTexture(gc_);
  var glowMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.85, 0.85),
    new THREE.MeshBasicMaterial({
      map: glowTex, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide
    })
  );
  glowMesh.rotation.x = -Math.PI / 2;
  glowMesh.position.set(0, 0.008, 0);
  glowMesh.userData.pulse = 0;
  scene.add(glowMesh);

  window.addEventListener('resize', function () {
    if (!R || !container) return;
    var nW = container.offsetWidth, nH = container.offsetHeight;
    if (!nW || !nH) return;
    R.setSize(nW, nH); cam.aspect = nW / nH; cam.updateProjectionMatrix();
  });

  var loadEl   = document.getElementById('evaLoading');
  var loadSpan = loadEl && loadEl.querySelector('span');

  var loader = new GLTFLoader();
  loader.register(function (p) { return new VRMLoaderPlugin(p); });

  loader.load(MODEL_PATH,
    function onLoad(gltf) {
      vrm = gltf.userData.vrm;
      if (!vrm) { console.error('[EVA] no VRM in userData'); fallback(); return; }

      try { VRMUtils.removeUnnecessaryVertices(gltf.scene); } catch (_) {}
      try { VRMUtils.combineSkeletons(gltf.scene);          } catch (_) {}

      /* VRM0 regarde -Z → pivoter pour faire face caméra */
      try {
        var ver = vrm.meta && (vrm.meta.metaVersion || vrm.meta.specVersion || '0');
        if (String(ver)[0] === '0') vrm.scene.rotation.y = Math.PI;
      } catch (_) {}

      scene.add(vrm.scene);

      var exprs = vrm.expressionManager
        ? Object.keys(vrm.expressionManager.expressionMap || {})
        : [];
      console.log('[EVA v5] Expressions:', exprs.join(', ') || 'none');
      console.log('[EVA v5] Model loaded — spring animation engine active');

      applyRestPose();

      loaded = true;
      if (loadEl) loadEl.style.display = 'none';
      setStatus('idle');
      wSide  = Math.random() > 0.5 ? 1 : -1;
      wTimer = 6 + Math.random() * 6;
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

/* Pose A naturelle : bras pendants */
function applyRestPose() {
  setBone('leftUpperArm',  { z: -1.50, x: 0, y: 0 });
  setBone('rightUpperArm', { z:  1.50, x: 0, y: 0 });
  setBone('leftLowerArm',  { z: -0.08 });
  setBone('rightLowerArm', { z:  0.08 });
  vrm.update(0);
}

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS BONES & EXPRESSIONS
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
  blink: ['blink','Blink','blinkLeft','BlinkL','blink_L','BLINK'],
  mouth: ['aa','A','a','Aa','open','Open'],
  happy: ['happy','Joy','joy','Happy','smile','Smile'],
  angry: ['angry','Angry','frown','Frown'],
  sad:   ['sad','Sorrow','sorrow','Sad'],
  sur:   ['surprised','Surprised','surprise']
};

function setExpr(key, val) {
  if (!vrm || !vrm.expressionManager) return;
  var mgr  = vrm.expressionManager;
  var map  = mgr.expressionMap || {};
  var names = EMAP[key] || [key];
  for (var i = 0; i < names.length; i++) {
    var n = names[i];
    if (map[n]               !== undefined) { try { mgr.setValue(n, val); return; } catch (_) {} }
    if (map[n.toLowerCase()] !== undefined) { try { mgr.setValue(n.toLowerCase(), val); return; } catch (_) {} }
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   API PUBLIQUE — états
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

function setIdle()      { if (!loaded) return; setStatus('idle'); lipOn = false; stopLipSync(); }
function setListening() { if (!loaded) return; setStatus('listening'); lipOn = false; stopLipSync(); }
function setThinking()  { if (!loaded) return; setStatus('thinking'); lipOn = false; stopLipSync(); }
function setHappy()     { if (!loaded) return; setStatus('happy'); }

function startTalking() {
  if (!loaded) return;
  setStatus('talking');
  lipOn = true;
  startLipSync();
}

function stopTalking() {
  if (!loaded) return;
  lipOn = false;
  stopLipSync();
  setStatus('idle');
}

/* ═══════════════════════════════════════════════════════════════════════════
   FALLBACK — WebGL non disponible
   ═══════════════════════════════════════════════════════════════════════════ */
function fallback() {
  var el = document.getElementById('evaLoading');
  if (el) el.innerHTML = '<span style="color:rgba(0,212,255,.5);font-family:monospace;font-size:.65em;letter-spacing:3px;text-align:center;display:block">EVA<br>ONLINE</span>';
}

/* ═══════════════════════════════════════════════════════════════════════════
   PARTICULES
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
  background:radial-gradient(ellipse,rgba(0,212,255,0.12) 0%,transparent 70%);
  animation:evaGlow 4s ease-in-out infinite;
}
@keyframes evaGlow{
  0%,100%{opacity:.4;transform:translateX(-50%) scaleX(1);}
  50%{opacity:.85;transform:translateX(-50%) scaleX(1.30);}
}
.eva-particles{position:absolute;inset:0;pointer-events:none;z-index:0;overflow:hidden;}
.eva-p{position:absolute;border-radius:50%;animation:evaP linear infinite;opacity:0;}
@keyframes evaP{
  0%{opacity:0;transform:translateY(0) scale(0);}
  8%{opacity:.50;}90%{opacity:.12;}
  100%{opacity:0;transform:translateY(-110px) scale(1.8);}
}
.eva-scan{
  position:absolute;left:0;right:0;height:1px;z-index:5;pointer-events:none;
  background:linear-gradient(90deg,transparent,rgba(0,212,255,.25),transparent);
  animation:evaScan 10s ease-in-out infinite;
}
@keyframes evaScan{
  0%{top:-2px;opacity:0;}5%{opacity:1;}
  95%{opacity:.3;}100%{top:100%;opacity:0;}
}
#evaLoading{
  position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  flex-direction:column;gap:10px;z-index:10;
}
#evaLoading span{
  font-size:.62em;color:rgba(0,212,255,.65);font-family:'Space Mono',monospace;
  letter-spacing:4px;text-transform:uppercase;text-align:center;
}
.eva-load-bar{
  width:80px;height:2px;background:rgba(0,212,255,.15);border-radius:2px;overflow:hidden;
}
.eva-load-fill{
  height:100%;width:0%;background:var(--cyan,#00d4ff);border-radius:2px;
  animation:evaLoadFill 2s ease-in-out infinite alternate;
}
@keyframes evaLoadFill{0%{width:10%;}100%{width:90%;}}
.eva-status{
  position:absolute;bottom:4px;left:0;right:0;
  display:flex;align-items:center;justify-content:center;gap:5px;
  font-size:.52em;color:rgba(0,212,255,.5);font-family:'Space Mono',monospace;
  letter-spacing:3px;text-transform:uppercase;z-index:6;
}
.eva-status-dot{
  width:5px;height:5px;border-radius:50%;background:rgba(0,212,255,.4);
  animation:evaDot 3s ease-in-out infinite;
}
.eva-status.talking .eva-status-dot{background:#00d4ff;animation:evaDotTalk .35s ease-in-out infinite alternate;}
.eva-status.listening .eva-status-dot{background:#b794f6;animation:evaDot 1.1s ease-in-out infinite;}
.eva-status.thinking .eva-status-dot{background:#fbbf24;animation:evaDot 1.8s ease-in-out infinite;}
@keyframes evaDot{0%,100%{opacity:.35;transform:scale(1);}50%{opacity:.9;transform:scale(1.4);}}
@keyframes evaDotTalk{0%{transform:scaleY(0.5);}100%{transform:scaleY(1.6);}}
</style>
<div id="evaWrap">
  <div class="eva-bg-glow"></div>
  <div id="evaParticles" class="eva-particles"></div>
  <div class="eva-scan"></div>
  <div id="vrmContainer"></div>
  <div id="evaLoading">
    <span id="evaLoadTxt">INITIALISATION...</span>
    <div class="eva-load-bar"><div class="eva-load-fill"></div></div>
  </div>
  <div class="eva-status" id="evaStatusBar">
    <div class="eva-status-dot"></div>
    <span id="evaStatusTxt">EN LIGNE</span>
  </div>
</div>`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   EXPORT
   ═══════════════════════════════════════════════════════════════════════════ */
window.EvaCharacter = {
  create,
  setIdle, setListening, setThinking, setHappy,
  startTalking, stopTalking,
  isLoaded: function () { return loaded; }
};

})();
