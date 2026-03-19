/* ═══════════════════════════════════════════════════════════
   EVA V3 - CHAT-UI.JS
   Gestion de l'interface chat et affichage des messages
   ═══════════════════════════════════════════════════════════ */

import { formatTime, sanitizeHTML } from '../core/utils.js';

// ═══ ADD MESSAGE TO UI ═══
export function addMessage(role, content, options = {}) {
  const messagesList = document.getElementById('messagesList');
  const emptyState = document.getElementById('chatEmpty');
  
  if (!messagesList) return null;
  
  // Cacher l'empty state
  if (emptyState) {
    emptyState.style.display = 'none';
  }
  
  // Créer l'élément message
  const messageEl = document.createElement('div');
  messageEl.className = `message ${role}`;
  messageEl.dataset.messageId = options.id || Date.now();
  
  // Avatar
  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  
  if (options.avatarUrl) {
    avatar.innerHTML = `<img src="${options.avatarUrl}" alt="${role}">`;
  } else {
    const initial = role === 'user' ? (options.userInitial || 'U') : 'E';
    avatar.textContent = initial;
  }
  
  // Content wrapper
  const contentWrap = document.createElement('div');
  contentWrap.className = 'message-content';
  
  // Bubble
  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';
  
  if (options.isTyping) {
    bubble.classList.add('typing');
    bubble.innerHTML = `
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    `;
  } else {
    bubble.innerHTML = renderMessageContent(content);
  }
  
  // Time
  const time = document.createElement('div');
  time.className = 'message-time';
  time.textContent = options.timestamp ? formatTime(options.timestamp) : formatTime(new Date());
  
  // Assembler
  contentWrap.appendChild(bubble);
  contentWrap.appendChild(time);
  
  messageEl.appendChild(avatar);
  messageEl.appendChild(contentWrap);
  
  // Ajouter au DOM
  messagesList.appendChild(messageEl);
  
  // Animation
  setTimeout(() => {
    messageEl.style.opacity = '1';
    messageEl.style.transform = 'translateY(0)';
  }, 10);
  
  // Auto scroll
  scrollToBottom();
  
  return messageEl;
}

// ═══ UPDATE MESSAGE ═══
export function updateMessage(messageId, content, isComplete = false) {
  const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
  if (!messageEl) return;
  
  const bubble = messageEl.querySelector('.message-bubble');
  if (!bubble) return;
  
  if (isComplete) {
    bubble.classList.remove('typing');
  }
  
  bubble.innerHTML = renderMessageContent(content);
  
  // Auto scroll si on est proche du bas
  const chatMain = document.getElementById('chatMain');
  if (chatMain) {
    const isNearBottom = chatMain.scrollHeight - chatMain.scrollTop - chatMain.clientHeight < 200;
    if (isNearBottom) {
      scrollToBottom();
    }
  }
}

// ═══ REMOVE MESSAGE ═══
export function removeMessage(messageId) {
  const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
  if (messageEl) {
    messageEl.style.opacity = '0';
    messageEl.style.transform = 'translateY(-20px)';
    setTimeout(() => messageEl.remove(), 300);
  }
}

// ═══ CLEAR MESSAGES ═══
export function clearMessages() {
  const messagesList = document.getElementById('messagesList');
  if (messagesList) {
    messagesList.innerHTML = '';
  }
  
  const emptyState = document.getElementById('chatEmpty');
  if (emptyState) {
    emptyState.style.display = 'flex';
  }
}

// ═══ RENDER MESSAGE CONTENT ═══
function renderMessageContent(content) {
  // Sanitize HTML
  let html = sanitizeHTML(content);
  
  // Support Markdown basique
  
  // Bold: **text** ou __text__
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
  
  // Italic: *text* ou _text_
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/_(.*?)_/g, '<em>$1</em>');
  
  // Code inline: `code`
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  
  // Code block: ```code```
  html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
  
  // Links: [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  
  // Line breaks
  html = html.replace(/\n/g, '<br>');
  
  return html;
}

// ═══ SCROLL TO BOTTOM ═══
export function scrollToBottom(smooth = true) {
  const chatMain = document.getElementById('chatMain');
  if (chatMain) {
    chatMain.scrollTo({
      top: chatMain.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto'
    });
  }
}

// ═══ SHOW TYPING INDICATOR ═══
export function showTypingIndicator() {
  const existingTyping = document.querySelector('.message.assistant.typing-indicator');
  if (existingTyping) return existingTyping.dataset.messageId;
  
  const messageId = 'typing_' + Date.now();
  addMessage('assistant', '', {
    id: messageId,
    isTyping: true
  });
  
  const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
  if (messageEl) {
    messageEl.classList.add('typing-indicator');
  }
  
  return messageId;
}

