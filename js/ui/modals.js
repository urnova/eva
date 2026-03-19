/* ═══════════════════════════════════════════════════════════
   EVA V3 - MODALS.JS
   Gestion des modals (paramètres, rapports, etc.)
   ═══════════════════════════════════════════════════════════ */

// ═══ INIT MODALS ═══
export function initModals() {
  setupEscapeKey();
  setupOverlayClick();
  
  console.log('✅ Modals initialized');
}

// ═══ SETUP ESCAPE KEY ═══
function setupEscapeKey() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAllModals();
    }
  });
}

// ═══ SETUP OVERLAY CLICK ═══
function setupOverlayClick() {
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal(overlay.id);
      }
    });
  });
}

// ═══ OPEN MODAL ═══
export function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) {
    console.error('Modal not found:', modalId);
    return;
  }
  
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
  
  // Trigger custom event
  const event = new CustomEvent('modalOpened', { detail: { modalId } });
  window.dispatchEvent(event);
}

// ═══ CLOSE MODAL ═══
export function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  
  modal.classList.remove('active');
  document.body.style.overflow = '';
  
  // Trigger custom event
  const event = new CustomEvent('modalClosed', { detail: { modalId } });
  window.dispatchEvent(event);
}

// ═══ TOGGLE MODAL ═══
export function toggleModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  
  if (modal.classList.contains('active')) {
    closeModal(modalId);
  } else {
    openModal(modalId);
  }
}

// ═══ CLOSE ALL MODALS ═══
export function closeAllModals() {
  document.querySelectorAll('.modal-overlay.active').forEach(modal => {
    modal.classList.remove('active');
  });
  
  document.body.style.overflow = '';
}

// ═══ OPEN SETTINGS MODAL ═══
export function openSettings() {
  openModal('settingsModal');
}

// ═══ CLOSE SETTINGS MODAL ═══
export function closeSettings() {
  closeModal('settingsModal');
}

// ═══ OPEN REPORT MODAL ═══
export function openReportModal() {
  openModal('reportModal');
}

// ═══ CLOSE REPORT MODAL ═══
export function closeReportModal() {
  closeModal('reportModal');
}

// ═══ SHOW CONFIRM DIALOG ═══
export function showConfirm(message, onConfirm, onCancel) {
  const confirmed = confirm(message);
  
  if (confirmed && onConfirm) {
    onConfirm();
  } else if (!confirmed && onCancel) {
    onCancel();
  }
  
  return confirmed;
}

// ═══ SHOW ALERT ═══
export function showAlert(message) {
  alert(message);
}

// ═══ CREATE CUSTOM MODAL ═══
export function createCustomModal(options = {}) {
  const modalId = options.id || 'customModal_' + Date.now();
  const title = options.title || 'Modal';
  const content = options.content || '';
  const buttons = options.buttons || [];
  
  // Create modal HTML
  const modalHTML = `
    <div class="modal-overlay" id="${modalId}">
      <div class="modal">
        <div class="modal-header">
          <h2 class="modal-title">${title}</h2>
          <button class="modal-close" onclick="closeModal('${modalId}')">✕</button>
        </div>
        <div class="modal-body">
          ${content}
        </div>
        ${buttons.length > 0 ? `
          <div class="modal-footer">
            ${buttons.map(btn => `
              <button class="btn ${btn.className || ''}" onclick="${btn.onClick}">
                ${btn.text}
              </button>
            `).join('')}
          </div>
        ` : ''}
      </div>
    </div>
  `;
  
  // Add to body
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // Setup overlay click
  const modal = document.getElementById(modalId);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal(modalId);
      if (options.onClose) options.onClose();
    }
  });
  
  return modalId;
}

// ═══ REMOVE CUSTOM MODAL ═══
export function removeCustomModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.remove();
  }
}

export default {
  initModals,
  openModal,
  closeModal,
  toggleModal,
  closeAllModals,
  openSettings,
  closeSettings,
  openReportModal,
  closeReportModal,
  showConfirm,
  showAlert,
  createCustomModal,
  removeCustomModal
};
