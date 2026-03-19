(function() {
'use strict';

var state = 'idle';
var blinkTimer = null;
var talkTimer = null;
var emotionTimer = null;

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

#evaSVG {
  width: 220px;
  height: 380px;
  position: relative;
  z-index: 2;
  animation: evaFloat 5s ease-in-out infinite;
  filter: drop-shadow(0 15px 35px rgba(0,212,255,0.25));
  transition: filter 0.4s ease;
  transform-origin: center bottom;
}
#evaSVG.talking {
  animation: evaFloat 5s ease-in-out infinite, evaTalk 0.18s ease-in-out infinite alternate;
  filter: drop-shadow(0 15px 35px rgba(0,212,255,0.4));
}
#evaSVG.thinking {
  animation: evaThink 1.2s ease-in-out infinite;
  filter: drop-shadow(0 15px 35px rgba(183,148,246,0.5));
}
#evaSVG.listening {
  animation: evaFloat 5s ease-in-out infinite;
  filter: drop-shadow(0 15px 35px rgba(0,255,136,0.45));
}
#evaSVG.happy {
  animation: evaHappy 0.6s ease-in-out 3, evaFloat 5s ease-in-out 1.8s infinite;
  filter: drop-shadow(0 15px 35px rgba(0,255,136,0.5));
}

@keyframes evaFloat {
  0%,100% { transform: translateY(0px) rotate(0deg); }
  25% { transform: translateY(-8px) rotate(0.3deg); }
  75% { transform: translateY(-4px) rotate(-0.2deg); }
}
@keyframes evaTalk {
  from { transform: translateY(var(--fy, 0px)) rotate(-0.4deg) scale(1); }
  to   { transform: translateY(var(--fy, -6px)) rotate(0.4deg) scale(1.003); }
}
@keyframes evaThink {
  0%,100% { transform: translateY(0) rotate(0deg); }
  30% { transform: translateY(-10px) rotate(-2.5deg); }
  70% { transform: translateY(-6px) rotate(1deg); }
}
@keyframes evaHappy {
  0%   { transform: translateY(0) scale(1); }
  20%  { transform: translateY(-18px) scale(1.06) rotate(1deg); }
  50%  { transform: translateY(-5px) scale(0.97) rotate(-1deg); }
  80%  { transform: translateY(-14px) scale(1.04) rotate(0.5deg); }
  100% { transform: translateY(0) scale(1); }
}

.eva-bg-glow {
  position: absolute;
  bottom: 60px;
  left: 50%;
  transform: translateX(-50%);
  width: 180px;
  height: 180px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(0,212,255,0.14) 0%, transparent 70%);
  animation: glowPulse 4s ease-in-out infinite;
  z-index: 1;
  pointer-events: none;
}
@keyframes glowPulse {
  0%,100% { opacity: 0.7; transform: translateX(-50%) scale(1); }
  50%      { opacity: 1; transform: translateX(-50%) scale(1.25); }
}

