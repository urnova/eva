(function() {
'use strict';

var state = 'idle'; // idle | talking | thinking | happy | listening
var blinkTimer = null;
var talkTimer = null;
var mouthOpen = false;

function create(containerId) {
  var container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
<style>
#evaCharacterWrap {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  overflow: hidden;
}
#evaCharacterSVG {
  width: 240px;
  height: 360px;
  animation: evaFloat 4s ease-in-out infinite;
  filter: drop-shadow(0 20px 40px rgba(0,212,255,0.3));
  position: relative;
  z-index: 2;
  transition: transform 0.3s ease;
}
#evaCharacterSVG.talking { animation: evaFloat 4s ease-in-out infinite, evaTalkShake 0.15s ease-in-out infinite alternate; }
#evaCharacterSVG.thinking { animation: evaFloat 4s ease-in-out infinite, evaThink 0.8s ease-in-out infinite; }
#evaCharacterSVG.happy { animation: evaHappy 0.5s ease-in-out 3, evaFloat 4s ease-in-out 3s infinite; }
#evaCharacterSVG.listening { filter: drop-shadow(0 20px 40px rgba(0,255,136,0.4)); }

@keyframes evaFloat {
  0%,100% { transform: translateY(0px); }
  50% { transform: translateY(-12px); }
}
@keyframes evaTalkShake {
  from { transform: translateY(var(--float-offset, 0px)) rotate(-0.3deg); }
  to { transform: translateY(var(--float-offset, -6px)) rotate(0.3deg); }
}
@keyframes evaThink {
  0%,100% { transform: translateY(0px) rotate(0deg); }
  50% { transform: translateY(-8px) rotate(-2deg); }
}
@keyframes evaHappy {
  0%,100% { transform: translateY(0px) scale(1); }
  25% { transform: translateY(-20px) scale(1.05); }
  75% { transform: translateY(-5px) scale(0.98); }
}

/* Glow orb behind character */
.eva-glow-orb {
  position: absolute;
  width: 200px;
  height: 200px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(0,212,255,0.15) 0%, transparent 70%);
  bottom: 60px;
  left: 50%;
  transform: translateX(-50%);
  animation: orbPulse 3s ease-in-out infinite;
  z-index: 1;
}
@keyframes orbPulse {
  0%,100% { opacity: 0.6; transform: translateX(-50%) scale(1); }
  50% { opacity: 1; transform: translateX(-50%) scale(1.2); }
}

/* Ground shadow */
.eva-shadow {
  width: 120px;
  height: 20px;
  background: radial-gradient(ellipse, rgba(0,212,255,0.3) 0%, transparent 70%);
  border-radius: 50%;
  position: absolute;
  bottom: 5px;
  left: 50%;
  transform: translateX(-50%);
  animation: shadowPulse 4s ease-in-out infinite;
  z-index: 1;
}
@keyframes shadowPulse {
  0%,100% { opacity: 0.8; transform: translateX(-50%) scaleX(1); }
  50% { opacity: 0.4; transform: translateX(-50%) scaleX(0.7); }
}

/* Floating particles */
.eva-particles {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}
.eva-particle {
  position: absolute;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #00d4ff;
  animation: particleFloat linear infinite;
  opacity: 0;
}
@keyframes particleFloat {
  0% { opacity: 0; transform: translateY(0) scale(0); }
  10% { opacity: 1; }
  90% { opacity: 1; }
  100% { opacity: 0; transform: translateY(-120px) scale(1.5); }
}