// ═══ HIDE TYPING INDICATOR ═══
export function hideTypingIndicator(messageId) {
  if (messageId) {
    removeMessage(messageId);
  } else {
    const typingIndicator = document.querySelector('.message.typing-indicator');
    if (typingIndicator) {
      typingIndicator.remove();
    }
  }
}

// ═══ SHOW ERROR MESSAGE ═══
export function showErrorMessage(errorText) {
  const messageId = 'error_' + Date.now();
  const messageEl = addMessage('assistant', errorText, { id: messageId });
  
  if (messageEl) {
    messageEl.classList.add('error-message');
    const bubble = messageEl.querySelector('.message-bubble');
    if (bubble) {
      bubble.style.borderColor = 'var(--red)';
      bubble.style.background = 'rgba(255, 77, 109, 0.1)';
    }
  }
  
  return messageId;
}

// ═══ LOAD MESSAGES ═══
export function loadMessages(messages, options = {}) {
  clearMessages();
  
  messages.forEach((message, index) => {
    const messageOptions = {
      id: message.id || `msg_${index}`,
      timestamp: message.timestamp,
      avatarUrl: message.role === 'user' ? options.userAvatarUrl : null,
      userInitial: options.userInitial
    };
    
    addMessage(message.role, message.content, messageOptions);
  });
  
  // Scroll sans smooth pour le chargement initial
  setTimeout(() => scrollToBottom(false), 100);
}

// ═══ AUTO-RESIZE TEXTAREA ═══
export function initAutoResizeTextarea(textareaId) {
  const textarea = document.getElementById(textareaId);
  if (!textarea) return;
  
  textarea.addEventListener('input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
  });
}

// ═══ SCROLL DETECTION ═══
export function initScrollDetection() {
  const chatMain = document.getElementById('chatMain');
  const scrollBtn = document.getElementById('scrollToBottom');
  
  if (!chatMain || !scrollBtn) return;
  
  chatMain.addEventListener('scroll', () => {
    const isAtBottom = chatMain.scrollHeight - chatMain.scrollTop - chatMain.clientHeight < 100;
    scrollBtn.classList.toggle('visible', !isAtBottom);
  });
}

// ═══ COPY MESSAGE ═══
export function copyMessage(messageId) {
  const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
  if (!messageEl) return;
  
  const bubble = messageEl.querySelector('.message-bubble');
  if (!bubble) return;
  
  const text = bubble.textContent;
  
  navigator.clipboard.writeText(text).then(() => {
    console.log('✅ Message copied');
  }).catch(err => {
    console.error('❌ Copy failed:', err);
  });
}

// ═══ DELETE MESSAGE (UI ONLY) ═══
export function deleteMessageUI(messageId) {
  removeMessage(messageId);
}

// ═══ SET LOGO STATE ═══
export function setLogoState(state) {
  const logo = document.getElementById('evaLogo');
  const statusDot = document.getElementById('statusDot');
  
  if (!logo || !statusDot) return;
  
  // Remove all states
  logo.classList.remove('listening', 'speaking', 'thinking');
  statusDot.classList.remove('listening', 'speaking', 'error');
  
  // Add new state
  if (state && state !== 'idle') {
    logo.classList.add(state);
    statusDot.classList.add(state);
  }
}

// ═══ SHOW EMPTY STATE ═══
export function showEmptyState() {
  const emptyState = document.getElementById('chatEmpty');
  if (emptyState) {
    emptyState.style.display = 'flex';
  }
}

// ═══ HIDE EMPTY STATE ═══
export function hideEmptyState() {
  const emptyState = document.getElementById('chatEmpty');
  if (emptyState) {
    emptyState.style.display = 'none';
  }
}

// ═══ INIT CHAT UI ═══
export function initChatUI() {
  initAutoResizeTextarea('messageInput');
  initScrollDetection();
  
  console.log('✅ Chat UI initialized');
}

export default {
  addMessage,
  updateMessage,
  removeMessage,
  clearMessages,
  scrollToBottom,
  showTypingIndicator,
  hideTypingIndicator,
  showErrorMessage,
  loadMessages,
  initAutoResizeTextarea,
  initScrollDetection,
  copyMessage,
  deleteMessageUI,
  setLogoState,
  showEmptyState,
  hideEmptyState,
  initChatUI
};
