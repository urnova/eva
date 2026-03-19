/* ═══════════════════════════════════════════════════════════
   EVA V3 - SIDEBAR.JS
   Gestion de la sidebar (navigation, toggle, etc.)
   ═══════════════════════════════════════════════════════════ */

import { isMobile } from '../core/utils.js';

// ═══ INIT SIDEBAR ═══
export function initSidebar() {
  setupNavigation();
  setupMobileToggle();
  setupUserDropdown();
  setupToneSelector();
  
  console.log('✅ Sidebar initialized');
}

// ═══ SETUP NAVIGATION ═══
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      // Remove active from all
      navItems.forEach(i => i.classList.remove('active'));
      
      // Add active to clicked
      item.classList.add('active');
      
      // Get view
      const view = item.getAttribute('data-view');
      
      // Trigger view change
      if (window.onViewChange) {
        window.onViewChange(view);
      }
      
      // Close sidebar on mobile
      if (isMobile()) {
        closeSidebar();
      }
    });
  });
}

// ═══ SETUP MOBILE TOGGLE ═══
function setupMobileToggle() {
  const hamburger = document.querySelector('.hamburger-btn');
  const overlay = document.getElementById('sidebarOverlay');
  
  if (hamburger) {
    hamburger.addEventListener('click', toggleSidebar);
  }
  
  if (overlay) {
    overlay.addEventListener('click', closeSidebar);
  }
}

// ═══ TOGGLE SIDEBAR ═══
export function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  
  if (!sidebar || !overlay) return;
  
  const isOpen = sidebar.classList.contains('mobile-open');
  
  if (isOpen) {
    closeSidebar();
  } else {
    openSidebar();
  }
}

// ═══ OPEN SIDEBAR ═══
export function openSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  
  if (!sidebar || !overlay) return;
  
  sidebar.classList.add('mobile-open');
  overlay.classList.add('active');
  
  // Prevent body scroll
  document.body.style.overflow = 'hidden';
}

// ═══ CLOSE SIDEBAR ═══
export function closeSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');
  
  if (!sidebar || !overlay) return;
  
  sidebar.classList.remove('mobile-open');
  overlay.classList.remove('active');
  
  // Restore body scroll
  document.body.style.overflow = '';
}

// ═══ SETUP USER DROPDOWN ═══
function setupUserDropdown() {
  const userProfile = document.getElementById('userProfile');
  
  if (!userProfile) return;
  
  userProfile.addEventListener('click', (e) => {
    e.stopPropagation();
    userProfile.classList.toggle('open');
  });
  
  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!userProfile.contains(e.target)) {
      userProfile.classList.remove('open');
    }
  });
}

// ═══ TOGGLE USER DROPDOWN ═══
export function toggleUserDropdown() {
  const userProfile = document.getElementById('userProfile');
  if (userProfile) {
    userProfile.classList.toggle('open');
  }
}

// ═══ CLOSE USER DROPDOWN ═══
export function closeUserDropdown() {
  const userProfile = document.getElementById('userProfile');
  if (userProfile) {
    userProfile.classList.remove('open');
  }
}

// ═══ SETUP TONE SELECTOR ═══
function setupToneSelector() {
  const toneBtns = document.querySelectorAll('.tone-btn');
  
  toneBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Remove active from all
      toneBtns.forEach(b => b.classList.remove('active'));
      
      // Add active to clicked
      btn.classList.add('active');
      
      // Get tone
      const tone = btn.getAttribute('data-tone');
      
      // Trigger tone change
      if (window.onToneChange) {
        window.onToneChange(tone);
      }
    });
  });
}

// ═══ SET ACTIVE VIEW ═══
export function setActiveView(viewName) {
  const navItems = document.querySelectorAll('.nav-item');
  
  navItems.forEach(item => {
    if (item.getAttribute('data-view') === viewName) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
}

// ═══ SET ACTIVE TONE ═══
export function setActiveTone(toneName) {
  const toneBtns = document.querySelectorAll('.tone-btn');
  
  toneBtns.forEach(btn => {
    if (btn.getAttribute('data-tone') === toneName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

// ═══ UPDATE CONVERSATION LIST ═══
export function updateConversationsList(conversations) {
  const list = document.getElementById('conversationsList');
  if (!list) return;
  
  list.innerHTML = '';
  
  conversations.forEach(conv => {
    const item = document.createElement('div');
    item.className = 'conversation-item';
    item.dataset.conversationId = conv.id;
    
    item.innerHTML = `
      <span class="conversation-dot"></span>
      <span class="conversation-title">${conv.title || 'Nouvelle conversation'}</span>
      <button class="conversation-delete" onclick="deleteConversationClick('${conv.id}', event)">🗑️</button>
    `;
    
    item.addEventListener('click', () => {
      if (window.onConversationSelect) {
        window.onConversationSelect(conv.id);
      }
      
      // Set active
      document.querySelectorAll('.conversation-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      
      // Close sidebar on mobile
      if (isMobile()) {
        closeSidebar();
      }
    });
    
    list.appendChild(item);
  });
}

// ═══ ADD CONVERSATION TO LIST ═══
export function addConversationToList(conversation) {
  const list = document.getElementById('conversationsList');
  if (!list) return;
  
  const item = document.createElement('div');
  item.className = 'conversation-item';
  item.dataset.conversationId = conversation.id;
  
  item.innerHTML = `
    <span class="conversation-dot"></span>
    <span class="conversation-title">${conversation.title || 'Nouvelle conversation'}</span>
    <button class="conversation-delete" onclick="deleteConversationClick('${conversation.id}', event)">🗑️</button>
  `;
  
  list.insertBefore(item, list.firstChild);
}

// ═══ REMOVE CONVERSATION FROM LIST ═══
export function removeConversationFromList(conversationId) {
  const item = document.querySelector(`[data-conversation-id="${conversationId}"]`);
  if (item) {
    item.remove();
  }
}

// ═══ SET ACTIVE CONVERSATION ═══
export function setActiveConversation(conversationId) {
  const items = document.querySelectorAll('.conversation-item');
  
  items.forEach(item => {
    if (item.dataset.conversationId === conversationId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });
}

export default {
  initSidebar,
  toggleSidebar,
  openSidebar,
  closeSidebar,
  toggleUserDropdown,
  closeUserDropdown,
  setActiveView,
  setActiveTone,
  updateConversationsList,
  addConversationToList,
  removeConversationFromList,
  setActiveConversation
};