.eva-ground {
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  width: 130px;
  height: 18px;
  background: radial-gradient(ellipse, rgba(0,212,255,0.25) 0%, transparent 70%);
  border-radius: 50%;
  animation: groundPulse 5s ease-in-out infinite;
  z-index: 1;
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
  8%   { opacity: 0.8; }
  90%  { opacity: 0.6; }
  100% { opacity: 0; transform: translateY(-130px) scale(1.8); }
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
  margin-top: 6px;
  z-index: 3;
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
.eva-status.talking .eva-status-dot { background: #00ff88; animation: sDot 0.25s ease-in-out infinite; }
.eva-status.listening .eva-status-dot { background: #00ff88; animation: sDot 0.45s ease-in-out infinite; }
.eva-status.thinking .eva-status-dot { background: #b794f6; animation: sDot 0.9s ease-in-out infinite; }
.eva-status.happy .eva-status-dot { background: #ffd700; animation: sDot 0.5s ease-in-out infinite; }

/* Scanning line effect */
.eva-scan-line {
  position: absolute;
  left: 20px; right: 20px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(0,212,255,0.5), transparent);
  animation: scanLine 4s ease-in-out infinite;
  z-index: 3;
  pointer-events: none;
  bottom: 100px;
}
@keyframes scanLine {
  0% { bottom: 50px; opacity: 0; }
  10% { opacity: 0.6; }
  90% { opacity: 0.4; }
  100% { bottom: 320px; opacity: 0; }
}

/* HUD corners */
.eva-hud-tl, .eva-hud-tr, .eva-hud-bl, .eva-hud-br {
  position: absolute;
  width: 14px; height: 14px;
  z-index: 4;
  pointer-events: none;
  opacity: 0.4;
}
.eva-hud-tl { top: 10px; left: 10px; border-top: 1.5px solid #00d4ff; border-left: 1.5px solid #00d4ff; }
.eva-hud-tr { top: 10px; right: 10px; border-top: 1.5px solid #00d4ff; border-right: 1.5px solid #00d4ff; }
.eva-hud-bl { bottom: 50px; left: 10px; border-bottom: 1.5px solid #00d4ff; border-left: 1.5px solid #00d4ff; }
.eva-hud-br { bottom: 50px; right: 10px; border-bottom: 1.5px solid #00d4ff; border-right: 1.5px solid #00d4ff; }
</style>

<div id="evaWrap">
  <div class="eva-hud-tl"></div>
  <div class="eva-hud-tr"></div>
  <div class="eva-hud-bl"></div>
  <div class="eva-hud-br"></div>
  <div class="eva-scan-line"></div>
  <div class="eva-particles" id="evaParticles"></div>
  <div class="eva-bg-glow"></div>

  <svg id="evaSVG" viewBox="0 0 220 380" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="fGlow" x="-60%" y="-60%" width="220%" height="220%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="b"/>
        <feComposite in="SourceGraphic" in2="b" operator="over"/>
      </filter>
      <filter id="fEyeGlow" x="-120%" y="-120%" width="340%" height="340%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="5" result="b"/>
        <feComposite in="SourceGraphic" in2="b" operator="over"/>
      </filter>
      <filter id="fSkin" x="-10%" y="-10%" width="120%" height="120%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="0.5" result="b"/>
        <feComposite in="SourceGraphic" in2="b" operator="over"/>
      </filter>
      <filter id="fHair" x="-5%" y="-5%" width="110%" height="110%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="1" result="b"/>
        <feComposite in="SourceGraphic" in2="b" operator="over"/>
      </filter>

      <!-- Skin gradient - warm tone -->
      <linearGradient id="gSkin" x1="0" y1="0" x2="0.2" y2="1">
        <stop offset="0%" stop-color="#f7dfc0"/>
        <stop offset="50%" stop-color="#efcfa0"/>
        <stop offset="100%" stop-color="#e8c08a"/>
      </linearGradient>
      <linearGradient id="gSkinFace" x1="0.1" y1="0" x2="0.9" y2="1">
        <stop offset="0%" stop-color="#f8e2c4"/>
        <stop offset="40%" stop-color="#f2d0a8"/>
        <stop offset="100%" stop-color="#e6bc94"/>
      </linearGradient>
      <!-- Hair - deep dark with blue tint -->
      <linearGradient id="gHair" x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0%" stop-color="#0e0e20"/>
        <stop offset="60%" stop-color="#080818"/>
        <stop offset="100%" stop-color="#050510"/>
      </linearGradient>
      <linearGradient id="gHairSide" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#12122a"/>
        <stop offset="100%" stop-color="#060614"/>
      </linearGradient>
      <!-- Outfit - deep navy cyberpunk -->
      <linearGradient id="gOutfit" x1="0" y1="0" x2="0.2" y2="1">
        <stop offset="0%" stop-color="#0d1c36"/>
        <stop offset="50%" stop-color="#081220"/>
        <stop offset="100%" stop-color="#050c18"/>
      </linearGradient>
      <linearGradient id="gOutfitAccent" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#00d4ff" stop-opacity="0"/>
        <stop offset="40%" stop-color="#00d4ff" stop-opacity="0.8"/>
        <stop offset="60%" stop-color="#00d4ff" stop-opacity="0.8"/>
        <stop offset="100%" stop-color="#00d4ff" stop-opacity="0"/>
      </linearGradient>
      <!-- Iris gradient - striking cyan/blue eyes -->
      <radialGradient id="gEye" cx="38%" cy="32%" r="60%">
        <stop offset="0%" stop-color="#d0f0ff"/>
        <stop offset="25%" stop-color="#80d8ff"/>
        <stop offset="60%" stop-color="#0098e8"/>
        <stop offset="100%" stop-color="#003d8f"/>
      </radialGradient>
      <radialGradient id="gPupil" cx="45%" cy="35%" r="55%">
        <stop offset="0%" stop-color="#001828"/>
        <stop offset="100%" stop-color="#000810"/>
      </radialGradient>
      <!-- Lip gradient -->
      <linearGradient id="gLip" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#d4587a"/>
        <stop offset="100%" stop-color="#a83058"/>
      </linearGradient>
      <linearGradient id="gLipInner" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#7a1030"/>
        <stop offset="100%" stop-color="#300008"/>
      </linearGradient>
      <!-- Leg/skirt -->
      <linearGradient id="gLegs" x1="0" y1="0" x2="0.1" y2="1">
        <stop offset="0%" stop-color="#0c1830"/>
        <stop offset="100%" stop-color="#050e1e"/>
      </linearGradient>
    </defs>

    <!-- ══════ LEGS / LOWER BODY ══════ -->
    <!-- Skirt / lower outfit -->
    <path d="M72 268 Q70 285 65 310 Q63 330 68 355 L88 355 Q90 332 92 312 Q95 290 96 270 Z" fill="url(#gLegs)" stroke="#00d4ff" stroke-width="0.4" stroke-opacity="0.3"/>
    <path d="M148 268 Q150 285 155 310 Q157 330 152 355 L132 355 Q130 332 128 312 Q125 290 124 270 Z" fill="url(#gLegs)" stroke="#00d4ff" stroke-width="0.4" stroke-opacity="0.3"/>
    <!-- Boots -->
    <path d="M60 340 Q58 360 62 375 L90 375 Q92 360 90 340 Z" fill="#080e1c" stroke="#00d4ff" stroke-width="0.5" stroke-opacity="0.5"/>
    <path d="M130 340 Q128 360 132 375 L160 375 Q162 360 158 340 Z" fill="#080e1c" stroke="#00d4ff" stroke-width="0.5" stroke-opacity="0.5"/>
    <!-- Boot accent lines -->
    <path d="M62 355 L88 355" stroke="#00d4ff" stroke-width="1" opacity="0.5"/>
    <path d="M132 355 L158 355" stroke="#00d4ff" stroke-width="1" opacity="0.5"/>
    <!-- Knee guards -->
    <rect x="64" y="315" width="26" height="8" rx="4" fill="#0d1c36" stroke="#00d4ff" stroke-width="0.5" stroke-opacity="0.6"/>
    <rect x="130" y="315" width="26" height="8" rx="4" fill="#0d1c36" stroke="#00d4ff" stroke-width="0.5" stroke-opacity="0.6"/>
    <line x1="67" y1="319" x2="87" y2="319" stroke="#00d4ff" stroke-width="0.8" opacity="0.4"/>
    <line x1="133" y1="319" x2="153" y2="319" stroke="#00d4ff" stroke-width="0.8" opacity="0.4"/>

    <!-- ══════ TORSO / OUTFIT ══════ -->
    <!-- Main torso -->
    <path d="M66 228 Q60 240 60 268 L80 270 Q84 260 88 255 L88 268 L132 268 L132 255 Q136 260 140 270 L160 268 Q160 240 154 228 L140 220 Q120 225 100 220 Z" fill="url(#gOutfit)" stroke="#00d4ff" stroke-width="0.5" stroke-opacity="0.4"/>
    <!-- Chest plate detail -->
    <path d="M88 230 Q110 236 132 230 L134 248 Q110 252 86 248 Z" fill="rgba(0,212,255,0.06)" stroke="#00d4ff" stroke-width="0.7" stroke-opacity="0.5"/>
    <!-- Central chest gem -->
    <polygon points="110,238 120,232 130,238 120,244" fill="rgba(0,212,255,0.15)" stroke="#00d4ff" stroke-width="0.8" opacity="0.8"/>
    <polygon points="112,238 120,234 128,238 120,242" fill="#00d4ff" opacity="0.6"/>
    <polygon points="112,238 120,234 128,238 120,242" fill="#00d4ff" filter="url(#fGlow)" opacity="0.4"/>
    <!-- Chest accent lines -->
    <path d="M88 250 Q110 254 132 250" fill="none" stroke="url(#gOutfitAccent)" stroke-width="1.2" opacity="0.7"/>
    <path d="M90 258 Q110 261 130 258" fill="none" stroke="url(#gOutfitAccent)" stroke-width="0.8" opacity="0.5"/>
    <!-- Side panel lines -->
    <path d="M68 235 L68 262 M72 233 L72 264" stroke="#00d4ff" stroke-width="0.5" opacity="0.3"/>
    <path d="M152 235 L152 262 M148 233 L148 264" stroke="#00d4ff" stroke-width="0.5" opacity="0.3"/>
    <!-- Collar -->
    <path d="M93 222 Q110 229 127 222" fill="none" stroke="#00d4ff" stroke-width="1.2" opacity="0.6"/>
    <path d="M95 220 L110 226 L125 220" fill="none" stroke="#00d4ff" stroke-width="0.6" opacity="0.3"/>

    <!-- ══════ SHOULDER ARMOR ══════ -->
    <!-- Left -->
    <path d="M60 228 Q48 222 44 236 Q44 250 58 248 L66 240 Z" fill="url(#gOutfit)" stroke="#00d4ff" stroke-width="0.6" stroke-opacity="0.6"/>
    <path d="M47 232 L57 245" stroke="#00d4ff" stroke-width="0.7" opacity="0.5"/>
    <circle cx="48" cy="236" r="2" fill="#00d4ff" opacity="0.5"/>
    <!-- Right -->
    <path d="M160 228 Q172 222 176 236 Q176 250 162 248 L154 240 Z" fill="url(#gOutfit)" stroke="#00d4ff" stroke-width="0.6" stroke-opacity="0.6"/>
    <path d="M173 232 L163 245" stroke="#00d4ff" stroke-width="0.7" opacity="0.5"/>
    <circle cx="172" cy="236" r="2" fill="#00d4ff" opacity="0.5"/>

    <!-- ══════ ARMS ══════ -->
    <!-- Left arm -->
    <path d="M58 245 Q50 262 52 295 Q54 308 60 318" stroke="url(#gSkin)" stroke-width="17" fill="none" stroke-linecap="round"/>
    <path d="M58 245 Q50 262 52 295 Q54 308 60 318" stroke="url(#gOutfit)" stroke-width="14" fill="none" stroke-linecap="round" opacity="0.8"/>
    <!-- Left arm tech lines -->
    <path d="M55 258 L53 272 M54 278 L53 288" stroke="#00d4ff" stroke-width="0.5" opacity="0.4" stroke-linecap="round"/>
    <!-- Right arm -->
    <path d="M162 245 Q170 262 168 295 Q166 308 160 318" stroke="url(#gSkin)" stroke-width="17" fill="none" stroke-linecap="round"/>
    <path d="M162 245 Q170 262 168 295 Q166 308 160 318" stroke="url(#gOutfit)" stroke-width="14" fill="none" stroke-linecap="round" opacity="0.8"/>
    <!-- Right arm tech lines -->
    <path d="M165 258 L167 272 M166 278 L167 288" stroke="#00d4ff" stroke-width="0.5" opacity="0.4" stroke-linecap="round"/>
    <!-- Wrist bands -->
    <rect x="48" y="300" width="18" height="6" rx="3" fill="#00d4ff" opacity="0.35"/>
    <rect x="154" y="300" width="18" height="6" rx="3" fill="#00d4ff" opacity="0.35"/>
    <!-- Hands -->
    <ellipse cx="58" cy="322" rx="10" ry="13" fill="url(#gSkin)"/>
    <ellipse cx="162" cy="322" rx="10" ry="13" fill="url(#gSkin)"/>
    <!-- Fingers hint -->
    <path d="M51 316 Q53 328 56 333 M56 315 Q57 328 59 334 M61 315 Q62 328 63 334 M65 316 Q65 327 63 332" stroke="#d4b088" stroke-width="1.2" fill="none" stroke-linecap="round" opacity="0.7"/>
    <path d="M169 316 Q167 328 164 333 M164 315 Q163 328 161 334 M159 315 Q158 328 157 334 M155 316 Q155 327 157 332" stroke="#d4b088" stroke-width="1.2" fill="none" stroke-linecap="round" opacity="0.7"/>

    <!-- ══════ NECK ══════ -->
    <rect x="102" y="200" width="16" height="26" rx="7" fill="url(#gSkin)"/>
    <!-- Neck shadow -->
    <rect x="102" y="200" width="16" height="10" rx="7" fill="rgba(0,0,0,0.1)"/>
    <!-- Tech collar circuit -->
    <path d="M103 212 L103 218 L107 218 M117 212 L117 218 L113 218" fill="none" stroke="#00d4ff" stroke-width="0.6" opacity="0.4"/>

    <!-- ══════ HEAD ══════ -->
    <!-- Head base - slightly wider than tall, feminine proportions -->
    <ellipse cx="110" cy="148" rx="54" ry="58" fill="url(#gSkinFace)" filter="url(#fSkin)"/>
    <!-- Head shading - temple sides -->
    <ellipse cx="70" cy="148" rx="12" ry="20" fill="rgba(0,0,0,0.04)"/>
    <ellipse cx="150" cy="148" rx="12" ry="20" fill="rgba(0,0,0,0.04)"/>
    <!-- Chin definition -->
    <ellipse cx="110" cy="198" rx="24" ry="8" fill="url(#gSkinFace)" opacity="0.8"/>

    <!-- Ears -->
    <ellipse cx="58" cy="150" rx="8" ry="12" fill="url(#gSkinFace)"/>
    <ellipse cx="162" cy="150" rx="8" ry="12" fill="url(#gSkinFace)"/>
    <ellipse cx="58" cy="150" rx="4" ry="7" fill="#d4a878" opacity="0.4"/>
    <ellipse cx="162" cy="150" rx="4" ry="7" fill="#d4a878" opacity="0.4"/>

    <!-- Ear tech rings -->
    <circle cx="162" cy="156" r="3.5" fill="none" stroke="#00d4ff" stroke-width="1" opacity="0.8"/>
    <circle cx="162" cy="156" r="1.5" fill="#00d4ff" opacity="0.7"/>
    <circle cx="162" cy="156" r="1.5" fill="#00d4ff" filter="url(#fGlow)" opacity="0.4"/>
    <circle cx="162" cy="163" r="2.5" fill="#00d4ff" opacity="0.6"/>
    <circle cx="58" cy="156" r="2.5" fill="#00d4ff" opacity="0.5"/>

    <!-- ══════ HAIR - BACK LAYER ══════ -->
    <!-- Long flowing back hair -->
    <path d="M66 118 Q60 90 68 68 Q82 44 110 42 Q138 44 152 68 Q160 90 154 118 Q148 95 110 92 Q72 95 66 118 Z" fill="url(#gHair)" filter="url(#fHair)"/>
    <!-- Long side hair left -->
    <path d="M62 138 Q50 175 52 225 Q54 255 66 278 Q60 255 60 225 Q58 180 65 148 Z" fill="url(#gHairSide)"/>
    <!-- Long side hair right -->
    <path d="M158 138 Q170 175 168 225 Q166 255 154 278 Q160 255 160 225 Q162 180 155 148 Z" fill="url(#gHairSide)"/>
    <!-- Back long hair strands -->
    <path d="M90 195 Q84 220 86 260 Q88 280 94 295" fill="none" stroke="#0a0a1a" stroke-width="6" stroke-linecap="round" opacity="0.7"/>
    <path d="M130 195 Q136 220 134 260 Q132 280 126 295" fill="none" stroke="#0a0a1a" stroke-width="6" stroke-linecap="round" opacity="0.7"/>
    <path d="M110 198 Q108 230 110 270 Q112 290 110 310" fill="none" stroke="#0a0a1a" stroke-width="5" stroke-linecap="round" opacity="0.5"/>

    <!-- ══════ HAIR - FRONT LAYER ══════ -->
    <!-- Top hair main shape -->
    <path d="M68 124 Q70 96 78 78 Q90 56 110 52 Q130 56 142 78 Q150 96 152 124 Q140 108 110 106 Q80 108 68 124 Z" fill="url(#gHair)"/>
    <!-- Bangs - left sweep -->
    <path d="M68 124 Q62 142 64 162 Q70 148 80 138 Q74 132 68 124 Z" fill="#0e0e22"/>
    <!-- Bangs - right -->
    <path d="M152 124 Q158 142 156 162 Q150 148 140 138 Q146 132 152 124 Z" fill="#0e0e22"/>
    <!-- Center parted bangs -->
    <path d="M88 108 Q90 125 85 144 Q92 125 100 114 Z" fill="#0e0e22"/>
    <path d="M132 108 Q130 125 135 144 Q128 125 120 114 Z" fill="#0e0e22"/>
    <!-- Main center bangs -->
    <path d="M100 104 Q105 130 103 150 Q109 128 110 110 Q111 128 117 150 Q115 130 120 104 Q116 98 110 97 Q104 98 100 104 Z" fill="#0e0e20"/>
    <!-- Loose strand across forehead -->
    <path d="M88 115 Q96 120 106 118 Q100 112 88 115 Z" fill="#12122a" opacity="0.8"/>
    <path d="M88 112 Q100 118 112 116" fill="none" stroke="#12122a" stroke-width="2.5" stroke-linecap="round"/>

    <!-- Cyan hair highlight streaks -->
    <path d="M80 70 Q86 62 94 58" stroke="#00d4ff" stroke-width="2.5" fill="none" opacity="0.65" stroke-linecap="round"/>
    <path d="M96 56 Q106 51 118 51" stroke="#00aadd" stroke-width="2" fill="none" opacity="0.45" stroke-linecap="round"/>
    <path d="M60 150 Q56 175 58 200" stroke="#0088bb" stroke-width="2" fill="none" opacity="0.35" stroke-linecap="round"/>
    <path d="M66 148 Q62 168 64 188" stroke="#00d4ff" stroke-width="1.5" fill="none" opacity="0.3" stroke-linecap="round"/>

    <!-- Hair accessory - geometric cyber clip -->
    <rect x="134" y="82" width="16" height="5" rx="2.5" fill="#00d4ff" opacity="0.55"/>
    <rect x="134" y="82" width="16" height="5" rx="2.5" fill="#00d4ff" filter="url(#fGlow)" opacity="0.3"/>
    <rect x="136" y="84" width="4" height="1" rx="0.5" fill="white" opacity="0.5"/>
    <rect x="143" y="84" width="4" height="1" rx="0.5" fill="white" opacity="0.5"/>

    <!-- ══════ FACE FEATURES ══════ -->
    <!-- Eyebrows - arched, slightly thick, feminine -->
    <path d="M82 124 Q92 117 106 119" fill="none" stroke="#1a0a18" stroke-width="2.8" stroke-linecap="round"/>
    <path d="M114 119 Q128 117 138 124" fill="none" stroke="#1a0a18" stroke-width="2.8" stroke-linecap="round"/>
    <!-- Eyebrow highlight -->
    <path d="M83 123 Q93 116 105 118" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M115 118 Q127 116 137 123" fill="none" stroke="rgba(255,255,255,0.12)" stroke-width="1.2" stroke-linecap="round"/>

    <!-- ══════ EYES ══════ -->
    <!-- Eye socket shadow -->
    <ellipse cx="94" cy="143" rx="17" ry="13" fill="rgba(0,0,0,0.06)"/>
    <ellipse cx="126" cy="143" rx="17" ry="13" fill="rgba(0,0,0,0.06)"/>
    <!-- Sclera / white of eye -->
    <ellipse id="eyeWL" cx="94" cy="144" rx="15" ry="11" fill="white"/>
    <ellipse id="eyeWR" cx="126" cy="144" rx="15" ry="11" fill="white"/>
    <!-- Iris -->
    <ellipse id="eyeIL" cx="94" cy="145" rx="10" ry="10" fill="url(#gEye)"/>
    <ellipse id="eyeIR" cx="126" cy="145" rx="10" ry="10" fill="url(#gEye)"/>
    <!-- Pupil -->
    <ellipse id="eyePL" cx="94" cy="146" rx="5.5" ry="5.5" fill="url(#gPupil)"/>
    <ellipse id="eyePR" cx="126" cy="146" rx="5.5" ry="5.5" fill="url(#gPupil)"/>
    <!-- Eye shine - main highlight -->
    <ellipse cx="97" cy="141" rx="3" ry="2.5" fill="white" opacity="0.92"/>
    <ellipse cx="129" cy="141" rx="3" ry="2.5" fill="white" opacity="0.92"/>
    <!-- Eye shine - small secondary -->
    <circle cx="90" cy="148" r="1.2" fill="white" opacity="0.55"/>
    <circle cx="122" cy="148" r="1.2" fill="white" opacity="0.55"/>
    <!-- Iris glow ring -->
    <ellipse cx="94" cy="145" rx="10" ry="10" fill="#00d4ff" opacity="0.1" filter="url(#fEyeGlow)"/>
    <ellipse cx="126" cy="145" rx="10" ry="10" fill="#00d4ff" opacity="0.1" filter="url(#fEyeGlow)"/>
    <!-- Top eyelid shadow -->
    <path d="M80 138 Q94 133 108 137" fill="rgba(0,0,0,0.08)" stroke="none"/>
    <path d="M112 137 Q126 133 140 138" fill="rgba(0,0,0,0.08)" stroke="none"/>
    <!-- Top lashes -->
    <path d="M79 138 Q87 131 109 135" fill="none" stroke="#0c0c18" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M111 135 Q133 131 141 138" fill="none" stroke="#0c0c18" stroke-width="2.5" stroke-linecap="round"/>
    <!-- Lower lash line -->
    <path d="M80 152 Q87 157 108 155" fill="none" stroke="#1a1028" stroke-width="1" stroke-linecap="round" opacity="0.55"/>
    <path d="M112 155 Q133 157 140 152" fill="none" stroke="#1a1028" stroke-width="1" stroke-linecap="round" opacity="0.55"/>
    <!-- Eyelid crease -->
    <path d="M81 137 Q94 132 107 135" fill="none" stroke="rgba(100,70,70,0.2)" stroke-width="0.8" stroke-linecap="round"/>
    <path d="M113 135 Q126 132 139 137" fill="none" stroke="rgba(100,70,70,0.2)" stroke-width="0.8" stroke-linecap="round"/>
    <!-- Inner corner detail -->
    <path d="M80 144 Q82 146 84 144" fill="none" stroke="#d4a888" stroke-width="0.8" opacity="0.6"/>
    <path d="M140 144 Q138 146 136 144" fill="none" stroke="#d4a888" stroke-width="0.8" opacity="0.6"/>

    <!-- ══════ NOSE ══════ -->
    <!-- Nose bridge subtle -->
    <path d="M107 157 Q108 165 109 169" fill="none" stroke="rgba(180,130,100,0.25)" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M113 157 Q112 165 111 169" fill="none" stroke="rgba(180,130,100,0.25)" stroke-width="1.2" stroke-linecap="round"/>
    <!-- Nostril hints -->
    <path d="M106 170 Q110 174 114 170" fill="none" stroke="rgba(160,110,90,0.45)" stroke-width="1.5" stroke-linecap="round"/>
    <ellipse cx="106" cy="171" rx="3" ry="2" fill="rgba(0,0,0,0.07)"/>
    <ellipse cx="114" cy="171" rx="3" ry="2" fill="rgba(0,0,0,0.07)"/>
    <!-- Nose tip highlight -->
    <ellipse cx="110" cy="168" rx="3.5" ry="2" fill="rgba(255,255,255,0.22)"/>

    <!-- Cheek blush -->
    <ellipse cx="80" cy="162" rx="14" ry="7" fill="#ffaabb" opacity="0.13"/>
    <ellipse cx="140" cy="162" rx="14" ry="7" fill="#ffaabb" opacity="0.13"/>

    <!-- ══════ MOUTH ══════ -->
    <g id="evaMouth">
      <!-- Closed smile (default) - natural Cupid's bow -->
      <g id="mouthSmile">
        <!-- Upper lip -->
        <path d="M100 180 Q105 177 110 179 Q115 177 120 180" fill="#c0546e" stroke="none"/>
        <path d="M100 180 Q105 177 110 179 Q115 177 120 180" fill="none" stroke="#a83058" stroke-width="0.5"/>
        <!-- Lower lip -->
        <path d="M100 180 Q110 188 120 180" fill="#d0607c" stroke="none"/>
        <!-- Lip highlight -->
        <path d="M105 182 Q110 185 115 182" fill="none" stroke="rgba(255,255,255,0.2)" stroke-width="1.2" stroke-linecap="round"/>
        <!-- Corner smile lines -->
        <path d="M99 180 Q97 183 99 186" fill="none" stroke="#a03060" stroke-width="0.8" stroke-linecap="round" opacity="0.7"/>
        <path d="M121 180 Q123 183 121 186" fill="none" stroke="#a03060" stroke-width="0.8" stroke-linecap="round" opacity="0.7"/>
      </g>
      <!-- Talking / open mouth (hidden by default) -->
      <g id="mouthOpen" display="none">
        <!-- Lips outline -->
        <path d="M100 179 Q105 176 110 178 Q115 176 120 179 Q122 186 110 191 Q98 186 100 179 Z" fill="url(#gLipInner)"/>
        <!-- Teeth top -->
        <clipPath id="teethClip"><path d="M101 179 Q110 178 119 179 L119 183 Q110 181 101 183 Z"/></clipPath>
        <path d="M101 179 Q110 178 119 179 L119 183 Q110 181 101 183 Z" fill="white" opacity="0.9"/>
        <!-- Lip overlay top -->
        <path d="M100 179 Q105 176 110 178 Q115 176 120 179" fill="url(#gLip)" opacity="0.9"/>
        <!-- Lip overlay bottom -->
        <path d="M100 179 Q110 191 120 179" fill="url(#gLip)" opacity="0.7"/>
        <!-- Lower lip highlight -->
        <path d="M104 186 Q110 189 116 186" fill="none" stroke="rgba(255,255,255,0.22)" stroke-width="1.2" stroke-linecap="round"/>
      </g>
    </g>

    <!-- ══════ TECH ELEMENTS ══════ -->
    <!-- Headset/earpiece left -->
    <rect x="50" y="143" rx="3" ry="3" width="10" height="18" fill="#0a1220" stroke="#00d4ff" stroke-width="0.7" opacity="0.8"/>
    <rect x="52" y="148" rx="1.5" ry="1.5" width="6" height="7" fill="#00d4ff" opacity="0.25"/>
    <rect x="53" y="151" rx="1" ry="1" width="4" height="1.5" fill="#00d4ff" opacity="0.6"/>

    <!-- Animated data scanner lines (right side) -->
    <g opacity="0.5">
      <rect x="178" y="165" width="35" height="1.5" rx="0.8" fill="#00d4ff">
        <animate attributeName="opacity" values="0;0.7;0" dur="2.5s" repeatCount="indefinite" begin="0s"/>
        <animate attributeName="width" values="10;35;10" dur="2.5s" repeatCount="indefinite" begin="0s"/>
      </rect>
      <rect x="180" y="175" width="25" height="1" rx="0.5" fill="#00d4ff">
        <animate attributeName="opacity" values="0;0.6;0" dur="2s" repeatCount="indefinite" begin="0.6s"/>
      </rect>
      <rect x="176" y="185" width="30" height="1" rx="0.5" fill="#b794f6">
        <animate attributeName="opacity" values="0;0.5;0" dur="3s" repeatCount="indefinite" begin="1.2s"/>
      </rect>
      <rect x="182" y="195" width="20" height="1" rx="0.5" fill="#00d4ff">
        <animate attributeName="opacity" values="0;0.4;0" dur="2.2s" repeatCount="indefinite" begin="0.3s"/>
      </rect>
    </g>
    <!-- Left data lines -->
    <g opacity="0.5">
      <rect x="8" y="158" width="28" height="1.5" rx="0.8" fill="#00d4ff">
        <animate attributeName="opacity" values="0;0.6;0" dur="2.8s" repeatCount="indefinite" begin="0.4s"/>
      </rect>
      <rect x="5" y="170" width="22" height="1" rx="0.5" fill="#00d4ff">
        <animate attributeName="opacity" values="0;0.5;0" dur="2s" repeatCount="indefinite" begin="1s"/>
      </rect>
      <rect x="10" y="182" width="18" height="1" rx="0.5" fill="#b794f6">
        <animate attributeName="opacity" values="0;0.45;0" dur="3.2s" repeatCount="indefinite" begin="0s"/>
      </rect>
    </g>
  </svg>

  <div class="eva-ground"></div>
  <div class="eva-status" id="evaStatusBar">
    <div class="eva-status-dot"></div>
    <span id="evaStatusTxt">EN LIGNE</span>
  </div>
</div>
  `;

  spawnParticles();
  startBlink();
}

function spawnParticles() {
  var c = document.getElementById('evaParticles');
  if (!c) return;
  for (var i = 0; i < 18; i++) {
    var el = document.createElement('div');
    el.className = 'eva-p';
    el.style.left = (25 + Math.random() * 170) + 'px';
    el.style.bottom = (35 + Math.random() * 240) + 'px';
    el.style.width = el.style.height = (1.2 + Math.random() * 2.8) + 'px';
    el.style.animationDuration = (4 + Math.random() * 5) + 's';
    el.style.animationDelay = (Math.random() * 5) + 's';
    if (Math.random() > 0.7) el.style.background = '#b794f6';
    c.appendChild(el);
  }
}

function startBlink() {
  function doBlink() {
    var ids = ['eyeWL','eyeWR','eyeIL','eyeIR','eyePL','eyePR'];
    var els = ids.map(function(id) { return document.getElementById(id); }).filter(Boolean);
    if (!els.length) return;
    var double = Math.random() < 0.2;
    els.forEach(function(e) { e.style.transform = 'scaleY(0.04)'; e.style.transition = 'transform 0.055s ease'; });
    setTimeout(function() {
      els.forEach(function(e) { e.style.transform = 'scaleY(1)'; e.style.transition = 'transform 0.08s ease'; });
      if (double) {
        setTimeout(function() {
          els.forEach(function(e) { e.style.transform = 'scaleY(0.04)'; });
          setTimeout(function() { els.forEach(function(e) { e.style.transform = 'scaleY(1)'; }); }, 80);
        }, 150);
      }
    }, 90);
    blinkTimer = setTimeout(doBlink, 2200 + Math.random() * 3400);
  }
  blinkTimer = setTimeout(doBlink, 1800);
}

var talkStep = 0;
function startTalking() {
  if (state === 'talking') return;
  setState('talking');
  var svg = document.getElementById('evaSVG');
  if (svg) svg.className = 'talking';
  var smile = document.getElementById('mouthSmile');
  var open  = document.getElementById('mouthOpen');
  if (smile) smile.style.display = 'none';
  if (open)  { open.style.display = ''; }
  animateMouth();
  setStatus('talking', 'EN COURS...');
}

function animateMouth() {
  if (state !== 'talking') return;
  var open = document.getElementById('mouthOpen');
  if (!open) return;
  talkStep = !talkStep;
  var scale = talkStep ? (0.3 + Math.random() * 0.7) : (0.1 + Math.random() * 0.3);
  open.style.transform = 'scaleY(' + scale + ')';
  open.style.transformOrigin = 'center top';
  open.style.transition = 'transform 0.1s ease';
  talkTimer = setTimeout(animateMouth, 100 + Math.random() * 100);
}

function stopTalking() {
  if (state === 'idle') return;
  setState('idle');
  if (talkTimer) { clearTimeout(talkTimer); talkTimer = null; }
  var svg = document.getElementById('evaSVG');
  if (svg) svg.className = '';
  var smile = document.getElementById('mouthSmile');
  var open  = document.getElementById('mouthOpen');
  if (smile) smile.style.display = '';
  if (open)  open.style.display = 'none';
  setStatus('idle', 'EN LIGNE');
}

function setThinking() {
  setState('thinking');
  var svg = document.getElementById('evaSVG');
  if (svg) svg.className = 'thinking';
  setStatus('thinking', 'RÉFLEXION...');
}

function setListening() {
  setState('listening');
  var svg = document.getElementById('evaSVG');
  if (svg) svg.className = 'listening';
  setStatus('listening', "J'ÉCOUTE...");
}

function setHappy() {
  if (emotionTimer) clearTimeout(emotionTimer);
  setState('happy');
  var svg = document.getElementById('evaSVG');
  if (svg) svg.className = 'happy';
  setStatus('happy', 'AVEC PLAISIR !');
  emotionTimer = setTimeout(function() {
    if (state === 'happy') {
      setState('idle');
      if (svg) svg.className = '';
      setStatus('idle', 'EN LIGNE');
    }
  }, 1900);
}

function setIdle() { stopTalking(); }
function setState(s) { state = s; }
function getState() { return state; }

function setStatus(cls, txt) {
  var bar = document.getElementById('evaStatusBar');
  var t   = document.getElementById('evaStatusTxt');
  if (bar) bar.className = 'eva-status ' + cls;
  if (t)   t.textContent = txt;
}

window.EvaCharacter = { create: create, startTalking: startTalking, stopTalking: stopTalking, setThinking: setThinking, setListening: setListening, setHappy: setHappy, setIdle: setIdle, getState: getState };
})();
