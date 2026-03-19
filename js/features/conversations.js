/* ═══════════════════════════════════════════════════════════
   EVA V3 - CONVERSATIONS.JS
   Gestion des conversations dans Firestore
   Chargé comme script classique (pas ES6 module)
   ═══════════════════════════════════════════════════════════ */

(function() {

// ═══ UTILITAIRES INTERNES ═══
function _generateId(prefix) {
  return (prefix || 'id') + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function _truncate(text, maxLength) {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

function _toast(msg, type) {
  if (window.showEvaToast) {
    window.showEvaToast(msg, type);
  } else {
    console.log('[EVA conversations ' + (type || 'info') + ']', msg);
  }
}

// ═══ CREATE CONVERSATION ═══
async function createConversation(userId, title, tone) {
  title = title || 'Nouvelle conversation';
  tone = tone || 'normal';
  try {
    const conversationId = _generateId('conv');

    const conversation = {
      title,
      tone,
      createdAt: window.timestamp(),
      updatedAt: window.timestamp(),
      messageCount: 0,
      lastMessage: null
    };

    await window.db.collection('users').doc(userId)
      .collection('conversations').doc(conversationId)
      .set(conversation);

    return {
      success: true,
      conversationId,
      conversation
    };
  } catch (error) {
    console.error('Create conversation error:', error);
    return { success: false, error: error.message };
  }
}

// ═══ SAVE MESSAGE ═══
async function saveMessage(userId, conversationId, message) {
  try {
    const messageId = _generateId('msg');

    const messageData = {
      role: message.role,
      content: message.content,
      timestamp: window.timestamp()
    };
    if (message.metadata) messageData.metadata = message.metadata;

    // Sauvegarder le message
    await window.db.collection('users').doc(userId)
      .collection('conversations').doc(conversationId)
      .collection('messages').doc(messageId)
      .set(messageData);

    // Mettre à jour la conversation
    await window.db.collection('users').doc(userId)
      .collection('conversations').doc(conversationId)
      .update({
        updatedAt: window.timestamp(),
        lastMessage: _truncate(message.content, 100),
        messageCount: window.increment(1)
      });

    return { success: true, messageId };
  } catch (error) {
    console.error('Save message error:', error);
    return { success: false, error: error.message };
  }
}

// ═══ SAVE MESSAGES (BATCH) ═══
async function saveMessages(userId, conversationId, messages) {
  try {
    const batch = window.db.batch();
    const convRef = window.db.collection('users').doc(userId)
      .collection('conversations').doc(conversationId);

    let lastMessage = null;

    messages.forEach(function(message) {
      const messageId = _generateId('msg');
      const messageRef = convRef.collection('messages').doc(messageId);

      const data = {
        role: message.role,
        content: message.content,
        timestamp: window.timestamp()
      };
      if (message.metadata) data.metadata = message.metadata;

      batch.set(messageRef, data);
      lastMessage = message.content;
    });

    // Mettre à jour la conversation
    batch.update(convRef, {
      updatedAt: window.timestamp(),
      lastMessage: _truncate(lastMessage, 100),
      messageCount: window.increment(messages.length)
    });

    await batch.commit();

    return { success: true };
  } catch (error) {
    console.error('Save messages error:', error);
    return { success: false, error: error.message };
  }
}

// ═══ LOAD CONVERSATION ═══
async function loadConversation(userId, conversationId) {
  try {
    // Charger les infos de la conversation
    const convDoc = await window.db.collection('users').doc(userId)
      .collection('conversations').doc(conversationId)
      .get();

    if (!convDoc.exists) {
      return { success: false, error: 'Conversation not found' };
    }

    // Charger les messages
    const messagesSnapshot = await window.db.collection('users').doc(userId)
      .collection('conversations').doc(conversationId)
      .collection('messages')
      .orderBy('timestamp', 'asc')
      .get();

    const messages = [];
    messagesSnapshot.forEach(function(doc) {
      messages.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return {
      success: true,
      conversation: {
        id: conversationId,
        ...convDoc.data()
      },
      messages
    };
  } catch (error) {
    console.error('Load conversation error:', error);
    return { success: false, error: error.message };
  }
}

// ═══ LIST CONVERSATIONS ═══
async function listConversations(userId, limit) {
  limit = limit || 20;
  try {
    const snapshot = await window.db.collection('users').doc(userId)
      .collection('conversations')
      .orderBy('updatedAt', 'desc')
      .limit(limit)
      .get();

    const conversations = [];
    snapshot.forEach(function(doc) {
      conversations.push({
        id: doc.id,
        ...doc.data()
      });
    });

    return { success: true, conversations };
  } catch (error) {
    console.error('List conversations error:', error);
    return { success: false, error: error.message };
  }
}

// ═══ UPDATE CONVERSATION ═══
async function updateConversation(userId, conversationId, updates) {
  try {
    await window.db.collection('users').doc(userId)
      .collection('conversations').doc(conversationId)
      .update({
        ...updates,
        updatedAt: window.timestamp()
      });

    return { success: true };
  } catch (error) {
    console.error('Update conversation error:', error);
    return { success: false, error: error.message };
  }
}

// ═══ DELETE CONVERSATION ═══
async function deleteConversation(userId, conversationId) {
  try {
    // Supprimer tous les messages
    const messagesSnapshot = await window.db.collection('users').doc(userId)
      .collection('conversations').doc(conversationId)
      .collection('messages')
      .get();

    const batch = window.db.batch();

    messagesSnapshot.forEach(function(doc) {
      batch.delete(doc.ref);
    });

    // Supprimer la conversation
    const convRef = window.db.collection('users').doc(userId)
      .collection('conversations').doc(conversationId);

    batch.delete(convRef);

    await batch.commit();

    _toast('Conversation supprimée', 'success');
    return { success: true };
  } catch (error) {
    console.error('Delete conversation error:', error);
    _toast('Erreur suppression', 'error');
    return { success: false, error: error.message };
  }
}

// ═══ GENERATE TITLE ═══
function generateConversationTitle(messages, maxLength) {
  maxLength = maxLength || 50;
  const firstUserMessage = messages.find(function(m) { return m.role === 'user'; });

  if (!firstUserMessage) {
    return 'Nouvelle conversation';
  }

  let title = firstUserMessage.content.trim();
  title = title.replace(/\n/g, ' ');
  title = _truncate(title, maxLength);
  title = title.charAt(0).toUpperCase() + title.slice(1);

  return title;
}

// ═══ AUTO UPDATE TITLE ═══
async function autoUpdateConversationTitle(userId, conversationId, messages) {
  try {
    const convDoc = await window.db.collection('users').doc(userId)
      .collection('conversations').doc(conversationId)
      .get();

    if (!convDoc.exists) return { success: false };

    const data = convDoc.data();

    if (data.title === 'Nouvelle conversation' && messages.length >= 2) {
      const newTitle = generateConversationTitle(messages);

      await updateConversation(userId, conversationId, { title: newTitle });

      return { success: true, title: newTitle };
    }

    return { success: true };
  } catch (error) {
    console.error('Auto update title error:', error);
    return { success: false, error: error.message };
  }
}

// ═══ SEARCH CONVERSATIONS ═══
async function searchConversations(userId, query, limit) {
  limit = limit || 10;
  try {
    const snapshot = await window.db.collection('users').doc(userId)
      .collection('conversations')
      .orderBy('updatedAt', 'desc')
      .limit(100)
      .get();

    const queryLower = query.toLowerCase();
    const results = [];

    snapshot.forEach(function(doc) {
      const data = doc.data();
      const titleMatch = data.title && data.title.toLowerCase().includes(queryLower);
      const messageMatch = data.lastMessage && data.lastMessage.toLowerCase().includes(queryLower);

      if (titleMatch || messageMatch) {
        results.push({ id: doc.id, ...data });
      }
    });

    return {
      success: true,
      conversations: results.slice(0, limit)
    };
  } catch (error) {
    console.error('Search conversations error:', error);
    return { success: false, error: error.message };
  }
}

// ═══ GET CONVERSATION COUNT ═══
async function getConversationCount(userId) {
  try {
    const snapshot = await window.db.collection('users').doc(userId)
      .collection('conversations')
      .get();

    return { success: true, count: snapshot.size };
  } catch (error) {
    console.error('Get conversation count error:', error);
    return { success: false, error: error.message };
  }
}

// ═══ EXPORT CONVERSATION ═══
async function exportConversation(userId, conversationId, format) {
  format = format || 'json';
  try {
    const result = await loadConversation(userId, conversationId);

    if (!result.success) {
      return result;
    }

    const { conversation, messages } = result;

    if (format === 'json') {
      const data = JSON.stringify({ conversation, messages }, null, 2);
      return { success: true, data, mimeType: 'application/json' };
    }

    if (format === 'txt') {
      let text = `Conversation: ${conversation.title}\n`;
      text += `Date: ${conversation.createdAt ? new Date(conversation.createdAt.seconds * 1000).toLocaleString('fr-FR') : ''}\n`;
      text += `\n${'='.repeat(50)}\n\n`;

      messages.forEach(function(msg) {
        const role = msg.role === 'user' ? 'Vous' : 'Eva';
        text += `${role}: ${msg.content}\n\n`;
      });

      return { success: true, data: text, mimeType: 'text/plain' };
    }

    return { success: false, error: 'Unsupported format' };
  } catch (error) {
    console.error('Export conversation error:', error);
    return { success: false, error: error.message };
  }
}

// Expose globally
window.EVAConversations = {
  createConversation,
  saveMessage,
  saveMessages,
  loadConversation,
  listConversations,
  updateConversation,
  deleteConversation,
  generateConversationTitle,
  autoUpdateConversationTitle,
  searchConversations,
  getConversationCount,
  exportConversation
};

})();
