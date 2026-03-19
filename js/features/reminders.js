/* ═══════════════════════════════════════════════════════════
   EVA V3 - REMINDERS.JS
   Système de rappels avec notifications
   ═══════════════════════════════════════════════════════════ */

import { db, timestamp } from '../core/firebase-config.js';
import { toast, generateId, formatDateTime } from '../core/utils.js';

// Variables globales
let activeReminders = [];
let checkInterval = null;

// ═══ INIT REMINDERS ═══
export async function initReminders(userId) {
  try {
    await loadReminders(userId);
    startReminderChecker();
    
    console.log('✅ Reminders system initialized');
    return { success: true };
  } catch (error) {
    console.error('Init reminders error:', error);
    return { success: false, error: error.message };
  }
}

// ═══ CREATE REMINDER ═══
export async function createReminder(userId, reminderData) {
  try {
    const reminderId = generateId('reminder');
    
    const reminder = {
      text: reminderData.text,
      datetime: reminderData.datetime, // Date object or Timestamp
      completed: false,
      notified: false,
      createdAt: timestamp()
    };
    
    await db.collection('users').doc(userId)
      .collection('reminders').doc(reminderId)
      .set(reminder);
    
    activeReminders.push({ id: reminderId, ...reminder });
    
    toast('Rappel créé', 'success');
    return { success: true, reminderId, reminder };
  } catch (error) {
    console.error('Create reminder error:', error);
    toast('Erreur création rappel', 'error');
    return { success: false, error: error.message };
  }
}

// ═══ UPDATE REMINDER ═══
export async function updateReminder(userId, reminderId, updates) {
  try {
    await db.collection('users').doc(userId)
      .collection('reminders').doc(reminderId)
      .update(updates);
    
    // Update local
    const index = activeReminders.findIndex(r => r.id === reminderId);
    if (index !== -1) {
      activeReminders[index] = { ...activeReminders[index], ...updates };
    }
    
    toast('Rappel modifié', 'success');
    return { success: true };
  } catch (error) {
    console.error('Update reminder error:', error);
    toast('Erreur modification', 'error');
    return { success: false, error: error.message };
  }
}

// ═══ DELETE REMINDER ═══
export async function deleteReminder(userId, reminderId) {
  try {
    await db.collection('users').doc(userId)
      .collection('reminders').doc(reminderId)
      .delete();
    
    // Remove from local
    activeReminders = activeReminders.filter(r => r.id !== reminderId);
    
    toast('Rappel supprimé', 'success');
    return { success: true };
  } catch (error) {
    console.error('Delete reminder error:', error);
    toast('Erreur suppression', 'error');
    return { success: false, error: error.message };
  }
}

// ═══ LOAD REMINDERS ═══
export async function loadReminders(userId) {
  try {
    const snapshot = await db.collection('users').doc(userId)
      .collection('reminders')
      .where('completed', '==', false)
      .orderBy('datetime', 'asc')
      .get();
    
    activeReminders = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      activeReminders.push({
        id: doc.id,
        ...data,
        datetime: data.datetime?.toDate ? data.datetime.toDate() : new Date(data.datetime)
      });
    });
    
    return { success: true, reminders: activeReminders };
  } catch (error) {
    console.error('Load reminders error:', error);
    return { success: false, error: error.message };
  }
}

// ═══ GET REMINDERS ═══
export async function getReminders(userId, includeCompleted = false) {
  try {
    let query = db.collection('users').doc(userId)
      .collection('reminders')
      .orderBy('datetime', 'asc');
    
    if (!includeCompleted) {
      query = query.where('completed', '==', false);
    }
    
    const snapshot = await query.get();
    
    const reminders = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      reminders.push({
        id: doc.id,
        ...data,
        datetime: data.datetime?.toDate ? data.datetime.toDate() : new Date(data.datetime)
      });
    });
    
    return { success: true, reminders };
  } catch (error) {
    console.error('Get reminders error:', error);
    return { success: false, error: error.message };
  }
}

// ═══ COMPLETE REMINDER ═══
export async function completeReminder(userId, reminderId) {
  return await updateReminder(userId, reminderId, {
    completed: true,
    completedAt: timestamp()
  });
}

// ═══ UNCOMPLETE REMINDER ═══
export async function uncompleteReminder(userId, reminderId) {
  return await updateReminder(userId, reminderId, {
    completed: false,
    completedAt: null
  });
}

// ═══ START REMINDER CHECKER ═══
function startReminderChecker() {
  if (checkInterval) return;
  
  checkInterval = setInterval(() => {
    checkReminders();
  }, 30000); // Check every 30 seconds
}

// ═══ STOP REMINDER CHECKER ═══
export function stopReminderChecker() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
}

// ═══ CHECK REMINDERS ═══
function checkReminders() {
  const now = new Date();
  
  activeReminders.forEach(reminder => {
    if (reminder.completed || reminder.notified) return;
    
    const reminderTime = reminder.datetime instanceof Date 
      ? reminder.datetime 
      : new Date(reminder.datetime);
    
    // Check if time has passed
    if (now >= reminderTime) {
      triggerReminder(reminder);
    }
  });
}

// ═══ TRIGGER REMINDER ═══
function triggerReminder(reminder) {
  console.log('📌 Reminder triggered:', reminder.text);
  
  // Mark as notified
  reminder.notified = true;
  
  // Play notification sound
  playNotificationSound();
  
  // Show notification
  showReminderNotification(reminder);
  
  // Toast
  toast(`📌 ${reminder.text}`, 'info');
}

// ═══ PLAY NOTIFICATION SOUND ═══
function playNotificationSound() {
  try {
    const audio = new Audio('assets/sounds/notification.mp3');
    audio.volume = 0.5;
    audio.play().catch(err => {
      console.error('Play notification sound error:', err);
    });
  } catch (error) {
    console.error('Notification sound error:', error);
  }
}

// ═══ SHOW REMINDER NOTIFICATION ═══
function showReminderNotification(reminder) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('E.V.A — Rappel', {
      body: reminder.text,
      icon: 'assets/images/eva.svg',
      badge: 'assets/images/favicon.svg',
      tag: 'reminder_' + reminder.id
    });
  }
}

// ═══ GET UPCOMING REMINDERS ═══
export function getUpcomingReminders(hours = 24) {
  const now = new Date();
  const future = new Date(now.getTime() + hours * 60 * 60 * 1000);
  
  return activeReminders.filter(r => {
    if (r.completed) return false;
    const reminderTime = r.datetime instanceof Date ? r.datetime : new Date(r.datetime);
    return reminderTime >= now && reminderTime <= future;
  });
}

// ═══ GET ACTIVE REMINDERS ═══
export function getActiveReminders() {
  return activeReminders.filter(r => !r.completed);
}

export default {
  initReminders,
  createReminder,
  updateReminder,
  deleteReminder,
  loadReminders,
  getReminders,
  completeReminder,
  uncompleteReminder,
  stopReminderChecker,
  getUpcomingReminders,
  getActiveReminders
};
