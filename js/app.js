/* ═══════════════════════════════════════════════════════════
   EVA V3 - APP.JS
   Point d'entrée principal - Initialisation de l'application
   ═══════════════════════════════════════════════════════════ */

import { auth, db } from './core/firebase-config.js';
import { getUserProfile } from './core/auth.js';
import { DEFAULT_CONFIG, USER_ROLES } from './core/config.js';
import { toast } from './core/utils.js';

// Modules UI
import { initSidebar } from './ui/sidebar.js';
import { initChatUI, streamMessageContent } from './ui/chat-ui.js';
import { initModals } from './ui/modals.js';
import { initAnimations } from './ui/animations.js';

// Modules IA
import { initChatHandler, sendMessage } from './ai/chat-handler.js';

// Modules Voice
import { initVoices, speakText } from './voice/tts.js';
import { initSpeechRecognition } from './voice/stt.js';

// Modules Features
import { listConversations, createConversation, saveMessage } from './features/conversations.js';
import { initAlarms } from './features/alarms.js';
import { initReminders } from './features/reminders.js';

// Modules Settings
import { initSettingsUI } from './settings/settings-ui.js';

// Variables globales
window.currentUser = null;
window.currentConfig = null;
window.currentConversation = null;

// ═══ INIT APP ═══
async function initApp() {
  console.log('🚀 Initializing E.V.A V3...');
  
  // Wait for auth
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = '/login';
      return;
    }
    
    window.currentUser = user;
    
    try {
      // Load user profile
      const profileResult = await getUserProfile(user.uid);
      
      if (!profileResult.success) {
        throw new Error('Failed to load profile');
      }
      
      const userData = profileResult.data;
      
      // Check if onboarding completed
      if (!userData.nickname || !userData.onboardingCompleted) {
        window.location.href = '/onboarding';
        return;
      }
      
      // Merge config
      window.currentConfig = {
        ...DEFAULT_CONFIG,
        ...userData.preferences
      };
      
      // Initialize modules
      await initModules(user, userData);
      
      // Load conversations
      await loadConversations(user.uid);
      
      console.log('✅ E.V.A V3 initialized successfully');
      toast('Bienvenue ' + (userData.nickname || userData.displayName), 'success');
      
    } catch (error) {
      console.error('❌ Initialization error:', error);
      toast('Erreur d\'initialisation', 'error');
    }
  });
}

// ═══ INIT MODULES ═══
async function initModules(user, userData) {
  // UI Modules
  initSidebar();
  initChatUI();
  initModals();
  initAnimations();
  
  // Voice
  initVoices();
  initSpeechRecognition(window.currentConfig);
  
  // IA
  await initChatHandler(window.currentConfig);
  
  // Features
  initAlarms(user.uid);
  initReminders(user.uid);
  
  // Settings
  await initSettingsUI(user);
  
  // Update UI with user info
  updateUserUI(userData);
}

// ═══ UPDATE USER UI ═══
function updateUserUI(userData) {
  // Update profile in sidebar
  const userName = document.getElementById('userName');
  if (userName) {
    userName.textContent = userData.displayName || 'Utilisateur';
  }
  
  // Update avatar
  const avatar = document.getElementById('userAvatar');
  if (avatar) {
    if (userData.photoURL) {
      avatar.innerHTML = `<img src="${userData.photoURL}" alt="Avatar">`;
    } else {
      const initials = (userData.displayName || 'U')
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
      avatar.textContent = initials;
    }
  }
  
  // Update badge if dev role
  if (userData.role && userData.role !== 'user') {
    updateRoleBadge(userData.role);
  }
}

// ═══ UPDATE ROLE BADGE ═══
function updateRoleBadge(role) {
  const roleInfo = USER_ROLES[role];
  if (!roleInfo) return;
  
  const badgeEl = document.getElementById('userBadge');
  if (badgeEl) {
    const [icon, text] = roleInfo.badge.split(' ');
    badgeEl.innerHTML = `<span class="badge-icon">${icon}</span><span>${text}</span>`;
    badgeEl.className = `user-badge ${role}`;
    badgeEl.style.background = roleInfo.badgeColor;
  }
}

