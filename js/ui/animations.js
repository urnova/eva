/* ═══════════════════════════════════════════════════════════
   EVA V3 - ANIMATIONS.JS
   Animations du logo Eva
   ═══════════════════════════════════════════════════════════ */

// Variables globales
let animationFrameId = null;
let isAnimating = false;

// ═══ INIT ANIMATIONS ═══
export function initAnimations() {
  const logo = document.getElementById('evaLogo');
  if (!logo) return;
  
  // Add idle animation class
  logo.classList.add('animated');
  
  console.log('✅ Animations initialized');
}

// ═══ SET LOGO STATE ═══
export function setLogoState(state) {
  const logo = document.getElementById('evaLogo');
  const statusDot = document.getElementById('statusDot');
  
  if (!logo || !statusDot) return;
  
  // Remove all states
  logo.classList.remove('idle', 'listening', 'speaking', 'thinking', 'error');
  statusDot.classList.remove('listening', 'speaking', 'error');
  
  // Add new state
  if (state && state !== 'idle') {
    logo.classList.add(state);
    statusDot.classList.add(state);
  } else {
    logo.classList.add('idle');
  }
}

// ═══ PULSE LOGO ═══
export function pulseLogo(duration = 1000) {
  const logo = document.getElementById('evaLogo');
  if (!logo) return;
  
  logo.style.transition = 'all 0.3s ease';
  logo.style.transform = 'scale(1.2)';
  logo.style.filter = 'drop-shadow(0 0 30px var(--cyan-glow))';
  
  setTimeout(() => {
    logo.style.transform = '';
    logo.style.filter = '';
  }, duration);
}

// ═══ GLOW LOGO ═══
export function glowLogo(color = 'var(--cyan)', duration = 2000) {
  const logo = document.getElementById('evaLogo');
  if (!logo) return;
  
  logo.style.filter = `drop-shadow(0 0 30px ${color})`;
  
  setTimeout(() => {
    logo.style.filter = '';
  }, duration);
}

// ═══ ROTATE LOGO ═══
export function rotateLogo(degrees = 360, duration = 1000) {
  const logo = document.getElementById('evaLogo');
  if (!logo) return;
  
  logo.style.transition = `transform ${duration}ms ease-in-out`;
  logo.style.transform = `rotate(${degrees}deg)`;
  
  setTimeout(() => {
    logo.style.transform = '';
  }, duration);
}

// ═══ SHAKE LOGO ═══
export function shakeLogo() {
  const logo = document.getElementById('evaLogo');
  if (!logo) return;
  
  logo.style.animation = 'shake 0.5s';
  
  setTimeout(() => {
    logo.style.animation = '';
  }, 500);
}

// ═══ BOUNCE LOGO ═══
export function bounceLogo() {
  const logo = document.getElementById('evaLogo');
  if (!logo) return;
  
  logo.style.animation = 'bounce 0.6s';
  
  setTimeout(() => {
    logo.style.animation = '';
  }, 600);
}

// ═══ FADE LOGO ═══
export function fadeLogo(opacity = 0.3, duration = 500) {
  const logo = document.getElementById('evaLogo');
  if (!logo) return;
  
  logo.style.transition = `opacity ${duration}ms ease`;
  logo.style.opacity = opacity;
  
  return () => {
    logo.style.opacity = '1';
  };
}

// ═══ LISTENING ANIMATION ═══
export function startListeningAnimation() {
  const logo = document.getElementById('evaLogo');
  if (!logo) return;
  
  logo.classList.add('listening');
  
  // Pulse effect
  isAnimating = true;
  animateListeningPulse();
}

function animateListeningPulse() {
  if (!isAnimating) return;
  
  const logo = document.getElementById('evaLogo');
  if (!logo) return;
  
  let scale = 1;
  let growing = true;
  
  const pulse = () => {
    if (!isAnimating) return;
    
    if (growing) {
      scale += 0.005;
      if (scale >= 1.1) growing = false;
    } else {
      scale -= 0.005;
      if (scale <= 1) growing = true;
    }
    
    logo.style.transform = `scale(${scale})`;
    
    animationFrameId = requestAnimationFrame(pulse);
  };
  
  pulse();
}

// ═══ STOP LISTENING ANIMATION ═══
export function stopListeningAnimation() {
  const logo = document.getElementById('evaLogo');
  if (!logo) return;
  
  isAnimating = false;
  
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  
  logo.classList.remove('listening');
  logo.style.transform = '';
}

// ═══ SPEAKING ANIMATION ═══
export function startSpeakingAnimation() {
  const logo = document.getElementById('evaLogo');
  if (!logo) return;
  
  logo.classList.add('speaking');
  glowLogo('var(--green)', 5000);
}

// ═══ STOP SPEAKING ANIMATION ═══
export function stopSpeakingAnimation() {
  const logo = document.getElementById('evaLogo');
  if (!logo) return;
  
  logo.classList.remove('speaking');
}

// ═══ THINKING ANIMATION ═══
export function startThinkingAnimation() {
  const logo = document.getElementById('evaLogo');
  if (!logo) return;
  
  logo.classList.add('thinking');
  
  // Rotate slowly
  let rotation = 0;
  isAnimating = true;
  
  const rotate = () => {
    if (!isAnimating) return;
    
    rotation += 2;
    logo.style.transform = `rotate(${rotation}deg)`;
    
    animationFrameId = requestAnimationFrame(rotate);
  };
  
  rotate();
}

// ═══ STOP THINKING ANIMATION ═══
export function stopThinkingAnimation() {
  const logo = document.getElementById('evaLogo');
  if (!logo) return;
  
  isAnimating = false;
  
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
  
  logo.classList.remove('thinking');
  logo.style.transform = '';
}

// ═══ ERROR ANIMATION ═══
export function showErrorAnimation() {
  const logo = document.getElementById('evaLogo');
  if (!logo) return;
  
  logo.classList.add('error');
  shakeLogo();
  glowLogo('var(--red)', 1000);
  
  setTimeout(() => {
    logo.classList.remove('error');
  }, 1000);
}

// ═══ SUCCESS ANIMATION ═══
export function showSuccessAnimation() {
  const logo = document.getElementById('evaLogo');
  if (!logo) return;
  
  bounceLogo();
  glowLogo('var(--green)', 1000);
}

// Add CSS animations to document
const style = document.createElement('style');
style.textContent = `
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
  20%, 40%, 60%, 80% { transform: translateX(5px); }
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-20px); }
}
`;
document.head.appendChild(style);

export default {
  initAnimations,
  setLogoState,
  pulseLogo,
  glowLogo,
  rotateLogo,
  shakeLogo,
  bounceLogo,
  fadeLogo,
  startListeningAnimation,
  stopListeningAnimation,
  startSpeakingAnimation,
  stopSpeakingAnimation,
  startThinkingAnimation,
  stopThinkingAnimation,
  showErrorAnimation,
  showSuccessAnimation
};