/* Status bar below character */
.eva-status-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  background: rgba(0,212,255,0.08);
  border: 1px solid rgba(0,212,255,0.2);
  border-radius: 20px;
  font-family: 'Space Mono', monospace;
  font-size: 0.72em;
  color: rgba(0,212,255,0.8);
  letter-spacing: 2px;
  text-transform: uppercase;
  margin-top: 8px;
  z-index: 3;
  transition: all 0.3s ease;
}
.eva-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #00d4ff;
  animation: dotPulse 1.5s ease-in-out infinite;
}
@keyframes dotPulse {
  0%,100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.7); }
}
.eva-status-bar.talking .eva-status-dot { background: #00ff88; animation: dotPulse 0.3s ease-in-out infinite; }
.eva-status-bar.listening .eva-status-dot { background: #00ff88; animation: dotPulse 0.5s ease-in-out infinite; }
.eva-status-bar.thinking .eva-status-dot { background: #b794f6; animation: dotPulse 1s ease-in-out infinite; }
</style>

<div id="evaCharacterWrap">
  <div class="eva-particles" id="evaParticles"></div>
  <div class="eva-glow-orb"></div>

  <svg id="evaCharacterSVG" viewBox="0 0 240 360" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <!-- Glow filters -->
      <filter id="evaGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur"/>
        <feComposite in="SourceGraphic" in2="blur" operator="over"/>
      </filter>
      <filter id="eyeGlow" x="-100%" y="-100%" width="300%" height="300%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur"/>
        <feComposite in="SourceGraphic" in2="blur" operator="over"/>
      </filter>
      <filter id="hairGlow">
        <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur"/>
        <feComposite in="SourceGraphic" in2="blur" operator="over"/>
      </filter>
      <!-- Skin gradient -->
      <linearGradient id="skinGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#f5e0c8"/>
        <stop offset="100%" stop-color="#e8c9a8"/>
      </linearGradient>
      <!-- Hair gradient -->
      <linearGradient id="hairGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#12121f"/>
        <stop offset="100%" stop-color="#0a0a1a"/>
      </linearGradient>
      <!-- Outfit gradient -->
      <linearGradient id="outfitGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#0c1628"/>
        <stop offset="100%" stop-color="#060d1a"/>
      </linearGradient>
      <!-- Outfit accent -->
      <linearGradient id="accentGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#00d4ff" stop-opacity="0"/>
        <stop offset="50%" stop-color="#00d4ff"/>
        <stop offset="100%" stop-color="#00d4ff" stop-opacity="0"/>
      </linearGradient>
      <!-- Eye gradient -->
      <radialGradient id="eyeGrad" cx="50%" cy="40%" r="50%">
        <stop offset="0%" stop-color="#a0e8ff"/>
        <stop offset="60%" stop-color="#00aaff"/>
        <stop offset="100%" stop-color="#0060cc"/>
      </radialGradient>
    </defs>

    <!-- ═══ BODY / OUTFIT ═══ -->
    <!-- Torso base -->
    <path d="M72 230 Q72 215 80 210 L120 205 L160 210 Q168 215 168 230 L172 360 L68 360 Z" fill="url(#outfitGrad)" stroke="#00d4ff" stroke-width="0.5" stroke-opacity="0.3"/>
    <!-- Collar / neckline tech -->
    <path d="M95 212 Q120 220 145 212" fill="none" stroke="#00d4ff" stroke-width="1" opacity="0.7"/>
    <!-- Tech line on chest -->
    <path d="M90 240 Q120 235 150 240" fill="none" stroke="url(#accentGrad)" stroke-width="1.5" opacity="0.6"/>
    <path d="M85 255 Q120 250 155 255" fill="none" stroke="url(#accentGrad)" stroke-width="1" opacity="0.4"/>
    <!-- Glowing chest gem -->
    <ellipse cx="120" cy="247" rx="6" ry="4" fill="#00d4ff" opacity="0.2"/>
    <ellipse cx="120" cy="247" rx="3" ry="2" fill="#00d4ff" opacity="0.8"/>
    <ellipse cx="120" cy="247" rx="3" ry="2" fill="#00d4ff" filter="url(#evaGlow)"/>
    <!-- Shoulder pads -->
    <path d="M68 220 Q60 215 58 228 Q60 240 72 235 L72 220 Z" fill="url(#outfitGrad)" stroke="#00d4ff" stroke-width="0.5" stroke-opacity="0.5"/>
    <path d="M172 220 Q180 215 182 228 Q180 240 168 235 L168 220 Z" fill="url(#outfitGrad)" stroke="#00d4ff" stroke-width="0.5" stroke-opacity="0.5"/>
    <!-- Shoulder glow lines -->
    <path d="M60 225 L70 228" stroke="#00d4ff" stroke-width="1" opacity="0.5"/>
    <path d="M180 225 L170 228" stroke="#00d4ff" stroke-width="1" opacity="0.5"/>
    <!-- Arms -->
    <rect x="55" y="228" width="18" height="80" rx="9" fill="url(#skinGrad)"/>
    <rect x="167" y="228" width="18" height="80" rx="9" fill="url(#skinGrad)"/>
    <!-- Arm sleeves overlay -->
    <rect x="55" y="228" width="18" height="50" rx="9" fill="url(#outfitGrad)" opacity="0.85" stroke="#00d4ff" stroke-width="0.5" stroke-opacity="0.3"/>
    <rect x="167" y="228" width="18" height="50" rx="9" fill="url(#outfitGrad)" opacity="0.85" stroke="#00d4ff" stroke-width="0.5" stroke-opacity="0.3"/>
    <!-- Wrist tech bands -->
    <rect x="54" y="274" width="20" height="5" rx="2" fill="#00d4ff" opacity="0.4"/>
    <rect x="166" y="274" width="20" height="5" rx="2" fill="#00d4ff" opacity="0.4"/>
    <!-- Hands -->
    <ellipse cx="64" cy="315" rx="9" ry="11" fill="url(#skinGrad)"/>
    <ellipse cx="176" cy="315" rx="9" ry="11" fill="url(#skinGrad)"/>

    <!-- ═══ NECK ═══ -->
    <rect x="109" y="195" width="22" height="20" rx="8" fill="url(#skinGrad)"/>

    <!-- ═══ HEAD ═══ -->
    <!-- Head base -->
    <ellipse cx="120" cy="155" rx="52" ry="58" fill="url(#skinGrad)"/>
    <!-- Ear left -->
    <ellipse cx="69" cy="155" rx="8" ry="11" fill="url(#skinGrad)"/>
    <!-- Ear right -->
    <ellipse cx="171" cy="155" rx="8" ry="11" fill="url(#skinGrad)"/>
    <!-- Ear inner -->
    <ellipse cx="69" cy="155" rx="4" ry="6" fill="#d4b08a" opacity="0.5"/>
    <ellipse cx="171" cy="155" rx="4" ry="6" fill="#d4b08a" opacity="0.5"/>
    <!-- Earring - tech style -->
    <circle cx="171" cy="162" r="3" fill="#00d4ff" opacity="0.9"/>
    <circle cx="171" cy="162" r="3" fill="#00d4ff" filter="url(#evaGlow)"/>
    <circle cx="69" cy="162" r="3" fill="#00d4ff" opacity="0.9"/>

    <!-- ═══ HAIR - BACK LAYER ═══ -->
    <!-- Back hair base (behind head) -->
    <path d="M78 115 Q75 80 85 65 Q100 50 120 48 Q140 50 155 65 Q165 80 162 115" fill="url(#hairGrad)"/>
    <!-- Side hair left (long strand) -->
    <path d="M72 130 Q60 160 62 200 Q65 220 72 228" fill="url(#hairGrad)" stroke="#0a0a1a" stroke-width="1"/>
    <!-- Side hair right (long strand) -->
    <path d="M168 130 Q180 160 178 200 Q175 220 168 228" fill="url(#hairGrad)" stroke="#0a0a1a" stroke-width="1"/>

    <!-- ═══ HAIR - FRONT / TOP ═══ -->
    <!-- Main top hair -->
    <path d="M80 118 Q82 90 90 75 Q105 58 120 56 Q135 58 150 75 Q158 90 160 118 Q145 105 120 103 Q95 105 80 118 Z" fill="url(#hairGrad)"/>
    <!-- Bangs left side -->
    <path d="M80 118 Q72 130 70 148 Q75 135 88 128 Z" fill="#12121f"/>
    <!-- Bangs right -->
    <path d="M160 118 Q168 130 170 148 Q165 135 152 128 Z" fill="#12121f"/>
    <!-- Front fringe / bangs center -->
    <path d="M92 110 Q98 120 96 135 Q100 118 108 112 Z" fill="#12121f"/>
    <path d="M148 110 Q142 120 144 135 Q140 118 132 112 Z" fill="#12121f"/>
    <path d="M108 106 Q112 128 110 142 Q116 120 120 108 Q124 120 130 142 Q128 128 132 106 Q126 102 120 102 Q114 102 108 106 Z" fill="#12121f"/>

    <!-- Cyan hair highlight streaks -->
    <path d="M88 78 Q92 72 98 68" stroke="#00d4ff" stroke-width="2" fill="none" opacity="0.7" stroke-linecap="round"/>
    <path d="M100 65 Q108 61 118 60" stroke="#00d4ff" stroke-width="1.5" fill="none" opacity="0.5" stroke-linecap="round"/>
    <path d="M72 140 Q68 165 70 185" stroke="#00aad4" stroke-width="1.5" fill="none" opacity="0.4" stroke-linecap="round"/>
    <!-- Hair accessory - small tech clip -->
    <rect x="136" y="85" width="12" height="6" rx="3" fill="#00d4ff" opacity="0.6"/>
    <rect x="136" y="85" width="12" height="6" rx="3" fill="#00d4ff" filter="url(#evaGlow)"/>

    <!-- ═══ FACE FEATURES ═══ -->
    <!-- Eyebrows -->
    <path d="M91 127 Q100 121 112 122" fill="none" stroke="#2a1a2e" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M128 122 Q140 121 149 127" fill="none" stroke="#2a1a2e" stroke-width="2.5" stroke-linecap="round"/>

    <!-- ═══ EYES ═══ -->
    <!-- Eye left - white -->
    <ellipse id="eyeLeftWhite" cx="102" cy="145" rx="14" ry="11" fill="white"/>
    <!-- Eye right - white -->
    <ellipse id="eyeRightWhite" cx="138" cy="145" rx="14" ry="11" fill="white"/>
    <!-- Eye left - iris -->
    <ellipse id="eyeLeft" cx="102" cy="146" rx="9" ry="9" fill="url(#eyeGrad)"/>
    <!-- Eye right - iris -->
    <ellipse id="eyeRight" cx="138" cy="146" rx="9" ry="9" fill="url(#eyeGrad)"/>
    <!-- Eye left - pupil -->
    <circle cx="102" cy="147" r="4.5" fill="#001040"/>
    <circle cx="138" cy="147" r="4.5" fill="#001040"/>
    <!-- Eye shine highlight -->
    <circle cx="105" cy="143" r="2.5" fill="white" opacity="0.9"/>
    <circle cx="141" cy="143" r="2.5" fill="white" opacity="0.9"/>
    <circle cx="99" cy="148" r="1" fill="white" opacity="0.5"/>
    <circle cx="135" cy="148" r="1" fill="white" opacity="0.5"/>
    <!-- Eye glow inner -->
    <ellipse cx="102" cy="146" rx="9" ry="9" fill="#00d4ff" opacity="0.12" filter="url(#eyeGlow)"/>
    <ellipse cx="138" cy="146" rx="9" ry="9" fill="#00d4ff" opacity="0.12" filter="url(#eyeGlow)"/>
    <!-- Eyelashes top -->
    <path d="M88 138 Q95 133 116 136" fill="none" stroke="#0a0a1a" stroke-width="2" stroke-linecap="round"/>
    <path d="M124 136 Q145 133 152 138" fill="none" stroke="#0a0a1a" stroke-width="2" stroke-linecap="round"/>
    <!-- Lower lash line -->
    <path d="M89 153 Q95 157 115 156" fill="none" stroke="#0a0a1a" stroke-width="1" stroke-linecap="round" opacity="0.5"/>
    <path d="M125 156 Q145 157 151 153" fill="none" stroke="#0a0a1a" stroke-width="1" stroke-linecap="round" opacity="0.5"/>

    <!-- ═══ NOSE ═══ -->
    <path d="M117 160 Q120 168 123 160" fill="none" stroke="#d4b08a" stroke-width="1.5" stroke-linecap="round" opacity="0.6"/>
    <!-- Slight blush -->
    <ellipse cx="90" cy="162" rx="10" ry="5" fill="#ffaaaa" opacity="0.2"/>
    <ellipse cx="150" cy="162" rx="10" ry="5" fill="#ffaaaa" opacity="0.2"/>

    <!-- ═══ MOUTH ═══ -->
    <!-- Mouth group (animated for talking) -->
    <g id="evaMouth">
      <!-- Closed smile (default) -->
      <path id="mouthSmile" d="M107 176 Q120 184 133 176" fill="none" stroke="#c4748c" stroke-width="2" stroke-linecap="round"/>
      <!-- Open mouth (talking) - hidden by default -->
      <g id="mouthOpen" display="none">
        <path d="M109 175 Q120 180 131 175" fill="#8a2040"/>
        <path d="M109 175 Q120 186 131 175 Q120 182 109 175 Z" fill="#3a0520"/>
        <!-- Teeth -->
        <path d="M110 177 Q120 179 130 177" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" opacity="0.9"/>
      </g>
    </g>

    <!-- ═══ TECH ELEMENTS ═══ -->
    <!-- HUD/visor hint line (subtle) -->
    <!-- Headset earpiece left -->
    <rect x="63" y="149" rx="2" ry="2" width="8" height="14" fill="#0c1628" stroke="#00d4ff" stroke-width="0.5"/>
    <rect x="64" y="153" rx="1" ry="1" width="6" height="5" fill="#00d4ff" opacity="0.3"/>
    <!-- Subtle circuit lines on neck -->
    <path d="M110 198 L110 208 L115 208 L115 213" fill="none" stroke="#00d4ff" stroke-width="0.5" opacity="0.3"/>
    <path d="M130 198 L130 208 L125 208 L125 213" fill="none" stroke="#00d4ff" stroke-width="0.5" opacity="0.3"/>

    <!-- ═══ HOLOGRAPHIC ELEMENTS ═══ -->
    <!-- Data lines floating left -->
    <g opacity="0.4" filter="url(#evaGlow)">
      <rect x="20" y="180" width="30" height="1.5" rx="1" fill="#00d4ff">
        <animate attributeName="opacity" values="0;0.8;0" dur="2s" repeatCount="indefinite" begin="0s"/>
      </rect>
      <rect x="15" y="190" width="20" height="1" rx="1" fill="#00d4ff">
        <animate attributeName="opacity" values="0;0.6;0" dur="2s" repeatCount="indefinite" begin="0.5s"/>
      </rect>
      <rect x="18" y="200" width="25" height="1" rx="1" fill="#00d4ff">
        <animate attributeName="opacity" values="0;0.5;0" dur="2.5s" repeatCount="indefinite" begin="1s"/>
      </rect>
    </g>
    <!-- Data lines floating right -->
    <g opacity="0.4" filter="url(#evaGlow)">
      <rect x="190" y="180" width="30" height="1.5" rx="1" fill="#00d4ff">
        <animate attributeName="opacity" values="0;0.8;0" dur="2.2s" repeatCount="indefinite" begin="0.3s"/>
      </rect>
      <rect x="205" y="190" width="20" height="1" rx="1" fill="#00d4ff">
        <animate attributeName="opacity" values="0;0.6;0" dur="1.8s" repeatCount="indefinite" begin="0.8s"/>
      </rect>
      <rect x="200" y="200" width="25" height="1" rx="1" fill="#00d4ff">
        <animate attributeName="opacity" values="0;0.5;0" dur="2.5s" repeatCount="indefinite" begin="0.2s"/>
      </rect>
    </g>
  </svg>

  <div class="eva-shadow"></div>
  <div class="eva-status-bar" id="evaStatusBar">
    <div class="eva-status-dot"></div>
    <span id="evaStatusText">EN LIGNE</span>
  </div>
</div>
  `;

  // Create floating particles
  createParticles();
  // Start blink loop
  startBlinkLoop();
}

function createParticles() {
  var p = document.getElementById('evaParticles');
  if (!p) return;
  for (var i = 0; i < 12; i++) {
    var el = document.createElement('div');
    el.className = 'eva-particle';
    el.style.left = (30 + Math.random() * 180) + 'px';
    el.style.bottom = (40 + Math.random() * 200) + 'px';
    el.style.animationDuration = (3 + Math.random() * 4) + 's';
    el.style.animationDelay = (Math.random() * 4) + 's';
    el.style.width = el.style.height = (1.5 + Math.random() * 2.5) + 'px';
    el.style.opacity = (0.3 + Math.random() * 0.5).toString();
    p.appendChild(el);
  }
}

function startBlinkLoop() {
  function blink() {
    var eL = document.getElementById('eyeLeft');
    var eR = document.getElementById('eyeRight');
    var eLW = document.getElementById('eyeLeftWhite');
    var eRW = document.getElementById('eyeRightWhite');
    if (!eL) return;
    // Quick blink
    [eL, eR, eLW, eRW].forEach(function(el) {
      if (el) { el.style.transform = 'scaleY(0.05)'; el.style.transition = 'transform 0.06s'; }
    });
    setTimeout(function() {
      [eL, eR, eLW, eRW].forEach(function(el) {
        if (el) { el.style.transform = 'scaleY(1)'; el.style.transition = 'transform 0.1s'; }
      });
    }, 100);
    // Schedule next blink
    var next = 2500 + Math.random() * 3000;
    blinkTimer = setTimeout(blink, next);
  }
  blinkTimer = setTimeout(blink, 2000);
}

function startTalking() {
  if (state === 'talking') return;
  setState('talking');
  var svg = document.getElementById('evaCharacterSVG');
  if (svg) svg.className = 'talking';
  var smile = document.getElementById('mouthSmile');
  var open = document.getElementById('mouthOpen');
  if (smile) smile.style.display = 'none';
  if (open) open.style.display = '';
  // Animate mouth opening/closing rapidly
  function toggleMouth() {
    if (state !== 'talking') return;
    mouthOpen = !mouthOpen;
    if (open) {
      open.style.transform = mouthOpen ? 'scaleY(1)' : 'scaleY(0.3)';
      open.style.transformOrigin = 'center top';
      open.style.transition = 'transform 0.1s';
    }
    talkTimer = setTimeout(toggleMouth, 120 + Math.random() * 80);
  }
  toggleMouth();
  setStatus('talking', 'EN LIGNE');
}

function stopTalking() {
  if (state === 'idle') return;
  setState('idle');
  if (talkTimer) { clearTimeout(talkTimer); talkTimer = null; }
  var svg = document.getElementById('evaCharacterSVG');
  if (svg) svg.className = '';
  var smile = document.getElementById('mouthSmile');
  var open = document.getElementById('mouthOpen');
  if (smile) smile.style.display = '';
  if (open) open.style.display = 'none';
  setStatus('idle', 'EN LIGNE');
}

function setThinking() {
  setState('thinking');
  var svg = document.getElementById('evaCharacterSVG');
  if (svg) svg.className = 'thinking';
  setStatus('thinking', 'TRAITEMENT...');
}

function setListening() {
  setState('listening');
  var svg = document.getElementById('evaCharacterSVG');
  if (svg) svg.className = 'listening';
  setStatus('listening', "J'ECOUTE...");
}

function setHappy() {
  setState('happy');
  var svg = document.getElementById('evaCharacterSVG');
  if (svg) {
    svg.className = 'happy';
    setTimeout(function() { if (state === 'happy') { setState('idle'); svg.className = ''; setStatus('idle', 'EN LIGNE'); } }, 1500);
  }
}

function setIdle() {
  stopTalking();
}

function setState(s) { state = s; }
function getState() { return state; }

function setStatus(s, text) {
  var bar = document.getElementById('evaStatusBar');
  var txt = document.getElementById('evaStatusText');
  if (bar) bar.className = 'eva-status-bar ' + s;
  if (txt) txt.textContent = text;
}

window.EvaCharacter = { create, startTalking, stopTalking, setThinking, setListening, setHappy, setIdle, getState };
})();
