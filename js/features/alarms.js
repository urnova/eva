/* ═══════════════════════════════════════════════════════════
   EVA V3 - ALARMS.JS
   Système d'alarmes avec notifications
   ═══════════════════════════════════════════════════════════ */

import { db, timestamp } from '../core/firebase-config.js';
import { toast, generateId } from '../core/utils.js';

// Variables globales
let activeAlarms = [];
let checkInterval = null;

// ═══ INIT ALARMS ═══
export async function initAlarms(userId) {
  try {
    await loadAlarms(userId);
    startAlarmChecker();
    
    console.log('✅ Alarms system initialized');
    return { success: true };
  } catch (error) {
    console.error('Init alarms error:', error);
    return { success: false, error: error.message };
  }
}

// ═══ CREATE ALARM ═══
export async function createAlarm(userId, alarmData) {
  try {
    const alarmId = generateId('alarm');
    
    const alarm = {
      time: alarmData.time, // Format "HH:MM"
      label: alarmData.label || 'Alarme',
      days: alarmData.days || [], // ["monday", "tuesday", ...]
      enabled: alarmData.enabled !== false,
      sound: alarmData.sound || 'default',
      createdAt: timestamp()
    };
    
    await db.collection('users').doc(userId)
      .collection('alarms').doc(alarmId)
      .set(alarm);
    
    activeAlarms.push({ id: alarmId, ...alarm });
    
    toast('Alarme créée', 'success');
    return { success: true, alarmId, alarm };
  } catch (error) {
    console.error('Create alarm error:', error);
    toast('Erreur création alarme', 'error');
    return { success: false, error: error.message };
  }
}

// ═══ UPDATE ALARM ═══
export async function updateAlarm(userId, alarmId, updates) {
  try {
    await db.collection('users').doc(userId)
      .collection('alarms').doc(alarmId)
      .update(updates);
    
    // Update local
    const index = activeAlarms.findIndex(a => a.id === alarmId);
    if (index !== -1) {
      activeAlarms[index] = { ...activeAlarms[index], ...updates };
    }
    
    toast('Alarme modifiée', 'success');
    return { success: true };
  } catch (error) {
    console.error('Update alarm error:', error);
    toast('Erreur modification', 'error');
    return { success: false, error: error.message };
  }
}

// ═══ DELETE ALARM ═══
export async function deleteAlarm(userId, alarmId) {
  try {
    await db.collection('users').doc(userId)
      .collection('alarms').doc(alarmId)
      .delete();
    
    // Remove from local
    activeAlarms = activeAlarms.filter(a => a.id !== alarmId);
    
    toast('Alarme supprimée', 'success');
    return { success: true };
  } catch (error) {
    console.error('Delete alarm error:', error);
    toast('Erreur suppression', 'error');
    return { success: false, error: error.message };
  }
}

// ═══ LOAD ALARMS ═══
export async function loadAlarms(userId) {
  try {
    const snapshot = await db.collection('users').doc(userId)
      .collection('alarms')
      .where('enabled', '==', true)
      .get();
    
    activeAlarms = [];
    snapshot.forEach(doc => {
      activeAlarms.push({ id: doc.id, ...doc.data() });
    });
    
    return { success: true, alarms: activeAlarms };
  } catch (error) {
    console.error('Load alarms error:', error);
    return { success: false, error: error.message };
  }
}

// ═══ GET ALARMS ═══
export async function getAlarms(userId) {
  try {
    const snapshot = await db.collection('users').doc(userId)
      .collection('alarms')
      .orderBy('time', 'asc')
      .get();
    
    const alarms = [];
    snapshot.forEach(doc => {
      alarms.push({ id: doc.id, ...doc.data() });
    });
    
    return { success: true, alarms };
  } catch (error) {
    console.error('Get alarms error:', error);
    return { success: false, error: error.message };
  }
}

// ═══ TOGGLE ALARM ═══
export async function toggleAlarm(userId, alarmId, enabled) {
  return await updateAlarm(userId, alarmId, { enabled });
}

// ═══ START ALARM CHECKER ═══
function startAlarmChecker() {
  if (checkInterval) return;
  
  checkInterval = setInterval(() => {
    checkAlarms();
  }, 10000); // Check every 10 seconds
}

// ═══ STOP ALARM CHECKER ═══
export function stopAlarmChecker() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
}

// ═══ CHECK ALARMS ═══
function checkAlarms() {
  const now = new Date();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const currentDay = getDayName(now.getDay());
  
  activeAlarms.forEach(alarm => {
    if (!alarm.enabled) return;
    
    // Check time match
    if (alarm.time !== currentTime) return;
    
    // Check day match (if days specified)
    if (alarm.days && alarm.days.length > 0) {
      if (!alarm.days.includes(currentDay)) return;
    }
    
    // Trigger alarm
    triggerAlarm(alarm);
  });
}

// ═══ TRIGGER ALARM ═══
function triggerAlarm(alarm) {
  console.log('⏰ Alarm triggered:', alarm.label);
  
  // Play sound
  playAlarmSound(alarm.sound);
  
  // Show notification
  showAlarmNotification(alarm);
  
  // Toast
  toast(`⏰ ${alarm.label}`, 'info');
}

// ═══ PLAY ALARM SOUND ═══
function playAlarmSound(sound = 'default') {
  try {
    const audio = new Audio(`assets/sounds/alarm.mp3`);
    audio.volume = 0.7;
    audio.play().catch(err => {
      console.error('Play alarm sound error:', err);
    });
  } catch (error) {
    console.error('Alarm sound error:', error);
  }
}

// ═══ SHOW ALARM NOTIFICATION ═══
function showAlarmNotification(alarm) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('E.V.A — Alarme', {
      body: alarm.label,
      icon: 'assets/images/eva.svg',
      badge: 'assets/images/favicon.svg',
      tag: 'alarm_' + alarm.id,
      requireInteraction: true
    });
  }
}

// ═══ REQUEST NOTIFICATION PERMISSION ═══
export async function requestNotificationPermission() {
  if (!('Notification' in window)) {
    return { success: false, error: 'Notifications not supported' };
  }
  
  if (Notification.permission === 'granted') {
    return { success: true, permission: 'granted' };
  }
  
  try {
    const permission = await Notification.requestPermission();
    return { success: permission === 'granted', permission };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ═══ GET DAY NAME ═══
function getDayName(dayIndex) {
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return days[dayIndex];
}

// ═══ GET ACTIVE ALARMS ═══
export function getActiveAlarms() {
  return [...activeAlarms];
}

export default {
  initAlarms,
  createAlarm,
  updateAlarm,
  deleteAlarm,
  loadAlarms,
  getAlarms,
  toggleAlarm,
  stopAlarmChecker,
  requestNotificationPermission,
  getActiveAlarms
};