// ═══ LOAD CONVERSATIONS ═══
async function loadConversations(userId) {
  try {
    const result = await listConversations(userId, 20);
    
    if (result.success) {
      const list = document.getElementById('conversationsList');
      if (!list) return;
      
      list.innerHTML = '';
      
      result.conversations.forEach(conv => {
        const item = document.createElement('div');
        item.className = 'conversation-item';
        item.dataset.conversationId = conv.id;
        
        item.innerHTML = `
          <span class="conversation-dot"></span>
          <span class="conversation-title">${conv.title || 'Nouvelle conversation'}</span>
          <button class="conversation-delete" onclick="deleteConversationClick('${conv.id}', event)">🗑️</button>
        `;
        
        item.addEventListener('click', () => {
          loadConversation(conv.id);
        });
        
        list.appendChild(item);
      });
    }
  } catch (error) {
    console.error('Load conversations error:', error);
  }
}

// ═══ LOAD CONVERSATION ═══
async function loadConversation(conversationId) {
  console.log('Loading conversation:', conversationId);
  // TODO: Implement full conversation loading
}

// ═══ CREATE NEW CONVERSATION ═══
window.createNewConversation = async function() {
  if (!window.currentUser) return;
  
  const result = await createConversation(window.currentUser.uid);
  
  if (result.success) {
    window.currentConversation = result.conversationId;
    
    // Clear messages
    const messagesList = document.getElementById('messagesList');
    if (messagesList) {
      messagesList.innerHTML = '';
    }
    
    // Show empty state
    const emptyState = document.getElementById('chatEmpty');
    if (emptyState) {
      emptyState.style.display = 'flex';
    }
  }
};

// ═══ DELETE CONVERSATION ═══
window.deleteConversationClick = async function(conversationId, event) {
  event.stopPropagation();
  
  if (!confirm('Supprimer cette conversation ?')) return;
  
  // TODO: Implement conversation deletion
  console.log('Delete conversation:', conversationId);
};

// ═══ SEND MESSAGE ═══
window.sendMessage = async function() {
  const input = document.getElementById('messageInput');
  const text = input.value.trim();
  
  if (!text || !window.currentUser) return;
  
  // Add user message to UI
  window.addMessage('user', text);
  
  // Clear input
  input.value = '';
  input.style.height = 'auto';
  
  // Get selected tone
  const activeTone = document.querySelector('.tone-btn.active');
  const tone = activeTone?.getAttribute('data-tone') || 'normal';
  
  // Show typing indicator
  const typingId = window.showTypingIndicator();
  
  // Send to IA
  const response = await sendMessage(text, {
    tone,
    nickname: window.currentConfig.nickname
  });
  
  // Hide typing indicator
  window.hideTypingIndicator(typingId);
  
  // Show response
  if (response.success) {
    // Launch TTS and text streaming simultaneously
    const streamingPromise = streamMessageContent('assistant', response.content);
    
    if (window.currentConfig.ttsEnabled !== false) {
      speakText(response.content, window.currentConfig);
    }
    
    await streamingPromise;
    
    // Save messages
    if (window.currentConversation) {
      await saveMessage(window.currentUser.uid, window.currentConversation, {
        role: 'user',
        content: text
      });
      
      await saveMessage(window.currentUser.uid, window.currentConversation, {
        role: 'assistant',
        content: response.content
      });
    }
  } else {
    window.showErrorMessage(response.fallbackMessage || 'Erreur IA');
  }
};

// ═══ HANDLE INPUT KEYDOWN ═══
window.handleInputKeydown = function(event) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    window.sendMessage();
  }
};

// ═══ INIT ON LOAD ═══
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

console.log('📦 E.V.A V3 - App.js loaded');
